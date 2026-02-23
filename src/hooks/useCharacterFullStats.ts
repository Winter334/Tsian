import { useMemo } from "react";

import type { Character } from "@/domain/entities/character";
import { computeDerivedStats } from "@/lib/rules/derived-stats";
import type { WorldConfig } from "@/lib/world/types";

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * 计算角色完整属性（基础 + 衍生），并对资源字段执行保护合并。
 *
 * 合并规则：
 * - current（资源当前值）：优先保留 attributes 中已被运行时修改的值
 * - max（资源上限）：优先使用公式计算结果，缺失时回退 attributes
 */
export function useCharacterFullStats(
  character: Character | null,
  worldConfig: WorldConfig,
): Record<string, number> {
  return useMemo(() => {
    if (!character) {
      return {};
    }

    const attributes = character.attributes ?? {};
    const baseFields: Record<string, number | string | boolean> = {};

    for (const [key, value] of Object.entries(attributes)) {
      if (
        typeof value === "number" ||
        typeof value === "string" ||
        typeof value === "boolean"
      ) {
        baseFields[key] = value;
      }
    }

    const computed = computeDerivedStats(baseFields, worldConfig.derivedStats);

    for (const stat of worldConfig.derivedStats) {
      if (!stat.isResource || !stat.maxField) continue;

      const attrCurrent = attributes[stat.key];
      if (isFiniteNumber(attrCurrent)) {
        computed[stat.key] = attrCurrent;
      }

      const computedMax = computed[stat.maxField];
      if (!isFiniteNumber(computedMax)) {
        const attrMax = attributes[stat.maxField];
        if (isFiniteNumber(attrMax)) {
          computed[stat.maxField] = attrMax;
        }
      }
    }

    const fullStats: Record<string, number> = {};
    for (const [key, value] of Object.entries(computed)) {
      if (isFiniteNumber(value)) {
        fullStats[key] = value;
      }
    }

    return fullStats;
  }, [character, worldConfig.derivedStats]);
}
