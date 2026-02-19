/**
 * 预设管理 Store
 *
 * 职责：
 * - 管理预设列表状态
 * - 管理按用途激活的预设
 * - 提供 UI 操作接口
 */

import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { defaultPreset } from "./presets/default";
import { defaultParserPreset } from "./presets/default-parser";
import { defaultSummarizerPreset } from "./presets/default-summarizer";
import type { PresetIndex } from "./storage";
import { presetStorage } from "./storage";
import type { Preset, PresetPurpose } from "./types";

// ===== 类型定义 =====

type ActivePresetByPurpose = Record<PresetPurpose, string | null>;

const DEFAULT_ACTIVE_PRESET_BY_PURPOSE: ActivePresetByPurpose = {
  narrative: null,
  parser: null,
  summarizer: null,
};

/**
 * 预设 Store 状态
 */
interface PresetStoreState {
  // ===== 状态 =====

  /** 预设索引列表 */
  presets: PresetIndex[];

  /** 按用途激活的预设 ID */
  activePresetByPurpose: ActivePresetByPurpose;

  /** 当前激活叙事预设 ID（兼容字段） */
  activePresetId: string | null;

  /** 当前激活叙事预设（完整数据） */
  activePreset: Preset | null;

  /** 加载中 */
  loading: boolean;

  /** 错误信息 */
  error: string | null;

  // ===== 操作 =====

  /**
   * 加载预设列表
   * - 初始化存储
   * - 加载索引
   * - 自动创建默认预设（如果不存在）
   * - 加载激活预设
   */
  loadPresets: () => Promise<void>;

  /**
   * 加载激活预设
   * - 从 localStorage 获取按用途激活预设
   * - 加载完整预设数据
   * - 如果没有激活叙事预设，自动选择第一个 narrative
   */
  loadActivePreset: () => Promise<void>;

  /**
   * 设置激活叙事预设（兼容旧调用）
   */
  setActivePreset: (id: string) => Promise<void>;

  /**
   * 设置某个用途的激活预设
   */
  setActivePresetForPurpose: (
    purpose: PresetPurpose,
    id: string | null,
  ) => Promise<void>;

  /**
   * 按用途获取激活预设
   * - parser 未激活时可回退到 narrative
   * - summarizer 未激活时返回 null
   */
  getPresetForPurpose: (purpose: PresetPurpose) => Promise<Preset | null>;

  /**
   * 创建新预设
   * @returns 新预设 ID
   */
  createPreset: (preset: Omit<Preset, "id" | "metadata">) => Promise<string>;

  /**
   * 更新预设
   */
  updatePreset: (id: string, updates: Partial<Preset>) => Promise<void>;

  /**
   * 删除预设
   */
  deletePreset: (id: string) => Promise<void>;

  /**
   * 复制预设
   * @returns 新预设 ID
   */
  duplicatePreset: (id: string) => Promise<string>;

  /**
   * 清除错误状态
   */
  clearError: () => void;
}

// ===== Store 实现 =====

/**
 * 预设管理 Store
 */
export const usePresetStore = create<PresetStoreState>()(
  immer((set, get) => ({
    // ===== 初始状态 =====

    presets: [],
    activePresetByPurpose: { ...DEFAULT_ACTIVE_PRESET_BY_PURPOSE },
    activePresetId: null,
    activePreset: null,
    loading: false,
    error: null,

    // ===== 操作实现 =====

    /**
     * 加载预设列表
     */
    loadPresets: async () => {
      set({ loading: true, error: null });

      try {
        // 1. 初始化存储
        await presetStorage.init();

        // 2. 加载索引
        let index = presetStorage.getPresetIndex();

        // 3. 确保至少存在一个 narrative/parser/summarizer 预设
        const hasNarrativePreset = index.some(
          (item) => item.purpose === "narrative",
        );
        const hasParserPreset = index.some((item) => item.purpose === "parser");
        const hasSummarizerPreset = index.some(
          (item) => item.purpose === "summarizer",
        );

        if (!hasNarrativePreset) {
          await presetStorage.savePreset(defaultPreset);
          index = presetStorage.getPresetIndex();
        }

        if (!hasParserPreset) {
          await presetStorage.savePreset(defaultParserPreset);
          index = presetStorage.getPresetIndex();
        }

        if (!hasSummarizerPreset) {
          await presetStorage.savePreset(defaultSummarizerPreset);
          index = presetStorage.getPresetIndex();
        }

        set({ presets: index, loading: false });

        // 4. 加载激活预设
        await get().loadActivePreset();
      } catch (error) {
        set({
          error: error instanceof Error ? error.message : "加载预设失败",
          loading: false,
        });
        console.error("[PresetStore] Load presets error:", error);
      }
    },

    /**
     * 加载激活预设
     */
    loadActivePreset: async () => {
      const index = get().presets;
      const persisted = presetStorage.getActivePresetByPurpose();
      const nextActiveByPurpose: ActivePresetByPurpose = {
        ...DEFAULT_ACTIVE_PRESET_BY_PURPOSE,
        ...persisted,
      };

      const loadPreset = async (id: string | null): Promise<Preset | null> => {
        if (!id) return null;
        const preset = await presetStorage.loadPreset(id);
        return preset;
      };

      // 1) 处理 narrative 激活
      let narrativePreset = await loadPreset(nextActiveByPurpose.narrative);
      if (!narrativePreset) {
        nextActiveByPurpose.narrative =
          index.find((item) => item.purpose === "narrative")?.id ??
          index[0]?.id ??
          null;
        narrativePreset = await loadPreset(nextActiveByPurpose.narrative);
      }

      // 2) 处理 parser 激活（允许为空）
      let parserPreset = await loadPreset(nextActiveByPurpose.parser);
      if (!parserPreset) {
        nextActiveByPurpose.parser =
          index.find((item) => item.purpose === "parser")?.id ?? null;
        parserPreset = await loadPreset(nextActiveByPurpose.parser);
      }

      // 3) 处理 summarizer 激活（允许为空）
      let summarizerPreset = await loadPreset(nextActiveByPurpose.summarizer);
      if (!summarizerPreset) {
        nextActiveByPurpose.summarizer =
          index.find((item) => item.purpose === "summarizer")?.id ?? null;
        summarizerPreset = await loadPreset(nextActiveByPurpose.summarizer);
      }

      // 4) 持久化归一化结果
      presetStorage.setActivePresetByPurpose(nextActiveByPurpose);

      if (!narrativePreset) {
        set({
          error: "未找到可用叙事预设",
          activePreset: null,
          activePresetId: null,
          activePresetByPurpose: nextActiveByPurpose,
        });
        return;
      }

      set({
        activePreset: narrativePreset,
        activePresetId: nextActiveByPurpose.narrative,
        activePresetByPurpose: nextActiveByPurpose,
        error: null,
      });
    },

    /**
     * 设置激活叙事预设（兼容旧调用）
     */
    setActivePreset: async (id: string) => {
      await get().setActivePresetForPurpose("narrative", id);
    },

    /**
     * 设置某个用途激活预设
     */
    setActivePresetForPurpose: async (
      purpose: PresetPurpose,
      id: string | null,
    ) => {
      try {
        let preset: Preset | null = null;

        if (id) {
          const loaded = await presetStorage.loadPreset(id);
          if (!loaded) {
            throw new Error(`预设 ${id} 不存在`);
          }
          preset = loaded;

          const presetPurpose = loaded.purpose ?? "narrative";
          if (presetPurpose !== purpose) {
            throw new Error(
              `预设 ${id} 的用途是 ${presetPurpose}，不能设为 ${purpose} 激活预设`,
            );
          }
        }

        const nextActiveByPurpose: ActivePresetByPurpose = {
          ...get().activePresetByPurpose,
          [purpose]: id,
        };

        presetStorage.setActivePresetForPurpose(purpose, id);

        if (purpose === "narrative") {
          set({
            activePreset: preset,
            activePresetId: id,
            activePresetByPurpose: nextActiveByPurpose,
            error: null,
          });
        } else {
          set({
            activePresetByPurpose: nextActiveByPurpose,
            error: null,
          });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "切换预设失败";
        set({ error: message });
        console.error(
          "[PresetStore] Set active preset for purpose error:",
          error,
        );
        throw error;
      }
    },

    /**
     * 按用途获取激活预设
     */
    getPresetForPurpose: async (purpose: PresetPurpose) => {
      const activeId = get().activePresetByPurpose[purpose];

      if (activeId) {
        const loaded = await presetStorage.loadPreset(activeId);
        if (loaded) {
          return loaded;
        }
      }

      if (purpose === "parser") {
        return get().getPresetForPurpose("narrative");
      }

      return null;
    },

    /**
     * 创建新预设
     */
    createPreset: async (presetData) => {
      try {
        const newPreset: Preset = {
          ...presetData,
          purpose: presetData.purpose ?? "narrative",
          id: `preset-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          metadata: {
            version: "1.3.0",
            source: "lyra",
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
        };

        await presetStorage.savePreset(newPreset);

        // 更新索引列表
        const index = presetStorage.getPresetIndex();
        set({ presets: index });

        return newPreset.id;
      } catch (error) {
        const message = error instanceof Error ? error.message : "创建预设失败";
        set({ error: message });
        console.error("[PresetStore] Create preset error:", error);
        throw error;
      }
    },

    /**
     * 更新预设
     */
    updatePreset: async (id: string, updates: Partial<Preset>) => {
      try {
        // 1. 加载现有预设
        const existingPreset = await presetStorage.loadPreset(id);
        if (!existingPreset) {
          throw new Error(`预设 ${id} 不存在`);
        }

        // 2. 合并更新
        const updatedPreset: Preset = {
          ...existingPreset,
          ...updates,
          id, // 确保 ID 不变
          metadata: {
            ...existingPreset.metadata,
            ...(updates.metadata || {}),
            updatedAt: Date.now(),
          },
        };

        // 3. 保存
        await presetStorage.savePreset(updatedPreset);

        // 4. 更新索引列表
        const index = presetStorage.getPresetIndex();
        const current = get();
        const nextActiveByPurpose = { ...current.activePresetByPurpose };

        // 若当前激活 narrative 改成了非 narrative，则回退到其他 narrative
        const updatedPurpose = updatedPreset.purpose ?? "narrative";
        if (
          nextActiveByPurpose.narrative === id &&
          updatedPurpose !== "narrative"
        ) {
          nextActiveByPurpose.narrative =
            index.find((item) => item.purpose === "narrative" && item.id !== id)
              ?.id ?? null;
        }

        // 若当前激活 parser 改成了非 parser，则清空/回退 parser 激活
        if (nextActiveByPurpose.parser === id && updatedPurpose !== "parser") {
          nextActiveByPurpose.parser =
            index.find((item) => item.purpose === "parser" && item.id !== id)
              ?.id ?? null;
        }

        // 若当前激活 summarizer 改成了非 summarizer，则清空/回退 summarizer 激活
        if (
          nextActiveByPurpose.summarizer === id &&
          updatedPurpose !== "summarizer"
        ) {
          nextActiveByPurpose.summarizer =
            index.find(
              (item) => item.purpose === "summarizer" && item.id !== id,
            )?.id ?? null;
        }

        let nextActivePreset = current.activePreset;
        let nextActivePresetId = current.activePresetId;

        if (nextActiveByPurpose.narrative === id) {
          nextActivePreset = updatedPreset;
          nextActivePresetId = id;
        } else if (current.activePresetId === id) {
          nextActivePresetId = nextActiveByPurpose.narrative;
          nextActivePreset = nextActivePresetId
            ? await presetStorage.loadPreset(nextActivePresetId)
            : null;
        }

        presetStorage.setActivePresetByPurpose(nextActiveByPurpose);

        set({
          presets: index,
          activePresetByPurpose: nextActiveByPurpose,
          activePreset: nextActivePreset,
          activePresetId: nextActivePresetId,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "更新预设失败";
        set({ error: message });
        console.error("[PresetStore] Update preset error:", error);
        throw error;
      }
    },

    /**
     * 删除预设
     */
    deletePreset: async (id: string) => {
      try {
        // 1. 删除预设
        await presetStorage.deletePreset(id);

        // 2. 更新索引列表
        const index = presetStorage.getPresetIndex();

        // 3. 重算激活状态
        const current = get();
        const nextActiveByPurpose: ActivePresetByPurpose = {
          ...current.activePresetByPurpose,
        };

        if (nextActiveByPurpose.narrative === id) {
          nextActiveByPurpose.narrative =
            index.find((item) => item.purpose === "narrative")?.id ??
            index[0]?.id ??
            null;
        }

        if (nextActiveByPurpose.parser === id) {
          nextActiveByPurpose.parser =
            index.find((item) => item.purpose === "parser")?.id ?? null;
        }

        if (nextActiveByPurpose.summarizer === id) {
          nextActiveByPurpose.summarizer =
            index.find((item) => item.purpose === "summarizer")?.id ?? null;
        }

        presetStorage.setActivePresetByPurpose(nextActiveByPurpose);

        // 4. 刷新当前激活 narrative 预设
        let nextActivePreset: Preset | null = null;
        if (nextActiveByPurpose.narrative) {
          nextActivePreset = await presetStorage.loadPreset(
            nextActiveByPurpose.narrative,
          );
        }

        if (index.length > 0 && !nextActivePreset) {
          // 兜底到第一个
          const fallbackId = index[0].id;
          nextActiveByPurpose.narrative = fallbackId;
          presetStorage.setActivePresetByPurpose(nextActiveByPurpose);
          nextActivePreset = await presetStorage.loadPreset(fallbackId);
        }

        if (!nextActivePreset) {
          set({
            presets: index,
            activePreset: null,
            activePresetId: null,
            activePresetByPurpose: nextActiveByPurpose,
            error: "所有预设已删除，请创建新预设",
          });
          return;
        }

        set({
          presets: index,
          activePreset: nextActivePreset,
          activePresetId: nextActiveByPurpose.narrative,
          activePresetByPurpose: nextActiveByPurpose,
          error: null,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "删除预设失败";
        set({ error: message });
        console.error("[PresetStore] Delete preset error:", error);
        throw error;
      }
    },

    /**
     * 复制预设
     */
    duplicatePreset: async (id: string) => {
      try {
        // 1. 加载原预设
        const originalPreset = await presetStorage.loadPreset(id);
        if (!originalPreset) {
          throw new Error(`预设 ${id} 不存在`);
        }

        // 2. 创建副本
        const duplicatedPreset: Preset = {
          ...originalPreset,
          id: `preset-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: `${originalPreset.name} (副本)`,
          metadata: {
            ...originalPreset.metadata,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
        };

        // 3. 保存副本
        await presetStorage.savePreset(duplicatedPreset);

        // 4. 更新索引列表
        const index = presetStorage.getPresetIndex();
        set({ presets: index });

        return duplicatedPreset.id;
      } catch (error) {
        const message = error instanceof Error ? error.message : "复制预设失败";
        set({ error: message });
        console.error("[PresetStore] Duplicate preset error:", error);
        throw error;
      }
    },

    /**
     * 清除错误状态
     */
    clearError: () => {
      set({ error: null });
    },
  })),
);
