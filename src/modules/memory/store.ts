/**
 * Memory Zustand Store
 *
 * 维护记忆系统在 UI 层的响应式状态。
 * 持久化源数据由 MemoryRepository（Yjs）管理。
 */

import type {
  ManualMemory,
  MegaSummary,
  MiniSummary,
} from "@/domain/entities/memory";
import { create } from "zustand";
import type { MemoryRepository } from "./repository";

/**
 * Memory 状态
 */
interface MemoryState {
  /** 按会话 ID 分组的小总结 */
  miniSummaries: Record<string, MiniSummary[]>;
  /** 按会话 ID 分组的大总结 */
  megaSummaries: Record<string, MegaSummary[]>;
  /** 按会话 ID 分组的手动记忆 */
  manualMemories: Record<string, ManualMemory[]>;

  // ============ Actions（供 handlers 调用） ============

  /** 添加小总结 */
  addMiniSummary: (conversationId: string, summary: MiniSummary) => void;
  /** 批量设置小总结 */
  setMiniSummaries: (conversationId: string, summaries: MiniSummary[]) => void;
  /** 更新小总结内容 */
  updateMiniSummary: (
    conversationId: string,
    summaryId: string,
    content: string,
  ) => void;
  /** 标记小总结已压缩 */
  markMiniSummariesCompressed: (
    conversationId: string,
    ids: string[],
    megaSummaryId: string,
  ) => void;

  /** 添加大总结 */
  addMegaSummary: (conversationId: string, summary: MegaSummary) => void;
  /** 批量设置大总结 */
  setMegaSummaries: (conversationId: string, summaries: MegaSummary[]) => void;
  /** 更新大总结内容 */
  updateMegaSummary: (
    conversationId: string,
    summaryId: string,
    content: string,
  ) => void;

  /** 添加手动记忆 */
  addManualMemory: (conversationId: string, memory: ManualMemory) => void;
  /** 更新手动记忆 */
  updateManualMemory: (
    conversationId: string,
    id: string,
    updates: Partial<ManualMemory>,
  ) => void;
  /** 删除手动记忆 */
  deleteManualMemory: (conversationId: string, id: string) => void;
  /** 批量设置手动记忆 */
  setManualMemories: (conversationId: string, memories: ManualMemory[]) => void;

  /** 从 repository 同步指定会话数据到 store */
  syncFromRepository: (conversationId: string, repo: MemoryRepository) => void;
  /** 从 repository 全量同步所有会话数据到 store */
  syncAllFromRepository: (repo: MemoryRepository) => void;

  /** 清空 store */
  clear: () => void;
}

/**
 * 初始状态
 */
const initialState = {
  miniSummaries: {},
  megaSummaries: {},
  manualMemories: {},
};

/**
 * Memory Store
 */
export const useMemoryStore = create<MemoryState>((set) => ({
  ...initialState,

  addMiniSummary: (conversationId, summary) =>
    set((state) => ({
      miniSummaries: {
        ...state.miniSummaries,
        [conversationId]: [
          ...(state.miniSummaries[conversationId] ?? []),
          summary,
        ],
      },
    })),

  setMiniSummaries: (conversationId, summaries) =>
    set((state) => ({
      miniSummaries: {
        ...state.miniSummaries,
        [conversationId]: [...summaries],
      },
    })),

  updateMiniSummary: (conversationId, summaryId, content) =>
    set((state) => ({
      miniSummaries: {
        ...state.miniSummaries,
        [conversationId]: (state.miniSummaries[conversationId] ?? []).map(
          (summary) =>
            summary.id === summaryId
              ? {
                  ...summary,
                  content,
                }
              : summary,
        ),
      },
    })),

  markMiniSummariesCompressed: (conversationId, ids, megaSummaryId) =>
    set((state) => {
      const idSet = new Set(ids);
      const current = state.miniSummaries[conversationId] ?? [];
      return {
        miniSummaries: {
          ...state.miniSummaries,
          [conversationId]: current.map((summary) =>
            idSet.has(summary.id)
              ? {
                  ...summary,
                  compressed: true,
                  megaSummaryId,
                }
              : summary,
          ),
        },
      };
    }),

  addMegaSummary: (conversationId, summary) =>
    set((state) => ({
      megaSummaries: {
        ...state.megaSummaries,
        [conversationId]: [
          ...(state.megaSummaries[conversationId] ?? []),
          summary,
        ],
      },
    })),

  setMegaSummaries: (conversationId, summaries) =>
    set((state) => ({
      megaSummaries: {
        ...state.megaSummaries,
        [conversationId]: [...summaries],
      },
    })),

  updateMegaSummary: (conversationId, summaryId, content) =>
    set((state) => ({
      megaSummaries: {
        ...state.megaSummaries,
        [conversationId]: (state.megaSummaries[conversationId] ?? []).map(
          (summary) =>
            summary.id === summaryId
              ? {
                  ...summary,
                  content,
                }
              : summary,
        ),
      },
    })),

  addManualMemory: (conversationId, memory) =>
    set((state) => ({
      manualMemories: {
        ...state.manualMemories,
        [conversationId]: [
          ...(state.manualMemories[conversationId] ?? []),
          memory,
        ],
      },
    })),

  updateManualMemory: (conversationId, id, updates) =>
    set((state) => ({
      manualMemories: {
        ...state.manualMemories,
        [conversationId]: (state.manualMemories[conversationId] ?? []).map(
          (memory) =>
            memory.id === id
              ? {
                  ...memory,
                  ...updates,
                }
              : memory,
        ),
      },
    })),

  deleteManualMemory: (conversationId, id) =>
    set((state) => ({
      manualMemories: {
        ...state.manualMemories,
        [conversationId]: (state.manualMemories[conversationId] ?? []).filter(
          (memory) => memory.id !== id,
        ),
      },
    })),

  setManualMemories: (conversationId, memories) =>
    set((state) => ({
      manualMemories: {
        ...state.manualMemories,
        [conversationId]: [...memories],
      },
    })),

  syncFromRepository: (conversationId, repo) =>
    set((state) => ({
      miniSummaries: {
        ...state.miniSummaries,
        [conversationId]: repo.getMiniSummaries(conversationId),
      },
      megaSummaries: {
        ...state.megaSummaries,
        [conversationId]: repo.getMegaSummaries(conversationId),
      },
      manualMemories: {
        ...state.manualMemories,
        [conversationId]: repo.getManualMemories(conversationId),
      },
    })),

  syncAllFromRepository: (repo) =>
    set(() => {
      const miniSummaries: Record<string, MiniSummary[]> = {};
      const megaSummaries: Record<string, MegaSummary[]> = {};
      const manualMemories: Record<string, ManualMemory[]> = {};

      const conversationIds = repo.getConversationIds();
      conversationIds.forEach((conversationId) => {
        miniSummaries[conversationId] = repo.getMiniSummaries(conversationId);
        megaSummaries[conversationId] = repo.getMegaSummaries(conversationId);
        manualMemories[conversationId] = repo.getManualMemories(conversationId);
      });

      return {
        miniSummaries,
        megaSummaries,
        manualMemories,
      };
    }),

  clear: () => set(initialState),
}));
