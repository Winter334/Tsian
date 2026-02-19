/**
 * AI 提供商导出
 */

export { geminiProvider } from "./gemini";
export { deepseekProvider, openaiProvider } from "./openai";

import { AIProvider, ProviderType } from "../types";
import { geminiProvider } from "./gemini";
import { deepseekProvider, openaiProvider } from "./openai";

/**
 * 提供商映射
 */
const providers: Record<ProviderType, AIProvider> = {
  openai: openaiProvider,
  deepseek: deepseekProvider,
  gemini: geminiProvider,
};

/**
 * 获取提供商
 */
export function getProvider(type: ProviderType): AIProvider {
  const provider = providers[type];
  if (!provider) {
    throw new Error(`Unknown provider: ${type}`);
  }
  return provider;
}
