/**
 * Yjs 相关类型定义
 */

import type { CharacterStatus } from "@/domain/entities/character";
import type * as Y from "yjs";

/**
 * 游戏根文档结构
 */
export interface GameDocument {
  /** 数据格式版本号 */
  version: number;
  /** 存档槽位 */
  saves: Y.Map<SaveSlot>;
  /** 用户设置 */
  settings: Y.Map<unknown>;
  /** 资源引用（图片等） */
  assets: Y.Map<AssetRef>;
}

/**
 * 单个存档槽位
 */
export interface SaveSlot {
  /** 存档 ID */
  id: string;
  /** 存档名称 */
  name: string;
  /** 创建时间 */
  createdAt: number;
  /** 更新时间 */
  updatedAt: number;
  /** 会话列表 */
  conversations: Y.Map<unknown>;
  /** 消息列表（按会话 ID 索引） */
  messages: Y.Map<Y.Array<unknown>>;
  /** 游戏状态（角色、背包等，后续扩展） */
  gameState: Y.Map<unknown>;

  // === 联机游戏进度（Phase 1 新增） ===
  /** 当前回合号（0 = 未开始） */
  currentTurnNumber?: number;
  /** 归档的回合数据（用于回放/调试） */
  archivedTurns?: Y.Array<ArchivedTurn>;

  // === 角色系统（Phase 2 新增） ===
  /**
   * 角色列表
   *
   * 存储结构：Y.Map<Y.Map<unknown>>（key = characterId）
   * 每个角色以 Y.Map 形式存储，与联机模式统一。
   * 用于本地持久化和续玩时的角色恢复。
   */
  characters?: Y.Map<Y.Map<unknown>>;
}

/**
 * 归档的回合数据
 * 用于未来回放功能、调试、历史查看
 */
export interface ArchivedTurn {
  /** 回合号 */
  turnNumber: number;
  /** 完成时间 */
  completedAt: number;
  /** 玩家行动 */
  actions: Record<
    string,
    {
      userId: string;
      content: string;
      submittedAt: number;
      displayName?: string;
    }
  >;
  /** AI 响应长度 */
  aiResponseLength: number;
}

/**
 * 资源引用
 */
export interface AssetRef {
  /** 资源 ID */
  id: string;
  /** 资源类型 */
  type: "image" | "audio" | "video";
  /** OPFS 路径 */
  path: string;
  /** 元数据 */
  metadata?: Record<string, unknown>;
}

/**
 * Yjs 文档初始化选项
 */
export interface YjsInitOptions {
  /** 文档名称（用于 IndexedDB 数据库名） */
  docName?: string;
  /** 是否自动初始化 */
  autoInit?: boolean;
}

/**
 * 存档创建参数
 */
export interface CreateSaveParams {
  /** 存档名称 */
  name: string;
  /** 存档类型（默认为 'solo'） */
  type?: SaveType;
  /** 初始数据（可选） */
  initialData?: Partial<SaveSlot>;

  // 联机存档专用参数
  /** 房间码（用于显示） */
  roomCode?: string;
  /** 成员列表 */
  members?: SaveMemberInfo[];
}

/**
 * 存档类型
 */
export type SaveType = "solo" | "multiplayer";

/**
 * 存档成员信息
 */
export interface SaveMemberInfo {
  /** 显示名称 */
  displayName: string;
  /** 角色 */
  role: "host" | "guest";
}

/**
 * 存档列表项（用于 UI 显示）
 */
export interface SaveSlotInfo {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;

  /** 存档类型：单人或联机 */
  type: SaveType;

  // 联机存档专用字段
  /** 上次使用的房间 ID（用于消息迁移判断） */
  lastRoomId?: string;
  /** 上次的房间码（仅参考） */
  lastRoomCode?: string;
  /** 上次的成员数 */
  memberCount?: number;
  /** 上次的成员列表 */
  members?: SaveMemberInfo[];
  /** 上次的最大玩家数 */
  maxPlayers?: number;
  /** 上次的回合时长（毫秒） */
  turnDuration?: number;

  // === 游戏进度（Phase 1 新增） ===
  /** 当前回合号（0 = 未开始） */
  currentTurnNumber?: number;
  /** 是否保存结构化回合数据 */
  saveArchivedTurns?: boolean;
}

/**
 * 导入存档时的会话数据
 */
export interface ImportConversationData {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  metadata?: Record<string, unknown>;
}

/**
 * 导入存档时的消息数据
 */
export interface ImportMessageData {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: number;
  updatedAt?: number;
  metadata?: Record<string, unknown>;
}

/**
 * 导入存档时的角色数据
 */
export interface ImportCharacterData {
  id: string;
  name: string;
  creatorUniqueTag: string;
  operatorUserId: string;
  operatorUniqueTag: string;
  status: CharacterStatus;
  createdAt: number;
  updatedAt: number;
  attributes?: Record<string, unknown>;
  /** 标签元数据（序列化形式） */
  tags?: Record<string, unknown>;
  /** 角色控制类型 */
  controlType?: "player" | "npc" | "companion";
  /** 角色背景故事 */
  description?: string;
  /** 性格特征 */
  personality?: string;
  /** 外貌描述 */
  appearance?: string;
  /** 维度选择（key: 维度 ID, value: 选项 ID） */
  dimensionSelections?: Record<string, string>;
  /** 已选天赋 ID 列表 */
  talentIds?: string[];
}

/**
 * 导入存档数据（用于 yjsManager.importSave）
 */
export interface ImportSaveData {
  /** 存档名称 */
  name: string;
  /** 原始 ID（用于映射） */
  originalId: string;
  /** 会话列表 */
  conversations: ImportConversationData[];
  /** 消息（按原始会话 ID 索引） */
  messages: Record<string, ImportMessageData[]>;
  /** 游戏状态 */
  gameState: Record<string, unknown>;
  /** 角色列表（Phase 2 新增） */
  characters?: ImportCharacterData[];
}

/**
 * 导出存档时的会话数据
 */
export interface ExportConversationData {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  metadata?: Record<string, unknown>;
}

/**
 * 导出存档时的消息数据
 */
export interface ExportMessageData {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: number;
  updatedAt?: number;
  metadata?: Record<string, unknown>;
}

/**
 * 导出存档时的角色数据
 */
export interface ExportCharacterData {
  id: string;
  name: string;
  creatorUniqueTag: string;
  operatorUserId: string;
  operatorUniqueTag: string;
  status: CharacterStatus;
  createdAt: number;
  updatedAt: number;
  attributes?: Record<string, unknown>;
  /** 标签元数据（序列化形式） */
  tags?: Record<string, unknown>;
  /** 角色控制类型 */
  controlType?: "player" | "npc" | "companion";
  /** 角色背景故事 */
  description?: string;
  /** 性格特征 */
  personality?: string;
  /** 外貌描述 */
  appearance?: string;
  /** 维度选择（key: 维度 ID, value: 选项 ID） */
  dimensionSelections?: Record<string, string>;
  /** 已选天赋 ID 列表 */
  talentIds?: string[];
}

/**
 * 导出存档数据（用于 yjsManager.exportSave）
 */
export interface ExportSaveData {
  /** 存档 ID */
  id: string;
  /** 存档名称 */
  name: string;
  /** 创建时间 */
  createdAt: number;
  /** 更新时间 */
  updatedAt: number;
  /** 会话列表 */
  conversations: ExportConversationData[];
  /** 消息（按会话 ID 索引） */
  messages: Record<string, ExportMessageData[]>;
  /** 游戏状态 */
  gameState: Record<string, unknown>;
  /** 角色列表（Phase 2 新增） */
  characters?: ExportCharacterData[];
}
