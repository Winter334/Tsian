/**
 * Memory 模块命令定义
 */

import type {
  ManualMemory,
  MegaSummary,
  MiniSummary,
} from "../entities/memory";

/**
 * Memory 命令类型常量
 */
export const MemoryCommands = {
  ADD_MINI_SUMMARY: "memory.addMiniSummary",
  ADD_MANUAL_MEMORY: "memory.addManualMemory",
  UPDATE_MANUAL_MEMORY: "memory.updateManualMemory",
  DELETE_MANUAL_MEMORY: "memory.deleteManualMemory",
  TRIGGER_COMPRESSION: "memory.triggerCompression",
  UPDATE_MINI_SUMMARY: "memory.updateMiniSummary",
  UPDATE_MEGA_SUMMARY: "memory.updateMegaSummary",
} as const;

/**
 * Memory 命令类型
 */
export type MemoryCommandType =
  (typeof MemoryCommands)[keyof typeof MemoryCommands];

// ============ 命令 Payload 类型 ============

/**
 * 添加小总结命令 Payload
 */
export interface AddMiniSummaryPayload {
  conversationId: string;
  messageId: string;
  messageIndex: number;
  content: string;
  /** 联机模式房间 ID（存在时使用联机 Repository） */
  roomId?: string;
}

/**
 * 更新小总结命令 Payload
 */
export interface UpdateMiniSummaryPayload {
  conversationId: string;
  summaryId: string;
  content: string;
  /** 联机模式房间 ID */
  roomId?: string;
}

/**
 * 更新大总结命令 Payload
 */
export interface UpdateMegaSummaryPayload {
  conversationId: string;
  summaryId: string;
  content: string;
  /** 联机模式房间 ID */
  roomId?: string;
}

/**
 * 添加手动记忆命令 Payload
 */
export interface AddManualMemoryPayload {
  conversationId: string;
  sourceContent: string;
  summary: string;
  tags: string[];
  sourceMessageId?: string;
  /** 联机模式房间 ID */
  roomId?: string;
}

/**
 * 更新手动记忆命令 Payload
 */
export interface UpdateManualMemoryPayload {
  conversationId: string;
  id: string;
  updates: Partial<Pick<ManualMemory, "summary" | "tags" | "sourceContent">>;
  /** 联机模式房间 ID */
  roomId?: string;
}

/**
 * 删除手动记忆命令 Payload
 */
export interface DeleteManualMemoryPayload {
  conversationId: string;
  id: string;
  /** 联机模式房间 ID */
  roomId?: string;
}

/**
 * 触发压缩命令 Payload
 */
export interface TriggerCompressionPayload {
  conversationId: string;
  miniSummaryIds: string[];
  megaSummaryContent: string;
  messageRange: MegaSummary["messageRange"];
  /** 联机模式房间 ID */
  roomId?: string;
}

// ============ 命令类型映射 ============

/**
 * Memory 命令 Payload 映射
 */
export interface MemoryCommandPayloads {
  [MemoryCommands.ADD_MINI_SUMMARY]: AddMiniSummaryPayload;
  [MemoryCommands.ADD_MANUAL_MEMORY]: AddManualMemoryPayload;
  [MemoryCommands.UPDATE_MANUAL_MEMORY]: UpdateManualMemoryPayload;
  [MemoryCommands.DELETE_MANUAL_MEMORY]: DeleteManualMemoryPayload;
  [MemoryCommands.TRIGGER_COMPRESSION]: TriggerCompressionPayload;
  [MemoryCommands.UPDATE_MINI_SUMMARY]: UpdateMiniSummaryPayload;
  [MemoryCommands.UPDATE_MEGA_SUMMARY]: UpdateMegaSummaryPayload;
}

/**
 * 内部辅助类型：创建后返回的核心数据
 */
export interface AddMiniSummaryResult {
  summary: MiniSummary;
}

/**
 * 内部辅助类型：添加手动记忆返回值
 */
export interface AddManualMemoryResult {
  memory: ManualMemory;
}
