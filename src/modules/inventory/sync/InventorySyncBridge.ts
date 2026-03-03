/**
 * InventorySyncBridge — Yjs → Zustand Store 的同步桥接
 *
 * 职责：
 * 1. 初始水合：从权威源读取所有角色的物品/技能，写入 Store
 * 2. 实时观察：通过 Y.Map.observeDeep() 监听 Yjs 变化，自动推送到 Store
 * 3. 清理：存档关闭/切换时取消观察、清空 Store
 *
 * 数据源策略：
 * - offline：SaveSlot.inventories / SaveSlot.skills
 * - online：MainDoc.inventory.{characterId}.{items|skills}
 *
 * ⚠️ 架构说明：
 * - SyncBridge 是 Yjs 状态到本地 Store 的**唯一桥接点**
 * - 作为同步基础设施，允许直接更新 Store（这是架构的特例）
 * - 普通业务逻辑仍需通过 CommandBus 修改状态
 *
 * @module inventory/sync/InventorySyncBridge
 */

import { subdocManager, yjsManager } from "@/core/yjs";
import type { ItemInstance } from "@/domain/entities/item";
import type { SkillInstance } from "@/domain/entities/skill";
import { useRoomStore } from "@/modules/room/store";
import * as Y from "yjs";
import {
  yMapToItemInstance,
  yMapToSkillInstance,
} from "../repository/inventory-codec";
import { useInventoryStore } from "../store";

type InventoryYEvent = Y.YEvent<Y.AbstractType<unknown>>;

/**
 * InventorySyncBridge 类
 *
 * 管理单个存档的物品/技能数据从 Yjs 到 Zustand Store 的同步
 */
export class InventorySyncBridge {
  /** 是否已销毁 */
  private destroyed = false;

  /** Yjs 观察器清理函数 */
  private observerCleanups: Array<() => void> = [];

  /** inventories Y.Map 引用 */
  private inventoriesMap: Y.Map<unknown> | null = null;

  /** skills Y.Map 引用 */
  private skillsMap: Y.Map<unknown> | null = null;

  /** online 模式下的权威库存根节点（MainDoc.inventory） */
  private onlineInventoryRoot: Y.Map<Y.Map<unknown>> | null = null;

  // ===== 生命周期 =====

  /**
   * 初始水合：从权威源读取所有角色的物品/技能，写入 Store
   *
   * 遍历 inventories 和 skills Y.Map 的所有 key（characterId），
   * 读取数据并批量设置到 Store。
   */
  hydrate(): void {
    const maps = this.getYjsMaps();
    if (!maps) {
      console.warn(
        "[InventorySyncBridge] hydrate: 无法获取 Yjs Maps，跳过水合",
      );
      return;
    }

    const { inventoriesMap, skillsMap } = maps;
    this.inventoriesMap = inventoriesMap;
    this.skillsMap = skillsMap;

    const store = useInventoryStore.getState();

    // 水合物品
    inventoriesMap.forEach((_value, characterId) => {
      const items = this.readItems(inventoriesMap, characterId);
      store._setCharacterItems(characterId, items);
    });

    // 水合技能
    skillsMap.forEach((_value, characterId) => {
      const skills = this.readSkills(skillsMap, characterId);
      store._setCharacterSkills(characterId, skills);
    });

    console.info("[InventorySyncBridge] 水合完成", {
      itemCharacters: inventoriesMap.size,
      skillCharacters: skillsMap.size,
    });
  }

  /**
   * 开始实时观察 Yjs 变化
   *
   * 使用 observeDeep 监听 inventories 和 skills Y.Map 的深层变化，
   * 当 Yjs 数据变更时自动同步到 Store。
   */
  startObserving(): void {
    if (this.destroyed) return;

    // online：直接观察权威节点 MainDoc.inventory，避免临时映射导致观察链不稳定
    if (this.onlineInventoryRoot) {
      const onlineObserver = (events: InventoryYEvent[]) => {
        if (this.destroyed) return;
        this.handleOnlineInventoryRootChange(events);
      };

      this.onlineInventoryRoot.observeDeep(onlineObserver);
      this.observerCleanups.push(() =>
        this.onlineInventoryRoot?.unobserveDeep(onlineObserver),
      );
      return;
    }

    // offline：沿用 SaveSlot.inventories / SaveSlot.skills 双映射观察
    if (!this.inventoriesMap || !this.skillsMap) {
      console.warn(
        "[InventorySyncBridge] startObserving: 未执行 hydrate，跳过",
      );
      return;
    }

    const inventoriesObserver = (events: InventoryYEvent[]) => {
      if (this.destroyed) return;
      this.handleInventoriesChange(events);
    };

    this.inventoriesMap.observeDeep(inventoriesObserver);
    this.observerCleanups.push(() =>
      this.inventoriesMap?.unobserveDeep(inventoriesObserver),
    );

    const skillsObserver = (events: InventoryYEvent[]) => {
      if (this.destroyed) return;
      this.handleSkillsChange(events);
    };

    this.skillsMap.observeDeep(skillsObserver);
    this.observerCleanups.push(() =>
      this.skillsMap?.unobserveDeep(skillsObserver),
    );
  }

  /**
   * 销毁 SyncBridge
   *
   * 取消所有观察器、清空 Store
   */
  destroy(): void {
    if (this.destroyed) return;

    this.destroyed = true;

    // 取消 Yjs 观察器
    this.observerCleanups.forEach((cleanup) => cleanup());
    this.observerCleanups = [];

    // 清空 Store
    useInventoryStore.getState()._clear();

    // 清除引用
    this.inventoriesMap = null;
    this.skillsMap = null;
    this.onlineInventoryRoot = null;
  }

  // ===== 内部方法 =====

  /**
   * 在线模式：从 MainDoc.inventory 读取角色映射
   */
  private getOnlineYjsMaps(): {
    inventoriesMap: Y.Map<unknown>;
    skillsMap: Y.Map<unknown>;
  } | null {
    this.onlineInventoryRoot = null;

    const room = useRoomStore.getState().currentRoom;
    if (!room) {
      return null;
    }

    const inventoryRoot = subdocManager.getRoomInventoryRoot(room.roomId);
    if (!inventoryRoot) {
      return null;
    }

    this.onlineInventoryRoot = inventoryRoot;

    const inventoriesMap = new Y.Map<unknown>();
    const skillsMap = new Y.Map<unknown>();

    inventoryRoot.forEach((characterInventoryMap, characterId) => {
      if (!(characterInventoryMap instanceof Y.Map)) {
        return;
      }

      const items = characterInventoryMap.get("items");
      const skills = characterInventoryMap.get("skills");

      if (items instanceof Y.Array) {
        inventoriesMap.set(characterId, items);
      }

      if (skills instanceof Y.Array) {
        skillsMap.set(characterId, skills);
      }
    });

    return { inventoriesMap, skillsMap };
  }

  /**
   * 离线模式：从 SaveSlot 读取 inventories / skills
   */
  private getOfflineYjsMaps(): {
    inventoriesMap: Y.Map<unknown>;
    skillsMap: Y.Map<unknown>;
  } | null {
    this.onlineInventoryRoot = null;

    const saveId = yjsManager.getCurrentSaveId();
    if (!saveId) {
      return null;
    }

    const savesMap = yjsManager.getSaveSlots();
    const saveMap = savesMap.get(saveId) as Y.Map<unknown> | undefined;
    if (!saveMap) {
      return null;
    }

    // 惰性创建 inventories map
    let inventoriesMap = saveMap.get("inventories") as
      | Y.Map<unknown>
      | undefined;
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

    return { inventoriesMap, skillsMap };
  }

  /**
   * 获取当前会话可用的 inventories / skills 映射
   */
  private getYjsMaps(): {
    inventoriesMap: Y.Map<unknown>;
    skillsMap: Y.Map<unknown>;
  } | null {
    const room = useRoomStore.getState().currentRoom;
    if (room) {
      const onlineMaps = this.getOnlineYjsMaps();
      if (onlineMaps) {
        return onlineMaps;
      }
    }

    return this.getOfflineYjsMaps();
  }

  /**
   * 从 inventories Y.Map 读取指定角色的物品列表
   */
  private readItems(
    inventoriesMap: Y.Map<unknown>,
    characterId: string,
  ): ItemInstance[] {
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

  /**
   * 从 skills Y.Map 读取指定角色的技能列表
   */
  private readSkills(
    skillsMap: Y.Map<unknown>,
    characterId: string,
  ): SkillInstance[] {
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

  /**
   * 从 MainDoc.inventory 读取指定角色的物品列表
   */
  private readOnlineItems(characterId: string): ItemInstance[] {
    const inventoryRoot = this.onlineInventoryRoot;
    if (!inventoryRoot) return [];

    const characterInventoryMap = inventoryRoot.get(characterId);
    if (!(characterInventoryMap instanceof Y.Map)) return [];

    const itemsValue = characterInventoryMap.get("items");
    if (!(itemsValue instanceof Y.Array)) return [];

    const items: ItemInstance[] = [];
    for (let i = 0; i < itemsValue.length; i++) {
      const itemMap = itemsValue.get(i);
      if (!(itemMap instanceof Y.Map)) {
        continue;
      }

      try {
        items.push(yMapToItemInstance(itemMap));
      } catch {
        // 跳过无效数据
      }
    }

    return items;
  }

  /**
   * 从 MainDoc.inventory 读取指定角色的技能列表
   */
  private readOnlineSkills(characterId: string): SkillInstance[] {
    const inventoryRoot = this.onlineInventoryRoot;
    if (!inventoryRoot) return [];

    const characterInventoryMap = inventoryRoot.get(characterId);
    if (!(characterInventoryMap instanceof Y.Map)) return [];

    const skillsValue = characterInventoryMap.get("skills");
    if (!(skillsValue instanceof Y.Array)) return [];

    const skills: SkillInstance[] = [];
    for (let i = 0; i < skillsValue.length; i++) {
      const skillMap = skillsValue.get(i);
      if (!(skillMap instanceof Y.Map)) {
        continue;
      }

      try {
        skills.push(yMapToSkillInstance(skillMap));
      } catch {
        // 跳过无效数据
      }
    }

    return skills;
  }

  /**
   * 处理 online 模式下 MainDoc.inventory 的深层变化
   */
  private handleOnlineInventoryRootChange(events: InventoryYEvent[]): void {
    if (!this.onlineInventoryRoot) return;

    const affectedCharacterIds = this.extractAffectedKeys(
      events,
      this.onlineInventoryRoot as unknown as Y.Map<unknown>,
    );

    const store = useInventoryStore.getState();
    for (const characterId of affectedCharacterIds) {
      const items = this.readOnlineItems(characterId);
      const skills = this.readOnlineSkills(characterId);
      store._setCharacterItems(characterId, items);
      store._setCharacterSkills(characterId, skills);
    }
  }

  /**
   * 处理 inventories Y.Map 的深层变化
   *
   * 从事件中提取受影响的 characterId，重新读取对应数据并写入 Store
   */
  private handleInventoriesChange(events: InventoryYEvent[]): void {
    if (!this.inventoriesMap) return;

    const affectedCharacterIds = this.extractAffectedKeys(
      events,
      this.inventoriesMap,
    );

    const store = useInventoryStore.getState();
    for (const characterId of affectedCharacterIds) {
      const items = this.readItems(this.inventoriesMap, characterId);
      store._setCharacterItems(characterId, items);
    }
  }

  /**
   * 处理 skills Y.Map 的深层变化
   *
   * 从事件中提取受影响的 characterId，重新读取对应数据并写入 Store
   */
  private handleSkillsChange(events: InventoryYEvent[]): void {
    if (!this.skillsMap) return;

    const affectedCharacterIds = this.extractAffectedKeys(
      events,
      this.skillsMap,
    );

    const store = useInventoryStore.getState();
    for (const characterId of affectedCharacterIds) {
      const skills = this.readSkills(this.skillsMap, characterId);
      store._setCharacterSkills(characterId, skills);
    }
  }

  /**
   * 从 observeDeep 事件中提取受影响的顶层 key（characterId）
   *
   * observeDeep 会产生多层事件。策略：
   * - 如果事件目标就是根 Map 本身，直接读取 keysChanged
   * - 如果事件目标是嵌套对象（Y.Array 或 Y.Map），向上追溯找到根 Map 的 key
   */
  private extractAffectedKeys(
    events: InventoryYEvent[],
    rootMap: Y.Map<unknown>,
  ): Set<string> {
    const affected = new Set<string>();

    for (const event of events) {
      if (event.target === rootMap) {
        // 顶层 Map 变化：key 被添加/删除/替换
        if (event instanceof Y.YMapEvent) {
          for (const key of event.keysChanged) {
            affected.add(key);
          }
        }
      } else {
        // 嵌套变化：向上追溯 path 找到 characterId
        // event.path 从根到目标的路径，第一段就是 characterId
        const path = event.path;
        if (path.length > 0 && typeof path[0] === "string") {
          affected.add(path[0]);
        }
      }
    }

    return affected;
  }
}
