import type {
  Command,
  CommandContext,
  CommandHandler,
  CommandHistoryEntry,
  CommandMiddleware,
  CommandResult,
  DispatchContext,
} from "./types";

export * from "./types";

/**
 * 命令总线配置
 */
interface CommandBusConfig {
  /** 是否启用命令历史记录 */
  enableHistory: boolean;
  /** 历史记录最大长度 */
  maxHistorySize: number;
  /** 是否在开发模式下打印日志 */
  debug: boolean;
}

/**
 * 命令总线 - 状态修改的唯一入口
 *
 * 设计原则：
 * - 所有状态修改都通过命令
 * - 命令由注册的处理器执行
 * - 处理器执行后发布事件通知
 * - 支持中间件机制（验证、日志、权限等）
 */
class CommandBusImpl {
  private handlers = new Map<string, CommandHandler<unknown, unknown>>();
  private middlewares: CommandMiddleware[] = [];
  private history: CommandHistoryEntry<unknown, unknown>[] = [];
  private config: CommandBusConfig = {
    enableHistory: import.meta.env.DEV,
    maxHistorySize: 500,
    debug: import.meta.env.DEV,
  };

  /**
   * 配置命令总线
   */
  configure(config: Partial<CommandBusConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 注册命令处理器
   */
  register<C, R>(type: string, handler: CommandHandler<C, R>): void {
    if (this.handlers.has(type)) {
      console.warn(`[CommandBus] Overwriting handler for ${type}`);
    }
    this.handlers.set(type, handler as CommandHandler<unknown, unknown>);

    if (this.config.debug) {
      console.debug(`[CommandBus] Registered handler: ${type}`);
    }
  }

  /**
   * 注销命令处理器
   */
  unregister(type: string): void {
    this.handlers.delete(type);
    if (this.config.debug) {
      console.debug(`[CommandBus] Unregistered handler: ${type}`);
    }
  }

  /**
   * 添加中间件
   */
  use(middleware: CommandMiddleware): void {
    this.middlewares.push(middleware);
  }

  /**
   * 移除中间件
   */
  removeMiddleware(middleware: CommandMiddleware): boolean {
    const index = this.middlewares.indexOf(middleware);
    if (index > -1) {
      this.middlewares.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * 分发命令
   */
  async dispatch<C, R>(
    command: Command<C>,
    dispatchContext?: DispatchContext
  ): Promise<CommandResult<R>> {
    const startedAt = Date.now();
    const commandId = command.id || crypto.randomUUID();

    // 创建完整命令对象
    const fullCommand: Command<C> = {
      ...command,
      id: commandId,
      timestamp: command.timestamp || startedAt,
    };

    // 创建命令上下文
    const context: CommandContext = {
      commandId,
      sender: dispatchContext?.sender,
    };

    if (this.config.debug) {
      console.debug(`[CommandBus] Dispatch: ${command.type}`, {
        commandId,
        payload: command.payload,
      });
    }

    // 检查处理器
    const handler = this.handlers.get(command.type);
    if (!handler) {
      const result: CommandResult<R> = {
        success: false,
        error: `No handler registered for command: ${command.type}`,
        commandId,
      };
      return result;
    }

    try {
      // 执行中间件链
      const result = await this.executeWithMiddlewares(
        fullCommand as Command<unknown>,
        context,
        handler
      );

      const completedAt = Date.now();
      const typedResult = result as CommandResult<R>;
      typedResult.commandId = commandId;
      typedResult.duration = completedAt - startedAt;

      // 记录历史
      if (this.config.enableHistory) {
        this.addToHistory(fullCommand, typedResult, startedAt, completedAt);
      }

      if (this.config.debug) {
        console.debug(`[CommandBus] Completed: ${command.type}`, {
          commandId,
          success: typedResult.success,
          duration: typedResult.duration,
        });
      }

      return typedResult;
    } catch (error) {
      console.error(`[CommandBus] Error executing ${command.type}:`, error);
      const result: CommandResult<R> = {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        commandId,
        duration: Date.now() - startedAt,
      };

      // 记录失败历史
      if (this.config.enableHistory) {
        this.addToHistory(fullCommand, result, startedAt, Date.now());
      }

      return result;
    }
  }

  /**
   * 执行中间件链
   */
  private async executeWithMiddlewares(
    command: Command<unknown>,
    context: CommandContext,
    handler: CommandHandler<unknown, unknown>
  ): Promise<CommandResult<unknown>> {
    // 构建中间件执行链
    let index = 0;

    const executeNext = async (): Promise<CommandResult<unknown>> => {
      if (index < this.middlewares.length) {
        const middleware = this.middlewares[index++];
        return middleware(command, context, executeNext);
      } else {
        // 所有中间件执行完毕，执行处理器
        return handler(command, context);
      }
    };

    return executeNext();
  }

  /**
   * 添加到历史记录
   */
  private addToHistory<C, R>(
    command: Command<C>,
    result: CommandResult<R>,
    startedAt: number,
    completedAt: number
  ): void {
    this.history.push({
      command: command as Command<unknown>,
      result: result as CommandResult<unknown>,
      startedAt,
      completedAt,
    });

    // 限制历史记录大小
    if (this.history.length > this.config.maxHistorySize) {
      this.history = this.history.slice(-this.config.maxHistorySize);
    }
  }

  /**
   * 获取命令历史
   */
  getHistory(filter?: {
    type?: string;
    success?: boolean;
    limit?: number;
  }): CommandHistoryEntry<unknown, unknown>[] {
    let result = [...this.history];

    if (filter?.type) {
      result = result.filter((entry) => entry.command.type === filter.type);
    }

    if (filter?.success !== undefined) {
      result = result.filter(
        (entry) => entry.result.success === filter.success
      );
    }

    if (filter?.limit) {
      result = result.slice(-filter.limit);
    }

    return result;
  }

  /**
   * 清除命令历史
   */
  clearHistory(): void {
    this.history = [];
  }

  /**
   * 创建命令（工厂函数）
   */
  createCommand<T>(type: string, payload: T): Command<T> {
    return {
      id: crypto.randomUUID(),
      type,
      payload,
      timestamp: Date.now(),
    };
  }

  /**
   * 检查是否有处理器
   */
  hasHandler(type: string): boolean {
    return this.handlers.has(type);
  }

  /**
   * 获取所有注册的命令类型
   */
  getRegisteredTypes(): string[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * 清除所有处理器（测试用）
   */
  clear(): void {
    this.handlers.clear();
    this.middlewares = [];
  }
}

// 导出单例
export const commandBus = new CommandBusImpl();
