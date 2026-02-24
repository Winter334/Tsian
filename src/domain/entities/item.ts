/**
 * 物品实体定义
 *
 * 物品是游戏中角色可以获取、装备和消耗的对象。
 * 支持预设模板定义和 AI 动态生成。
 */

import type { PassiveModifier, RuleAction } from "../types/rule-script";

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
  /**
   * 消耗品使用时执行的动作列表（复用 RuleAction 类型）
   *
   * 路径自动判断：
   * - 全部是 heal/cost/set/addTag/removeTag → 路径 A（静默生效）
   * - 包含 check/damage/roll → 路径 B（引擎执行 → 操作日志）
   */
  onUse?: RuleAction[];
}

/**
 * 最小结构守卫：校验解析结果是否为有效的 ItemEffect 数组
 * 仅检查 Array + 每个元素的 type 和 description 字段存在
 */
export function isItemEffectArray(value: unknown): value is ItemEffect[] {
  if (!Array.isArray(value)) return false;
  return value.every(
    (item) =>
      typeof item === "object" &&
      item !== null &&
      typeof (item as Record<string, unknown>).type === "string" &&
      typeof (item as Record<string, unknown>).description === "string",
  );
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
  effects?: ItemEffect[];
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
  effects?: ItemEffect[];
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
    effects: params.effects,
    source: params.source,
    acquiredAt: Date.now(),
  };
}
