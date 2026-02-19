/**
 * Inventory 模块命令定义
 */

import type {
  EquipSlot,
  ItemCategory,
} from "../entities/item";
import type {
  ResourceCost,
  SkillCategory,
} from "../entities/skill";

/**
 * Inventory 命令类型常量
 */
export const InventoryCommands = {
  GRANT_ITEM: "inventory.grant_item",
  REMOVE_ITEM: "inventory.remove_item",
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
  [InventoryCommands.GRANT_SKILL]: GrantSkillPayload;
  [InventoryCommands.REMOVE_SKILL]: RemoveSkillPayload;
}