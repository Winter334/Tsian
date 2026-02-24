/**
 * Inventory Repository — 物品/技能数据的 Yjs 读写仓库
 *
 * 基于工厂函数模式（参考 game 模块的 createGameStateRepository）。
 * 提供带缓存的获取函数 getInventoryRepository()，按 saveId 缓存实例。
 *
 * Yjs 数据结构：
 * - inventoriesMap: Y.Map<Y.Array<Y.Map>> — key 为 characterId，value 为 ItemInstance Y.Array
 * - skillsMap: Y.Map<Y.Array<Y.Map>> — key 为 characterId，value 为 SkillInstance Y.Array
 *
 * @module inventory/repository/inventory-repository
 */

import { yjsManager } from "@/core/yjs";
import type { ItemInstance } from "@/domain/entities/item";
import type { SkillInstance } from "@/domain/entities/skill";
import * as Y from "yjs";

import {
  itemInstanceToYMap,
  skillInstanceToYMap,
  yMapToItemInstance,
  yMapToSkillInstance,
} from "./inventory-codec";

// ─── Repository 接口 ──────────────────────────────────────

export interface InventoryRepository {
  // 物品操作
  getItems(characterId: string): ItemInstance[];
  addItem(characterId: string, item: ItemInstance): void;
  removeItem(
    characterId: string,
    instanceId: string,
    quantity?: number,
  ): boolean;
  findItem(characterId: string, instanceId: string): ItemInstance | undefined;
  updateEquipStatus(
    characterId: string,
    instanceId: string,
    equipped: boolean,
    slot?: string,
  ): void;
  updateItemQuantity(
    characterId: string,
    instanceId: string,
    newQuantity: number,
  ): void;

  // 技能操作
  getSkills(characterId: string): SkillInstance[];
  addSkill(characterId: string, skill: SkillInstance): void;
  removeSkill(characterId: string, instanceId: string): boolean;
  findSkill(characterId: string, instanceId: string): SkillInstance | undefined;
}

// ─── 工厂函数 ─────────────────────────────────────────────

/**
 * 创建 InventoryRepository 实例
 *
 * @param inventoriesMap - 物品存储，key 为 characterId
 * @param skillsMap - 技能存储，key 为 characterId
 */
export function createInventoryRepository(
  inventoriesMap: Y.Map<unknown>,
  skillsMap: Y.Map<unknown>,
): InventoryRepository {
  // 通过 inventoriesMap 获取父 Y.Doc，用于事务
  const doc = inventoriesMap.doc!;

  // ── 辅助：获取/创建角色的物品 Y.Array ──

  function getOrCreateItemArray(characterId: string): Y.Array<Y.Map<unknown>> {
    let arr = inventoriesMap.get(characterId) as
      | Y.Array<Y.Map<unknown>>
      | undefined;
    if (!arr) {
      arr = new Y.Array<Y.Map<unknown>>();
      inventoriesMap.set(characterId, arr);
    }
    return arr;
  }

  // ── 辅助：获取/创建角色的技能 Y.Array ──

  function getOrCreateSkillArray(characterId: string): Y.Array<Y.Map<unknown>> {
    let arr = skillsMap.get(characterId) as Y.Array<Y.Map<unknown>> | undefined;
    if (!arr) {
      arr = new Y.Array<Y.Map<unknown>>();
      skillsMap.set(characterId, arr);
    }
    return arr;
  }

  // ── 物品操作 ──

  function getItems(characterId: string): ItemInstance[] {
    const arr = inventoriesMap.get(characterId) as
      | Y.Array<Y.Map<unknown>>
      | undefined;
    if (!arr) return [];

    const items: ItemInstance[] = [];
    for (let i = 0; i < arr.length; i++) {
      try {
        items.push(yMapToItemInstance(arr.get(i)));
      } catch {
        // 跳过无效数据
      }
    }
    return items;
  }

  function addItem(characterId: string, item: ItemInstance): void {
    doc.transact(() => {
      const arr = getOrCreateItemArray(characterId);
      const yMap = itemInstanceToYMap(item);
      arr.push([yMap]);
    });
  }

  function removeItem(
    characterId: string,
    instanceId: string,
    quantity?: number,
  ): boolean {
    const arr = inventoriesMap.get(characterId) as
      | Y.Array<Y.Map<unknown>>
      | undefined;
    if (!arr) return false;

    // 查找目标索引
    let targetIndex = -1;
    for (let i = 0; i < arr.length; i++) {
      const map = arr.get(i);
      if (map.get("instanceId") === instanceId) {
        targetIndex = i;
        break;
      }
    }

    if (targetIndex === -1) return false;

    doc.transact(() => {
      const map = arr.get(targetIndex);
      const currentQty = map.get("quantity");
      const currentQuantity = typeof currentQty === "number" ? currentQty : 1;

      if (quantity !== undefined && quantity < currentQuantity) {
        // 减少数量
        map.set("quantity", currentQuantity - quantity);
      } else {
        // 完全移除
        arr.delete(targetIndex, 1);
      }
    });

    return true;
  }

  function findItem(
    characterId: string,
    instanceId: string,
  ): ItemInstance | undefined {
    const arr = inventoriesMap.get(characterId) as
      | Y.Array<Y.Map<unknown>>
      | undefined;
    if (!arr) return undefined;

    for (let i = 0; i < arr.length; i++) {
      const map = arr.get(i);
      if (map.get("instanceId") === instanceId) {
        try {
          return yMapToItemInstance(map);
        } catch {
          return undefined;
        }
      }
    }
    return undefined;
  }

  function updateEquipStatus(
    characterId: string,
    instanceId: string,
    equipped: boolean,
    slot?: string,
  ): void {
    const arr = inventoriesMap.get(characterId) as
      | Y.Array<Y.Map<unknown>>
      | undefined;
    if (!arr) return;

    let targetIndex = -1;
    for (let i = 0; i < arr.length; i++) {
      const map = arr.get(i);
      if (map.get("instanceId") === instanceId) {
        targetIndex = i;
        break;
      }
    }

    if (targetIndex === -1) return;

    doc.transact(() => {
      const map = arr.get(targetIndex);
      map.set("equipped", equipped);

      if (equipped) {
        map.set("equipSlot", slot ?? "");
      } else {
        map.delete("equipSlot");
      }
    });
  }

  function updateItemQuantity(
    characterId: string,
    instanceId: string,
    newQuantity: number,
  ): void {
    const arr = inventoriesMap.get(characterId) as
      | Y.Array<Y.Map<unknown>>
      | undefined;
    if (!arr) return;

    let targetIndex = -1;
    for (let i = 0; i < arr.length; i++) {
      const map = arr.get(i);
      if (map.get("instanceId") === instanceId) {
        targetIndex = i;
        break;
      }
    }

    if (targetIndex === -1) return;

    doc.transact(() => {
      if (newQuantity <= 0) {
        arr.delete(targetIndex, 1);
        return;
      }

      const map = arr.get(targetIndex);
      map.set("quantity", newQuantity);
    });
  }

  // ── 技能操作 ──

  function getSkills(characterId: string): SkillInstance[] {
    const arr = skillsMap.get(characterId) as
      | Y.Array<Y.Map<unknown>>
      | undefined;
    if (!arr) return [];

    const skills: SkillInstance[] = [];
    for (let i = 0; i < arr.length; i++) {
      try {
        skills.push(yMapToSkillInstance(arr.get(i)));
      } catch {
        // 跳过无效数据
      }
    }
    return skills;
  }

  function addSkill(characterId: string, skill: SkillInstance): void {
    doc.transact(() => {
      const arr = getOrCreateSkillArray(characterId);
      const yMap = skillInstanceToYMap(skill);
      arr.push([yMap]);
    });
  }

  function removeSkill(characterId: string, instanceId: string): boolean {
    const arr = skillsMap.get(characterId) as
      | Y.Array<Y.Map<unknown>>
      | undefined;
    if (!arr) return false;

    let targetIndex = -1;
    for (let i = 0; i < arr.length; i++) {
      const map = arr.get(i);
      if (map.get("instanceId") === instanceId) {
        targetIndex = i;
        break;
      }
    }

    if (targetIndex === -1) return false;

    doc.transact(() => {
      arr.delete(targetIndex, 1);
    });

    return true;
  }

  function findSkill(
    characterId: string,
    instanceId: string,
  ): SkillInstance | undefined {
    const arr = skillsMap.get(characterId) as
      | Y.Array<Y.Map<unknown>>
      | undefined;
    if (!arr) return undefined;

    for (let i = 0; i < arr.length; i++) {
      const map = arr.get(i);
      if (map.get("instanceId") === instanceId) {
        try {
          return yMapToSkillInstance(map);
        } catch {
          return undefined;
        }
      }
    }
    return undefined;
  }

  // ── 返回 Repository 接口 ──

  return {
    getItems,
    addItem,
    removeItem,
    findItem,
    updateEquipStatus,
    updateItemQuantity,
    getSkills,
    addSkill,
    removeSkill,
    findSkill,
  };
}

// ─── 带缓存的获取函数 ────────────────────────────────────

let cachedRepo: InventoryRepository | null = null;
let cachedSaveId: string | null = null;

/**
 * 获取当前存档的 InventoryRepository
 *
 * 按 saveId 缓存实例，存档切换时自动重建。
 * 惰性创建 inventories/skills Y.Map（不修改核心 Yjs 初始化代码）。
 */
export function getInventoryRepository(): InventoryRepository | null {
  const saveId = yjsManager.getCurrentSaveId();
  if (!saveId) return null;

  // 缓存命中
  if (cachedRepo && cachedSaveId === saveId) return cachedRepo;

  const savesMap = yjsManager.getSaveSlots();
  const saveMap = savesMap.get(saveId) as Y.Map<unknown> | undefined;
  if (!saveMap) return null;

  // 惰性创建 inventories map
  let inventoriesMap = saveMap.get("inventories") as Y.Map<unknown> | undefined;
  if (!inventoriesMap) {
    inventoriesMap = new Y.Map<unknown>();
    saveMap.set("inventories", inventoriesMap);
  }

  // 惰性创建 skills map
  let skillsMap = saveMap.get("skills") as Y.Map<unknown> | undefined;
  if (!skillsMap) {
    skillsMap = new Y.Map<unknown>();
    saveMap.set("skills", skillsMap);
  }

  cachedRepo = createInventoryRepository(inventoriesMap, skillsMap);
  cachedSaveId = saveId;
  return cachedRepo;
}

/**
 * 清除缓存（存档切换时调用）
 */
export function clearInventoryRepositoryCache(): void {
  cachedRepo = null;
  cachedSaveId = null;
}
