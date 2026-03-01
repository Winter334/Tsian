import { getWorldArchiveRepository } from "./repository";
import { useWorldArchiveStore } from "./store";
import type { NarrativeEntity } from "./types";

/**
 * 持久化单个世界档案实体到 Yjs。
 */
export function saveArchiveEntity(entity: NarrativeEntity): void {
  try {
    const repository = getWorldArchiveRepository();
    repository.saveEntity(entity);
  } catch {
    console.warn(`[WorldArchive] 持久化实体失败（entityId=${entity.id}）`);
  }
}

/**
 * 从 Store 读取实体并持久化到 Yjs。
 */
export function saveArchiveEntityById(entityId: string): void {
  const entity = useWorldArchiveStore.getState().entities[entityId];
  if (!entity) {
    return;
  }

  saveArchiveEntity(entity);
}
