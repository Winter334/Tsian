/**
 * Prompt v2 P0 协议冻结常量
 */

import type { PresetPurpose } from "./types";

/** 冻结的四种预设用途（与 PresetPurpose 语义对齐） */
export const PRESET_PURPOSES = [
  "narrative",
  "parser",
  "summarizer",
  "director",
] as const satisfies readonly PresetPurpose[];

/** 冻结的内置后处理规则 ID */
export const BUILTIN_RULE_IDS = {
  MEMORY_SUMMARY: "builtin:memory-summary",
  CHOICES: "builtin:choices",
} as const;

/** 冻结的标签路径 */
export const EXTRACT_TAG_PATHS = {
  MEMORY_SUMMARY: "memory_summary",
  CHOICES: "choices",
} as const;
