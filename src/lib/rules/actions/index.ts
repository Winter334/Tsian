/**
 * RuleAction 执行器骨架（G1）
 *
 * G1 仅提供最小接口定义，具体执行逻辑在 G3 实现。
 */

import type { RuleAction } from "@/domain/types";
import type { ExecutionContext } from "../engine";

export interface ActionExecutionState {
  variables: Record<string, number | string | boolean>;
}

export interface ActionExecutionResult {
  success: boolean;
  error?: string;
  state: ActionExecutionState;
}

export interface RuleActionExecutor {
  execute(
    action: RuleAction,
    context: ExecutionContext,
    state: ActionExecutionState
  ): ActionExecutionResult;
}

export class NoopRuleActionExecutor implements RuleActionExecutor {
  execute(
    _action: RuleAction,
    _context: ExecutionContext,
    state: ActionExecutionState
  ): ActionExecutionResult {
    return {
      success: false,
      error: "RuleActionExecutor 尚未实现（G1 骨架）",
      state,
    };
  }
}

export function createDefaultActionState(): ActionExecutionState {
  return { variables: {} };
}
