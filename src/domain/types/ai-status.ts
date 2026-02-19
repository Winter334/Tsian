/**
 * AI 状态相关领域类型定义
 *
 * 从 core/yjs/room/types.ts 迁移至 domain 层，
 * 供 domain/events、core/yjs、lib/ai 等模块共享使用。
 */

/**
 * AI 处理状态枚举
 */
export type AiStatus =
  | "idle" // 空闲，未开始
  | "processing" // 正在处理
  | "retrying" // 正在重试
  | "completed" // 完成
  | "failed" // 失败
  | "aborted"; // 已中断

/**
 * AI 错误类型
 */
export type AiErrorType =
  | "network" // 网络超时/断开
  | "timeout" // 请求超时
  | "rate_limit" // 请求频率限制
  | "auth" // API Key 无效
  | "quota" // 配额用尽
  | "model_not_found" // 模型不存在
  | "context_length" // 上下文过长
  | "content_filter" // 内容被过滤
  | "unknown"; // 未知错误

/**
 * AI 错误信息
 */
export interface AiError {
  /** 错误类型 */
  type: AiErrorType;
  /** 错误消息 */
  message: string;
  /** 重试次数 */
  retryCount: number;
  /** 下次重试等待时间（毫秒，用于 rate_limit） */
  retryAfter?: number;
}

/**
 * AI 中断原因
 */
export type AiAbortReason =
  | "host_cancel" // Host 主动取消
  | "host_offline" // Host 离线
  | "regenerate"; // 重新生成

/**
 * AI 中断信息
 */
export interface AiAborted {
  /** 中断时间 */
  abortedAt: number;
  /** 中断原因 */
  reason: AiAbortReason;
}
