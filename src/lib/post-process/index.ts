import { BUILTIN_RULES } from "./builtin-rules";
import { mergeRules } from "./merge";
import { executePostProcessPipeline } from "./pipeline";
import type {
  PostProcessInput,
  PostProcessOutput,
  PostProcessResult,
  PostProcessRule,
} from "./types";

export { BUILTIN_RULES } from "./builtin-rules";
export { mergeRules } from "./merge";
export { executePostProcessPipeline } from "./pipeline";
export {
  convertTavernRegex,
  generateRuleId,
  importTavernRegexScripts,
  isTavernRegexScript,
  parseTavernRegex,
  type TavernRegexImportResult,
  type TavernRegexScript,
} from "./tavern-import";
export type {
  PostProcessAction,
  PostProcessInput,
  PostProcessOutput,
  PostProcessPhase,
  PostProcessResult,
  PostProcessRule,
  PostProcessRuleSource,
} from "./types";
export {
  validatePostProcessRule,
  validateRegexPattern,
  type PostProcessRuleValidationResult,
  type RegexValidationResult,
} from "./validate";

/**
 * 统一后处理中枢入口（Prompt v2 Phase 1）。
 */
export function postProcess(input: PostProcessInput): PostProcessOutput {
  const { rawText, rules, phase } = input;
  return executePostProcessPipeline(rawText, rules, phase);
}

/**
 * 持久化阶段后处理便捷入口。
 *
 * @param rawText 原始文本
 * @param presetRules 预设规则（可选）
 */
export function postProcessForPersist(
  rawText: string,
  presetRules?: PostProcessRule[],
): PostProcessResult {
  const rules = mergeRules(BUILTIN_RULES, presetRules);
  return postProcess({
    rawText,
    phase: "persist",
    rules,
  });
}

/**
 * 渲染阶段后处理便捷入口。
 *
 * @param text 待渲染文本
 * @param presetRules 预设规则（可选）
 */
export function postProcessForRender(
  text: string,
  presetRules?: PostProcessRule[],
): PostProcessResult {
  const rules = mergeRules(BUILTIN_RULES, presetRules);
  return postProcess({
    rawText: text,
    phase: "render",
    rules,
  });
}
