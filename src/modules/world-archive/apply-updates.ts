import { getWorldArchiveRepository } from "./repository";
import { useWorldArchiveStore } from "./store";
import type { ArchiveUpdate } from "./types";

/**
 * 应用导演 AI 输出的档案更新到世界档案
 *
 * 在管线执行完成后调用。
 * 1. 调用 Store 的 applyArchiveUpdates 更新内存状态
 *    - update_presence 会在 Store 内原子同步 Character.status
 * 2. 将更新后的实体写入 Yjs 持久化
 */
export function applyArchiveUpdatesAndSync(
  updates: ArchiveUpdate[],
  currentTurn: number,
): void {
  if (updates.length === 0) {
    return;
  }

  const store = useWorldArchiveStore.getState();

  // 1. 应用到 Store（包含 presence ↔ character.status 原子同步）
  store.applyArchiveUpdates(updates, currentTurn);

  // 2. 持久化到 Yjs
  try {
    const repo = getWorldArchiveRepository();
    repo.saveAllEntities(store.entities);
  } catch {
    console.warn("[WorldArchive] 持久化世界档案失败");
  }
}
