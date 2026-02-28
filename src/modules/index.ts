/**
 * 模块注册入口
 *
 * 所有模块在此统一注册，确保在应用启动时完成初始化。
 * 新增模块时，需要在此文件中添加对应的注册调用。
 *
 * 注意：模块间通过 EventBus/CommandBus 通信，不应直接 import 其他模块代码。
 */

import { registry } from "@/core";

import { registerChatModule, unregisterChatModule } from "./chat";
import { registerCheckpointModule } from "./checkpoint";
import { setupConditionalModules } from "./conditional";
import { registerDataModule, unregisterDataModule } from "./data";
import { registerDirectorModule, unregisterDirectorModule } from "./director";
import { registerGameModule, unregisterGameModule } from "./game";
import { unregisterInventoryModule } from "./inventory";
import { registerMemoryModule, unregisterMemoryModule } from "./memory";
import { registerRoomModule } from "./room";
import { registerSaveModule, unregisterSaveModule } from "./save";
import {
  registerWorldArchiveModule,
  unregisterWorldArchiveModule,
} from "./world-archive";

let cleanupConditionalModules: (() => void) | null = null;

/**
 * 注册所有模块
 *
 * 在应用启动时调用此函数，初始化所有模块。
 * 每个模块独立注册，模块间通过事件/命令通信，无代码级依赖。
 */
export async function registerAllModules(): Promise<void> {
  // Phase 1: 核心模块
  await registerSaveModule(); // Save 模块先注册，因为 Chat 依赖存档
  await registerChatModule();
  await registerMemoryModule();
  await registerDataModule(); // Data 模块（导出/导入功能）

  // Phase 1.5: 世界档案 + 导演
  await registerWorldArchiveModule();
  await registerDirectorModule();

  // Phase 2: IRNR 模块
  await registerGameModule();

  // Phase 2.5: 条件模块（事件驱动，不在此处直接注册）
  cleanupConditionalModules = setupConditionalModules();

  // Phase 2.6: Checkpoint 模块（检查点系统）
  await registerCheckpointModule();

  // Phase 3: 联机模块
  registerRoomModule(); // Room 模块（联机房间功能）
}

/**
 * 注销所有模块
 *
 * 在应用卸载时调用（如热更新时）
 */
export async function unregisterAllModules(): Promise<void> {
  // 清理条件模块监听
  if (cleanupConditionalModules) {
    cleanupConditionalModules();
    cleanupConditionalModules = null;
  }

  // 按注册的逆序卸载
  // Room 模块暂无 unregister（命令处理器会被覆盖）
  if (registry.hasModule("lyra.inventory")) {
    await unregisterInventoryModule();
  }
  await unregisterGameModule();
  await unregisterDirectorModule();
  await unregisterWorldArchiveModule();
  await unregisterDataModule();
  await unregisterMemoryModule();
  await unregisterChatModule();
  await unregisterSaveModule();
}

// 导出所有模块的公共 API
export * from "./chat";
export * from "./checkpoint";
export * from "./data";
export * from "./director";
export * from "./game";
export * from "./inventory";
export * from "./memory";
export * from "./room";
export * from "./save";
export * from "./world-archive";
