/**
 * Memory 注入器
 *
 * 负责在构建 VariableContext 前，根据 marker 配置计算记忆注入数据。
 */

import type { MegaSummary, MiniSummary } from "@/domain/entities/memory";
import type { Preset } from "@/lib/prompt/types";
import { useMemoryStore } from "./store";

/** memorySummary Marker 配置 */
export interface MemoryMarkerConfig {
  /** 最近 N 回合发送完整 AI 正文（仅 assistant 消息） */
  recentNarrativeCount: number;
  /** 在完整正文之后，发送 X 条小总结 */
  miniSummaryCount: number;
  /** 大总结发送策略 */
  megaSummaryMode: "all" | "recent";
  /** 大总结最多发送数量（megaSummaryMode === "recent" 时生效） */
  megaSummaryLimit: number;
  /** 压缩触发阈值：每累积多少条未压缩的小总结触发一次压缩 */
  compressionThreshold: number;
}

/** 默认配置 */
export const DEFAULT_MEMORY_CONFIG: MemoryMarkerConfig = {
  recentNarrativeCount: 4,
  miniSummaryCount: 10,
  megaSummaryMode: "all",
  megaSummaryLimit: 5,
  compressionThreshold: 8,
};

/** 记忆注入数据（渲染用） */
export interface MemoryData {
  /** 最近 N 回合的完整 AI 正文（按时间从旧到新排序） */
  recentNarratives: Array<{ id: string; content: string }>;
  /** 应注入的小总结列表 */
  miniSummaries: Array<{ id: string; content: string }>;
  /** 应注入的大总结列表 */
  megaSummaries: Array<{ id: string; content: string }>;
}

function toNonNegativeInteger(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  const normalized = Math.floor(value);
  return normalized >= 0 ? normalized : fallback;
}

function toMegaSummaryMode(
  value: unknown,
): MemoryMarkerConfig["megaSummaryMode"] {
  return value === "all" || value === "recent"
    ? value
    : DEFAULT_MEMORY_CONFIG.megaSummaryMode;
}

/** 从 markerConfig 解析记忆配置（含默认值回退） */
export function parseMemoryMarkerConfig(
  raw?: Record<string, unknown>,
): MemoryMarkerConfig {
  if (!raw) {
    return { ...DEFAULT_MEMORY_CONFIG };
  }

  return {
    recentNarrativeCount: toNonNegativeInteger(
      raw.recentNarrativeCount,
      DEFAULT_MEMORY_CONFIG.recentNarrativeCount,
    ),
    miniSummaryCount: toNonNegativeInteger(
      raw.miniSummaryCount,
      DEFAULT_MEMORY_CONFIG.miniSummaryCount,
    ),
    megaSummaryMode: toMegaSummaryMode(raw.megaSummaryMode),
    megaSummaryLimit: toNonNegativeInteger(
      raw.megaSummaryLimit,
      DEFAULT_MEMORY_CONFIG.megaSummaryLimit,
    ),
    compressionThreshold: toNonNegativeInteger(
      raw.compressionThreshold,
      DEFAULT_MEMORY_CONFIG.compressionThreshold,
    ),
  };
}

/**
 * 计算应注入的记忆数据
 *
 * 三级窗口模型：
 * - 完整正文：最近 N 条 assistant 消息
 * - 小总结：完整正文之前的 M 条
 * - 大总结：小总结之前的所有（或最近 K 条）
 */
export function computeMemoryData(
  /** 全部 assistant 消息（按 messageIndex 排序，从旧到新） */
  allAssistantMessages: Array<{
    id: string;
    content: string;
    messageIndex: number;
  }>,
  allMiniSummaries: MiniSummary[],
  allMegaSummaries: MegaSummary[],
  config: MemoryMarkerConfig,
): MemoryData {
  const totalAssistantCount = allAssistantMessages.length;

  // 1. 完整正文范围：最近 N 条 assistant 消息
  const narrativeCutoff = Math.max(
    0,
    totalAssistantCount - config.recentNarrativeCount,
  );
  const recentNarratives = allAssistantMessages.slice(narrativeCutoff);

  // 2. 小总结范围：narrativeCutoff 往前 miniSummaryCount 条
  const miniSummaryCutoff = Math.max(
    0,
    narrativeCutoff - config.miniSummaryCount,
  );
  const miniSummaries = allMiniSummaries.filter(
    (s) =>
      !s.compressed &&
      s.messageIndex >= miniSummaryCutoff &&
      s.messageIndex < narrativeCutoff,
  );

  // 3. 大总结范围：miniSummaryCutoff 之前的所有
  let megaSummaries = allMegaSummaries.filter(
    (s) => s.messageRange.to < miniSummaryCutoff,
  );
  if (config.megaSummaryMode === "recent") {
    megaSummaries = megaSummaries.slice(-config.megaSummaryLimit);
  }

  return {
    recentNarratives: recentNarratives.map((m) => ({
      id: m.id,
      content: m.content,
    })),
    miniSummaries: miniSummaries.map((s) => ({
      id: s.id,
      content: s.content,
    })),
    megaSummaries: megaSummaries.map((s) => ({
      id: s.id,
      content: s.content,
    })),
  };
}

/**
 * 从预设和当前记忆状态准备注入数据
 *
 * 供 chat handler 等外部模块调用。
 * 读取 memory 模块自身的 store，不跨模块读取。
 */
export function prepareMemoryData(
  conversationId: string,
  preset: Preset,
  assistantMessages: Array<{
    id: string;
    content: string;
    messageIndex: number;
  }>,
): MemoryData | undefined {
  // 查找启用的 memorySummary marker 块
  const memoryBlock = preset.blocks.find(
    (block) =>
      block.marker && block.markerType === "memorySummary" && block.enabled,
  );
  if (!memoryBlock) return undefined;

  const config = parseMemoryMarkerConfig(memoryBlock.markerConfig);

  // 从 memory store 获取总结数据
  const memoryState = useMemoryStore.getState();
  const allMiniSummaries = memoryState.miniSummaries[conversationId] ?? [];
  const allMegaSummaries = memoryState.megaSummaries[conversationId] ?? [];

  return computeMemoryData(
    assistantMessages,
    allMiniSummaries,
    allMegaSummaries,
    config,
  );
}
