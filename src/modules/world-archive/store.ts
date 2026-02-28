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
    data: Omit<NarrativeEntity, "id" | "createdAt" | "updatedAt">,
  ): NarrativeEntity;
  updateEntityState(id: string, newState: string): void;
  updateEntityPresence(id: string, newPresence: EntityPresence): void;
  updateEssence(id: string, newEssence: string): void;
  addRelationship(id: string, relationship: EntityRelationship): void;
  updateEntityName(id: string, newName: string): void;
  updateTags(id: string, newTags: string[]): void;
  removeRelationship(id: string, targetEntityId: string): void;
  updateRelationship(
    id: string,
    targetEntityId: string,
    updates: Partial<EntityRelationship>,
  ): void;
  removeEntity(id: string): void;

  // 批量操作
  applyArchiveUpdates(updates: ArchiveUpdate[], currentTurn: number): void;

  // 内部方法（SyncBridge 用）
  _setEntities(entities: Record<string, NarrativeEntity>): void;
  _clear(): void;
}

function cloneRelationship(
  relationship: EntityRelationship,
): EntityRelationship {
  return {
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

    removeRelationship: (id, targetEntityId) => {
      set((state) => {
        const entity = state.entities[id];
        if (!entity) {
          return;
        }

        const relationshipIndex = entity.relationships.findIndex(
          (relationship) => relationship.targetEntityId === targetEntityId,
        );
        if (relationshipIndex === -1) {
          return;
        }

        entity.relationships.splice(relationshipIndex, 1);
        entity.updatedAt = Date.now();
      });
    },

    updateRelationship: (id, targetEntityId, updates) => {
      set((state) => {
        const entity = state.entities[id];
        if (!entity) {
          return;
        }

        const relationship = entity.relationships.find((item) => {
          return item.targetEntityId === targetEntityId;
        });
        if (!relationship) {
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
              const entity = state.entities[update.entityId];
              if (!entity || entity.currentState === update.newState) {
                break;
              }

              entity.currentState = update.newState;
              entity.lastActiveTurn = currentTurn;
              entity.updatedAt = Date.now();
              break;
            }

            case "update_essence": {
              const entity = state.entities[update.entityId];
              if (!entity || entity.essence === update.newEssence) {
                break;
              }

              entity.essence = update.newEssence;
              entity.updatedAt = Date.now();
              break;
            }

            case "update_presence": {
              const entity = state.entities[update.entityId];
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
                    `[WorldArchive] Presence 更新被拒绝：Character 同步失败（entityId=${update.entityId}, gameEntityId=${entity.gameEntityId}）`,
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
              const entity = state.entities[update.entityId];
              if (!entity) {
                break;
              }

              entity.relationships.push(cloneRelationship(update.relationship));
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
