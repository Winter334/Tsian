/**
 * 命令基础类型
 */
export interface Command<T = unknown> {
  /** 命令唯一标识 */
  id?: string;
  /** 命令类型标识 */
  type: string;
  /** 命令负载 */
  payload: T;
  /** 命令发送时间 */
  timestamp?: number;
}

/**
 * 命令执行结果
 */
export interface CommandResult<T = unknown> {
  /** 是否成功 */
  success: boolean;
  /** 返回数据 */
  data?: T;
  /** 错误信息 */
  error?: string;
  /** 命令 ID */
  commandId?: string;
  /** 执行耗时（毫秒） */
  duration?: number;
}

/**
 * 命令处理器类型
 */
export type CommandHandler<C = unknown, R = unknown> = (
  command: Command<C>,
  context: CommandContext
) => Promise<CommandResult<R>>;

/**
 * 命令上下文（传递给处理器）
 */
export interface CommandContext {
  /** 命令 ID */
  commandId: string;
  /** 发送者信息 - Phase 3 启用 */
  sender?: string;
  /** 是否在沙箱中执行 - Phase 6 启用 */
  sandbox?: boolean;
}

/**
 * 命令分发上下文（调用者传入）
 */
export interface DispatchContext {
  /** 发送者标识 */
  sender?: string;
  /** 关联 ID（用于追踪因果链） */
  correlationId?: string;
  // Phase 3 可扩展: userId?: string
  // Phase 6 可扩展: sandbox?: boolean
}

/**
 * 命令中间件类型
 */
export type CommandMiddleware = (
  command: Command<unknown>,
  context: CommandContext,
  next: () => Promise<CommandResult<unknown>>
) => Promise<CommandResult<unknown>>;

/**
 * 命令历史记录
 */
export interface CommandHistoryEntry<C = unknown, R = unknown> {
  command: Command<C>;
  result: CommandResult<R>;
  startedAt: number;
  completedAt: number;
}
