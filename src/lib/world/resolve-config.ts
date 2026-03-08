/**
 * 世界配置解析工具
 *
 * - resolveWorldRules：作者态世界 → 运行时规则快照（创作阶段）
 * - getRuntimeWorldConfig：运行阶段（从存档快照读取）
 */

import * as Y from "yjs";

import { yjsManager } from "@/core/yjs";

import { useWorldStore } from "./store";
import {
  DEFAULT_WORLD_CONFIG,
  type World,
  type WorldConfig,
  type WorldNarrativeRuntimeSnapshot,
  type WorldNarrativeSeed,
} from "./types";
import { worldConfigFromYMap } from "./world-config-codec";
import {
  getDefaultWorldNarrativeRuntimeSnapshot,
  normalizeWorldNarrativeRuntimeSnapshot,
  worldNarrativeFromYMap,
} from "./world-narrative-codec";

export { worldConfigFromYMap, worldConfigToYMap } from "./world-config-codec";
export {
  getDefaultWorldNarrativeRuntimeSnapshot,
  normalizeWorldNarrativeRuntimeSnapshot,
  worldNarrativeFromYMap,
  worldNarrativeToYMap,
} from "./world-narrative-codec";

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
 * 获取运行时 narrative 快照。
 *
 * 优先级：
 * 1. 当前存档中的 worldNarrative 快照
 * 2. 默认 narrative 快照（兜底）
 */
export function getRuntimeWorldNarrative(): WorldNarrativeRuntimeSnapshot {
  const save = yjsManager.getCurrentSave();
  if (!save) {
    return getDefaultWorldNarrativeRuntimeSnapshot();
  }

  const narrativeValue = save.get("worldNarrative");
  if (!(narrativeValue instanceof Y.Map)) {
    return getDefaultWorldNarrativeRuntimeSnapshot();
  }

  const decoded = worldNarrativeFromYMap(narrativeValue);
  return decoded ?? getDefaultWorldNarrativeRuntimeSnapshot();
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

export function resolveWorldNarrative(
  world?: World | null,
): WorldNarrativeRuntimeSnapshot {
  const narrative = world?.narrative;
  return resolveWorldNarrativeFromSeed(narrative);
}

export function resolveWorldNarrativeFromSeed(
  narrative?: WorldNarrativeSeed | null,
): WorldNarrativeRuntimeSnapshot {
  return normalizeWorldNarrativeRuntimeSnapshot({
    script: narrative?.script,
    opening: narrative?.opening,
    openingInjected: false,
  });
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

export async function resolveSelectedWorldNarrative(
  worldId: string,
): Promise<WorldNarrativeRuntimeSnapshot> {
  const world = await useWorldStore.getState().getWorld(worldId);
  if (!world) {
    throw new Error(`世界 ${worldId} 不存在`);
  }

  return resolveWorldNarrative(world);
}
