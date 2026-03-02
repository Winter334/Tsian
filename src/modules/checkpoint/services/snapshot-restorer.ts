import * as Y from "yjs";

import type { CheckpointData } from "../../../domain/entities/checkpoint";
import {
  SNAPSHOT_SKIP,
  type FieldCodec,
  type SnapshotFieldConfig,
} from "./snapshot-config";

import { snapshotRegistry } from "./snapshot-registry";

/**
 * 将检查点快照恢复到当前 SaveSlot
 */
export function restoreSnapshot(
  saveDoc: Y.Map<unknown>,
  snapshot: CheckpointData,
  rootDoc: Y.Doc,
): void {
  rootDoc.transact(() => {
    const fields = snapshotRegistry.getAllFields();

    // 1) 清空所有已注册字段
    for (const field of fields) {
      if (field.strategy === "custom" && field.customHandler) {
        field.customHandler.clear(saveDoc);
      } else {
        clearByStrategy(saveDoc, field);
      }
    }

    // 2) 从快照重建字段
    for (const field of fields) {
      const data = snapshot[field.key];
      if (data === undefined) continue;

      if (field.strategy === "custom" && field.customHandler) {
        field.customHandler.restore(saveDoc, data);
      } else {
        rebuildByStrategy(saveDoc, field, data);
      }
    }

    // 联机快照进度（保持特殊处理）
    if (typeof snapshot.turnNumber === "number") {
      saveDoc.set("currentTurnNumber", snapshot.turnNumber);
    }

    // 3) 更新时间戳
    saveDoc.set("updatedAt", Date.now());
  });
}

function clearByStrategy(
  saveDoc: Y.Map<unknown>,
  field: SnapshotFieldConfig,
): void {
  switch (field.strategy) {
    case "plainMap":
    case "mapOfArray":
    case "nestedYMap":
    case "mapOfArrayOfYMap":
      clearYMap(getOrCreateYMap(saveDoc, field.key));
      return;
    case "memoryStructure":
      clearMemoryStructure(getOrCreateYMap(saveDoc, field.key));
      return;
    case "plainValue":
      clearPlainValue(saveDoc, field.key);
      return;
  }
}

function rebuildByStrategy(
  saveDoc: Y.Map<unknown>,
  field: SnapshotFieldConfig,
  data: unknown,
): void {
  switch (field.strategy) {
    case "plainMap":
      rebuildPlainMap(getOrCreateYMap(saveDoc, field.key), data, field);
      return;
    case "mapOfArray":
      rebuildMapOfArray(getOrCreateYMap(saveDoc, field.key), data, field);
      return;
    case "nestedYMap":
      if (!field.codec) return;
      rebuildNestedYMap(getOrCreateYMap(saveDoc, field.key), data, field.codec);
      return;
    case "mapOfArrayOfYMap":
      if (!field.codec) return;
      rebuildMapOfArrayOfYMap(
        getOrCreateYMap(saveDoc, field.key),
        data,
        field.codec,
      );
      return;
    case "memoryStructure":
      rebuildMemoryStructure(getOrCreateYMap(saveDoc, field.key), data);
      return;
    case "plainValue":
      rebuildPlainValue(saveDoc, field.key, data);
      return;
  }
}

function clearPlainValue(saveDoc: Y.Map<unknown>, key: string): void {
  const current = saveDoc.get(key);
  if (current instanceof Y.Map) {
    clearYMap(current);
    return;
  }

  if (current !== undefined) {
    saveDoc.delete(key);
  }
}

function rebuildPlainMap(
  targetMap: Y.Map<unknown>,
  data: unknown,
  field: SnapshotFieldConfig,
): void {
  if (!isRecord(data)) return;

  for (const [entryKey, rawValue] of Object.entries(data)) {
    const transformed = transformEncodeValue(field, rawValue, entryKey);
    if (transformed === SNAPSHOT_SKIP) continue;

    const targetKey =
      isRecord(transformed) && typeof transformed.id === "string"
        ? transformed.id
        : entryKey;

    targetMap.set(targetKey, transformed);
  }
}

function rebuildMapOfArray(
  targetMap: Y.Map<unknown>,
  data: unknown,
  field: SnapshotFieldConfig,
): void {
  if (!isRecord(data)) return;

  for (const [groupKey, rawEntries] of Object.entries(data)) {
    const yArray = new Y.Array<unknown>();
    const entries = Array.isArray(rawEntries) ? rawEntries : [];
    const normalizedEntries: unknown[] = [];

    for (const entry of entries) {
      const transformed = transformEncodeValue(field, entry, groupKey);
      if (transformed === SNAPSHOT_SKIP) continue;
      if (!isRecord(transformed)) continue;
      normalizedEntries.push({ ...transformed });
    }

    if (normalizedEntries.length > 0) {
      yArray.push(normalizedEntries);
    }

    targetMap.set(groupKey, yArray);
  }
}

function transformEncodeValue(
  field: SnapshotFieldConfig,
  value: unknown,
  key: string,
): unknown {
  if (field.valueTransformer?.encode) {
    return field.valueTransformer.encode(value, key);
  }
  return value;
}

function rebuildNestedYMap(
  targetMap: Y.Map<unknown>,
  data: unknown,
  codec: FieldCodec<unknown>,
): void {
  const entries = Array.isArray(data) ? data : [];

  for (const entry of entries) {
    try {
      const encoded = codec.encode(entry);
      const id = encoded.get("id");
      const resolvedId =
        typeof id === "string"
          ? id
          : isRecord(entry) && typeof entry.id === "string"
            ? entry.id
            : crypto.randomUUID();

      targetMap.set(resolvedId, encoded);
    } catch {
      // 忽略无效条目
    }
  }
}

function rebuildMapOfArrayOfYMap(
  targetMap: Y.Map<unknown>,
  data: unknown,
  codec: FieldCodec<unknown>,
): void {
  if (!isRecord(data)) return;

  for (const [groupKey, rawEntries] of Object.entries(data)) {
    const yArray = new Y.Array<Y.Map<unknown>>();
    const entries = Array.isArray(rawEntries) ? rawEntries : [];
    const encodedEntries: Y.Map<unknown>[] = [];

    for (const entry of entries) {
      try {
        encodedEntries.push(codec.encode(entry));
      } catch {
        // 忽略无效条目
      }
    }

    if (encodedEntries.length > 0) {
      yArray.push(encodedEntries);
    }

    targetMap.set(groupKey, yArray);
  }
}

function clearMemoryStructure(memoryMap: Y.Map<unknown>): void {
  clearYMap(getOrCreateYMap(memoryMap, "miniSummaries"));
  clearYMap(getOrCreateYMap(memoryMap, "megaSummaries"));
  clearYMap(getOrCreateYMap(memoryMap, "manualMemories"));
}

function rebuildMemoryStructure(
  memoryMap: Y.Map<unknown>,
  data: unknown,
): void {
  if (!isRecord(data)) return;

  const miniSummariesMap = getOrCreateYMap(memoryMap, "miniSummaries");
  const megaSummariesMap = getOrCreateYMap(memoryMap, "megaSummaries");
  const manualMemoriesMap = getOrCreateYMap(memoryMap, "manualMemories");

  rebuildGroupedPlainObjects(
    miniSummariesMap,
    isRecord(data.miniSummaries) ? data.miniSummaries : {},
  );
  rebuildGroupedPlainObjects(
    megaSummariesMap,
    isRecord(data.megaSummaries) ? data.megaSummaries : {},
  );
  rebuildGroupedPlainObjects(
    manualMemoriesMap,
    isRecord(data.manualMemories) ? data.manualMemories : {},
  );
}

function rebuildGroupedPlainObjects(
  targetMap: Y.Map<unknown>,
  groupedData: Record<string, unknown>,
): void {
  for (const [groupKey, rawEntries] of Object.entries(groupedData)) {
    const yArray = new Y.Array<Record<string, unknown>>();
    const entries = Array.isArray(rawEntries) ? rawEntries : [];
    const normalizedEntries = entries
      .filter((entry): entry is Record<string, unknown> => isRecord(entry))
      .map((entry) => ({ ...entry }));

    if (normalizedEntries.length > 0) {
      yArray.push(normalizedEntries);
    }

    targetMap.set(groupKey, yArray);
  }
}

function rebuildPlainValue(
  saveDoc: Y.Map<unknown>,
  key: string,
  data: unknown,
): void {
  if (isRecord(data)) {
    const targetMap = getOrCreateYMap(saveDoc, key);
    for (const [entryKey, entryValue] of Object.entries(data)) {
      targetMap.set(entryKey, entryValue);
    }
    return;
  }

  saveDoc.set(key, data);
}

function getOrCreateYMap(parent: Y.Map<unknown>, key: string): Y.Map<unknown> {
  const value = parent.get(key);
  if (value instanceof Y.Map) {
    return value;
  }

  const map = new Y.Map<unknown>();
  parent.set(key, map);
  return map;
}

function clearYMap(map: Y.Map<unknown>): void {
  const keys = Array.from(map.keys());
  for (const key of keys) {
    map.delete(key);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
