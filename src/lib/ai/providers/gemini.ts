/**
 * Gemini 适配器
 * Google AI Gemini API
 */

import { getErrorTypeFromStatus } from "../retry";
import {
  AIError,
  AIProvider,
  ChatRequest,
  ChatResponse,
  Message,
  ModelInfo,
  ProviderConfig,
} from "../types";

/**
 * Gemini API 内容格式
 */
interface GeminiContent {
  role: "user" | "model";
  parts: Array<{ text: string }>;
}

/**
 * Gemini API 请求格式
 */
interface GeminiRequest {
  contents: GeminiContent[];
  systemInstruction?: {
    parts: Array<{ text: string }>;
  };
  generationConfig?: {
    temperature?: number;
    maxOutputTokens?: number;
    topP?: number;
  };
}

/**
 * Gemini API 响应格式
 */
interface GeminiResponse {
  candidates: Array<{
    content: {
      role: string;
      parts: Array<{ text: string }>;
    };
    finishReason: string;
  }>;
}

/**
 * Gemini 模型列表响应
 */
interface GeminiModelsResponse {
  models: Array<{
    name: string;
    displayName?: string;
    supportedGenerationMethods?: string[];
  }>;
}

/**
 * 转换消息格式
 */
function convertMessages(messages: Message[]): {
  contents: GeminiContent[];
  systemInstruction?: { parts: Array<{ text: string }> };
} {
  const systemMessages = messages.filter((m) => m.role === "system");
  const chatMessages = messages.filter((m) => m.role !== "system");

  // 系统消息作为 systemInstruction
  const systemInstruction =
    systemMessages.length > 0
      ? {
          parts: [{ text: systemMessages.map((m) => m.content).join("\n") }],
        }
      : undefined;

  // 转换聊天消息
  const contents: GeminiContent[] = chatMessages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  return { contents, systemInstruction };
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
 * Gemini 提供商实现
 */
export const geminiProvider: AIProvider = {
  id: "gemini",
  name: "Google Gemini",

  async chat(
    config: ProviderConfig,
    request: ChatRequest
  ): Promise<ChatResponse> {
    const { contents, systemInstruction } = convertMessages(request.messages);

    const body: GeminiRequest = {
      contents,
      systemInstruction,
      generationConfig: {
        temperature: request.temperature,
        maxOutputTokens: request.maxTokens,
        topP: request.topP,
      },
    };

    const url = `${config.baseUrl}/v1beta/models/${config.model}:generateContent?key=${config.apiKey}`;

    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
    } catch (error) {
      throw new AIError("network", undefined, (error as Error).message);
    }

    if (!response.ok) {
      await handleResponseError(response);
    }

    const data: GeminiResponse = await response.json();
    const candidate = data.candidates[0];

    return {
      id: crypto.randomUUID(),
      content: candidate?.content?.parts?.map((p) => p.text).join("") || "",
      finishReason: candidate?.finishReason || "STOP",
    };
  },

  async *chatStream(
    config: ProviderConfig,
    request: ChatRequest
  ): AsyncGenerator<string, void, unknown> {
    const { contents, systemInstruction } = convertMessages(request.messages);

    const body: GeminiRequest = {
      contents,
      systemInstruction,
      generationConfig: {
        temperature: request.temperature,
        maxOutputTokens: request.maxTokens,
        topP: request.topP,
      },
    };

    const url = `${config.baseUrl}/v1beta/models/${config.model}:streamGenerateContent?alt=sse&key=${config.apiKey}`;

    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
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
          if (!trimmed || !trimmed.startsWith("data: ")) continue;

          try {
            const data = JSON.parse(trimmed.slice(6));
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) {
              yield text;
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
    const url = `${config.baseUrl}/v1beta/models?key=${config.apiKey}`;

    let response: Response;
    try {
      response = await fetch(url, {
        method: "GET",
      });
    } catch (error) {
      throw new AIError("network", undefined, (error as Error).message);
    }

    if (!response.ok) {
      await handleResponseError(response);
    }

    const data: GeminiModelsResponse = await response.json();

    // 过滤支持生成内容的模型
    const chatModels = data.models.filter((m) => {
      return m.supportedGenerationMethods?.includes("generateContent");
    });

    return chatModels.map((m) => {
      // 提取模型 ID（去掉 "models/" 前缀）
      const id = m.name.replace("models/", "");
      return {
        id,
        name: m.displayName || id,
      };
    });
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
