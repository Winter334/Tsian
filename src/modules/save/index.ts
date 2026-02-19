/**
 * Save 模块入口
 *
 * 存档槽位管理模块
 * 负责存档的创建、加载、删除、重命名
 */

import { commandBus } from "@/core/command-bus";
import { createSaveCommandHandlers } from "./commands/handlers";

// 导出 hooks
export * from "./hooks/useSaveData";

/**
 * 注册 Save 模块
 */
export async function registerSaveModule(): Promise<void> {
  // 注册命令处理器
  const handlers = createSaveCommandHandlers();
  for (const [type, handler] of Object.entries(handlers)) {
    commandBus.register(type, handler);
  }
}

/**
 * 注销 Save 模块
 */
export async function unregisterSaveModule(): Promise<void> {
  // 注销命令处理器
  const handlers = createSaveCommandHandlers();
  for (const type of Object.keys(handlers)) {
    commandBus.unregister(type);
  }
}
