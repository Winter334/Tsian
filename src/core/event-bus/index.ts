import type {
  DomainEvent,
  EmitOptions,
  EventHandler,
  EventHistoryEntry,
  SubscribeOptions,
  Unsubscribe,
} from "./types";

export * from "./types";

/**
 * 事件总线配置
 */
interface EventBusConfig {
  /** 是否启用事件历史记录 */
  enableHistory: boolean;
  /** 历史记录最大长度 */
  maxHistorySize: number;
  /** 是否在开发模式下打印日志 */
  debug: boolean;
}

/**
 * 事件总线 - 模块间通信的核心基础设施
 *
 * 设计原则：
 * - 异步发布，不阻塞调用者
 * - 订阅者错误不影响其他订阅者
 * - 接口预留扩展点（options 参数）
 * - 支持事件历史记录（用于调试/回放）
 */
class EventBusImpl {
  private handlers = new Map<string, Set<EventHandler<unknown>>>();
  /** 通配符订阅者（如 "character.*" 或 "*"） */
  private wildcardHandlers = new Map<string, Set<EventHandler<unknown>>>();
  private history: EventHistoryEntry<unknown>[] = [];
  private config: EventBusConfig = {
    enableHistory: import.meta.env.DEV,
    maxHistorySize: 1000,
    debug: import.meta.env.DEV,
  };

  /**
   * 配置事件总线
   */
  configure(config: Partial<EventBusConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 发布事件
   */
  emit<T>(event: DomainEvent<T>, options?: EmitOptions): void {
    // 确保事件有 ID
    const eventWithId: DomainEvent<T> = {
      ...event,
      id: event.id || crypto.randomUUID(),
      correlationId: options?.correlationId || event.correlationId,
    };

    // 收集所有匹配的处理器
    const matchingHandlers = this.collectMatchingHandlers(event.type);
    const handlerCount = matchingHandlers.length;

    // 记录事件历史
    if (this.config.enableHistory) {
      this.addToHistory(eventWithId, handlerCount);
    }

    // 开发模式日志
    if (this.config.debug) {
      console.debug(`[EventBus] Emit: ${event.type}`, {
        id: eventWithId.id,
        payload: eventWithId.payload,
        handlerCount,
      });
    }

    if (handlerCount === 0) return;

    matchingHandlers.forEach((handler) => {
      // 异步执行，不阻塞
      Promise.resolve().then(() => {
        try {
          handler(eventWithId as DomainEvent<unknown>);
        } catch (error) {
          console.error(`[EventBus] Handler error for ${event.type}:`, error);
        }
      });
    });
  }

  /**
   * 订阅事件
   */
  /**
   * 订阅事件
   *
   * 支持通配符模式：
   * - 精确匹配: "chat.message.sent"
   * - 前缀匹配: "chat.*" (匹配所有以 "chat." 开头的事件)
   * - 全局匹配: "*" (匹配所有事件)
   */
  on<T>(
    type: string,
    handler: EventHandler<T>,
    _options?: SubscribeOptions
  ): Unsubscribe {
    const isWildcard = type.includes("*");
    const targetMap = isWildcard ? this.wildcardHandlers : this.handlers;

    if (!targetMap.has(type)) {
      targetMap.set(type, new Set());
    }

    const handlers = targetMap.get(type)!;
    handlers.add(handler as EventHandler<unknown>);

    if (this.config.debug) {
      console.debug(
        `[EventBus] Subscribe: ${type}${isWildcard ? " (wildcard)" : ""} (${
          handlers.size
        } handlers)`
      );
    }

    // 返回取消订阅函数
    return () => {
      handlers.delete(handler as EventHandler<unknown>);
      if (handlers.size === 0) {
        targetMap.delete(type);
      }
      if (this.config.debug) {
        console.debug(`[EventBus] Unsubscribe: ${type}`);
      }
    };
  }

  /**
   * 一次性订阅
   */
  once<T>(type: string): Promise<DomainEvent<T>> {
    return new Promise((resolve) => {
      const unsubscribe = this.on<T>(type, (event) => {
        unsubscribe();
        resolve(event);
      });
    });
  }

  /**
   * 创建事件（工厂函数）
   */
  createEvent<T>(type: string, payload: T, source?: string): DomainEvent<T> {
    return {
      id: crypto.randomUUID(),
      type,
      payload,
      timestamp: Date.now(),
      source,
    };
  }

  /**
   * 获取事件历史
   */
  getHistory(filter?: {
    type?: string;
    limit?: number;
  }): EventHistoryEntry<unknown>[] {
    let result = [...this.history];

    if (filter?.type) {
      result = result.filter((entry) => entry.event.type === filter.type);
    }

    if (filter?.limit) {
      result = result.slice(-filter.limit);
    }

    return result;
  }

  /**
   * 清除事件历史
   */
  clearHistory(): void {
    this.history = [];
  }

  /**
   * 添加到历史记录
   */
  private addToHistory<T>(event: DomainEvent<T>, handlerCount: number): void {
    this.history.push({
      event: event as DomainEvent<unknown>,
      handlerCount,
      processedAt: Date.now(),
    });

    // 限制历史记录大小
    if (this.history.length > this.config.maxHistorySize) {
      this.history = this.history.slice(-this.config.maxHistorySize);
    }
  }

  /**
   * 收集所有匹配事件类型的处理器
   */
  private collectMatchingHandlers(eventType: string): EventHandler<unknown>[] {
    const handlers: EventHandler<unknown>[] = [];

    // 1. 精确匹配
    const exactHandlers = this.handlers.get(eventType);
    if (exactHandlers) {
      handlers.push(...exactHandlers);
    }

    // 2. 通配符匹配
    for (const [pattern, wildcardHandlers] of this.wildcardHandlers) {
      if (this.matchWildcard(pattern, eventType)) {
        handlers.push(...wildcardHandlers);
      }
    }

    return handlers;
  }

  /**
   * 检查事件类型是否匹配通配符模式
   */
  private matchWildcard(pattern: string, eventType: string): boolean {
    // "*" 匹配所有事件
    if (pattern === "*") return true;

    // "prefix.*" 匹配以 "prefix." 开头的事件
    if (pattern.endsWith(".*")) {
      const prefix = pattern.slice(0, -1); // 去掉 "*"，保留 "prefix."
      return eventType.startsWith(prefix);
    }

    // 未来可扩展更复杂的模式匹配
    return false;
  }

  /**
   * 获取订阅者数量（包括通配符匹配）
   */
  getHandlerCount(type: string): number {
    return this.collectMatchingHandlers(type).length;
  }

  /**
   * 获取所有订阅的事件类型
   */
  getSubscribedTypes(): string[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * 获取所有通配符订阅模式
   */
  getWildcardPatterns(): string[] {
    return Array.from(this.wildcardHandlers.keys());
  }

  /**
   * 清除所有订阅（测试用）
   */
  clear(): void {
    this.handlers.clear();
    this.wildcardHandlers.clear();
  }
}

// 导出单例
export const eventBus = new EventBusImpl();
