import { commandBus } from "@/core";
import type { AgentDescriptor } from "@/core/pipeline";
import { MemoryCommands } from "@/domain/commands";
import type { PipelineBlackboard } from "@/domain/types";
import { postProcess, postProcessForPersist } from "@/lib/post-process";
import { BUILTIN_RULES } from "@/lib/post-process/builtin-rules";
import { mergeRules } from "@/lib/post-process/merge";
import { useFeatureFlagStore } from "@/stores/feature-flags";

export const postProcessorAgent: AgentDescriptor<PipelineBlackboard> = {
  id: "post-processor",
  name: "后处理器",
  requires: ["narrativeText"],
  produces: ["cleanNarrative", "miniSummary"],
  optional: false,
  execute: async (bb) => {
    const narrativeText = bb.narrativeText;
    if (narrativeText === undefined) {
      throw new Error("PostProcessor Agent 缺少 narrativeText");
    }

    let completionText = narrativeText;

    try {
      const useUnifiedPostProcess =
        useFeatureFlagStore.getState().USE_UNIFIED_POSTPROCESS;

      const postProcessResult = useUnifiedPostProcess
        ? postProcess({
            rawText: narrativeText,
            phase: "persist",
            rules: mergeRules(
              BUILTIN_RULES,
              bb.presets.narrative.postProcessRules,
            ),
          })
        : postProcessForPersist(
            narrativeText,
            bb.presets.narrative.postProcessRules,
          );

      bb.cleanNarrative = postProcessResult.text;
      completionText = postProcessResult.text;

      const miniSummaryContent =
        postProcessResult.extracted["miniSummary"]?.join("\n");

      if (miniSummaryContent) {
        bb.miniSummary = miniSummaryContent;

        const messageLocation = bb.messageLocation;
        if (
          messageLocation &&
          typeof messageLocation.messageIndex === "number" &&
          Number.isFinite(messageLocation.messageIndex)
        ) {
          const dispatchResult = await commandBus.dispatch({
            type: MemoryCommands.ADD_MINI_SUMMARY,
            payload: {
              conversationId: messageLocation.conversationId,
              messageId: messageLocation.messageId,
              messageIndex: messageLocation.messageIndex,
              content: miniSummaryContent,
            },
          });

          if (!dispatchResult.success) {
            console.warn(
              `[IRNR Pipeline] 写入小总结失败: ${dispatchResult.error ?? "未知错误"}`,
            );
          }
        } else {
          console.warn(
            "[IRNR Pipeline] 检测到 memory_summary，但缺少会话上下文，跳过写入。",
          );
        }
      }

      if (postProcessResult.warnings.length > 0) {
        console.warn("[IRNR Pipeline] 后处理警告:", postProcessResult.warnings);
      }
    } catch (error) {
      console.warn(
        "[IRNR Pipeline] Narrative 后处理失败，已跳过小总结提取:",
        error instanceof Error ? error.message : error,
      );
    }

    bb.callbacks.onNarrativeComplete?.(completionText);
  },
};
