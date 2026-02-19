/**
 * DelayedCommitManager
 *
 * 管理 IRNR 流水线中 ResultFrame 的延迟提交。
 * 规则引擎执行后先 buffer 结果，等叙事 AI 完成后再 commit。
 * 任何阶段失败都可以 discard，保证不会部分提交。
 *
 * 职责：
 * - buffer: 缓存 ResultFrame（规则引擎执行后调用）
 * - commit: 提交缓存（叙事 AI 完成后调用）
 * - discard: 丢弃缓存（任何阶段失败时调用）
 * - 状态查询
 */

import type { ResultFrame } from "@/domain/types";

export type CommitStatus =
  | "idle"
  | "buffered"
  | "committing"
  | "committed"
  | "discarded";

export interface DelayedCommitManager {
  /** 缓存 ResultFrame，进入 buffered 状态 */
  buffer(frame: ResultFrame): boolean;
  /** 提交缓存，进入 committed 状态 */
  commit(): void;
  /** 丢弃缓存，进入 discarded 状态 */
  discard(): void;
  /** 获取当前状态 */
  getStatus(): CommitStatus;
  /** 获取待提交的 ResultFrame */
  getPendingFrame(): ResultFrame | null;
  /** 重置为 idle 状态 */
  reset(): void;
}

/**
 * DelayedCommitManager 实现
 *
 * 单实例管理，每次 IRNR 流水线调用前应先 reset。
 */
class DelayedCommitManagerImpl implements DelayedCommitManager {
  private status: CommitStatus = "idle";
  private pendingFrame: ResultFrame | null = null;

  buffer(frame: ResultFrame): boolean {
    if (this.status !== "idle") {
      console.warn(
        `[DelayedCommit] 无法 buffer: 当前状态为 ${this.status}，需要先 reset`
      );
      return false;
    }

    this.pendingFrame = frame;
    this.status = "buffered";
    return true;
  }

  commit(): void {
    if (this.status !== "buffered") {
      console.warn(
        `[DelayedCommit] 无法 commit: 当前状态为 ${this.status}，需要先 buffer`
      );
      return;
    }

    this.status = "committed";
    // 注意：pendingFrame 保留到 reset 前，供调用方读取提交结果
  }

  discard(): void {
    if (this.status === "idle" || this.status === "committed") {
      console.warn(`[DelayedCommit] discard 无效: 当前状态为 ${this.status}`);
      return;
    }

    this.status = "discarded";
    this.pendingFrame = null;
  }

  getStatus(): CommitStatus {
    return this.status;
  }

  getPendingFrame(): ResultFrame | null {
    return this.pendingFrame;
  }

  reset(): void {
    this.status = "idle";
    this.pendingFrame = null;
  }
}

/**
 * 创建新的 DelayedCommitManager 实例
 *
 * 每次 IRNR 流水线运行时应创建新实例或调用 reset，
 * 避免多次调用间状态污染。
 */
export function createDelayedCommitManager(): DelayedCommitManager {
  return new DelayedCommitManagerImpl();
}
