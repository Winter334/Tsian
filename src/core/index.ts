/**
 * 核心基础设施 - 统一导出
 */

// 事件总线
export { eventBus } from "./event-bus";
export type {
  DomainEvent,
  EmitOptions,
  EventHandler,
  EventHistoryEntry,
  SubscribeOptions,
  Unsubscribe,
} from "./event-bus";

// 命令总线
export { commandBus } from "./command-bus";
export type {
  Command,
  CommandContext,
  CommandHandler,
  CommandHistoryEntry,
  CommandMiddleware,
  CommandResult,
  DispatchContext,
} from "./command-bus";

// 模块注册表
export { registry } from "./registry";
export type {
  AIToolDefinition,
  ModuleCapabilities,
  ModuleContext,
  ModuleLifecycle,
  ModuleManifest,
  ModuleRequirements,
  ModuleStatus,
} from "./registry";

// 服务注册器
export { createServiceToken, services } from "./services";
export type { ServiceToken } from "./services";

// 存储层
export { checkStorageQuota, opfs, settings } from "./storage";

// 管线编排
export { PipelineError, PipelineOrchestrator } from "./pipeline";
export type {
  AgentDescriptor,
  AgentTraceEntry,
  BlackboardBase,
  BlackboardInput,
} from "./pipeline";
