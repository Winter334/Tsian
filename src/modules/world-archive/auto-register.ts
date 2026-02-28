import type { CreatedNpcData } from "@/domain/types";

import { getWorldArchiveRepository } from "./repository";
import { useWorldArchiveStore } from "./store";
import type { NarrativeEntity } from "./types";

/**
 * NPC 创建后自动建档
 *
 * 由管线后处理流程在处理 createdNpcs 时调用。
 * 从 CreatedNpcData 提取信息构建初始 NarrativeEntity。
 * 如果 gameEntityId 已存在则更新已有实体（避免重复建档）。
 */
export function autoRegisterNpcs(
  createdNpcs: CreatedNpcData[],
  currentTurn: number,
): void {
  const store = useWorldArchiveStore.getState();
  const changedEntities: NarrativeEntity[] = [];

  for (const npc of createdNpcs) {
    const existing = store.getEntityByGameId(npc.id);
    if (existing) {
      const refreshedEntity = refreshExistingEntity(existing, npc, currentTurn);
      if (refreshedEntity) {
        changedEntities.push(refreshedEntity);
      }
      continue;
    }

    const essence = buildInitialEssence(npc);
    const nextEntity: Omit<NarrativeEntity, "id" | "createdAt" | "updatedAt"> =
      {
        archetype: "character",
        name: npc.name,
        essence,
        currentState: "刚刚登场。",
        presence: "active",
        introducedAtTurn: currentTurn,
        lastActiveTurn: currentTurn,
        gameEntityId: npc.id,
        relationships: [],
        tags: [],
      };

    const createdEntity = store.createEntity(nextEntity);
    changedEntities.push(createdEntity);
  }

  if (changedEntities.length > 0) {
    try {
      const repository = getWorldArchiveRepository();
      changedEntities.forEach((entity) => {
        repository.saveEntity(entity);
      });
    } catch {
      console.warn("[WorldArchive] 自动建档持久化失败");
    }
  }
}

function refreshExistingEntity(
  entity: NarrativeEntity,
  npc: CreatedNpcData,
  currentTurn: number,
): NarrativeEntity | null {
  const nextEssence = mergeEssence(entity.essence, buildInitialEssence(npc));
  const shouldActivate =
    entity.presence === "dormant" || entity.presence === "nearby";
  const now = Date.now();

  const needUpdate =
    entity.lastActiveTurn !== currentTurn ||
    shouldActivate ||
    nextEssence !== entity.essence;

  if (!needUpdate) {
    return null;
  }

  const nextEntity: NarrativeEntity = {
    ...entity,
    name: entity.name || npc.name,
    essence: nextEssence,
    presence: shouldActivate ? "active" : entity.presence,
    lastActiveTurn: currentTurn,
    updatedAt: now,
  };

  useWorldArchiveStore.setState((state) => ({
    entities: {
      ...state.entities,
      [entity.id]: nextEntity,
    },
  }));

  return nextEntity;
}

function mergeEssence(
  existingEssence: string,
  incomingEssence: string,
): string {
  const normalizedExisting = existingEssence.trim();
  const normalizedIncoming = incomingEssence.trim();

  if (!normalizedIncoming) {
    return existingEssence;
  }

  if (!normalizedExisting) {
    return incomingEssence;
  }

  if (normalizedExisting.length >= normalizedIncoming.length) {
    return existingEssence;
  }

  return incomingEssence;
}

function buildInitialEssence(npc: CreatedNpcData): string {
  const parts: string[] = [];

  if (npc.description) {
    parts.push(npc.description);
  }
  if (npc.personality) {
    parts.push(`性格：${npc.personality}`);
  }
  if (npc.appearance) {
    parts.push(`外貌：${npc.appearance}`);
  }
  if (npc.age !== undefined) {
    parts.push(`年龄：${npc.age}`);
  }
  if (npc.gender) {
    parts.push(`性别：${npc.gender}`);
  }

  return parts.join("。") || npc.name;
}
