/**
 * Data 模块入口
 *
 * 数据管理模块
 * 负责数据的导出/导入功能
 */

import { commandBus } from "@/core/command-bus";
import { DataCommands } from "@/domain/commands/data";
import { DataEvents } from "@/domain/events/data";
import { createDataCommandHandlers } from "./commands/handlers";

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
  // 注册命令处理器
  const handlers = createDataCommandHandlers();
  for (const [type, handler] of Object.entries(handlers)) {
    commandBus.register(type, handler);
  }
}

/**
 * 注销 Data 模块
 */
export async function unregisterDataModule(): Promise<void> {
  // 注销命令处理器
  const handlers = createDataCommandHandlers();
  for (const type of Object.keys(handlers)) {
    commandBus.unregister(type);
  }
}
