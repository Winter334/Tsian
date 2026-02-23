import type { ValueExpression } from "@/domain/types/rule-script";
import { preprocessDiceInExpression } from "@/lib/rules/dice";

const MAX_EXPRESSION_LENGTH = 500;

const NUMERIC_TOKEN_REGEX =
  /\s+|\d+(?:\.\d+)?|[\p{L}_][\p{L}\p{N}_]*(?:\.[\p{L}_][\p{L}\p{N}_]*)?|[()+\-*/]/gu;
const NUMBER_TOKEN_REGEX = /^\d+(?:\.\d+)?$/;
const IDENTIFIER_TOKEN_REGEX =
  /^[\p{L}_][\p{L}\p{N}_]*(?:\.[\p{L}_][\p{L}\p{N}_]*)?$/u;
const OPERATOR_TOKEN_REGEX = /^[()+\-*/]$/;

export interface EvaluationContext {
  /** 当前行动实体的属性 */
  actorAttributes?: Record<string, number>;
  /** 变量存储（resultVar 存储的值） */
  vars?: Record<string, number | boolean>;
  /** 通过实体 ID 获取属性的函数 */
  getEntityAttributes?: (
    entityId: string,
  ) => Record<string, number> | undefined;
}

function assertExpressionLength(expression: string, label: string): void {
  if (expression.length > MAX_EXPRESSION_LENGTH) {
    throw new Error(
      `${label} 长度超限（${expression.length} > ${MAX_EXPRESSION_LENGTH}）`,
    );
  }
}

function assertNestingDepth(expr: string, maxDepth: number = 10): void {
  let depth = 0;
  for (const ch of expr) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (depth > maxDepth) {
      throw new Error(
        `Expression nesting depth exceeds maximum of ${maxDepth}`,
      );
    }
  }
}

function escapeForLiteral(input: string): string {
  return input.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function toFiniteNumber(value: unknown, errorPrefix: string): number {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error(`${errorPrefix}：数值非有限值 (${value})`);
    }
    return value;
  }

  if (typeof value === "boolean") {
    return value ? 1 : 0;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  throw new Error(`${errorPrefix}：无法转换为数字 (${String(value)})`);
}

function splitEntityField(identifier: string): [string, string] {
  const segments = identifier.split(".");
  if (segments.length !== 2) {
    throw new Error(`非法属性引用：${identifier}`);
  }
  return [segments[0], segments[1]];
}

function compileNumericExpression(
  expression: string,
  mapIdentifier: (identifier: string) => string,
): string {
  assertNestingDepth(expression);

  const compiledTokens: string[] = [];
  let cursor = 0;

  for (const match of expression.matchAll(NUMERIC_TOKEN_REGEX)) {
    const rawToken = match[0];
    const index = match.index ?? -1;

    if (index !== cursor) {
      const unexpected = expression.slice(cursor, index);
      throw new Error(`表达式存在非法片段："${unexpected}"`);
    }

    cursor = index + rawToken.length;

    if (/^\s+$/u.test(rawToken)) {
      continue;
    }

    if (
      NUMBER_TOKEN_REGEX.test(rawToken) ||
      OPERATOR_TOKEN_REGEX.test(rawToken)
    ) {
      compiledTokens.push(rawToken);
      continue;
    }

    if (IDENTIFIER_TOKEN_REGEX.test(rawToken)) {
      compiledTokens.push(mapIdentifier(rawToken));
      continue;
    }

    throw new Error(`表达式中存在不支持的 token："${rawToken}"`);
  }

  if (cursor !== expression.length) {
    const unexpected = expression.slice(cursor);
    throw new Error(`表达式存在非法尾部："${unexpected}"`);
  }

  if (compiledTokens.length === 0) {
    throw new Error("表达式为空");
  }

  return compiledTokens.join(" ");
}

function resolveValueIdentifier(
  identifier: string,
  context: EvaluationContext,
): number {
  if (identifier.includes(".")) {
    const [entityId, field] = splitEntityField(identifier);
    const attributes =
      entityId === "self" || entityId === "actor"
        ? context.actorAttributes
        : context.getEntityAttributes?.(entityId);

    if (!attributes) {
      throw new Error(`找不到实体属性：${entityId}`);
    }

    const value = attributes[field];
    if (value === undefined) {
      throw new Error(`实体 "${entityId}" 不存在属性 "${field}"`);
    }

    return toFiniteNumber(value, `属性引用 "${identifier}" 解析失败`);
  }

  const actorValue = context.actorAttributes?.[identifier];
  if (actorValue !== undefined) {
    return actorValue;
  }

  const variableValue = context.vars?.[identifier];
  if (variableValue !== undefined) {
    return toFiniteNumber(variableValue, `变量引用 "${identifier}" 解析失败`);
  }

  throw new Error(`无法解析标识符：${identifier}`);
}

/**
 * 解析 ValueExpression，返回数值结果
 *
 * @param expr - 值表达式（数字直接返回，字符串需要解析骰子/属性引用/变量）
 * @param context - 求值上下文（包含实体属性、变量等）
 * @returns 求值结果（数字）
 */
export function resolveValueExpression(
  expr: ValueExpression,
  context: EvaluationContext,
): number {
  if (typeof expr === "number") {
    if (!Number.isFinite(expr)) {
      throw new Error(`ValueExpression 数字无效：${expr}`);
    }
    return expr;
  }

  if (typeof expr === "boolean") {
    return expr ? 1 : 0;
  }

  assertExpressionLength(expr, "ValueExpression");

  const expressionWithDiceResolved = preprocessDiceInExpression(
    expr,
    Math.random,
  ).expression;

  const compiled = compileNumericExpression(
    expressionWithDiceResolved,
    (identifier) => `__resolve("${escapeForLiteral(identifier)}")`,
  );

  const evaluator = new Function(
    "__resolve",
    `"use strict"; return (${compiled});`,
  ) as (resolve: (identifier: string) => number) => unknown;

  const result = evaluator((identifier) =>
    resolveValueIdentifier(identifier, context),
  );

  return toFiniteNumber(result, "ValueExpression 求值失败");
}

/**
 * 求值 DC 公式（用于 check.dcFormula）
 *
 * @param formula - DC 公式字符串（如 "target.ac", "8 + target.proficiency + target.wis_mod"）
 * @param targetAttributes - DC 目标实体的属性 map
 * @returns DC 数值
 */
export function evaluateDCFormula(
  formula: string,
  targetAttributes: Record<string, number>,
): number {
  assertExpressionLength(formula, "DC 公式");

  const compiled = compileNumericExpression(formula, (identifier) => {
    if (identifier.includes(".")) {
      const [root, field] = splitEntityField(identifier);
      if (root !== "target") {
        throw new Error(`DC 公式仅允许引用 target.xxx，收到：${identifier}`);
      }
      return `__target("${escapeForLiteral(field)}")`;
    }

    // 纯属性名简写：ac 等价于 target.ac
    return `__target("${escapeForLiteral(identifier)}")`;
  });

  const evaluator = new Function(
    "__target",
    `"use strict"; return (${compiled});`,
  ) as (resolveTargetField: (field: string) => number) => unknown;

  const result = evaluator((field) => {
    const value = targetAttributes[field];
    if (value === undefined) {
      throw new Error(`DC 公式引用了不存在的 target 属性：${field}`);
    }
    return value;
  });

  return toFiniteNumber(result, "DC 公式求值失败");
}
