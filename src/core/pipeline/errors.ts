/**
 * 管线错误类型
 *
 * @see plans/blackboard-pipeline-design.md §4.3
 */

import type { BlackboardBase } from "./types";

/**
 * 管线执行错误
 *
 * 当必须 Agent 的依赖未满足或执行失败时抛出。
 * 携带黑板快照，便于调用方从部分结果中恢复信息。
 *
 * @typeParam T - 黑板类型
 */
export class PipelineError<
  T extends BlackboardBase = BlackboardBase,
> extends Error {
  override readonly name = "PipelineError";

  constructor(
    message: string,
    /** 失败的 Agent ID */
    public readonly agentId: string,
    /** 失败阶段：dependency（依赖检查）或 execution（执行过程） */
    public readonly phase: "dependency" | "execution",
    /** 失败时的黑板快照（包含已完成 Agent 的产出） */
    public readonly blackboard: Partial<T>,
  ) {
    super(message);
  }
}
