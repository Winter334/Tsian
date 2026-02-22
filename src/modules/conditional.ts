/**
 * 条件模块协调器
 *
 * 根据当前存档的 WorldConfig 动态注册/注销可选模块。
 */

import { eventBus, registry } from "@/core";
import { yjsManager } from "@/core/yjs";
import { SaveEvents } from "@/domain/events/save";
import { getRuntimeWorldConfig } from "@/lib/world/resolve-config";
import type { WorldConfig } from "@/lib/world/types";

import {
  registerInventoryModule,
  unregisterInventoryModule,
} from "./inventory";

/**
 * 判断是否需要 Inventory 模块。
 *
 * 条件：
 * - 配置了 inventoryRules
 * - itemTemplates 非空
 * - skillTemplates 非空
 */
export function needsInventoryModule(worldConfig: WorldConfig): boolean {
  return Boolean(
    worldConfig.inventoryRules ||
    (worldConfig.itemTemplates?.length ?? 0) > 0 ||
    (worldConfig.skillTemplates?.length ?? 0) > 0,
  );
}

/**
 * 通用的条件模块同步辅助函数。
 *
 * - needed && !registered -> register
 * - !needed && registered -> unregister
 * - 其他情况 -> no-op（幂等）
 */
export async function syncModule(
  moduleId: string,
  needed: boolean,
  register: () => Promise<void>,
  unregister: () => Promise<void>,
): Promise<void> {
  const registered = registry.hasModule(moduleId);

  if (needed && !registered) {
    await register();
    return;
  }

  if (!needed && registered) {
    await unregister();
  }
}

/**
 * 同步所有条件模块注册状态。
 */
export async function syncConditionalModules(): Promise<void> {
  const worldConfig = getRuntimeWorldConfig();

  await syncModule(
    "lyra.inventory",
    needsInventoryModule(worldConfig),
    registerInventoryModule,
    unregisterInventoryModule,
  );

  // 未来其他条件模块在此添加
}

/**
 * 初始化条件模块监听。
 *
 * 监听 SAVE_LOADED，每次存档切换后重算条件模块。
 * 返回取消监听函数。
 */
export function setupConditionalModules(): () => void {
  // 启动恢复存档场景：若已有当前存档，先执行一次同步
  if (yjsManager.getCurrentSaveId() && yjsManager.getCurrentSave()) {
    void syncConditionalModules();
  }

  return eventBus.on(SaveEvents.SAVE_LOADED, async () => {
    await syncConditionalModules();
  });
}
