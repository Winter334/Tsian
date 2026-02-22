/**
 * 结构化变更消费器
 *
 * 消费 ResultFrame 中的 structuralChanges，转化为对应的 CommandBus dispatch。
 * 在 upsertFromEntityStates() 之后调用，将物品/技能的结构化变更持久化到 Inventory 模块。
 *
 * @module game/services/structural-change-consumer
 */

import type { Command, CommandResult } from "@/core/command-bus";
import { InventoryCommands } from "@/domain/commands/inventory";
import type { ItemCategory } from "@/domain/entities/item";
import type { ResourceCost, SkillCategory } from "@/domain/entities/skill";
import type { StructuralChange } from "@/domain/types/result-frame";

/** 命令分发接口（仅需 dispatch 方法） */
interface CommandDispatcher {
  dispatch<C, R>(command: Command<C>): Promise<CommandResult<R>>;
}

// ─── 类型守卫 ──────────────────────────────────────────────

const VALID_ITEM_CATEGORIES = new Set<string>([
  "weapon",
  "armor",
  "accessory",
  "consumable",
  "material",
  "quest",
  "misc",
]);

const VALID_SKILL_CATEGORIES = new Set<string>([
  "combat",
  "magic",
  "survival",
  "social",
  "craft",
  "misc",
]);

function isItemCategory(value: unknown): value is ItemCategory {
  return typeof value === "string" && VALID_ITEM_CATEGORIES.has(value);
}

function isSkillCategory(value: unknown): value is SkillCategory {
  return typeof value === "string" && VALID_SKILL_CATEGORIES.has(value);
}

function isFailedChange(change: StructuralChange): boolean {
  return change.details?.failed === true;
}

// ─── 消费器 ────────────────────────────────────────────────

/**
 * 消费 ResultFrame 中的结构化变更，转化为对应的命令分发
 *
 * @param structuralChanges - ResultFrame 中的 structuralChanges
 * @param commandBus - 命令总线实例（需具有 dispatch 方法）
 */
export async function applyStructuralChanges(
  structuralChanges: readonly StructuralChange[] | undefined,
  commandBus: CommandDispatcher,
): Promise<void> {
  if (!structuralChanges || structuralChanges.length === 0) return;

  for (const change of structuralChanges) {
    // 跳过失败的变更（如背包已满、重复技能等）
    if (isFailedChange(change)) {
      console.log(
        `[StructuralChangeConsumer] 跳过失败变更: ${change.type} - ${change.reason}`,
      );
      continue;
    }

    try {
      switch (change.type) {
        case "item_added":
          await dispatchGrantItem(change, commandBus);
          break;
        case "item_removed":
          await dispatchRemoveItem(change, commandBus);
          break;
        case "skill_learned":
          await dispatchGrantSkill(change, commandBus);
          break;
        case "skill_removed":
          await dispatchRemoveSkill(change, commandBus);
          break;
        default:
          console.warn(
            `[StructuralChangeConsumer] 未知变更类型: ${(change as StructuralChange).type}`,
          );
      }
    } catch (error) {
      console.error(`[StructuralChangeConsumer] 应用变更失败:`, change, error);
    }
  }
}

// ─── 各类型分发实现 ────────────────────────────────────────

async function dispatchGrantItem(
  change: StructuralChange,
  commandBus: CommandDispatcher,
): Promise<void> {
  const details = change.details ?? {};
  const name = typeof details.name === "string" ? details.name : "未知物品";
  const description =
    typeof details.description === "string" ? details.description : "";
  const category = isItemCategory(details.category) ? details.category : "misc";
  const quantity = typeof details.quantity === "number" ? details.quantity : 1;
  const equipSlot =
    typeof details.equipSlot === "string" ? details.equipSlot : undefined;

  await commandBus.dispatch({
    type: InventoryCommands.GRANT_ITEM,
    payload: {
      characterId: change.targetId,
      templateId: change.templateId,
      name,
      description,
      category,
      quantity,
      equipSlot,
      reason: change.reason,
    },
  });
}

async function dispatchRemoveItem(
  change: StructuralChange,
  commandBus: CommandDispatcher,
): Promise<void> {
  const details = change.details ?? {};
  const quantity =
    typeof details.quantity === "number" ? details.quantity : undefined;

  await commandBus.dispatch({
    type: InventoryCommands.REMOVE_ITEM,
    payload: {
      characterId: change.targetId,
      instanceId: change.entityId,
      quantity,
      reason: change.reason,
    },
  });
}

async function dispatchGrantSkill(
  change: StructuralChange,
  commandBus: CommandDispatcher,
): Promise<void> {
  const details = change.details ?? {};
  const name = typeof details.name === "string" ? details.name : "未知技能";
  const description =
    typeof details.description === "string" ? details.description : "";
  const category = isSkillCategory(details.category)
    ? details.category
    : "misc";
  const activeUsable =
    typeof details.activeUsable === "boolean" ? details.activeUsable : false;

  // 从 details 中重建 ResourceCost（engine 将 cost 拆为 costField + costAmount）
  let cost: ResourceCost | undefined;
  if (
    typeof details.costField === "string" &&
    typeof details.costAmount === "number"
  ) {
    cost = { field: details.costField, amount: details.costAmount };
  }

  await commandBus.dispatch({
    type: InventoryCommands.GRANT_SKILL,
    payload: {
      characterId: change.targetId,
      templateId: change.templateId,
      name,
      description,
      category,
      activeUsable,
      cost,
      reason: change.reason,
    },
  });
}

async function dispatchRemoveSkill(
  change: StructuralChange,
  commandBus: CommandDispatcher,
): Promise<void> {
  await commandBus.dispatch({
    type: InventoryCommands.REMOVE_SKILL,
    payload: {
      characterId: change.targetId,
      instanceId: change.entityId,
      reason: change.reason,
    },
  });
}
