/**
 * 世界配置解析工具
 *
 * 合并预设中的 worldConfig 覆盖与默认配置
 */

import type { Preset } from "@/lib/prompt/types";

import type { WorldConfig } from "./types";
import { DEFAULT_WORLD_CONFIG } from "./types";

/**
 * 合并预设中的世界配置与默认配置
 *
 * 策略：预设值浅覆盖默认值
 * - 如果预设未设置 worldConfig，返回 DEFAULT_WORLD_CONFIG
 * - 如果预设设置了部分字段，浅覆盖对应字段
 *
 * @param preset 活动预设（可选）
 * @returns 合并后的完整 WorldConfig
 */
export function resolveWorldConfig(preset?: Preset | null): WorldConfig {
  if (!preset?.worldConfig) return DEFAULT_WORLD_CONFIG;
  return {
    ...DEFAULT_WORLD_CONFIG,
    ...preset.worldConfig,
  };
}
