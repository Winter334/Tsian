/**
 * 资源字段工具函数
 *
 * 从 WorldConfig 的 derivedStats 中提取资源字段配对信息，
 * 消除硬编码的 "hp" / "max_hp" 等引用。
 */

import type { WorldConfig } from "./types";

/**
 * 从 WorldConfig 的 derivedStats 中提取资源字段配对
 * @returns 如 { hp: "max_hp", mp: "max_mp" }
 */
export function getResourcePairs(config: WorldConfig): Record<string, string> {
  const pairs: Record<string, string> = {};
  for (const stat of config.derivedStats) {
    if (stat.isResource && stat.maxField) {
      pairs[stat.key] = stat.maxField;
    }
  }
  return pairs;
}

/**
 * 获取默认资源字段名（第一个 isResource 且有 maxField 的字段）
 * @returns 如 "hp"，如果无资源字段配置则返回 "hp" 作为兜底
 */
export function getDefaultResourceField(config: WorldConfig): string {
  const first = config.derivedStats.find((s) => s.isResource && s.maxField);
  return first?.key ?? "hp";
}
