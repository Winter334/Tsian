/**
 * 消耗品双路径执行器
 *
 * 路径 A：确定性 action（heal/cost/set/addTag/removeTag）直接写 Yjs
 * 路径 B：包含 check/damage/roll 时交由 RulesEngine 执行
 */

import { services } from "@/core";
import {
  GAME_STATE_SERVICE_TOKEN,
  type GameStateServiceContract,
} from "@/core/services/tokens";
import type { ItemInstance } from "@/domain/entities/item";
import type { ResultFrame, TagMetadata } from "@/domain/types";
import type {
  AddTagAction,
  CostAction,
  HealAction,
  RemoveTagAction,
  RuleAction,
  RuleScript,
  SetAction,
  ValueExpression,
} from "@/domain/types/rule-script";
import { BasicRulesEngine } from "@/lib/rules/engine";
import type { WorldConfig } from "@/lib/world";
import {
  getDefaultResourceField,
  getResourcePairs,
  getRuntimeWorldConfig,
} from "@/lib/world";

const ENGINE_ACTION_TYPES = new Set(["check", "damage", "roll"]);

export function requiresEngine(actions: RuleAction[]): boolean {
  return actions.some((action) => ENGINE_ACTION_TYPES.has(action.type));
}

/**
 * 检查 onUse actions 是否需要目标但未提供
 * 返回 true 表示校验通过，false 表示缺少必要的目标
 */
export function validateTargetRequirement(
  actions: RuleAction[],
  targetId: string | undefined,
): boolean {
  if (targetId) return true;

  return !actions.some((action) => {
    const target = (action as { target?: string }).target;
    return target === "$target";
  });
}

export function resolveTarget(
  target: string | undefined,
  actorId: string,
  targetId?: string,
): string | undefined {
  if (!target || target === "self" || target === "$self") {
    return actorId;
  }

  if (target === "$target") {
    if (!targetId) {
      console.warn(
        "[ConsumableExecutor] target 使用了 $target，但未提供 targetId",
      );
      return undefined;
    }
    return targetId;
  }

  return target;
}

export function evaluateSimpleValue(
  amount: ValueExpression,
): number | undefined {
  if (typeof amount === "number" && Number.isFinite(amount)) {
    return amount;
  }

  if (typeof amount === "string") {
    const trimmed = amount.trim();
    const parsed = Number(trimmed);
    if (trimmed.length > 0 && Number.isFinite(parsed)) {
      return parsed;
    }

    console.warn(
      `[ConsumableExecutor] 路径 A 仅支持纯数值，收到不可解析表达式: "${amount}"`,
    );
    return undefined;
  }

  console.warn(
    `[ConsumableExecutor] 路径 A 仅支持纯数值，收到类型: ${typeof amount}`,
  );
  return undefined;
}

export function executeSimpleAction(
  action: RuleAction,
  actorId: string,
  targetId?: string,
): void {
  const gameStateService = getGameStateService();
  const worldConfig = getRuntimeWorldConfig();

  switch (action.type) {
    case "heal":
      executeHealAction(
        action,
        gameStateService,
        worldConfig,
        actorId,
        targetId,
      );
      return;
    case "cost":
      executeCostAction(
        action,
        gameStateService,
        worldConfig,
        actorId,
        targetId,
      );
      return;
    case "set":
      executeSetAction(action, gameStateService, actorId, targetId);
      return;
    case "addTag":
      executeAddTagAction(
        action,
        gameStateService,
        worldConfig,
        actorId,
        targetId,
      );
      return;
    case "removeTag":
      executeRemoveTagAction(action, gameStateService, actorId, targetId);
      return;
    default:
      console.warn(
        `[ConsumableExecutor] 路径 A 不支持 action 类型: ${action.type}`,
      );
  }
}

export function executeItemViaEngine(
  actions: RuleAction[],
  actorId: string,
  targetId: string | undefined,
  item: ItemInstance,
): ResultFrame | undefined {
  const gameStateService = getGameStateService();
  const worldConfig = getRuntimeWorldConfig();
  const resolvedActions = actions
    .map((action) => resolveActionTargets(action, actorId, targetId))
    .filter(isResolvedAction);

  if (resolvedActions.length === 0) {
    console.warn(
      "[ConsumableExecutor] onUse actions 目标解析后为空，已跳过执行",
    );
    return undefined;
  }

  const script: RuleScript = {
    version: 2,
    actions: resolvedActions,
  };

  const engine = new BasicRulesEngine();
  const executionResult = engine.execute(script, {
    worldConfig,
    seed: Date.now(),
    entities: gameStateService.buildEntityAccessor(),
    actorId,
    targetId,
    commandId: `item-use:${item.instanceId}`,
  });

  if (!executionResult.success) {
    console.warn(
      "[ConsumableExecutor] RulesEngine 执行失败",
      executionResult.error ?? "未知错误",
    );
    return undefined;
  }

  if (executionResult.validationErrors?.length) {
    for (const validationError of executionResult.validationErrors) {
      const prefix = validationError.level === "error" ? "❌" : "⚠️";
      console.warn(
        `[ConsumableExecutor] 校验 ${prefix} [action#${validationError.actionIndex}${
          validationError.actionType ? ` ${validationError.actionType}` : ""
        }]: ${validationError.message}`,
      );
    }
  }

  const resultFrame = executionResult.resultFrame;
  if (!resultFrame) {
    console.warn("[ConsumableExecutor] 引擎执行成功但缺少 resultFrame");
    return undefined;
  }

  for (const change of resultFrame.valueChanges) {
    if (change.field.startsWith("tags.")) {
      const parts = change.field.split(".");
      if (parts.length >= 3) {
        const tagId = parts[1];
        const property = parts.slice(2).join(".");
        handleTagValueChange(
          gameStateService,
          change.entityId,
          tagId,
          property,
          change.newValue,
        );
      } else {
        console.warn(
          `[ConsumableExecutor] 无法解析 tags valueChange 字段: ${change.field}`,
        );
      }
      continue;
    }

    gameStateService.updateAttribute(
      change.entityId,
      change.field,
      change.newValue,
    );
  }

  for (const tagChange of executionResult.tagChanges) {
    if (tagChange.action === "add") {
      if (!tagChange.metadata) {
        console.warn(
          `[ConsumableExecutor] tagChange(add) 缺少 metadata，已跳过: ${tagChange.tagId}`,
        );
        continue;
      }
      gameStateService.addTag(
        tagChange.entityId,
        tagChange.tagId,
        tagChange.metadata,
      );
      continue;
    }

    gameStateService.removeTag(tagChange.entityId, tagChange.tagId);
  }

  return resultFrame;
}

function getGameStateService(): GameStateServiceContract {
  const service = services.get(GAME_STATE_SERVICE_TOKEN);
  if (!service) {
    throw new Error("[consumable-executor] GameStateService 未注册");
  }
  return service;
}

function executeHealAction(
  action: HealAction,
  gameStateService: GameStateServiceContract,
  worldConfig: WorldConfig,
  actorId: string,
  targetId?: string,
): void {
  const resolvedTargetId = resolveTarget(action.target, actorId, targetId);
  if (!resolvedTargetId) return;

  const character = gameStateService.getCharacter(resolvedTargetId);
  if (!character) {
    console.warn(`[ConsumableExecutor] heal 目标不存在: ${resolvedTargetId}`);
    return;
  }

  const field = action.field ?? getDefaultResourceField(worldConfig);
  const amount = evaluateSimpleValue(action.amount);
  if (amount === undefined) return;

  const currentValue = toFiniteNumber(character.attributes?.[field]);
  if (currentValue === undefined) {
    console.warn(
      `[ConsumableExecutor] heal 字段不是数值: ${resolvedTargetId}.${field}`,
    );
    return;
  }

  const resourcePairs = getResourcePairs(worldConfig);
  const maxField = action.maxField ?? resourcePairs[field] ?? `max_${field}`;
  const maxValue = toFiniteNumber(character.attributes?.[maxField]);
  const cap = maxValue ?? Number.POSITIVE_INFINITY;

  const newValue = Math.min(currentValue + amount, cap);
  gameStateService.updateAttribute(resolvedTargetId, field, newValue);
}

function executeCostAction(
  action: CostAction,
  gameStateService: GameStateServiceContract,
  worldConfig: WorldConfig,
  actorId: string,
  targetId?: string,
): void {
  const resolvedTargetId = resolveTarget(action.target, actorId, targetId);
  if (!resolvedTargetId) return;

  const character = gameStateService.getCharacter(resolvedTargetId);
  if (!character) {
    console.warn(`[ConsumableExecutor] cost 目标不存在: ${resolvedTargetId}`);
    return;
  }

  const field = action.field ?? getDefaultResourceField(worldConfig);
  const amount = evaluateSimpleValue(action.amount);
  if (amount === undefined) return;

  const currentValue = toFiniteNumber(character.attributes?.[field]);
  if (currentValue === undefined) {
    console.warn(
      `[ConsumableExecutor] cost 字段不是数值: ${resolvedTargetId}.${field}`,
    );
    return;
  }

  const newValue = Math.max(currentValue - amount, 0);
  gameStateService.updateAttribute(resolvedTargetId, field, newValue);
}

function executeSetAction(
  action: SetAction,
  gameStateService: GameStateServiceContract,
  actorId: string,
  targetId?: string,
): void {
  const resolvedTargetId = resolveTarget(action.target, actorId, targetId);
  if (!resolvedTargetId) return;

  if (!gameStateService.getCharacter(resolvedTargetId)) {
    console.warn(`[ConsumableExecutor] set 目标不存在: ${resolvedTargetId}`);
    return;
  }

  if (!action.field) {
    console.warn("[ConsumableExecutor] set 缺少 field");
    return;
  }

  gameStateService.updateAttribute(
    resolvedTargetId,
    action.field,
    normalizeSetValue(action.value),
  );
}

function executeAddTagAction(
  action: AddTagAction,
  gameStateService: GameStateServiceContract,
  worldConfig: WorldConfig,
  actorId: string,
  targetId?: string,
): void {
  const resolvedTargetId = resolveTarget(action.target, actorId, targetId);
  if (!resolvedTargetId) return;

  if (!gameStateService.getCharacter(resolvedTargetId)) {
    console.warn(`[ConsumableExecutor] addTag 目标不存在: ${resolvedTargetId}`);
    return;
  }

  const predefinedCondition = worldConfig.conditions?.find(
    (condition) => condition.id === action.tag,
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
    category: "condition",
  };

  gameStateService.addTag(resolvedTargetId, action.tag, metadata);
}

function executeRemoveTagAction(
  action: RemoveTagAction,
  gameStateService: GameStateServiceContract,
  actorId: string,
  targetId?: string,
): void {
  const resolvedTargetId = resolveTarget(action.target, actorId, targetId);
  if (!resolvedTargetId) return;

  if (!gameStateService.getCharacter(resolvedTargetId)) {
    console.warn(
      `[ConsumableExecutor] removeTag 目标不存在: ${resolvedTargetId}`,
    );
    return;
  }

  gameStateService.removeTag(resolvedTargetId, action.tag);
}

function handleTagValueChange(
  gameStateService: GameStateServiceContract,
  characterId: string,
  tagId: string,
  property: string,
  newValue: number | string | boolean,
): void {
  const character = gameStateService.getCharacter(characterId);
  if (!character?.tags || typeof character.tags !== "object") return;

  const rawTag = (character.tags as Record<string, unknown>)[tagId];
  if (!rawTag || typeof rawTag !== "object" || Array.isArray(rawTag)) {
    return;
  }

  const existingTag = rawTag as Record<string, unknown>;
  const updatedTag = {
    ...existingTag,
    [property]: newValue,
  };

  gameStateService.addTag(
    characterId,
    tagId,
    updatedTag as unknown as TagMetadata,
  );
}

function isResolvedAction(
  action: RuleAction | undefined,
): action is RuleAction {
  return action !== undefined;
}

function resolveActionTarget(
  target: string,
  actorId: string,
  targetId?: string,
): string | undefined {
  const resolved = resolveTarget(target, actorId, targetId);
  if (resolved) return resolved;

  console.warn(
    `[ConsumableExecutor] 无法解析目标 "${target}"，已跳过该 action`,
  );
  return undefined;
}

function resolveActionTargets(
  action: RuleAction,
  actorId: string,
  targetId?: string,
): RuleAction | undefined {
  switch (action.type) {
    case "check": {
      const resolvedTarget = action.target
        ? resolveActionTarget(action.target, actorId, targetId)
        : action.target;
      if (action.target && !resolvedTarget) return undefined;

      const resolvedDcTarget = action.dcTarget
        ? resolveActionTarget(action.dcTarget, actorId, targetId)
        : action.dcTarget;
      if (action.dcTarget && !resolvedDcTarget) return undefined;

      const resolvedOpposedEntity = action.opposedEntity
        ? resolveActionTarget(action.opposedEntity, actorId, targetId)
        : action.opposedEntity;
      if (action.opposedEntity && !resolvedOpposedEntity) return undefined;

      const onSuccess = action.onSuccess
        .map((subAction) => resolveActionTargets(subAction, actorId, targetId))
        .filter(isResolvedAction);
      const onFailure = action.onFailure
        ?.map((subAction) => resolveActionTargets(subAction, actorId, targetId))
        .filter(isResolvedAction);

      return {
        ...action,
        target: resolvedTarget,
        dcTarget: resolvedDcTarget,
        opposedEntity: resolvedOpposedEntity,
        onSuccess,
        onFailure,
      };
    }

    case "branch": {
      const thenActions = action.then
        .map((subAction) => resolveActionTargets(subAction, actorId, targetId))
        .filter(isResolvedAction);
      const elseActions = action.else
        ?.map((subAction) => resolveActionTargets(subAction, actorId, targetId))
        .filter(isResolvedAction);

      return {
        ...action,
        then: thenActions,
        else: elseActions,
      };
    }

    case "damage":
    case "heal":
    case "cost":
    case "set":
    case "addTag":
    case "removeTag":
    case "modifyTag":
    case "grantItem":
    case "removeItem":
    case "grantSkill":
    case "removeSkill":
    case "equipItem":
    case "unequipItem": {
      const resolvedTarget = resolveActionTarget(
        action.target,
        actorId,
        targetId,
      );
      if (!resolvedTarget) return undefined;

      return {
        ...action,
        target: resolvedTarget,
      };
    }

    case "useItem": {
      const resolvedTarget = resolveActionTarget(
        action.target,
        actorId,
        targetId,
      );
      if (!resolvedTarget) return undefined;

      const resolvedUseTarget = action.useTarget
        ? resolveActionTarget(action.useTarget, actorId, targetId)
        : action.useTarget;
      if (action.useTarget && !resolvedUseTarget) return undefined;

      return {
        ...action,
        target: resolvedTarget,
        useTarget: resolvedUseTarget,
      };
    }

    case "despawn": {
      const resolvedEntityId = resolveActionTarget(
        action.entityId,
        actorId,
        targetId,
      );
      if (!resolvedEntityId) return undefined;

      return {
        ...action,
        entityId: resolvedEntityId,
      };
    }

    case "roll":
    case "spawn":
      return action;
  }
}

function toFiniteNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return undefined;
}

function normalizeSetValue(value: ValueExpression): number | string | boolean {
  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  const trimmed = value.trim();
  const parsed = Number(trimmed);
  if (trimmed.length > 0 && Number.isFinite(parsed)) {
    return parsed;
  }

  return value;
}
