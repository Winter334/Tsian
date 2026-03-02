/**
 * Memory 模块入口
 *
 * 职责：
 * - 记忆数据（小总结/大总结/手动记忆）的命令处理
 * - 存档切换时的仓储与状态同步
 */

import { registry } from "@/core";
import type { ModuleManifest } from "@/core/registry";
import { MemoryCommands } from "@/domain/commands/memory";
import { MemoryEvents } from "@/domain/events/memory";
import { RoomEvents, type ConnectionEvent } from "@/domain/events/room";
import { SaveEvents, type SaveDeletedPayload } from "@/domain/events/save";
import { variableResolver } from "@/lib/prompt/resolver";
import { snapshotRegistry } from "@/modules/checkpoint/snapshot-api";
import { createMemoryCommandHandlers } from "./handlers";
import {
  getMemoryRepository,
  resetAllMultiplayerMemoryRepositories,
  resetMemoryRepository,
} from "./repository";
import { memorySnapshotFields } from "./snapshot";
import { useMemoryStore } from "./store";
import { setupMemorySync, teardownMemorySync } from "./sync";
import { registerMemoryVariable } from "./variable-registry";

/**
 * 存档加载后同步记忆数据到 Store
 */
function hydrateMemoryStore(): void {
  const store = useMemoryStore.getState();
  store.clear();

  try {
    const repository = getMemoryRepository();
    store.syncAllFromRepository(repository);
  } catch {
    // 存档尚未可用时保持空状态
  }
}

/**
 * Memory 模块 Manifest
 */
const manifest: ModuleManifest = {
  id: "lyra.memory",
  version: "0.1.0",
  commands: createMemoryCommandHandlers(),
  eventHandlers: {
    [SaveEvents.SAVE_LOADED]: (_event) => {
      teardownMemorySync();
      resetAllMultiplayerMemoryRepositories();
      resetMemoryRepository();
      hydrateMemoryStore();
    },

    [SaveEvents.SAVE_DELETED]: (event) => {
      const payload = event.payload as SaveDeletedPayload;
      if (payload.isCurrentSave) {
        teardownMemorySync();
        resetMemoryRepository();
        resetAllMultiplayerMemoryRepositories();
        useMemoryStore.getState().clear();
      }
    },

    [RoomEvents.RECONNECTED]: (event) => {
      const payload = event.payload as ConnectionEvent;
      void setupMemorySync(payload.roomId);
    },

    [RoomEvents.DISCONNECTED]: () => {
      teardownMemorySync();
      resetAllMultiplayerMemoryRepositories();
    },
  },
};

/**
 * 注册 Memory 模块
 */
export async function registerMemoryModule(): Promise<void> {
  // 注册 {{memory:xxx}} 变量函数
  registerMemoryVariable(variableResolver);

  await registry.register(manifest);
  snapshotRegistry.register("lyra.memory", memorySnapshotFields);
}

/**
 * 注销 Memory 模块
 */
export async function unregisterMemoryModule(): Promise<void> {
  snapshotRegistry.unregister("lyra.memory");
  await registry.unregister("lyra.memory");
  teardownMemorySync();
  resetMemoryRepository();
  resetAllMultiplayerMemoryRepositories();
  useMemoryStore.getState().clear();
}

// 导出供外部使用的公共 API
export * from "./components";
export * from "./memory-injector";
export * from "./repository";
export * from "./store";
export { MemoryCommands, MemoryEvents };
