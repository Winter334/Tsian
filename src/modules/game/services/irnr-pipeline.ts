/**
 * IRNR 流水线服务
 *
 * 对外提供 runSolo / runMultiplayer 两个入口。
 */

import type { BlackboardInput } from "@/core/pipeline";
import { PipelineError } from "@/core/pipeline";
import type {
  EntityFinalState,
  IrnrPipelineResult,
  IrnrPipelineServiceContract,
  MultiplayerIrnrInput,
  PipelineArchiveSnapshot,
  PipelineBlackboard,
  SoloIrnrInput,
} from "@/domain/types";
import type { ArchiveEntityForContext } from "@/lib/prompt/types";
import { getRuntimeWorldConfig } from "@/lib/world/resolve-config";
import { createGamePipeline } from "@/modules/game/agents";
import { useWorldArchiveStore } from "@/modules/world-archive/store";

// ─── 输入/输出类型（从 domain 层 re-export，保持向后兼容） ───

export type {
  EntityFinalState,
  IrnrPipelineResult,
  IrnrPipelineServiceContract,
  MultiplayerIrnrInput,
  SoloIrnrInput,
};

function toArchiveContextEntity(entity: {
  id: string;
  name: string;
  archetype: string;
  essence: string;
  currentState: string;
  relationships: Array<{
    targetEntityId: string;
    type: string;
    description: string;
  }>;
  tags: string[];
}): ArchiveEntityForContext {
  return {
    id: entity.id,
    name: entity.name,
    archetype: entity.archetype,
    essence: entity.essence,
    currentState: entity.currentState,
    relationships: entity.relationships.map((relationship) => ({
      targetEntityId: relationship.targetEntityId,
      type: relationship.type,
      description: relationship.description,
    })),
    tags: [...entity.tags],
  };
}

function buildArchiveSnapshotFromStore(): PipelineArchiveSnapshot {
  const archiveStore = useWorldArchiveStore.getState();
  return {
    active: archiveStore
      .getEntitiesByPresence("active")
      .map(toArchiveContextEntity),
    nearby: archiveStore
      .getEntitiesByPresence("nearby")
      .map(toArchiveContextEntity),
    dormant: archiveStore
      .getEntitiesByPresence("dormant")
      .map(toArchiveContextEntity),
  };
}

function buildBlackboardInput(
  input: SoloIrnrInput | MultiplayerIrnrInput,
): BlackboardInput<PipelineBlackboard> {
  return {
    commandId: input.commandId,
    playerInput: input.userInput,
    aiConfig: input.aiConfig,
    directorAiConfig: input.directorAiConfig,
    baseVariableContext: input.baseVariableContext,
    entities: input.entities,
    worldConfig: input.worldConfig ?? getRuntimeWorldConfig(),
    actorId: input.actorId ?? "",
    targetId: input.targetId,
    roomId: "roomId" in input ? input.roomId : undefined,
    turnNumber: input.turnNumber ?? input.messageIndex ?? 0,
    archiveSnapshot: input.archiveSnapshot ?? buildArchiveSnapshotFromStore(),
    presets: {
      parser: input.parserPreset,
      narrative: input.narrativePreset,
      director: input.directorPreset,
    },
    callbacks: {
      onNarrativeChunk: input.onNarrativeChunk,
      onNarrativeComplete: input.onNarrativeComplete,
    },
    messageLocation:
      input.conversationId != null &&
      input.messageId != null &&
      input.messageIndex != null
        ? {
            conversationId: input.conversationId,
            messageId: input.messageId,
            messageIndex: input.messageIndex,
          }
        : undefined,
  };
}

function mapBlackboardToResult(bb: PipelineBlackboard): IrnrPipelineResult {
  return {
    success: true,
    ruleScript: bb.ruleScript,
    resultFrame: bb.resultFrame,
    narrativeText: bb.cleanNarrative ?? bb.narrativeText,
    finalEntityStates: bb.finalEntityStates,
    createdNpcs: bb.createdNpcs,
    archiveUpdates: bb.archiveUpdates,
  };
}

function handlePipelineError(error: unknown): IrnrPipelineResult {
  if (error instanceof PipelineError) {
    const bb = error.blackboard as Partial<PipelineBlackboard>;
    return {
      success: false,
      error: error.message,
      ruleScript: bb.ruleScript,
      resultFrame: bb.resultFrame,
    };
  }

  throw error;
}

class IrnrPipelineServiceImpl implements IrnrPipelineServiceContract {
  async runSolo(input: SoloIrnrInput): Promise<IrnrPipelineResult> {
    const pipeline = createGamePipeline();
    const blackboardInput = buildBlackboardInput(input);

    try {
      const bb = await pipeline.execute(blackboardInput);
      return mapBlackboardToResult(bb);
    } catch (error) {
      return handlePipelineError(error);
    }
  }

  async runMultiplayer(
    input: MultiplayerIrnrInput,
  ): Promise<IrnrPipelineResult> {
    const pipeline = createGamePipeline();
    const blackboardInput = buildBlackboardInput(input);

    try {
      const bb = await pipeline.execute(blackboardInput);
      return mapBlackboardToResult(bb);
    } catch (error) {
      return handlePipelineError(error);
    }
  }
}

export const irnrPipelineService: IrnrPipelineServiceContract =
  new IrnrPipelineServiceImpl();
