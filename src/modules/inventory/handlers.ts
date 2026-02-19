/**
 * Inventory 模块命令处理器
 *
 * 4 个命令处理器：GRANT_ITEM / REMOVE_ITEM / GRANT_SKILL / REMOVE_SKILL
 * 每个处理器：验证 → 写 Yjs → 更新 Store → 发事件
 *
 * @module inventory/handlers
 */

import { eventBus } from "@/core";
import type {
  Command,
  CommandContext,
  CommandHandler,
  CommandResult,
} from "@/core/command-bus";
import type {
  GrantItemPayload,
  GrantSkillPayload,
  RemoveItemPayload,
  RemoveSkillPayload,
} from "@/domain/commands/inventory";
import { InventoryCommands } from "@/domain/commands/inventory";
import { createItemInstance } from "@/domain/entities/item";
import { createSkillInstance } from "@/domain/entities/skill";
import type {
  InventoryChangedPayload,
  ItemGrantedPayload,
  ItemRemovedPayload,
  SkillGrantedPayload,
  SkillRemovedPayload,
} from "@/domain/events/inventory";
import { InventoryEvents } from "@/domain/events/inventory";
import { getInventoryRepository } from "./repository";
import { useInventoryStore } from "./store";

// ─── GRANT_ITEM ───────────────────────────────────────────

const handleGrantItem: CommandHandler<
  GrantItemPayload,
  { item: unknown }
> = async (
  command: Command<GrantItemPayload>,
  _context: CommandContext,
): Promise<CommandResult<{ item: unknown }>> => {
  const {
    characterId,
    templateId,
    name,
    description,
    category,
    quantity,
    equipSlot,
    reason,
  } = command.payload;

  // 1. 获取 Repository
  const repo = getInventoryRepository();
  if (!repo) {
    return { success: false, error: "No active save slot" };
  }

  // 2. 创建物品实例
  const item = createItemInstance({
    templateId: templateId ?? `ai-${crypto.randomUUID()}`,
    name,
    description,
    category,
    quantity,
    equipSlot,
    source: templateId ? "predefined" : "ai-generated",
  });

  // 3. 写入 Yjs
  repo.addItem(characterId, item);

  // 4. 更新 Store
  useInventoryStore.getState()._addItem(characterId, item);

  // 5. 发射事件
  eventBus.emit(
    eventBus.createEvent<ItemGrantedPayload>(
      InventoryEvents.ITEM_GRANTED,
      { characterId, item, reason },
      "lyra.inventory",
    ),
  );

  eventBus.emit(
    eventBus.createEvent<InventoryChangedPayload>(
      InventoryEvents.INVENTORY_CHANGED,
      { characterId, changeType: "item_granted" },
      "lyra.inventory",
    ),
  );

  return { success: true, data: { item } };
};

// ─── REMOVE_ITEM ──────────────────────────────────────────

const handleRemoveItem: CommandHandler<RemoveItemPayload, void> = async (
  command: Command<RemoveItemPayload>,
  _context: CommandContext,
): Promise<CommandResult<void>> => {
  const { characterId, instanceId, quantity, reason } = command.payload;

  const repo = getInventoryRepository();
  if (!repo) {
    return { success: false, error: "No active save slot" };
  }

  // 确认物品存在
  const existing = repo.findItem(characterId, instanceId);
  if (!existing) {
    return { success: false, error: "Item not found" };
  }

  const itemName = existing.name;

  // 从 Yjs 移除
  repo.removeItem(characterId, instanceId, quantity);

  // 更新 Store
  useInventoryStore.getState()._removeItem(characterId, instanceId, quantity);

  // 发射事件
  eventBus.emit(
    eventBus.createEvent<ItemRemovedPayload>(
      InventoryEvents.ITEM_REMOVED,
      { characterId, instanceId, itemName, quantity, reason },
      "lyra.inventory",
    ),
  );

  eventBus.emit(
    eventBus.createEvent<InventoryChangedPayload>(
      InventoryEvents.INVENTORY_CHANGED,
      { characterId, changeType: "item_removed" },
      "lyra.inventory",
    ),
  );

  return { success: true };
};

// ─── GRANT_SKILL ──────────────────────────────────────────

const handleGrantSkill: CommandHandler<
  GrantSkillPayload,
  { skill: unknown }
> = async (
  command: Command<GrantSkillPayload>,
  _context: CommandContext,
): Promise<CommandResult<{ skill: unknown }>> => {
  const {
    characterId,
    templateId,
    name,
    description,
    category,
    activeUsable,
    cost,
    reason,
  } = command.payload;

  const repo = getInventoryRepository();
  if (!repo) {
    return { success: false, error: "No active save slot" };
  }

  // 创建技能实例
  const skill = createSkillInstance({
    templateId: templateId ?? `ai-${crypto.randomUUID()}`,
    name,
    description,
    category,
    activeUsable,
    cost,
    source: templateId ? "predefined" : "ai-generated",
  });

  // 写入 Yjs
  repo.addSkill(characterId, skill);

  // 更新 Store
  useInventoryStore.getState()._addSkill(characterId, skill);

  // 发射事件
  eventBus.emit(
    eventBus.createEvent<SkillGrantedPayload>(
      InventoryEvents.SKILL_GRANTED,
      { characterId, skill, reason },
      "lyra.inventory",
    ),
  );

  eventBus.emit(
    eventBus.createEvent<InventoryChangedPayload>(
      InventoryEvents.INVENTORY_CHANGED,
      { characterId, changeType: "skill_granted" },
      "lyra.inventory",
    ),
  );

  return { success: true, data: { skill } };
};

// ─── REMOVE_SKILL ─────────────────────────────────────────

const handleRemoveSkill: CommandHandler<RemoveSkillPayload, void> = async (
  command: Command<RemoveSkillPayload>,
  _context: CommandContext,
): Promise<CommandResult<void>> => {
  const { characterId, instanceId, reason } = command.payload;

  const repo = getInventoryRepository();
  if (!repo) {
    return { success: false, error: "No active save slot" };
  }

  // 确认技能存在
  const existing = repo.findSkill(characterId, instanceId);
  if (!existing) {
    return { success: false, error: "Skill not found" };
  }

  const skillName = existing.name;

  // 从 Yjs 移除
  repo.removeSkill(characterId, instanceId);

  // 更新 Store
  useInventoryStore.getState()._removeSkill(characterId, instanceId);

  // 发射事件
  eventBus.emit(
    eventBus.createEvent<SkillRemovedPayload>(
      InventoryEvents.SKILL_REMOVED,
      { characterId, instanceId, skillName, reason },
      "lyra.inventory",
    ),
  );

  eventBus.emit(
    eventBus.createEvent<InventoryChangedPayload>(
      InventoryEvents.INVENTORY_CHANGED,
      { characterId, changeType: "skill_removed" },
      "lyra.inventory",
    ),
  );

  return { success: true };
};

// ─── 导出 ─────────────────────────────────────────────────

/**
 * 创建 Inventory 命令处理器映射
 */
export function createInventoryCommandHandlers(): Record<
  string,
  CommandHandler<unknown, unknown>
> {
  return {
    [InventoryCommands.GRANT_ITEM]: handleGrantItem as CommandHandler<
      unknown,
      unknown
    >,
    [InventoryCommands.REMOVE_ITEM]: handleRemoveItem as CommandHandler<
      unknown,
      unknown
    >,
    [InventoryCommands.GRANT_SKILL]: handleGrantSkill as CommandHandler<
      unknown,
      unknown
    >,
    [InventoryCommands.REMOVE_SKILL]: handleRemoveSkill as CommandHandler<
      unknown,
      unknown
    >,
  };
}
