/**
 * 检查点实体定义
 *
 * 检查点用于保存某一时刻的完整游戏快照，
 * 支持后续回溯恢复。
 */

import type { ExportCharacterData } from "../../core/yjs/types";
import type { Conversation } from "./conversation";
import type { ItemInstance } from "./item";
import type { ManualMemory, MegaSummary, MiniSummary } from "./memory";
import type { Message } from "./message";
import type { SkillInstance } from "./skill";

/**
 * 检查点来源
 */
export type CheckpointSource = "auto" | "manual";

/**
 * 会话快照
 */
export type ConversationSnapshot = Pick<
  Conversation,
  | "id"
  | "title"
  | "characterIds"
  | "systemPrompt"
  | "settings"
  | "metadata"
  | "createdAt"
  | "updatedAt"
>;
/**
 * 消息快照
 */
export type MessageSnapshot = Pick<
  Message,
  | "id"
  | "role"
  | "content"
  | "status"
  | "conversationId"
  | "characterId"
  | "error"
  | "metadata"
  | "createdAt"
  | "updatedAt"
>;
/**
 * 角色快照（复用导出角色结构）
 */
export type CharacterSnapshot = ExportCharacterData;

/**
 * 物品快照（复用物品实例结构）
 */
export type ItemSnapshot = ItemInstance;

/**
 * 技能快照（复用技能实例结构）
 */
export type SkillSnapshot = SkillInstance;

/**
 * 记忆快照
 *
 * key 为 conversationId
 */
export interface MemorySnapshot {
  miniSummaries: Record<string, MiniSummary[]>;
  megaSummaries: Record<string, MegaSummary[]>;
  manualMemories: Record<string, ManualMemory[]>;
}

/**
 * 检查点快照数据（不含元数据）
 *
 * 用于 snapshot-creator 返回值。
 */
export interface CheckpointData {
  conversations: Record<string, ConversationSnapshot>;
  messages: Record<string, MessageSnapshot[]>;
  characters: CharacterSnapshot[];
  inventories: Record<string, ItemSnapshot[]>;
  skills: Record<string, SkillSnapshot[]>;
  memory: MemorySnapshot;
  gameState: Record<string, unknown>;

  /** 当前回合号（联机模式） */
  turnNumber?: number;
  /** 归档回合数量（联机模式） */
  archivedTurnCount?: number;

  /** 支持配置驱动的动态扩展字段 */
  [key: string]: unknown;
}

/**
 * 检查点实体
 */
export interface Checkpoint extends CheckpointData {
  id: string;
  createdAt: number;
  label: string;
  source: CheckpointSource;
}
