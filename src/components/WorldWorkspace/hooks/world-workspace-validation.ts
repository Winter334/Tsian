import { topologicalSortDerivedStats } from "@/lib/rules/derived-stats";
import {
  evaluateExpression,
  type ExpressionPrimitive,
} from "@/lib/rules/expression";
import type { World } from "@/lib/world/types";

import {
  extractFormulaIdentifiers,
  getDuplicateValues,
} from "./world-workspace-normalizers";

export function buildWorldValidationMessages(draft: World | null): string[] {
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
    messages.push(`衍生属性存在重复 key：${duplicateDerivedKeys.join("、")}。`);
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
        messages.push(`资源型衍生属性 ${statLabel} 的 maxField 不能指向自身。`);
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

  const talentInitialDrawCount = draft.rules.talentRules?.initialDrawCount;
  if (
    talentInitialDrawCount !== undefined &&
    (!Number.isInteger(talentInitialDrawCount) || talentInitialDrawCount < 0)
  ) {
    messages.push("天赋规则的初始抽取次数必须是大于等于 0 的整数。");
  }

  if ((draft.rules.talents ?? []).length === 0) {
    messages.push("当前世界没有可选天赋，角色创建流程会跳过天赋步骤。");
  }

  return messages;
}
