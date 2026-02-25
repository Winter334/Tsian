/**
 * Inventory Zustand Store
 *
 * 维护从 Yjs 同步来的本地状态，供 UI 响应式读取。
 * 内部变更方法（以 _ 前缀标记）仅由 handlers 调用，UI 只读取数据。
 *
 * @module inventory/store
 */

import type { ItemInstance } from "@/domain/entities/item";
import type { SkillInstance } from "@/domain/entities/skill";
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

// ─── 状态接口 ─────────────────────────────────────────────

export interface InventoryState {
  /** 按角色 ID 分组的物品列表 */
  items: Record<string, ItemInstance[]>;
  /** 按角色 ID 分组的技能列表 */
  skills: Record<string, SkillInstance[]>;

  // ── 内部变更方法（仅由 handlers 调用）──
  _setCharacterItems(characterId: string, items: ItemInstance[]): void;
  _setCharacterSkills(characterId: string, skills: SkillInstance[]): void;
  _addItem(characterId: string, item: ItemInstance): void;
  _removeItem(characterId: string, instanceId: string, quantity?: number): void;
  _equipItem(characterId: string, instanceId: string, slot: string): void;
  _unequipItem(characterId: string, instanceId: string): void;
  _updateItemQuantity(
    characterId: string,
    instanceId: string,
    newQuantity: number,
  ): void;
  _addSkill(characterId: string, skill: SkillInstance): void;
  _removeSkill(characterId: string, instanceId: string): void;
  _clear(): void;
}

// ─── Store 创建 ───────────────────────────────────────────

export const useInventoryStore = create<InventoryState>()(
  immer((set) => ({
    items: {},
    skills: {},

    _setCharacterItems(characterId: string, items: ItemInstance[]) {
      set((state) => {
        state.items[characterId] = items;
      });
    },

    _setCharacterSkills(characterId: string, skills: SkillInstance[]) {
      set((state) => {
        state.skills[characterId] = skills;
      });
    },

    _addItem(characterId: string, item: ItemInstance) {
      set((state) => {
        if (!state.items[characterId]) {
          state.items[characterId] = [];
        }

        const existingIndex = state.items[characterId].findIndex(
          (current) => current.instanceId === item.instanceId,
        );

        if (existingIndex !== -1) {
          if (import.meta.env.DEV) {
            console.warn(
              `[InventoryStore] _addItem: 检测到重复 instanceId "${item.instanceId}"，执行替换而非追加`,
            );
          }
          state.items[characterId][existingIndex] = item;
          return;
        }

        state.items[characterId].push(item);
      });
    },

    _removeItem(characterId: string, instanceId: string, quantity?: number) {
      set((state) => {
        const charItems = state.items[characterId];
        if (!charItems) return;

        const index = charItems.findIndex((i) => i.instanceId === instanceId);
        if (index === -1) return;

        if (quantity !== undefined && quantity < charItems[index].quantity) {
          // 减少数量
          charItems[index].quantity -= quantity;
        } else {
          // 完全移除
          charItems.splice(index, 1);
        }
      });
    },

    _equipItem(characterId: string, instanceId: string, slot: string) {
      set((state) => {
        const charItems = state.items[characterId];
        if (!charItems) return;

        const item = charItems.find((i) => i.instanceId === instanceId);
        if (!item) return;

        item.equipped = true;
        item.equipSlot = slot;
      });
    },

    _unequipItem(characterId: string, instanceId: string) {
      set((state) => {
        const charItems = state.items[characterId];
        if (!charItems) return;

        const item = charItems.find((i) => i.instanceId === instanceId);
        if (!item) return;

        item.equipped = false;
        item.equipSlot = undefined;
      });
    },

    _updateItemQuantity(
      characterId: string,
      instanceId: string,
      newQuantity: number,
    ) {
      set((state) => {
        const charItems = state.items[characterId];
        if (!charItems) return;

        const index = charItems.findIndex((i) => i.instanceId === instanceId);
        if (index === -1) return;

        if (newQuantity <= 0) {
          charItems.splice(index, 1);
          return;
        }

        charItems[index].quantity = newQuantity;
      });
    },

    _addSkill(characterId: string, skill: SkillInstance) {
      set((state) => {
        if (!state.skills[characterId]) {
          state.skills[characterId] = [];
        }

        const existingIndex = state.skills[characterId].findIndex(
          (current) => current.instanceId === skill.instanceId,
        );

        if (existingIndex !== -1) {
          if (import.meta.env.DEV) {
            console.warn(
              `[InventoryStore] _addSkill: 检测到重复 instanceId "${skill.instanceId}"，执行替换而非追加`,
            );
          }
          state.skills[characterId][existingIndex] = skill;
          return;
        }

        state.skills[characterId].push(skill);
      });
    },

    _removeSkill(characterId: string, instanceId: string) {
      set((state) => {
        const charSkills = state.skills[characterId];
        if (!charSkills) return;

        const index = charSkills.findIndex((s) => s.instanceId === instanceId);
        if (index === -1) return;

        charSkills.splice(index, 1);
      });
    },

    _clear() {
      set((state) => {
        state.items = {};
        state.skills = {};
      });
    },
  })),
);
