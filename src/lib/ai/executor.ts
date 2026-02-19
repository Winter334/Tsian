/**
 * AI 执行器模块
 *
 * 提供统一的 AI 调用接口，支持：
 * - 流式输出
 * - 自动重试（带指数退避）
 * - 取消/中断机制
 * - 错误分类
 *
 * 用于单人模式和联机模式共享核心逻辑
 */

import type { Preset, VariableContext } from "@/lib/prompt";
import { messageAssembler } from "@/lib/prompt";
import { aiManager } from "./manager";
import type { AIConfig, AIError, AiErrorType } from "./types";

// ===== 类型定义 =====

/**
 * AI 执行上下文
 */
export interface AiExecutionContext {
  /** 预设（必需） */
  preset: Preset;

  /** 变量上下文（必需） */
  variableContext: VariableContext;

  /** 流式输出回调 */
  onChunk?: (text: string) => void;

  /** 完成回调 */
  onComplete?: (text: string) => void;

  /** 重试回调 */
  onRetry?: (attempt: number, maxAttempts: number, error: unknown) => void;

  /** 取消信号 */
  signal?: AbortSignal;

  /** assemble 之后追加的消息（如当前回合用户输入） */
  appendMessages?: Array<{
    role: "user" | "assistant" | "system";
    content: string;
  }>;
}

/**
 * AI 执行结果
 */
export interface AiExecutionResult {
  /** 是否成功 */
  success: boolean;
  /** 响应内容（成功时） */
  content?: string;
  /** 错误信息（失败时） */
  error?: {
    type: AiErrorType;
    message: string;
    retryCount: number;
  };
  /** 是否被中断 */
  aborted?: boolean;
}

/**
 * AI 执行器接口
 */
export interface AiExecutor {
  /**
   * 执行 AI 调用
   */
  execute(context: AiExecutionContext): Promise<AiExecutionResult>;

  /**
   * 中止当前调用
   */
  abort(): void;
}

/**
 * 重试配置
 */
export interface ExecutorRetryConfig {
  /** 最大重试次数 */
  maxAttempts: number;
  /** 重试延迟（毫秒数组，指数退避） */
  delays: number[];
  /** Rate limit 最大等待时间 */
  maxRateLimitWait: number;
}

/**
 * 默认重试配置
 */
export const DEFAULT_EXECUTOR_RETRY_CONFIG: ExecutorRetryConfig = {
  maxAttempts: 3,
  delays: [2000, 4000, 8000], // 指数退避
  maxRateLimitWait: 60000,
};

// ===== 错误类型映射 =====

/**
 * 从 AIError 映射到 AiErrorType
 */
function mapAiErrorType(error: AIError): AiErrorType {
  switch (error.type) {
    case "network":
      return "network";
    case "timeout":
      return "timeout";
    case "rate_limit":
      return "rate_limit";
    case "unauthorized":
      return "auth";
    case "server_error":
      return "network"; // 服务器错误归类为网络问题
    default:
      return "unknown";
  }
}

/**
 * 从通用错误推断 AiErrorType
 */
function inferErrorType(error: unknown): AiErrorType {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // 网络错误
    if (message.includes("network") || message.includes("fetch")) {
      return "network";
    }

    // 超时
    if (message.includes("timeout") || message.includes("aborted")) {
      return "timeout";
    }

    // 认证错误
    if (
      message.includes("unauthorized") ||
      message.includes("api key") ||
      message.includes("401")
    ) {
      return "auth";
    }

    // 配额错误
    if (message.includes("quota") || message.includes("billing")) {
      return "quota";
    }

    // 模型不存在
    if (message.includes("model") && message.includes("not found")) {
      return "model_not_found";
    }

    // 上下文过长
    if (
      message.includes("context") ||
      message.includes("token") ||
      message.includes("length")
    ) {
      return "context_length";
    }

    // 内容过滤
    if (message.includes("content") && message.includes("filter")) {
      return "content_filter";
    }

    // Rate limit
    if (message.includes("rate") || message.includes("limit")) {
      return "rate_limit";
    }
  }

  return "unknown";
}

/**
 * 判断错误类型是否可自动重试
 */
export function isAutoRetryable(type: AiErrorType): boolean {
  return ["network", "timeout", "rate_limit"].includes(type);
}

// ===== 默认执行器实现 =====

/**
 * 默认 AI 执行器
 *
 * 封装了：
 * - 流式调用逻辑
 * - 自动重试（带指数退避）
 * - 取消/中断支持
 * - 错误分类
 */
export class DefaultAiExecutor implements AiExecutor {
  private abortController: AbortController | null = null;
  private config: AIConfig;
  private retryConfig: ExecutorRetryConfig;

  constructor(
    config: AIConfig,
    retryConfig: ExecutorRetryConfig = DEFAULT_EXECUTOR_RETRY_CONFIG,
  ) {
    this.config = config;
    this.retryConfig = retryConfig;
  }

  /**
   * 执行 AI 调用
   */
  async execute(context: AiExecutionContext): Promise<AiExecutionResult> {
    // 创建新的 AbortController
    this.abortController = new AbortController();

    // 合并外部 signal
    const signal = context.signal
      ? this.combineSignals(context.signal, this.abortController.signal)
      : this.abortController.signal;

    let retryCount = 0;
    let lastError: unknown = null;

    // 重试循环
    while (retryCount <= this.retryConfig.maxAttempts) {
      // 检查是否已被中止
      if (signal.aborted) {
        return {
          success: false,
          aborted: true,
        };
      }

      try {
        const content = await this.executeOnce(context, signal);
        context.onComplete?.(content);

        return {
          success: true,
          content,
        };
      } catch (error) {
        lastError = error;

        // 如果是中止错误，直接返回
        if (this.isAbortError(error)) {
          return {
            success: false,
            aborted: true,
          };
        }

        // 获取错误类型
        const errorType = this.getErrorType(error);

        // 如果不可重试或已达最大重试次数
        if (
          !isAutoRetryable(errorType) ||
          retryCount >= this.retryConfig.maxAttempts
        ) {
          return {
            success: false,
            error: {
              type: errorType,
              message: error instanceof Error ? error.message : String(error),
              retryCount,
            },
          };
        }

        // 通知重试
        retryCount++;
        context.onRetry?.(retryCount, this.retryConfig.maxAttempts, error);

        // 等待后重试
        const delayMs = this.getRetryDelay(retryCount - 1, error);
        await this.delayWithAbort(delayMs, signal);
      }
    }

    // 不应该到达这里
    return {
      success: false,
      error: {
        type: this.getErrorType(lastError),
        message:
          lastError instanceof Error ? lastError.message : String(lastError),
        retryCount,
      },
    };
  }

  /**
   * 执行单次 AI 调用
   */
  private async executeOnce(
    context: AiExecutionContext,
    signal: AbortSignal,
  ): Promise<string> {
    let content = "";

    // 使用预设系统组装消息
    const messages = messageAssembler.assemble(
      context.preset,
      context.variableContext,
    );

    // 追加额外消息（如当前回合用户输入）
    if (context.appendMessages?.length) {
      messages.push(...context.appendMessages);
    }

    // 使用 aiManager 的流式接口
    const stream = aiManager.chatStream(this.config, messages);

    for await (const chunk of stream) {
      // 检查中止
      if (signal.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }

      content += chunk;
      context.onChunk?.(chunk);
    }

    return content;
  }

  /**
   * 中止当前调用
   */
  abort(): void {
    this.abortController?.abort();
    this.abortController = null;
  }

  /**
   * 合并多个 AbortSignal
   */
  private combineSignals(...signals: AbortSignal[]): AbortSignal {
    const controller = new AbortController();

    for (const signal of signals) {
      if (signal.aborted) {
        controller.abort();
        break;
      }
      signal.addEventListener("abort", () => controller.abort(), {
        once: true,
      });
    }

    return controller.signal;
  }

  /**
   * 判断是否为中止错误
   */
  private isAbortError(error: unknown): boolean {
    return (
      error instanceof DOMException &&
      (error.name === "AbortError" || error.message === "Aborted")
    );
  }

  /**
   * 获取错误类型
   */
  private getErrorType(error: unknown): AiErrorType {
    // 检查是否为 AIError
    if (error && typeof error === "object" && "type" in error) {
      return mapAiErrorType(error as AIError);
    }

    return inferErrorType(error);
  }

  /**
   * 获取重试延迟
   */
  private getRetryDelay(attempt: number, error: unknown): number {
    // Rate limit 错误检查 retry-after
    if (error && typeof error === "object" && "type" in error) {
      const aiError = error as AIError;
      if (aiError.type === "rate_limit" && "retryAfter" in aiError) {
        const retryAfter = (aiError as unknown as { retryAfter: number })
          .retryAfter;
        if (retryAfter && retryAfter <= this.retryConfig.maxRateLimitWait) {
          return retryAfter;
        }
      }
    }

    // 使用指数退避
    return (
      this.retryConfig.delays[attempt] ||
      this.retryConfig.delays[this.retryConfig.delays.length - 1]
    );
  }

  /**
   * 带中止的延迟
   */
  private async delayWithAbort(ms: number, signal: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      if (signal.aborted) {
        reject(new DOMException("Aborted", "AbortError"));
        return;
      }

      const timer = setTimeout(resolve, ms);

      signal.addEventListener(
        "abort",
        () => {
          clearTimeout(timer);
          reject(new DOMException("Aborted", "AbortError"));
        },
        { once: true },
      );
    });
  }
}

// ===== 工厂函数 =====

/**
 * 创建 AI 执行器
 */
export function createAiExecutor(
  config: AIConfig,
  retryConfig?: Partial<ExecutorRetryConfig>,
): AiExecutor {
  return new DefaultAiExecutor(config, {
    ...DEFAULT_EXECUTOR_RETRY_CONFIG,
    ...retryConfig,
  });
}
