/**
 * 衍生属性计算引擎
 *
 * 根据 WorldConfig.derivedStats 的 formula 计算所有衍生属性值。
 * 支持依赖链：衍生属性可引用其他衍生属性（拓扑排序保证顺序）。
 */

import type { DerivedStatConfig } from "@/lib/world";
import type { ExpressionPrimitive } from "./expression";
import { evaluateExpression } from "./expression";

/**
 * 拓扑排序：按 dependencies 确定计算顺序
 * 如果存在循环依赖，抛出错误
 */
export function topologicalSortDerivedStats(
  stats: DerivedStatConfig[]
): DerivedStatConfig[] {
  const statMap = new Map<string, DerivedStatConfig>();
  for (const stat of stats) {
    statMap.set(stat.key, stat);
  }

  // 构建入度表和邻接表
  const inDegree = new Map<string, number>();
  const dependents = new Map<string, string[]>();

  for (const stat of stats) {
    inDegree.set(stat.key, 0);
    dependents.set(stat.key, []);
  }

  for (const stat of stats) {
    const deps = stat.dependencies ?? [];
    let count = 0;
    for (const dep of deps) {
      // 只关注衍生属性间的依赖（基础属性不参与排序）
      if (statMap.has(dep)) {
        count++;
        dependents.get(dep)!.push(stat.key);
      }
    }
    inDegree.set(stat.key, count);
  }

  // Kahn 算法
  const queue: string[] = [];
  for (const [key, deg] of inDegree) {
    if (deg === 0) queue.push(key);
  }

  const sorted: DerivedStatConfig[] = [];
  while (queue.length > 0) {
    const key = queue.shift()!;
    sorted.push(statMap.get(key)!);

    for (const dependent of dependents.get(key) ?? []) {
      const newDeg = inDegree.get(dependent)! - 1;
      inDegree.set(dependent, newDeg);
      if (newDeg === 0) queue.push(dependent);
    }
  }

  if (sorted.length !== stats.length) {
    const remaining = stats
      .filter((s) => !sorted.some((r) => r.key === s.key))
      .map((s) => s.key);
    throw new Error(`衍生属性存在循环依赖: ${remaining.join(", ")}`);
  }

  return sorted;
}

/**
 * 计算所有衍生属性
 *
 * @param baseFields - 基础属性（含 level 等）
 * @param derivedStats - 衍生属性配置
 * @param random - 可选的随机函数（用于公式中的骰子表达式）
 * @returns 基础 + 衍生的完整字段集
 */
export function computeDerivedStats(
  baseFields: Record<string, number | string | boolean>,
  derivedStats: DerivedStatConfig[],
  random?: () => number
): Record<string, number | string | boolean> {
  const result = { ...baseFields };

  if (derivedStats.length === 0) return result;

  const sorted = topologicalSortDerivedStats(derivedStats);

  for (const stat of sorted) {
    try {
      const evalResult = evaluateExpression(
        stat.formula,
        result as Record<string, ExpressionPrimitive>,
        random ?? Math.random
      );

      let value = typeof evalResult.value === "number" ? evalResult.value : 0;

      // 应用 min/max 约束
      if (stat.min !== undefined) value = Math.max(value, stat.min);
      if (stat.max !== undefined) value = Math.min(value, stat.max);

      result[stat.key] = value;
    } catch (e) {
      console.warn(
        `[DerivedStats] 计算衍生属性 "${stat.key}" 失败，使用默认值 0:`,
        e instanceof Error ? e.message : e
      );
      result[stat.key] = 0;
    }
  }

  return result;
}
