/**
 * 世界配置模块导出
 */

export { defaultWorld, defaultWorldConfig } from "./presets/default";
export {
  getRuntimeWorldConfig,
  resolveSelectedWorldRules,
  resolveWorldRules,
  worldConfigFromYMap,
  worldConfigToYMap,
} from "./resolve-config";
export { getDefaultResourceField, getResourcePairs } from "./resource-utils";
export { worldStorage } from "./storage";
export type { WorldIndex, WorldStorage } from "./storage";
export { useWorldStore } from "./store";
export { DEFAULT_WORLD_CONFIG, resolveDimensionSelections } from "./types";
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
  WorldNarrativeSeed,
} from "./types";
