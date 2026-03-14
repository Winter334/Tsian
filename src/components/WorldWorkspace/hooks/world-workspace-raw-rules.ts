import { DEFAULT_WORLD_CONFIG } from "@/lib/world";
import type { World, WorldConfig } from "@/lib/world/types";

import {
  cloneValue,
  isRecord,
  isWorldConfig,
  normalizeCheckRules,
  normalizeCondition,
  normalizeDerivedStat,
  normalizeDimension,
  normalizeInventoryRules,
  normalizeItemTemplate,
  normalizeLevelSystem,
  normalizePointBuyRules,
  normalizePrimaryAttribute,
  normalizeSkillTemplate,
  normalizeTalent,
  normalizeTalentRules,
  normalizeWorld,
  normalizeWorldRules,
} from "./world-workspace-normalizers";
import type { WorldRulesEditorScope } from "./world-workspace-types";

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
type EditableRulesInventoryRulesSnapshot = Pick<WorldConfig, "inventoryRules">;
type EditableRulesItemTemplatesSnapshot = Pick<WorldConfig, "itemTemplates">;
type EditableRulesSkillTemplatesSnapshot = Pick<WorldConfig, "skillTemplates">;
type EditableRulesLevelSystemSnapshot = Pick<WorldConfig, "levelSystem">;

export const EMPTY_RULES_JSON = JSON.stringify(DEFAULT_WORLD_CONFIG, null, 2);

export function getRawRulesEditorPayload(
  rules: WorldConfig,
  scope: WorldRulesEditorScope,
):
  | WorldConfig
  | EditableRulesAttributesSnapshot
  | EditableRulesDerivedStatsSnapshot
  | EditableRulesCheckRulesSnapshot
  | EditableRulesConditionsSnapshot
  | EditableRulesDimensionsSnapshot
  | EditableRulesTalentsSnapshot
  | EditableRulesLevelSystemSnapshot
  | EditableRulesInventoryRulesSnapshot
  | EditableRulesItemTemplatesSnapshot
  | EditableRulesSkillTemplatesSnapshot {
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
    case "level-system":
      return {
        levelSystem: cloneValue(
          normalizeLevelSystem(rules.levelSystem, {
            primaryAttributes: rules.primaryAttributes,
            derivedStats: rules.derivedStats,
          }),
        ),
      };
    case "inventoryRules":
      return {
        inventoryRules: cloneValue(rules.inventoryRules ?? {}),
      };
    case "itemTemplates":
      return {
        itemTemplates: cloneValue(rules.itemTemplates ?? []),
      };
    case "skillTemplates":
      return {
        skillTemplates: cloneValue(rules.skillTemplates ?? []),
      };
    case "full":
    default:
      return cloneValue(rules);
  }
}

export function getRawRulesEditorText(
  rules: WorldConfig,
  scope: WorldRulesEditorScope,
): string {
  return JSON.stringify(getRawRulesEditorPayload(rules, scope), null, 2);
}

export function getRawRulesEditorTextFromWorld(
  world: World | null,
  scope: WorldRulesEditorScope,
): string {
  if (!world) {
    return scope === "full"
      ? EMPTY_RULES_JSON
      : getRawRulesEditorText(DEFAULT_WORLD_CONFIG, scope);
  }

  return getRawRulesEditorText(normalizeWorld(world).rules, scope);
}

export function applyRawRulesEditorPayload(
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

    case "level-system":
      if (!isRecord(parsed.levelSystem)) {
        throw new Error("等级系统分区必须包含 levelSystem 对象");
      }

      nextRules.levelSystem = normalizeLevelSystem(parsed.levelSystem, {
        primaryAttributes: nextRules.primaryAttributes,
        derivedStats: nextRules.derivedStats,
      });
      break;

    case "inventoryRules":
      if (!isRecord(parsed.inventoryRules)) {
        throw new Error("装备系统分区必须包含 inventoryRules 对象");
      }

      nextRules.inventoryRules = normalizeInventoryRules(parsed.inventoryRules);
      break;

    case "itemTemplates":
      if (!Array.isArray(parsed.itemTemplates)) {
        throw new Error("物品模板分区必须包含 itemTemplates 数组");
      }

      nextRules.itemTemplates = parsed.itemTemplates.map((item, index) =>
        normalizeItemTemplate(item, index),
      );
      break;

    case "skillTemplates":
      if (!Array.isArray(parsed.skillTemplates)) {
        throw new Error("技能模板分区必须包含 skillTemplates 数组");
      }

      nextRules.skillTemplates = parsed.skillTemplates.map((item, index) =>
        normalizeSkillTemplate(item, index),
      );
      break;
  }

  return normalizeWorldRules(world.id, world.meta.name, nextRules);
}
