/**
 * Memory 模块事件定义
 */

import type {
  ManualMemory,
  MegaSummary,
  MiniSummary,
} from "../entities/memory";

/**
 * Memory 事件类型常量
 */
export const MemoryEvents = {
  MINI_SUMMARY_ADDED: "memory:miniSummaryAdded",
  MINI_SUMMARY_COMPRESSED: "memory:miniSummaryCompressed",
  MINI_SUMMARY_UPDATED: "memory.miniSummaryUpdated",
  MEGA_SUMMARY_ADDED: "memory:megaSummaryAdded",
  MEGA_SUMMARY_UPDATED: "memory.megaSummaryUpdated",
  MANUAL_MEMORY_ADDED: "memory:manualMemoryAdded",
  MANUAL_MEMORY_UPDATED: "memory:manualMemoryUpdated",
  MANUAL_MEMORY_DELETED: "memory:manualMemoryDeleted",
  COMPRESSION_SKIPPED: "memory:compressionSkipped",
  COMPRESSION_FAILED: "memory:compressionFailed",
} as const;

/**
 * Memory 事件类型
 */
export type MemoryEventType = (typeof MemoryEvents)[keyof typeof MemoryEvents];

// ============ 事件 Payload 类型 ============

/**
 * 小总结新增事件 Payload
 */
export interface MiniSummaryAddedPayload {
  conversationId: string;
  summary: MiniSummary;
}

/**
 * 小总结压缩事件 Payload
 */
export interface MiniSummaryCompressedPayload {
  conversationId: string;
  miniSummaryIds: string[];
  megaSummaryId: string;
}

/**
 * 小总结更新事件 Payload
 */
export interface MiniSummaryUpdatedPayload {
  conversationId: string;
  summaryId: string;
}

/**
 * 压缩跳过事件 Payload
 */
export interface CompressionSkippedPayload {
  conversationId: string;
  message: string;
}

/**
 * 压缩失败事件 Payload
 */
export interface CompressionFailedPayload {
  conversationId: string;
  message: string;
}

/**
 * 大总结新增事件 Payload
 */
export interface MegaSummaryAddedPayload {
  conversationId: string;
  summary: MegaSummary;
}

/**
 * 大总结更新事件 Payload
 */
export interface MegaSummaryUpdatedPayload {
  conversationId: string;
  summaryId: string;
}

/**
 * 手动记忆新增事件 Payload
 */
export interface ManualMemoryAddedPayload {
  conversationId: string;
  memory: ManualMemory;
}

/**
 * 手动记忆更新事件 Payload
 */
export interface ManualMemoryUpdatedPayload {
  conversationId: string;
  memory: ManualMemory;
}

/**
 * 手动记忆删除事件 Payload
 */
export interface ManualMemoryDeletedPayload {
  conversationId: string;
  memoryId: string;
}

/**
 * Memory 事件 Payload 映射
 */
export interface MemoryEventPayloads {
  [MemoryEvents.MINI_SUMMARY_ADDED]: MiniSummaryAddedPayload;
  [MemoryEvents.MINI_SUMMARY_COMPRESSED]: MiniSummaryCompressedPayload;
  [MemoryEvents.MINI_SUMMARY_UPDATED]: MiniSummaryUpdatedPayload;
  [MemoryEvents.MEGA_SUMMARY_ADDED]: MegaSummaryAddedPayload;
  [MemoryEvents.MEGA_SUMMARY_UPDATED]: MegaSummaryUpdatedPayload;
  [MemoryEvents.MANUAL_MEMORY_ADDED]: ManualMemoryAddedPayload;
  [MemoryEvents.MANUAL_MEMORY_UPDATED]: ManualMemoryUpdatedPayload;
  [MemoryEvents.MANUAL_MEMORY_DELETED]: ManualMemoryDeletedPayload;
  [MemoryEvents.COMPRESSION_SKIPPED]: CompressionSkippedPayload;
  [MemoryEvents.COMPRESSION_FAILED]: CompressionFailedPayload;
}
