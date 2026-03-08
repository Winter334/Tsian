/**
 * 世界配置解析工具
 *
 * - resolveWorldRules：作者态世界 → 运行时规则快照（创作阶段）
 * - getRuntimeWorldConfig：运行阶段（从存档快照读取）
 */

import * as Y from "yjs";

import { yjsManager } from "@/core/yjs";

import { useWorldStore } from "./store";
import { DEFAULT_WORLD_CONFIG, type World, type WorldConfig } from "./types";
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
 * 从作者态世界解析运行时规则快照（仅限创作/建档阶段）。
 *
 * 运行时业务逻辑仍应使用 getRuntimeWorldConfig()，
 * 避免受活动世界切换影响。
 */
export function resolveWorldRules(world?: World | null): WorldConfig {
  if (!world) return DEFAULT_WORLD_CONFIG;

  return {
    ...DEFAULT_WORLD_CONFIG,
    ...world.rules,
    worldId: world.id,
    worldName: world.meta.name,
  };
}

/**
 * 按 ID 读取作者态世界，并解析为运行时规则快照。
 *
 * 用于建档 / 建房等需要显式 world 选择的入口。
 */
export async function resolveSelectedWorldRules(
  worldId: string,
): Promise<WorldConfig> {
  const world = await useWorldStore.getState().getWorld(worldId);
  if (!world) {
    throw new Error(`世界 ${worldId} 不存在`);
  }

  return resolveWorldRules(world);
}
