/**
 * 规则引擎模块导出
 */

export {
  BasicRulesEngine,
  rulesEngine,
  type EntityAccessor,
  type ExecutionContext,
  type ExecutionResult,
  type InternalExecutionState,
  type RulesEngine,
  type TagChange,
} from "./engine";

export {
  createSeededRandom,
  parseDiceExpression,
  preprocessDiceInExpression,
  rollDiceExpression,
  type DicePreprocessResult,
  type DiceRollResult,
  type DiceSpec,
} from "./dice";

export {
  evaluateExpression,
  type ExpressionEvaluationResult,
  type ExpressionPrimitive,
} from "./expression";

export { buildResultFrame, type ResultFrameBuildInput } from "./result-builder";

export { generateMechanicSummary, type MechanicSummaryInput } from "./summary";

export {
  computeDerivedStats,
  topologicalSortDerivedStats,
} from "./derived-stats";

export {
  executeTurnStartTriggers,
  type TriggerPipelineResult,
} from "./trigger-pipeline";

export {
  collectPassiveModifiers,
  findOnDamageTriggers,
  resolveTrigger,
  TRIGGER_LIMITS,
} from "./trigger-utils";

export {
  createDefaultActionState,
  NoopRuleActionExecutor,
  type ActionExecutionResult,
  type ActionExecutionState,
  type RuleActionExecutor,
} from "./actions";
