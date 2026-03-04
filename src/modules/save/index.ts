/**
 * Save 模块入口
 *
 * 存档槽位管理模块
 * 负责存档的创建、加载、删除、重命名
 */

import { registry } from "@/core";
import type { ModuleManifest } from "@/core/registry";
import { createSaveCommandHandlers } from "./commands/handlers";

const manifest: ModuleManifest = {
  id: "lyra.save",
  version: "0.1.0",
  commands: createSaveCommandHandlers(),
};

// 导出 hooks
export * from "./hooks/useSaveData";

/**
 * 注册 Save 模块
 */
export async function registerSaveModule(): Promise<void> {
  await registry.register(manifest);
}

/**
 * 注销 Save 模块
 */
export async function unregisterSaveModule(): Promise<void> {
  await registry.unregister("lyra.save");
}
