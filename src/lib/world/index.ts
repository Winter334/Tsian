/**
 * 世界配置模块导出
 */

export {
  getRuntimeWorldConfig,
  resolveWorldConfig,
  worldConfigFromYMap,
  worldConfigToYMap,
} from "./resolve-config";
export { getDefaultResourceField, getResourcePairs } from "./resource-utils";
export { DEFAULT_WORLD_CONFIG, resolveDimensionSelections } from "./types";
export type {
  CheckRuleConfig,
  ConditionConfig,
  DerivedStatConfig,
  EquipSlotDefinition,
  InventoryRulesConfig,
  PrimaryAttributeConfig,
  TalentConfig,
  WorldConfig,
} from "./types";
