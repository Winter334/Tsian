/**
 * 世界书管理 Store
 *
 * 职责：
 * - 管理世界书列表状态
 * - 管理当前激活的世界书
 * - 提供世界书和条目的 CRUD 操作
 *
 * 注意：这是全局配置 Store（类似预设 Store），
 * 管理组件可以直接调用其修改方法，业务组件应只读访问。
 */

import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { defaultLorebook } from "./presets/default";
import type { LorebookIndex } from "./storage";
import { lorebookStorage } from "./storage";
import type { Lorebook, LorebookEntry } from "./types";

// ===== ID 生成 =====

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// ===== 类型定义 =====

/**
 * 世书 Store 状态
 */
interface LorebookStoreState {
  // ===== 状态 =====

  /** 世界书索引列表 */
  lorebooks: LorebookIndex[];

  /** 当前激活的世界书 ID 列表（支持多个） */
  activeLorebookIds: string[];

  /** 已加载的世界书完整数据缓存 */
  loadedLorebooks: Map<string, Lorebook>;

  /** 是否已初始化 */
  initialized: boolean;

  /** 加载中 */
  loading: boolean;

  /** 错误信息 */
  error: string | null;

  // ===== 初始化 =====

  /** 初始化世界书系统 */
  initialize(): Promise<void>;

  // ===== 世界书操作 =====

  /** 创建世界书 */
  createLorebook(name: string, description?: string): Promise<Lorebook>;

  /** 更新世界书基本信息 */
  updateLorebook(
    id: string,
    updates: Partial<Pick<Lorebook, "name" | "description" | "settings">>
  ): Promise<void>;

  /** 删除世界书 */
  deleteLorebook(id: string): Promise<void>;

  /** 激活/停用世界书 */
  setLorebookActive(id: string, active: boolean): void;

  /** 获取世界书完整数据（从缓存或存储加载） */
  getLorebook(id: string): Promise<Lorebook | null>;

  /** 获取所有激活的世界书 */
  getActiveLorebooks(): Promise<Lorebook[]>;

  // ===== 条目操作 =====

  /** 添加条目 */
  addEntry(lorebookId: string, entry: Omit<LorebookEntry, "id">): Promise<void>;

  /** 更新条目 */
  updateEntry(
    lorebookId: string,
    entryId: string,
    updates: Partial<LorebookEntry>
  ): Promise<void>;

  /** 删除条目 */
  deleteEntry(lorebookId: string, entryId: string): Promise<void>;

  /** 批量更新条目顺序 */
  reorderEntries(lorebookId: string, entryIds: string[]): Promise<void>;

  // ===== 工具 =====

  /** 清除错误状态 */
  clearError(): void;
}

// ===== Store 实现 =====

/**
 * 世界书管理 Store
 */
export const useLorebookStore = create<LorebookStoreState>()(
  immer((set, get) => ({
    // ===== 初始状态 =====

    lorebooks: [],
    activeLorebookIds: [],
    loadedLorebooks: new Map(),
    initialized: false,
    loading: false,
    error: null,

    // ===== 初始化 =====

    initialize: async () => {
      if (get().initialized) return;

      set({ loading: true, error: null });

      try {
        // 1. 初始化存储
        await lorebookStorage.init();

        // 2. 加载索引
        let index = lorebookStorage.getLorebookIndex();

        // 3. 如果索引为空，创建默认示例世界书
        if (index.length === 0) {
          await lorebookStorage.saveLorebook(defaultLorebook);
          lorebookStorage.setActiveLorebookIds([defaultLorebook.id]);
          index = lorebookStorage.getLorebookIndex();
        }

        // 4. 加载激活状态
        const activeIds = lorebookStorage.getActiveLorebookIds();

        set({
          lorebooks: index,
          activeLorebookIds: activeIds,
          initialized: true,
          loading: false,
        });
      } catch (error) {
        set({
          error:
            error instanceof Error ? error.message : "初始化世界书系统失败",
          loading: false,
        });
        console.error("[LorebookStore] Initialize error:", error);
      }
    },

    // ===== 世界书操作 =====

    createLorebook: async (name, description) => {
      try {
        const now = Date.now();
        const newLorebook: Lorebook = {
          id: generateId("lorebook"),
          name,
          description,
          entries: [],
          settings: {
            defaultScanDepth: 2,
            caseSensitive: false,
            tokenBudget: 0,
          },
          metadata: {
            version: "1.0.0",
            createdAt: now,
            updatedAt: now,
          },
        };

        await lorebookStorage.saveLorebook(newLorebook);

        // 更新状态
        const index = lorebookStorage.getLorebookIndex();
        set((state) => {
          state.lorebooks = index;
          state.loadedLorebooks.set(newLorebook.id, newLorebook);
        });

        return newLorebook;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "创建世界书失败";
        set({ error: message });
        console.error("[LorebookStore] Create error:", error);
        throw error;
      }
    },

    updateLorebook: async (id, updates) => {
      try {
        const lorebook = await get().getLorebook(id);
        if (!lorebook) {
          throw new Error(`世界书 ${id} 不存在`);
        }

        const updatedLorebook: Lorebook = {
          ...lorebook,
          ...updates,
          id, // 确保 ID 不变
          entries: lorebook.entries, // 条目通过专用方法修改
          metadata: {
            ...lorebook.metadata,
            updatedAt: Date.now(),
          },
        };

        await lorebookStorage.saveLorebook(updatedLorebook);

        const index = lorebookStorage.getLorebookIndex();
        set((state) => {
          state.lorebooks = index;
          state.loadedLorebooks.set(id, updatedLorebook);
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "更新世界书失败";
        set({ error: message });
        console.error("[LorebookStore] Update error:", error);
        throw error;
      }
    },

    deleteLorebook: async (id) => {
      try {
        await lorebookStorage.deleteLorebook(id);

        const index = lorebookStorage.getLorebookIndex();
        const activeIds = lorebookStorage.getActiveLorebookIds();

        set((state) => {
          state.lorebooks = index;
          state.activeLorebookIds = activeIds;
          state.loadedLorebooks.delete(id);
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "删除世界书失败";
        set({ error: message });
        console.error("[LorebookStore] Delete error:", error);
        throw error;
      }
    },

    setLorebookActive: (id, active) => {
      const currentIds = get().activeLorebookIds;

      let newIds: string[];
      if (active) {
        newIds = currentIds.includes(id) ? currentIds : [...currentIds, id];
      } else {
        newIds = currentIds.filter((aid) => aid !== id);
      }

      lorebookStorage.setActiveLorebookIds(newIds);
      set({ activeLorebookIds: newIds });
    },

    getLorebook: async (id) => {
      // 先从缓存获取
      const cached = get().loadedLorebooks.get(id);
      if (cached) return cached;

      // 从存储加载
      const lorebook = await lorebookStorage.loadLorebook(id);
      if (lorebook) {
        set((state) => {
          state.loadedLorebooks.set(id, lorebook);
        });
      }
      return lorebook;
    },

    getActiveLorebooks: async () => {
      const activeIds = get().activeLorebookIds;
      const lorebooks: Lorebook[] = [];

      for (const id of activeIds) {
        const lorebook = await get().getLorebook(id);
        if (lorebook) {
          lorebooks.push(lorebook);
        }
      }

      return lorebooks;
    },

    // ===== 条目操作 =====

    addEntry: async (lorebookId, entryData) => {
      try {
        const lorebook = await get().getLorebook(lorebookId);
        if (!lorebook) {
          throw new Error(`世界书 ${lorebookId} 不存在`);
        }

        const newEntry: LorebookEntry = {
          ...entryData,
          id: generateId("entry"),
        };

        const updatedLorebook: Lorebook = {
          ...lorebook,
          entries: [...lorebook.entries, newEntry],
          metadata: {
            ...lorebook.metadata,
            updatedAt: Date.now(),
          },
        };

        await lorebookStorage.saveLorebook(updatedLorebook);

        const index = lorebookStorage.getLorebookIndex();
        set((state) => {
          state.lorebooks = index;
          state.loadedLorebooks.set(lorebookId, updatedLorebook);
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "添加条目失败";
        set({ error: message });
        console.error("[LorebookStore] Add entry error:", error);
        throw error;
      }
    },

    updateEntry: async (lorebookId, entryId, updates) => {
      try {
        const lorebook = await get().getLorebook(lorebookId);
        if (!lorebook) {
          throw new Error(`世界书 ${lorebookId} 不存在`);
        }

        const entryIndex = lorebook.entries.findIndex((e) => e.id === entryId);
        if (entryIndex < 0) {
          throw new Error(`条目 ${entryId} 不存在`);
        }

        const updatedEntries = [...lorebook.entries];
        updatedEntries[entryIndex] = {
          ...updatedEntries[entryIndex],
          ...updates,
          id: entryId, // 确保 ID 不变
        };

        const updatedLorebook: Lorebook = {
          ...lorebook,
          entries: updatedEntries,
          metadata: {
            ...lorebook.metadata,
            updatedAt: Date.now(),
          },
        };

        await lorebookStorage.saveLorebook(updatedLorebook);

        const index = lorebookStorage.getLorebookIndex();
        set((state) => {
          state.lorebooks = index;
          state.loadedLorebooks.set(lorebookId, updatedLorebook);
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "更新条目失败";
        set({ error: message });
        console.error("[LorebookStore] Update entry error:", error);
        throw error;
      }
    },

    deleteEntry: async (lorebookId, entryId) => {
      try {
        const lorebook = await get().getLorebook(lorebookId);
        if (!lorebook) {
          throw new Error(`世界书 ${lorebookId} 不存在`);
        }

        const updatedLorebook: Lorebook = {
          ...lorebook,
          entries: lorebook.entries.filter((e) => e.id !== entryId),
          metadata: {
            ...lorebook.metadata,
            updatedAt: Date.now(),
          },
        };

        await lorebookStorage.saveLorebook(updatedLorebook);

        const index = lorebookStorage.getLorebookIndex();
        set((state) => {
          state.lorebooks = index;
          state.loadedLorebooks.set(lorebookId, updatedLorebook);
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "删除条目失败";
        set({ error: message });
        console.error("[LorebookStore] Delete entry error:", error);
        throw error;
      }
    },

    reorderEntries: async (lorebookId, entryIds) => {
      try {
        const lorebook = await get().getLorebook(lorebookId);
        if (!lorebook) {
          throw new Error(`世界书 ${lorebookId} 不存在`);
        }

        // 根据新顺序更新 order 值
        const entryMap = new Map(lorebook.entries.map((e) => [e.id, e]));
        const reorderedEntries = entryIds
          .map((id, index) => {
            const entry = entryMap.get(id);
            if (!entry) return null;
            return { ...entry, order: index * 10 };
          })
          .filter((e): e is LorebookEntry => e !== null);

        // 添加不在排序列表中的条目（保持原 order）
        for (const entry of lorebook.entries) {
          if (!entryIds.includes(entry.id)) {
            reorderedEntries.push(entry);
          }
        }

        const updatedLorebook: Lorebook = {
          ...lorebook,
          entries: reorderedEntries,
          metadata: {
            ...lorebook.metadata,
            updatedAt: Date.now(),
          },
        };

        await lorebookStorage.saveLorebook(updatedLorebook);

        const index = lorebookStorage.getLorebookIndex();
        set((state) => {
          state.lorebooks = index;
          state.loadedLorebooks.set(lorebookId, updatedLorebook);
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "重排条目失败";
        set({ error: message });
        console.error("[LorebookStore] Reorder entries error:", error);
        throw error;
      }
    },

    // ===== 工具 =====

    clearError: () => {
      set({ error: null });
    },
  }))
);
