/**
 * Checkpoint 模块事件定义
 */

import type { CheckpointSource } from "../entities/checkpoint";

/**
 * Checkpoint 事件类型常量
 */
export const CheckpointEvents = {
  CHECKPOINT_CREATED: "checkpoint.created",
  CHECKPOINT_RESTORED: "checkpoint.restored",
  CHECKPOINT_DELETED: "checkpoint.deleted",
} as const;

/**
 * Checkpoint 事件类型
 */
export type CheckpointEventType =
  (typeof CheckpointEvents)[keyof typeof CheckpointEvents];

// ============ 事件 Payload 类型 ============

/**
 * 检查点创建事件 Payload
 */
export interface CheckpointCreatedPayload {
  checkpointId: string;
  label: string;
  createdAt: number;
  source: CheckpointSource;
}

/**
 * 检查点恢复事件 Payload
 */
export interface CheckpointRestoredPayload {
  checkpointId: string;
  /** 被丢弃的检查点数量 */
  discardedCount: number;
}

/**
 * 检查点删除事件 Payload
 */
export interface CheckpointDeletedPayload {
  checkpointId: string;
}

// ============ 事件类型映射 ============

/**
 * Checkpoint 事件 Payload 映射
 */
export interface CheckpointEventPayloads {
  [CheckpointEvents.CHECKPOINT_CREATED]: CheckpointCreatedPayload;
  [CheckpointEvents.CHECKPOINT_RESTORED]: CheckpointRestoredPayload;
  [CheckpointEvents.CHECKPOINT_DELETED]: CheckpointDeletedPayload;
}
