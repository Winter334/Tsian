/**
 * Inventory 模块事件定义
 */

import type { ItemInstance } from "../entities/item";
import type { SkillInstance } from "../entities/skill";

/**
 * Inventory 事件类型常量
 */
export const InventoryEvents = {
  ITEM_GRANTED: "inventory.item_granted",
  ITEM_REMOVED: "inventory.item_removed",
  SKILL_GRANTED: "inventory.skill_granted",
  SKILL_REMOVED: "inventory.skill_removed",
  INVENTORY_CHANGED: "inventory.changed",
} as const;

/**
 * Inventory 事件类型
 */
export type InventoryEventType =
  (typeof InventoryEvents)[keyof typeof InventoryEvents];

// ============ 事件 Payload 类型 ============

/**
 * 物品授予事件 Payload
 */
export interface ItemGrantedPayload {
  characterId: string;
  item: ItemInstance;
  reason?: string;
}

/**
 * 物品移除事件 Payload
 */
export interface ItemRemovedPayload {
  characterId: string;
  instanceId: string;
  itemName: string;
  quantity?: number;
  reason?: string;
}

/**
 * 技能授予事件 Payload
 */
export interface SkillGrantedPayload {
  characterId: string;
  skill: SkillInstance;
  reason?: string;
}

/**
 * 技能移除事件 Payload
 */
export interface SkillRemovedPayload {
  characterId: string;
  instanceId: string;
  skillName: string;
  reason?: string;
}

/**
 * 背包变更事件 Payload
 */
export interface InventoryChangedPayload {
  characterId: string;
  changeType:
    | "item_granted"
    | "item_removed"
    | "skill_granted"
    | "skill_removed";
}

// ============ 事件类型映射 ============

/**
 * Inventory 事件 Payload 映射
 */
export interface InventoryEventPayloads {
  [InventoryEvents.ITEM_GRANTED]: ItemGrantedPayload;
  [InventoryEvents.ITEM_REMOVED]: ItemRemovedPayload;
  [InventoryEvents.SKILL_GRANTED]: SkillGrantedPayload;
  [InventoryEvents.SKILL_REMOVED]: SkillRemovedPayload;
  [InventoryEvents.INVENTORY_CHANGED]: InventoryChangedPayload;
}
