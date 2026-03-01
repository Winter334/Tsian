/**
 * World Archive 模块命令定义
 */

import type { CreatedNpcData } from "../types";

export type EntityArchetype =
  | "character"
  | "event"
  | "faction"
  | "location"
  | "item_unique"
  | "quest"
  | "mystery"
  | "custom";

export type EntityPresence = "active" | "nearby" | "dormant" | "resolved";

export interface CreateWorldArchiveEntityPayload {
  archetype: EntityArchetype;
  name: string;
  essence: string;
  currentState: string;
  presence: EntityPresence;
  tags: string[];
}

export interface UpdateWorldArchiveEntityNamePayload {
  entityId: string;
  name: string;
}

export interface UpdateWorldArchiveEntityEssencePayload {
  entityId: string;
  essence: string;
}

export interface UpdateWorldArchiveEntityStatePayload {
  entityId: string;
  currentState: string;
}

export interface UpdateWorldArchiveEntityPresencePayload {
  entityId: string;
  presence: EntityPresence;
}

export interface WorldArchiveRelationshipInput {
  targetEntityId: string;
  type: string;
  description: string;
}

export interface AddWorldArchiveRelationshipPayload {
  entityId: string;
  relationship: WorldArchiveRelationshipInput;
}

export interface UpdateWorldArchiveRelationshipPayload {
  entityId: string;
  relationshipId: string;
  updates: Partial<WorldArchiveRelationshipInput>;
}

export interface RemoveWorldArchiveRelationshipPayload {
  entityId: string;
  relationshipId: string;
}

export interface UpdateWorldArchiveTagsPayload {
  entityId: string;
  tags: string[];
}

/**
 * World Archive 命令类型常量
 */
export const WorldArchiveCommands = {
  SYNC_PIPELINE_CHANGES: "worldArchive.sync_pipeline_changes",
  CREATE_ENTITY: "worldArchive.create_entity",
  UPDATE_ENTITY_NAME: "worldArchive.update_entity_name",
  UPDATE_ENTITY_ESSENCE: "worldArchive.update_entity_essence",
  UPDATE_ENTITY_STATE: "worldArchive.update_entity_state",
  UPDATE_ENTITY_PRESENCE: "worldArchive.update_entity_presence",
  ADD_RELATIONSHIP: "worldArchive.add_relationship",
  UPDATE_RELATIONSHIP: "worldArchive.update_relationship",
  REMOVE_RELATIONSHIP: "worldArchive.remove_relationship",
  UPDATE_TAGS: "worldArchive.update_tags",
} as const;

/**
 * World Archive 命令类型
 */
export type WorldArchiveCommandType =
  (typeof WorldArchiveCommands)[keyof typeof WorldArchiveCommands];

/**
 * 同步 IRNR 管线产生的世界档案变更（最小聚合命令）
 */
export interface SyncPipelineArchiveChangesPayload {
  currentTurn: number;
  createdNpcs?: CreatedNpcData[];
  /**
   * 实际内容由 world-archive 模块内按 ArchiveUpdate[] 解释。
   * 这里使用 unknown[]，避免 domain 对 modules 的反向依赖。
   */
  archiveUpdates?: unknown[];
}

/**
 * World Archive 命令 Payload 映射
 */
export interface WorldArchiveCommandPayloads {
  [WorldArchiveCommands.SYNC_PIPELINE_CHANGES]: SyncPipelineArchiveChangesPayload;
  [WorldArchiveCommands.CREATE_ENTITY]: CreateWorldArchiveEntityPayload;
  [WorldArchiveCommands.UPDATE_ENTITY_NAME]: UpdateWorldArchiveEntityNamePayload;
  [WorldArchiveCommands.UPDATE_ENTITY_ESSENCE]: UpdateWorldArchiveEntityEssencePayload;
  [WorldArchiveCommands.UPDATE_ENTITY_STATE]: UpdateWorldArchiveEntityStatePayload;
  [WorldArchiveCommands.UPDATE_ENTITY_PRESENCE]: UpdateWorldArchiveEntityPresencePayload;
  [WorldArchiveCommands.ADD_RELATIONSHIP]: AddWorldArchiveRelationshipPayload;
  [WorldArchiveCommands.UPDATE_RELATIONSHIP]: UpdateWorldArchiveRelationshipPayload;
  [WorldArchiveCommands.REMOVE_RELATIONSHIP]: RemoveWorldArchiveRelationshipPayload;
  [WorldArchiveCommands.UPDATE_TAGS]: UpdateWorldArchiveTagsPayload;
}
