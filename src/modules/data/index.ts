/**
 * Data 模块入口
 *
 * 数据管理模块
 * 负责数据的导出/导入功能
 */

import { registry } from "@/core";
import type { ModuleManifest } from "@/core/registry";
import { DataCommands } from "@/domain/commands/data";
import { DataEvents } from "@/domain/events/data";
import { createDataCommandHandlers } from "./commands/handlers";

const manifest: ModuleManifest = {
  id: "lyra.data",
  version: "0.1.0",
  commands: createDataCommandHandlers(),
};

// 导出类型
export * from "./types";

// 导出工具函数
export { generateImportPreview, parseImportFile } from "./utils/import";
export { validateExportData } from "./utils/validation";

// 导出命令和事件常量
export { DataCommands, DataEvents };

/**
 * 注册 Data 模块
 */
export async function registerDataModule(): Promise<void> {
  await registry.register(manifest);
}

/**
 * 注销 Data 模块
 */
export async function unregisterDataModule(): Promise<void> {
  await registry.unregister("lyra.data");
}
