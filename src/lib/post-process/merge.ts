import type { PostProcessRule } from "./types";

/**
 * 合并内置规则与预设规则
 *
 * 合并策略：
 * - 无 presetRules 时返回内置规则副本
 * - preset 中 source="builtin" 的规则仅用于覆盖同 id 内置规则的 enabled/order
 * - preset 中 source="user" 的规则按原样追加
 * - 结果按 order 升序排序
 *
 * @param builtinRules 内置规则
 * @param presetRules 预设规则（可选）
 * @returns 合并后的规则列表（新数组）
 */
export function mergeRules(
  builtinRules: PostProcessRule[],
  presetRules?: PostProcessRule[],
): PostProcessRule[] {
  if (!presetRules || presetRules.length === 0) {
    return cloneRules(builtinRules).sort((a, b) => a.order - b.order);
  }

  const builtinOverrides = new Map<string, PostProcessRule>();
  const userRules: PostProcessRule[] = [];

  for (const rule of presetRules) {
    if (rule.source === "builtin") {
      builtinOverrides.set(rule.id, rule);
      continue;
    }

    userRules.push({ ...rule });
  }

  const mergedBuiltin = builtinRules.map((builtinRule) => {
    const override = builtinOverrides.get(builtinRule.id);
    if (!override) {
      return { ...builtinRule };
    }

    return {
      ...builtinRule,
      enabled: override.enabled,
      order: override.order,
    };
  });

  return [...mergedBuiltin, ...userRules].sort((a, b) => a.order - b.order);
}

/**
 * 克隆规则数组，避免外部引用被修改。
 */
function cloneRules(rules: PostProcessRule[]): PostProcessRule[] {
  return rules.map((rule) => ({ ...rule }));
}
