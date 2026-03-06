/**
 * Prompt v2 Turn Delta 协议类型
 *
 * 保持最小交换子集稳定，同时为 Phase 5 的统一 Delta Builder
 * 提供必需的 source / patch / commitStatus 边界。
 */

/** Delta 来源 Agent / 系统阶段 */
export type DeltaSource =
  | "director"
  | "parser"
  | "engine"
  | "narrator"
  | "postprocess"
  | "summarizer"
  | "system";

/** Delta 提交状态 */
export type DeltaCommitStatus = "buffered" | "committed" | "discarded";

/** Delta 终态（Phase 5 最小闭环） */
export type DeltaTerminalCommitStatus = Extract<
  DeltaCommitStatus,
  "committed" | "discarded"
>;

/** Delta patch 操作符（MVP 预置 + 扩展位） */
export type DeltaPatchOp =
  | "directives.replace"
  | "rulescript.replace"
  | "resultFrame.replace"
  | "narrative.replace"
  | "postprocess.extracted"
  | "memory.appendMini"
  | "memory.appendMega"
  | "archive.apply"
  | "entities.patch"
  | (string & {});

/** Delta patch */
export interface DeltaPatch {
  op: DeltaPatchOp;
  path: string;
  value: unknown;
  metadata?: Record<string, unknown>;
}

/** 单回合增量包 */
export interface TurnDelta {
  /** Delta 协议版本 */
  deltaVersion: string;
  /** 对应的 Envelope 版本 */
  envelopeVersion: string;

  /** 当前回合号 */
  turn: number;
  /** 基线回合号 */
  baseTurn: number;
  /** 回合内序列号（单调递增） */
  sequence: number;

  /** 增量来源 */
  source: DeltaSource;
  /** 提交状态 */
  commitStatus: DeltaCommitStatus;

  /** 增量补丁列表 */
  patches: DeltaPatch[];

  /** 完整性校验 */
  checksum?: string;
  /** 扩展元数据槽位 */
  metadata?: Record<string, unknown>;
}
