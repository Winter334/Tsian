/**
 * 提示词系统工具函数
 */

import type { Preset, PromptBlock } from "./types";

/**
 * 创建快速预设（用于测试/调试）
 */
export function createQuickPreset(
  systemPrompt: string,
  options?: {
    includeHistory?: boolean;
    historyMaxMessages?: number;
  },
): Preset {
  const blocks: PromptBlock[] = [
    {
      id: "system",
      name: "系统提示",
      role: "system",
      content: systemPrompt,
      marker: false,
      injectionDepth: 0,
      order: 0,
      enabled: true,
    },
  ];

  if (options?.includeHistory !== false) {
    blocks.push({
      id: "memory-summary",
      name: "分段记忆",
      role: "system",
      marker: true,
      markerType: "memorySummary",
      markerConfig: {
        recentNarrativeCount: options?.historyMaxMessages || 4,
        miniSummaryCount: 10,
        megaSummaryMode: "all" as const,
        megaSummaryLimit: 5,
        compressionThreshold: 8,
      },
      content: "",
      injectionDepth: 0,
      order: 1,
      enabled: true,
    });
  }

  return {
    id: `temp-${Date.now()}`,
    name: "临时预设",
    blocks,
    blockOrder: blocks.map((b) => b.id),
    purpose: "narrative",
    metadata: {
      version: "1.3.0",
      source: "lyra",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  };
}
