/**
 * 统一属性计算管线
 *
 * UI 和引擎都调用此函数，保证数据一致。
 * 支持基础属性覆盖、统一被动修正（scope=stat）与衍生属性计算。
 */

import type { PassiveModifier } from "@/domain/types/rule-script";
import { computeDerivedStats } from "@/lib/rules/derived-stats";
import type { DerivedStatConfig, PrimaryAttributeConfig } from "@/lib/world";
import { resolveValueExpression } from "./formula-evaluator";

export interface StatsComputeInput {
  /** 角色基础属性（从 character.attributes 或 overrides 来） */
  baseAttributes: Record<string, unknown>;
  /** 世界配置中的基础属性定义（提供默认值） */
  primaryAttributes: PrimaryAttributeConfig[];
  /** 世界配置中的衍生属性公式 */
  derivedStats: DerivedStatConfig[];
  /** 统一的被动修正列表（来自装备/天赋/buff，调用方负责收集） */
  passiveModifiers?: PassiveModifier[];
}

function isPrimitiveAttributeValue(
  value: unknown,
): value is number | string | boolean {
  return (
    typeof value === "number" ||
    typeof value === "string" ||
    typeof value === "boolean"
  );
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function pickNumericFields(
  fields: Record<string, number | string | boolean>,
): Record<string, number> {
  const numericFields: Record<string, number> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (isFiniteNumber(value)) {
      numericFields[key] = value;
    }
  }
  return numericFields;
}

export function computeFullStats<T extends StatsComputeInput>(
  input: T,
): Record<string, number> {
  const baseFields: Record<string, number | string | boolean> = {};

  // 1) 先用 primaryAttributes.defaultValue 构建默认基础属性
  for (const attr of input.primaryAttributes) {
    baseFields[attr.key] = attr.defaultValue;
  }

  // 2) 再用 baseAttributes 覆盖（仅接收 number/string/boolean）
  for (const [key, value] of Object.entries(input.baseAttributes)) {
    if (isPrimitiveAttributeValue(value)) {
      baseFields[key] = value;
    }
  }

  // 3) 统一被动修正（passiveModifiers）
  // 仅处理 scope=stat 的加算值；支持 number 与 string(ValueExpression)。
  if (input.passiveModifiers) {
    for (const modifier of input.passiveModifiers) {
      if (modifier.scope !== "stat" || !modifier.field) continue;

      let delta: number;
      if (isFiniteNumber(modifier.value)) {
        delta = modifier.value;
      } else if (typeof modifier.value === "string") {
        try {
          delta = resolveValueExpression(modifier.value, {
            actorAttributes: pickNumericFields(baseFields),
          });
        } catch (error) {
          const reason = error instanceof Error ? error.message : String(error);
          console.warn(
            `[computeFullStats] 跳过被动表达式修正：field="${modifier.field}", expression="${modifier.value}", reason="${reason}"`,
          );
          continue;
        }
      } else {
        continue;
      }

      const currentValue = baseFields[modifier.field];
      const baseValue = isFiniteNumber(currentValue) ? currentValue : 0;
      baseFields[modifier.field] = baseValue + delta;
    }
  }

  // 4) 计算衍生属性
  const computed = computeDerivedStats(baseFields, input.derivedStats);

  // 5) 资源字段保护合并
  for (const stat of input.derivedStats) {
    if (!stat.isResource || !stat.maxField) continue;

    // current：优先保留 baseAttributes 中已被运行时修改的值
    const attrCurrent = input.baseAttributes[stat.key];
    if (isFiniteNumber(attrCurrent)) {
      computed[stat.key] = attrCurrent;
    }

    // max：优先使用公式计算结果，缺失时回退 baseAttributes
    const computedMax = computed[stat.maxField];
    if (!isFiniteNumber(computedMax)) {
      const attrMax = input.baseAttributes[stat.maxField];
      if (isFiniteNumber(attrMax)) {
        computed[stat.maxField] = attrMax;
      }
    }
  }

  // 6) 仅返回纯数值映射
  const fullStats: Record<string, number> = {};
  for (const [key, value] of Object.entries(computed)) {
    if (isFiniteNumber(value)) {
      fullStats[key] = value;
    }
  }

  return fullStats;
}
