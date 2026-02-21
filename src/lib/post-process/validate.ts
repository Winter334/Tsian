import type {
  PostProcessAction,
  PostProcessPhase,
  PostProcessRule,
  PostProcessRuleSource,
} from "./types";

/**
 * 正则校验结果
 */
export interface RegexValidationResult {
  /** 是否有效 */
  valid: boolean;
  /** 错误信息（无错误时为空） */
  error?: string;
}

/**
 * 规则校验结果
 */
export interface PostProcessRuleValidationResult {
  /** 是否有效 */
  valid: boolean;
  /** 规则级错误列表 */
  errors: string[];
}

const VALID_ACTIONS: PostProcessAction[] = [
  "remove",
  "replace",
  "extract-and-remove",
];

const VALID_PHASES: PostProcessPhase[] = ["persist", "render"];

const VALID_SOURCES: PostProcessRuleSource[] = ["builtin", "user"];

/**
 * 校验正则模式与 flags 是否有效。
 *
 * @param pattern 正则模式（不含分隔符）
 * @param flags 正则 flags
 * @returns 校验结果
 */
export function validateRegexPattern(
  pattern: string,
  flags: string,
): RegexValidationResult {
  if (!hasText(pattern)) {
    return {
      valid: false,
      error: "正则 pattern 不能为空",
    };
  }

  try {
    new RegExp(pattern, flags);
    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: getErrorMessage(error),
    };
  }
}

/**
 * 校验后处理规则的结构与可执行性。
 *
 * 检查项：
 * - 必填字段（id/name/pattern/action/phase/source/enabled/order）
 * - action/phase/source 值是否合法
 * - extract-and-remove 时 extractKey 是否存在
 * - 正则本身是否可编译
 *
 * @param rule 待校验规则
 * @returns 校验结果（包含全部错误）
 */
export function validatePostProcessRule(
  rule: PostProcessRule,
): PostProcessRuleValidationResult {
  const errors: string[] = [];

  if (!hasText(rule.id)) {
    errors.push("字段 id 不能为空");
  }

  if (!hasText(rule.name)) {
    errors.push("字段 name 不能为空");
  }

  if (!hasText(rule.pattern)) {
    errors.push("字段 pattern 不能为空");
  }

  if (!VALID_ACTIONS.includes(rule.action)) {
    errors.push(`字段 action 非法：${String(rule.action)}`);
  }

  if (!VALID_PHASES.includes(rule.phase)) {
    errors.push(`字段 phase 非法：${String(rule.phase)}`);
  }

  if (!VALID_SOURCES.includes(rule.source)) {
    errors.push(`字段 source 非法：${String(rule.source)}`);
  }

  if (typeof rule.enabled !== "boolean") {
    errors.push("字段 enabled 必须为 boolean");
  }

  if (typeof rule.order !== "number" || !Number.isFinite(rule.order)) {
    errors.push("字段 order 必须为有限数字");
  }

  if (rule.action === "extract-and-remove" && !hasText(rule.extractKey)) {
    errors.push("action=extract-and-remove 时 extractKey 必填");
  }

  if (hasText(rule.pattern)) {
    const regexValidation = validateRegexPattern(rule.pattern, rule.flags);
    if (!regexValidation.valid) {
      errors.push(`正则无效：${regexValidation.error ?? "未知错误"}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

function hasText(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
