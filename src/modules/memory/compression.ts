/**
 * Memory 压缩逻辑
 *
 * 当未压缩的小总结达到阈值时，调用 Summarizer AI 压缩并通过命令写入结果。
 */

import { commandBus, eventBus } from "@/core";
import { MemoryCommands } from "@/domain/commands";
import type { TriggerCompressionPayload } from "@/domain/commands/memory";
import {
  WARNING_CODES,
  type WarningCode,
} from "@/domain/constants/warning-codes";
import type { MegaSummary, MiniSummary } from "@/domain/entities/memory";
import { MemoryEvents } from "@/domain/events";
import type {
  CompressionFailedPayload,
  CompressionSkippedPayload,
} from "@/domain/events/memory";
import { createAiExecutor } from "@/lib/ai";
import { resolveAIConfig } from "@/lib/ai/resolve-config";
import {
  messageAssembler,
  usePresetStore,
  type VariableContext,
} from "@/lib/prompt";
import { useAiOutputLogStore } from "@/stores";
import { useSettingsStore } from "@/stores/settings";
import { parseMemoryMarkerConfig } from "./memory-injector";
import { useMemoryStore } from "./store";

/** 正在压缩中的会话（并发锁） */
const compressingConversationIds = new Set<string>();

interface SummarizerAppendMegaDelta {
  content: string;
  sourceMiniSummaryIds: string[];
  messageRange: MegaSummary["messageRange"];
}

interface SummarizerStructuredOutput {
  memoryDelta: {
    appendMega: SummarizerAppendMegaDelta[];
  };
  warnings?: string[];
}

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

function buildSummarizerSource(
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

function buildSummarizerVariableContext(
  miniSummaries: MiniSummary[],
  megaSummaries: MegaSummary[],
): VariableContext {
  return {
    mode: "solo",
    user: { name: "Summarizer" },
    chatHistory: [],
    summarySource: buildSummarizerSource(miniSummaries, megaSummaries),
  };
}

function buildSummarizerMessageRange(
  miniSummaries: MiniSummary[],
): MegaSummary["messageRange"] {
  const first = miniSummaries[0];
  const last = miniSummaries[miniSummaries.length - 1];

  if (!first || !last) {
    throw new Error("Summarizer 压缩输入为空，无法计算 messageRange。");
  }

  return {
    from: first.messageIndex,
    to: last.messageIndex,
  };
}

function parseSummarizerStructuredOutput(
  rawOutput: string,
  miniSummaries: MiniSummary[],
): SummarizerStructuredOutput | null {
  const content = rawOutput.trim();

  if (!content) {
    return null;
  }

  return {
    memoryDelta: {
      appendMega: [
        {
          content,
          sourceMiniSummaryIds: miniSummaries.map((summary) => summary.id),
          messageRange: buildSummarizerMessageRange(miniSummaries),
        },
      ],
    },
  };
}

function mapAppendMegaToCompressionPayload(
  conversationId: string,
  appendMega: SummarizerAppendMegaDelta,
  roomId?: string,
): TriggerCompressionPayload | null {
  const megaSummaryContent = appendMega.content.trim();

  if (!megaSummaryContent) {
    return null;
  }

  return {
    conversationId,
    miniSummaryIds: [...appendMega.sourceMiniSummaryIds],
    megaSummaryContent,
    messageRange: appendMega.messageRange,
    roomId,
  };
}

function getSummarizerTurn(miniSummaries: MiniSummary[]): number {
  if (miniSummaries.length === 0) {
    return 0;
  }

  return miniSummaries[miniSummaries.length - 1].messageIndex;
}

function getNextSequenceIndexForTurn(turn: number): number {
  const entries = useAiOutputLogStore.getState().entries;
  let maxSequenceIndex = -1;

  for (const entry of entries) {
    if (entry.turn !== turn) {
      continue;
    }

    if (entry.sequenceIndex > maxSequenceIndex) {
      maxSequenceIndex = entry.sequenceIndex;
    }
  }

  return maxSequenceIndex + 1;
}

function formatSummarizerWarning(
  warningCode: WarningCode,
  warning: string,
): string {
  return `[${warningCode}] ${warning}`;
}

function appendSummarizerAiOutput(entry: {
  turn: number;
  rawOutput: string;
  success: boolean;
  duration?: number;
  error?: string;
  correlationId?: string;
}): void {
  useAiOutputLogStore.getState().appendEntry({
    turn: entry.turn,
    source: "summarizer",
    sequenceIndex: getNextSequenceIndexForTurn(entry.turn),
    rawOutput: entry.rawOutput,
    duration: entry.duration,
    success: entry.success,
    error: entry.error,
    timestamp: Date.now(),
    correlationId: entry.correlationId,
  });
}

function reportSummarizerFailure(params: {
  conversationId: string;
  turn: number;
  warningCode: WarningCode;
  warning: string;
  duration: number;
  rawOutput?: string;
  error?: string;
  correlationId?: string;
}): void {
  const formattedWarning = formatSummarizerWarning(
    params.warningCode,
    params.warning,
  );
  console.warn(`[MemoryCompression] ${formattedWarning}`);
  appendSummarizerAiOutput({
    turn: params.turn,
    rawOutput:
      params.rawOutput && params.rawOutput.trim().length > 0
        ? `${formattedWarning}\n\n${params.rawOutput}`
        : formattedWarning,
    success: false,
    duration: params.duration,
    error:
      params.error != null && params.error.length > 0
        ? `[${params.warningCode}] ${params.error}`
        : formattedWarning,
    correlationId: params.correlationId,
  });
  emitCompressionFailedToast(params.conversationId, params.warning);
}

function reportSummarizerSkipped(params: {
  conversationId: string;
  turn: number;
  warningCode: WarningCode;
  warning: string;
  duration?: number;
  correlationId?: string;
}): void {
  const formattedWarning = formatSummarizerWarning(
    params.warningCode,
    params.warning,
  );
  console.warn(`[MemoryCompression] ${formattedWarning}`);
  appendSummarizerAiOutput({
    turn: params.turn,
    rawOutput: formattedWarning,
    success: false,
    duration: params.duration,
    error: formattedWarning,
    correlationId: params.correlationId,
  });
  emitCompressionSkippedToast(params.conversationId, params.warning);
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
  correlationId?: string,
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
    const summarizerTurn = getSummarizerTurn(toCompress);
    const startedAt = performance.now();

    const summarizerPreset = await usePresetStore
      .getState()
      .getPresetForPurpose("summarizer");

    if (!summarizerPreset) {
      reportSummarizerSkipped({
        conversationId,
        turn: summarizerTurn,
        warningCode: WARNING_CODES.SUMMARIZER_PRESET_NOT_FOUND,
        warning:
          "未找到 Summarizer 预设，已跳过记忆压缩。请在预设设置中配置 Summarizer 预设。",
        duration: performance.now() - startedAt,
        correlationId,
      });
      return;
    }

    const profile = useSettingsStore
      .getState()
      .getProfileOrFallback(summarizerPreset.aiProfileId);
    const config = resolveAIConfig(profile, summarizerPreset.aiSettings);

    const existingMegaSummaries = getExistingMegaSummaries(conversationId);

    let compressionPayload: TriggerCompressionPayload | null = null;
    let rawOutput = "";

    try {
      const variableContext = buildSummarizerVariableContext(
        toCompress,
        existingMegaSummaries,
      );
      const assembledMessages = messageAssembler.assemble(
        summarizerPreset,
        variableContext,
      );
      const hasRenderableMessage = assembledMessages.some(
        (message) => message.content.trim().length > 0,
      );

      if (!hasRenderableMessage) {
        const duration = performance.now() - startedAt;
        reportSummarizerFailure({
          conversationId,
          turn: summarizerTurn,
          warningCode: WARNING_CODES.SUMMARIZER_NO_VALID_MESSAGES,
          warning: "Summarizer 统一链路未组装出有效提示消息，已跳过本次压缩。",
          duration,
          error: "assembler_missing_renderable_message",
          correlationId,
        });
        return;
      }

      const executor = createAiExecutor(config);
      const result = await executor.execute({
        preset: summarizerPreset,
        variableContext,
      });
      const duration = performance.now() - startedAt;

      if (result.aborted) {
        reportSummarizerFailure({
          conversationId,
          turn: summarizerTurn,
          warningCode: WARNING_CODES.SUMMARIZER_AI_CALL_FAILED,
          warning: "记忆压缩已中止，已跳过本次压缩。",
          duration,
          error: "summarizer_aborted",
          correlationId,
        });
        return;
      }

      if (!result.success) {
        reportSummarizerFailure({
          conversationId,
          turn: summarizerTurn,
          warningCode: WARNING_CODES.SUMMARIZER_AI_CALL_FAILED,
          warning: "记忆压缩失败，已跳过本次压缩。",
          duration,
          error: result.error?.message ?? "Summarizer executor failed",
          correlationId,
        });
        return;
      }

      rawOutput = result.content ?? "";
      const structuredOutput = parseSummarizerStructuredOutput(
        rawOutput,
        toCompress,
      );

      if (!structuredOutput) {
        reportSummarizerFailure({
          conversationId,
          turn: summarizerTurn,
          warningCode: WARNING_CODES.SUMMARIZER_EMPTY_RESPONSE,
          warning: "Summarizer 返回空内容，已跳过本次压缩。",
          duration,
          rawOutput,
          error: "summarizer_empty",
          correlationId,
        });
        return;
      }

      const appendMega = structuredOutput.memoryDelta.appendMega[0];
      if (!appendMega) {
        reportSummarizerFailure({
          conversationId,
          turn: summarizerTurn,
          warningCode: WARNING_CODES.SUMMARIZER_NO_MEGA_DELTA,
          warning:
            "Summarizer 统一链路未生成 memoryDelta.appendMega，已跳过本次压缩。",
          duration,
          rawOutput,
          error: "summarizer_missing_appendMega",
          correlationId,
        });
        return;
      }

      compressionPayload = mapAppendMegaToCompressionPayload(
        conversationId,
        appendMega,
        roomId,
      );

      if (!compressionPayload) {
        reportSummarizerFailure({
          conversationId,
          turn: summarizerTurn,
          warningCode: WARNING_CODES.SUMMARIZER_NO_MEGA_DELTA,
          warning:
            "Summarizer 统一链路生成的 memoryDelta.appendMega 无效，已跳过本次压缩。",
          duration,
          rawOutput,
          error: "summarizer_invalid_appendMega",
          correlationId,
        });
        return;
      }

      appendSummarizerAiOutput({
        turn: summarizerTurn,
        rawOutput,
        success: true,
        duration,
        correlationId,
      });
    } catch (error) {
      const duration = performance.now() - startedAt;
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.warn(
        `[MemoryCompression] ${WARNING_CODES.SUMMARIZER_AI_CALL_FAILED}: Unified summarizer failed:`,
        error,
      );
      reportSummarizerFailure({
        conversationId,
        turn: summarizerTurn,
        warningCode: WARNING_CODES.SUMMARIZER_AI_CALL_FAILED,
        warning: "记忆压缩失败，已跳过本次压缩。",
        duration,
        error: errorMessage,
        correlationId,
      });
      return;
    }

    if (!compressionPayload) {
      return;
    }

    const dispatchResult = await commandBus.dispatch<
      TriggerCompressionPayload,
      { megaSummaryId: string }
    >({
      type: MemoryCommands.TRIGGER_COMPRESSION,
      payload: compressionPayload,
    });

    if (!dispatchResult.success) {
      const warning = `写入压缩结果失败：${dispatchResult.error ?? "未知错误"}`;
      const formattedWarning = formatSummarizerWarning(
        WARNING_CODES.SUMMARIZER_WRITE_FAILED,
        warning,
      );
      console.warn(`[MemoryCompression] ${formattedWarning}`);
      appendSummarizerAiOutput({
        turn: summarizerTurn,
        rawOutput: formattedWarning,
        success: false,
        error: formattedWarning,
        correlationId,
      });
      emitCompressionFailedToast(conversationId, warning);
    }
  } finally {
    compressingConversationIds.delete(conversationId);
  }
}
