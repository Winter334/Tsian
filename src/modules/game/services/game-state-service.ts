/**
 * GameStateService
 *
 * 提供跨模块可用的游戏状态访问能力，
 * 避免 inventory 等模块直接依赖 game 内部实现。
 */

import { services } from "@/core";
import {
  INVENTORY_QUERY_SERVICE_TOKEN,
  type GameStateServiceContract,
} from "@/core/services/tokens";
import { subdocManager, yjsManager } from "@/core/yjs";
import type { EntityAccessor } from "@/domain/types";
import { getRuntimeWorldConfig } from "@/lib/world";
import {
  characterToEntityData,
  createGameStateRepository,
  type GameStateRepository,
} from "@/modules/game/repository";
import { useSessionStore } from "@/stores";
import * as Y from "yjs";
import {
  applyEquipmentEffectsToEntity,
  applyTalentsToEntity,
  MapEntityAccessor,
} from "./entity-accessor";

function getActiveGameStateRepository(): GameStateRepository | null {
  const roomId = useSessionStore.getState().roomId;

  if (roomId) {
    const mainDoc = subdocManager.getMainDoc(roomId);
    if (!mainDoc) {
      console.warn(
        `[GameStateService] 联机房间 ${roomId} 的 MainDoc 未加载，无法访问权威角色树`,
      );
      return null;
    }

    const characters = mainDoc.getMap("characters") as Y.Map<Y.Map<unknown>>;
    return createGameStateRepository(characters, mainDoc);
  }

  const currentSave = yjsManager.getCurrentSave();
  if (!currentSave) {
    console.warn("[GameStateService] 当前没有已加载存档");
    return null;
  }

  let rootDoc: Y.Doc;
  try {
    rootDoc = yjsManager.getDoc();
  } catch (error) {
    console.warn("[GameStateService] 无法获取 Yjs 根文档", error);
    return null;
  }

  const characters = currentSave.get("characters");
  if (!(characters instanceof Y.Map)) {
    console.warn("[GameStateService] 当前存档缺少 characters map");
    return null;
  }

  return createGameStateRepository(
    characters as Y.Map<Y.Map<unknown>>,
    rootDoc,
  );
}

function buildEntityAccessorFromStores(
  repo: GameStateRepository,
): EntityAccessor {
  const accessor = new MapEntityAccessor();
  const worldConfig = getRuntimeWorldConfig();
  const inventoryQuery = services.getRequired(INVENTORY_QUERY_SERVICE_TOKEN);

  for (const character of repo.getCharacters()) {
    const entity = characterToEntityData(character);

    const talentIds =
      character.talentIds?.filter(
        (talentId): talentId is string => typeof talentId === "string",
      ) ?? [];
    if (talentIds.length > 0) {
      applyTalentsToEntity(entity, talentIds, worldConfig);
    }

    const equippedItems = inventoryQuery.getEquippedItems(character.id);
    if (equippedItems.length > 0) {
      applyEquipmentEffectsToEntity(entity, equippedItems);
    }

    accessor.setEntity(entity);
  }

  return accessor;
}

export function createGameStateService(): GameStateServiceContract {
  return {
    getCharacter(characterId) {
      const repo = getActiveGameStateRepository();
      return repo?.getCharacter(characterId);
    },

    getCharacters() {
      const repo = getActiveGameStateRepository();
      return repo?.getCharacters() ?? [];
    },

    updateAttribute(characterId, field, value) {
      const repo = getActiveGameStateRepository();
      repo?.updateAttribute(characterId, field, value);
    },

    addTag(characterId, tagId, metadata) {
      const repo = getActiveGameStateRepository();
      repo?.addTag(characterId, tagId, metadata);
    },

    removeTag(characterId, tagId) {
      const repo = getActiveGameStateRepository();
      repo?.removeTag(characterId, tagId);
    },

    buildEntityAccessor() {
      const repo = getActiveGameStateRepository();
      if (!repo) return new MapEntityAccessor();
      return buildEntityAccessorFromStores(repo);
    },
  };
}

export type { GameStateServiceContract } from "@/core/services/tokens";

export const gameStateService: GameStateServiceContract =
  createGameStateService();
