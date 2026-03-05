/**
 * Feature Flags Store（P0）
 */

import { settings } from "@/core/storage";
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

export const FEATURE_FLAG_STORAGE_KEYS = {
  USE_ENVELOPE_V2: "lyra.flags.useEnvelopeV2",
  USE_UNIFIED_POSTPROCESS: "lyra.flags.useUnifiedPostProcess",
} as const;

export interface FeatureFlagsState {
  /** Prompt v2 Envelope 构建路径开关 */
  USE_ENVELOPE_V2: boolean;
  /** Prompt v2 Phase 1 统一 PostProcess 路径开关 */
  USE_UNIFIED_POSTPROCESS: boolean;

  /** 设置单个 Flag 并立即持久化 */
  setUseEnvelopeV2: (enabled: boolean) => void;
  /** 设置统一 PostProcess 开关并立即持久化 */
  setUseUnifiedPostProcess: (enabled: boolean) => void;

  /** 从 localStorage 重新加载 */
  loadFeatureFlags: () => void;

  /** 将当前状态写回 localStorage */
  saveFeatureFlags: () => void;
}

export const useFeatureFlagStore = create<FeatureFlagsState>()(
  immer((set, get) => ({
    USE_ENVELOPE_V2: false,
    USE_UNIFIED_POSTPROCESS: false,

    setUseEnvelopeV2: (enabled) => {
      set((state) => {
        state.USE_ENVELOPE_V2 = enabled;
      });
      get().saveFeatureFlags();
    },

    setUseUnifiedPostProcess: (enabled) => {
      set((state) => {
        state.USE_UNIFIED_POSTPROCESS = enabled;
      });
      get().saveFeatureFlags();
    },

    loadFeatureFlags: () => {
      const useEnvelopeV2 = settings.get<boolean>(
        FEATURE_FLAG_STORAGE_KEYS.USE_ENVELOPE_V2,
        false,
      );
      const useUnifiedPostProcess = settings.get<boolean>(
        FEATURE_FLAG_STORAGE_KEYS.USE_UNIFIED_POSTPROCESS,
        false,
      );

      set((state) => {
        state.USE_ENVELOPE_V2 = useEnvelopeV2;
        state.USE_UNIFIED_POSTPROCESS = useUnifiedPostProcess;
      });
    },

    saveFeatureFlags: () => {
      const state = get();
      settings.set(
        FEATURE_FLAG_STORAGE_KEYS.USE_ENVELOPE_V2,
        state.USE_ENVELOPE_V2,
      );
      settings.set(
        FEATURE_FLAG_STORAGE_KEYS.USE_UNIFIED_POSTPROCESS,
        state.USE_UNIFIED_POSTPROCESS,
      );
    },
  })),
);
