/**
 * RuleScript Validation Pipeline
 *
 * 在 Parser AI 输出的 RuleScript 送入 Rules Engine 之前，
 * 进行结构校验、别名解析、类型修复等预处理。
 *
 * Phase 4 核心组件：解决 AI 输出的 "player"/"NPC名称" 无法被引擎解析的问题。
 */

import type {
  CheckAction,
  RuleAction,
  RuleScript,
  TriggerAction,
} from "@/domain/types/rule-script";
import type { WorldConfig } from "@/lib/world/types";
import { actionSchemaRegistry } from "./registry";
import type { ActionParamSchema, EntityAliasMap } from "./types";

// ─── 类型定义 ─────────────────────────────────────────────

/**
 * 校验错误/警告
 */
export interface ValidationError {
  /** 错误级别 */
  level: "error" | "warning";
  /** 出错的 action 索引（-1 表示全局错误） */
  actionIndex: number;
  /** action 类型 */
  actionType?: string;
  /** 错误信息 */
  message: string;
}

/**
 * 校验选项
 */
export interface ValidateOptions {
  /** 世界配置 */
  worldConfig: WorldConfig;
  /** 实体别名映射 */
  aliasMap: EntityAliasMap;
  /** 所有已知实体 ID（用于校验 entityRef） */
  knownEntityIds: string[];
  /** 是否递归校验嵌套 actions（默认 true） */
  validateNestedActions?: boolean;
}

/**
 * 脚本级校验结果
 */
export interface ValidatedResult {
  /** 校验修复后的 RuleScript（深拷贝，不修改原始输入） */
  ruleScript: RuleScript;
  /** 校验错误/警告 */
  errors: ValidationError[];
  /** 是否有致命错误（不可执行） */
  hasFatalErrors: boolean;
}

/**
 * 单 action 校验结果
 */
export interface ValidatedActionResult {
  /** 校验修复后的 action（null 表示被移除，如未知 type） */
  action: RuleAction | null;
  /** 校验错误/警告 */
  errors: ValidationError[];
  /** 是否有致命错误（不可执行） */
  hasFatalErrors: boolean;
}

// ─── 主入口 ───────────────────────────────────────────────

/**
 * 校验并修复 RuleScript
 *
 * 校验逻辑（逐 action）：
 * 1. type 检查 → 未注册的 action type 移除 + warning
 * 2. 必需参数检查 → 缺失必需参数 → error
 * 3. entityRef 解析 → 别名替换为实际 ID
 * 4. enum 校验 → 值不在枚举中 → warning
 * 5. talentRef 校验 → 过滤无效 talent ID
 * 6. 类型转换 → 字符串数字 → 数字
 * 7. 自定义 validate → schema.validate()
 *
 * @param ruleScript 原始 RuleScript
 * @param options 校验选项
 * @returns 校验结果（含修复后的 RuleScript）
 */
export function validateRuleScript(
  ruleScript: RuleScript,
  options: ValidateOptions,
): ValidatedResult {
  const errors: ValidationError[] = [];

  // 深拷贝 actions 数组（避免修改原始输入）
  const fixedActions: RuleAction[] = [];
  const shouldValidateNestedActions = options.validateNestedActions ?? true;

  for (let i = 0; i < ruleScript.actions.length; i++) {
    const action = deepCloneAction(ruleScript.actions[i]);
    const result = validateAction(
      action,
      i,
      options,
      errors,
      shouldValidateNestedActions,
    );
    if (result !== null) {
      fixedActions.push(result);
    }
  }

  const hasFatalErrors = errors.some((e) => e.level === "error");

  return {
    ruleScript: {
      version: 2,
      actions: fixedActions,
    },
    errors,
    hasFatalErrors,
  };
}

/**
 * 校验并修复单个 Action（运行时逐步校验入口）
 *
 * 默认不递归校验嵌套 actions，嵌套 action 由执行时逐个校验。
 */
export function validateRuleAction(
  action: RuleAction,
  actionIndex: number,
  options: ValidateOptions,
): ValidatedActionResult {
  const errors: ValidationError[] = [];
  const cloned = deepCloneAction(action);
  const shouldValidateNestedActions = options.validateNestedActions ?? false;

  const validated = validateAction(
    cloned,
    actionIndex,
    options,
    errors,
    shouldValidateNestedActions,
  );

  return {
    action: validated,
    errors,
    hasFatalErrors: errors.some((e) => e.level === "error"),
  };
}

// ─── 单个 Action 校验 ─────────────────────────────────────

function validateAction(
  action: RuleAction,
  index: number,
  options: ValidateOptions,
  errors: ValidationError[],
  shouldValidateNestedActions = true,
): RuleAction | null {
  const actionType = action.type;

  // 1. type 检查
  const schema = actionSchemaRegistry.getSchema(actionType);
  if (!schema) {
    errors.push({
      level: "warning",
      actionIndex: index,
      actionType,
      message: `未注册的 action type "${actionType}"，已移除`,
    });
    return null;
  }

  const actionObj = action as unknown as Record<string, unknown>;

  // 2. 必需参数检查
  for (const param of schema.params) {
    if (param.required && actionObj[param.name] === undefined) {
      errors.push({
        level: "error",
        actionIndex: index,
        actionType,
        message: `缺少必需参数 "${param.name}"`,
      });
    }
  }

  // 3-6. 逐参数校验和修复
  for (const param of schema.params) {
    const value = actionObj[param.name];
    if (value === undefined) continue;

    validateAndFixParam(
      actionObj,
      param,
      value,
      index,
      actionType,
      options,
      errors,
    );
  }

  // 7. 自定义 validate
  if (schema.validate) {
    const validationContext = {
      worldConfig: options.worldConfig,
      entityIds: options.knownEntityIds,
    };
    const result = schema.validate(actionObj, validationContext);
    if (!result.valid) {
      for (const err of result.errors) {
        errors.push({
          level: "warning",
          actionIndex: index,
          actionType,
          message: err,
        });
      }
    }
  }

  // 递归校验嵌套 actions（branch.then/else）
  if (shouldValidateNestedActions) {
    validateNestedActions(actionObj, index, options, errors);
  }

  return action;
}

// ─── 参数级校验 ───────────────────────────────────────────

function validateAndFixParam(
  actionObj: Record<string, unknown>,
  param: ActionParamSchema,
  value: unknown,
  actionIndex: number,
  actionType: string,
  options: ValidateOptions,
  errors: ValidationError[],
): void {
  switch (param.type) {
    case "entityRef":
      resolveEntityRef(
        actionObj,
        param.name,
        value,
        actionIndex,
        actionType,
        options,
        errors,
      );
      break;

    case "enum":
      validateEnum(value, param, actionIndex, actionType, errors);
      break;

    case "talentRef":
      fixTalentRef(
        actionObj,
        param.name,
        value,
        actionIndex,
        actionType,
        options,
        errors,
      );
      break;

    case "value":
    case "number":
      fixNumericType(actionObj, param.name, value, param.type);
      break;

    case "object":
      if (param.properties && typeof value === "object" && value !== null) {
        const objValue = value as Record<string, unknown>;
        for (const subParam of param.properties) {
          const subValue = objValue[subParam.name];
          if (subValue === undefined) {
            if (subParam.required) {
              errors.push({
                level: "error",
                actionIndex,
                actionType,
                message: `嵌套对象 "${param.name}" 缺少必需参数 "${subParam.name}"`,
              });
            }
            continue;
          }
          validateAndFixParam(
            objValue,
            subParam,
            subValue,
            actionIndex,
            actionType,
            options,
            errors,
          );
        }
      }
      break;

    // string, boolean, actions, field 等无需特殊校验
    default:
      break;
  }
}

// ─── entityRef 解析 ───────────────────────────────────────

function resolveEntityRef(
  actionObj: Record<string, unknown>,
  paramName: string,
  value: unknown,
  actionIndex: number,
  actionType: string,
  options: ValidateOptions,
  errors: ValidationError[],
): void {
  if (typeof value !== "string") return;

  // 保留特殊关键字（引擎自行处理）
  if (
    value === "self" ||
    value === "actor" ||
    value === "target" ||
    value.startsWith("$")
  ) {
    return;
  }

  // 尝试别名解析
  const resolved = options.aliasMap.aliases.get(value.toLowerCase());
  if (resolved) {
    actionObj[paramName] = resolved;
    return;
  }

  // 检查是否为已知实体 ID（UUID 直接使用）
  if (options.knownEntityIds.includes(value)) {
    return;
  }

  // 都不匹配 → warning（不移除，让引擎尝试处理）
  errors.push({
    level: "warning",
    actionIndex,
    actionType,
    message: `entityRef "${paramName}" 的值 "${value}" 无法解析为已知实体`,
  });
}

// ─── enum 校验 ────────────────────────────────────────────

function validateEnum(
  value: unknown,
  param: ActionParamSchema,
  actionIndex: number,
  actionType: string,
  errors: ValidationError[],
): void {
  if (!param.enumValues || typeof value !== "string") return;

  if (!param.enumValues.includes(value)) {
    errors.push({
      level: "warning",
      actionIndex,
      actionType,
      message: `参数 "${
        param.name
      }" 的值 "${value}" 不在枚举 [${param.enumValues.join(", ")}] 中`,
    });
  }
}

// ─── talentRef 校验 ───────────────────────────────────────

function fixTalentRef(
  actionObj: Record<string, unknown>,
  paramName: string,
  value: unknown,
  actionIndex: number,
  actionType: string,
  options: ValidateOptions,
  errors: ValidationError[],
): void {
  if (!Array.isArray(value)) return;

  const talents = options.worldConfig.talents ?? [];
  const validTalentIds = new Set(talents.map((t) => t.id));

  const filtered: string[] = [];
  const removed: string[] = [];

  for (const id of value) {
    if (typeof id === "string" && validTalentIds.has(id)) {
      filtered.push(id);
    } else {
      removed.push(String(id));
    }
  }

  if (removed.length > 0) {
    errors.push({
      level: "warning",
      actionIndex,
      actionType,
      message: `参数 "${paramName}" 中的天赋 ID [${removed.join(
        ", ",
      )}] 在 WorldConfig 中不存在，已移除`,
    });
    actionObj[paramName] = filtered;
  }
}

// ─── 类型修复 ─────────────────────────────────────────────

function fixNumericType(
  actionObj: Record<string, unknown>,
  paramName: string,
  value: unknown,
  paramType: string,
): void {
  // 字符串数字 → 数字（仅对纯数字字符串）
  if (typeof value === "string" && paramType === "number") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      actionObj[paramName] = parsed;
    }
  }
  // value 类型也支持字符串数字转换（如 "15" → 15），
  // 但由于 value 可以是表达式字符串（如 "str + 5"），只转换纯数字
  if (typeof value === "string" && paramType === "value") {
    const trimmed = value.trim();
    if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
      actionObj[paramName] = Number(trimmed);
    }
  }
}

// ─── 嵌套 Actions 校验 ───────────────────────────────────

function validateNestedActions(
  actionObj: Record<string, unknown>,
  parentIndex: number,
  options: ValidateOptions,
  errors: ValidationError[],
): void {
  // branch.then / branch.else
  if (actionObj.type === "branch") {
    if (Array.isArray(actionObj.then)) {
      actionObj.then = validateActionArray(
        actionObj.then as RuleAction[],
        parentIndex,
        options,
        errors,
        false,
      ) as unknown as RuleAction[];
    }
    if (Array.isArray(actionObj.else)) {
      actionObj.else = validateActionArray(
        actionObj.else as RuleAction[],
        parentIndex,
        options,
        errors,
        false,
      ) as unknown as RuleAction[];
    }
  }

  // check.onSuccess / check.onFailure
  if (actionObj.type === "check") {
    const checkAction = actionObj as unknown as CheckAction;

    if (Array.isArray(checkAction.onSuccess)) {
      checkAction.onSuccess = validateActionArray(
        checkAction.onSuccess,
        parentIndex,
        options,
        errors,
        false,
      ) as unknown as RuleAction[];
    }

    if (Array.isArray(checkAction.onFailure)) {
      checkAction.onFailure = validateActionArray(
        checkAction.onFailure,
        parentIndex,
        options,
        errors,
        false,
      ) as unknown as RuleAction[];
    }
  }

  // addTag.trigger.actions
  if (actionObj.type === "addTag") {
    const trigger = actionObj.trigger;
    if (
      typeof trigger === "object" &&
      trigger !== null &&
      Array.isArray((trigger as Record<string, unknown>).actions)
    ) {
      const triggerObj = trigger as Record<string, unknown>;
      const triggerTiming =
        typeof triggerObj.timing === "string" ? triggerObj.timing : undefined;
      triggerObj.actions = validateActionArray(
        triggerObj.actions as TriggerAction[],
        parentIndex,
        options,
        errors,
        true,
        triggerTiming,
      ) as unknown as TriggerAction[];
    }
  }
}

function validateActionArray(
  actions: TriggerAction[],
  parentIndex: number,
  options: ValidateOptions,
  errors: ValidationError[],
  allowInternalActions: boolean,
  triggerTiming?: string,
): TriggerAction[] {
  const result: TriggerAction[] = [];
  for (const action of actions) {
    if (!action || typeof action !== "object") {
      continue;
    }

    if (action.type === "modifyDamage") {
      if (!allowInternalActions) {
        errors.push({
          level: "warning",
          actionIndex: parentIndex,
          actionType: "modifyDamage",
          message:
            'modifyDamage 仅允许在 addTag.trigger.actions（timing="on_damage"）中使用，已移除',
        });
        continue;
      }

      if (triggerTiming !== "on_damage") {
        errors.push({
          level: "warning",
          actionIndex: parentIndex,
          actionType: "modifyDamage",
          message:
            'modifyDamage 仅允许在 addTag.trigger.timing="on_damage" 中使用，已移除',
        });
        continue;
      }

      const cloned = deepCloneTriggerAction(action);
      const actionObj = cloned as unknown as Record<string, unknown>;

      const multiplier = actionObj.multiplier;
      const reduction = actionObj.reduction;

      if (multiplier === undefined && reduction === undefined) {
        errors.push({
          level: "error",
          actionIndex: parentIndex,
          actionType: "modifyDamage",
          message: "modifyDamage 至少需要提供 multiplier 或 reduction",
        });
      }

      if (
        typeof multiplier === "string" &&
        /^-?\d+(\.\d+)?$/.test(multiplier.trim())
      ) {
        actionObj.multiplier = Number(multiplier.trim());
      }

      if (
        typeof reduction === "string" &&
        /^-?\d+(\.\d+)?$/.test(reduction.trim())
      ) {
        actionObj.reduction = Number(reduction.trim());
      }

      result.push(cloned);
      continue;
    }

    const cloned = deepCloneAction(action as RuleAction);
    const validated = validateAction(cloned, parentIndex, options, errors);
    if (validated !== null) {
      result.push(validated);
    }
  }
  return result;
}

function deepCloneTriggerAction(action: TriggerAction): TriggerAction {
  return JSON.parse(JSON.stringify(action)) as TriggerAction;
}

// ─── 工具函数 ─────────────────────────────────────────────

/**
 * 深拷贝 RuleAction（处理嵌套结构）
 */
function deepCloneAction(action: RuleAction): RuleAction {
  return JSON.parse(JSON.stringify(action)) as RuleAction;
}
