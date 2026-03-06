import { executePostProcessPipeline } from "./pipeline";
import type { PostProcessInput, PostProcessOutput } from "./types";

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
