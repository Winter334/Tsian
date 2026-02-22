/**
 * 世界配置解析工具
 *
 * - resolveWorldConfig：创作阶段（GameWizard / 预设预览）
 * - getRuntimeWorldConfig：运行阶段（从存档快照读取）
 */

import * as Y from "yjs";

import { yjsManager } from "@/core/yjs";
import type { Preset } from "@/lib/prompt/types";

import type { WorldConfig } from "./types";
import { DEFAULT_WORLD_CONFIG } from "./types";
import { worldConfigFromYMap } from "./world-config-codec";

export { worldConfigFromYMap, worldConfigToYMap } from "./world-config-codec";

/**
 * 获取运行时 WorldConfig。
 *
 * 优先级：
 * 1. 当前存档中的 worldConfig 快照
 * 2. DEFAULT_WORLD_CONFIG（兜底）
 */
export function getRuntimeWorldConfig(): WorldConfig {
  const save = yjsManager.getCurrentSave();
  if (!save) return DEFAULT_WORLD_CONFIG;

  const worldConfigValue = save.get("worldConfig");
  if (!(worldConfigValue instanceof Y.Map)) return DEFAULT_WORLD_CONFIG;

  const decoded = worldConfigFromYMap(worldConfigValue);
  return decoded ?? DEFAULT_WORLD_CONFIG;
}

/**
 * 从预设解析 WorldConfig（仅限创作阶段）。
 *
 * 仅用于：
 * - GameWizard 创建新游戏时（存档尚未创建）
 * - 预设编辑器预览
 *
 * 运行时业务逻辑应使用 getRuntimeWorldConfig()，避免受 activePreset 切换影响。
 */
export function resolveWorldConfig(preset?: Preset | null): WorldConfig {
  if (!preset?.worldConfig) return DEFAULT_WORLD_CONFIG;
  return {
    ...DEFAULT_WORLD_CONFIG,
    ...preset.worldConfig,
  };
}
