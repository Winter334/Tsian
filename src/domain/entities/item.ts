/**
 * 物品实体定义
 *
 * 物品是游戏中角色可以获取、装备和消耗的对象。
 * 支持预设模板定义和 AI 动态生成。
 */

import type { PassiveModifier } from "../types/rule-script";

// ─── 物品类别 ──────────────────────────────────────

export type ItemCategory =
  | "weapon"
  | "armor"
  | "accessory"
  | "consumable"
  | "material"
  | "quest"
  | "misc";

// ─── 装备槽位 ──────────────────────────────────────

export type EquipSlot = string;

// ─── 物品效果（V1 仅做叙事标注，V1.5 再激活 modifier 逻辑）──

export interface ItemEffect {
  type: "narrative" | "modifier";
  description: string;
  modifiers?: PassiveModifier[];
}

// ─── 物品模板（预设作者定义）──────────────────────

export interface ItemTemplate {
  id: string;
  name: string;
  description: string;
  category: ItemCategory;
  stackable?: boolean;
  maxStack?: number;
  equipSlot?: EquipSlot;
  consumable?: boolean;
  effects?: ItemEffect[];
}

// ─── 物品实例（运行时，存储在角色背包中）──────────

export interface ItemInstance {
  instanceId: string;
  templateId: string;
  name: string;
  description: string;
  category: ItemCategory;
  quantity: number;
  equipped: boolean;
  equipSlot?: EquipSlot;
  source: "predefined" | "ai-generated";
  acquiredAt: number;
}

// ─── 创建参数 ──────────────────────────────────────

export interface CreateItemInstanceParams {
  templateId: string;
  name: string;
  description: string;
  category: ItemCategory;
  quantity?: number;
  equipSlot?: EquipSlot;
  source: "predefined" | "ai-generated";
}

// ─── 工厂函数 ──────────────────────────────────────

/**
 * 创建物品实例
 */
export function createItemInstance(
  params: CreateItemInstanceParams,
): ItemInstance {
  return {
    instanceId: crypto.randomUUID(),
    templateId: params.templateId,
    name: params.name,
    description: params.description,
    category: params.category,
    quantity: params.quantity ?? 1,
    equipped: false,
    equipSlot: params.equipSlot,
    source: params.source,
    acquiredAt: Date.now(),
  };
}
