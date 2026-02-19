/**
 * 表达式求值与骰子预处理
 */

import { Parser } from "expr-eval";
import type { DiceRollResult } from "./dice";
import { preprocessDiceInExpression } from "./dice";

export type ExpressionPrimitive = number | string | boolean;

export interface ExpressionEvaluationResult {
  value: ExpressionPrimitive;
  processedExpression: string;
  diceRolls: DiceRollResult[];
}

const parser = new Parser();
type ParserEvaluateScope = NonNullable<Parameters<Parser["evaluate"]>[1]>;

const DOLLAR_VARIABLE_PATTERN =
  /\$([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*)/g;

function toRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function setPath(
  target: Record<string, unknown>,
  path: string,
  value: ExpressionPrimitive
): void {
  const segments = path.split(".");
  let cursor = target;

  for (let i = 0; i < segments.length - 1; i += 1) {
    const segment = segments[i];
    const current = toRecord(cursor[segment]);
    if (current) {
      cursor = current;
      continue;
    }

    const next: Record<string, unknown> = {};
    cursor[segment] = next;
    cursor = next;
  }

  cursor[segments[segments.length - 1]] = value;
}

function buildExpressionScope(
  variables: Record<string, ExpressionPrimitive>
): Record<string, unknown> {
  const scope: Record<string, unknown> = {};
  const variableRoot: Record<string, unknown> = {};
  scope.__vars = variableRoot;

  for (const [key, value] of Object.entries(variables)) {
    if (key.startsWith("$")) {
      const variablePath = key.slice(1);
      if (variablePath.length > 0) {
        setPath(variableRoot, variablePath, value);
      }
      continue;
    }

    setPath(scope, key, value);
  }

  return scope;
}

export function evaluateExpression(
  expression: string,
  variables: Record<string, ExpressionPrimitive>,
  random: () => number
): ExpressionEvaluationResult {
  const preprocessed = preprocessDiceInExpression(expression, random);
  const transformedExpression = preprocessed.expression.replace(
    DOLLAR_VARIABLE_PATTERN,
    (_match, path: string) => `__vars.${path}`
  );

  const evaluationScope = buildExpressionScope(
    variables
  ) as unknown as ParserEvaluateScope;

  let value: unknown;
  try {
    value = parser.evaluate(transformedExpression, evaluationScope);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `表达式求值失败: "${expression}" -> "${preprocessed.expression}" (${message})`
    );
  }

  if (
    typeof value !== "number" &&
    typeof value !== "boolean" &&
    typeof value !== "string"
  ) {
    throw new Error(
      `表达式求值结果类型不支持: ${typeof value}（表达式：${expression}）`
    );
  }

  return {
    value,
    processedExpression: preprocessed.expression,
    diceRolls: preprocessed.diceRolls,
  };
}
