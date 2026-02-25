/**
 * Inventory 模块命令定义
 */

import type { EquipSlot, ItemCategory, ItemEffect } from "../entities/item";
import type { ResourceCost, SkillCategory } from "../entities/skill";

/**
 * Inventory 命令类型常量
 */
export const InventoryCommands = {
  GRANT_ITEM: "inventory.grant_item",
  REMOVE_ITEM: "inventory.remove_item",
  EQUIP_ITEM: "inventory.equip_item",
  UNEQUIP_ITEM: "inventory.unequip_item",
  USE_ITEM: "inventory.use_item",
  GRANT_SKILL: "inventory.grant_skill",
  REMOVE_SKILL: "inventory.remove_skill",
} as const;

/**
 * Inventory 命令类型
 */
export type InventoryCommandType =
  (typeof InventoryCommands)[keyof typeof InventoryCommands];

// ============ 命令 Payload 类型 ============

/**
 * 授予物品命令 Payload
 */
export interface GrantItemPayload {
  characterId: string;
  /** 可选，AI 可动态创造无模板物品 */
  templateId?: string;
  name: string;
  description: string;
  category: ItemCategory;
  /** 默认 1 */
  quantity?: number;
  equipSlot?: EquipSlot;
  effects?: ItemEffect[];
  /** 可选：外部指定实例 ID（用于 spawn autoEquip 等需要 ID 关联的场景） */
  instanceId?: string;
  /** 获取原因（叙事记录用） */
  reason?: string;
}

/**
 * 移除物品命令 Payload
 */
export interface RemoveItemPayload {
  characterId: string;
  instanceId: string;
  /** 默认全部移除 */
  quantity?: number;
  reason?: string;
}

/**
 * 装备物品命令 Payload
 */
export interface EquipItemPayload {
  characterId: string;
  instanceId: string;
  /** 目标槽位，不指定时使用物品的 equipSlot 字段 */
  targetSlot?: string;
  reason?: string;
}

/**
 * 卸下装备命令 Payload
 */
export interface UnequipItemPayload {
  characterId: string;
  instanceId: string;
  reason?: string;
}

/**
 * 使用物品命令 Payload
 */
export interface UseItemPayload {
  characterId: string;
  instanceId: string;
  /** 使用数量，默认 1 */
  quantity?: number;
  /** 使用目标（如对谁使用治疗药水） */
  targetId?: string;
  reason?: string;
}

/**
 * 授予技能命令 Payload
 */
export interface GrantSkillPayload {
  characterId: string;
  templateId?: string;
  name: string;
  description: string;
  category: SkillCategory;
  activeUsable?: boolean;
  cost?: ResourceCost;
  reason?: string;
}

/**
 * 移除技能命令 Payload
 */
export interface RemoveSkillPayload {
  characterId: string;
  instanceId: string;
  reason?: string;
}

// ============ 命令类型映射 ============

/**
 * Inventory 命令 Payload 映射
 */
export interface InventoryCommandPayloads {
  [InventoryCommands.GRANT_ITEM]: GrantItemPayload;
  [InventoryCommands.REMOVE_ITEM]: RemoveItemPayload;
  [InventoryCommands.EQUIP_ITEM]: EquipItemPayload;
  [InventoryCommands.UNEQUIP_ITEM]: UnequipItemPayload;
  [InventoryCommands.USE_ITEM]: UseItemPayload;
  [InventoryCommands.GRANT_SKILL]: GrantSkillPayload;
  [InventoryCommands.REMOVE_SKILL]: RemoveSkillPayload;
}
