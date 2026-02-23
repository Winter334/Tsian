import type { CheckAction } from "@/domain/types/rule-script";
import {
  evaluateDCFormula,
  resolveValueExpression,
  type EvaluationContext,
} from "@/lib/rules/formula-evaluator";
import type { WorldConfig } from "@/lib/world";

interface DCPreset {
  label: string;
  formula: string;
  defaultSkill?: string;
}

interface OpposedPreset {
  label: string;
  attackerSkill: string;
  defenderSkill: string;
}

interface ExtendedCheckRules {
  dcPresets?: Record<string, DCPreset>;
  opposedPresets?: Record<string, OpposedPreset>;
}

export type DCResolution =
  | { type: "standard"; dc: number }
  | { type: "opposed"; opposedEntityId: string; opposedSkill: string };

/**
 * 展开预设配置到 CheckAction 中
 * 将 preset 名称转换为具体的 skill/dcSource/dcFormula 等字段
 *
 * @param action - 原始 check action（可能带 preset）
 * @param checkRules - WorldConfig.checkRules
 * @returns 展开后的 check action（不含 preset，包含完整字段）
 */
export function expandPreset(
  action: CheckAction,
  checkRules?: WorldConfig["checkRules"],
): CheckAction {
  if (!action.preset) {
    return action;
  }

  const extendedRules = checkRules as ExtendedCheckRules | undefined;
  const presetName = action.preset;

  const dcPreset = extendedRules?.dcPresets?.[presetName];
  if (dcPreset) {
    return {
      ...action,
      preset: undefined,
      skill: action.skill || dcPreset.defaultSkill || presetName,
      dcSource: action.dcSource ?? "formula",
      dcFormula: action.dcFormula ?? dcPreset.formula,
    };
  }

  const opposedPreset = extendedRules?.opposedPresets?.[presetName];
  if (opposedPreset) {
    return {
      ...action,
      preset: undefined,
      skill: action.skill || opposedPreset.attackerSkill,
      dcSource: action.dcSource ?? "opposed",
      opposedSkill: action.opposedSkill ?? opposedPreset.defenderSkill,
    };
  }

  return {
    ...action,
    preset: undefined,
  };
}

function resolveEntityAttributes(
  context: EvaluationContext,
  rawEntityId: string | undefined,
): Record<string, number> | undefined {
  if (!rawEntityId) {
    return undefined;
  }

  if (rawEntityId === "self" || rawEntityId === "actor") {
    return context.actorAttributes;
  }

  if (rawEntityId === "target") {
    return context.getEntityAttributes?.("target");
  }

  return context.getEntityAttributes?.(rawEntityId);
}

/**
 * 解析 check action 的 DC
 *
 * @param action - check action（已经过预设展开）
 * @param context - 求值上下文
 * @returns DC 解析结果
 */
export function resolveDC(
  action: CheckAction,
  context: EvaluationContext,
): DCResolution {
  const dcSource = action.dcSource ?? "ai";

  switch (dcSource) {
    case "formula": {
      if (!action.dcFormula) {
        throw new Error("dcSource=formula 时必须提供 dcFormula");
      }

      const formulaTargetId = action.dcTarget ?? action.target;
      if (!formulaTargetId) {
        throw new Error("dcSource=formula 时必须提供 dcTarget 或 target");
      }

      const targetAttributes = resolveEntityAttributes(
        context,
        formulaTargetId,
      );
      if (!targetAttributes) {
        throw new Error(
          `dcSource=formula 时找不到目标实体属性：${formulaTargetId}`,
        );
      }

      return {
        type: "standard",
        dc: evaluateDCFormula(action.dcFormula, targetAttributes),
      };
    }

    case "opposed": {
      if (!action.opposedEntity) {
        throw new Error("dcSource=opposed 时必须提供 opposedEntity");
      }
      if (!action.opposedSkill) {
        throw new Error("dcSource=opposed 时必须提供 opposedSkill");
      }

      return {
        type: "opposed",
        opposedEntityId: action.opposedEntity,
        opposedSkill: action.opposedSkill,
      };
    }

    case "fixed": {
      if (action.fixedDC === undefined) {
        throw new Error("dcSource=fixed 时必须提供 fixedDC");
      }

      return {
        type: "standard",
        dc: action.fixedDC,
      };
    }

    case "ai":
    default: {
      if (action.dc === undefined) {
        throw new Error("dcSource=ai 时必须提供 dc");
      }

      return {
        type: "standard",
        dc: resolveValueExpression(action.dc, context),
      };
    }
  }
}
