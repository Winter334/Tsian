import { postProcess, postProcessForRender } from "@/lib/post-process";
import { BUILTIN_RULES } from "@/lib/post-process/builtin-rules";
import { mergeRules } from "@/lib/post-process/merge";
import type { PostProcessRule } from "@/lib/post-process/types";
import { useFeatureFlagStore } from "@/stores/feature-flags";

/**
 * 游戏内容解析器
 * 解析 AI 输出中的结构化内容（如 <choices> 标签）
 */

export interface ParsedContent {
  /** 叙事文本（移除标签后） */
  narrative: string;
  /** 选项列表 */
  choices: string[];
}

/**
 * 解析游戏内容
 * 从 AI 输出中提取叙事文本和结构化内容
 */
export function parseGameContent(
  content: string,
  presetRules?: PostProcessRule[],
): ParsedContent {
  const useUnifiedPostProcess =
    useFeatureFlagStore.getState().USE_UNIFIED_POSTPROCESS;

  const result = useUnifiedPostProcess
    ? postProcess({
        rawText: content,
        phase: "render",
        rules: mergeRules(BUILTIN_RULES, presetRules),
      })
    : postProcessForRender(content, presetRules);

  // 从 extracted 中获取 choices
  const choicesRaw = result.extracted["choices"];
  const choices = choicesRaw
    ? choicesRaw.flatMap((block) =>
        block
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean),
      )
    : [];

  return {
    narrative: result.text,
    choices,
  };
}
