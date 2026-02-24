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
  EquipItemPayload,
  GrantItemPayload,
  GrantSkillPayload,
  RemoveItemPayload,
  RemoveSkillPayload,
  UnequipItemPayload,
  UseItemPayload,
} from "@/domain/commands/inventory";
import { InventoryCommands } from "@/domain/commands/inventory";
import { createItemInstance } from "@/domain/entities/item";
import { createSkillInstance } from "@/domain/entities/skill";
import type {
  InventoryChangedPayload,
  ItemEquippedPayload,
  ItemGrantedPayload,
  ItemRemovedPayload,
  ItemUnequippedPayload,
  ItemUsedPayload,
  SkillGrantedPayload,
  SkillRemovedPayload,
} from "@/domain/events/inventory";
import { InventoryEvents } from "@/domain/events/inventory";
import { getRuntimeWorldConfig } from "@/lib/world";
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
    effects,
    reason,
  } = command.payload;

  // 1. 获取 Repository
  const repo = getInventoryRepository();
  if (!repo) {
    return { success: false, error: "No active save slot" };
  }

  // 2. 校验装备槽位（数据驱动）
  const worldConfig = getRuntimeWorldConfig();
  const slotDefinitions = worldConfig.inventoryRules?.equipSlotDefinitions;

  if (equipSlot !== undefined) {
    if (!slotDefinitions || slotDefinitions.length === 0) {
      return { success: false, error: "Current world has no equipment system" };
    }

    const slotDefinition = slotDefinitions.find(
      (slot) => slot.id === equipSlot,
    );
    if (!slotDefinition) {
      return {
        success: false,
        error: `Invalid equip slot: ${equipSlot}`,
      };
    }

    if (
      slotDefinition.allowedCategories &&
      !slotDefinition.allowedCategories.includes(category)
    ) {
      return {
        success: false,
        error: `${slotDefinition.label} does not allow category: ${category}`,
      };
    }
  }

  // 3. 在需要时从模板继承 effects（仅当 AI 未显式提供）
  const template = templateId
    ? worldConfig.itemTemplates?.find(
        (itemTemplate) => itemTemplate.id === templateId,
      )
    : undefined;
  const resolvedEffects = effects ?? template?.effects;

  // 4. 创建物品实例
  const item = createItemInstance({
    templateId: templateId ?? `ai-${crypto.randomUUID()}`,
    name,
    description,
    category,
    quantity,
    equipSlot,
    effects: resolvedEffects,
    source: templateId ? "predefined" : "ai-generated",
  });

  // 5. 写入 Yjs
  repo.addItem(characterId, item);

  // 6. 更新 Store
  useInventoryStore.getState()._addItem(characterId, item);

  // 7. 发射事件
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

// ─── EQUIP_ITEM ────────────────────────────────────────────

const handleEquipItem: CommandHandler<EquipItemPayload, void> = async (
  command: Command<EquipItemPayload>,
  _context: CommandContext,
): Promise<CommandResult<void>> => {
  const { characterId, instanceId, targetSlot, reason } = command.payload;

  const repo = getInventoryRepository();
  if (!repo) {
    return { success: false, error: "No active save slot" };
  }

  // 确认物品存在
  const item = repo.findItem(characterId, instanceId);
  if (!item) {
    return { success: false, error: "Item not found" };
  }

  // 确定装备槽位
  const slot = targetSlot ?? item.equipSlot;
  if (!slot) {
    return { success: false, error: "Item has no equip slot" };
  }

  // 校验槽位合法性
  const worldConfig = getRuntimeWorldConfig();
  const slotDefinitions = worldConfig.inventoryRules?.equipSlotDefinitions;

  if (!slotDefinitions || slotDefinitions.length === 0) {
    return { success: false, error: "Current world has no equipment system" };
  }

  const slotDefinition = slotDefinitions.find((slotDef) => slotDef.id === slot);
  if (!slotDefinition) {
    return { success: false, error: `Invalid equip slot: ${slot}` };
  }

  if (
    slotDefinition.allowedCategories &&
    !slotDefinition.allowedCategories.includes(item.category)
  ) {
    return {
      success: false,
      error: `${slotDefinition.label} does not allow category: ${item.category}`,
    };
  }

  // 处理槽位冲突
  const store = useInventoryStore.getState();
  const characterItems = store.items[characterId] ?? [];
  const conflicting = characterItems.find(
    (candidate) => candidate.equipped === true && candidate.equipSlot === slot,
  );

  let replacedItem: ItemEquippedPayload["replacedItem"];
  if (conflicting && conflicting.instanceId !== instanceId) {
    repo.updateEquipStatus(characterId, conflicting.instanceId, false);
    store._unequipItem(characterId, conflicting.instanceId);
    replacedItem = { ...conflicting };
  }

  // 装备目标物品
  repo.updateEquipStatus(characterId, instanceId, true, slot);
  store._equipItem(characterId, instanceId, slot);

  const equippedItem = {
    ...item,
    equipped: true,
    equipSlot: slot,
  };

  // 发射事件
  eventBus.emit(
    eventBus.createEvent<ItemEquippedPayload>(
      InventoryEvents.ITEM_EQUIPPED,
      { characterId, item: equippedItem, slot, replacedItem, reason },
      "lyra.inventory",
    ),
  );

  eventBus.emit(
    eventBus.createEvent<InventoryChangedPayload>(
      InventoryEvents.INVENTORY_CHANGED,
      { characterId, changeType: "item_equipped" },
      "lyra.inventory",
    ),
  );

  return { success: true };
};

// ─── UNEQUIP_ITEM ──────────────────────────────────────────

const handleUnequipItem: CommandHandler<UnequipItemPayload, void> = async (
  command: Command<UnequipItemPayload>,
  _context: CommandContext,
): Promise<CommandResult<void>> => {
  const { characterId, instanceId, reason } = command.payload;

  const repo = getInventoryRepository();
  if (!repo) {
    return { success: false, error: "No active save slot" };
  }

  // 确认物品存在
  const item = repo.findItem(characterId, instanceId);
  if (!item) {
    return { success: false, error: "Item not found" };
  }

  // 确认物品已装备
  if (item.equipped !== true) {
    return { success: false, error: "Item is not equipped" };
  }

  const slot = item.equipSlot;
  if (!slot) {
    return { success: false, error: "Equipped item has no slot" };
  }

  // 卸下装备
  repo.updateEquipStatus(characterId, instanceId, false);
  useInventoryStore.getState()._unequipItem(characterId, instanceId);

  const unequippedItem = {
    ...item,
    equipped: false,
    equipSlot: undefined,
  };

  // 发射事件
  eventBus.emit(
    eventBus.createEvent<ItemUnequippedPayload>(
      InventoryEvents.ITEM_UNEQUIPPED,
      { characterId, item: unequippedItem, slot, reason },
      "lyra.inventory",
    ),
  );

  eventBus.emit(
    eventBus.createEvent<InventoryChangedPayload>(
      InventoryEvents.INVENTORY_CHANGED,
      { characterId, changeType: "item_unequipped" },
      "lyra.inventory",
    ),
  );

  return { success: true };
};

// ─── USE_ITEM ──────────────────────────────────────────────

const handleUseItem: CommandHandler<UseItemPayload, void> = async (
  command: Command<UseItemPayload>,
  _context: CommandContext,
): Promise<CommandResult<void>> => {
  const { characterId, instanceId, quantity, targetId, reason } =
    command.payload;

  const repo = getInventoryRepository();
  if (!repo) {
    return { success: false, error: "No active save slot" };
  }

  // 确认物品存在
  const item = repo.findItem(characterId, instanceId);
  if (!item) {
    return { success: false, error: "Item not found" };
  }

  // 仅允许消耗品被使用
  if (item.category !== "consumable") {
    return { success: false, error: "Only consumable items can be used" };
  }

  const useQty = quantity ?? 1;
  if (useQty < 1 || !Number.isInteger(useQty)) {
    return { success: false, error: "Use quantity must be a positive integer" };
  }

  if (useQty > item.quantity) {
    return { success: false, error: "Insufficient item quantity" };
  }

  // 扣减数量
  const newQty = item.quantity - useQty;
  repo.updateItemQuantity(characterId, instanceId, newQty);
  useInventoryStore
    .getState()
    ._updateItemQuantity(characterId, instanceId, newQty);

  // 发射事件
  eventBus.emit(
    eventBus.createEvent<ItemUsedPayload>(
      InventoryEvents.ITEM_USED,
      { characterId, item, quantity: useQty, targetId, reason },
      "lyra.inventory",
    ),
  );

  eventBus.emit(
    eventBus.createEvent<InventoryChangedPayload>(
      InventoryEvents.INVENTORY_CHANGED,
      { characterId, changeType: "item_used" },
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
    [InventoryCommands.EQUIP_ITEM]: handleEquipItem as CommandHandler<
      unknown,
      unknown
    >,
    [InventoryCommands.UNEQUIP_ITEM]: handleUnequipItem as CommandHandler<
      unknown,
      unknown
    >,
    [InventoryCommands.USE_ITEM]: handleUseItem as CommandHandler<
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
