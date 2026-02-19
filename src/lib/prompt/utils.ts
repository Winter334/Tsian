/**
 * 提示词系统工具函数
 */

import type {
  CharacterInfo,
  Preset,
  PromptBlock,
  VariableContext,
} from "./types";

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

/**
 * 构建变量上下文的辅助函数
 */
export function buildVariableContext(
  mode: "solo" | "multiplayer",
  data: {
    user: { name: string; character?: CharacterInfo };
    players?: Array<{
      name: string;
      character?: CharacterInfo;
    }>;
    chatHistory: Array<{
      role: "system" | "user" | "assistant";
      content: string;
    }>;
    scenario?: string;
    worldInfo?: string;
    turn?: {
      number: number;
      actions: Array<{ content: string; timestamp: number }>;
    };
    gameState?: VariableContext["gameState"];
    resultFrame?: VariableContext["resultFrame"];
    operationDefinitions?: string;
    worldConfig?: VariableContext["worldConfig"];
    activeNpcs?: VariableContext["activeNpcs"];
    inventoryData?: VariableContext["inventoryData"];
    memoryData?: VariableContext["memoryData"];
    manualMemories?: VariableContext["manualMemories"];
  },
): VariableContext {
  return {
    mode,
    user: data.user,
    players: data.players,
    chatHistory: data.chatHistory,
    scenario: data.scenario,
    worldInfo: data.worldInfo,
    turn: data.turn,
    gameState: data.gameState,
    resultFrame: data.resultFrame,
    operationDefinitions: data.operationDefinitions,
    worldConfig: data.worldConfig,
    activeNpcs: data.activeNpcs,
    inventoryData: data.inventoryData,
    memoryData: data.memoryData,
    manualMemories: data.manualMemories,
  };
}
