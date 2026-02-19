/**
 * Memory 压缩逻辑
 *
 * 当未压缩的小总结达到阈值时，调用 Summarizer AI 压缩并通过命令写入结果。
 */

import { commandBus, eventBus } from "@/core";
import { MemoryCommands } from "@/domain/commands";
import type { TriggerCompressionPayload } from "@/domain/commands/memory";
import type { MegaSummary, MiniSummary } from "@/domain/entities/memory";
import { MemoryEvents } from "@/domain/events";
import type {
  CompressionFailedPayload,
  CompressionSkippedPayload,
} from "@/domain/events/memory";
import { aiManager } from "@/lib/ai/manager";
import { resolveAIConfig } from "@/lib/ai/resolve-config";
import type { Message } from "@/lib/ai/types";
import { usePresetStore } from "@/lib/prompt";
import { useSettingsStore } from "@/stores/settings";
import { parseMemoryMarkerConfig } from "./memory-injector";
import { useMemoryStore } from "./store";

/** 正在压缩中的会话（并发锁） */
const compressingConversationIds = new Set<string>();

function getCompressionThresholdFromNarrativePreset(): number {
  const presetStore = usePresetStore.getState();
  const narrativePreset = presetStore.activePreset;
  const memoryBlock = narrativePreset?.blocks.find(
    (block) =>
      block.marker && block.markerType === "memorySummary" && block.enabled,
  );

  if (!memoryBlock) {
    return 0;
  }

  return parseMemoryMarkerConfig(memoryBlock.markerConfig).compressionThreshold;
}

function getUncompressedMiniSummaries(conversationId: string): MiniSummary[] {
  const memoryState = useMemoryStore.getState();
  return (memoryState.miniSummaries[conversationId] ?? [])
    .filter((summary) => !summary.compressed)
    .sort((left, right) => left.messageIndex - right.messageIndex);
}

function getExistingMegaSummaries(conversationId: string): MegaSummary[] {
  const memoryState = useMemoryStore.getState();
  return [...(memoryState.megaSummaries[conversationId] ?? [])].sort(
    (left, right) => left.messageRange.from - right.messageRange.from,
  );
}

function emitCompressionSkippedToast(
  conversationId: string,
  message: string,
): void {
  eventBus.emit(
    eventBus.createEvent<CompressionSkippedPayload>(
      MemoryEvents.COMPRESSION_SKIPPED,
      { conversationId, message },
      "lyra.memory",
    ),
  );
}

function emitCompressionFailedToast(
  conversationId: string,
  message: string,
): void {
  eventBus.emit(
    eventBus.createEvent<CompressionFailedPayload>(
      MemoryEvents.COMPRESSION_FAILED,
      { conversationId, message },
      "lyra.memory",
    ),
  );
}

function buildSummarizerUserMessage(
  miniSummaries: MiniSummary[],
  megaSummaries: MegaSummary[],
): string {
  const existingMegaSummaries =
    megaSummaries.length > 0
      ? megaSummaries.map((summary) => summary.content).join("\n")
      : "";

  const miniSummaryLines = miniSummaries.map(
    (summary, index) => `回合摘要 ${index + 1}：${summary.content}`,
  );

  return [
    "【已有剧情回顾（仅供参考，不需要重复）】",
    existingMegaSummaries,
    "",
    "【待压缩的近期事件摘要】",
    ...miniSummaryLines,
    "",
    "请将上述近期事件摘要压缩为一段连贯的剧情概要。",
  ].join("\n");
}

/**
 * 检查并触发压缩
 *
 * 在新小总结写入后调用此函数。
 * 如果未压缩小总结数量达到阈值，异步触发 Summarizer AI 压缩。
 *
 * @param conversationId 当前对话 ID
 */
export async function checkAndTriggerCompression(
  conversationId: string,
  roomId?: string,
): Promise<void> {
  // 联机模式下，只有房主执行压缩
  if (roomId) {
    const { useRoomStore } = await import("@/modules/room/store");
    const roomState = useRoomStore.getState();
    if (!roomState.currentRoom?.isHost) {
      return; // Guest 跳过压缩
    }
  }

  const threshold = getCompressionThresholdFromNarrativePreset();

  if (threshold <= 0) {
    return;
  }

  const uncompressed = getUncompressedMiniSummaries(conversationId);
  if (uncompressed.length < threshold) {
    return;
  }

  if (compressingConversationIds.has(conversationId)) {
    return;
  }

  compressingConversationIds.add(conversationId);

  try {
    // 获得锁后重新读取，避免并发下使用过期数据
    const refreshed = getUncompressedMiniSummaries(conversationId);
    if (refreshed.length < threshold) {
      return;
    }

    const toCompress = refreshed.slice(0, threshold);

    const summarizerPreset = await usePresetStore
      .getState()
      .getPresetForPurpose("summarizer");

    if (!summarizerPreset) {
      const warning =
        "未找到 Summarizer 预设，已跳过记忆压缩。请在预设设置中配置 Summarizer 预设。";
      console.warn(`[MemoryCompression] ${warning}`);
      emitCompressionSkippedToast(conversationId, warning);
      return;
    }

    const systemPrompt = summarizerPreset.blocks[0]?.content?.trim();
    if (!systemPrompt) {
      const warning = `Summarizer 预设"${summarizerPreset.name}"缺少系统提示词，已跳过记忆压缩。`;
      console.warn(`[MemoryCompression] ${warning}`);
      emitCompressionSkippedToast(conversationId, warning);
      return;
    }

    const profile = useSettingsStore
      .getState()
      .getProfileOrFallback(summarizerPreset.aiProfileId);
    const config = resolveAIConfig(profile, summarizerPreset.aiSettings);

    const existingMegaSummaries = getExistingMegaSummaries(conversationId);
    const messages: Message[] = [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: buildSummarizerUserMessage(toCompress, existingMegaSummaries),
      },
    ];

    let compressedContent = "";

    try {
      const response = await aiManager.chat(config, messages);
      compressedContent = response.content.trim();
    } catch (error) {
      const warning = "记忆压缩失败，已跳过本次压缩。";
      console.warn("[MemoryCompression] AI compression failed:", error);
      emitCompressionFailedToast(conversationId, warning);
      return;
    }

    if (!compressedContent) {
      const warning = "Summarizer 返回空内容，已跳过本次压缩。";
      console.warn(`[MemoryCompression] ${warning}`);
      emitCompressionFailedToast(conversationId, warning);
      return;
    }

    const payload: TriggerCompressionPayload = {
      conversationId,
      miniSummaryIds: toCompress.map((summary) => summary.id),
      megaSummaryContent: compressedContent,
      messageRange: {
        from: toCompress[0].messageIndex,
        to: toCompress[toCompress.length - 1].messageIndex,
      },
      roomId,
    };

    const dispatchResult = await commandBus.dispatch<
      TriggerCompressionPayload,
      { megaSummaryId: string }
    >({
      type: MemoryCommands.TRIGGER_COMPRESSION,
      payload,
    });

    if (!dispatchResult.success) {
      const warning = `写入压缩结果失败：${dispatchResult.error ?? "未知错误"}`;
      console.warn(`[MemoryCompression] ${warning}`);
      emitCompressionFailedToast(conversationId, warning);
    }
  } finally {
    compressingConversationIds.delete(conversationId);
  }
}
