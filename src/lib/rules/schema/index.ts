/**
 * Action Schema 模块聚合导出
 */

export { ActionSchemaRegistry, actionSchemaRegistry } from "./registry";

export { generateOperationDefinitions } from "./prompt-generator";
export type { EntityInfo, PromptGeneratorOptions } from "./prompt-generator";

export type {
  ActionCategory,
  ActionExample,
  ActionParamSchema,
  ActionParamType,
  ActionSchema,
  EntityAliasMap,
  ValidationContext,
  ValidationResult,
} from "./types";

export {
  validateRuleAction,
  validateRuleScript,
  type ValidatedActionResult,
  type ValidatedResult,
  type ValidateOptions,
  type ValidationError,
} from "./validator";
