/**
 * Game 模块入口（IRNR）
 */

import { registry, services } from "@/core";
import type { DomainEvent } from "@/core/event-bus";
import type { ModuleManifest } from "@/core/registry";
import {
  InventoryEvents,
  type ItemUsedPayload,
} from "@/domain/events/inventory";
import { actionSchemaRegistry } from "@/lib/rules/schema";
import { snapshotRegistry } from "@/modules/checkpoint/snapshot-api";
import { createGameCommandHandlers } from "./handlers";
import {
  directActionService,
  gameStateService,
  irnrPipelineService,
} from "./services";
import {
  gameActionSchemas,
  modifyDamageSchema,
} from "./services/action-schemas";
import {
  DIRECT_ACTION_SERVICE_TOKEN,
  GAME_STATE_SERVICE_TOKEN,
  IRNR_PIPELINE_SERVICE_TOKEN,
} from "./services/tokens";
import { gameSnapshotFields } from "./snapshot";
import { useOperationLogStore } from "./stores/operation-log-store";

// 导出服务
export * from "./services";

// 导出 Store（只读使用）
export { useOperationLogStore } from "./stores/operation-log-store";

const manifest: ModuleManifest = {
  id: "lyra.game",
  version: "0.1.0",
  commands: createGameCommandHandlers(),
  eventHandlers: {
    [InventoryEvents.ITEM_USED]: (event) => {
      const payload = (event as DomainEvent<ItemUsedPayload>).payload;
      const { item, resultFrame } = payload;
      if (!resultFrame) {
        return;
      }

      useOperationLogStore.getState().addEntry({
        source: `使用 ${item.name}`,
        resultFrame,
        timestamp: Date.now(),
      });
    },
  },
};

/**
 * 注册 Game 模块
 */
export async function registerGameModule(): Promise<void> {
  await registry.register(manifest);
  services.register(IRNR_PIPELINE_SERVICE_TOKEN, irnrPipelineService);
  services.register(DIRECT_ACTION_SERVICE_TOKEN, directActionService);
  services.register(GAME_STATE_SERVICE_TOKEN, gameStateService);
  actionSchemaRegistry.registerActions("lyra.game", [
    ...gameActionSchemas,
    modifyDamageSchema,
  ]);
  snapshotRegistry.register("lyra.game", gameSnapshotFields);
}

/**
 * 注销 Game 模块
 */
export async function unregisterGameModule(): Promise<void> {
  snapshotRegistry.unregister("lyra.game");
  actionSchemaRegistry.unregisterModule("lyra.game");
  services.unregister(GAME_STATE_SERVICE_TOKEN);
  services.unregister(IRNR_PIPELINE_SERVICE_TOKEN);
  services.unregister(DIRECT_ACTION_SERVICE_TOKEN);
  await registry.unregister("lyra.game");
}
