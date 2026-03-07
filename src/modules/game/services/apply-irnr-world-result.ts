import type {
  Command,
  CommandResult,
  DispatchContext,
} from "@/core/command-bus";
import {
  WorldArchiveCommands,
  type SyncPipelineArchiveChangesPayload,
} from "@/domain/commands/world-archive";
import type {
  CreatedNpcData,
  EntityFinalState,
  ResultFrame,
} from "@/domain/types";

import type { GameStateRepository } from "../repository";
import { applyStructuralChanges } from "./structural-change-consumer";

interface IrnrWorldResult {
  finalEntityStates?: EntityFinalState[];
  createdNpcs?: CreatedNpcData[];
  archiveUpdates?: unknown[];
  structuralChanges?: ResultFrame["structuralChanges"];
}

interface WorldResultCommandBus {
  dispatch<C, R>(
    command: Command<C>,
    dispatchContext?: DispatchContext,
  ): Promise<CommandResult<R>>;
  createCommand<C>(type: string, payload: C): Command<C>;
}

interface ApplyIrnrWorldResultOptions {
  currentTurn: number;
  repository?: Pick<GameStateRepository, "upsertFromEntityStates"> | null;
  result: IrnrWorldResult;
  commandBus: WorldResultCommandBus;
  correlationId?: string;
}

/**
 * 应用 IRNR 成功后的公共世界结果段。
 *
 * 仅处理：实体状态回写 → 结构化变更消费 → 世界档案聚合同步。
 * 单机 / 多人各自的流式会话、TurnDoc、状态机与事件尾处理由调用方保留。
 */
export async function applyIrnrWorldResult({
  currentTurn,
  repository,
  result,
  commandBus,
  correlationId,
}: ApplyIrnrWorldResultOptions): Promise<void> {
  const { finalEntityStates, createdNpcs, archiveUpdates, structuralChanges } =
    result;

  if (repository && finalEntityStates && finalEntityStates.length > 0) {
    repository.upsertFromEntityStates(finalEntityStates, createdNpcs);
  }

  await applyStructuralChanges(structuralChanges, commandBus);

  const archiveCommandPayload: SyncPipelineArchiveChangesPayload = {
    currentTurn,
    createdNpcs,
    archiveUpdates,
  };

  if (
    (archiveCommandPayload.createdNpcs?.length ?? 0) === 0 &&
    (archiveCommandPayload.archiveUpdates?.length ?? 0) === 0
  ) {
    return;
  }

  const archiveSyncResult = await commandBus.dispatch<
    SyncPipelineArchiveChangesPayload,
    void
  >(
    {
      type: WorldArchiveCommands.SYNC_PIPELINE_CHANGES,
      payload: archiveCommandPayload,
    },
    correlationId ? { correlationId } : undefined,
  );

  if (!archiveSyncResult.success) {
    console.warn(
      `[WorldArchive] 命令链路同步失败：${archiveSyncResult.error ?? "unknown"}`,
    );
  }
}
