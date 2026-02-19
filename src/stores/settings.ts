/**
 * 全局设置 Store
 */

import { settings } from "@/core/storage";
import type {
  AIConfig,
  AIProfile,
  AdvancedSettings,
  ExportedAIProfile,
  ProviderType,
} from "@/lib/ai";
import { DEFAULT_ADVANCED_SETTINGS } from "@/lib/ai";
import { applyThemeToDOM, defaultThemeId } from "@/styles/themes";
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

/**
 * 设置状态
 */
interface SettingsState {
  // === 主题 ===
  themeId: string;
  setThemeId: (themeId: string) => void;

  // === AI Profile 管理（新增） ===
  profiles: AIProfile[];

  /** 根据 ID 获取 Profile，若未找到则兜底使用第一个 Profile */
  getProfileOrFallback: (id?: string) => AIProfile;
  getProfileById: (id: string) => AIProfile | undefined;
  createProfile: (
    profile: Omit<AIProfile, "id" | "createdAt" | "updatedAt">,
  ) => string;
  updateProfile: (id: string, updates: Partial<Omit<AIProfile, "id">>) => void;
  deleteProfile: (id: string) => boolean;
  duplicateProfile: (id: string) => string;
  importProfile: (exported: ExportedAIProfile) => string;

  // === 向后兼容 API（桥接到第一个 Profile） ===
  /** @deprecated 使用 getProfileOrFallback() 替代。返回首个 Profile 对应的 AIConfig */
  aiConfig: AIConfig;
  /** @deprecated 使用 updateProfile() 替代 */
  setAIConfig: (config: Partial<AIConfig>) => void;
  /** @deprecated 使用 updateProfile() 替代 */
  setAdvancedSettings: (settings: Partial<AdvancedSettings>) => void;

  // === 首次引导 ===
  hasCompletedOnboarding: boolean;
  setOnboardingComplete: (complete: boolean) => void;

  // === 持久化 ===
  loadSettings: () => void;
  saveSettings: () => void;
}

/**
 * 默认 AI 配置
 */
const defaultAIConfig: AIConfig = {
  provider: "openai",
  baseUrl: "https://api.openai.com",
  apiKey: "",
  model: "gpt-4o-mini",
  advanced: { ...DEFAULT_ADVANCED_SETTINGS },
};

function profileToAIConfig(profile: AIProfile): AIConfig {
  return {
    provider: profile.provider,
    baseUrl: profile.baseUrl,
    apiKey: profile.apiKey,
    model: profile.model,
    advanced: {
      ...DEFAULT_ADVANCED_SETTINGS,
      ...profile.advanced,
    },
  };
}

function createProfileFromConfig(
  config: AIConfig,
  name = "默认配置",
): AIProfile {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    name,
    provider: config.provider,
    baseUrl: config.baseUrl,
    apiKey: config.apiKey,
    model: config.model,
    advanced: {
      ...DEFAULT_ADVANCED_SETTINGS,
      ...config.advanced,
    },
    createdAt: now,
    updatedAt: now,
  };
}

function syncAiConfig(
  state: Pick<SettingsState, "profiles" | "aiConfig">,
): void {
  const primaryProfile = state.profiles[0];
  if (primaryProfile) {
    state.aiConfig = profileToAIConfig(primaryProfile);
  }
}

const initialProfile = createProfileFromConfig(defaultAIConfig);

/**
 * 设置 Store
 */
export const useSettingsStore = create<SettingsState>()(
  immer((set, get) => ({
    // === 主题 ===
    themeId: defaultThemeId,
    setThemeId: (themeId) => {
      set((state) => {
        state.themeId = themeId;
      });
      applyThemeToDOM(themeId);
      get().saveSettings();
    },

    // === AI Profile 管理 ===
    profiles: [initialProfile],

    getProfileOrFallback: (id) => {
      const state = get();
      if (id) {
        const found = state.profiles.find((profile) => profile.id === id);
        if (found) return found;
      }

      return state.profiles[0] ?? createProfileFromConfig(defaultAIConfig);
    },

    getProfileById: (id) => {
      const state = get();
      return state.profiles.find((profile) => profile.id === id);
    },

    createProfile: (profile) => {
      const id = crypto.randomUUID();
      const now = Date.now();

      set((state) => {
        state.profiles.push({
          ...profile,
          id,
          advanced: {
            ...DEFAULT_ADVANCED_SETTINGS,
            ...profile.advanced,
          },
          createdAt: now,
          updatedAt: now,
        });
      });

      get().saveSettings();
      return id;
    },

    updateProfile: (id, updates) => {
      let updated = false;

      set((state) => {
        const profile = state.profiles.find((item) => item.id === id);
        if (!profile) return;

        const { advanced, ...rest } = updates;
        Object.assign(profile, rest);

        if (advanced) {
          profile.advanced = {
            ...profile.advanced,
            ...advanced,
          };
        }

        profile.updatedAt = Date.now();
        if (state.profiles[0]?.id === id) {
          syncAiConfig(state);
        }
        updated = true;
      });

      if (updated) {
        get().saveSettings();
      }
    },

    deleteProfile: (id) => {
      let deleted = false;

      set((state) => {
        if (state.profiles.length <= 1) return;

        const targetIndex = state.profiles.findIndex(
          (profile) => profile.id === id,
        );
        if (targetIndex === -1) return;

        state.profiles.splice(targetIndex, 1);

        if (state.profiles.length === 0) return;

        syncAiConfig(state);
        deleted = true;
      });

      if (deleted) {
        get().saveSettings();
      }

      return deleted;
    },

    duplicateProfile: (id) => {
      let duplicatedId = "";

      set((state) => {
        const source = state.profiles.find((profile) => profile.id === id);
        if (!source) return;

        const now = Date.now();
        duplicatedId = crypto.randomUUID();

        state.profiles.push({
          ...source,
          id: duplicatedId,
          name: `${source.name} (副本)`,
          advanced: {
            ...DEFAULT_ADVANCED_SETTINGS,
            ...source.advanced,
          },
          createdAt: now,
          updatedAt: now,
        });
      });

      if (duplicatedId) {
        get().saveSettings();
      }

      return duplicatedId;
    },

    importProfile: (exported) => {
      const id = crypto.randomUUID();
      const now = Date.now();

      set((state) => {
        state.profiles.push({
          id,
          name: exported.name,
          provider: "openai",
          baseUrl: "",
          apiKey: "",
          model: "",
          advanced: {
            ...DEFAULT_ADVANCED_SETTINGS,
            ...exported.advanced,
          },
          createdAt: now,
          updatedAt: now,
        });
      });

      get().saveSettings();
      return id;
    },

    // === 向后兼容 API（桥接到第一个 Profile）===
    aiConfig: profileToAIConfig(initialProfile),

    setAIConfig: (config) => {
      let updated = false;

      set((state) => {
        const primaryProfile = state.profiles[0];
        if (!primaryProfile) return;

        if (config.provider !== undefined)
          primaryProfile.provider = config.provider;
        if (config.baseUrl !== undefined)
          primaryProfile.baseUrl = config.baseUrl;
        if (config.apiKey !== undefined) primaryProfile.apiKey = config.apiKey;
        if (config.model !== undefined) primaryProfile.model = config.model;
        if (config.advanced) {
          primaryProfile.advanced = {
            ...primaryProfile.advanced,
            ...config.advanced,
          };
        }

        primaryProfile.updatedAt = Date.now();
        syncAiConfig(state);
        updated = true;
      });

      if (updated) {
        get().saveSettings();
      }
    },

    setAdvancedSettings: (advancedSettings) => {
      let updated = false;

      set((state) => {
        const primaryProfile = state.profiles[0];
        if (!primaryProfile) return;

        primaryProfile.advanced = {
          ...primaryProfile.advanced,
          ...advancedSettings,
        };
        primaryProfile.updatedAt = Date.now();
        syncAiConfig(state);
        updated = true;
      });

      if (updated) {
        get().saveSettings();
      }
    },

    // === 首次引导 ===
    hasCompletedOnboarding: false,
    setOnboardingComplete: (complete) => {
      set((state) => {
        state.hasCompletedOnboarding = complete;
      });
      get().saveSettings();
    },

    // === 持久化 ===
    loadSettings: () => {
      const themeId = settings.get<string>("lyra.themeId", defaultThemeId);
      const hasCompletedOnboarding = settings.get<boolean>(
        "lyra.onboarding",
        false,
      );

      const savedProfiles = settings.get<AIProfile[] | null>(
        "lyra.profiles",
        null,
      );
      let profiles: AIProfile[] = [];

      if (savedProfiles && savedProfiles.length > 0) {
        profiles = savedProfiles.map((profile) => ({
          ...profile,
          advanced: {
            ...DEFAULT_ADVANCED_SETTINGS,
            ...profile.advanced,
          },
        }));
      } else {
        const legacyConfig = settings.get<AIConfig>(
          "lyra.aiConfig",
          defaultAIConfig,
        );
        const mergedLegacyConfig: AIConfig = {
          ...defaultAIConfig,
          ...legacyConfig,
          advanced: {
            ...DEFAULT_ADVANCED_SETTINGS,
            ...legacyConfig.advanced,
          },
        };

        const migratedProfile = createProfileFromConfig(
          mergedLegacyConfig,
          "默认配置",
        );
        profiles = [migratedProfile];
      }

      if (profiles.length === 0) {
        profiles = [createProfileFromConfig(defaultAIConfig)];
      }

      set((state) => {
        state.themeId = themeId;
        state.profiles = profiles;
        syncAiConfig(state);
        state.hasCompletedOnboarding = hasCompletedOnboarding;
      });

      applyThemeToDOM(themeId);
    },

    saveSettings: () => {
      const state = get();
      settings.set("lyra.themeId", state.themeId);
      settings.set("lyra.profiles", state.profiles);
      settings.set("lyra.onboarding", state.hasCompletedOnboarding);
    },
  })),
);

// 导出类型
export type {
  AIConfig,
  AIProfile,
  AdvancedSettings,
  ExportedAIProfile,
  ProviderType,
};
