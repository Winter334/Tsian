/**
 * World Archive Zustand Store
 *
 * 管理叙事实体在前端内存中的响应式状态。
 * 持久化由 WorldArchiveRepository（Yjs）负责。
 */

import { generateSortableId } from "@/domain/types";
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

import { syncCharacterStatus } from "./presence-sync";
import type {
  ArchiveUpdate,
  EntityArchetype,
  EntityPresence,
  EntityRelationship,
  EntityRelationshipInput,
  NarrativeEntity,
} from "./types";

export interface WorldArchiveState {
  entities: Record<string, NarrativeEntity>;

  // 读取方法
  getEntity(id: string): NarrativeEntity | undefined;
  getEntitiesByArchetype(archetype: EntityArchetype): NarrativeEntity[];
  getEntitiesByPresence(presence: EntityPresence): NarrativeEntity[];
  getEntityByGameId(gameEntityId: string): NarrativeEntity | undefined;

  // 写入方法（仅由 Handler/SyncBridge 调用）
  createEntity(
    data: Omit<
      NarrativeEntity,
      "id" | "createdAt" | "updatedAt" | "relationships"
    > & {
      relationships: EntityRelationshipInput[];
    },
  ): NarrativeEntity;
  updateEntityState(id: string, newState: string): void;
  updateEntityPresence(id: string, newPresence: EntityPresence): void;
  updateEssence(id: string, newEssence: string): void;
  addRelationship(id: string, relationship: EntityRelationshipInput): void;
  updateEntityName(id: string, newName: string): void;
  updateTags(id: string, newTags: string[]): void;
  removeRelationship(id: string, relationshipId: string): void;
  updateRelationship(
    id: string,
    relationshipId: string,
    updates: Partial<Omit<EntityRelationship, "id">>,
  ): void;
  removeEntity(id: string): void;

  // 批量操作
  applyArchiveUpdates(updates: ArchiveUpdate[], currentTurn: number): void;

  // 内部方法（SyncBridge 用）
  _setEntities(entities: Record<string, NarrativeEntity>): void;
  _clear(): void;
}

function cloneRelationship(
  relationship: EntityRelationshipInput,
): EntityRelationship {
  return {
    id: relationship.id?.trim() || generateSortableId(),
    targetEntityId: relationship.targetEntityId,
    type: relationship.type,
    description: relationship.description,
  };
}

function cloneEntity(entity: NarrativeEntity): NarrativeEntity {
  return {
    ...entity,
    relationships: entity.relationships.map(cloneRelationship),
    tags: [...entity.tags],
  };
}

function findEntityByGameId(
  entities: Record<string, NarrativeEntity>,
  gameEntityId: string,
): NarrativeEntity | undefined {
  return Object.values(entities).find((entity) => {
    return entity.gameEntityId === gameEntityId;
  });
}

function resolveEntityByArchiveRef(
  entities: Record<string, NarrativeEntity>,
  ref: string,
): NarrativeEntity | undefined {
  const direct = entities[ref];
  if (direct) {
    return direct;
  }

  const byGameId = findEntityByGameId(entities, ref);
  if (byGameId) {
    return byGameId;
  }

  return Object.values(entities).find((entity) => {
    return entity.name === ref;
  });
}

export const useWorldArchiveStore = create<WorldArchiveState>()(
  immer((set, get) => ({
    entities: {},

    getEntity: (id) => get().entities[id],

    getEntitiesByArchetype: (archetype) => {
      return Object.values(get().entities).filter((entity) => {
        return entity.archetype === archetype;
      });
    },

    getEntitiesByPresence: (presence) => {
      return Object.values(get().entities).filter((entity) => {
        return entity.presence === presence;
      });
    },

    getEntityByGameId: (gameEntityId) => {
      return findEntityByGameId(get().entities, gameEntityId);
    },

    createEntity: (data) => {
      const now = Date.now();
      const entity: NarrativeEntity = {
        ...data,
        id: generateSortableId(),
        relationships: data.relationships.map(cloneRelationship),
        tags: [...data.tags],
        createdAt: now,
        updatedAt: now,
      };

      set((state) => {
        state.entities[entity.id] = entity;
      });

      return entity;
    },

    updateEntityState: (id, newState) => {
      set((state) => {
        const entity = state.entities[id];
        if (!entity || entity.currentState === newState) {
          return;
        }

        entity.currentState = newState;
        entity.updatedAt = Date.now();
      });
    },

    updateEntityPresence: (id, newPresence) => {
      set((state) => {
        const entity = state.entities[id];
        if (!entity || entity.presence === newPresence) {
          return;
        }

        if (entity.gameEntityId) {
          const synced = syncCharacterStatus(entity.gameEntityId, newPresence);
          if (!synced) {
            console.warn(
              `[WorldArchive] Presence 更新被拒绝：Character 同步失败（entityId=${id}, gameEntityId=${entity.gameEntityId}）`,
            );
            return;
          }
        }

        entity.presence = newPresence;
        entity.updatedAt = Date.now();
      });
    },

    updateEssence: (id, newEssence) => {
      set((state) => {
        const entity = state.entities[id];
        if (!entity || entity.essence === newEssence) {
          return;
        }

        entity.essence = newEssence;
        entity.updatedAt = Date.now();
      });
    },

    addRelationship: (id, relationship) => {
      set((state) => {
        const entity = state.entities[id];
        if (!entity) {
          return;
        }

        const hasDuplicateTarget = entity.relationships.some((item) => {
          return item.targetEntityId === relationship.targetEntityId;
        });
        if (hasDuplicateTarget) {
          return;
        }

        entity.relationships.push(cloneRelationship(relationship));
        entity.updatedAt = Date.now();
      });
    },

    updateEntityName: (id, newName) => {
      set((state) => {
        const entity = state.entities[id];
        if (!entity || entity.name === newName) {
          return;
        }

        entity.name = newName;
        entity.updatedAt = Date.now();
      });
    },

    updateTags: (id, newTags) => {
      set((state) => {
        const entity = state.entities[id];
        if (!entity) {
          return;
        }

        entity.tags = [...newTags];
        entity.updatedAt = Date.now();
      });
    },

    removeRelationship: (id, relationshipId) => {
      set((state) => {
        const entity = state.entities[id];
        if (!entity) {
          return;
        }

        const relationshipIndex = entity.relationships.findIndex(
          (relationship) => relationship.id === relationshipId,
        );
        if (relationshipIndex === -1) {
          return;
        }

        entity.relationships.splice(relationshipIndex, 1);
        entity.updatedAt = Date.now();
      });
    },

    updateRelationship: (id, relationshipId, updates) => {
      set((state) => {
        const entity = state.entities[id];
        if (!entity) {
          return;
        }

        const relationship = entity.relationships.find((item) => {
          return item.id === relationshipId;
        });
        if (!relationship) {
          return;
        }

        const nextTargetEntityId =
          updates.targetEntityId ?? relationship.targetEntityId;
        const hasDuplicateTarget = entity.relationships.some((item) => {
          return (
            item.id !== relationshipId &&
            item.targetEntityId === nextTargetEntityId
          );
        });
        if (hasDuplicateTarget) {
          return;
        }

        Object.assign(relationship, updates);
        entity.updatedAt = Date.now();
      });
    },

    removeEntity: (id) => {
      set((state) => {
        if (!state.entities[id]) {
          return;
        }

        delete state.entities[id];
      });
    },

    applyArchiveUpdates: (updates, currentTurn) => {
      set((state) => {
        if (updates.length === 0) {
          return;
        }

        const resolveEntity = (ref: string): NarrativeEntity | undefined => {
          return resolveEntityByArchiveRef(state.entities, ref);
        };

        updates.forEach((update) => {
          switch (update.type) {
            case "create_entity": {
              if (update.gameEntityId) {
                const existed = findEntityByGameId(
                  state.entities,
                  update.gameEntityId,
                );
                if (existed) {
                  break;
                }
              }

              const now = Date.now();
              const created: NarrativeEntity = {
                id: generateSortableId(),
                archetype: update.archetype,
                name: update.name,
                essence: update.essence,
                currentState: update.initialState,
                presence: "active",
                introducedAtTurn: currentTurn,
                lastActiveTurn: currentTurn,
                gameEntityId: update.gameEntityId,
                relationships: [],
                tags: update.tags ? [...update.tags] : [],
                createdAt: now,
                updatedAt: now,
              };

              state.entities[created.id] = created;
              break;
            }

            case "update_state": {
              const entity = resolveEntity(update.entityId);
              if (!entity || entity.currentState === update.newState) {
                break;
              }

              entity.currentState = update.newState;
              entity.lastActiveTurn = currentTurn;
              entity.updatedAt = Date.now();
              break;
            }

            case "update_essence": {
              const entity = resolveEntity(update.entityId);
              if (!entity || entity.essence === update.newEssence) {
                break;
              }

              entity.essence = update.newEssence;
              entity.updatedAt = Date.now();
              break;
            }

            case "update_presence": {
              const entity = resolveEntity(update.entityId);
              if (!entity || entity.presence === update.newPresence) {
                break;
              }

              if (entity.gameEntityId) {
                const synced = syncCharacterStatus(
                  entity.gameEntityId,
                  update.newPresence,
                );
                if (!synced) {
                  console.warn(
                    `[WorldArchive] Presence 更新被拒绝：Character 同步失败（entityRef=${update.entityId}, gameEntityId=${entity.gameEntityId}）`,
                  );
                  break;
                }
              }

              entity.presence = update.newPresence;
              entity.lastActiveTurn = currentTurn;
              entity.updatedAt = Date.now();
              break;
            }

            case "add_relationship": {
              const entity = resolveEntity(update.entityId);
              if (!entity) {
                break;
              }

              const targetEntity = resolveEntity(
                update.relationship.targetEntityId,
              );
              if (!targetEntity) {
                break;
              }

              const nextRelationship = cloneRelationship({
                ...update.relationship,
                targetEntityId: targetEntity.id,
              });
              const hasDuplicateTarget = entity.relationships.some((item) => {
                return item.targetEntityId === nextRelationship.targetEntityId;
              });
              if (hasDuplicateTarget) {
                break;
              }

              entity.relationships.push(nextRelationship);
              entity.lastActiveTurn = currentTurn;
              entity.updatedAt = Date.now();
              break;
            }
          }
        });
      });
    },

    _setEntities: (entities) => {
      const next: Record<string, NarrativeEntity> = {};

      Object.entries(entities).forEach(([id, entity]) => {
        next[id] = cloneEntity(entity);
      });

      set((state) => {
        state.entities = next;
      });
    },

    _clear: () => {
      set((state) => {
        state.entities = {};
      });
    },
  })),
);
