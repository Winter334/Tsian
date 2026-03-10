/**
 * 世界工作台状态桥接 Hook
 *
 * 负责连接作者态世界 Store，并在 UI 层管理：
 * - 当前选中的世界 ID
 * - 草稿副本与脏标记
 * - 保存 / 重置 / 导入 / 导出
 * - 原始规则编辑开关与文本状态
 * - 移动端页面切换
 */

import { useCallback, useEffect, useMemo, useState } from "react";

import { topologicalSortDerivedStats } from "@/lib/rules/derived-stats";
import {
  evaluateExpression,
  type ExpressionPrimitive,
} from "@/lib/rules/expression";
import {
  DEFAULT_WORLD_CONFIG,
  defaultWorld,
  useWorldStore,
  type WorldIndex,
} from "@/lib/world";
import type {
  CharacterDimension,
  CheckRuleConfig,
  ConditionConfig,
  DerivedStatConfig,
  DimensionOption,
  PointBuyRules,
  PrimaryAttributeConfig,
  TalentConfig,
  World,
  WorldConfig,
  WorldId,
  WorldMeta,
  WorldNarrativeSeed,
} from "@/lib/world/types";

export type WorldWorkspaceMobilePage = "list" | "editor";
export type WorldRulesEditorScope =
  | "full"
  | "attributes"
  | "derivedStats"
  | "checkRules"
  | "conditions"
  | "dimensions"
  | "talents";
export type WorldScopedRulesEditorScope = Exclude<
  WorldRulesEditorScope,
  "full"
>;

type EditableWorldMeta = Pick<
  WorldMeta,
  "name" | "description" | "author" | "version" | "source"
>;

type EditableRulesAttributesSnapshot = Pick<
  WorldConfig,
  "primaryAttributes" | "pointBuyRules"
>;
type EditableRulesDerivedStatsSnapshot = Pick<WorldConfig, "derivedStats">;
type EditableRulesCheckRulesSnapshot = Pick<WorldConfig, "checkRules">;
type EditableRulesConditionsSnapshot = Pick<WorldConfig, "conditions">;
type EditableRulesDimensionsSnapshot = Pick<WorldConfig, "dimensions">;
type EditableRulesTalentsSnapshot = Pick<
  WorldConfig,
  "talents" | "talentRules"
>;
type EditableTalentRules = NonNullable<WorldConfig["talentRules"]>;

type EditableDCPresets = NonNullable<CheckRuleConfig["dcPresets"]>;
type EditableDCPreset = EditableDCPresets[string];
type EditableOpposedPresets = NonNullable<CheckRuleConfig["opposedPresets"]>;
type EditableOpposedPreset = EditableOpposedPresets[string];
type EditableDCGuidelineScaleItem = NonNullable<
  CheckRuleConfig["dcGuideline"]
>["scale"][number];

type EditableWorldSnapshot = {
  meta: EditableWorldMeta;
  rules: WorldConfig;
  narrative: WorldNarrativeSeed;
};

const EMPTY_RULES_JSON = JSON.stringify(DEFAULT_WORLD_CONFIG, null, 2);

export interface WorldWorkspaceState {
  worlds: WorldIndex[];
  activeWorldId: WorldId | null;
  selectedWorldId: WorldId | null;
  selectedWorld: World | null;
  draft: World | null;
  isDirty: boolean;
  isSaving: boolean;
  isLoadingWorld: boolean;
  rawRulesEditorOpen: boolean;
  rawRulesEditorScope: WorldRulesEditorScope;
  rawRulesText: string;
  rawRulesError: string | null;
  mobilePage: WorldWorkspaceMobilePage;
  validationMessages: string[];
}

export interface WorldWorkspaceActions {
  selectWorld: (id: WorldId) => void;
  setActiveWorld: (id: WorldId) => void;
  createWorld: (onCreated?: (world: World) => void) => void;
  deleteWorld: (id: WorldId) => void;
  confirmDeleteWorld: () => Promise<void>;
  cancelDeleteWorld: () => void;
  saveSelectedWorld: () => Promise<World | null>;
  resetDraft: () => void;
  setMobilePage: (page: WorldWorkspaceMobilePage) => void;
  openRawRulesEditor: (scope: WorldRulesEditorScope) => void;
  closeRawRulesEditor: () => void;
  setRawRulesText: (value: string) => void;
  applyRawRulesText: () => void;
  exportSelectedWorld: () => void;
  importWorldFromFile: (
    file: File,
    callbacks?: {
      onSuccess?: (world: World) => void;
      onError?: (err: Error) => void;
    },
  ) => void;
  updateMeta: (updates: Partial<EditableWorldMeta>) => void;
  updateNarrative: (updates: Partial<WorldNarrativeSeed>) => void;
  updatePrimaryAttribute: (
    index: number,
    updates: Partial<PrimaryAttributeConfig>,
  ) => void;
  addPrimaryAttribute: () => void;
  removePrimaryAttribute: (index: number) => void;
  updatePointBuyRules: (updates: Partial<PointBuyRules>) => void;
  updateCheckRules: (updates: Partial<CheckRuleConfig>) => void;
  addDcPreset: () => void;
  updateDcPreset: (
    presetKey: string,
    updates: Partial<EditableDCPreset>,
  ) => void;
  removeDcPreset: (presetKey: string) => void;
  addOpposedPreset: () => void;
  updateOpposedPreset: (
    presetKey: string,
    updates: Partial<EditableOpposedPreset>,
  ) => void;
  removeOpposedPreset: (presetKey: string) => void;
  addDCGuidelineItem: () => void;
  updateDCGuidelineItem: (
    index: number,
    updates: Partial<EditableDCGuidelineScaleItem>,
  ) => void;
  removeDCGuidelineItem: (index: number) => void;
  updateDerivedStat: (
    index: number,
    updates: Partial<DerivedStatConfig>,
  ) => void;
  addDerivedStat: () => void;
  removeDerivedStat: (index: number) => void;
  updateDimension: (
    index: number,
    updates: Partial<CharacterDimension>,
  ) => void;
  addDimension: () => void;
  removeDimension: (index: number) => void;
  updateDimensionOption: (
    dimensionIndex: number,
    optionIndex: number,
    updates: Partial<DimensionOption>,
  ) => void;
  addDimensionOption: (dimensionIndex: number) => void;
  removeDimensionOption: (dimensionIndex: number, optionIndex: number) => void;
  updateCondition: (index: number, updates: Partial<ConditionConfig>) => void;
  addCondition: () => void;
  removeCondition: (index: number) => void;
  updateTalentRules: (updates: Partial<EditableTalentRules>) => void;
  updateTalent: (index: number, updates: Partial<TalentConfig>) => void;
  addTalent: () => void;
  removeTalent: (index: number) => void;
  pendingDeleteWorld: { id: WorldId; name: string } | null;
  discardConfirm: {
    open: boolean;
    message: string;
  };
  handleConfirmDiscard: () => void;
  handleCancelDiscard: () => void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function toOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function toRequiredString(value: unknown, fallback: string): string {
  return toOptionalString(value) ?? fallback;
}

function toOptionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function toNumber(value: unknown, fallback: number): number {
  return toOptionalNumber(value) ?? fallback;
}

function toOptionalInteger(value: unknown): number | undefined {
  const nextValue = toOptionalNumber(value);
  return nextValue === undefined ? undefined : Math.trunc(nextValue);
}

function toOptionalPositiveInteger(value: unknown): number | undefined {
  const nextValue = toOptionalInteger(value);
  return nextValue !== undefined && nextValue > 0 ? nextValue : undefined;
}

function toOptionalNonNegativeInteger(value: unknown): number | undefined {
  const nextValue = toOptionalInteger(value);
  return nextValue !== undefined && nextValue >= 0 ? nextValue : undefined;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0);
}

function toUniqueStringArray(value: unknown): string[] {
  return Array.from(new Set(toStringArray(value)));
}

function toStringRecord(value: unknown): Record<string, string> | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const result: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    const nextValue = toOptionalString(entry);
    if (nextValue) {
      result[key] = nextValue;
    }
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

function toNumberRecord(value: unknown): Record<string, number> | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const result: Record<string, number> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "number" && Number.isFinite(entry)) {
      result[key] = entry;
    }
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

function getNextWorldName(worlds: WorldIndex[]): string {
  const baseName = "新世界";
  const existingNames = new Set(worlds.map((item) => item.name));

  if (!existingNames.has(baseName)) {
    return baseName;
  }

  let index = 2;
  while (existingNames.has(`${baseName} ${index}`)) {
    index += 1;
  }

  return `${baseName} ${index}`;
}

function getUniquePrimaryAttributeKey(rules: WorldConfig): string {
  const existingKeys = new Set(rules.primaryAttributes.map((item) => item.key));
  let index = rules.primaryAttributes.length + 1;

  while (existingKeys.has(`attr_${index}`)) {
    index += 1;
  }

  return `attr_${index}`;
}

function getUniqueDerivedStatKey(rules: WorldConfig): string {
  const existingKeys = new Set([
    ...rules.primaryAttributes.map((item) => item.key),
    ...rules.derivedStats.map((item) => item.key),
  ]);
  let index = rules.derivedStats.length + 1;

  while (existingKeys.has(`derived_${index}`)) {
    index += 1;
  }

  return `derived_${index}`;
}

function getUniqueRuleRecordKey(
  existingKeys: Iterable<string>,
  prefix: string,
): string {
  const usedKeys = new Set(existingKeys);
  let index = usedKeys.size + 1;

  while (usedKeys.has(`${prefix}_${index}`)) {
    index += 1;
  }

  return `${prefix}_${index}`;
}

const DERIVED_STAT_FORMULA_BUILTINS = new Set([
  "floor",
  "ceil",
  "min",
  "max",
  "abs",
  "round",
  "sqrt",
  "pow",
  "log",
  "exp",
  "sin",
  "cos",
  "tan",
  "PI",
  "E",
  "true",
  "false",
]);
const FORMULA_IDENTIFIER_REGEX = /\b[a-zA-Z_][a-zA-Z0-9_]*\b/g;

function extractFormulaIdentifiers(formula: string): string[] {
  const matched = formula.match(FORMULA_IDENTIFIER_REGEX);
  if (!matched) {
    return [];
  }

  const identifiers: string[] = [];
  const seen = new Set<string>();

  for (const identifier of matched) {
    if (DERIVED_STAT_FORMULA_BUILTINS.has(identifier) || seen.has(identifier)) {
      continue;
    }

    seen.add(identifier);
    identifiers.push(identifier);
  }

  return identifiers;
}

function getDuplicateValues(values: string[]): string[] {
  const counts = new Map<string, number>();

  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .filter(([, count]) => count > 1)
    .map(([value]) => value);
}

function normalizePrimaryAttribute(
  value: unknown,
  index: number,
): PrimaryAttributeConfig {
  const record = isRecord(value) ? value : {};
  const fallbackKey = `attr_${index + 1}`;

  return {
    key: toRequiredString(record.key, fallbackKey),
    label: toRequiredString(record.label, `属性 ${index + 1}`),
    defaultValue: toNumber(record.defaultValue, 10),
    min: toOptionalNumber(record.min),
    max: toOptionalNumber(record.max),
    description: toOptionalString(record.description),
  };
}

function normalizeDerivedStat(
  value: unknown,
  index: number,
): DerivedStatConfig {
  const record = isRecord(value) ? value : {};
  const fallbackKey = `derived_${index + 1}`;
  const key = toRequiredString(record.key, fallbackKey);
  const formula = toRequiredString(record.formula, "0");
  const dependencies = extractFormulaIdentifiers(formula).filter(
    (identifier) => identifier !== key,
  );
  const category = toOptionalString(record.category);
  const normalizedCategory =
    category === "resource" ||
    category === "combat" ||
    category === "defense" ||
    category === "misc"
      ? category
      : undefined;
  const isResource =
    typeof record.isResource === "boolean" ? record.isResource : undefined;
  const showInUI =
    typeof record.showInUI === "boolean" ? record.showInUI : undefined;
  const maxField = isResource ? toOptionalString(record.maxField) : undefined;

  return {
    key,
    label: toRequiredString(record.label, `衍生属性 ${index + 1}`),
    formula,
    ...(dependencies.length > 0 ? { dependencies } : {}),
    min: toOptionalNumber(record.min),
    max: toOptionalNumber(record.max),
    ...(showInUI === undefined ? {} : { showInUI }),
    ...(normalizedCategory ? { category: normalizedCategory } : {}),
    ...(isResource === undefined ? {} : { isResource }),
    ...(maxField ? { maxField } : {}),
  };
}

function normalizeDimensionOption(
  value: unknown,
  index: number,
): DimensionOption {
  const record = isRecord(value) ? value : {};
  const rawEffects = isRecord(record.effects) ? record.effects : undefined;
  const attributeModifiers = toNumberRecord(rawEffects?.attributeModifiers);
  const grantedTalents = toUniqueStringArray(rawEffects?.grantedTalents);
  const excludedTalents = toUniqueStringArray(rawEffects?.excludedTalents);

  return {
    id: toRequiredString(record.id, `option_${index + 1}`),
    name: toRequiredString(record.name, `选项 ${index + 1}`),
    description: toRequiredString(record.description, ""),
    icon: toOptionalString(record.icon),
    defaults: toStringRecord(record.defaults),
    effects:
      attributeModifiers ||
      grantedTalents.length > 0 ||
      excludedTalents.length > 0
        ? {
            ...(attributeModifiers ? { attributeModifiers } : {}),
            ...(grantedTalents.length > 0 ? { grantedTalents } : {}),
            ...(excludedTalents.length > 0 ? { excludedTalents } : {}),
          }
        : undefined,
  };
}

function normalizeDimension(value: unknown, index: number): CharacterDimension {
  const record = isRecord(value) ? value : {};
  const options = Array.isArray(record.options)
    ? record.options.map((item, optionIndex) =>
        normalizeDimensionOption(item, optionIndex),
      )
    : [];

  return {
    id: toRequiredString(record.id, `dimension_${index + 1}`),
    label: toRequiredString(record.label, `维度 ${index + 1}`),
    description: toOptionalString(record.description),
    required: Boolean(record.required),
    order: toOptionalNumber(record.order),
    options,
  };
}

function normalizePointBuyRules(value: unknown): PointBuyRules | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  return {
    allocatableAttributes: toStringArray(value.allocatableAttributes),
    bonusPoints: toNumber(value.bonusPoints, 10),
    minPerAttribute: toOptionalNumber(value.minPerAttribute),
    maxPerAttribute: toOptionalNumber(value.maxPerAttribute),
  };
}

function normalizeDCPreset(value: unknown, index: number): EditableDCPreset {
  const record = isRecord(value) ? value : {};
  const defaultSkill = toOptionalString(record.defaultSkill);

  return {
    label: toRequiredString(record.label, `DC 预设 ${index + 1}`),
    formula: toRequiredString(record.formula, "10"),
    ...(defaultSkill ? { defaultSkill } : {}),
  };
}

function normalizeOpposedPreset(
  value: unknown,
  index: number,
): EditableOpposedPreset {
  const record = isRecord(value) ? value : {};

  return {
    label: toRequiredString(record.label, `对抗预设 ${index + 1}`),
    attackerSkill: toRequiredString(record.attackerSkill, "attack"),
    defenderSkill: toRequiredString(record.defenderSkill, "defense"),
  };
}

function normalizeDCGuideline(
  value: unknown,
): CheckRuleConfig["dcGuideline"] | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const scale = Array.isArray(value.scale)
    ? value.scale.map((item, index) => {
        const record = isRecord(item) ? item : {};
        return {
          label: toRequiredString(record.label, `难度 ${index + 1}`),
          dc: toNumber(record.dc, 10),
          description: toRequiredString(record.description, ""),
        };
      })
    : [];

  return scale.length > 0 ? { scale } : undefined;
}

function normalizeCheckRules(value: unknown): CheckRuleConfig {
  const record = isRecord(value) ? value : {};
  const defaultDice = toOptionalString(record.defaultDice);
  const criticalSuccessThreshold = toOptionalInteger(
    record.criticalSuccessThreshold,
  );
  const criticalFailureThreshold = toOptionalInteger(
    record.criticalFailureThreshold,
  );
  const allowContest =
    typeof record.allowContest === "boolean" ? record.allowContest : undefined;
  const dcPresets = isRecord(record.dcPresets)
    ? (Object.fromEntries(
        Object.entries(record.dcPresets).map(([key, preset], index) => [
          toRequiredString(key, `dc_preset_${index + 1}`),
          normalizeDCPreset(preset, index),
        ]),
      ) as EditableDCPresets)
    : undefined;
  const opposedPresets = isRecord(record.opposedPresets)
    ? (Object.fromEntries(
        Object.entries(record.opposedPresets).map(([key, preset], index) => [
          toRequiredString(key, `opposed_preset_${index + 1}`),
          normalizeOpposedPreset(preset, index),
        ]),
      ) as EditableOpposedPresets)
    : undefined;
  const dcGuideline = normalizeDCGuideline(record.dcGuideline);

  return {
    ...(defaultDice ? { defaultDice } : {}),
    ...(criticalSuccessThreshold === undefined
      ? {}
      : { criticalSuccessThreshold }),
    ...(criticalFailureThreshold === undefined
      ? {}
      : { criticalFailureThreshold }),
    ...(allowContest === undefined ? {} : { allowContest }),
    ...(dcPresets && Object.keys(dcPresets).length > 0 ? { dcPresets } : {}),
    ...(opposedPresets && Object.keys(opposedPresets).length > 0
      ? { opposedPresets }
      : {}),
    ...(dcGuideline ? { dcGuideline } : {}),
  };
}

function normalizeConditionTrigger(
  value: unknown,
): ConditionConfig["trigger"] | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const timing = toOptionalString(value.timing);
  if (
    timing !== "turn_start" &&
    timing !== "on_damage" &&
    timing !== "passive"
  ) {
    return undefined;
  }

  const actions = Array.isArray(value.actions)
    ? cloneValue(value.actions)
    : undefined;
  const modifiers = Array.isArray(value.modifiers)
    ? cloneValue(value.modifiers)
    : undefined;
  const autoDecrement =
    typeof value.autoDecrement === "boolean" ? value.autoDecrement : undefined;
  const damageTypes = isRecord(value.damageFilter)
    ? toUniqueStringArray(value.damageFilter.damageTypes)
    : [];

  return {
    timing,
    ...(actions ? { actions } : {}),
    ...(modifiers ? { modifiers } : {}),
    ...(timing === "on_damage" && damageTypes.length > 0
      ? { damageFilter: { damageTypes } }
      : {}),
    ...(autoDecrement === undefined ? {} : { autoDecrement }),
  };
}

function normalizeCondition(value: unknown, index: number): ConditionConfig {
  const record = isRecord(value) ? value : {};
  const description = toOptionalString(record.description);
  const tags = toUniqueStringArray(record.tags);
  const trigger = normalizeConditionTrigger(record.trigger);
  const duration = toOptionalPositiveInteger(record.duration);
  const stackable =
    typeof record.stackable === "boolean" ? record.stackable : undefined;
  const icon = toOptionalString(record.icon);

  return {
    id: toRequiredString(record.id, `condition_${index + 1}`),
    name: toRequiredString(record.name, `状态 ${index + 1}`),
    ...(description ? { description } : {}),
    ...(tags.length > 0 ? { tags } : {}),
    ...(trigger ? { trigger } : {}),
    ...(duration === undefined ? {} : { duration }),
    ...(stackable === undefined ? {} : { stackable }),
    ...(icon ? { icon } : {}),
  };
}

function normalizeTalentRules(
  value: unknown,
): WorldConfig["talentRules"] | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const initialCount = toOptionalNonNegativeInteger(value.initialCount);
  const allowAcquireDuringGame =
    typeof value.allowAcquireDuringGame === "boolean"
      ? value.allowAcquireDuringGame
      : undefined;

  if (initialCount === undefined && allowAcquireDuringGame === undefined) {
    return undefined;
  }

  return {
    ...(initialCount === undefined ? {} : { initialCount }),
    ...(allowAcquireDuringGame === undefined ? {} : { allowAcquireDuringGame }),
  };
}

function normalizeTalent(value: unknown, index: number): TalentConfig {
  const record = isRecord(value) ? value : {};
  const rawPrerequisites = isRecord(record.prerequisites)
    ? record.prerequisites
    : undefined;
  const prerequisiteAttributes = toNumberRecord(rawPrerequisites?.attributes);
  const category = toOptionalString(record.category);

  return {
    id: toRequiredString(record.id, `talent_${index + 1}`),
    name: toRequiredString(record.name, `天赋 ${index + 1}`),
    description: toRequiredString(record.description, ""),
    category:
      category === "combat" ||
      category === "magic" ||
      category === "survival" ||
      category === "social" ||
      category === "misc"
        ? category
        : undefined,
    icon: toOptionalString(record.icon),
    modifiers: Array.isArray(record.modifiers)
      ? cloneValue(record.modifiers)
      : undefined,
    prerequisites: prerequisiteAttributes
      ? { attributes: prerequisiteAttributes }
      : undefined,
    exclusiveWith: toUniqueStringArray(record.exclusiveWith),
  };
}

function normalizeNarrative(value: unknown): WorldNarrativeSeed {
  const record = isRecord(value) ? value : {};

  return {
    script: toOptionalString(record.script),
    opening: toOptionalString(record.opening),
  };
}

function isWorldConfig(value: unknown): value is WorldConfig {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value.version === 1 &&
    Array.isArray(value.primaryAttributes) &&
    Array.isArray(value.derivedStats) &&
    isRecord(value.checkRules)
  );
}

function normalizeWorldRules(
  worldId: string,
  worldName: string,
  rules: WorldConfig,
): WorldConfig {
  const pointBuyRules = normalizePointBuyRules(rules.pointBuyRules);
  const primaryAttributes = Array.isArray(rules.primaryAttributes)
    ? rules.primaryAttributes.map((item, index) =>
        normalizePrimaryAttribute(item, index),
      )
    : cloneValue(DEFAULT_WORLD_CONFIG.primaryAttributes);
  const derivedStats = Array.isArray(rules.derivedStats)
    ? rules.derivedStats.map((item, index) => normalizeDerivedStat(item, index))
    : cloneValue(DEFAULT_WORLD_CONFIG.derivedStats);
  const checkRules = {
    ...normalizeCheckRules(DEFAULT_WORLD_CONFIG.checkRules),
    ...normalizeCheckRules(rules.checkRules),
  };
  const conditions = Array.isArray(rules.conditions)
    ? rules.conditions.map((item, index) => normalizeCondition(item, index))
    : cloneValue(DEFAULT_WORLD_CONFIG.conditions ?? []).map((item, index) =>
        normalizeCondition(item, index),
      );

  return {
    ...cloneValue(DEFAULT_WORLD_CONFIG),
    ...cloneValue(rules),
    version: 1,
    worldId,
    worldName,
    primaryAttributes,
    derivedStats,
    checkRules,
    conditions,
    dimensions: Array.isArray(rules.dimensions)
      ? rules.dimensions.map((item, index) => normalizeDimension(item, index))
      : [],
    pointBuyRules,
    talents: Array.isArray(rules.talents)
      ? rules.talents.map((item, index) => normalizeTalent(item, index))
      : [],
    talentRules: normalizeTalentRules(rules.talentRules),
  };
}

function normalizeWorld(world: World): World {
  const metaSource = world.meta.source === "lyra" ? "lyra" : "custom";
  const metaName = toRequiredString(world.meta.name, "未命名世界");

  return {
    id: world.id,
    meta: {
      name: metaName,
      description: toOptionalString(world.meta.description),
      author: toOptionalString(world.meta.author),
      version: toRequiredString(world.meta.version, "1.0.0"),
      createdAt: toNumber(world.meta.createdAt, Date.now()),
      updatedAt: toNumber(world.meta.updatedAt, Date.now()),
      source: metaSource,
    },
    rules: normalizeWorldRules(world.id, metaName, world.rules),
    narrative: normalizeNarrative(world.narrative),
  };
}

function getRawRulesEditorPayload(
  rules: WorldConfig,
  scope: WorldRulesEditorScope,
):
  | WorldConfig
  | EditableRulesAttributesSnapshot
  | EditableRulesDerivedStatsSnapshot
  | EditableRulesCheckRulesSnapshot
  | EditableRulesConditionsSnapshot
  | EditableRulesDimensionsSnapshot
  | EditableRulesTalentsSnapshot {
  switch (scope) {
    case "attributes":
      return {
        primaryAttributes: cloneValue(rules.primaryAttributes),
        ...(rules.pointBuyRules
          ? { pointBuyRules: cloneValue(rules.pointBuyRules) }
          : {}),
      };
    case "derivedStats":
      return {
        derivedStats: cloneValue(rules.derivedStats),
      };
    case "checkRules":
      return {
        checkRules: cloneValue(rules.checkRules),
      };
    case "conditions":
      return {
        conditions: cloneValue(rules.conditions ?? []),
      };
    case "dimensions":
      return {
        dimensions: cloneValue(rules.dimensions ?? []),
      };
    case "talents":
      return {
        talents: cloneValue(rules.talents ?? []),
        ...(rules.talentRules
          ? { talentRules: cloneValue(rules.talentRules) }
          : {}),
      };
    case "full":
    default:
      return cloneValue(rules);
  }
}

function getRawRulesEditorText(
  rules: WorldConfig,
  scope: WorldRulesEditorScope,
): string {
  return JSON.stringify(getRawRulesEditorPayload(rules, scope), null, 2);
}

function applyRawRulesEditorPayload(
  world: World,
  scope: WorldRulesEditorScope,
  parsed: unknown,
): WorldConfig {
  if (scope === "full") {
    if (!isWorldConfig(parsed)) {
      throw new Error("规则 JSON 未通过基础 schema 校验");
    }

    return normalizeWorldRules(world.id, world.meta.name, parsed);
  }

  if (!isRecord(parsed)) {
    throw new Error("当前分区规则 JSON 必须是对象");
  }

  const nextRules = cloneValue(world.rules);

  switch (scope) {
    case "attributes":
      if (!Array.isArray(parsed.primaryAttributes)) {
        throw new Error("属性与点数分区必须包含 primaryAttributes 数组");
      }

      nextRules.primaryAttributes = parsed.primaryAttributes.map(
        (item, index) => normalizePrimaryAttribute(item, index),
      );
      nextRules.pointBuyRules = normalizePointBuyRules(parsed.pointBuyRules);
      break;

    case "derivedStats":
      if (!Array.isArray(parsed.derivedStats)) {
        throw new Error("衍生属性分区必须包含 derivedStats 数组");
      }

      nextRules.derivedStats = parsed.derivedStats.map((item, index) =>
        normalizeDerivedStat(item, index),
      );
      break;

    case "checkRules":
      if (!isRecord(parsed.checkRules)) {
        throw new Error("检定规则分区必须包含 checkRules 对象");
      }

      nextRules.checkRules = normalizeCheckRules(parsed.checkRules);
      break;

    case "conditions":
      if (!Array.isArray(parsed.conditions)) {
        throw new Error("状态分区必须包含 conditions 数组");
      }

      nextRules.conditions = parsed.conditions.map((item, index) =>
        normalizeCondition(item, index),
      );
      break;

    case "dimensions":
      if (!Array.isArray(parsed.dimensions)) {
        throw new Error("角色维度分区必须包含 dimensions 数组");
      }

      nextRules.dimensions = parsed.dimensions.map((item, index) =>
        normalizeDimension(item, index),
      );
      break;

    case "talents":
      if (!Array.isArray(parsed.talents)) {
        throw new Error("天赋分区必须包含 talents 数组");
      }

      nextRules.talents = parsed.talents.map((item, index) =>
        normalizeTalent(item, index),
      );
      nextRules.talentRules = normalizeTalentRules(parsed.talentRules);
      break;
  }

  return normalizeWorldRules(world.id, world.meta.name, nextRules);
}

function getEditableSnapshot(
  world: World | null,
): EditableWorldSnapshot | null {
  if (!world) {
    return null;
  }

  const normalized = normalizeWorld(world);
  return {
    meta: {
      name: normalized.meta.name,
      description: normalized.meta.description,
      author: normalized.meta.author,
      version: normalized.meta.version,
      source: normalized.meta.source,
    },
    rules: normalized.rules,
    narrative: normalized.narrative ?? {},
  };
}

function downloadWorld(world: World): void {
  const content = JSON.stringify(normalizeWorld(world), null, 2);
  const blob = new Blob([content], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = `${world.meta.name || "world"}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function parseImportedWorld(value: unknown): World {
  if (!isRecord(value)) {
    throw new Error("导入文件不是有效的世界对象");
  }

  if (typeof value.id !== "string" || value.id.trim().length === 0) {
    throw new Error("导入文件缺少 world.id");
  }

  if (!isRecord(value.meta)) {
    throw new Error("导入文件缺少 world.meta");
  }

  if (!isWorldConfig(value.rules)) {
    throw new Error("导入文件缺少有效的 world.rules");
  }

  const source = value.meta.source;
  if (source !== "lyra" && source !== "custom") {
    throw new Error("导入文件的 meta.source 非法");
  }

  const imported: World = {
    id: value.id,
    meta: {
      name: toRequiredString(value.meta.name, "未命名世界"),
      description: toOptionalString(value.meta.description),
      author: toOptionalString(value.meta.author),
      version: toRequiredString(value.meta.version, "1.0.0"),
      createdAt: toNumber(value.meta.createdAt, Date.now()),
      updatedAt: toNumber(value.meta.updatedAt, Date.now()),
      source,
    },
    rules: normalizeWorldRules(
      value.id,
      toRequiredString(value.meta.name, "未命名世界"),
      value.rules,
    ),
    narrative: normalizeNarrative(value.narrative),
  };

  return normalizeWorld(imported);
}

export function useWorldWorkspaceState(): WorldWorkspaceState &
  WorldWorkspaceActions {
  const worlds = useWorldStore((state) => state.worlds);
  const activeWorldId = useWorldStore((state) => state.activeWorldId);
  const getWorld = useWorldStore((state) => state.getWorld);
  const createWorldInStore = useWorldStore((state) => state.createWorld);
  const updateWorldInStore = useWorldStore((state) => state.updateWorld);
  const deleteWorldInStore = useWorldStore((state) => state.deleteWorld);
  const setActiveWorldInStore = useWorldStore((state) => state.setActiveWorld);

  const [selectedWorldId, setSelectedWorldId] = useState<WorldId | null>(null);
  const [selectedWorld, setSelectedWorld] = useState<World | null>(null);
  const [draft, setDraft] = useState<World | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingWorld, setIsLoadingWorld] = useState(false);
  const [rawRulesEditorOpen, setRawRulesEditorOpenState] = useState(false);
  const [rawRulesEditorScope, setRawRulesEditorScope] =
    useState<WorldRulesEditorScope>("full");
  const [rawRulesText, setRawRulesTextState] = useState(EMPTY_RULES_JSON);
  const [rawRulesError, setRawRulesError] = useState<string | null>(null);
  const [mobilePage, setMobilePage] =
    useState<WorldWorkspaceMobilePage>("list");
  const [pendingDeleteWorld, setPendingDeleteWorld] = useState<{
    id: WorldId;
    name: string;
  } | null>(null);
  const [discardConfirm, setDiscardConfirm] = useState<{
    open: boolean;
    message: string;
    onConfirm: (() => void) | null;
  }>({ open: false, message: "", onConfirm: null });

  const isDirty = useMemo(() => {
    const baseSnapshot = getEditableSnapshot(selectedWorld);
    const draftSnapshot = getEditableSnapshot(draft);

    if (!baseSnapshot || !draftSnapshot) {
      return false;
    }

    return JSON.stringify(baseSnapshot) !== JSON.stringify(draftSnapshot);
  }, [draft, selectedWorld]);

  const validationMessages = useMemo(() => {
    if (!draft) {
      return [];
    }

    const messages: string[] = [];
    const primaryAttributeKeys = new Set(
      draft.rules.primaryAttributes.map((item) => item.key),
    );
    const derivedStats = draft.rules.derivedStats;
    const derivedKeys = derivedStats.map((item) => item.key);
    const duplicateDerivedKeys = getDuplicateValues(derivedKeys);
    const conflictingDerivedKeys = derivedKeys.filter(
      (key) => key === "level" || primaryAttributeKeys.has(key),
    );
    const knownStatKeys = new Set([
      ...primaryAttributeKeys,
      "level",
      ...derivedKeys,
    ]);
    const allocatableAttributes =
      draft.rules.pointBuyRules?.allocatableAttributes ?? [];
    const invalidAllocatableKeys = allocatableAttributes.filter(
      (key) => !primaryAttributeKeys.has(key),
    );
    const emptyDimensions = (draft.rules.dimensions ?? []).filter(
      (item) => item.options.length === 0,
    );
    const talents = draft.rules.talents ?? [];
    const talentIds = talents.map((item) => item.id);
    const duplicateTalentIds = getDuplicateValues(talentIds);
    const talentIdSet = new Set(talentIds);
    const formulaScope: Record<string, ExpressionPrimitive> = { level: 1 };

    for (const attribute of draft.rules.primaryAttributes) {
      formulaScope[attribute.key] = attribute.defaultValue;
    }

    for (const stat of derivedStats) {
      formulaScope[stat.key] = 0;
    }

    if (!draft.meta.name.trim()) {
      messages.push("世界名称不能为空。");
    }

    if (draft.rules.primaryAttributes.length === 0) {
      messages.push("至少需要一个主要属性。");
    }

    if (allocatableAttributes.length === 0) {
      messages.push("点数分配规则尚未配置可分配属性，角色创建将跳过属性分配。");
    }

    if (invalidAllocatableKeys.length > 0) {
      messages.push(
        `点数分配引用了不存在的属性：${invalidAllocatableKeys.join("、")}。`,
      );
    }

    if (duplicateDerivedKeys.length > 0) {
      messages.push(
        `衍生属性存在重复 key：${duplicateDerivedKeys.join("、")}。`,
      );
    }

    if (conflictingDerivedKeys.length > 0) {
      messages.push(
        `衍生属性 key 不能与主要属性或保留字段冲突：${conflictingDerivedKeys.join("、")}。`,
      );
    }

    for (const stat of derivedStats) {
      const statLabel = `${stat.label}（${stat.key}）`;
      const referencedFields = extractFormulaIdentifiers(stat.formula);
      const selfReference = referencedFields.includes(stat.key);
      const unknownFields = referencedFields.filter(
        (key) => key !== stat.key && !knownStatKeys.has(key),
      );

      if (selfReference) {
        messages.push(`衍生属性 ${statLabel} 的公式不能引用自身 key。`);
      }

      if (unknownFields.length > 0) {
        messages.push(
          `衍生属性 ${statLabel} 的公式引用了不存在的字段：${unknownFields.join("、")}。`,
        );
      }

      if (
        stat.min !== undefined &&
        stat.max !== undefined &&
        stat.min > stat.max
      ) {
        messages.push(`衍生属性 ${statLabel} 的最小值不能大于最大值。`);
      }

      if (stat.isResource) {
        if (!stat.maxField) {
          messages.push(`资源型衍生属性 ${statLabel} 缺少上限字段 maxField。`);
        } else if (stat.maxField === stat.key) {
          messages.push(
            `资源型衍生属性 ${statLabel} 的 maxField 不能指向自身。`,
          );
        } else if (!knownStatKeys.has(stat.maxField)) {
          messages.push(
            `资源型衍生属性 ${statLabel} 的 maxField 引用了不存在的字段：${stat.maxField}。`,
          );
        }
      }

      if (unknownFields.length === 0 && !selfReference) {
        try {
          const result = evaluateExpression(
            stat.formula,
            formulaScope,
            () => 0.5,
          );
          if (
            typeof result.value !== "number" ||
            !Number.isFinite(result.value)
          ) {
            messages.push(`衍生属性 ${statLabel} 的公式结果不是稳定数值。`);
          }
        } catch (error) {
          const reason = error instanceof Error ? error.message : "未知错误";
          messages.push(`衍生属性 ${statLabel} 的公式校验失败：${reason}`);
        }
      }
    }

    if (duplicateDerivedKeys.length === 0) {
      try {
        topologicalSortDerivedStats(derivedStats);
      } catch (error) {
        const reason =
          error instanceof Error ? error.message : "衍生属性依赖校验失败。";
        messages.push(reason);
      }
    }

    const dcPresetKeys = Object.keys(draft.rules.checkRules.dcPresets ?? {});
    const duplicateConditionIds = getDuplicateValues(
      (draft.rules.conditions ?? []).map((item) => item.id),
    );
    const duplicateConditionNames = getDuplicateValues(
      (draft.rules.conditions ?? []).map((item) => item.name),
    );

    if (emptyDimensions.length > 0) {
      messages.push(
        `以下维度没有可选项，将不会在创建向导中显示：${emptyDimensions
          .map((item) => item.label)
          .join("、")}。`,
      );
    }

    if (duplicateTalentIds.length > 0) {
      messages.push(`天赋存在重复 id：${duplicateTalentIds.join("、")}。`);
    }

    for (const dimension of draft.rules.dimensions ?? []) {
      for (const option of dimension.options) {
        const optionLabel = `${dimension.label} / ${option.name}`;
        const invalidModifierKeys = Object.keys(
          option.effects?.attributeModifiers ?? {},
        ).filter((key) => !primaryAttributeKeys.has(key));
        const invalidGrantedTalents = (
          option.effects?.grantedTalents ?? []
        ).filter((id) => !talentIdSet.has(id));
        const invalidExcludedTalents = (
          option.effects?.excludedTalents ?? []
        ).filter((id) => !talentIdSet.has(id));

        if (invalidModifierKeys.length > 0) {
          messages.push(
            `维度选项 ${optionLabel} 的属性修正引用了不存在的主要属性：${invalidModifierKeys.join("、")}。`,
          );
        }

        if (invalidGrantedTalents.length > 0) {
          messages.push(
            `维度选项 ${optionLabel} 的赠送天赋引用了不存在的天赋：${invalidGrantedTalents.join("、")}。`,
          );
        }

        if (invalidExcludedTalents.length > 0) {
          messages.push(
            `维度选项 ${optionLabel} 的排除天赋引用了不存在的天赋：${invalidExcludedTalents.join("、")}。`,
          );
        }
      }
    }

    if (!draft.rules.checkRules.defaultDice?.trim()) {
      messages.push(
        "检定规则缺少默认骰子表达式，系统会在保存前回退到内置默认值。",
      );
    }

    for (const presetKey of dcPresetKeys) {
      const preset = draft.rules.checkRules.dcPresets?.[presetKey];
      if (!preset) {
        continue;
      }

      if (!preset.formula.trim()) {
        messages.push(`DC 预设 ${preset.label || presetKey} 缺少公式。`);
      }
    }

    const guidelineScale = draft.rules.checkRules.dcGuideline?.scale ?? [];
    for (const [index, item] of guidelineScale.entries()) {
      if (item.label.trim().length === 0) {
        messages.push(`AI 难度刻度 #${index + 1} 缺少难度名称。`);
      }
    }

    if (duplicateConditionIds.length > 0) {
      messages.push(`状态存在重复 id：${duplicateConditionIds.join("、")}。`);
    }

    if (duplicateConditionNames.length > 0) {
      messages.push(
        `状态存在重复显示名：${duplicateConditionNames.join("、")}。`,
      );
    }

    for (const condition of draft.rules.conditions ?? []) {
      const trigger = condition.trigger;
      const conditionLabel = `${condition.name}（${condition.id}）`;
      if (condition.duration !== undefined && condition.duration <= 0) {
        messages.push(`状态 ${conditionLabel} 的持续回合必须大于 0。`);
      }

      if (trigger?.timing === "on_damage") {
        const damageTypes = trigger.damageFilter?.damageTypes ?? [];
        const duplicatedDamageTypes = getDuplicateValues(damageTypes);
        if (duplicatedDamageTypes.length > 0) {
          messages.push(
            `状态 ${conditionLabel} 的伤害类型过滤存在重复项：${duplicatedDamageTypes.join("、")}。`,
          );
        }
      }

      if (trigger?.timing === "passive") {
        for (const [modifierIndex, modifier] of (
          trigger.modifiers ?? []
        ).entries()) {
          if (modifier.scope !== "stat") {
            continue;
          }

          const field = modifier.field?.trim();
          if (!field) {
            messages.push(
              `状态 ${conditionLabel} 的被动修正 #${modifierIndex + 1} 缺少目标字段。`,
            );
            continue;
          }

          if (!knownStatKeys.has(field)) {
            messages.push(
              `状态 ${conditionLabel} 的被动修正 #${modifierIndex + 1} 引用了不存在的属性字段：${field}。`,
            );
          }
        }
      }
    }

    const talentInitialCount = draft.rules.talentRules?.initialCount;
    if (
      talentInitialCount !== undefined &&
      (!Number.isInteger(talentInitialCount) || talentInitialCount < 0)
    ) {
      messages.push("天赋规则的初始可选数量必须是大于等于 0 的整数。");
    }

    for (const talent of talents) {
      const talentLabel = `${talent.name}（${talent.id}）`;
      const invalidPrerequisiteKeys = Object.keys(
        talent.prerequisites?.attributes ?? {},
      ).filter((key) => !primaryAttributeKeys.has(key));
      const duplicateExclusiveIds = getDuplicateValues(
        talent.exclusiveWith ?? [],
      );
      const invalidExclusiveIds = (talent.exclusiveWith ?? []).filter(
        (id) => !talentIdSet.has(id),
      );

      if (invalidPrerequisiteKeys.length > 0) {
        messages.push(
          `天赋 ${talentLabel} 的前置属性引用了不存在的主要属性：${invalidPrerequisiteKeys.join("、")}。`,
        );
      }

      if (duplicateExclusiveIds.length > 0) {
        messages.push(
          `天赋 ${talentLabel} 的互斥列表存在重复项：${duplicateExclusiveIds.join("、")}。`,
        );
      }

      if (invalidExclusiveIds.length > 0) {
        messages.push(
          `天赋 ${talentLabel} 的互斥列表引用了不存在的天赋：${invalidExclusiveIds.join("、")}。`,
        );
      }

      if ((talent.exclusiveWith ?? []).includes(talent.id)) {
        messages.push(`天赋 ${talentLabel} 不能将自己配置为互斥对象。`);
      }
    }

    if ((draft.rules.talents ?? []).length === 0) {
      messages.push("当前世界没有可选天赋，角色创建流程会跳过天赋步骤。");
    }

    return messages;
  }, [draft]);

  const updateDraft = useCallback((updater: (current: World) => World) => {
    setDraft((current) => {
      if (!current) {
        return current;
      }

      const next = updater(cloneValue(current));
      return normalizeWorld(next);
    });
  }, []);

  const syncRawRulesFromDraft = useCallback(
    (world: World | null, scope: WorldRulesEditorScope = "full") => {
      if (!world) {
        setRawRulesTextState(
          scope === "full"
            ? EMPTY_RULES_JSON
            : getRawRulesEditorText(DEFAULT_WORLD_CONFIG, scope),
        );
        setRawRulesError(null);
        return;
      }

      setRawRulesTextState(
        getRawRulesEditorText(normalizeWorld(world).rules, scope),
      );
      setRawRulesError(null);
    },
    [],
  );

  const confirmDiscardChanges = useCallback(
    (
      onConfirm: () => void,
      message = "当前世界有未保存修改，继续操作会丢失这些更改。是否继续？",
    ) => {
      if (!isDirty) {
        onConfirm();
        return;
      }
      setDiscardConfirm({ open: true, message, onConfirm });
    },
    [isDirty],
  );

  const handleConfirmDiscard = useCallback(() => {
    discardConfirm.onConfirm?.();
    setDiscardConfirm({ open: false, message: "", onConfirm: null });
  }, [discardConfirm]);

  const handleCancelDiscard = useCallback(() => {
    setDiscardConfirm({ open: false, message: "", onConfirm: null });
  }, []);

  useEffect(() => {
    if (worlds.length === 0) {
      setSelectedWorldId(null);
      setSelectedWorld(null);
      setDraft(null);
      setRawRulesEditorScope("full");
      syncRawRulesFromDraft(null, "full");
      setMobilePage("list");
      return;
    }

    if (!selectedWorldId) {
      setSelectedWorldId(activeWorldId ?? worlds[0]?.id ?? null);
      return;
    }

    const exists = worlds.some((item) => item.id === selectedWorldId);
    if (!exists) {
      setSelectedWorldId(activeWorldId ?? worlds[0]?.id ?? null);
    }
  }, [activeWorldId, selectedWorldId, syncRawRulesFromDraft, worlds]);

  useEffect(() => {
    let disposed = false;

    async function loadSelectedWorld(): Promise<void> {
      if (!selectedWorldId) {
        setSelectedWorld(null);
        setDraft(null);
        syncRawRulesFromDraft(null);
        setIsLoadingWorld(false);
        return;
      }

      setIsLoadingWorld(true);
      const nextWorld = await getWorld(selectedWorldId);

      if (disposed) {
        return;
      }

      const normalizedWorld = normalizeWorld(nextWorld ?? defaultWorld);
      setSelectedWorld(normalizedWorld);
      setDraft(cloneValue(normalizedWorld));
      setRawRulesEditorOpenState(false);
      setRawRulesEditorScope("full");
      syncRawRulesFromDraft(normalizedWorld, "full");
      setIsLoadingWorld(false);
    }

    void loadSelectedWorld();

    return () => {
      disposed = true;
    };
  }, [getWorld, selectedWorldId, syncRawRulesFromDraft]);

  const selectWorld = useCallback(
    (id: WorldId) => {
      if (id === selectedWorldId) {
        setMobilePage("editor");
        return;
      }

      confirmDiscardChanges(() => {
        setSelectedWorldId(id);
        setMobilePage("editor");
      });
    },
    [confirmDiscardChanges, selectedWorldId],
  );

  const setActiveWorld = useCallback(
    (id: WorldId) => {
      setActiveWorldInStore(id);
    },
    [setActiveWorldInStore],
  );

  const createWorld = useCallback(
    (onCreated?: (world: World) => void) => {
      confirmDiscardChanges(async () => {
        const name = getNextWorldName(worlds);
        const world = await createWorldInStore(name, "");
        setActiveWorldInStore(world.id);
        setSelectedWorldId(world.id);
        setMobilePage("editor");
        const normalized = normalizeWorld({
          ...world,
          narrative: world.narrative ?? {},
          rules: normalizeWorldRules(world.id, world.meta.name, world.rules),
        });
        onCreated?.(normalized);
      }, "新建世界会放弃当前未保存修改。是否继续？");
    },
    [confirmDiscardChanges, createWorldInStore, setActiveWorldInStore, worlds],
  );

  const deleteWorld = useCallback(
    (id: WorldId) => {
      const target = worlds.find((item) => item.id === id);
      const targetName = target?.name ?? "该世界";
      setPendingDeleteWorld({ id, name: targetName });
    },
    [worlds],
  );

  const confirmDeleteWorld = useCallback(async () => {
    if (!pendingDeleteWorld) return;
    await deleteWorldInStore(pendingDeleteWorld.id);
    setPendingDeleteWorld(null);
  }, [deleteWorldInStore, pendingDeleteWorld]);

  const cancelDeleteWorld = useCallback(() => {
    setPendingDeleteWorld(null);
  }, []);

  const saveSelectedWorld = useCallback(async () => {
    if (!draft) {
      return null;
    }

    const normalizedDraft = normalizeWorld(draft);
    setIsSaving(true);

    try {
      await updateWorldInStore(normalizedDraft.id, {
        meta: {
          name: normalizedDraft.meta.name,
          description: normalizedDraft.meta.description,
          author: normalizedDraft.meta.author,
          version: normalizedDraft.meta.version,
          source: normalizedDraft.meta.source,
        },
        rules: normalizeWorldRules(
          normalizedDraft.id,
          normalizedDraft.meta.name,
          normalizedDraft.rules,
        ),
        narrative: normalizeNarrative(normalizedDraft.narrative),
      });

      const persisted = await getWorld(normalizedDraft.id);
      const nextWorld = normalizeWorld(persisted ?? normalizedDraft);
      setSelectedWorld(nextWorld);
      setDraft(cloneValue(nextWorld));
      syncRawRulesFromDraft(nextWorld, rawRulesEditorScope);
      return nextWorld;
    } finally {
      setIsSaving(false);
    }
  }, [
    draft,
    getWorld,
    rawRulesEditorScope,
    syncRawRulesFromDraft,
    updateWorldInStore,
  ]);

  const resetDraft = useCallback(() => {
    if (!selectedWorld) {
      return;
    }

    const nextWorld = normalizeWorld(selectedWorld);
    setDraft(cloneValue(nextWorld));
    setRawRulesEditorOpenState(false);
    setRawRulesEditorScope("full");
    syncRawRulesFromDraft(nextWorld, "full");
  }, [selectedWorld, syncRawRulesFromDraft]);

  const openRawRulesEditor = useCallback(
    (scope: WorldRulesEditorScope) => {
      setRawRulesEditorScope(scope);
      setRawRulesEditorOpenState(true);
      setRawRulesError(null);
      syncRawRulesFromDraft(draft, scope);
    },
    [draft, syncRawRulesFromDraft],
  );

  const closeRawRulesEditor = useCallback(() => {
    setRawRulesEditorOpenState(false);
    setRawRulesError(null);
  }, []);

  const setRawRulesText = useCallback((value: string) => {
    setRawRulesTextState(value);
    setRawRulesError(null);
  }, []);

  const applyRawRulesText = useCallback(() => {
    if (!draft) {
      return;
    }

    try {
      const parsed = JSON.parse(rawRulesText) as unknown;
      const nextRules = applyRawRulesEditorPayload(
        draft,
        rawRulesEditorScope,
        parsed,
      );

      updateDraft((current) => {
        current.rules = nextRules;
        return current;
      });
      setRawRulesTextState(
        getRawRulesEditorText(nextRules, rawRulesEditorScope),
      );
      setRawRulesError(null);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "原始规则解析失败";
      setRawRulesError(message);
      throw error;
    }
  }, [draft, rawRulesEditorScope, rawRulesText, updateDraft]);

  const exportSelectedWorld = useCallback(() => {
    if (!draft) {
      return;
    }

    downloadWorld(draft);
  }, [draft]);

  const importWorldFromFile = useCallback(
    (
      file: File,
      callbacks?: {
        onSuccess?: (world: World) => void;
        onError?: (err: Error) => void;
      },
    ) => {
      confirmDiscardChanges(async () => {
        try {
          const text = await file.text();
          let parsed: unknown;

          try {
            parsed = JSON.parse(text) as unknown;
          } catch {
            throw new Error("世界文件不是有效的 JSON");
          }

          const importedWorld = parseImportedWorld(parsed);
          const createdWorld = await createWorldInStore(
            importedWorld.meta.name,
            importedWorld.meta.description,
          );

          await updateWorldInStore(createdWorld.id, {
            meta: {
              name: importedWorld.meta.name,
              description: importedWorld.meta.description,
              author: importedWorld.meta.author,
              version: importedWorld.meta.version,
              source: "custom",
            },
            rules: normalizeWorldRules(
              createdWorld.id,
              importedWorld.meta.name,
              importedWorld.rules,
            ),
            narrative: normalizeNarrative(importedWorld.narrative),
          });

          setActiveWorldInStore(createdWorld.id);
          setSelectedWorldId(createdWorld.id);
          setMobilePage("editor");

          const persisted = await getWorld(createdWorld.id);
          const normalized = normalizeWorld(persisted ?? createdWorld);
          callbacks?.onSuccess?.(normalized);
        } catch (err) {
          callbacks?.onError?.(
            err instanceof Error ? err : new Error("未知错误"),
          );
        }
      }, "导入新世界会切换当前编辑对象，是否继续？");
    },
    [
      confirmDiscardChanges,
      createWorldInStore,
      getWorld,
      setActiveWorldInStore,
      updateWorldInStore,
    ],
  );

  const updateMeta = useCallback(
    (updates: Partial<EditableWorldMeta>) => {
      updateDraft((current) => {
        current.meta = {
          ...current.meta,
          ...updates,
        };

        if (updates.name) {
          current.rules.worldName = updates.name;
        }

        current.rules = normalizeWorldRules(
          current.id,
          current.meta.name,
          current.rules,
        );
        return current;
      });
    },
    [updateDraft],
  );

  const updateNarrative = useCallback(
    (updates: Partial<WorldNarrativeSeed>) => {
      updateDraft((current) => {
        current.narrative = normalizeNarrative({
          ...(current.narrative ?? {}),
          ...updates,
        });
        return current;
      });
    },
    [updateDraft],
  );

  const updatePrimaryAttribute = useCallback(
    (index: number, updates: Partial<PrimaryAttributeConfig>) => {
      updateDraft((current) => {
        const target = current.rules.primaryAttributes[index];
        if (!target) {
          return current;
        }

        const previousKey = target.key;
        current.rules.primaryAttributes[index] = normalizePrimaryAttribute(
          {
            ...target,
            ...updates,
          },
          index,
        );

        const nextKey = current.rules.primaryAttributes[index].key;
        if (
          previousKey !== nextKey &&
          current.rules.pointBuyRules?.allocatableAttributes
        ) {
          current.rules.pointBuyRules.allocatableAttributes =
            current.rules.pointBuyRules.allocatableAttributes.map((item) =>
              item === previousKey ? nextKey : item,
            );
        }

        return current;
      });
    },
    [updateDraft],
  );

  const addPrimaryAttribute = useCallback(() => {
    updateDraft((current) => {
      const key = getUniquePrimaryAttributeKey(current.rules);
      current.rules.primaryAttributes.push({
        key,
        label: `属性 ${current.rules.primaryAttributes.length + 1}`,
        defaultValue: 10,
        min: 0,
        max: 20,
        description: "",
      });
      return current;
    });
  }, [updateDraft]);

  const removePrimaryAttribute = useCallback(
    (index: number) => {
      updateDraft((current) => {
        const target = current.rules.primaryAttributes[index];
        if (!target) {
          return current;
        }

        current.rules.primaryAttributes.splice(index, 1);
        if (current.rules.pointBuyRules?.allocatableAttributes) {
          current.rules.pointBuyRules.allocatableAttributes =
            current.rules.pointBuyRules.allocatableAttributes.filter(
              (item) => item !== target.key,
            );
        }
        return current;
      });
    },
    [updateDraft],
  );

  const updatePointBuyRules = useCallback(
    (updates: Partial<PointBuyRules>) => {
      updateDraft((current) => {
        const nextPointBuyRules = normalizePointBuyRules({
          ...(current.rules.pointBuyRules ?? {
            allocatableAttributes: [],
            bonusPoints: 10,
          }),
          ...updates,
        });

        current.rules.pointBuyRules = nextPointBuyRules;
        return current;
      });
    },
    [updateDraft],
  );

  const updateCheckRules = useCallback(
    (updates: Partial<CheckRuleConfig>) => {
      updateDraft((current) => {
        current.rules.checkRules = normalizeCheckRules({
          ...current.rules.checkRules,
          ...updates,
        });
        return current;
      });
    },
    [updateDraft],
  );

  const addDcPreset = useCallback(() => {
    updateDraft((current) => {
      const currentPresets = current.rules.checkRules.dcPresets ?? {};
      const presetKey = getUniqueRuleRecordKey(
        Object.keys(currentPresets),
        "dc_preset",
      );
      current.rules.checkRules = normalizeCheckRules({
        ...current.rules.checkRules,
        dcPresets: {
          ...currentPresets,
          [presetKey]: normalizeDCPreset(
            {},
            Object.keys(currentPresets).length,
          ),
        },
      });
      return current;
    });
  }, [updateDraft]);

  const updateDcPreset = useCallback(
    (presetKey: string, updates: Partial<EditableDCPreset>) => {
      updateDraft((current) => {
        const currentPresets = current.rules.checkRules.dcPresets ?? {};
        const target = currentPresets[presetKey];
        if (!target) {
          return current;
        }

        current.rules.checkRules = normalizeCheckRules({
          ...current.rules.checkRules,
          dcPresets: {
            ...currentPresets,
            [presetKey]: normalizeDCPreset(
              {
                ...target,
                ...updates,
              },
              Object.keys(currentPresets).indexOf(presetKey),
            ),
          },
        });
        return current;
      });
    },
    [updateDraft],
  );

  const removeDcPreset = useCallback(
    (presetKey: string) => {
      updateDraft((current) => {
        const currentPresets = current.rules.checkRules.dcPresets;
        if (!currentPresets?.[presetKey]) {
          return current;
        }

        const { [presetKey]: _removed, ...rest } = currentPresets;
        current.rules.checkRules = normalizeCheckRules({
          ...current.rules.checkRules,
          dcPresets: rest,
        });
        return current;
      });
    },
    [updateDraft],
  );

  const addOpposedPreset = useCallback(() => {
    updateDraft((current) => {
      const currentPresets = current.rules.checkRules.opposedPresets ?? {};
      const presetKey = getUniqueRuleRecordKey(
        Object.keys(currentPresets),
        "opposed_preset",
      );
      current.rules.checkRules = normalizeCheckRules({
        ...current.rules.checkRules,
        opposedPresets: {
          ...currentPresets,
          [presetKey]: normalizeOpposedPreset(
            {},
            Object.keys(currentPresets).length,
          ),
        },
      });
      return current;
    });
  }, [updateDraft]);

  const updateOpposedPreset = useCallback(
    (presetKey: string, updates: Partial<EditableOpposedPreset>) => {
      updateDraft((current) => {
        const currentPresets = current.rules.checkRules.opposedPresets ?? {};
        const target = currentPresets[presetKey];
        if (!target) {
          return current;
        }

        current.rules.checkRules = normalizeCheckRules({
          ...current.rules.checkRules,
          opposedPresets: {
            ...currentPresets,
            [presetKey]: normalizeOpposedPreset(
              {
                ...target,
                ...updates,
              },
              Object.keys(currentPresets).indexOf(presetKey),
            ),
          },
        });
        return current;
      });
    },
    [updateDraft],
  );

  const removeOpposedPreset = useCallback(
    (presetKey: string) => {
      updateDraft((current) => {
        const currentPresets = current.rules.checkRules.opposedPresets;
        if (!currentPresets?.[presetKey]) {
          return current;
        }

        const { [presetKey]: _removed, ...rest } = currentPresets;
        current.rules.checkRules = normalizeCheckRules({
          ...current.rules.checkRules,
          opposedPresets: rest,
        });
        return current;
      });
    },
    [updateDraft],
  );

  const addDCGuidelineItem = useCallback(() => {
    updateDraft((current) => {
      const scale = current.rules.checkRules.dcGuideline?.scale ?? [];
      current.rules.checkRules = normalizeCheckRules({
        ...current.rules.checkRules,
        dcGuideline: {
          scale: [
            ...scale,
            {
              label: `难度 ${scale.length + 1}`,
              dc: 10,
              description: "",
            },
          ],
        },
      });
      return current;
    });
  }, [updateDraft]);

  const updateDCGuidelineItem = useCallback(
    (index: number, updates: Partial<EditableDCGuidelineScaleItem>) => {
      updateDraft((current) => {
        const scale = current.rules.checkRules.dcGuideline?.scale ?? [];
        const target = scale[index];
        if (!target) {
          return current;
        }

        current.rules.checkRules = normalizeCheckRules({
          ...current.rules.checkRules,
          dcGuideline: {
            scale: scale.map((item, itemIndex) =>
              itemIndex === index
                ? {
                    ...item,
                    ...updates,
                  }
                : item,
            ),
          },
        });
        return current;
      });
    },
    [updateDraft],
  );

  const removeDCGuidelineItem = useCallback(
    (index: number) => {
      updateDraft((current) => {
        const scale = current.rules.checkRules.dcGuideline?.scale ?? [];
        if (!scale[index]) {
          return current;
        }

        current.rules.checkRules = normalizeCheckRules({
          ...current.rules.checkRules,
          dcGuideline: {
            scale: scale.filter((_, itemIndex) => itemIndex !== index),
          },
        });
        return current;
      });
    },
    [updateDraft],
  );

  const updateDerivedStat = useCallback(
    (index: number, updates: Partial<DerivedStatConfig>) => {
      updateDraft((current) => {
        const target = current.rules.derivedStats[index];
        if (!target) {
          return current;
        }

        current.rules.derivedStats[index] = normalizeDerivedStat(
          {
            ...target,
            ...updates,
          },
          index,
        );
        return current;
      });
    },
    [updateDraft],
  );

  const addDerivedStat = useCallback(() => {
    updateDraft((current) => {
      current.rules.derivedStats.push({
        key: getUniqueDerivedStatKey(current.rules),
        label: `衍生属性 ${current.rules.derivedStats.length + 1}`,
        formula: "0",
        showInUI: true,
      });
      return current;
    });
  }, [updateDraft]);

  const removeDerivedStat = useCallback(
    (index: number) => {
      updateDraft((current) => {
        if (!current.rules.derivedStats[index]) {
          return current;
        }

        current.rules.derivedStats.splice(index, 1);
        return current;
      });
    },
    [updateDraft],
  );

  const updateDimension = useCallback(
    (index: number, updates: Partial<CharacterDimension>) => {
      updateDraft((current) => {
        const target = current.rules.dimensions?.[index];
        if (!target) {
          return current;
        }

        current.rules.dimensions![index] = normalizeDimension(
          {
            ...target,
            ...updates,
          },
          index,
        );
        return current;
      });
    },
    [updateDraft],
  );

  const addDimension = useCallback(() => {
    updateDraft((current) => {
      current.rules.dimensions = current.rules.dimensions ?? [];
      current.rules.dimensions.push({
        id: generateId("dimension"),
        label: `维度 ${current.rules.dimensions.length + 1}`,
        description: "",
        required: true,
        order: current.rules.dimensions.length,
        options: [],
      });
      return current;
    });
  }, [updateDraft]);

  const removeDimension = useCallback(
    (index: number) => {
      updateDraft((current) => {
        if (!current.rules.dimensions?.[index]) {
          return current;
        }

        current.rules.dimensions.splice(index, 1);
        return current;
      });
    },
    [updateDraft],
  );

  const updateDimensionOption = useCallback(
    (
      dimensionIndex: number,
      optionIndex: number,
      updates: Partial<DimensionOption>,
    ) => {
      updateDraft((current) => {
        const targetDimension = current.rules.dimensions?.[dimensionIndex];
        const targetOption = targetDimension?.options?.[optionIndex];

        if (!targetDimension || !targetOption) {
          return current;
        }

        targetDimension.options[optionIndex] = normalizeDimensionOption(
          {
            ...targetOption,
            ...updates,
          },
          optionIndex,
        );
        return current;
      });
    },
    [updateDraft],
  );

  const addDimensionOption = useCallback(
    (dimensionIndex: number) => {
      updateDraft((current) => {
        const targetDimension = current.rules.dimensions?.[dimensionIndex];
        if (!targetDimension) {
          return current;
        }

        targetDimension.options.push({
          id: generateId("option"),
          name: `选项 ${targetDimension.options.length + 1}`,
          description: "",
          effects: undefined,
        });
        return current;
      });
    },
    [updateDraft],
  );

  const removeDimensionOption = useCallback(
    (dimensionIndex: number, optionIndex: number) => {
      updateDraft((current) => {
        const targetDimension = current.rules.dimensions?.[dimensionIndex];
        if (!targetDimension?.options?.[optionIndex]) {
          return current;
        }

        targetDimension.options.splice(optionIndex, 1);
        return current;
      });
    },
    [updateDraft],
  );

  const updateCondition = useCallback(
    (index: number, updates: Partial<ConditionConfig>) => {
      updateDraft((current) => {
        current.rules.conditions = current.rules.conditions ?? [];
        const target = current.rules.conditions[index];
        if (!target) {
          return current;
        }

        current.rules.conditions[index] = normalizeCondition(
          {
            ...target,
            ...updates,
          },
          index,
        );
        return current;
      });
    },
    [updateDraft],
  );

  const addCondition = useCallback(() => {
    updateDraft((current) => {
      current.rules.conditions = current.rules.conditions ?? [];
      current.rules.conditions.push({
        id: generateId("condition"),
        name: `状态 ${current.rules.conditions.length + 1}`,
        description: "",
      });
      current.rules.conditions = current.rules.conditions.map((item, index) =>
        normalizeCondition(item, index),
      );
      return current;
    });
  }, [updateDraft]);

  const removeCondition = useCallback(
    (index: number) => {
      updateDraft((current) => {
        if (!current.rules.conditions?.[index]) {
          return current;
        }

        current.rules.conditions.splice(index, 1);
        current.rules.conditions = current.rules.conditions.map(
          (item, itemIndex) => normalizeCondition(item, itemIndex),
        );
        return current;
      });
    },
    [updateDraft],
  );

  const updateTalentRules = useCallback(
    (updates: Partial<EditableTalentRules>) => {
      updateDraft((current) => {
        current.rules.talentRules = normalizeTalentRules({
          ...(current.rules.talentRules ?? {}),
          ...updates,
        });
        return current;
      });
    },
    [updateDraft],
  );

  const updateTalent = useCallback(
    (index: number, updates: Partial<TalentConfig>) => {
      updateDraft((current) => {
        const target = current.rules.talents?.[index];
        if (!target) {
          return current;
        }

        current.rules.talents![index] = normalizeTalent(
          {
            ...target,
            ...updates,
          },
          index,
        );
        return current;
      });
    },
    [updateDraft],
  );

  const addTalent = useCallback(() => {
    updateDraft((current) => {
      current.rules.talents = current.rules.talents ?? [];
      current.rules.talents.push({
        id: generateId("talent"),
        name: `天赋 ${current.rules.talents.length + 1}`,
        description: "",
        category: "misc",
      });
      return current;
    });
  }, [updateDraft]);

  const removeTalent = useCallback(
    (index: number) => {
      updateDraft((current) => {
        if (!current.rules.talents?.[index]) {
          return current;
        }

        current.rules.talents.splice(index, 1);
        return current;
      });
    },
    [updateDraft],
  );

  return {
    worlds,
    activeWorldId,
    selectedWorldId,
    selectedWorld,
    draft,
    isDirty,
    isSaving,
    isLoadingWorld,
    rawRulesEditorOpen,
    rawRulesEditorScope,
    rawRulesText,
    rawRulesError,
    mobilePage,
    validationMessages,
    selectWorld,
    setActiveWorld,
    createWorld,
    deleteWorld,
    confirmDeleteWorld,
    cancelDeleteWorld,
    saveSelectedWorld,
    resetDraft,
    setMobilePage,
    openRawRulesEditor,
    closeRawRulesEditor,
    setRawRulesText,
    applyRawRulesText,
    exportSelectedWorld,
    importWorldFromFile,
    updateMeta,
    updateNarrative,
    updatePrimaryAttribute,
    addPrimaryAttribute,
    removePrimaryAttribute,
    updatePointBuyRules,
    updateCheckRules,
    addDcPreset,
    updateDcPreset,
    removeDcPreset,
    addOpposedPreset,
    updateOpposedPreset,
    removeOpposedPreset,
    addDCGuidelineItem,
    updateDCGuidelineItem,
    removeDCGuidelineItem,
    updateDerivedStat,
    addDerivedStat,
    removeDerivedStat,
    updateDimension,
    addDimension,
    removeDimension,
    updateDimensionOption,
    addDimensionOption,
    removeDimensionOption,
    updateCondition,
    addCondition,
    removeCondition,
    updateTalentRules,
    updateTalent,
    addTalent,
    removeTalent,
    pendingDeleteWorld,
    discardConfirm: {
      open: discardConfirm.open,
      message: discardConfirm.message,
    },
    handleConfirmDiscard,
    handleCancelDiscard,
  };
}
