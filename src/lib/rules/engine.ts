/**
 * RulesEngine 完整实现（v2 适配版）
 *
 * 职责：
 * 1. 接收 RuleScript + ExecutionContext
 * 2. 按顺序执行 actions（带 Shadow State 中间状态跟踪）
 * 3. 收集所有中间结果（骰子、检定、状态变更）
 * 4. 构建 ResultFrame 并生成 mechanicSummary
 *
 * v2 改进：
 * - 类型重命名: gain→heal, lose→cost, setValue→set, conditional→branch,
 *   npcCreate→spawn, npcStatusChange→despawn
 * - 删除 npcAction/sequence handler
 * - executeCheck 大幅改造：dcSource 四层分级 + onSuccess/onFailure 内嵌分支
 *   + 对抗检定 + 预设展开
 * - 集成 evaluators 模块（resolveValueExpression, evaluateCondition,
 *   resolveDC, expandPreset, evaluateDCFormula）
 *
 * 保留的 P2 特性：
 * - A0: Shadow State（同脚本多步操作读到中间状态）
 * - A1: 动态属性注入（从 EntityAccessor.getAllFields 读取，不硬编码）
 * - A3: 检定骰子从 WorldConfig.checkRules.defaultDice 读取
 * - A4: damage/heal 支持自定义 field 参数
 * - A7: 执行安全限制（action 计数 + 递归深度）
 * - A8: 小修复（evalExpr 日志 / resolveEntityId 不回退 / 注入所有类型）
 */

import type {
  Check,
  CreatedNpcData,
  DamageContext,
  DamageModification,
  DiceRoll,
  EntityType,
  ModifierApplication,
  ResultFrame,
  RuleScript,
  StructuralChange,
  TagMetadata,
  ValueChange,
} from "@/domain";
import type { ItemInstance } from "@/domain/entities/item";
import type { SkillInstance } from "@/domain/entities/skill";
import type { WorldConfig } from "@/lib/world";
import { getDefaultResourceField, getResourcePairs } from "@/lib/world";
import { createSeededRandom } from "./dice";
import type {
  ConditionContext,
  DCResolution,
  EvaluationContext,
} from "./evaluators";
import {
  evaluateCondition,
  expandPreset,
  resolveDC,
  resolveValueExpression,
} from "./evaluators";
import type { ExpressionPrimitive } from "./expression";
import { evaluateExpression } from "./expression";
import { buildResultFrame } from "./result-builder";
import type { EntityAliasMap } from "./schema/types";
import { validateRuleAction, type ValidationError } from "./schema/validator";
import { generateMechanicSummary, type NpcSummaryEntry } from "./summary";
import { collectPassiveModifiers, findOnDamageTriggers } from "./trigger-utils";

// ─── 执行安全限制常量 ─────────────────────────────────────

const EXECUTION_LIMITS = {
  /** 单次 execute() 最大 action 执行数 */
  maxActionCount: 100,
  /** branch/check 嵌套动作最大深度 */
  maxRecursionDepth: 10,
} as const;

// ─── 实体访问器 ───────────────────────────────────────────

export interface EntityAccessor {
  /** 读取实体属性值 */
  getValue(
    entityId: string,
    field: string,
  ): number | string | boolean | undefined;

  /** 获取实体类型（用于填充 ValueChange.entityType） */
  getEntityType(entityId: string): EntityType | undefined;

  /** 检查实体是否拥有标签 */
  hasTag(entityId: string, tagId: string): boolean;

  /** 获取实体所有标签（可选） */
  getTags?(entityId: string): string[];

  /** 获取实体所有字段（用于动态属性注入） */
  getAllFields?(
    entityId: string,
  ): Record<string, number | string | boolean> | undefined;

  /** 获取所有实体 ID */
  getAllEntityIds?(): string[];

  /** 获取实体标签及元数据（TriggerPipeline 用） */
  getTagsWithMetadata?(entityId: string): Map<string, TagMetadata>;

  /** 获取角色的物品实例列表（可选，inventory 模块注入） */
  getItems?(entityId: string): readonly ItemInstance[];
  /** 获取角色的技能实例列表（可选，inventory 模块注入） */
  getSkills?(entityId: string): readonly SkillInstance[];
}

// ─── 执行上下文 ───────────────────────────────────────────

export interface ExecutionContext {
  worldConfig: WorldConfig;
  seed: number;
  entities: EntityAccessor;
  actorId: string;
  targetId?: string;
  /** 外部传入的命令 ID，关联到 ResultFrame.commandId */
  commandId: string;
  /** 实体别名映射（Phase 4: 支持 AI 输出的人类可读名称解析） */
  aliasMap?: EntityAliasMap;
}

// ─── 标签变更记录 ─────────────────────────────────────────

/**
 * 标签变更记录
 *
 * 在引擎执行期间收集 addTag/removeTag 操作产生的标签元数据变更，
 * 供上层（Pipeline）写回 EntityAccessor，解决"效果信息断裂"问题。
 */
export interface TagChange {
  entityId: string;
  tagId: string;
  action: "add" | "remove";
  /** 添加时的完整元数据（仅 action=add 时有值） */
  metadata?: TagMetadata;
}

// ─── 创建的 NPC 数据 ──────────────────────────────────────

/** 从 domain 层 re-export，保持向后兼容 */
export type { CreatedNpcData } from "@/domain/types";

// ─── 执行结果 ─────────────────────────────────────────────

export interface ExecutionResult {
  success: boolean;
  error?: string;
  resultFrame?: ResultFrame;
  mechanicSummary: string;
  /** 标签变更记录（供上层写回 EntityAccessor） */
  tagChanges: TagChange[];
  /** 本次执行中动态创建的 NPC 列表 */
  createdNpcs?: CreatedNpcData[];
  /** 运行时逐 action 校验产生的错误/警告 */
  validationErrors?: ValidationError[];
}

// ─── 引擎接口 ─────────────────────────────────────────────

export interface RulesEngine {
  execute(script: RuleScript, context: ExecutionContext): ExecutionResult;
}

// ─── 内部执行状态 ─────────────────────────────────────────

export interface InternalExecutionState {
  /** 变量空间（resultVar 写入、条件判断读取） */
  variables: Record<string, ExpressionPrimitive>;
  /** 收集的骰子记录 */
  diceRolls: DiceRoll[];
  /** 收集的检定记录 */
  checks: Check[];
  /** 收集的状态变更 */
  valueChanges: ValueChange[];
  /** 确定性随机函数 */
  random: () => number;

  // === A0: Shadow State ===

  /** 字段覆盖层：记录执行过程中已变更的字段值 */
  fieldOverlay: Map<string, Map<string, number | string | boolean>>;
  /** 标签覆盖层：执行过程中新增的标签 */
  tagOverlay: Map<string, Set<string>>;
  /** 标签移除层：执行过程中显式移除的标签 */
  tagRemoved: Map<string, Set<string>>;

  // === A7: 执行安全限制 ===

  /** 已执行的 action 计数 */
  actionCount: number;
  /** 当前递归深度 */
  currentDepth: number;

  // === B2: on_damage 上下文 ===

  /** 当前正在处理的伤害上下文（仅在 on_damage 触发器执行期间存在） */
  damageContext?: DamageContext;

  // === C5: 标签变更收集 ===

  /** 标签变更记录（供上层写回 EntityAccessor） */
  tagChanges: TagChange[];

  // === 天赋系统：被动修正 ===

  /** 被动修正应用记录（供 ResultFrame.modifiersApplied 使用） */
  modifiersApplied: ModifierApplication[];

  // === NPC 操作 ===

  /** 本次执行中动态创建的 NPC 实体及其初始数据 */
  createdNpcs: CreatedNpcData[];
  /** NPC 操作摘要条目（供 mechanicSummary 使用） */
  npcSummaryEntries: NpcSummaryEntry[];

  // === 装备/背包/技能 ===

  /** 结构化变更记录（物品/技能增减） */
  structuralChanges: StructuralChange[];
  /** 运行时逐 action 校验错误/警告 */
  validationErrors: ValidationError[];
}

// ─── Shadow State 辅助函数 ────────────────────────────────

/** 优先从 shadow 读取字段值，回退到 EntityAccessor */
function getValueWithShadow(
  entityId: string,
  field: string,
  context: ExecutionContext,
  state: InternalExecutionState,
): number | string | boolean | undefined {
  const overlay = state.fieldOverlay.get(entityId);
  if (overlay?.has(field)) return overlay.get(field);
  return context.entities.getValue(entityId, field);
}

/** 优先从 shadow 检查标签，回退到 EntityAccessor */
function hasTagWithShadow(
  entityId: string,
  tagId: string,
  context: ExecutionContext,
  state: InternalExecutionState,
): boolean {
  if (state.tagRemoved.get(entityId)?.has(tagId)) return false;
  if (state.tagOverlay.get(entityId)?.has(tagId)) return true;
  return context.entities.hasTag(entityId, tagId);
}

/** 更新 shadow 字段覆盖层 */
function setShadowField(
  state: InternalExecutionState,
  entityId: string,
  field: string,
  value: number | string | boolean,
): void {
  let overlay = state.fieldOverlay.get(entityId);
  if (!overlay) {
    overlay = new Map();
    state.fieldOverlay.set(entityId, overlay);
  }
  overlay.set(field, value);
}

/** 在 shadow 中添加标签 */
function addShadowTag(
  state: InternalExecutionState,
  entityId: string,
  tagId: string,
): void {
  // 从移除层中清除
  state.tagRemoved.get(entityId)?.delete(tagId);
  // 添加到覆盖层
  let tags = state.tagOverlay.get(entityId);
  if (!tags) {
    tags = new Set();
    state.tagOverlay.set(entityId, tags);
  }
  tags.add(tagId);
}

/** 在 shadow 中移除标签 */
function removeShadowTag(
  state: InternalExecutionState,
  entityId: string,
  tagId: string,
): void {
  // 从覆盖层中清除
  state.tagOverlay.get(entityId)?.delete(tagId);
  // 添加到移除层
  let removed = state.tagRemoved.get(entityId);
  if (!removed) {
    removed = new Set();
    state.tagRemoved.set(entityId, removed);
  }
  removed.add(tagId);
}

/**
 * 获取实体所有字段（含 shadow 覆盖）
 * 用于 buildVariables 的动态属性注入
 */
function getAllFieldsWithShadow(
  entityId: string,
  context: ExecutionContext,
  state: InternalExecutionState,
): Record<string, number | string | boolean> | undefined {
  // 基础字段
  const baseFields = context.entities.getAllFields?.(entityId);
  if (!baseFields && !state.fieldOverlay.has(entityId)) return undefined;

  const result: Record<string, number | string | boolean> = baseFields
    ? { ...baseFields }
    : {};

  // 叠加 shadow 覆盖
  const overlay = state.fieldOverlay.get(entityId);
  if (overlay) {
    for (const [field, value] of overlay) {
      result[field] = value;
    }
  }

  return result;
}

// ─── 运行时校验辅助 ─────────────────────────────────────────

function ensureRuntimeAliasMap(context: ExecutionContext): EntityAliasMap {
  if (!context.aliasMap) {
    context.aliasMap = {
      aliases: new Map(),
      displayNames: new Map(),
    };
  }
  return context.aliasMap;
}

function getKnownEntityIds(
  context: ExecutionContext,
  state: InternalExecutionState,
): string[] {
  const known = new Set<string>(context.entities.getAllEntityIds?.() ?? []);
  known.add(context.actorId);
  if (context.targetId) {
    known.add(context.targetId);
  }
  for (const npc of state.createdNpcs) {
    known.add(npc.id);
  }
  return Array.from(known);
}

// ─── 引擎实现 ─────────────────────────────────────────────

export class BasicRulesEngine implements RulesEngine {
  execute(script: RuleScript, context: ExecutionContext): ExecutionResult {
    // 验证脚本（兼容 v1 和 v2）
    if (
      !script ||
      (script.version !== 2 && (script as { version: number }).version !== 1)
    ) {
      return {
        success: false,
        error: `不支持的 RuleScript 版本: ${script?.version}`,
        mechanicSummary: "规则脚本版本不支持",
        tagChanges: [],
      };
    }

    if (!Array.isArray(script.actions)) {
      return {
        success: false,
        error: "RuleScript.actions 不是数组",
        mechanicSummary: "规则脚本格式错误",
        tagChanges: [],
      };
    }

    // 空 actions 视为成功（安全脚本）
    if (script.actions.length === 0) {
      const frame = buildResultFrame({
        frameId: crypto.randomUUID(),
        commandId: context.commandId,
        seed: context.seed,
        success: true,
        mechanicSummary: "无需结算",
      });
      return {
        success: true,
        resultFrame: frame,
        mechanicSummary: "无需结算",
        tagChanges: [],
      };
    }

    const random = createSeededRandom(context.seed);
    const state: InternalExecutionState = {
      variables: {},
      diceRolls: [],
      checks: [],
      valueChanges: [],
      random,
      // A0: Shadow State
      fieldOverlay: new Map(),
      tagOverlay: new Map(),
      tagRemoved: new Map(),
      // A7: 执行安全限制
      actionCount: 0,
      currentDepth: 0,
      // C5: 标签变更收集
      tagChanges: [],
      // 天赋系统：被动修正
      modifiersApplied: [],
      // NPC 操作
      createdNpcs: [],
      npcSummaryEntries: [],
      // 装备/背包/技能
      structuralChanges: [],
      // 运行时逐 action 校验
      validationErrors: [],
    };

    // 依次执行 actions（逐 action 校验 + 执行）
    try {
      for (let i = 0; i < script.actions.length; i++) {
        executeAction(script.actions[i], context, state, i);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: message,
        mechanicSummary: `执行失败: ${message}`,
        tagChanges: state.tagChanges,
        validationErrors:
          state.validationErrors.length > 0
            ? state.validationErrors
            : undefined,
      };
    }

    // 判断整体成功/失败
    const hasFailedCheck = state.checks.some((c) => !c.success);
    const overallSuccess = !hasFailedCheck || state.valueChanges.length > 0;

    const mechanicSummary = generateMechanicSummary(
      {
        checks: state.checks,
        diceRolls: state.diceRolls,
        valueChanges: state.valueChanges,
        npcSummaryEntries:
          state.npcSummaryEntries.length > 0
            ? state.npcSummaryEntries
            : undefined,
        structuralChanges:
          state.structuralChanges.length > 0
            ? state.structuralChanges
            : undefined,
      },
      context.aliasMap?.displayNames,
    );

    const resultFrame = buildResultFrame({
      frameId: crypto.randomUUID(),
      commandId: context.commandId,
      seed: context.seed,
      success: overallSuccess,
      failureReason: !overallSuccess ? "检定未通过" : undefined,
      valueChanges: state.valueChanges,
      diceRolls: state.diceRolls,
      checks: state.checks,
      modifiersApplied:
        state.modifiersApplied.length > 0 ? state.modifiersApplied : undefined,
      structuralChanges:
        state.structuralChanges.length > 0
          ? state.structuralChanges
          : undefined,
      mechanicSummary,
    });

    return {
      success: true,
      resultFrame,
      mechanicSummary,
      tagChanges: state.tagChanges,
      createdNpcs: state.createdNpcs.length > 0 ? state.createdNpcs : undefined,
      validationErrors:
        state.validationErrors.length > 0 ? state.validationErrors : undefined,
    };
  }
}

// ─── Action 分发器 ────────────────────────────────────────

import type {
  AddTagAction,
  BranchAction,
  CheckAction,
  CostAction,
  DamageAction,
  DespawnAction,
  GrantItemAction,
  GrantSkillAction,
  HealAction,
  ModifyDamageAction,
  ModifyTagAction,
  RemoveItemAction,
  RemoveSkillAction,
  RemoveTagAction,
  RollAction,
  RuleAction,
  SetAction,
  SpawnAction,
} from "@/domain/types";
import { executeOpposedCheck } from "./opposed-check";

function executeAction(
  action: RuleAction,
  context: ExecutionContext,
  state: InternalExecutionState,
  actionIndex = -1,
): void {
  const runtimeAliasMap = ensureRuntimeAliasMap(context);
  const validated = validateRuleAction(action, actionIndex, {
    worldConfig: context.worldConfig,
    aliasMap: runtimeAliasMap,
    knownEntityIds: getKnownEntityIds(context, state),
    validateNestedActions: false,
  });

  if (validated.errors.length > 0) {
    state.validationErrors.push(...validated.errors);
  }

  if (validated.hasFatalErrors) {
    const fatalMessages = validated.errors
      .filter((err) => err.level === "error")
      .map((err) => err.message);
    throw new Error(`RuleAction 校验失败: ${fatalMessages.join("; ")}`);
  }

  if (!validated.action) {
    // 未注册 action type 等可恢复问题：跳过执行
    return;
  }

  const normalizedAction = validated.action;
  const actionType = (normalizedAction as RuleAction | ModifyDamageAction).type;

  // A7: action 计数检查
  state.actionCount++;
  if (state.actionCount > EXECUTION_LIMITS.maxActionCount) {
    throw new Error(
      `执行超限：已执行 ${state.actionCount} 个 action（上限 ${EXECUTION_LIMITS.maxActionCount}）`,
    );
  }

  switch (actionType) {
    case "check":
      executeCheck(
        normalizedAction as CheckAction,
        context,
        state,
        actionIndex,
      );
      break;
    case "damage":
      executeDamage(
        normalizedAction as DamageAction,
        context,
        state,
        actionIndex,
      );
      break;
    case "heal":
      executeHeal(normalizedAction as HealAction, context, state);
      break;
    case "cost":
      executeCost(normalizedAction as CostAction, context, state);
      break;
    case "roll":
      executeRoll(normalizedAction as RollAction, context, state);
      break;
    case "addTag":
      executeAddTag(normalizedAction as AddTagAction, context, state);
      break;
    case "removeTag":
      executeRemoveTag(normalizedAction as RemoveTagAction, context, state);
      break;
    case "modifyTag":
      executeModifyTag(normalizedAction as ModifyTagAction, context, state);
      break;
    case "set":
      executeSet(normalizedAction as SetAction, context, state);
      break;
    case "branch":
      executeBranch(
        normalizedAction as BranchAction,
        context,
        state,
        actionIndex,
      );
      break;
    case "modifyDamage":
      executeModifyDamage(
        normalizedAction as unknown as ModifyDamageAction,
        context,
        state,
      );
      break;
    case "spawn":
      executeSpawn(normalizedAction as SpawnAction, context, state);
      break;
    case "despawn":
      executeDespawn(normalizedAction as DespawnAction, context, state);
      break;
    case "grantItem":
      executeGrantItem(normalizedAction as GrantItemAction, context, state);
      break;
    case "removeItem":
      executeRemoveItem(normalizedAction as RemoveItemAction, context, state);
      break;
    case "grantSkill":
      executeGrantSkill(normalizedAction as GrantSkillAction, context, state);
      break;
    case "removeSkill":
      executeRemoveSkill(normalizedAction as RemoveSkillAction, context, state);
      break;
    default:
      throw new Error(`未知的 action 类型: ${actionType}`);
  }
}

// ─── 表达式求值辅助 ───────────────────────────────────────

// A8.2: resolveEntityId 不回退到 actorId
// B2 扩展: 支持 $variable 引用（如 $source、$target）
// Phase 4: 支持 aliasMap 别名解析（"player" 等业务别名由 aliasMap 提供）
function resolveEntityId(
  rawId: string | undefined,
  context: ExecutionContext,
  state?: InternalExecutionState,
): string {
  if (!rawId || rawId === "self" || rawId === "actor") return context.actorId;
  if (rawId === "target") {
    if (!context.targetId) {
      throw new Error(
        'RuleScript 引用了 "target"，但 ExecutionContext.targetId 未定义',
      );
    }
    return context.targetId;
  }
  // B2: $variable 引用解析（从 state.variables 中查找实体 ID）
  if (rawId.startsWith("$") && state) {
    const varValue = state.variables[rawId];
    if (typeof varValue === "string" && varValue.length > 0) {
      return varValue;
    }
    throw new Error(
      `RuleScript 引用了变量 "${rawId}" 作为实体 ID，但该变量未定义或不是字符串`,
    );
  }
  // Phase 4: aliasMap 别名解析（大小写不敏感）
  if (context.aliasMap) {
    const resolved = context.aliasMap.aliases.get(rawId.toLowerCase());
    if (resolved) return resolved;
  }
  // 原样返回 rawId（作为 UUID 直接使用）
  return rawId;
}

// A1: 动态属性注入（从 EntityAccessor.getAllFields 读取 + shadow 合并）
function buildVariables(
  context: ExecutionContext,
  state: InternalExecutionState,
  targetEntityId?: string,
): Record<string, ExpressionPrimitive> {
  const vars: Record<string, ExpressionPrimitive> = {};

  // 复制已有变量
  for (const [k, v] of Object.entries(state.variables)) {
    vars[k] = v;
  }

  // 注入 actor 所有属性（动态，含 shadow 覆盖）
  const actorFields = getAllFieldsWithShadow(context.actorId, context, state);
  if (actorFields) {
    for (const [field, value] of Object.entries(actorFields)) {
      // A8.3: 注入所有类型（number/string/boolean）
      if (
        typeof value === "number" ||
        typeof value === "boolean" ||
        typeof value === "string"
      ) {
        vars[field] = value;
      }
    }
  }

  // 注入 target.xxx（动态，含 shadow 覆盖）
  if (targetEntityId) {
    const targetFields = getAllFieldsWithShadow(targetEntityId, context, state);
    if (targetFields) {
      for (const [field, value] of Object.entries(targetFields)) {
        if (
          typeof value === "number" ||
          typeof value === "boolean" ||
          typeof value === "string"
        ) {
          vars[`target.${field}`] = value;
        }
      }
    }
  }

  return vars;
}

/** 检测是否像表达式（含运算符、骰子、数字、变量引用等） */
const EXPRESSION_PATTERN =
  /[+\-*/><!=&|()$]|\d+d\d+|\b\d+\b|\btrue\b|\bfalse\b/i;

// A8.1: evalExpr 加 warn 日志
function evalExpr(
  expression: string | number | boolean,
  context: ExecutionContext,
  state: InternalExecutionState,
  targetEntityId?: string,
): ExpressionPrimitive {
  if (typeof expression === "number" || typeof expression === "boolean") {
    return expression;
  }

  // 如果不像表达式且不是已知变量，当作字符串字面量返回
  const vars = buildVariables(context, state, targetEntityId);
  if (!EXPRESSION_PATTERN.test(expression) && !(expression in vars)) {
    return expression;
  }

  let result;
  try {
    result = evaluateExpression(expression, vars, state.random);
  } catch (e) {
    // A8.1: 加 warn 日志，不改变行为（保持向后兼容）
    console.warn(
      `[RulesEngine] 表达式求值失败，回退为字符串: "${expression}"`,
      e instanceof Error ? e.message : e,
    );
    return expression;
  }

  // 收集骰子记录
  for (const roll of result.diceRolls) {
    state.diceRolls.push({
      expression: roll.expression,
      rolls: roll.rolls,
      modifier: roll.modifier,
      total: roll.total,
    });
  }

  return result.value;
}

function evalNumber(
  expression: string | number | boolean,
  context: ExecutionContext,
  state: InternalExecutionState,
  targetEntityId?: string,
): number {
  const value = evalExpr(expression, context, state, targetEntityId);
  if (typeof value === "number") return value;
  if (typeof value === "boolean") return value ? 1 : 0;
  const parsed = Number(value);
  if (Number.isFinite(parsed)) return parsed;
  throw new Error(`表达式 "${expression}" 结果不是数字: ${value}`);
}

function getEntityTypeOrDefault(
  entities: EntityAccessor,
  entityId: string,
): EntityType {
  return entities.getEntityType(entityId) ?? "character";
}

// ─── EvaluationContext 构建辅助 ────────────────────────────

/**
 * 从引擎当前状态构建求值器所需的 EvaluationContext
 * 用于 resolveValueExpression / resolveDC / evaluateDCFormula
 */
function buildEvaluationContext(
  context: ExecutionContext,
  state: InternalExecutionState,
  actorEntityId: string = context.actorId,
): EvaluationContext {
  // 收集 actor 属性（含 shadow）
  const actorFields = getAllFieldsWithShadow(actorEntityId, context, state);
  const actorAttributes: Record<string, number> = {};
  if (actorFields) {
    for (const [k, v] of Object.entries(actorFields)) {
      if (typeof v === "number") actorAttributes[k] = v;
    }
  }

  // 构建 vars（从 state.variables 中提取 number/boolean）
  const vars: Record<string, number | boolean> = {};
  for (const [k, v] of Object.entries(state.variables)) {
    if (typeof v === "number" || typeof v === "boolean") {
      vars[k] = v;
    }
  }

  return {
    actorAttributes,
    vars,
    getEntityAttributes: (entityId: string) => {
      const resolvedEntityId =
        entityId === "target" && context.targetId
          ? resolveEntityId(context.targetId, context, state)
          : resolveEntityId(entityId, context, state);
      const fields = getAllFieldsWithShadow(resolvedEntityId, context, state);
      if (!fields) return undefined;
      const numericFields: Record<string, number> = {};
      for (const [k, v] of Object.entries(fields)) {
        if (typeof v === "number") numericFields[k] = v;
      }
      return numericFields;
    },
  };
}

/**
 * 从引擎当前状态构建 ConditionContext（扩展 EvaluationContext，含 hasTag/hasItem）
 * 用于 evaluateCondition
 */
function buildConditionContext(
  context: ExecutionContext,
  state: InternalExecutionState,
): ConditionContext {
  const base = buildEvaluationContext(context, state);
  return {
    ...base,
    hasTag: (entityId: string, tag: string) =>
      hasTagWithShadow(entityId, tag, context, state),
    hasItem: (entityId: string, itemName: string) => {
      if (!context.entities.getItems) return false;
      const resolvedId = resolveEntityId(entityId, context, state);
      const items = context.entities.getItems(resolvedId);
      return items.some((item) => item.name === itemName);
    },
  };
}

/**
 * 从引擎状态获取实体的技能修正值
 * 优先查找 skill 字段名对应的属性值
 */
function getSkillModifier(
  entityId: string,
  skill: string,
  context: ExecutionContext,
  state: InternalExecutionState,
): number {
  // 优先从 shadow + EntityAccessor 获取以 skill 名为 key 的属性
  const value = getValueWithShadow(entityId, skill, context, state);
  if (typeof value === "number") return value;

  // 尝试 skill_mod 格式
  const modValue = getValueWithShadow(entityId, `${skill}_mod`, context, state);
  if (typeof modValue === "number") return modValue;

  return 0;
}

// ─── Action 执行器 ────────────────────────────────────────

/**
 * executeCheck — v2 完整检定流程
 *
 * 支持 dcSource 四层分级（formula/opposed/fixed/ai）+ 预设展开
 * + onSuccess/onFailure 内嵌分支 + 对抗检定
 */
function executeCheck(
  action: CheckAction,
  context: ExecutionContext,
  state: InternalExecutionState,
  actionIndex: number,
): void {
  // 1. 预设展开
  let expandedAction = action;
  if (action.preset) {
    expandedAction = expandPreset(action, context.worldConfig.checkRules);
  }

  // 2. 解析检定执行者（check.target 表示执行检定的实体）
  const checkActorId = expandedAction.target
    ? resolveEntityId(expandedAction.target, context, state)
    : context.actorId;
  const checkTargetId = context.targetId
    ? resolveEntityId(context.targetId, context, state)
    : undefined;

  // 3. 构建 EvaluationContext
  const evalCtx = buildEvaluationContext(context, state, checkActorId);

  // 4. 解析 DC
  const dcResolution: DCResolution = resolveDC(expandedAction, evalCtx);

  // 5. A3: 从 WorldConfig 读取骰子表达式
  const diceExpr = context.worldConfig.checkRules.defaultDice ?? "1d20";
  const diceResult = evaluateExpression(
    diceExpr,
    buildVariables(context, state, checkTargetId),
    state.random,
  );
  const rawRoll = typeof diceResult.value === "number" ? diceResult.value : 0;

  // 记录骰子
  for (const roll of diceResult.diceRolls) {
    state.diceRolls.push({
      ...roll,
      purpose: expandedAction.name ?? expandedAction.skill,
    });
  }

  // 5. 计算修正值
  const skillMod = getSkillModifier(
    checkActorId,
    expandedAction.skill,
    context,
    state,
  );
  const extraMod =
    expandedAction.modifier !== undefined
      ? resolveValueExpression(expandedAction.modifier, evalCtx)
      : 0;

  // ── 天赋系统：收集 actor 的被动检定修正 ──
  let passiveBonus = 0;
  const passiveMods = collectPassiveModifiers(
    checkActorId,
    context.entities,
    context.worldConfig,
  );

  for (const mod of passiveMods) {
    if (mod.scope !== "check") continue;
    if (mod.filter && mod.filter !== expandedAction.skill) continue;

    const modValue =
      mod.value !== undefined
        ? evalNumber(mod.value, context, state, checkTargetId)
        : 0;

    passiveBonus += modValue;
    state.modifiersApplied.push({
      source: mod.reason,
      target: checkActorId,
      value: modValue,
      reason: mod.reason,
    });
  }

  const totalModifier = skillMod + extraMod + passiveBonus;
  let attackerTotal = rawRoll + totalModifier;

  // 6. 根据 DC 结果类型判定
  let success: boolean;
  let dc: number | undefined;
  let margin: number;
  let opposedRoll: number | undefined;
  let opposedModifier: number | undefined;
  let opposedTotal: number | undefined;
  let opposedSkillName: string | undefined;
  let dcFormulaUsed: string | undefined;
  const dcSource = expandedAction.dcSource ?? "ai";

  if (dcResolution.type === "standard") {
    // standard 路径（formula/fixed/ai）
    dc = dcResolution.dc;
    success = attackerTotal >= dc;
    margin = attackerTotal - dc;

    // 记录 dcFormula（如果是 formula 来源）
    if (dcSource === "formula" && expandedAction.dcFormula) {
      dcFormulaUsed = expandedAction.dcFormula;
    }
  } else {
    // opposed 路径
    const defenderEntityId = resolveEntityId(
      dcResolution.opposedEntityId,
      context,
      state,
    );
    const defenderDiceResult = evaluateExpression(
      diceExpr,
      buildVariables(context, state, defenderEntityId),
      state.random,
    );
    opposedRoll =
      typeof defenderDiceResult.value === "number"
        ? defenderDiceResult.value
        : 0;

    // 记录对方骰子
    for (const roll of defenderDiceResult.diceRolls) {
      state.diceRolls.push({
        ...roll,
        purpose: `${expandedAction.name ?? expandedAction.skill} (对抗方)`,
      });
    }

    opposedModifier = getSkillModifier(
      defenderEntityId,
      dcResolution.opposedSkill,
      context,
      state,
    );
    opposedSkillName = dcResolution.opposedSkill;

    const queuedRolls: number[] = [rawRoll, opposedRoll];
    const opposedResult = executeOpposedCheck(
      totalModifier,
      opposedModifier,
      () => {
        const nextRoll = queuedRolls.shift();
        if (nextRoll === undefined) {
          throw new Error("对抗检定预置骰值不足");
        }
        return nextRoll;
      },
    );

    attackerTotal = opposedResult.attackerTotal;
    opposedRoll = opposedResult.defenderRoll;
    opposedTotal = opposedResult.defenderTotal;
    success = opposedResult.success;
    margin = opposedResult.margin;
  }

  // 7. 构建 CheckResult（使用 v2 扩展字段）
  const check: Check = {
    name: expandedAction.name ?? expandedAction.skill,
    skill: expandedAction.skill,
    roll: rawRoll,
    modifier: totalModifier,
    total: attackerTotal,
    dcSource,
    dc,
    dcFormulaUsed,
    opposedRoll,
    opposedModifier,
    opposedTotal,
    opposedSkill: opposedSkillName,
    success,
    margin,
  };

  state.checks.push(check);

  // 8. 写入 resultVar（v2 契约：裸变量键）
  if (expandedAction.resultVar) {
    state.variables[expandedAction.resultVar] = success;
  }

  // 9. 执行分支（onSuccess / onFailure）—— 受嵌套深度限制
  state.currentDepth++;
  if (state.currentDepth > EXECUTION_LIMITS.maxRecursionDepth) {
    state.currentDepth--;
    throw new Error(
      `嵌套超限：深度 ${state.currentDepth + 1}（上限 ${EXECUTION_LIMITS.maxRecursionDepth}）`,
    );
  }

  try {
    const branchActions = success
      ? expandedAction.onSuccess
      : (expandedAction.onFailure ?? []);

    for (const subAction of branchActions) {
      executeAction(subAction, context, state, actionIndex);
    }
  } finally {
    state.currentDepth--;
  }
}

// A4: damage 支持自定义字段 + A0: shadow-aware 读写 + B2: on_damage 触发
function executeDamage(
  action: DamageAction,
  context: ExecutionContext,
  state: InternalExecutionState,
  actionIndex: number,
): void {
  const targetId = resolveEntityId(action.target, context, state);
  const field = action.field ?? getDefaultResourceField(context.worldConfig);
  let rawAmount = evalNumber(action.amount, context, state, targetId);

  // ── 天赋系统：攻击者的 damage_dealt 被动修正 ──
  if (!state.damageContext) {
    const attackerMods = collectPassiveModifiers(
      context.actorId,
      context.entities,
      context.worldConfig,
    );
    for (const mod of attackerMods) {
      if (mod.scope !== "damage_dealt") continue;
      if (mod.filter && mod.filter !== action.damageType) continue;

      if (mod.value !== undefined) {
        const bonus = evalNumber(mod.value, context, state, targetId);
        rawAmount += bonus;
        state.modifiersApplied.push({
          source: mod.reason,
          target: context.actorId,
          value: bonus,
          reason: mod.reason,
        });
      }
      if (mod.multiplier !== undefined) {
        rawAmount = Math.floor(rawAmount * mod.multiplier);
        state.modifiersApplied.push({
          source: mod.reason,
          target: context.actorId,
          value: mod.multiplier,
          reason: `${mod.reason} (×${mod.multiplier})`,
        });
      }
    }
  }
  // ── damage_dealt 修正结束 ──

  // ── B2: on_damage 触发（仅在非触发器上下文中执行，防止级联） ──
  let finalAmount = rawAmount;

  if (!state.damageContext) {
    // 不在 on_damage 触发器内部 → 可以触发 on_damage
    const onDamageTriggers = findOnDamageTriggers(
      targetId,
      action.damageType,
      context.entities,
      context.worldConfig,
    );

    // ── 天赋系统：收集目标的 damage_taken 被动修正 ──
    const targetPassiveMods = collectPassiveModifiers(
      targetId,
      context.entities,
      context.worldConfig,
    );
    const damageTakenMods = targetPassiveMods.filter(
      (m) =>
        m.scope === "damage_taken" &&
        (!m.filter || m.filter === action.damageType),
    );
    // ── damage_taken 收集结束 ──

    if (onDamageTriggers.length > 0 || damageTakenMods.length > 0) {
      // 构建 DamageContext
      const damageCtx: DamageContext = {
        rawAmount,
        damageType: action.damageType,
        sourceId: context.actorId,
        targetId,
        field,
        modifications: [],
      };

      // 注入特殊变量
      state.variables["$incoming_damage"] = rawAmount;
      state.variables["$damage_type"] = action.damageType ?? "";
      state.variables["$source"] = context.actorId;
      state.variables["$target"] = targetId;

      // 设置 damageContext 供 executeModifyDamage 使用
      state.damageContext = damageCtx;

      try {
        // ── 天赋系统：注入 damage_taken 被动修正（在 on_damage 触发器之前） ──
        for (const mod of damageTakenMods) {
          const modification: DamageModification = {
            source: mod.reason,
            multiplier: mod.multiplier,
            reduction:
              mod.value !== undefined
                ? evalNumber(mod.value, context, state, targetId)
                : undefined,
            reason: mod.reason,
          };
          damageCtx.modifications.push(modification);
          state.modifiersApplied.push({
            source: mod.reason,
            target: targetId,
            value:
              mod.multiplier ??
              (mod.value !== undefined
                ? -evalNumber(mod.value, context, state, targetId)
                : 0),
            reason: mod.reason,
          });
        }
        // ── damage_taken 注入结束 ──

        // 执行每个匹配的 on_damage 触发器
        for (const { tagId, tagMeta, trigger } of onDamageTriggers) {
          // 创建触发器上下文（actorId = 拥有标签的实体 = 目标）
          const triggerContext: ExecutionContext = {
            ...context,
            actorId: targetId,
            targetId: context.actorId, // source 成为 target
          };

          try {
            for (const triggerAction of trigger.actions ?? []) {
              executeAction(
                triggerAction as RuleAction,
                triggerContext,
                state,
                actionIndex,
              );
            }
          } catch (error) {
            console.warn(
              `[RulesEngine] on_damage 触发器 "${tagMeta.displayName}" (${tagId}) 执行失败:`,
              error instanceof Error ? error.message : error,
            );
          }
        }

        // 应用伤害修改
        finalAmount = applyDamageModifications(
          rawAmount,
          damageCtx.modifications,
        );
      } finally {
        // 清理 damageContext
        state.damageContext = undefined;
        // 清理特殊变量
        delete state.variables["$incoming_damage"];
        delete state.variables["$damage_type"];
        delete state.variables["$source"];
        delete state.variables["$target"];
      }
    }
  }
  // 如果已在 damageContext 中（级联伤害），直接使用 rawAmount，不触发 on_damage

  // A0: shadow-aware 读取
  const currentValue = getValueWithShadow(targetId, field, context, state);

  if (typeof currentValue !== "number") {
    throw new Error(`实体 "${targetId}" 没有 ${field} 属性`);
  }

  const newValue = currentValue - finalAmount;
  const entityType = getEntityTypeOrDefault(context.entities, targetId);

  // A0: 写入 shadow
  setShadowField(state, targetId, field, newValue);

  // 构建 reason（含伤害修改链信息）
  let reason = action.reason ?? `${action.damageType ?? ""}伤害`.trim();
  if (finalAmount !== rawAmount && state.damageContext === undefined) {
    reason += ` (原始 ${rawAmount}, 修改后 ${finalAmount})`;
  }

  state.valueChanges.push({
    entityId: targetId,
    entityType,
    field,
    oldValue: currentValue,
    newValue,
    delta: -finalAmount,
    reason,
  });
}

/**
 * 应用伤害修改列表
 *
 * 先应用所有乘数（相乘），再应用所有减免（相加），最后 floor 并下限为 0。
 */
function applyDamageModifications(
  rawAmount: number,
  modifications: DamageModification[],
): number {
  let amount = rawAmount;

  // 先应用乘数
  for (const mod of modifications) {
    if (mod.multiplier !== undefined) {
      amount *= mod.multiplier;
    }
  }

  // 再应用减免
  for (const mod of modifications) {
    if (mod.reduction !== undefined) {
      amount -= mod.reduction;
    }
  }

  // 下限为 0，取整
  return Math.max(0, Math.floor(amount));
}

// heal: 恢复资源值（带上限钳制）+ A0: shadow-aware 读写
function executeHeal(
  action: HealAction,
  context: ExecutionContext,
  state: InternalExecutionState,
): void {
  const targetId = resolveEntityId(action.target, context, state);
  const field = action.field ?? getDefaultResourceField(context.worldConfig);
  const resourcePairs = getResourcePairs(context.worldConfig);
  const maxField = action.maxField ?? resourcePairs[field] ?? `max_${field}`;
  const amount = evalNumber(action.amount, context, state, targetId);

  // A0: shadow-aware 读取
  const currentValue = getValueWithShadow(targetId, field, context, state);

  if (typeof currentValue !== "number") {
    throw new Error(`实体 "${targetId}" 没有 ${field} 属性`);
  }

  const maxValue = getValueWithShadow(targetId, maxField, context, state);
  const cap = typeof maxValue === "number" ? maxValue : Infinity;
  const newValue = Math.min(currentValue + amount, cap);
  const entityType = getEntityTypeOrDefault(context.entities, targetId);

  // A0: 写入 shadow
  setShadowField(state, targetId, field, newValue);

  state.valueChanges.push({
    entityId: targetId,
    entityType,
    field,
    oldValue: currentValue,
    newValue,
    delta: newValue - currentValue,
    reason: action.reason ?? "恢复资源",
  });
}

// cost: 消耗资源值（不触发 on_damage）+ A0: shadow-aware 读写
function executeCost(
  action: CostAction,
  context: ExecutionContext,
  state: InternalExecutionState,
): void {
  const targetId = resolveEntityId(action.target, context, state);
  const field = action.field ?? getDefaultResourceField(context.worldConfig);
  const amount = evalNumber(action.amount, context, state, targetId);

  // A0: shadow-aware 读取
  const currentValue = getValueWithShadow(targetId, field, context, state);

  if (typeof currentValue !== "number") {
    throw new Error(`实体 "${targetId}" 没有 ${field} 属性`);
  }

  const newValue = currentValue - amount;
  const entityType = getEntityTypeOrDefault(context.entities, targetId);

  // A0: 写入 shadow
  setShadowField(state, targetId, field, newValue);

  state.valueChanges.push({
    entityId: targetId,
    entityType,
    field,
    oldValue: currentValue,
    newValue,
    delta: -amount,
    reason: action.reason ?? "消耗资源",
  });
}

function executeRoll(
  action: RollAction,
  context: ExecutionContext,
  state: InternalExecutionState,
): void {
  const result = evaluateExpression(
    action.expression,
    buildVariables(context, state),
    state.random,
  );

  // 收集骰子记录
  for (const roll of result.diceRolls) {
    state.diceRolls.push({
      expression: roll.expression,
      rolls: roll.rolls,
      modifier: roll.modifier,
      total: roll.total,
      purpose: action.purpose,
    });
  }

  if (action.resultVar) {
    state.variables[action.resultVar] = result.value;
  }
}

// A0: shadow-aware 标签操作 + C5: 收集 TagMetadata
function executeAddTag(
  action: AddTagAction,
  context: ExecutionContext,
  state: InternalExecutionState,
): void {
  const targetId = resolveEntityId(action.target, context, state);
  // A0: shadow-aware 读取
  const hadTag = hasTagWithShadow(targetId, action.tag, context, state);
  const entityType = getEntityTypeOrDefault(context.entities, targetId);

  // A0: 写入 shadow
  addShadowTag(state, targetId, action.tag);

  // C5: 构建 TagMetadata 并记录到 tagChanges
  // 优先使用 action 中的描述字段，回退到 WorldConfig 预定义 condition
  const predefinedCondition = context.worldConfig.conditions?.find(
    (c) => c.id === action.tag,
  );

  const metadata: TagMetadata = {
    id: action.tag,
    displayName: action.displayName ?? predefinedCondition?.name ?? action.tag,
    effectDescription:
      action.effectDescription ??
      predefinedCondition?.description ??
      action.reason ??
      "",
    trigger: action.trigger ?? predefinedCondition?.trigger,
    remainingDuration: action.duration ?? predefinedCondition?.duration,
    source: predefinedCondition ? "predefined" : "ai-generated",
  };

  state.tagChanges.push({
    entityId: targetId,
    tagId: action.tag,
    action: "add",
    metadata,
  });

  state.valueChanges.push({
    entityId: targetId,
    entityType,
    field: `tags.${action.tag}`,
    oldValue: hadTag,
    newValue: true,
    reason: action.reason ?? `添加标签 ${action.tag}`,
  });
}

// A0: shadow-aware 标签移除 + C5: 记录移除到 tagChanges
function executeRemoveTag(
  action: RemoveTagAction,
  context: ExecutionContext,
  state: InternalExecutionState,
): void {
  const targetId = resolveEntityId(action.target, context, state);
  // A0: shadow-aware 读取
  const hadTag = hasTagWithShadow(targetId, action.tag, context, state);
  const entityType = getEntityTypeOrDefault(context.entities, targetId);

  // A0: 写入 shadow
  removeShadowTag(state, targetId, action.tag);

  // C5: 记录标签移除
  state.tagChanges.push({
    entityId: targetId,
    tagId: action.tag,
    action: "remove",
  });

  state.valueChanges.push({
    entityId: targetId,
    entityType,
    field: `tags.${action.tag}`,
    oldValue: hadTag,
    newValue: false,
    reason: action.reason ?? `移除标签 ${action.tag}`,
  });
}

function executeModifyTag(
  action: ModifyTagAction,
  context: ExecutionContext,
  state: InternalExecutionState,
): void {
  const targetId = resolveEntityId(action.target, context, state);
  const entityType = getEntityTypeOrDefault(context.entities, targetId);

  // modifyTag 用于标签元数据操作（层数等），当前以 ValueChange 形式记录
  const oldValue = context.entities.getValue(
    targetId,
    `tags.${action.tag}.${action.operation}`,
  );
  const newValue =
    action.value !== undefined
      ? evalExpr(action.value, context, state, targetId)
      : true;

  state.valueChanges.push({
    entityId: targetId,
    entityType,
    field: `tags.${action.tag}.${action.operation}`,
    oldValue: oldValue ?? 0,
    newValue,
    reason: action.reason ?? `修改标签 ${action.tag} (${action.operation})`,
  });
}

// A0: shadow-aware set（原 setValue）
function executeSet(
  action: SetAction,
  context: ExecutionContext,
  state: InternalExecutionState,
): void {
  const targetId = resolveEntityId(action.target, context, state);
  const newValue = evalExpr(action.value, context, state, targetId);
  // A0: shadow-aware 读取旧值
  const oldValue = getValueWithShadow(targetId, action.field, context, state);
  const entityType = getEntityTypeOrDefault(context.entities, targetId);

  // Phase 4: oldValue 未定义警告
  if (oldValue === undefined) {
    const knownIds = context.entities.getAllEntityIds?.() ?? [];
    console.warn(
      `[RulesEngine] set: 实体 "${targetId}" 的字段 "${action.field}" 的 oldValue 为 undefined。` +
        `已注册的实体 ID: [${knownIds.join(", ")}]`,
    );
  }

  const delta =
    typeof newValue === "number" && typeof oldValue === "number"
      ? newValue - oldValue
      : undefined;

  // A0: 写入 shadow
  if (
    typeof newValue === "number" ||
    typeof newValue === "string" ||
    typeof newValue === "boolean"
  ) {
    setShadowField(state, targetId, action.field, newValue);
  }

  state.valueChanges.push({
    entityId: targetId,
    entityType,
    field: action.field,
    oldValue: oldValue ?? 0,
    newValue,
    delta,
    reason: action.reason,
  });
}

// branch（原 conditional）：使用 evaluateCondition 求值
function executeBranch(
  action: BranchAction,
  context: ExecutionContext,
  state: InternalExecutionState,
  actionIndex: number,
): void {
  state.currentDepth++;
  if (state.currentDepth > EXECUTION_LIMITS.maxRecursionDepth) {
    throw new Error(
      `嵌套超限：深度 ${state.currentDepth}（上限 ${EXECUTION_LIMITS.maxRecursionDepth}）`,
    );
  }

  try {
    const condCtx = buildConditionContext(context, state);
    const isTruthy = evaluateCondition(action.condition, condCtx);

    const branch = isTruthy ? action.then : action.else;
    if (branch) {
      for (const subAction of branch) {
        executeAction(subAction, context, state, actionIndex);
      }
    }
  } finally {
    state.currentDepth--;
  }
}

// B2: modifyDamage 只在 on_damage 触发器中有效
function executeModifyDamage(
  action: ModifyDamageAction,
  context: ExecutionContext,
  state: InternalExecutionState,
): void {
  if (!state.damageContext) {
    throw new Error(
      "modifyDamage action 只能在 on_damage 触发器中使用，当前没有活跃的 DamageContext",
    );
  }

  const mod: DamageModification = {
    source: "trigger",
    reason: action.reason ?? "伤害修改",
  };

  if (action.multiplier !== undefined) {
    mod.multiplier = evalNumber(action.multiplier, context, state);
  }
  if (action.reduction !== undefined) {
    mod.reduction = evalNumber(action.reduction, context, state);
  }

  state.damageContext.modifications.push(mod);
}

// ─── NPC Action 执行器 ────────────────────────────────────

/** 生成唯一的 NPC 实体 ID */
function generateNpcId(random: () => number): string {
  const timestamp = Date.now();
  const rand = Math.floor(random() * 0xffff)
    .toString(16)
    .padStart(4, "0");
  return `npc_${timestamp}_${rand}`;
}

/** 从已创建 NPC 列表或 EntityAccessor 获取 NPC 名称 */
function getNpcName(
  npcId: string,
  context: ExecutionContext,
  state: InternalExecutionState,
): string {
  const created = state.createdNpcs.find((n) => n.id === npcId);
  if (created) return created.name;

  const name = getValueWithShadow(npcId, "name", context, state);
  if (typeof name === "string") return name;

  return npcId;
}

function registerNpcAlias(
  aliasMap: EntityAliasMap | undefined,
  npcId: string,
  npcName: string,
): void {
  if (!aliasMap) return;

  const normalizedName = npcName.trim().toLowerCase();
  if (normalizedName.length === 0) return;

  const existingId = aliasMap.aliases.get(normalizedName);

  if (!existingId) {
    aliasMap.aliases.set(normalizedName, npcId);
    aliasMap.displayNames.set(npcId, npcName);
    return;
  }

  if (existingId === npcId) return;

  const existingDisplay = aliasMap.displayNames.get(existingId);
  if (existingDisplay && !existingDisplay.includes("#")) {
    aliasMap.aliases.set(`${normalizedName}#1`, existingId);
    aliasMap.displayNames.set(existingId, `${existingDisplay}#1`);
  }

  let index = 2;
  while (aliasMap.aliases.has(`${normalizedName}#${index}`)) {
    index++;
  }
  aliasMap.aliases.set(`${normalizedName}#${index}`, npcId);
  aliasMap.displayNames.set(npcId, `${npcName}#${index}`);
}

// spawn（原 npcCreate）：适配 v2 的 entity 嵌套结构
function executeSpawn(
  action: SpawnAction,
  context: ExecutionContext,
  state: InternalExecutionState,
): void {
  const npcId = generateNpcId(state.random);
  const attributes = action.entity.attributes ?? {};

  // 构建 NPC 数据记录
  const npcData: CreatedNpcData = {
    id: npcId,
    name: action.entity.name,
    description: action.entity.description,
    personality: action.entity.personality,
    appearance: action.entity.appearance,
    attributes,
    talentIds: action.entity.talentIds,
  };

  state.createdNpcs.push(npcData);

  // 运行时更新 aliasMap，使本回合后续 action 可通过名称解析到新 NPC
  registerNpcAlias(context.aliasMap, npcId, action.entity.name);

  // 将所有初始数据写入 fieldOverlay（新 NPC 不在 EntityAccessor 中）
  setShadowField(state, npcId, "name", action.entity.name);
  if (action.entity.description) {
    setShadowField(state, npcId, "description", action.entity.description);
  }
  if (action.entity.personality) {
    setShadowField(state, npcId, "personality", action.entity.personality);
  }
  if (action.entity.appearance) {
    setShadowField(state, npcId, "appearance", action.entity.appearance);
  }

  for (const [field, value] of Object.entries(attributes)) {
    setShadowField(state, npcId, field, value);
  }

  // 设置初始状态
  setShadowField(state, npcId, "status", "active");

  // 记录到 valueChanges
  state.valueChanges.push({
    entityId: npcId,
    entityType: "character",
    field: "npc.create",
    oldValue: false,
    newValue: true,
    reason: `NPC「${action.entity.name}」加入场景`,
  });

  // 记录到 NPC 摘要
  state.npcSummaryEntries.push({
    type: "create",
    npcId,
    npcName: action.entity.name,
    detail: action.entity.description ?? "",
  });
}

// despawn（原 npcStatusChange）：适配 mode: "temporary" | "permanent"
function executeDespawn(
  action: DespawnAction,
  context: ExecutionContext,
  state: InternalExecutionState,
): void {
  const npcId = resolveEntityId(action.entityId, context, state);

  // 验证实体存在（在 EntityAccessor 或已创建的 NPC 中）
  const isCreatedNpc = state.createdNpcs.some((n) => n.id === npcId);
  const existsInAccessor = context.entities.getEntityType(npcId) !== undefined;

  if (!isCreatedNpc && !existsInAccessor) {
    throw new Error(
      `实体 "${npcId}" 不存在（不在 EntityAccessor 或已创建的 NPC 中）`,
    );
  }

  const npcName = getNpcName(npcId, context, state);
  const oldStatus = getValueWithShadow(npcId, "status", context, state);
  const oldStatusStr = typeof oldStatus === "string" ? oldStatus : "active";

  // 根据 mode 映射到对应状态
  const newStatus = action.mode === "permanent" ? "archived" : "off_scene";

  // 写入 fieldOverlay
  setShadowField(state, npcId, "status", newStatus);

  // 记录 valueChange
  state.valueChanges.push({
    entityId: npcId,
    entityType: "character",
    field: "status",
    oldValue: oldStatusStr,
    newValue: newStatus,
    reason:
      action.reason ??
      `NPC「${npcName}」${action.mode === "permanent" ? "永久离场" : "暂时离场"}`,
  });

  // 记录到 NPC 摘要
  state.npcSummaryEntries.push({
    type: "statusChange",
    npcId,
    npcName,
    detail: `${oldStatusStr} → ${newStatus} (${action.mode})`,
  });
}

// ─── 装备/背包/技能 Action 执行器 ──────────────────────────

function executeGrantItem(
  action: GrantItemAction,
  context: ExecutionContext,
  state: InternalExecutionState,
): void {
  const targetId = resolveEntityId(action.target, context, state);

  // 背包容量检查（如果 EntityAccessor 支持 getItems）
  if (context.entities.getItems) {
    const currentItems = context.entities.getItems(targetId);
    const capacity = context.worldConfig.inventoryRules?.defaultCapacity ?? 20;
    if (currentItems.length >= capacity) {
      console.warn(
        `[RulesEngine] grantItem: 角色 "${targetId}" 背包已满（${currentItems.length}/${capacity}），跳过物品 "${action.name}"`,
      );
      // 记录失败的 StructuralChange
      state.structuralChanges.push({
        type: "item_added",
        entityId: `failed_${crypto.randomUUID()}`,
        targetId,
        templateId: action.templateId,
        details: {
          name: action.name,
          category: action.category,
          quantity: action.quantity ?? 1,
          failed: true,
          failReason: "背包已满",
        },
        reason: action.reason ?? `获得物品「${action.name}」（失败：背包已满）`,
      });
      return;
    }
  }

  // 装备槽位校验（运行时 WorldConfig 驱动）
  if (typeof action.equipSlot === "string") {
    const slotDefinitions =
      context.worldConfig.inventoryRules?.equipSlotDefinitions;

    if (!slotDefinitions || slotDefinitions.length === 0) {
      console.warn(
        `[RulesEngine] grantItem: 当前世界没有装备系统，无法设置装备槽位 "${action.equipSlot}"`,
      );
      state.structuralChanges.push({
        type: "item_added",
        entityId: `failed_${crypto.randomUUID()}`,
        targetId,
        templateId: action.templateId,
        details: {
          name: action.name,
          category: action.category,
          quantity: action.quantity ?? 1,
          failed: true,
          failReason: "当前世界没有装备系统",
        },
        reason:
          action.reason ??
          `获得物品「${action.name}」（失败：当前世界没有装备系统）`,
      });
      return;
    }

    const slotDefinition = slotDefinitions.find(
      (slot) => slot.id === action.equipSlot,
    );
    if (!slotDefinition) {
      console.warn(
        `[RulesEngine] grantItem: 无效装备槽位 "${action.equipSlot}"，跳过物品 "${action.name}"`,
      );
      state.structuralChanges.push({
        type: "item_added",
        entityId: `failed_${crypto.randomUUID()}`,
        targetId,
        templateId: action.templateId,
        details: {
          name: action.name,
          category: action.category,
          quantity: action.quantity ?? 1,
          failed: true,
          failReason: `无效装备槽位: ${action.equipSlot}`,
        },
        reason:
          action.reason ?? `获得物品「${action.name}」（失败：无效装备槽位）`,
      });
      return;
    }

    if (
      slotDefinition.allowedCategories &&
      !slotDefinition.allowedCategories.some(
        (allowedCategory) => allowedCategory === action.category,
      )
    ) {
      console.warn(
        `[RulesEngine] grantItem: 槽位 "${slotDefinition.id}" 不允许类别 "${action.category}"，跳过物品 "${action.name}"`,
      );
      state.structuralChanges.push({
        type: "item_added",
        entityId: `failed_${crypto.randomUUID()}`,
        targetId,
        templateId: action.templateId,
        details: {
          name: action.name,
          category: action.category,
          quantity: action.quantity ?? 1,
          failed: true,
          failReason: `${slotDefinition.label} 不允许类别 ${action.category}`,
        },
        reason:
          action.reason ??
          `获得物品「${action.name}」（失败：装备槽位类别不匹配）`,
      });
      return;
    }
  }

  // 生成新的物品实例 ID
  const instanceId = crypto.randomUUID();

  state.structuralChanges.push({
    type: "item_added",
    entityId: instanceId,
    targetId,
    templateId: action.templateId,
    details: {
      name: action.name,
      description: action.description,
      category: action.category,
      quantity: action.quantity ?? 1,
      ...(typeof action.equipSlot === "string"
        ? { equipSlot: action.equipSlot }
        : {}),
    },
    reason: action.reason ?? `获得物品「${action.name}」`,
  });
}

function executeRemoveItem(
  action: RemoveItemAction,
  context: ExecutionContext,
  state: InternalExecutionState,
): void {
  const targetId = resolveEntityId(action.target, context, state);

  // 验证物品是否存在（如果 EntityAccessor 支持 getItems）
  if (context.entities.getItems) {
    const currentItems = context.entities.getItems(targetId);
    const item = currentItems.find((i) => i.instanceId === action.instanceId);
    if (!item) {
      console.warn(
        `[RulesEngine] removeItem: 角色 "${targetId}" 没有物品实例 "${action.instanceId}"，跳过`,
      );
      return;
    }
  }

  state.structuralChanges.push({
    type: "item_removed",
    entityId: action.instanceId,
    targetId,
    details: {
      quantity: action.quantity ?? 1,
    },
    reason: action.reason ?? "移除物品",
  });
}

function executeGrantSkill(
  action: GrantSkillAction,
  context: ExecutionContext,
  state: InternalExecutionState,
): void {
  const targetId = resolveEntityId(action.target, context, state);

  // 去重检查（如果 EntityAccessor 支持 getSkills）
  if (context.entities.getSkills) {
    const currentSkills = context.entities.getSkills(targetId);
    const duplicate = currentSkills.find((s) => s.name === action.name);
    if (duplicate) {
      console.warn(
        `[RulesEngine] grantSkill: 角色 "${targetId}" 已拥有同名技能 "${action.name}"，跳过`,
      );
      state.structuralChanges.push({
        type: "skill_learned",
        entityId: `failed_${crypto.randomUUID()}`,
        targetId,
        templateId: action.templateId,
        details: {
          name: action.name,
          category: action.category,
          failed: true,
          failReason: "已拥有同名技能",
        },
        reason: action.reason ?? `习得技能「${action.name}」（失败：已拥有）`,
      });
      return;
    }
  }

  const instanceId = crypto.randomUUID();

  state.structuralChanges.push({
    type: "skill_learned",
    entityId: instanceId,
    targetId,
    templateId: action.templateId,
    details: {
      name: action.name,
      description: action.description,
      category: action.category,
      activeUsable: action.activeUsable ?? false,
      ...(action.cost
        ? { costField: action.cost.field, costAmount: action.cost.amount }
        : {}),
    },
    reason: action.reason ?? `习得技能「${action.name}」`,
  });
}

function executeRemoveSkill(
  action: RemoveSkillAction,
  context: ExecutionContext,
  state: InternalExecutionState,
): void {
  const targetId = resolveEntityId(action.target, context, state);

  // 验证技能是否存在（如果 EntityAccessor 支持 getSkills）
  if (context.entities.getSkills) {
    const currentSkills = context.entities.getSkills(targetId);
    const skill = currentSkills.find((s) => s.instanceId === action.instanceId);
    if (!skill) {
      console.warn(
        `[RulesEngine] removeSkill: 角色 "${targetId}" 没有技能实例 "${action.instanceId}"，跳过`,
      );
      return;
    }
  }

  state.structuralChanges.push({
    type: "skill_removed",
    entityId: action.instanceId,
    targetId,
    reason: action.reason ?? "移除技能",
  });
}

// ─── 导出单例 ─────────────────────────────────────────────

export const rulesEngine: RulesEngine = new BasicRulesEngine();

// ─── 抑制未使用导入的类型引用（供外部模块使用） ──────────────

export type {
  ConditionContext as _ConditionContext,
  DCResolution as _DCResolution,
  EvaluationContext as _EvaluationContext,
};
