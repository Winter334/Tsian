/**
 * 领域事件基础类型
 */
export interface DomainEvent<T = unknown> {
  /** 事件唯一标识 */
  id: string;
  /** 事件类型标识 */
  type: string;
  /** 事件负载 */
  payload: T;
  /** 事件时间戳 */
  timestamp: number;
  /** 事件来源模块 */
  source?: string;
  /** 关联的命令 ID（如果由命令触发） */
  correlationId?: string;
}

/**
 * 事件处理器类型
 */
export type EventHandler<T = unknown> = (
  event: DomainEvent<T>
) => void | Promise<void>;

/**
 * 取消订阅函数
 */
export type Unsubscribe = () => void;

/**
 * 事件发布选项（预留扩展）
 */
export interface EmitOptions {
  /** 关联 ID（用于追踪因果链） */
  correlationId?: string;
  // Phase 3 可扩展: priority?: number
  // Phase 6 可扩展: sandbox?: boolean
}

/**
 * 事件订阅选项（预留扩展）
 */
export interface SubscribeOptions {
  /** 优先级（数字越小越先执行）- Phase 3 启用 */
  priority?: number;
  // Phase 3 可扩展: once?: boolean
}

/**
 * 事件历史记录
 */
export interface EventHistoryEntry<T = unknown> {
  event: DomainEvent<T>;
  handlerCount: number;
  processedAt: number;
}
