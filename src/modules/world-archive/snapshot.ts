import type {
  CustomSnapshotHandler,
  SnapshotFieldConfig,
} from "@/modules/checkpoint/snapshot-api";
import * as Y from "yjs";
import type { NarrativeEntity } from "./types";

const WORLD_ARCHIVE_KEY = "worldArchive";
const ENTITIES_KEY = "entities";
const METADATA_KEY = "metadata";

interface WorldArchiveSnapshotData {
  entities: Record<string, NarrativeEntity>;
}

/**
 * World Archive 的自定义快照处理器。
 *
 * worldArchive.entities 的数据结构是 Y.Map<string, string>，
 * value 为 JSON.stringify(NarrativeEntity)，不适配内置策略，
 * 因此使用 custom 策略处理提取/清空/恢复。
 */
export const worldArchiveSnapshotHandler: CustomSnapshotHandler = {
  extract(saveDoc) {
    const entitiesMap = getExistingEntitiesMap(saveDoc);
    if (!entitiesMap) {
      return null;
    }

    const entities: Record<string, NarrativeEntity> = {};

    entitiesMap.forEach((rawValue, entityId) => {
      if (typeof rawValue !== "string") {
        return;
      }

      try {
        entities[entityId] = JSON.parse(rawValue) as NarrativeEntity;
      } catch {
        console.warn(
          `[WorldArchiveSnapshot] 跳过损坏实体（entityId=${entityId}）。`,
        );
      }
    });

    return { entities };
  },

  clear(saveDoc) {
    const entitiesMap = ensureEntitiesMap(saveDoc);
    entitiesMap.clear();
  },

  restore(saveDoc, data) {
    const snapshotData = toSnapshotData(data);
    if (!snapshotData) {
      return;
    }

    const entitiesMap = ensureEntitiesMap(saveDoc);
    entitiesMap.clear();

    Object.entries(snapshotData.entities).forEach(([entityId, entity]) => {
      entitiesMap.set(entityId, JSON.stringify(entity));
    });
  },
};

export const worldArchiveSnapshotFields: SnapshotFieldConfig[] = [
  {
    key: WORLD_ARCHIVE_KEY,
    strategy: "custom",
    customHandler: worldArchiveSnapshotHandler,
  },
];

function getExistingEntitiesMap(saveDoc: Y.Map<unknown>): Y.Map<string> | null {
  const worldArchiveValue = saveDoc.get(WORLD_ARCHIVE_KEY);
  if (!(worldArchiveValue instanceof Y.Map)) {
    return null;
  }

  const entitiesValue = worldArchiveValue.get(ENTITIES_KEY);
  if (!(entitiesValue instanceof Y.Map)) {
    return null;
  }

  return entitiesValue as Y.Map<string>;
}

function ensureEntitiesMap(saveDoc: Y.Map<unknown>): Y.Map<string> {
  const worldArchiveMap = ensureWorldArchiveMap(saveDoc);

  const entitiesValue = worldArchiveMap.get(ENTITIES_KEY);
  if (entitiesValue instanceof Y.Map) {
    return entitiesValue as Y.Map<string>;
  }

  const entitiesMap = new Y.Map<string>();
  worldArchiveMap.set(ENTITIES_KEY, entitiesMap);
  return entitiesMap;
}

function ensureWorldArchiveMap(saveDoc: Y.Map<unknown>): Y.Map<unknown> {
  const worldArchiveValue = saveDoc.get(WORLD_ARCHIVE_KEY);
  const worldArchiveMap =
    worldArchiveValue instanceof Y.Map
      ? (worldArchiveValue as Y.Map<unknown>)
      : new Y.Map<unknown>();

  if (!(worldArchiveValue instanceof Y.Map)) {
    saveDoc.set(WORLD_ARCHIVE_KEY, worldArchiveMap);
  }

  ensureMetadataMap(worldArchiveMap);
  return worldArchiveMap;
}

function ensureMetadataMap(worldArchiveMap: Y.Map<unknown>): void {
  const metadataValue = worldArchiveMap.get(METADATA_KEY);
  if (metadataValue instanceof Y.Map) {
    return;
  }

  worldArchiveMap.set(METADATA_KEY, new Y.Map<unknown>());
}

function toSnapshotData(data: unknown): WorldArchiveSnapshotData | null {
  if (!isRecord(data)) {
    return null;
  }

  const rawEntities = data.entities;
  if (!isRecord(rawEntities)) {
    return null;
  }

  const entities: Record<string, NarrativeEntity> = {};

  Object.entries(rawEntities).forEach(([entityId, value]) => {
    if (!isRecord(value)) {
      return;
    }

    entities[entityId] = value as unknown as NarrativeEntity;
  });

  return { entities };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
