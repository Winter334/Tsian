/**
 * 重试机制（指数退避）
 */

import { AIError, AIErrorType } from "./types";

/**
 * 重试配置
 */
export interface RetryConfig {
  /** 最大重试次数 */
  maxRetries: number;
  /** 重试延迟（毫秒） */
  delays: number[];
  /** 可重试的状态码 */
  retryableStatus: number[];
}

/**
 * 默认重试配置
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  delays: [1000, 2000, 4000], // 1s, 2s, 4s
  retryableStatus: [408, 429, 500, 502, 503, 504],
};

/**
 * 从 HTTP 状态码推断错误类型
 */
export function getErrorTypeFromStatus(status: number): AIErrorType {
  if (status === 401 || status === 403) {
    return "unauthorized";
  }
  if (status === 429) {
    return "rate_limit";
  }
  if (status >= 500) {
    return "server_error";
  }
  if (status === 408) {
    return "timeout";
  }
  return "unknown";
}

/**
 * 判断是否可重试
 */
export function isRetryable(
  error: unknown,
  _config: RetryConfig = DEFAULT_RETRY_CONFIG
): boolean {
  if (error instanceof AIError) {
    return error.retryable;
  }

  // 网络错误
  if (error instanceof TypeError && error.message.includes("fetch")) {
    return true;
  }

  return false;
}

/**
 * 延迟函数
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 带重试的异步函数执行
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
  onRetry?: (attempt: number, error: unknown) => void
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // 如果不可重试，立即抛出
      if (!isRetryable(error, config)) {
        throw error;
      }

      // 如果已达最大重试次数，抛出
      if (attempt >= config.maxRetries) {
        throw error;
      }

      // 通知重试
      onRetry?.(attempt + 1, error);

      // 等待后重试
      const delayMs =
        config.delays[attempt] || config.delays[config.delays.length - 1];
      await delay(delayMs);
    }
  }

  throw lastError;
}

/**
 * 带重试的流式异步生成器
 */
export async function* withRetryStream<T>(
  fn: () => AsyncGenerator<T, void, unknown>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
  onRetry?: (attempt: number, error: unknown) => void
): AsyncGenerator<T, void, unknown> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      const generator = fn();
      for await (const value of generator) {
        yield value;
      }
      return; // 成功完成
    } catch (error) {
      lastError = error;

      // 如果不可重试，立即抛出
      if (!isRetryable(error, config)) {
        throw error;
      }

      // 如果已达最大重试次数，抛出
      if (attempt >= config.maxRetries) {
        throw error;
      }

      // 通知重试
      onRetry?.(attempt + 1, error);

      // 等待后重试
      const delayMs =
        config.delays[attempt] || config.delays[config.delays.length - 1];
      await delay(delayMs);
    }
  }

  throw lastError;
}
