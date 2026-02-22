/**
 * 导出/导入数据实体定义
 *
 * 这些类型定义属于领域层，用于数据导出/导入功能
 */

import type { WorldConfig } from "@/lib/world/types";

import type { CharacterStatus } from "./character";

/**
 * 导出格式版本
 * 用于后续兼容性处理
 */
export const EXPORT_VERSION = 1;

/**
 * 导出类型
 */
export type ExportType = "single_save" | "full_backup";

/**
 * 会话数据（导出用）
 */
export interface ExportedConversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  metadata?: Record<string, unknown>;
}

/**
 * 消息数据（导出用）
 */
export interface ExportedMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: number;
  updatedAt?: number;
  metadata?: Record<string, unknown>;
}

/**
 * 角色数据（导出用）
 */
export interface ExportedCharacter {
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
 * 存档数据（导出用）
 */
export interface ExportedSave {
  /** 原始 ID（导入时会生成新 ID） */
  id: string;
  /** 存档名称 */
  name: string;
  /** 创建时间 */
  createdAt: number;
  /** 更新时间 */
  updatedAt: number;
  /** 会话列表 */
  conversations: ExportedConversation[];
  /** 消息（按会话 ID 索引） */
  messages: Record<string, ExportedMessage[]>;
  /** 游戏状态（预留扩展） */
  gameState: Record<string, unknown>;
  /** 世界配置快照 */
  worldConfig?: WorldConfig;
  /** 角色列表（Phase 2 新增） */
  characters?: ExportedCharacter[];
}

/**
 * 单个存档导出格式
 */
export interface SingleSaveExport {
  /** 导出格式版本 */
  version: number;
  /** 导出时间戳 */
  exportedAt: number;
  /** 导出类型 */
  type: "single_save";
  /** 存档数据 */
  save: ExportedSave;
}

/**
 * 全部数据导出格式
 */
export interface FullBackupExport {
  /** 导出格式版本 */
  version: number;
  /** 导出时间戳 */
  exportedAt: number;
  /** 导出类型 */
  type: "full_backup";
  /** 所有存档 */
  saves: ExportedSave[];
}

/**
 * 导出数据联合类型
 */
export type ExportData = SingleSaveExport | FullBackupExport;

/**
 * 导入预览信息
 */
export interface ImportPreview {
  /** 导出类型 */
  type: ExportType;
  /** 导出时间 */
  exportedAt: number;
  /** 存档数量 */
  saveCount: number;
  /** 存档预览列表 */
  saves: {
    name: string;
    conversationCount: number;
    messageCount: number;
    updatedAt: number;
  }[];
}

/**
 * 导入结果
 */
export interface ImportResult {
  success: boolean;
  /** 导入的存档 ID 映射（原 ID -> 新 ID） */
  saveIdMap?: Record<string, string>;
  /** 错误信息 */
  error?: string;
}
