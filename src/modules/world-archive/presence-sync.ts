import * as Y from "yjs";

import { yjsManager } from "@/core/yjs";
import type { CharacterStatus } from "@/domain/entities/character";

import type { EntityPresence } from "./types";

function isCharacterStatus(value: unknown): value is CharacterStatus {
  return (
    value === "active" ||
    value === "off_scene" ||
    value === "archived" ||
    value === "dead"
  );
}

/**
 * Presence → Character.status 的映射
 */
function presenceToCharacterStatus(
  presence: EntityPresence,
  currentStatus?: CharacterStatus,
): CharacterStatus {
  switch (presence) {
    case "active":
      return "active";
    case "nearby":
      return "off_scene";
    case "dormant":
      return currentStatus === "archived" || currentStatus === "dead"
        ? "archived"
        : "off_scene";
    case "resolved":
      return currentStatus === "dead" ? "dead" : "archived";
  }
}

/**
 * 同步更新 Character 的 status
 *
 * 当 NarrativeEntity 的 presence 变更时调用。
 * 通过 gameEntityId 找到对应的 Character 并更新其 status。
 *
 * @returns true 表示同步成功；false 表示同步失败（调用方应拒绝 Presence 更新）。
 */
export function syncCharacterStatus(
  gameEntityId: string,
  newPresence: EntityPresence,
): boolean {
  try {
    const saveDoc = yjsManager.getCurrentSave();
    if (!saveDoc) {
      return false;
    }

    const rawCharacters = saveDoc.get("characters");
    if (!(rawCharacters instanceof Y.Map)) {
      return false;
    }

    const charactersMap = rawCharacters as Y.Map<Y.Map<unknown>>;
    const charMap = charactersMap.get(gameEntityId);
    if (!(charMap instanceof Y.Map)) {
      return false;
    }

    const rawStatus = charMap.get("status");
    const currentStatus = isCharacterStatus(rawStatus) ? rawStatus : undefined;
    const newStatus = presenceToCharacterStatus(newPresence, currentStatus);
    const now = Date.now();
    const doc = charMap.doc;

    if (doc) {
      doc.transact(() => {
        charMap.set("status", newStatus);
        charMap.set("updatedAt", now);
      });
      return true;
    }

    charMap.set("status", newStatus);
    charMap.set("updatedAt", now);
    return true;
  } catch {
    // 静默失败：存档可能未加载或角色不存在
    console.warn(`[PresenceSync] 无法同步 Character ${gameEntityId} 的 status`);
    return false;
  }
}
