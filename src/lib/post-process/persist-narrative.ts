import { BUILTIN_RULES } from "./builtin-rules";
import { mergeRules } from "./merge";
import { executePostProcessPipeline } from "./pipeline";
import type { PostProcessOutput, PostProcessRule } from "./types";

/**
 * 叙事文本在 persist 阶段的统一后处理结果。
 */
export interface PersistNarrativePostProcessResult {
  /** 清洗后的可落盘正文 */
  text: string;
  /** 从正文提取出的 miniSummary（若存在） */
  miniSummary?: string;
  /** 规则执行警告 */
  warnings: string[];
}

function extractMiniSummary(result: PostProcessOutput): string | undefined {
  const miniSummaryParts = result.extracted["miniSummary"];
  if (!miniSummaryParts || miniSummaryParts.length === 0) {
    return undefined;
  }

  const miniSummary = miniSummaryParts.join("\n");
  return miniSummary.length > 0 ? miniSummary : undefined;
}

/**
 * 统一执行叙事文本的 persist 后处理：
 * - 清洗可落盘正文
 * - 提取 miniSummary
 * - 返回规则警告
 */
export function postProcessNarrativeForPersist(input: {
  rawText: string;
  presetRules?: PostProcessRule[];
}): PersistNarrativePostProcessResult {
  const result = executePostProcessPipeline(
    input.rawText,
    mergeRules(BUILTIN_RULES, input.presetRules),
    "persist",
  );

  return {
    text: result.text,
    miniSummary: extractMiniSummary(result),
    warnings: result.warnings,
  };
}
