/**
 * Checkpoint 模块命令定义
 */

import type { CheckpointSource } from "../entities/checkpoint";

/**
 * Checkpoint 命令类型常量
 */
export const CheckpointCommands = {
  CREATE_CHECKPOINT: "checkpoint.create",
  RESTORE_CHECKPOINT: "checkpoint.restore",
  DELETE_CHECKPOINT: "checkpoint.delete",
} as const;

/**
 * Checkpoint 命令类型
 */
export type CheckpointCommandType =
  (typeof CheckpointCommands)[keyof typeof CheckpointCommands];

// ============ 命令 Payload 类型 ============

/**
 * 创建检查点命令 Payload
 */
export interface CreateCheckpointPayload {
  /** 检查点标签（默认自动生成） */
  label?: string;
  /** 来源 */
  source: CheckpointSource;
}

/**
 * 恢复检查点命令 Payload
 */
export interface RestoreCheckpointPayload {
  /** 要恢复的检查点 ID */
  checkpointId: string;
}

/**
 * 删除检查点命令 Payload
 */
export interface DeleteCheckpointPayload {
  /** 要删除的检查点 ID */
  checkpointId: string;
}

// ============ 命令类型映射 ============

/**
 * Checkpoint 命令 Payload 映射
 */
export interface CheckpointCommandPayloads {
  [CheckpointCommands.CREATE_CHECKPOINT]: CreateCheckpointPayload;
  [CheckpointCommands.RESTORE_CHECKPOINT]: RestoreCheckpointPayload;
  [CheckpointCommands.DELETE_CHECKPOINT]: DeleteCheckpointPayload;
}
