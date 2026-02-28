/**
 * World Archive 模块类型定义
 */

// === 实体类别 ===
export type EntityArchetype =
  | "character"
  | "event"
  | "faction"
  | "location"
  | "item_unique"
  | "quest"
  | "mystery"
  | "custom";

// === 存在状态 ===
export type EntityPresence = "active" | "nearby" | "dormant" | "resolved";

// === 关系 ===
export interface EntityRelationship {
  targetEntityId: string;
  type: string;
  description: string;
}

// === 叙事实体（核心） ===
export interface NarrativeEntity {
  id: string;
  archetype: EntityArchetype;
  name: string;
  essence: string;
  currentState: string;
  presence: EntityPresence;
  introducedAtTurn: number;
  lastActiveTurn: number;
  gameEntityId?: string;
  relationships: EntityRelationship[];
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

// === 档案更新指令（导演 AI 输出） ===
export type ArchiveUpdate =
  | {
      type: "create_entity";
      archetype: EntityArchetype;
      name: string;
      essence: string;
      initialState: string;
      gameEntityId?: string;
      tags?: string[];
    }
  | { type: "update_state"; entityId: string; newState: string }
  | { type: "update_essence"; entityId: string; newEssence: string }
  | { type: "update_presence"; entityId: string; newPresence: EntityPresence }
  | {
      type: "add_relationship";
      entityId: string;
      relationship: EntityRelationship;
    };

// === 档案快照（注入到黑板） ===
export interface ArchiveSnapshot {
  active: NarrativeEntity[];
  nearby: NarrativeEntity[];
  dormant: NarrativeEntity[];
}
