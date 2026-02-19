/**
 * Chat Repository 工厂函数
 *
 * 职责：
 * 1. 根据当前存档创建 ChatRepository 实例
 * 2. 管理 Repository 实例的生命周期
 * 3. 在存档切换时重置 Repository
 */

import { yjsManager } from "@/core/yjs";
import { ChatRepository } from "./index";

/**
 * 当前 Repository 实例缓存
 */
let currentRepository: ChatRepository | null = null;
let currentSaveId: string | null = null;

/**
 * 获取 ChatRepository 实例
 *
 * 如果当前存档已切换，会自动创建新实例
 *
 * @throws {Error} 如果没有加载存档
 */
export function getChatRepository(): ChatRepository {
  const saveId = yjsManager.getCurrentSaveId();

  if (!saveId) {
    throw new Error(
      "[ChatRepository] No save loaded. Please load a save first."
    );
  }

  const saveDoc = yjsManager.getCurrentSave();

  if (!saveDoc) {
    throw new Error("[ChatRepository] Failed to get save document.");
  }

  // 如果存档切换了，重新创建 Repository
  if (saveId !== currentSaveId || !currentRepository) {
    currentRepository = new ChatRepository(saveDoc);
    currentSaveId = saveId;
  }

  return currentRepository;
}

/**
 * 重置 Repository 实例
 *
 * 用于：
 * - 存档切换时
 * - 测试清理时
 */
export function resetChatRepository(): void {
  currentRepository = null;
  currentSaveId = null;
}

/**
 * 检查是否有 Repository 实例
 */
export function hasChatRepository(): boolean {
  return currentRepository !== null;
}
