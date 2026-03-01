/**
 * World Archive Repository - 封装世界档案模块的 Yjs 持久化读写
 */

import { yjsManager } from "@/core/yjs";
import * as Y from "yjs";
import type { NarrativeEntity } from "./types";

const WORLD_ARCHIVE_KEY = "worldArchive";
const ENTITIES_KEY = "entities";
const METADATA_KEY = "metadata";

export class WorldArchiveRepository {
  private worldArchiveMap: Y.Map<unknown>;

  constructor(private saveDoc: Y.Map<unknown>) {
    this.worldArchiveMap = this.ensureStructure();
  }

  /**
   * 惰性创建 worldArchive 结构
   *
   * worldArchive (Y.Map)
   *   ├── entities (Y.Map<string, string>)
   *   └── metadata (Y.Map)
   *       ├── entityCounter (number)
   *       └── lastMaintenanceTurn (number)
   */
  ensureStructure(): Y.Map<unknown> {
    let worldArchive = this.saveDoc.get(WORLD_ARCHIVE_KEY) as
      | Y.Map<unknown>
      | undefined;

    if (!worldArchive) {
      worldArchive = new Y.Map<unknown>();
      this.saveDoc.set(WORLD_ARCHIVE_KEY, worldArchive);
    }

    if (!worldArchive.has(ENTITIES_KEY)) {
      worldArchive.set(ENTITIES_KEY, new Y.Map<string>());
    }

    let metadata = worldArchive.get(METADATA_KEY) as Y.Map<unknown> | undefined;
    if (!metadata) {
      metadata = new Y.Map<unknown>();
      worldArchive.set(METADATA_KEY, metadata);
    }

    if (!metadata.has("entityCounter")) {
      metadata.set("entityCounter", 0);
    }

    if (!metadata.has("lastMaintenanceTurn")) {
      metadata.set("lastMaintenanceTurn", 0);
    }

    return worldArchive;
  }

  private getEntitiesMap(): Y.Map<string> {
    return this.worldArchiveMap.get(ENTITIES_KEY) as Y.Map<string>;
  }

  getAllEntities(): Record<string, NarrativeEntity> {
    const entitiesMap = this.getEntitiesMap();
    const entities: Record<string, NarrativeEntity> = {};

    entitiesMap.forEach((rawValue, entityId) => {
      try {
        const parsed = JSON.parse(rawValue) as NarrativeEntity;
        entities[entityId] = parsed;
      } catch {
        // 忽略损坏数据，保持读取过程健壮
      }
    });

    return entities;
  }

  observeEntities(observer: (event: Y.YMapEvent<string>) => void): () => void {
    const entitiesMap = this.getEntitiesMap();
    entitiesMap.observe(observer);

    return () => {
      entitiesMap.unobserve(observer);
    };
  }

  saveEntity(entity: NarrativeEntity): void {
    const entitiesMap = this.getEntitiesMap();
    entitiesMap.set(entity.id, JSON.stringify(entity));
  }

  saveAllEntities(entities: Record<string, NarrativeEntity>): void {
    const entitiesMap = this.getEntitiesMap();

    const doc = entitiesMap.doc;
    const runWrite = () => {
      entitiesMap.clear();
      Object.values(entities).forEach((entity) => {
        entitiesMap.set(entity.id, JSON.stringify(entity));
      });
    };

    if (doc) {
      doc.transact(runWrite);
      return;
    }

    runWrite();
  }

  deleteEntity(id: string): void {
    const entitiesMap = this.getEntitiesMap();
    entitiesMap.delete(id);
  }
}

let currentRepository: WorldArchiveRepository | null = null;
let currentSaveId: string | null = null;

export function getWorldArchiveRepository(): WorldArchiveRepository {
  const saveId = yjsManager.getCurrentSaveId();

  if (!saveId) {
    throw new Error(
      "[WorldArchiveRepository] No save loaded. Please load a save first.",
    );
  }

  const saveDoc = yjsManager.getCurrentSave();

  if (!saveDoc) {
    throw new Error("[WorldArchiveRepository] Failed to get save document.");
  }

  if (saveId !== currentSaveId || !currentRepository) {
    currentRepository = new WorldArchiveRepository(saveDoc);
    currentSaveId = saveId;
  }

  return currentRepository;
}

export function resetWorldArchiveRepository(): void {
  currentRepository = null;
  currentSaveId = null;
}
