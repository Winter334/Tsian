/**
 * AIManager - AI 统一调用管理器
 */

import { getProvider } from "./providers";
import {
  DEFAULT_RETRY_CONFIG,
  RetryConfig,
  withRetry,
  withRetryStream,
} from "./retry";
import {
  AIConfig,
  ChatRequest,
  ChatResponse,
  DEFAULT_ADVANCED_SETTINGS,
  Message,
  ModelInfo,
  ProviderConfig,
} from "./types";

/**
 * AIManager 配置
 */
export interface AIManagerConfig {
  /** 重试配置 */
  retry?: Partial<RetryConfig>;
  /** 重试回调 */
  onRetry?: (attempt: number, error: unknown) => void;
}

/**
 * AIManager 类
 */
export class AIManager {
  private retryConfig: RetryConfig;
  private onRetry?: (attempt: number, error: unknown) => void;

  constructor(config?: AIManagerConfig) {
    this.retryConfig = {
      ...DEFAULT_RETRY_CONFIG,
      ...config?.retry,
    };
    this.onRetry = config?.onRetry;
  }

  /**
   * 创建提供商配置
   */
  private createProviderConfig(config: AIConfig): ProviderConfig {
    return {
      provider: config.provider,
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
      model: config.model,
    };
  }

  /**
   * 创建聊天请求
   */
  private createChatRequest(
    messages: Message[],
    config: AIConfig
  ): ChatRequest {
    const advanced = config.advanced || DEFAULT_ADVANCED_SETTINGS;
    return {
      messages,
      temperature: advanced.temperature,
      maxTokens: advanced.maxTokens,
      topP: advanced.topP,
      frequencyPenalty: advanced.frequencyPenalty,
      presencePenalty: advanced.presencePenalty,
      stream: advanced.stream,
    };
  }

  /**
   * 非流式聊天
   */
  async chat(config: AIConfig, messages: Message[]): Promise<ChatResponse> {
    const provider = getProvider(config.provider);
    const providerConfig = this.createProviderConfig(config);
    const request = this.createChatRequest(messages, config);

    return withRetry(
      () => provider.chat(providerConfig, request),
      this.retryConfig,
      this.onRetry
    );
  }

  /**
   * 流式聊天
   */
  async *chatStream(
    config: AIConfig,
    messages: Message[]
  ): AsyncGenerator<string, void, unknown> {
    const provider = getProvider(config.provider);
    const providerConfig = this.createProviderConfig(config);
    const request = this.createChatRequest(messages, config);

    yield* withRetryStream(
      () => provider.chatStream(providerConfig, request),
      this.retryConfig,
      this.onRetry
    );
  }

  /**
   * 根据配置自动选择流式或非流式
   */
  async chatAuto(
    config: AIConfig,
    messages: Message[],
    onChunk?: (chunk: string) => void
  ): Promise<ChatResponse> {
    const stream = config.advanced?.stream ?? true;

    if (stream && onChunk) {
      let content = "";
      for await (const chunk of this.chatStream(config, messages)) {
        content += chunk;
        onChunk(chunk);
      }
      return {
        id: crypto.randomUUID(),
        content,
        finishReason: "stop",
      };
    } else {
      return this.chat(config, messages);
    }
  }

  /**
   * 获取模型列表
   */
  async fetchModels(config: AIConfig): Promise<ModelInfo[]> {
    const provider = getProvider(config.provider);
    const providerConfig = this.createProviderConfig(config);

    return withRetry(
      () => provider.fetchModels(providerConfig),
      this.retryConfig,
      this.onRetry
    );
  }

  /**
   * 测试连接
   */
  async testConnection(config: AIConfig): Promise<boolean> {
    const provider = getProvider(config.provider);
    const providerConfig = this.createProviderConfig(config);

    try {
      return await provider.testConnection(providerConfig);
    } catch {
      return false;
    }
  }
}

/**
 * 默认 AIManager 实例
 */
export const aiManager = new AIManager();
