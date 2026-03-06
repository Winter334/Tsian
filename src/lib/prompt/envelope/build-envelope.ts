import type { ContextEnvelope } from "@/domain/types/envelope";
import { BUILTIN_RULE_IDS, EXTRACT_TAG_PATHS } from "@/lib/prompt/constants";
import { usePresetStore as usePromptStore } from "@/lib/prompt/store";
import type { MemoryMarkerConfig } from "@/modules/memory/memory-injector";
import { EnvelopeBuilder } from "./builder";

type AIMessage = ContextEnvelope["history"]["messages"][number];

interface BuildEnvelopeData {
  chatHistory: AIMessage[];
  historyTotal?: number;
  historyLimit?: number;
  userInput: string;
  turnNumber: number;
  sessionId?: string;
  roomId?: string;
  memoryData?: {
    recentNarratives: Array<{ id: string; content: string }>;
    miniSummaries: Array<{ id: string; content: string }>;
    megaSummaries: Array<{ id: string; content: string }>;
  };
  memoryConfig?: MemoryMarkerConfig;
  plotDirectives?: string;
  narrativeHints?: string;
}

export function buildEnvelope(
  mode: "solo" | "multiplayer",
  data: BuildEnvelopeData,
): ContextEnvelope {
  const activeByPurpose = usePromptStore.getState().activePresetByPurpose;
  const historyTotal = data.historyTotal ?? data.chatHistory.length;
  const startIndex = historyTotal - data.chatHistory.length;

  const historyWindow: ContextEnvelope["history"]["window"] = {
    limit: data.historyLimit ?? data.chatHistory.length,
    total: historyTotal,
    startIndex,
    endIndex: historyTotal - 1,
    truncated: startIndex > 0,
  };

  const builder = new EnvelopeBuilder()
    .setSession({
      mode,
      sessionId: data.sessionId,
      roomId: data.roomId,
    })
    .setTurn({
      number: data.turnNumber,
      userInput: data.userInput,
      submittedAt: Date.now(),
    })
    .setPresets({
      activeByPurpose,
    })
    .setHistory(data.chatHistory, historyWindow)
    .setPostProcess({
      builtinRuleIds: Object.values(BUILTIN_RULE_IDS),
    })
    .setIoContract({
      tags: {
        memorySummary: EXTRACT_TAG_PATHS.MEMORY_SUMMARY,
        choices: EXTRACT_TAG_PATHS.CHOICES,
      },
    })
    .setCompatibility({
      legacyTags: true,
    });

  if (data.memoryData || data.memoryConfig) {
    const memoryConfig:
      | NonNullable<ContextEnvelope["memory"]>["config"]
      | undefined = data.memoryConfig
      ? {
          recentNarrativeCount: data.memoryConfig.recentNarrativeCount,
          miniSummaryCount: data.memoryConfig.miniSummaryCount,
          megaSummaryMode: data.memoryConfig.megaSummaryMode,
          megaSummaryLimit: data.memoryConfig.megaSummaryLimit,
          compressionThreshold: data.memoryConfig.compressionThreshold,
        }
      : undefined;

    builder.setMemory({
      segments: data.memoryData,
      config: memoryConfig,
    });
  }

  if (data.plotDirectives || data.narrativeHints) {
    builder.setDirectives({
      plotDirectives: data.plotDirectives,
      narrativeHints: data.narrativeHints,
    });
  }

  return builder.build();
}
