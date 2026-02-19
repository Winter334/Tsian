/**
 * AI 模块类型定义
 */

import type { AiErrorType } from "@/domain/types/ai-status";

export type { AiErrorType };

/**
 * 消息角色
 */
export type MessageRole = "system" | "user" | "assistant";

/**
 * 聊天消息
 */
export interface Message {
  role: MessageRole;
  content: string;
}

/**
 * 提供商类型
 */
export type ProviderType = "openai" | "deepseek" | "gemini";

/**
 * 提供商配置
 */
export interface ProviderConfig {
  provider: ProviderType;
  baseUrl: string;
  apiKey: string;
  model: string;
}

/**
 * 高级设置
 */
export interface AdvancedSettings {
  /** 是否流式输出 */
  stream: boolean;
  /** 温度 0-2 */
  temperature: number;
  /** 最大输出 Token */
  maxTokens: number;
  /** 上下文长度 */
  contextLength: number;
  /** Top P 0-1 */
  topP: number;
  /** 频率惩罚 0-2 */
  frequencyPenalty: number;
  /** 存在惩罚 0-2 */
  presencePenalty: number;
}

/**
 * 完整 AI 配置
 */
export interface AIConfig extends ProviderConfig {
  advanced: AdvancedSettings;
}

/**
 * 聊天请求参数
 */
export interface ChatRequest {
  messages: Message[];
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stream?: boolean;
}

/**
 * 聊天响应
 */
export interface ChatResponse {
  id: string;
  content: string;
  finishReason: string;
}

/**
 * 模型信息
 */
export interface ModelInfo {
  id: string;
  name?: string;
  contextLength?: number;
}

/**
 * AI 提供商接口
 */
export interface AIProvider {
  /** 提供商标识 */
  readonly id: ProviderType;
  /** 提供商名称 */
  readonly name: string;

  /**
   * 非流式聊天
   */
  chat(config: ProviderConfig, request: ChatRequest): Promise<ChatResponse>;

  /**
   * 流式聊天
   */
  chatStream(
    config: ProviderConfig,
    request: ChatRequest,
  ): AsyncGenerator<string, void, unknown>;

  /**
   * 获取可用模型列表
   */
  fetchModels(config: ProviderConfig): Promise<ModelInfo[]>;

  /**
   * 测试连接
   */
  testConnection(config: ProviderConfig): Promise<boolean>;
}

/**
 * AI 错误类型（基础类型，用于 AI 模块内部）
 */
export type AIErrorType =
  | "network"
  | "unauthorized"
  | "rate_limit"
  | "server_error"
  | "timeout"
  | "unknown";

// AiErrorType 已迁移至 @/domain/types/ai-status，通过顶部 import/re-export 保持向后兼容

/**
 * AI 错误
 */
export class AIError extends Error {
  constructor(
    public readonly type: AIErrorType,
    public readonly status?: number,
    message?: string,
  ) {
    super(message || AIError.getDefaultMessage(type));
    this.name = "AIError";
  }

  static getDefaultMessage(type: AIErrorType): string {
    switch (type) {
      case "network":
        return "网络连接失败";
      case "unauthorized":
        return "API Key 无效";
      case "rate_limit":
        return "请求过于频繁";
      case "server_error":
        return "服务暂时不可用";
      case "timeout":
        return "请求超时";
      default:
        return "未知错误";
    }
  }

  /**
   * 是否可重试
   */
  get retryable(): boolean {
    return ["network", "rate_limit", "server_error", "timeout"].includes(
      this.type,
    );
  }
}

/**
 * 提供商预设配置
 */
export interface ProviderPreset {
  id: ProviderType;
  name: string;
  baseUrl: string;
  defaultModel: string;
  supportsModelFetch: boolean;
}

/**
 * 预设提供商列表
 */
export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    id: "openai",
    name: "OpenAI",
    baseUrl: "https://api.openai.com",
    defaultModel: "gpt-4o-mini",
    supportsModelFetch: true,
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    baseUrl: "https://api.deepseek.com",
    defaultModel: "deepseek-chat",
    supportsModelFetch: true,
  },
  {
    id: "gemini",
    name: "Google Gemini",
    baseUrl: "https://generativelanguage.googleapis.com",
    defaultModel: "gemini-2.0-flash",
    supportsModelFetch: true,
  },
];

/**
 * 默认高级设置
 */
export const DEFAULT_ADVANCED_SETTINGS: AdvancedSettings = {
  stream: true,
  temperature: 0.7,
  maxTokens: 4096,
  contextLength: 128000,
  topP: 1.0,
  frequencyPenalty: 0,
  presencePenalty: 0,
};

/**
 * 获取提供商预设
 */
export function getProviderPreset(
  provider: ProviderType,
): ProviderPreset | undefined {
  return PROVIDER_PRESETS.find((p) => p.id === provider);
}

/**
 * AI 配置档案
 *
 * 一个完整的、命名的 AI 配置单元，包含连接信息和高级参数。
 * 用户可创建多个 Profile 并在不同预设间切换。
 *
 * 注：当前项目依赖中未包含 nanoid，创建 Profile 时需在实现侧引入并生成 id。
 */
export interface AIProfile {
  /** 唯一标识符（nanoid） */
  id: string;

  /** 显示名称（如 "GPT-4o 创作"、"DeepSeek 日常"） */
  name: string;

  /** 提供商类型 */
  provider: ProviderType;

  /** API 基础 URL */
  baseUrl: string;

  /** API 密钥 */
  apiKey: string;

  /** 模型名称 */
  model: string;

  /** 高级参数 */
  advanced: AdvancedSettings;

  /** 创建时间 */
  createdAt: number;

  /** 更新时间 */
  updatedAt: number;
}

/**
 * 导出格式中的 AI Profile（剥离连接敏感信息）
 *
 * 导出预设时嵌入此结构，仅保留名称和高级参数。
 * 导入后用户需自行配置 provider/baseUrl/apiKey/model。
 */
export interface ExportedAIProfile {
  /** Profile 名称 */
  name: string;

  /** 高级参数 */
  advanced: AdvancedSettings;
}
