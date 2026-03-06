import { useCallback, useState } from "react";

import { createAiExecutor, resolveAIConfig } from "@/lib/ai";
import {
  messageAssembler,
  usePresetStore,
  type VariableContext,
} from "@/lib/prompt";
import { useSettingsStore } from "@/stores/settings";

export interface UseMemoryCompressionResult {
  compressText: (text: string) => Promise<string>;
  isCompressing: boolean;
  error: string | null;
}

function buildCompressionVariableContext(
  selectedText: string,
): VariableContext {
  return {
    mode: "solo",
    user: { name: "Summarizer" },
    chatHistory: [],
    userInput: selectedText,
  };
}

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
      const variableContext = buildCompressionVariableContext(selectedText);
      const assembledMessages = messageAssembler.assemble(
        summarizerPreset,
        variableContext,
      );
      const hasUserMessage = assembledMessages.some(
        (message) =>
          message.role === "user" && message.content.trim().length > 0,
      );

      if (!hasUserMessage) {
        throw new Error(
          "Summarizer 预设未组装出有效用户消息，请检查 Marker 配置。",
        );
      }

      const executor = createAiExecutor(config);
      const result = await executor.execute({
        preset: summarizerPreset,
        variableContext,
      });

      if (result.aborted) {
        throw new Error("记忆压缩已中止，请稍后重试。");
      }

      if (!result.success) {
        throw new Error(result.error?.message ?? "记忆压缩失败，请稍后重试。");
      }

      const compressed = result.content?.trim() ?? "";

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
