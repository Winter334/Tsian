import { useCallback, useState } from "react";

import { aiManager, resolveAIConfig, type Message } from "@/lib/ai";
import { usePresetStore } from "@/lib/prompt";
import { useSettingsStore } from "@/stores/settings";

export interface UseMemoryCompressionResult {
  compressText: (text: string) => Promise<string>;
  isCompressing: boolean;
  error: string | null;
}

function buildCompressionPrompt(selectedText: string): string {
  return `你是一个叙事摘要专家。请将以下文本压缩为简洁的记忆条目，保留关键信息：
- 重要事件和行动
- 涉及的角色和关系
- 地点和时间信息
- 状态变化

原始文本：
${selectedText}

请输出简洁的摘要（3-5行）。`;
}

const FALLBACK_SYSTEM_PROMPT =
  "你是一个精准、克制的剧情摘要助手，输出应简洁、清晰、可用于后续记忆检索。";

export function useMemoryCompression(): UseMemoryCompressionResult {
  const [isCompressing, setIsCompressing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const compressText = useCallback(async (text: string): Promise<string> => {
    const selectedText = text.trim();
    if (!selectedText) {
      return "";
    }

    setIsCompressing(true);
    setError(null);

    try {
      const summarizerPreset = await usePresetStore
        .getState()
        .getPresetForPurpose("summarizer");

      if (!summarizerPreset) {
        throw new Error("未找到 Summarizer 预设，请先在设置中配置。");
      }

      const profile = useSettingsStore
        .getState()
        .getProfileOrFallback(summarizerPreset.aiProfileId);
      const config = resolveAIConfig(profile, summarizerPreset.aiSettings);

      const presetSystemPrompt = summarizerPreset.blocks[0]?.content?.trim();
      const messages: Message[] = [
        {
          role: "system",
          content: presetSystemPrompt || FALLBACK_SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: buildCompressionPrompt(selectedText),
        },
      ];

      const response = await aiManager.chat(config, messages);
      const compressed = response.content.trim();

      if (!compressed) {
        throw new Error("AI 返回空内容，请稍后重试。");
      }

      return compressed;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "记忆压缩失败，请稍后重试。";
      setError(message);
      throw new Error(message);
    } finally {
      setIsCompressing(false);
    }
  }, []);

  return {
    compressText,
    isCompressing,
    error,
  };
}
