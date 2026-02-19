/**
 * OpenAI 适配器
 * 同时支持 OpenAI 和 DeepSeek（OpenAI 兼容 API）
 */

import { getErrorTypeFromStatus } from "../retry";
import {
  AIError,
  AIProvider,
  ChatRequest,
  ChatResponse,
  ModelInfo,
  ProviderConfig,
} from "../types";

/**
 * OpenAI API 消息格式
 */
interface OpenAIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * OpenAI API 请求格式
 */
interface OpenAIRequest {
  model: string;
  messages: OpenAIMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stream?: boolean;
}

/**
 * OpenAI API 响应格式
 */
interface OpenAIResponse {
  id: string;
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
}

/**
 * OpenAI 模型列表响应
 */
interface OpenAIModelsResponse {
  data: Array<{
    id: string;
    owned_by?: string;
  }>;
}

/**
 * 创建请求头
 */
function createHeaders(apiKey: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };
}

/**
 * 处理响应错误
 */
async function handleResponseError(response: Response): Promise<never> {
  const type = getErrorTypeFromStatus(response.status);
  let message = `${response.status} ${response.statusText}`;

  try {
    const data = await response.json();
    if (data.error?.message) {
      message = data.error.message;
    }
  } catch {
    // 忽略解析错误
  }

  throw new AIError(type, response.status, message);
}

/**
 * OpenAI 提供商实现
 */
export const openaiProvider: AIProvider = {
  id: "openai",
  name: "OpenAI",

  async chat(
    config: ProviderConfig,
    request: ChatRequest
  ): Promise<ChatResponse> {
    const body: OpenAIRequest = {
      model: config.model,
      messages: request.messages,
      temperature: request.temperature,
      max_tokens: request.maxTokens,
      top_p: request.topP,
      frequency_penalty: request.frequencyPenalty,
      presence_penalty: request.presencePenalty,
      stream: false,
    };

    let response: Response;
    try {
      response = await fetch(`${config.baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: createHeaders(config.apiKey),
        body: JSON.stringify(body),
      });
    } catch (error) {
      throw new AIError("network", undefined, (error as Error).message);
    }

    if (!response.ok) {
      await handleResponseError(response);
    }

    const data: OpenAIResponse = await response.json();
    const choice = data.choices[0];

    return {
      id: data.id,
      content: choice?.message?.content || "",
      finishReason: choice?.finish_reason || "stop",
    };
  },

  async *chatStream(
    config: ProviderConfig,
    request: ChatRequest
  ): AsyncGenerator<string, void, unknown> {
    const body: OpenAIRequest = {
      model: config.model,
      messages: request.messages,
      temperature: request.temperature,
      max_tokens: request.maxTokens,
      top_p: request.topP,
      frequency_penalty: request.frequencyPenalty,
      presence_penalty: request.presencePenalty,
      stream: true,
    };

    let response: Response;
    try {
      response = await fetch(`${config.baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: createHeaders(config.apiKey),
        body: JSON.stringify(body),
      });
    } catch (error) {
      throw new AIError("network", undefined, (error as Error).message);
    }

    if (!response.ok) {
      await handleResponseError(response);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new AIError("network", undefined, "No response body");
    }

    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === "data: [DONE]") continue;
          if (!trimmed.startsWith("data: ")) continue;

          try {
            const data = JSON.parse(trimmed.slice(6));
            const content = data.choices?.[0]?.delta?.content;
            if (content) {
              yield content;
            }
          } catch {
            // 忽略解析错误
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  },

  async fetchModels(config: ProviderConfig): Promise<ModelInfo[]> {
    let response: Response;
    try {
      response = await fetch(`${config.baseUrl}/v1/models`, {
        method: "GET",
        headers: createHeaders(config.apiKey),
      });
    } catch (error) {
      throw new AIError("network", undefined, (error as Error).message);
    }

    if (!response.ok) {
      await handleResponseError(response);
    }

    const data: OpenAIModelsResponse = await response.json();

    // 过滤聊天模型
    const chatModels = data.data.filter((m) => {
      const id = m.id.toLowerCase();
      // 过滤掉非聊天模型
      if (
        id.includes("embedding") ||
        id.includes("whisper") ||
        id.includes("tts") ||
        id.includes("dall-e")
      ) {
        return false;
      }
      return true;
    });

    return chatModels.map((m) => ({
      id: m.id,
      name: m.id,
    }));
  },

  async testConnection(config: ProviderConfig): Promise<boolean> {
    try {
      await this.fetchModels(config);
      return true;
    } catch {
      return false;
    }
  },
};

/**
 * DeepSeek 提供商（使用 OpenAI 兼容 API）
 */
export const deepseekProvider: AIProvider = {
  ...openaiProvider,
  id: "deepseek",
  name: "DeepSeek",
};
