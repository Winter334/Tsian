import type { ItemCategory, ItemTemplate } from "@/domain/entities/item";
import type { SkillTemplate } from "@/domain/entities/skill";
import { DEFAULT_WORLD_CONFIG } from "@/lib/world";
import type {
  CharacterDimension,
  CheckRuleConfig,
  ConditionConfig,
  DerivedStatConfig,
  DimensionOption,
  EquipSlotDefinition,
  InventoryRulesConfig,
  PointBuyRules,
  PrimaryAttributeConfig,
  RewardPackage,
  TalentConfig,
  World,
  WorldConfig,
  WorldNarrativeSeed,
} from "@/lib/world/types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
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

const NUMERIC_LITERAL_REGEX = /^-?\d+(?:\.\d+)?$/;

function toStringNumberValue(value: unknown): number | string | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const text = toOptionalString(value);
  if (!text) {
    return undefined;
  }

  return NUMERIC_LITERAL_REGEX.test(text) ? Number(text) : text;
}

function toStringNumberRecord(
  value: unknown,
): Record<string, number | string> | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const result: Record<string, number | string> = {};
  for (const [rawKey, entry] of Object.entries(value)) {
    const key = rawKey.trim();
    const nextValue = toStringNumberValue(entry);
    if (!key || nextValue === undefined) {
      continue;
    }

    result[key] = nextValue;
  }

  return Object.keys(result).length > 0 ? result : undefined;
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

type EditableDCPresets = NonNullable<CheckRuleConfig["dcPresets"]>;
type EditableDCPreset = EditableDCPresets[string];
type EditableOpposedPresets = NonNullable<CheckRuleConfig["opposedPresets"]>;
type EditableOpposedPreset = EditableOpposedPresets[string];
type EditableTalentRules = NonNullable<WorldConfig["talentRules"]>;
type EditableTalentRarity = NonNullable<
  EditableTalentRules["rarities"]
>[number];
type EditableTalentPool = NonNullable<EditableTalentRules["pools"]>[number];
type EditableTalentPityRule = NonNullable<EditableTalentRules["pity"]>[number];
type EditableLevelSystem = NonNullable<WorldConfig["levelSystem"]>;

export function extractFormulaIdentifiers(formula: string): string[] {
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

export function getDuplicateValues(values: string[]): string[] {
  const counts = new Map<string, number>();

  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .filter(([, count]) => count > 1)
    .map(([value]) => value);
}

export function normalizePrimaryAttribute(
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

export function normalizeDerivedStat(
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

export function normalizeDimensionOption(
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

export function normalizeDimension(
  value: unknown,
  index: number,
): CharacterDimension {
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

export function normalizePointBuyRules(
  value: unknown,
): PointBuyRules | undefined {
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

export function normalizeDCPreset(
  value: unknown,
  index: number,
): EditableDCPreset {
  const record = isRecord(value) ? value : {};
  const defaultSkill = toOptionalString(record.defaultSkill);

  return {
    label: toRequiredString(record.label, `DC 预设 ${index + 1}`),
    formula: toRequiredString(record.formula, "10"),
    ...(defaultSkill ? { defaultSkill } : {}),
  };
}

export function normalizeOpposedPreset(
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

export function normalizeCheckRules(value: unknown): CheckRuleConfig {
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

export function normalizeCondition(
  value: unknown,
  index: number,
): ConditionConfig {
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

export function normalizeTalentRarity(
  value: unknown,
  index: number,
): EditableTalentRarity {
  const record = isRecord(value) ? value : {};
  const colorToken = toOptionalString(record.colorToken);
  const glowToken = toOptionalString(record.glowToken);
  const minLevel = toOptionalPositiveInteger(record.minLevel);

  return {
    id: toRequiredString(record.id, `rarity_${index + 1}`),
    label: toRequiredString(record.label, `品质 ${index + 1}`),
    weight: toNumber(record.weight, 1),
    ...(colorToken ? { colorToken } : {}),
    ...(glowToken ? { glowToken } : {}),
    ...(minLevel === undefined ? {} : { minLevel }),
  };
}

export function normalizeTalentPool(
  value: unknown,
  index: number,
): EditableTalentPool {
  const record = isRecord(value) ? value : {};
  const label = toOptionalString(record.label);
  const allowedCategories = toUniqueStringArray(record.allowedCategories);
  const allowedRarities = toUniqueStringArray(record.allowedRarities);
  const includeTalentIds = toUniqueStringArray(record.includeTalentIds);
  const excludeTalentIds = toUniqueStringArray(record.excludeTalentIds);
  const minLevel = toOptionalPositiveInteger(record.minLevel);

  return {
    id: toRequiredString(record.id, `pool_${index + 1}`),
    ...(label ? { label } : {}),
    ...(allowedCategories.length > 0 ? { allowedCategories } : {}),
    ...(allowedRarities.length > 0 ? { allowedRarities } : {}),
    ...(includeTalentIds.length > 0 ? { includeTalentIds } : {}),
    ...(excludeTalentIds.length > 0 ? { excludeTalentIds } : {}),
    ...(minLevel === undefined ? {} : { minLevel }),
  };
}

export function normalizeTalentPityRule(
  value: unknown,
  index: number,
): EditableTalentPityRule {
  const record = isRecord(value) ? value : {};

  return {
    afterMisses: toOptionalNonNegativeInteger(record.afterMisses) ?? 1,
    guaranteeRarity: toRequiredString(
      record.guaranteeRarity,
      `rarity_${index + 1}`,
    ),
  };
}

function normalizeTalentDraw(value: unknown): TalentConfig["draw"] | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const weight = toOptionalNumber(value.weight);
  const poolIds = toUniqueStringArray(value.poolIds);
  const minLevel = toOptionalPositiveInteger(value.minLevel);

  if (weight === undefined && poolIds.length === 0 && minLevel === undefined) {
    return undefined;
  }

  return {
    ...(weight === undefined ? {} : { weight }),
    ...(poolIds.length > 0 ? { poolIds } : {}),
    ...(minLevel === undefined ? {} : { minLevel }),
  };
}

export function normalizeTalentRules(
  value: unknown,
): WorldConfig["talentRules"] | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const initialDrawCount = toOptionalNonNegativeInteger(value.initialDrawCount);
  const initialOffersPerDraw = toOptionalPositiveInteger(
    value.initialOffersPerDraw,
  );
  const allowAcquireDuringGame =
    typeof value.allowAcquireDuringGame === "boolean"
      ? value.allowAcquireDuringGame
      : undefined;
  const freeDrawAttributeKey = toOptionalString(value.freeDrawAttributeKey);
  const drawPointAttributeKey = toOptionalString(value.drawPointAttributeKey);
  const drawPointCost = toOptionalNonNegativeInteger(value.drawPointCost);
  const duplicatePolicy =
    value.duplicatePolicy === "exclude_owned" ||
    value.duplicatePolicy === "allow_repeat"
      ? value.duplicatePolicy
      : undefined;
  const rarities = Array.isArray(value.rarities)
    ? value.rarities.map((item, index) => normalizeTalentRarity(item, index))
    : [];
  const pools = Array.isArray(value.pools)
    ? value.pools.map((item, index) => normalizeTalentPool(item, index))
    : [];
  const pity = Array.isArray(value.pity)
    ? value.pity.map((item, index) => normalizeTalentPityRule(item, index))
    : [];

  if (
    initialDrawCount === undefined &&
    initialOffersPerDraw === undefined &&
    allowAcquireDuringGame === undefined &&
    freeDrawAttributeKey === undefined &&
    drawPointAttributeKey === undefined &&
    drawPointCost === undefined &&
    duplicatePolicy === undefined &&
    rarities.length === 0 &&
    pools.length === 0 &&
    pity.length === 0
  ) {
    return undefined;
  }

  return {
    ...(initialDrawCount === undefined ? {} : { initialDrawCount }),
    ...(initialOffersPerDraw === undefined ? {} : { initialOffersPerDraw }),
    ...(allowAcquireDuringGame === undefined ? {} : { allowAcquireDuringGame }),
    ...(freeDrawAttributeKey ? { freeDrawAttributeKey } : {}),
    ...(drawPointAttributeKey ? { drawPointAttributeKey } : {}),
    ...(drawPointCost === undefined ? {} : { drawPointCost }),
    ...(duplicatePolicy === undefined ? {} : { duplicatePolicy }),
    ...(rarities.length > 0 ? { rarities } : {}),
    ...(pools.length > 0 ? { pools } : {}),
    ...(pity.length > 0 ? { pity } : {}),
  };
}

function toRewardPackageType(
  value: unknown,
): RewardPackage["type"] | undefined {
  return value === "attribute_points" ||
    value === "attribute_bonus" ||
    value === "free_talent_draw" ||
    value === "grant_talent" ||
    value === "skill_pick" ||
    value === "grant_skill" ||
    value === "grant_item"
    ? value
    : undefined;
}

function normalizeRewardPackage(value: unknown): RewardPackage | null {
  if (!isRecord(value)) {
    return null;
  }

  const type = toRewardPackageType(value.type);
  if (!type) {
    return null;
  }

  const points = toOptionalNonNegativeInteger(value.points);
  const attributes = toStringNumberRecord(value.attributes);
  const drawCount = toOptionalPositiveInteger(value.drawCount);
  const poolId = toOptionalString(value.poolId);
  const offersPerDraw = toOptionalPositiveInteger(value.offersPerDraw);
  const guaranteedRarity = toOptionalString(value.guaranteedRarity);
  const talentId = toOptionalString(value.talentId);
  const skillId = toOptionalString(value.skillId);
  const itemId = toOptionalString(value.itemId);
  const quantity = toOptionalPositiveInteger(value.quantity);

  return {
    type,
    ...(points === undefined ? {} : { points }),
    ...(attributes ? { attributes } : {}),
    ...(drawCount === undefined ? {} : { drawCount }),
    ...(poolId ? { poolId } : {}),
    ...(offersPerDraw === undefined ? {} : { offersPerDraw }),
    ...(guaranteedRarity ? { guaranteedRarity } : {}),
    ...(talentId ? { talentId } : {}),
    ...(skillId ? { skillId } : {}),
    ...(itemId ? { itemId } : {}),
    ...(quantity === undefined ? {} : { quantity }),
  };
}

function normalizeRewardPackageList(value: unknown): RewardPackage[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => normalizeRewardPackage(item))
    .filter((item): item is RewardPackage => item !== null);
}

export function normalizeLevelSystem(
  value: unknown,
  context: Pick<WorldConfig, "primaryAttributes" | "derivedStats">,
): EditableLevelSystem {
  const record = isRecord(value) ? value : {};
  const enabled = typeof record.enabled === "boolean" ? record.enabled : false;
  const levelAttributeKey = toRequiredString(record.levelAttributeKey, "level");
  const triggerModes = toUniqueStringArray(record.triggerModes).filter(
    (item): item is "narrative" | "manual" =>
      item === "narrative" || item === "manual",
  );
  const growthMode =
    record.growthMode === "allocation" ||
    record.growthMode === "hybrid" ||
    record.growthMode === "auto"
      ? record.growthMode
      : "auto";

  const progressRecord = isRecord(record.progress) ? record.progress : {};
  const thresholdMode =
    progressRecord.thresholdMode === "formula" ? "formula" : "table";
  const thresholdTable = Array.isArray(progressRecord.thresholdTable)
    ? progressRecord.thresholdTable.map((item, index) => {
        const threshold = isRecord(item) ? item : {};
        return {
          level: toOptionalPositiveInteger(threshold.level) ?? index + 1,
          requiredProgress:
            toOptionalNonNegativeInteger(threshold.requiredProgress) ?? 0,
        };
      })
    : [];
  const thresholdFormula = toOptionalString(progressRecord.thresholdFormula);
  const progressVisibility =
    progressRecord.visibility === "hidden" ||
    progressRecord.visibility === "detailed" ||
    progressRecord.visibility === "summary"
      ? progressRecord.visibility
      : "summary";

  const autoGrowthRecord = isRecord(record.autoGrowth) ? record.autoGrowth : {};
  const autoGrowthPerLevel =
    toStringNumberRecord(autoGrowthRecord.perLevel) ?? {};
  const milestoneGrowth = Array.isArray(autoGrowthRecord.milestoneGrowth)
    ? autoGrowthRecord.milestoneGrowth.map((item, index) => {
        const milestone = isRecord(item) ? item : {};
        return {
          level: toOptionalPositiveInteger(milestone.level) ?? index + 1,
          attributes: toStringNumberRecord(milestone.attributes) ?? {},
        };
      })
    : [];

  const allocationRecord = isRecord(record.allocation) ? record.allocation : {};
  const pointAttributeKey = toRequiredString(
    allocationRecord.pointAttributeKey,
    "unspent_attribute_points",
  );
  const defaultAllocatableAttributes = context.primaryAttributes
    .map((attribute) => attribute.key)
    .filter(
      (attributeKey) =>
        attributeKey !== levelAttributeKey &&
        attributeKey !== pointAttributeKey,
    );
  const allocatableAttributes =
    toUniqueStringArray(allocationRecord.allocatableAttributes).length > 0
      ? toUniqueStringArray(allocationRecord.allocatableAttributes)
      : defaultAllocatableAttributes;
  const pointsPerLevel =
    toStringNumberValue(allocationRecord.pointsPerLevel) ?? 1;

  const rewardsRecord = isRecord(record.rewards) ? record.rewards : {};
  const rewardMilestones = Array.isArray(rewardsRecord.milestones)
    ? rewardsRecord.milestones.map((item, index) => {
        const milestone = isRecord(item) ? item : {};
        return {
          level: toOptionalPositiveInteger(milestone.level) ?? index + 1,
          rewards: normalizeRewardPackageList(milestone.rewards),
        };
      })
    : [];

  const resourceRecoveryRecord = isRecord(record.resourceRecovery)
    ? record.resourceRecovery
    : {};
  const defaultResourceKeys = Array.from(
    new Set(
      context.derivedStats
        .filter((stat) => stat.isResource || stat.category === "resource")
        .map((stat) => stat.key),
    ),
  );
  const resourceKeys =
    toUniqueStringArray(resourceRecoveryRecord.resourceKeys).length > 0
      ? toUniqueStringArray(resourceRecoveryRecord.resourceKeys)
      : defaultResourceKeys;
  const resourceRecoveryMode =
    resourceRecoveryRecord.mode === "none" ||
    resourceRecoveryRecord.mode === "full" ||
    resourceRecoveryRecord.mode === "ratio" ||
    resourceRecoveryRecord.mode === "delta"
      ? resourceRecoveryRecord.mode
      : "delta";

  const narrativeRecord = isRecord(record.narrative) ? record.narrative : {};
  const narrativeVisibility =
    narrativeRecord.visibility === "hidden" ||
    narrativeRecord.visibility === "ceremony" ||
    narrativeRecord.visibility === "summary"
      ? narrativeRecord.visibility
      : "summary";

  return {
    enabled,
    levelAttributeKey,
    triggerModes:
      triggerModes.length > 0 ? triggerModes : ["narrative", "manual"],
    progress: {
      progressAttributeKey: toRequiredString(
        progressRecord.progressAttributeKey,
        "level_progress",
      ),
      thresholdMode,
      thresholdTable,
      ...(thresholdFormula ? { thresholdFormula } : {}),
      carryOverflow:
        typeof progressRecord.carryOverflow === "boolean"
          ? progressRecord.carryOverflow
          : true,
      visibility: progressVisibility,
    },
    growthMode,
    autoGrowth: {
      perLevel: autoGrowthPerLevel,
      milestoneGrowth,
    },
    allocation: {
      pointAttributeKey,
      allocatableAttributes,
      pointsPerLevel,
      ...(toOptionalNumber(allocationRecord.minPerAttribute) === undefined
        ? {}
        : {
            minPerAttribute: toOptionalNumber(allocationRecord.minPerAttribute),
          }),
      ...(toOptionalNumber(allocationRecord.maxPerAttribute) === undefined
        ? {}
        : {
            maxPerAttribute: toOptionalNumber(allocationRecord.maxPerAttribute),
          }),
      allowDeferredAllocation:
        typeof allocationRecord.allowDeferredAllocation === "boolean"
          ? allocationRecord.allowDeferredAllocation
          : true,
    },
    rewards: {
      autoApply:
        typeof rewardsRecord.autoApply === "boolean"
          ? rewardsRecord.autoApply
          : true,
      perLevel: normalizeRewardPackageList(rewardsRecord.perLevel),
      milestones: rewardMilestones,
    },
    resourceRecovery: {
      mode: resourceRecoveryMode,
      resourceKeys,
    },
    narrative: {
      allowAiTrigger:
        typeof narrativeRecord.allowAiTrigger === "boolean"
          ? narrativeRecord.allowAiTrigger
          : true,
      requirePlayerConfirmation:
        typeof narrativeRecord.requirePlayerConfirmation === "boolean"
          ? narrativeRecord.requirePlayerConfirmation
          : false,
      emitSystemLog:
        typeof narrativeRecord.emitSystemLog === "boolean"
          ? narrativeRecord.emitSystemLog
          : true,
      visibility: narrativeVisibility,
    },
  };
}

export function normalizeTalent(value: unknown, index: number): TalentConfig {
  const record = isRecord(value) ? value : {};
  const category = toOptionalString(record.category);
  const rarity = toOptionalString(record.rarity);
  const draw = normalizeTalentDraw(record.draw);

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
    ...(rarity ? { rarity } : {}),
    ...(draw ? { draw } : {}),
    modifiers: Array.isArray(record.modifiers)
      ? cloneValue(record.modifiers)
      : undefined,
  };
}

function toItemCategory(value: unknown): ItemCategory | undefined {
  return value === "weapon" ||
    value === "armor" ||
    value === "accessory" ||
    value === "consumable" ||
    value === "material" ||
    value === "quest" ||
    value === "misc"
    ? value
    : undefined;
}

export function normalizeEquipSlotDefinition(
  value: unknown,
  index: number,
): EquipSlotDefinition {
  const record = isRecord(value) ? value : {};
  const allowedCategories = Array.isArray(record.allowedCategories)
    ? Array.from(
        new Set(
          record.allowedCategories
            .map((item) => toItemCategory(item))
            .filter((item): item is ItemCategory => item !== undefined),
        ),
      )
    : [];
  const maxCount = toOptionalPositiveInteger(record.maxCount);

  return {
    id: toRequiredString(record.id, `equip_slot_${index + 1}`),
    label: toRequiredString(record.label, `槽位 ${index + 1}`),
    ...(allowedCategories.length > 0 ? { allowedCategories } : {}),
    ...(maxCount === undefined ? {} : { maxCount }),
  };
}

export function normalizeInventoryRules(
  value: unknown,
): InventoryRulesConfig | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const defaultCapacity = toOptionalPositiveInteger(value.defaultCapacity);
  const equipSlotDefinitions = Array.isArray(value.equipSlotDefinitions)
    ? value.equipSlotDefinitions.map((item, index) =>
        normalizeEquipSlotDefinition(item, index),
      )
    : [];

  if (defaultCapacity === undefined && equipSlotDefinitions.length === 0) {
    return undefined;
  }

  return {
    ...(defaultCapacity === undefined ? {} : { defaultCapacity }),
    ...(equipSlotDefinitions.length > 0 ? { equipSlotDefinitions } : {}),
  };
}

export function normalizeItemTemplate(
  value: unknown,
  index: number,
): ItemTemplate {
  const record = isRecord(value) ? value : {};
  const category = toOptionalString(record.category);
  const stackable =
    typeof record.stackable === "boolean" ? record.stackable : undefined;
  const maxStack = toOptionalPositiveInteger(record.maxStack);
  const equipSlot = toOptionalString(record.equipSlot);
  const consumable =
    typeof record.consumable === "boolean" ? record.consumable : undefined;

  return {
    id: toRequiredString(record.id, `item_template_${index + 1}`),
    name: toRequiredString(record.name, `物品 ${index + 1}`),
    description: toRequiredString(record.description, ""),
    category:
      category === "weapon" ||
      category === "armor" ||
      category === "accessory" ||
      category === "consumable" ||
      category === "material" ||
      category === "quest" ||
      category === "misc"
        ? category
        : "misc",
    ...(stackable === undefined ? {} : { stackable }),
    ...(stackable ? { maxStack: maxStack ?? 99 } : {}),
    ...(equipSlot ? { equipSlot } : {}),
    ...(consumable === undefined ? {} : { consumable }),
    ...(Array.isArray(record.effects)
      ? { effects: cloneValue(record.effects) }
      : {}),
  };
}

function normalizeSkillCost(value: unknown): SkillTemplate["cost"] | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const field = toOptionalString(value.field);
  const amount = toOptionalNumber(value.amount);
  if (!field || amount === undefined) {
    return undefined;
  }

  return { field, amount };
}

export function normalizeSkillTemplate(
  value: unknown,
  index: number,
): SkillTemplate {
  const record = isRecord(value) ? value : {};
  const category = toOptionalString(record.category);
  const maxLevel = toOptionalPositiveInteger(record.maxLevel);
  const activeUsable =
    typeof record.activeUsable === "boolean" ? record.activeUsable : undefined;
  const cost = normalizeSkillCost(record.cost);
  const rawPrerequisites = isRecord(record.prerequisites)
    ? record.prerequisites
    : undefined;
  const prerequisiteAttributes = toNumberRecord(rawPrerequisites?.attributes);
  const prerequisiteSkillIds = toUniqueStringArray(rawPrerequisites?.skillIds);
  const prerequisiteLevel = toOptionalPositiveInteger(rawPrerequisites?.level);
  const evolvesIntoRecord = isRecord(record.evolvesInto)
    ? record.evolvesInto
    : undefined;
  const evolvesIntoTemplateId = toOptionalString(evolvesIntoRecord?.templateId);
  const evolvesIntoName = toOptionalString(evolvesIntoRecord?.name);
  const evolvesIntoCondition = toOptionalString(evolvesIntoRecord?.condition);

  return {
    id: toRequiredString(record.id, `skill_template_${index + 1}`),
    name: toRequiredString(record.name, `技能 ${index + 1}`),
    description: toRequiredString(record.description, ""),
    category:
      category === "combat" ||
      category === "magic" ||
      category === "survival" ||
      category === "social" ||
      category === "craft" ||
      category === "misc"
        ? category
        : "misc",
    ...(maxLevel === undefined ? {} : { maxLevel }),
    ...(activeUsable === undefined ? {} : { activeUsable }),
    ...(cost ? { cost } : {}),
    ...(Array.isArray(record.effects)
      ? { effects: cloneValue(record.effects) }
      : {}),
    ...(prerequisiteAttributes ||
    prerequisiteSkillIds.length > 0 ||
    prerequisiteLevel !== undefined
      ? {
          prerequisites: {
            ...(prerequisiteAttributes
              ? { attributes: prerequisiteAttributes }
              : {}),
            ...(prerequisiteSkillIds.length > 0
              ? { skillIds: prerequisiteSkillIds }
              : {}),
            ...(prerequisiteLevel === undefined
              ? {}
              : { level: prerequisiteLevel }),
          },
        }
      : {}),
    ...(evolvesIntoTemplateId && evolvesIntoName
      ? {
          evolvesInto: {
            templateId: evolvesIntoTemplateId,
            name: evolvesIntoName,
            ...(evolvesIntoCondition
              ? { condition: evolvesIntoCondition }
              : {}),
          },
        }
      : {}),
  };
}

export function normalizeNarrative(value: unknown): WorldNarrativeSeed {
  const record = isRecord(value) ? value : {};

  return {
    script: toOptionalString(record.script),
    opening: toOptionalString(record.opening),
  };
}

export function isWorldConfig(value: unknown): value is WorldConfig {
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

export function normalizeWorldRules(
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
    levelSystem: normalizeLevelSystem(rules.levelSystem, {
      primaryAttributes,
      derivedStats,
    }),
    inventoryRules:
      rules.inventoryRules === undefined
        ? cloneValue(DEFAULT_WORLD_CONFIG.inventoryRules)
        : normalizeInventoryRules(rules.inventoryRules),
    itemTemplates: Array.isArray(rules.itemTemplates)
      ? rules.itemTemplates.map((item, index) =>
          normalizeItemTemplate(item, index),
        )
      : [],
    skillTemplates: Array.isArray(rules.skillTemplates)
      ? rules.skillTemplates.map((item, index) =>
          normalizeSkillTemplate(item, index),
        )
      : [],
  };
}

export function normalizeWorld(world: World): World {
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

export { cloneValue, isRecord, toNumber, toOptionalString, toRequiredString };
