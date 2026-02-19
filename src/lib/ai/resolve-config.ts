import type { AIConfig, AIProfile, AdvancedSettings } from "./types";
import { DEFAULT_ADVANCED_SETTINGS } from "./types";

/**
 * 解析最终 AI 配置
 *
 * 将 AIProfile 与可选的预设参数覆盖合并，生成 Executor 可用的 AIConfig。
 *
 * 优先级：presetOverrides > profile.advanced > DEFAULT_ADVANCED_SETTINGS
 *
 * @param profile - AI Profile（连接信息 + 高级参数基线）
 * @param presetOverrides - 预设级别的参数覆盖（可选）
 * @returns 完整的 AIConfig
 */
export function resolveAIConfig(
  profile: AIProfile,
  presetOverrides?: Partial<AdvancedSettings>,
): AIConfig {
  return {
    provider: profile.provider,
    baseUrl: profile.baseUrl,
    apiKey: profile.apiKey,
    model: profile.model,
    advanced: {
      ...DEFAULT_ADVANCED_SETTINGS,
      ...profile.advanced,
      ...(presetOverrides ?? {}),
    },
  };
}
