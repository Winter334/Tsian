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
  PipelineBlackboard,
  SoloIrnrInput,
} from "@/domain/types";
import { getRuntimeWorldConfig } from "@/lib/world/resolve-config";
import { createGamePipeline } from "@/modules/game/agents";

// ─── 输入/输出类型（从 domain 层 re-export，保持向后兼容） ───

export type {
  EntityFinalState,
  IrnrPipelineResult,
  IrnrPipelineServiceContract,
  MultiplayerIrnrInput,
  SoloIrnrInput,
};

function buildBlackboardInput(
  input: SoloIrnrInput | MultiplayerIrnrInput,
): BlackboardInput<PipelineBlackboard> {
  return {
    commandId: input.commandId,
    playerInput: input.userInput,
    aiConfig: input.aiConfig,
    baseVariableContext: input.baseVariableContext,
    entities: input.entities,
    worldConfig: input.worldConfig ?? getRuntimeWorldConfig(),
    actorId: input.actorId ?? "",
    targetId: input.targetId,
    roomId: "roomId" in input ? input.roomId : undefined,
    presets: {
      parser: input.parserPreset,
      narrative: input.narrativePreset,
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
