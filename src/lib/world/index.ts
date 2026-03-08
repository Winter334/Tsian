/**
 * 世界配置模块导出
 */

export { defaultWorld, defaultWorldConfig } from "./presets/default";
export {
  getDefaultWorldNarrativeRuntimeSnapshot,
  getRuntimeWorldConfig,
  getRuntimeWorldNarrative,
  normalizeWorldNarrativeRuntimeSnapshot,
  resolveSelectedWorldNarrative,
  resolveSelectedWorldRules,
  resolveWorldNarrative,
  resolveWorldNarrativeFromSeed,
  resolveWorldRules,
  worldConfigFromYMap,
  worldConfigToYMap,
  worldNarrativeFromYMap,
  worldNarrativeToYMap,
} from "./resolve-config";
export { getDefaultResourceField, getResourcePairs } from "./resource-utils";
export { worldStorage } from "./storage";
export type { WorldIndex, WorldStorage } from "./storage";
export { useWorldStore } from "./store";
export {
  DEFAULT_WORLD_CONFIG,
  DEFAULT_WORLD_NARRATIVE_RUNTIME_SNAPSHOT,
  resolveDimensionSelections,
} from "./types";
export type {
  CheckRuleConfig,
  ConditionConfig,
  DerivedStatConfig,
  EquipSlotDefinition,
  InventoryRulesConfig,
  PrimaryAttributeConfig,
  TalentConfig,
  World,
  WorldConfig,
  WorldId,
  WorldMeta,
  WorldNarrativeRuntimeSnapshot,
  WorldNarrativeSeed,
} from "./types";
