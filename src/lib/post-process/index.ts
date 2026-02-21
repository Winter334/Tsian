import { BUILTIN_RULES } from "./builtin-rules";
import { mergeRules } from "./merge";
import { executePostProcessPipeline } from "./pipeline";
import type { PostProcessResult, PostProcessRule } from "./types";

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
  return executePostProcessPipeline(rawText, rules, "persist");
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
  return executePostProcessPipeline(text, rules, "render");
}
