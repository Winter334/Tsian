/**
 * 管线基础设施 — 统一导出
 *
 * 提供通用的管线编排框架：
 * - BlackboardBase / AgentDescriptor / AgentTraceEntry — 核心类型
 * - PipelineOrchestrator — 编排器（拓扑排序 + 依赖检查 + 执行跟踪）
 * - PipelineError — 管线错误
 *
 * 本模块不依赖任何业务层代码，可被任何模块安全导入。
 *
 * @see plans/blackboard-pipeline-design.md
 */

export type { AgentDescriptor, AgentTraceEntry, BlackboardBase } from "./types";

export { PipelineOrchestrator } from "./orchestrator";
export type { BlackboardInput } from "./orchestrator";

export { PipelineError } from "./errors";
