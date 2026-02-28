import type { AgentDescriptor } from "@/core/pipeline";
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
    const resultFrame = bb.resultFrame;
    if (!resultFrame) {
      throw new Error("Narrator Agent 缺少 resultFrame");
    }

    const entityAccessor = bb.entityAccessor as MapEntityAccessor | undefined;
    if (!entityAccessor) {
      throw new Error("Narrator Agent 缺少 entityAccessor");
    }

    const aliasMap = bb.aliasMap;
    if (!aliasMap) {
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

    const narrativeContext: VariableContext = {
      ...bb.baseVariableContext,
      worldConfig: bb.worldConfig,
      archiveData,
      resultFrame,
      gameState: buildGameStateSnapshot(entityAccessor, aliasMap),
      entityEffects: buildEntityEffects(entityAccessor, aliasMap),
      entityDisplayNames: aliasMap.displayNames,
      inventoryData: narrativeInventoryData,
      narrativeHints: bb.narrativeHints,
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
      throw new Error(
        `叙事 AI 调用失败: ${narrativeResult.error?.message ?? "未知错误"}`,
      );
    }

    bb.narrativeText = narrativeText;
  },
};
