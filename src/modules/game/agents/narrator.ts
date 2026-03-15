import type { AgentDescriptor } from "@/core/pipeline";
import {
  WARNING_CODES,
  type WarningRecord,
} from "@/domain/constants/warning-codes";
import type { PipelineBlackboard } from "@/domain/types";
import { createAiExecutor } from "@/lib/ai/executor";
import type { VariableContext } from "@/lib/prompt/types";
import type { MapEntityAccessor } from "@/modules/game/services/entity-accessor";
import {
  buildEntityEffects,
  buildGameStateSnapshot,
  buildInventoryData,
} from "@/modules/game/services/pipeline-helpers";
import { computeArchiveData } from "@/modules/world-archive";

export const narratorAgent: AgentDescriptor<PipelineBlackboard> = {
  id: "narrator",
  name: "叙事AI",
  requires: ["resultFrame", "entityAccessor", "aliasMap"],
  produces: ["narrativeText"],
  execute: async (bb) => {
    const pushWarning = (warning: WarningRecord): void => {
      bb.warnings ??= [];
      bb.warnings.push(warning);
    };

    const resultFrame = bb.resultFrame;
    if (!resultFrame) {
      pushWarning({
        code: WARNING_CODES.NARRATOR_MISSING_RESULT_FRAME,
        message: "Narrator Agent 缺少 resultFrame",
        stage: "narrator",
        timestamp: Date.now(),
      });
      throw new Error("Narrator Agent 缺少 resultFrame");
    }

    const entityAccessor = bb.entityAccessor as MapEntityAccessor | undefined;
    if (!entityAccessor) {
      pushWarning({
        code: WARNING_CODES.NARRATOR_MISSING_ACCESSOR,
        message: "Narrator Agent 缺少 entityAccessor",
        stage: "narrator",
        timestamp: Date.now(),
      });
      throw new Error("Narrator Agent 缺少 entityAccessor");
    }

    const aliasMap = bb.aliasMap;
    if (!aliasMap) {
      pushWarning({
        code: WARNING_CODES.NARRATOR_MISSING_ALIAS_MAP,
        message: "Narrator Agent 缺少 aliasMap",
        stage: "narrator",
        timestamp: Date.now(),
      });
      throw new Error("Narrator Agent 缺少 aliasMap");
    }

    const narrativeExecutor = createAiExecutor(bb.aiConfig);

    const narrativeInventoryData = buildInventoryData(entityAccessor, aliasMap);
    const archiveData: VariableContext["archiveData"] = bb.archiveSnapshot
      ? {
          active: bb.archiveSnapshot.active,
          nearby: bb.archiveSnapshot.nearby,
        }
      : computeArchiveData();

    const turnNarrativeIntent =
      bb.envelope?.directives?.turnNarrativeIntent ?? bb.turnNarrativeIntent;
    const narrativeHints =
      bb.envelope?.directives?.narrativeHints ?? bb.narrativeHints;

    const narrativeContext: VariableContext = {
      ...bb.baseVariableContext,
      worldConfig: bb.worldConfig,
      archiveData,
      resultFrame,
      gameState: buildGameStateSnapshot(entityAccessor, aliasMap),
      entityEffects: buildEntityEffects(entityAccessor, aliasMap),
      entityDisplayNames: aliasMap.displayNames,
      inventoryData: narrativeInventoryData,
      turnNarrativeIntent,
      narrativeHints,
    };

    let narrativeText = "";
    const narrativeResult = await narrativeExecutor.execute({
      preset: bb.presets.narrative,
      variableContext: narrativeContext,
      onChunk: (chunk) => {
        narrativeText += chunk;
        bb.callbacks.onNarrativeChunk?.(chunk);
      },
      onComplete: (text) => {
        narrativeText = text;
      },
    });

    if (!narrativeResult.success) {
      const message = `叙事 AI 调用失败: ${narrativeResult.error?.message ?? "未知错误"}`;
      pushWarning({
        code: WARNING_CODES.NARRATOR_AI_CALL_FAILED,
        message,
        stage: "narrator",
        details: {
          error: narrativeResult.error?.message ?? "未知错误",
        },
        timestamp: Date.now(),
      });
      throw new Error(message);
    }

    bb._agentRawOutputs ??= {};
    bb._agentRawOutputs.narrator = narrativeText;
    bb.narrativeText = narrativeText;
  },
};
