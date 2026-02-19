/**
 * AI 模块导出
 */

// 从 types.ts 导出所有类型和值
export {
  // 值
  AIError,
  DEFAULT_ADVANCED_SETTINGS,
  getProviderPreset,
  PROVIDER_PRESETS,
  type AdvancedSettings,
  type AIConfig,
  type AIErrorType,
  type AiErrorType,
  type AIProfile, // 扩展类型（2.4 新增）
  type AIProvider,
  type ChatRequest,
  type ChatResponse,
  // 类型
  type ExportedAIProfile,
  type Message,
  type MessageRole,
  type ModelInfo,
  type ProviderConfig,
  type ProviderPreset,
  type ProviderType,
} from "./types";

// 从 retry.ts 导出
export {
  DEFAULT_RETRY_CONFIG,
  getErrorTypeFromStatus,
  isRetryable,
  withRetry,
  withRetryStream,
  type RetryConfig,
} from "./retry";

// 从 providers 导出
export { getProvider } from "./providers";
export { geminiProvider } from "./providers/gemini";
export { deepseekProvider, openaiProvider } from "./providers/openai";

// 从 manager.ts 导出
export { AIManager, aiManager, type AIManagerConfig } from "./manager";

// 从 resolve-config.ts 导出
export { resolveAIConfig } from "./resolve-config";

// 从 executor.ts 导出（2.4 新增）
export {
  createAiExecutor,
  DEFAULT_EXECUTOR_RETRY_CONFIG,
  DefaultAiExecutor,
  isAutoRetryable,
  type AiExecutionContext,
  type AiExecutionResult,
  type AiExecutor,
  type ExecutorRetryConfig,
} from "./executor";
