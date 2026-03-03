/**
 * World Archive Repository - 封装世界档案模块的 Yjs 持久化读写
 */

import { multiplayerProvider, subdocManager, yjsManager } from "@/core/yjs";
import * as Y from "yjs";
import type { NarrativeEntity } from "./types";

const WORLD_ARCHIVE_KEY = "worldArchive";
const ENTITIES_KEY = "entities";
const RELATIONSHIPS_KEY = "relationships";
const METADATA_KEY = "metadata";
const METADATA_VERSION_KEY = "version";
const METADATA_UPDATED_AT_KEY = "updatedAt";

type RepositoryMode = "save-slot" | "history-doc";

interface RepositorySource {
  cacheKey: string;
  mode: RepositoryMode;
  rootMap: Y.Map<unknown>;
}

/**
 * WorldArchive 仓储本地写入 origin（用于 SyncBridge 防回环识别）。
 */
export const WORLD_ARCHIVE_WRITE_ORIGIN = "lyra.world-archive.repository.write";

export class WorldArchiveRepository {
  private worldArchiveMap: Y.Map<unknown>;

  constructor(
    private readonly rootMap: Y.Map<unknown>,
    private readonly mode: RepositoryMode,
  ) {
    this.worldArchiveMap = this.ensureStructure();
  }

  /**
   * 惰性创建 worldArchive 结构
   *
   * save-slot 模式（离线）：
   * saveDoc.worldArchive
   *
   * history-doc 模式（联机）：
   * historyDoc.worldArchive
   */
  ensureStructure(): Y.Map<unknown> {
    const worldArchive = this.resolveWorldArchiveRoot();

    if (!(worldArchive.get(ENTITIES_KEY) instanceof Y.Map)) {
      worldArchive.set(ENTITIES_KEY, new Y.Map<string>());
    }

    if (!(worldArchive.get(RELATIONSHIPS_KEY) instanceof Y.Array)) {
      worldArchive.set(RELATIONSHIPS_KEY, new Y.Array<string>());
    }

    let metadata = worldArchive.get(METADATA_KEY) as Y.Map<unknown> | undefined;
    if (!(metadata instanceof Y.Map)) {
      metadata = new Y.Map<unknown>();
      worldArchive.set(METADATA_KEY, metadata);
    }

    if (!metadata.has(METADATA_VERSION_KEY)) {
      metadata.set(METADATA_VERSION_KEY, 1);
    }

    if (!metadata.has(METADATA_UPDATED_AT_KEY)) {
      metadata.set(METADATA_UPDATED_AT_KEY, Date.now());
    }

    // 离线存档历史字段保留（兼容当前本地逻辑）
    if (this.mode === "save-slot") {
      if (!metadata.has("entityCounter")) {
        metadata.set("entityCounter", 0);
      }

      if (!metadata.has("lastMaintenanceTurn")) {
        metadata.set("lastMaintenanceTurn", 0);
      }
    }

    return worldArchive;
  }

  private resolveWorldArchiveRoot(): Y.Map<unknown> {
    if (this.mode === "history-doc") {
      return this.rootMap;
    }

    let worldArchive = this.rootMap.get(WORLD_ARCHIVE_KEY) as
      | Y.Map<unknown>
      | undefined;

    if (!(worldArchive instanceof Y.Map)) {
      worldArchive = new Y.Map<unknown>();
      this.rootMap.set(WORLD_ARCHIVE_KEY, worldArchive);
    }

    return worldArchive;
  }

  private getEntitiesMap(): Y.Map<string> {
    return this.worldArchiveMap.get(ENTITIES_KEY) as Y.Map<string>;
  }

  private touchMetadataTimestamp(): void {
    const metadata = this.worldArchiveMap.get(METADATA_KEY) as
      | Y.Map<unknown>
      | undefined;

    if (metadata instanceof Y.Map) {
      metadata.set(METADATA_UPDATED_AT_KEY, Date.now());
    }
  }

  private runWriteWithOrigin(write: () => void): void {
    const doc = this.worldArchiveMap.doc;
    if (doc) {
      doc.transact(write, WORLD_ARCHIVE_WRITE_ORIGIN);
      return;
    }

    write();
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

    this.runWriteWithOrigin(() => {
      entitiesMap.set(entity.id, JSON.stringify(entity));
      this.touchMetadataTimestamp();
    });
  }

  saveAllEntities(entities: Record<string, NarrativeEntity>): void {
    const entitiesMap = this.getEntitiesMap();

    this.runWriteWithOrigin(() => {
      entitiesMap.clear();
      Object.values(entities).forEach((entity) => {
        entitiesMap.set(entity.id, JSON.stringify(entity));
      });
      this.touchMetadataTimestamp();
    });
  }

  deleteEntity(id: string): void {
    const entitiesMap = this.getEntitiesMap();
    if (!entitiesMap.has(id)) {
      return;
    }

    this.runWriteWithOrigin(() => {
      entitiesMap.delete(id);
      this.touchMetadataTimestamp();
    });
  }
}

function resolveRepositorySource(): RepositorySource {
  const saveId = yjsManager.getCurrentSaveId();

  if (!saveId) {
    throw new Error(
      "[WorldArchiveRepository] No save loaded. Please load a save first.",
    );
  }

  const onlineRoomId = multiplayerProvider.getConfig()?.roomId;
  if (onlineRoomId) {
    const worldArchiveRoot =
      subdocManager.getRoomWorldArchiveRoot(onlineRoomId);

    if (!worldArchiveRoot) {
      throw new Error(
        `[WorldArchiveRepository] HistoryDoc worldArchive root unavailable for room ${onlineRoomId}.`,
      );
    }

    return {
      cacheKey: `online:${onlineRoomId}`,
      mode: "history-doc",
      rootMap: worldArchiveRoot,
    };
  }

  const saveDoc = yjsManager.getCurrentSave();

  if (!saveDoc) {
    throw new Error("[WorldArchiveRepository] Failed to get save document.");
  }

  return {
    cacheKey: `offline:${saveId}`,
    mode: "save-slot",
    rootMap: saveDoc,
  };
}

let currentRepository: WorldArchiveRepository | null = null;
let currentRepositoryKey: string | null = null;

export function getWorldArchiveRepository(): WorldArchiveRepository {
  const source = resolveRepositorySource();

  if (source.cacheKey !== currentRepositoryKey || !currentRepository) {
    currentRepository = new WorldArchiveRepository(source.rootMap, source.mode);
    currentRepositoryKey = source.cacheKey;
  }

  return currentRepository;
}

export function resetWorldArchiveRepository(): void {
  currentRepository = null;
  currentRepositoryKey = null;
}
