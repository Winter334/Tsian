import type { PipelineBlackboard } from "@/domain/types";
import type { VariableContext } from "@/lib/prompt/types";
import type { MapEntityAccessor } from "@/modules/game/services/entity-accessor";
import { buildGameStateSnapshot } from "@/modules/game/services/pipeline-helpers";

import { useDirectorStore } from "./store";
import type { Foreshadow, PlotOutline } from "./types";

/**
 * 构建导演 AI 专属的 VariableContext
 *
 * 导演看到的信息比 Parser/Narrator 更多：
 * - 全部非 resolved 的实体（含 dormant 的摘要）
 * - 完整的剧情大纲和伏笔库
 * - 演变日志摘要
 */
export function buildDirectorContext(bb: PipelineBlackboard): VariableContext {
  const directorStore = useDirectorStore.getState();
  const archiveSnapshot = bb.archiveSnapshot;

  const archiveData = archiveSnapshot
    ? {
        active: archiveSnapshot.active,
        nearby: archiveSnapshot.nearby,
      }
    : undefined;

  const context: VariableContext = {
    ...bb.baseVariableContext,
    worldConfig: bb.worldConfig,
    archiveData,
    turn: bb.baseVariableContext.turn ?? {
      number: bb.turnNumber,
      actions: [],
    },
  };

  const entityAccessor = bb.entityAccessor as MapEntityAccessor | undefined;
  if (entityAccessor && bb.aliasMap) {
    context.gameState =
      bb.baseVariableContext.gameState ??
      buildGameStateSnapshot(entityAccessor, bb.aliasMap);
  }

  const dormantSummary =
    archiveSnapshot && archiveSnapshot.dormant.length > 0
      ? archiveSnapshot.dormant
          .map((entity) => {
            const stateSummary =
              entity.currentState.split(/[。！？.!?]/u)[0]?.trim() ?? "";
            const normalizedState =
              stateSummary.length > 0 ? `${stateSummary}。` : "暂无状态摘要。";
            return `- ${entity.name}（${entity.archetype}）：${normalizedState}`;
          })
          .join("\n")
      : "（无）";

  const outlineSummary = directorStore.outline
    ? formatOutlineSummary(directorStore.outline)
    : "（尚无剧情大纲）";

  const foreshadowSummary = formatForeshadowSummary(directorStore.foreshadows);

  const directorExtraContext = [
    "【世界档案状态概览】",
    `Dormant 实体列表：\n${dormantSummary}`,
    "",
    `【剧情大纲】\n${outlineSummary}`,
    "",
    `【伏笔库】\n${foreshadowSummary}`,
  ].join("\n");

  context.userInput = bb.playerInput;
  context.customVariables = {
    ...bb.baseVariableContext.customVariables,
    director_context: directorExtraContext,
    director_dormant_summary: dormantSummary,
    director_outline_summary: outlineSummary,
    director_foreshadow_summary: foreshadowSummary,
  };

  return context;
}

function formatOutlineSummary(outline: PlotOutline): string {
  const parts: string[] = [];
  const arc = outline.currentArc;

  parts.push(`当前弧线：${arc.title}`);
  parts.push(`核心冲突：${arc.premise}`);
  parts.push(`状态：${arc.status}`);

  if (arc.milestones.length > 0) {
    parts.push("里程碑：");
    for (const milestone of arc.milestones) {
      parts.push(`  - [${milestone.status}] ${milestone.description}`);
    }
  }

  if (arc.deviations.length > 0) {
    parts.push(`偏离记录：${arc.deviations.join("；")}`);
  }

  return parts.join("\n");
}

function formatForeshadowSummary(
  foreshadows: Record<string, Foreshadow>,
): string {
  const entries = Object.values(foreshadows).filter((foreshadow) => {
    return (
      foreshadow.status !== "abandoned" && foreshadow.status !== "revealed"
    );
  });

  if (entries.length === 0) {
    return "（无活跃伏笔）";
  }

  return entries
    .map((foreshadow) => {
      return `- [${foreshadow.status}] ${foreshadow.description}（已暗示 ${foreshadow.hintCount} 次）\n  触发条件：${foreshadow.triggerCondition}`;
    })
    .join("\n");
}
