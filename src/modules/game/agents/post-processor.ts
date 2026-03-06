import { commandBus } from "@/core";
import type { AgentDescriptor } from "@/core/pipeline";
import { MemoryCommands } from "@/domain/commands";
import {
  WARNING_CODES,
  type WarningRecord,
} from "@/domain/constants/warning-codes";
import type { PipelineBlackboard } from "@/domain/types";
import { postProcess } from "@/lib/post-process";
import { BUILTIN_RULES } from "@/lib/post-process/builtin-rules";
import { mergeRules } from "@/lib/post-process/merge";

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

    const pushWarning = (warning: WarningRecord): void => {
      bb.warnings ??= [];
      bb.warnings.push(warning);
    };

    let completionText = narrativeText;

    try {
      const postProcessResult = postProcess({
        rawText: narrativeText,
        phase: "persist",
        rules: mergeRules(BUILTIN_RULES, bb.presets.narrative.postProcessRules),
      });

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
            const message = `写入小总结失败: ${dispatchResult.error ?? "未知错误"}`;
            console.warn(`[IRNR Pipeline] ${message}`);
            pushWarning({
              code: WARNING_CODES.POSTPROCESS_MINI_SUMMARY_WRITE_FAILED,
              message,
              stage: "postprocess",
              details: {
                conversationId: messageLocation.conversationId,
                messageId: messageLocation.messageId,
                messageIndex: messageLocation.messageIndex,
                error: dispatchResult.error ?? "未知错误",
              },
              timestamp: Date.now(),
            });
          }
        } else {
          const message = "检测到 memory_summary，但缺少会话上下文，跳过写入。";
          console.warn(`[IRNR Pipeline] ${message}`);
          pushWarning({
            code: WARNING_CODES.POSTPROCESS_MINI_SUMMARY_SKIPPED,
            message,
            stage: "postprocess",
            details: {
              hasMiniSummary: true,
            },
            timestamp: Date.now(),
          });
        }
      }

      if (postProcessResult.warnings.length > 0) {
        postProcessResult.warnings.forEach((message, index) => {
          pushWarning({
            code: WARNING_CODES.POSTPROCESS_RULE_FAILED,
            message,
            stage: "postprocess",
            details: {
              warningIndex: index,
            },
            timestamp: Date.now(),
          });
        });
        console.warn("[IRNR Pipeline] 后处理警告:", postProcessResult.warnings);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.warn(
        "[IRNR Pipeline] Narrative 后处理失败，已跳过小总结提取:",
        errorMessage,
      );
      pushWarning({
        code: WARNING_CODES.POSTPROCESS_FAILED,
        message: `Narrative 后处理失败，已跳过小总结提取: ${errorMessage}`,
        stage: "postprocess",
        details: {
          error: errorMessage,
        },
        timestamp: Date.now(),
      });
    }

    bb.callbacks.onNarrativeComplete?.(completionText);
  },
};
