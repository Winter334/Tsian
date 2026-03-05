import { BUILTIN_RULE_IDS } from "@/lib/prompt/constants";
import type { PostProcessRule } from "./types";

/**
 * 内置后处理规则
 */
export const BUILTIN_RULES: PostProcessRule[] = [
  {
    id: BUILTIN_RULE_IDS.MEMORY_SUMMARY,
    name: "Memory Summary 提取",
    description: "提取 <memory_summary> 标签内容，并从正文移除",
    pattern: "<memory_summary>([\\s\\S]*?)</memory_summary>",
    flags: "g",
    replacement: "",
    action: "extract-and-remove",
    extractKey: "miniSummary",
    phase: "persist",
    source: "builtin",
    enabled: true,
    order: 0,
  },
  {
    id: BUILTIN_RULE_IDS.CHOICES,
    name: "选项提取",
    description: "提取 <choices> 标签内容，并从正文移除",
    pattern: "<choices>([\\s\\S]*?)</choices>",
    flags: "g",
    replacement: "",
    action: "extract-and-remove",
    extractKey: "choices",
    phase: "render",
    source: "builtin",
    enabled: true,
    order: 0,
  },
];
