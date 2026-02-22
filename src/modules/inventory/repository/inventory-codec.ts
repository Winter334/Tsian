/**
 * ItemInstance / SkillInstance ↔ Y.Map 编解码层
 *
 * 将领域实体与 Yjs 持久化格式之间进行双向转换。
 * 所有读取操作均使用类型守卫确保类型安全。
 *
 * @module inventory/repository/inventory-codec
 */

import type { ItemCategory, ItemInstance } from "@/domain/entities/item";
import type {
  ResourceCost,
  SkillCategory,
  SkillInstance,
} from "@/domain/entities/skill";
import * as Y from "yjs";

// ─── 类型守卫 ─────────────────────────────────────────────

const VALID_ITEM_CATEGORIES: ReadonlySet<string> = new Set<ItemCategory>([
  "weapon",
  "armor",
  "accessory",
  "consumable",
  "material",
  "quest",
  "misc",
]);

const VALID_SKILL_CATEGORIES: ReadonlySet<string> = new Set<SkillCategory>([
  "combat",
  "magic",
  "survival",
  "social",
  "craft",
  "misc",
]);

const VALID_SOURCES: ReadonlySet<string> = new Set([
  "predefined",
  "ai-generated",
]);

function isItemCategory(value: unknown): value is ItemCategory {
  return typeof value === "string" && VALID_ITEM_CATEGORIES.has(value);
}

function isEquipSlot(value: unknown): value is string {
  return typeof value === "string";
}

function isSkillCategory(value: unknown): value is SkillCategory {
  return typeof value === "string" && VALID_SKILL_CATEGORIES.has(value);
}

function isSource(value: unknown): value is "predefined" | "ai-generated" {
  return typeof value === "string" && VALID_SOURCES.has(value);
}

// ─── ItemInstance → Y.Map ─────────────────────────────────

/**
 * 将 ItemInstance 编码为 Y.Map<unknown>
 */
export function itemInstanceToYMap(item: ItemInstance): Y.Map<unknown> {
  const map = new Y.Map<unknown>();

  map.set("instanceId", item.instanceId);
  map.set("templateId", item.templateId);
  map.set("name", item.name);
  map.set("description", item.description);
  map.set("category", item.category);
  map.set("quantity", item.quantity);
  map.set("equipped", item.equipped);
  map.set("source", item.source);
  map.set("acquiredAt", item.acquiredAt);

  if (item.equipSlot !== undefined) {
    map.set("equipSlot", item.equipSlot);
  }

  return map;
}

// ─── Y.Map → ItemInstance ─────────────────────────────────

/**
 * 将 Y.Map<unknown> 解码为 ItemInstance
 *
 * 所有字段均使用类型守卫进行安全转换，缺失字段使用合理默认值。
 */
export function yMapToItemInstance(map: Y.Map<unknown>): ItemInstance {
  const instanceId = map.get("instanceId");
  const templateId = map.get("templateId");
  const name = map.get("name");
  const description = map.get("description");
  const category = map.get("category");
  const quantity = map.get("quantity");
  const equipped = map.get("equipped");
  const equipSlot = map.get("equipSlot");
  const source = map.get("source");
  const acquiredAt = map.get("acquiredAt");

  const item: ItemInstance = {
    instanceId:
      typeof instanceId === "string" ? instanceId : crypto.randomUUID(),
    templateId: typeof templateId === "string" ? templateId : "",
    name: typeof name === "string" ? name : "未知物品",
    description: typeof description === "string" ? description : "",
    category: isItemCategory(category) ? category : "misc",
    quantity: typeof quantity === "number" ? quantity : 1,
    equipped: typeof equipped === "boolean" ? equipped : false,
    source: isSource(source) ? source : "ai-generated",
    acquiredAt: typeof acquiredAt === "number" ? acquiredAt : Date.now(),
  };

  if (isEquipSlot(equipSlot)) {
    item.equipSlot = equipSlot;
  }

  return item;
}

// ─── SkillInstance → Y.Map ────────────────────────────────

/**
 * 将 SkillInstance 编码为 Y.Map<unknown>
 */
export function skillInstanceToYMap(skill: SkillInstance): Y.Map<unknown> {
  const map = new Y.Map<unknown>();

  map.set("instanceId", skill.instanceId);
  map.set("templateId", skill.templateId);
  map.set("name", skill.name);
  map.set("description", skill.description);
  map.set("category", skill.category);
  map.set("level", skill.level);
  map.set("maxLevel", skill.maxLevel);
  map.set("activeUsable", skill.activeUsable);
  map.set("source", skill.source);
  map.set("acquiredAt", skill.acquiredAt);

  // cost 是嵌套对象，序列化为 JSON 字符串存储
  if (skill.cost !== undefined) {
    map.set("cost", JSON.stringify(skill.cost));
  }

  if (skill.evolvedFrom !== undefined) {
    map.set("evolvedFrom", skill.evolvedFrom);
  }

  return map;
}

// ─── Y.Map → SkillInstance ────────────────────────────────

/**
 * 将 Y.Map<unknown> 解码为 SkillInstance
 *
 * cost（ResourceCost）从 JSON 字符串反序列化。
 */
export function yMapToSkillInstance(map: Y.Map<unknown>): SkillInstance {
  const instanceId = map.get("instanceId");
  const templateId = map.get("templateId");
  const name = map.get("name");
  const description = map.get("description");
  const category = map.get("category");
  const level = map.get("level");
  const maxLevel = map.get("maxLevel");
  const activeUsable = map.get("activeUsable");
  const costRaw = map.get("cost");
  const source = map.get("source");
  const acquiredAt = map.get("acquiredAt");
  const evolvedFrom = map.get("evolvedFrom");

  const skill: SkillInstance = {
    instanceId:
      typeof instanceId === "string" ? instanceId : crypto.randomUUID(),
    templateId: typeof templateId === "string" ? templateId : "",
    name: typeof name === "string" ? name : "未知技能",
    description: typeof description === "string" ? description : "",
    category: isSkillCategory(category) ? category : "misc",
    level: typeof level === "number" ? level : 1,
    maxLevel: typeof maxLevel === "number" ? maxLevel : 1,
    activeUsable: typeof activeUsable === "boolean" ? activeUsable : false,
    source: isSource(source) ? source : "ai-generated",
    acquiredAt: typeof acquiredAt === "number" ? acquiredAt : Date.now(),
  };

  // 反序列化 cost
  if (typeof costRaw === "string") {
    try {
      const parsed: unknown = JSON.parse(costRaw);
      if (isResourceCost(parsed)) {
        skill.cost = parsed;
      }
    } catch {
      // 忽略无效 JSON
    }
  }

  if (typeof evolvedFrom === "string") {
    skill.evolvedFrom = evolvedFrom;
  }

  return skill;
}

// ─── ResourceCost 类型守卫 ────────────────────────────────

function isResourceCost(value: unknown): value is ResourceCost {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const obj = value as Record<string, unknown>;
  return typeof obj.field === "string" && typeof obj.amount === "number";
}
