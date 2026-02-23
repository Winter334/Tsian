import type { ConditionExpression } from "@/domain/types/rule-script";
import type { EvaluationContext } from "@/lib/rules/formula-evaluator";

const MAX_EXPRESSION_LENGTH = 500;
const PREDICATE_PATTERN =
  /(hasTag|hasItem)\(\s*([\p{L}_][\p{L}\p{N}_]*)\s*,\s*'([^']*)'\s*\)/gu;
const CONDITION_TOKEN_REGEX =
  /\s+|&&|\|\||<=|>=|==|!=|<|>|!|\(|\)|\d+(?:\.\d+)?|\btrue\b|\bfalse\b|[\p{L}_][\p{L}\p{N}_]*(?:\.[\p{L}_][\p{L}\p{N}_]*)?/gu;
const NUMBER_TOKEN_REGEX = /^\d+(?:\.\d+)?$/;
const IDENTIFIER_TOKEN_REGEX =
  /^[\p{L}_][\p{L}\p{N}_]*(?:\.[\p{L}_][\p{L}\p{N}_]*)?$/u;
const BOOLEAN_TOKEN_REGEX = /^(true|false)$/;
const OPERATOR_TOKEN_REGEX = /^(?:&&|\|\||<=|>=|==|!=|<|>|!|\(|\))$/;

export interface ConditionContext extends EvaluationContext {
  /** 查询实体是否拥有标签 */
  hasTag?: (entityId: string, tag: string) => boolean;
  /** 查询实体是否拥有物品 */
  hasItem?: (entityId: string, itemName: string) => boolean;
}

function assertExpressionLength(expression: string): void {
  if (expression.length > MAX_EXPRESSION_LENGTH) {
    throw new Error(
      `ConditionExpression 长度超限（${expression.length} > ${MAX_EXPRESSION_LENGTH}）`,
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

function splitEntityField(identifier: string): [string, string] {
  const segments = identifier.split(".");
  if (segments.length !== 2) {
    throw new Error(`非法实体属性引用：${identifier}`);
  }
  return [segments[0], segments[1]];
}

function resolveIdentifier(
  identifier: string,
  context: ConditionContext,
): number | boolean {
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

    return value;
  }

  const variableValue = context.vars?.[identifier];
  if (variableValue !== undefined) {
    return variableValue;
  }

  const actorValue = context.actorAttributes?.[identifier];
  if (actorValue !== undefined) {
    return actorValue;
  }

  throw new Error(`无法解析标识符：${identifier}`);
}

function evaluatePredicate(
  predicateName: "hasTag" | "hasItem",
  entityId: string,
  arg: string,
  context: ConditionContext,
): boolean {
  if (predicateName === "hasTag") {
    return context.hasTag ? context.hasTag(entityId, arg) : false;
  }

  return context.hasItem ? context.hasItem(entityId, arg) : false;
}

function preprocessPredicates(
  expression: string,
  context: ConditionContext,
): {
  processedExpression: string;
  predicateValues: Record<string, boolean>;
} {
  const predicateValues: Record<string, boolean> = {};
  let index = 0;

  const processedExpression = expression.replace(
    PREDICATE_PATTERN,
    (_match, predicateName: string, entityId: string, arg: string) => {
      const placeholder = `__pred_${index}`;
      index += 1;

      if (predicateName === "hasTag" || predicateName === "hasItem") {
        predicateValues[placeholder] = evaluatePredicate(
          predicateName,
          entityId,
          arg,
          context,
        );
      } else {
        predicateValues[placeholder] = false;
      }

      return placeholder;
    },
  );

  return {
    processedExpression,
    predicateValues,
  };
}

function compileConditionExpression(
  expression: string,
  predicateValues: Record<string, boolean>,
): string {
  assertNestingDepth(expression);

  const compiledTokens: string[] = [];
  let cursor = 0;

  for (const match of expression.matchAll(CONDITION_TOKEN_REGEX)) {
    const rawToken = match[0];
    const tokenIndex = match.index ?? -1;

    if (tokenIndex !== cursor) {
      const unexpected = expression.slice(cursor, tokenIndex);
      throw new Error(`条件表达式存在非法片段："${unexpected}"`);
    }

    cursor = tokenIndex + rawToken.length;

    if (/^\s+$/u.test(rawToken)) {
      continue;
    }

    if (
      NUMBER_TOKEN_REGEX.test(rawToken) ||
      BOOLEAN_TOKEN_REGEX.test(rawToken) ||
      OPERATOR_TOKEN_REGEX.test(rawToken)
    ) {
      compiledTokens.push(rawToken);
      continue;
    }

    if (IDENTIFIER_TOKEN_REGEX.test(rawToken)) {
      if (rawToken in predicateValues) {
        compiledTokens.push(`__predicate("${escapeForLiteral(rawToken)}")`);
      } else {
        compiledTokens.push(`__resolve("${escapeForLiteral(rawToken)}")`);
      }
      continue;
    }

    throw new Error(`条件表达式包含不支持的 token："${rawToken}"`);
  }

  if (cursor !== expression.length) {
    const unexpected = expression.slice(cursor);
    throw new Error(`条件表达式存在非法尾部："${unexpected}"`);
  }

  if (compiledTokens.length === 0) {
    throw new Error("条件表达式为空");
  }

  return compiledTokens.join(" ");
}

function toBooleanResult(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value !== 0;
  }

  if (typeof value === "string") {
    return value.length > 0;
  }

  return Boolean(value);
}

/**
 * 求值条件表达式，返回布尔值
 *
 * @param expression - 条件表达式字符串
 * @param context - 求值上下文（扩展版，包含 hasTag/hasItem 查询能力）
 * @returns 布尔结果
 */
export function evaluateCondition(
  expression: ConditionExpression,
  context: ConditionContext,
): boolean {
  assertExpressionLength(expression);

  const { processedExpression, predicateValues } = preprocessPredicates(
    expression,
    context,
  );
  const compiledExpression = compileConditionExpression(
    processedExpression,
    predicateValues,
  );

  const evaluator = new Function(
    "__resolve",
    "__predicate",
    `"use strict"; return (${compiledExpression});`,
  ) as (
    resolve: (identifier: string) => number | boolean,
    predicate: (placeholder: string) => boolean,
  ) => unknown;

  const result = evaluator(
    (identifier) => resolveIdentifier(identifier, context),
    (placeholder) => predicateValues[placeholder] ?? false,
  );

  return toBooleanResult(result);
}
