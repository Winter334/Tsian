import * as Y from "yjs";

import {
  DEFAULT_WORLD_NARRATIVE_RUNTIME_SNAPSHOT,
  type WorldNarrativeRuntimeSnapshot,
} from "./types";

const WORLD_NARRATIVE_SNAPSHOT_VERSION = 1;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function isWorldNarrativeRuntimeSnapshot(
  value: unknown,
): value is WorldNarrativeRuntimeSnapshot {
  if (!isRecord(value)) {
    return false;
  }

  const version = value.version;
  if (version !== WORLD_NARRATIVE_SNAPSHOT_VERSION) {
    return false;
  }

  const script = value.script;
  if (script !== undefined && typeof script !== "string") {
    return false;
  }

  const opening = value.opening;
  if (opening !== undefined && typeof opening !== "string") {
    return false;
  }

  const openingInjected = value.openingInjected;
  if (openingInjected !== undefined && typeof openingInjected !== "boolean") {
    return false;
  }

  return true;
}

export function normalizeWorldNarrativeRuntimeSnapshot(
  snapshot?: Partial<WorldNarrativeRuntimeSnapshot> | null,
): WorldNarrativeRuntimeSnapshot {
  return {
    version: WORLD_NARRATIVE_SNAPSHOT_VERSION,
    script: normalizeOptionalString(snapshot?.script),
    opening: normalizeOptionalString(snapshot?.opening),
    openingInjected: snapshot?.openingInjected ?? false,
  };
}

export function worldNarrativeToYMap(
  snapshot?: Partial<WorldNarrativeRuntimeSnapshot> | null,
): Y.Map<unknown> {
  const normalized = normalizeWorldNarrativeRuntimeSnapshot(snapshot);
  const map = new Y.Map<unknown>();
  map.set("version", WORLD_NARRATIVE_SNAPSHOT_VERSION);
  map.set("data", JSON.stringify(normalized));
  return map;
}

export function worldNarrativeFromYMap(
  map: Y.Map<unknown>,
): WorldNarrativeRuntimeSnapshot | null {
  const version = map.get("version");
  const data = map.get("data");

  if (version !== WORLD_NARRATIVE_SNAPSHOT_VERSION) {
    return null;
  }

  if (typeof data !== "string") {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(data);
    if (!isWorldNarrativeRuntimeSnapshot(parsed)) {
      return null;
    }

    return normalizeWorldNarrativeRuntimeSnapshot(parsed);
  } catch {
    return null;
  }
}

export function getDefaultWorldNarrativeRuntimeSnapshot(): WorldNarrativeRuntimeSnapshot {
  return {
    ...DEFAULT_WORLD_NARRATIVE_RUNTIME_SNAPSHOT,
  };
}
