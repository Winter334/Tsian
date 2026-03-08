/**
 * 作者态世界 Store
 *
 * 职责：
 * - 管理世界列表状态
 * - 管理当前活动世界
 * - 提供只读查询入口与基础 CRUD
 * - 初始化默认世界
 */

import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

import { defaultWorld } from "./presets/default";
import type { WorldIndex } from "./storage";
import { worldStorage } from "./storage";
import type { World, WorldId } from "./types";

function generateWorldId(prefix = "world"): WorldId {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

interface WorldStoreState {
  worlds: WorldIndex[];
  activeWorldId: WorldId | null;
  loadedWorlds: Map<WorldId, World>;
  initialized: boolean;
  loading: boolean;
  error: string | null;

  initialize(): Promise<void>;
  createWorld(name: string, description?: string): Promise<World>;
  updateWorld(
    id: WorldId,
    updates: Partial<Pick<World, "meta" | "rules" | "narrative">>,
  ): Promise<void>;
  deleteWorld(id: WorldId): Promise<void>;
  setActiveWorld(id: WorldId): void;
  getWorld(id: WorldId): Promise<World | null>;
  getActiveWorld(): Promise<World | null>;
  clearError(): void;
}

export const useWorldStore = create<WorldStoreState>()(
  immer((set, get) => ({
    worlds: [],
    activeWorldId: null,
    loadedWorlds: new Map(),
    initialized: false,
    loading: false,
    error: null,

    initialize: async () => {
      if (get().initialized) return;

      set({ loading: true, error: null });

      try {
        await worldStorage.init();

        let index = worldStorage.getWorldIndex();
        if (index.length === 0) {
          await worldStorage.saveWorld(defaultWorld);
          worldStorage.setActiveWorldId(defaultWorld.id);
          index = worldStorage.getWorldIndex();
        }

        let activeWorldId = worldStorage.getActiveWorldId();
        const hasActiveWorld =
          !!activeWorldId && index.some((item) => item.id === activeWorldId);

        if (!hasActiveWorld) {
          activeWorldId = index[0]?.id ?? null;
          worldStorage.setActiveWorldId(activeWorldId);
        }

        set({
          worlds: index,
          activeWorldId,
          initialized: true,
          loading: false,
        });
      } catch (error) {
        set({
          error: error instanceof Error ? error.message : "初始化世界系统失败",
          loading: false,
        });
        console.error("[WorldStore] Initialize error:", error);
      }
    },

    createWorld: async (name, description) => {
      try {
        const now = Date.now();
        const world: World = {
          id: generateWorldId(),
          meta: {
            name,
            description,
            version: "1.0.0",
            createdAt: now,
            updatedAt: now,
            source: "custom",
          },
          rules: {
            ...defaultWorld.rules,
            worldId: undefined,
            worldName: name,
          },
          narrative: {},
        };

        await worldStorage.saveWorld(world);

        const index = worldStorage.getWorldIndex();
        set((state) => {
          state.worlds = index;
          state.loadedWorlds.set(world.id, world);
        });

        return world;
      } catch (error) {
        const message = error instanceof Error ? error.message : "创建世界失败";
        set({ error: message });
        console.error("[WorldStore] Create error:", error);
        throw error;
      }
    },

    updateWorld: async (id, updates) => {
      try {
        const current = await get().getWorld(id);
        if (!current) {
          throw new Error(`世界 ${id} 不存在`);
        }

        const nextMeta = updates.meta
          ? {
              ...current.meta,
              ...updates.meta,
              updatedAt: Date.now(),
            }
          : {
              ...current.meta,
              updatedAt: Date.now(),
            };

        const nextWorld: World = {
          ...current,
          meta: nextMeta,
          rules: updates.rules ?? current.rules,
          narrative: updates.narrative ?? current.narrative,
        };

        await worldStorage.saveWorld(nextWorld);

        const index = worldStorage.getWorldIndex();
        set((state) => {
          state.worlds = index;
          state.loadedWorlds.set(id, nextWorld);
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "更新世界失败";
        set({ error: message });
        console.error("[WorldStore] Update error:", error);
        throw error;
      }
    },

    deleteWorld: async (id) => {
      try {
        await worldStorage.deleteWorld(id);

        const index = worldStorage.getWorldIndex();
        let nextActiveWorldId = get().activeWorldId;
        if (nextActiveWorldId === id) {
          nextActiveWorldId = index[0]?.id ?? null;
          worldStorage.setActiveWorldId(nextActiveWorldId);
        }

        set((state) => {
          state.worlds = index;
          state.activeWorldId = nextActiveWorldId;
          state.loadedWorlds.delete(id);
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "删除世界失败";
        set({ error: message });
        console.error("[WorldStore] Delete error:", error);
        throw error;
      }
    },

    setActiveWorld: (id) => {
      worldStorage.setActiveWorldId(id);
      set({ activeWorldId: id });
    },

    getWorld: async (id) => {
      const cached = get().loadedWorlds.get(id);
      if (cached) return cached;

      const world = await worldStorage.loadWorld(id);
      if (world) {
        set((state) => {
          state.loadedWorlds.set(id, world);
        });
      }
      return world;
    },

    getActiveWorld: async () => {
      const { activeWorldId } = get();
      if (!activeWorldId) return null;
      return get().getWorld(activeWorldId);
    },

    clearError: () => {
      set({ error: null });
    },
  })),
);
