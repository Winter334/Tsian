/**
 * Game 模块入口（IRNR）
 */

import { registry, services } from "@/core";
import type { ModuleManifest } from "@/core/registry";
import { actionSchemaRegistry } from "@/lib/rules/schema";
import { createGameCommandHandlers } from "./handlers";
import { irnrPipelineService } from "./services";
import { gameActionSchemas } from "./services/action-schemas";
import { IRNR_PIPELINE_SERVICE_TOKEN } from "./services/tokens";

// 导出服务
export * from "./services";

const manifest: ModuleManifest = {
  id: "lyra.game",
  version: "0.1.0",
  commands: createGameCommandHandlers(),
};

/**
 * 注册 Game 模块
 */
export async function registerGameModule(): Promise<void> {
  await registry.register(manifest);
  services.register(IRNR_PIPELINE_SERVICE_TOKEN, irnrPipelineService);
  actionSchemaRegistry.registerActions("lyra.game", gameActionSchemas);
}

/**
 * 注销 Game 模块
 */
export async function unregisterGameModule(): Promise<void> {
  actionSchemaRegistry.unregisterModule("lyra.game");
  services.unregister(IRNR_PIPELINE_SERVICE_TOKEN);
  await registry.unregister("lyra.game");
}
