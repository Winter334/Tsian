import * as Y from "yjs";

import type {
  CheckpointData,
  MemorySnapshot,
} from "../../../domain/entities/checkpoint";
import {
  SNAPSHOT_FIELDS,
  SNAPSHOT_SKIP,
  type FieldCodec,
  type SnapshotFieldConfig,
} from "./snapshot-config";

/**
 * 从当前 SaveSlot 的 Yjs 数据中提取检查点快照
 */
export function createSnapshot(saveDoc: Y.Map<unknown>): CheckpointData {
  const data: CheckpointData = {
    conversations: {},
    messages: {},
    characters: [],
    inventories: {},
    skills: {},
    memory: {
      miniSummaries: {},
      megaSummaries: {},
      manualMemories: {},
    },
    gameState: {},
  };

  for (const field of SNAPSHOT_FIELDS) {
    const yValue = saveDoc.get(field.key);
    if (yValue === undefined) continue;
    data[field.key] = extractByStrategy(yValue, field);
  }

  return {
    ...data,
    ...extractMultiplayerProgress(saveDoc),
  };
}

function extractByStrategy(
  yValue: unknown,
  field: SnapshotFieldConfig,
): unknown {
  switch (field.strategy) {
    case "plainMap":
      return extractPlainMap(yValue, field);
    case "mapOfArray":
      return extractMapOfArray(yValue, field);
    case "nestedYMap":
      return extractNestedYMap(yValue, field.codec);
    case "mapOfArrayOfYMap":
      return extractMapOfArrayOfYMap(yValue, field.codec);
    case "memoryStructure":
      return extractMemoryStructure(yValue);
    case "plainValue":
      return extractPlainValue(yValue);
  }
}

function extractPlainMap(
  yValue: unknown,
  field: SnapshotFieldConfig,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const yMap = asYMap(yValue);
  if (!yMap) return result;

  yMap.forEach((value, key) => {
    const transformed = transformDecodeValue(field, value, key);
    if (transformed === SNAPSHOT_SKIP) return;
    result[key] = transformed;
  });

  return result;
}

function extractMapOfArray(
  yValue: unknown,
  field: SnapshotFieldConfig,
): Record<string, unknown[]> {
  const result: Record<string, unknown[]> = {};
  const groupedMap = asYMap(yValue);
  if (!groupedMap) return result;

  groupedMap.forEach((groupValue, groupKey) => {
    const yArray = asYArray(groupValue);
    if (!yArray) return;

    const entries: unknown[] = [];
    for (const entry of yArray.toArray()) {
      const transformed = transformDecodeValue(field, entry, groupKey);
      if (transformed === SNAPSHOT_SKIP) continue;
      if (!isRecord(transformed)) continue;
      entries.push(transformed);
    }

    result[groupKey] = entries;
  });

  return result;
}

function extractNestedYMap(
  yValue: unknown,
  codec: FieldCodec<unknown> | undefined,
): unknown[] {
  const result: unknown[] = [];
  const yMap = asYMap(yValue);
  if (!yMap || !codec) return result;

  yMap.forEach((entry) => {
    if (!(entry instanceof Y.Map)) return;
    try {
      result.push(codec.decode(entry));
    } catch {
      // 忽略无效条目
    }
  });

  return result;
}

function extractMapOfArrayOfYMap(
  yValue: unknown,
  codec: FieldCodec<unknown> | undefined,
): Record<string, unknown[]> {
  const result: Record<string, unknown[]> = {};
  const groupedMap = asYMap(yValue);
  if (!groupedMap || !codec) return result;

  groupedMap.forEach((groupValue, groupKey) => {
    const yArray = asYArray(groupValue);
    if (!yArray) return;

    const entries: unknown[] = [];
    for (const item of yArray.toArray()) {
      if (!(item instanceof Y.Map)) continue;
      try {
        entries.push(codec.decode(item));
      } catch {
        // 忽略无效条目
      }
    }

    result[groupKey] = entries;
  });

  return result;
}

function extractMemoryStructure(yValue: unknown): MemorySnapshot {
  const emptyMemory: MemorySnapshot = {
    miniSummaries: {},
    megaSummaries: {},
    manualMemories: {},
  };

  const memoryMap = asYMap(yValue);
  if (!memoryMap) return emptyMemory;

  return {
    miniSummaries: extractGroupedArrayMap(memoryMap.get("miniSummaries")),
    megaSummaries: extractGroupedArrayMap(memoryMap.get("megaSummaries")),
    manualMemories: extractGroupedArrayMap(memoryMap.get("manualMemories")),
  };
}

function extractPlainValue(yValue: unknown): unknown {
  const yMap = asYMap(yValue);
  if (yMap) {
    const result: Record<string, unknown> = {};
    yMap.forEach((value, key) => {
      result[key] = toPlainValue(value);
    });
    return result;
  }

  return toPlainValue(yValue);
}

function transformDecodeValue(
  field: SnapshotFieldConfig,
  value: unknown,
  key: string,
): unknown {
  if (field.valueTransformer?.decode) {
    return field.valueTransformer.decode(value, key);
  }
  return toPlainValue(value);
}

function extractMultiplayerProgress(
  saveDoc: Y.Map<unknown>,
): Partial<Pick<CheckpointData, "turnNumber" | "archivedTurnCount">> {
  const progress: Partial<
    Pick<CheckpointData, "turnNumber" | "archivedTurnCount">
  > = {};

  const turnNumber = saveDoc.get("currentTurnNumber");
  if (typeof turnNumber === "number") {
    progress.turnNumber = turnNumber;
  }

  const archivedTurns = saveDoc.get("archivedTurns");
  if (archivedTurns instanceof Y.Array) {
    progress.archivedTurnCount = archivedTurns.length;
  } else if (Array.isArray(archivedTurns)) {
    progress.archivedTurnCount = archivedTurns.length;
  }

  return progress;
}

function extractGroupedArrayMap<T extends object>(
  value: unknown,
): Record<string, T[]> {
  const result: Record<string, T[]> = {};
  const groupedMap = asYMap(value);
  if (!groupedMap) return result;

  groupedMap.forEach((groupValue, groupKey) => {
    const list = asYArray(groupValue);
    if (!list) return;

    const entries: T[] = [];
    for (const entry of list.toArray()) {
      if (!isRecord(entry)) continue;
      entries.push(entry as T);
    }
    result[groupKey] = entries;
  });

  return result;
}

function toPlainValue(value: unknown): unknown {
  if (hasToJSON(value)) {
    return value.toJSON();
  }
  return value;
}

function hasToJSON(value: unknown): value is { toJSON: () => unknown } {
  if (typeof value !== "object" || value === null) return false;
  const maybeRecord = value as Record<string, unknown>;
  return typeof maybeRecord.toJSON === "function";
}

function asYMap(value: unknown): Y.Map<unknown> | undefined {
  return value instanceof Y.Map ? value : undefined;
}

function asYArray(value: unknown): Y.Array<unknown> | undefined {
  return value instanceof Y.Array ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
