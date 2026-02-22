/**
 * Inventory 模块入口
 *
 * 注册物品/技能系统的命令处理器。
 *
 * @module inventory
 */

import { registry } from "@/core";
import type { ModuleManifest } from "@/core/registry";
import { yjsManager } from "@/core/yjs";
import { SaveEvents, type SaveDeletedPayload } from "@/domain/events/save";
import { actionSchemaRegistry } from "@/lib/rules/schema";
import { createInventoryCommandHandlers } from "./handlers";
import { clearInventoryRepositoryCache } from "./repository";
import { inventoryActionSchemas } from "./schemas/action-schemas";
import { InventorySyncBridge } from "./sync/InventorySyncBridge";

// 导出公共 API
export {
  clearInventoryRepositoryCache,
  getInventoryRepository,
} from "./repository";
export { useInventoryStore } from "./store";

// ── SyncBridge 单例 ────────────────────────────────────────

let syncBridge: InventorySyncBridge | null = null;

function rebuildSyncBridgeForCurrentSave(): void {
  if (syncBridge) {
    syncBridge.destroy();
    syncBridge = null;
  }
  clearInventoryRepositoryCache();

  if (!yjsManager.getCurrentSaveId() || !yjsManager.getCurrentSave()) {
    return;
  }

  syncBridge = new InventorySyncBridge();
  syncBridge.hydrate();
  syncBridge.startObserving();
}

const manifest: ModuleManifest = {
  id: "lyra.inventory",
  version: "0.1.0",
  commands: createInventoryCommandHandlers(),
  eventHandlers: {
    /**
     * 存档加载：重建 SyncBridge，水合 + 开始观察
     */
    [SaveEvents.SAVE_LOADED]: (_event) => {
      rebuildSyncBridgeForCurrentSave();
    },

    /**
     * 存档删除：如果删除的是当前存档，销毁 SyncBridge
     */
    [SaveEvents.SAVE_DELETED]: (event) => {
      const payload = event.payload as SaveDeletedPayload;
      if (payload.isCurrentSave) {
        if (syncBridge) {
          syncBridge.destroy();
          syncBridge = null;
        }
        clearInventoryRepositoryCache();
      }
    },
  },
};

/**
 * 注册 Inventory 模块
 */
export async function registerInventoryModule(): Promise<void> {
  await registry.register(manifest);
  actionSchemaRegistry.registerActions(
    "lyra.inventory",
    inventoryActionSchemas,
  );

  // 条件模块在 SAVE_LOADED 处理中首次注册时会错过该事件，
  // 因此注册完成后若已有当前存档，立即执行水合与观察。
  rebuildSyncBridgeForCurrentSave();
}

/**
 * 注销 Inventory 模块
 */
export async function unregisterInventoryModule(): Promise<void> {
  // 清理 SyncBridge
  if (syncBridge) {
    syncBridge.destroy();
    syncBridge = null;
  }
  actionSchemaRegistry.unregisterModule("lyra.inventory");
  await registry.unregister("lyra.inventory");
}
