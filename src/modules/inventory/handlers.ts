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
import { subdocManager } from "@/core/yjs";
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
import { canOperateCharacter } from "@/domain/entities/character";
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
import type { ResultFrame } from "@/domain/types/result-frame";
import type { RuleAction } from "@/domain/types/rule-script";
import { getUniqueTag } from "@/lib/user-identity";
import { getRuntimeWorldConfig } from "@/lib/world";
import { yMapToCharacter } from "@/modules/game/repository";
import { useRoomStore } from "@/modules/room/store";
import * as Y from "yjs";
import {
  executeItemViaEngine,
  executeSimpleAction,
  requiresEngine,
  validateTargetRequirement,
} from "./consumable-executor";
import { getInventoryRepository } from "./repository";
import { useInventoryStore } from "./store";

function ensureInventoryPermission(
  characterId: string,
  context: CommandContext,
): CommandResult<void> | null {
  const room = useRoomStore.getState().currentRoom;
  if (!room) {
    // offline：保持原行为
    return null;
  }

  const sender = context.sender ?? useRoomStore.getState().localUser.userId;
  if (!sender) {
    return { success: false, error: "Missing sender in online mode" };
  }

  if (subdocManager.isHost(room.roomId, sender)) {
    return null;
  }

  const mainDoc = subdocManager.getMainDoc(room.roomId);
  if (!mainDoc) {
    return { success: false, error: "MainDoc not found" };
  }

  const charactersMap = mainDoc.getMap("characters") as Y.Map<Y.Map<unknown>>;
  const charMap = charactersMap.get(characterId);
  if (!charMap) {
    return { success: false, error: "Character not found" };
  }

  const uniqueTag = getUniqueTag();
  if (!uniqueTag) {
    return { success: false, error: "Missing uniqueTag in online mode" };
  }

  try {
    const character = yMapToCharacter(charMap);
    if (canOperateCharacter(character, sender, uniqueTag)) {
      return null;
    }
  } catch {
    return { success: false, error: "Character decode failed" };
  }

  return {
    success: false,
    error:
      "Permission denied: only host or character operator can modify inventory",
  };
}

// ─── GRANT_ITEM ───────────────────────────────────────────

const handleGrantItem: CommandHandler<
  GrantItemPayload,
  { item: unknown }
> = async (
  command: Command<GrantItemPayload>,
  context: CommandContext,
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

  const permissionError = ensureInventoryPermission(characterId, context);
  if (permissionError) {
    return { success: false, error: permissionError.error };
  }

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
    instanceId: command.payload.instanceId,
    source: templateId ? "predefined" : "ai-generated",
  });

  // 5. 写入 Yjs
  repo.addItem(characterId, item);

  // 6. 发射事件
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
  context: CommandContext,
): Promise<CommandResult<void>> => {
  const { characterId, instanceId, quantity, reason } = command.payload;

  const permissionError = ensureInventoryPermission(characterId, context);
  if (permissionError) {
    return permissionError;
  }

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

  // 状态由 SyncBridge 统一从权威 Yjs 下行，避免双写回环

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
  context: CommandContext,
): Promise<CommandResult<void>> => {
  const { characterId, instanceId, targetSlot, reason } = command.payload;

  const permissionError = ensureInventoryPermission(characterId, context);
  if (permissionError) {
    return permissionError;
  }

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
    replacedItem = { ...conflicting };
  }

  // 装备目标物品
  repo.updateEquipStatus(characterId, instanceId, true, slot);

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
  context: CommandContext,
): Promise<CommandResult<void>> => {
  const { characterId, instanceId, reason } = command.payload;

  const permissionError = ensureInventoryPermission(characterId, context);
  if (permissionError) {
    return permissionError;
  }

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
  context: CommandContext,
): Promise<CommandResult<void>> => {
  const { characterId, instanceId, quantity, targetId, reason } =
    command.payload;

  const permissionError = ensureInventoryPermission(characterId, context);
  if (permissionError) {
    return permissionError;
  }

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

  // === Phase 4b: onUse 双路径执行 ===
  const allOnUseActions: RuleAction[] = [];
  if (item.effects) {
    for (const effect of item.effects) {
      if (effect.onUse?.length) {
        allOnUseActions.push(...effect.onUse);
      }
    }
  }

  // 如果有需要目标的 actions 但未提供 targetId，拒绝使用
  if (
    allOnUseActions.length > 0 &&
    !validateTargetRequirement(allOnUseActions, targetId)
  ) {
    throw new Error("该物品需要选择目标才能使用");
  }

  // 扣减数量
  const newQty = item.quantity - useQty;
  repo.updateItemQuantity(characterId, instanceId, newQty);
  // 状态由 SyncBridge 统一从权威 Yjs 下行，避免双写回环

  let resultFrame: ResultFrame | undefined;

  if (allOnUseActions.length > 0) {
    if (requiresEngine(allOnUseActions)) {
      // 路径 B：引擎执行 → ResultFrame
      // 注意：executeItemViaEngine 会将效果应用到 Yjs，并返回 ResultFrame
      resultFrame = executeItemViaEngine(
        allOnUseActions,
        characterId,
        targetId,
        item,
      );
      if (resultFrame) {
        console.log(
          "[handleUseItem] 路径B执行完成，ResultFrame:",
          resultFrame.mechanicSummary,
        );
      }
    } else {
      // 路径 A：静默生效
      for (const action of allOnUseActions) {
        executeSimpleAction(action, characterId, targetId);
      }
    }
  }

  // 发射事件
  eventBus.emit(
    eventBus.createEvent<ItemUsedPayload>(
      InventoryEvents.ITEM_USED,
      { characterId, item, quantity: useQty, targetId, reason, resultFrame },
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
  context: CommandContext,
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

  const permissionError = ensureInventoryPermission(characterId, context);
  if (permissionError) {
    return { success: false, error: permissionError.error };
  }

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
  context: CommandContext,
): Promise<CommandResult<void>> => {
  const { characterId, instanceId, reason } = command.payload;

  const permissionError = ensureInventoryPermission(characterId, context);
  if (permissionError) {
    return permissionError;
  }

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

  // 状态由 SyncBridge 统一从权威 Yjs 下行，避免双写回环

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
