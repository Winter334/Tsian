/**
 * Prompt v2 Turn Delta（P0 MVP）
 *
 * 仅冻结最小交换子集的类型边界，后续阶段可增量扩展 patch 语义。
 */

/** Delta 来源 Agent */
export type DeltaSource =
  | "director"
  | "parser"
  | "narrator"
  | "summarizer"
  | "system";

/** Delta 提交状态 */
export type DeltaCommitStatus = "buffered" | "committed" | "discarded";

/** Delta patch 操作符（MVP 预置 + 扩展位） */
export type DeltaPatchOp =
  | "directives.replace"
  | "rulescript.replace"
  | "narrative.replace"
  | "memory.appendMega"
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
