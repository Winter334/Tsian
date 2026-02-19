import * as Y from "yjs";

import { eventBus } from "@/core";
import type {
  Command,
  CommandContext,
  CommandHandler,
  CommandResult,
} from "@/core/command-bus";
import { yjsManager } from "@/core/yjs";
import {
  CheckpointCommands,
  type CreateCheckpointPayload,
  type DeleteCheckpointPayload,
  type RestoreCheckpointPayload,
} from "@/domain/commands/checkpoint";
import type { Checkpoint } from "@/domain/entities/checkpoint";
import { CheckpointEvents } from "@/domain/events/checkpoint";
import { SaveEvents, type SaveLoadedPayload } from "@/domain/events/save";
import { createSnapshot } from "./services/snapshot-creator";
import { restoreSnapshot } from "./services/snapshot-restorer";

/**
 * 获取检查点数组（若不存在则返回 null）
 */
function getCheckpointsArray(saveDoc: Y.Map<unknown>): Y.Array<unknown> | null {
  const checkpoints = saveDoc.get("checkpoints");
  return checkpoints instanceof Y.Array ? checkpoints : null;
}

/**
 * 获取或创建检查点数组
 */
function getOrCreateCheckpointsArray(
  saveDoc: Y.Map<unknown>,
): Y.Array<unknown> {
  const checkpoints = getCheckpointsArray(saveDoc);
  if (checkpoints) {
    return checkpoints;
  }

  const next = new Y.Array<unknown>();
  saveDoc.set("checkpoints", next);
  return next;
}

/**
 * 将未知值安全转换为 Checkpoint
 */
function toCheckpoint(value: unknown): Checkpoint | null {
  if (!isRecord(value)) {
    return null;
  }

  if (typeof value.id !== "string") {
    return null;
  }

  if (typeof value.label !== "string") {
    return null;
  }

  if (typeof value.createdAt !== "number") {
    return null;
  }

  if (value.source !== "auto" && value.source !== "manual") {
    return null;
  }

  return value as unknown as Checkpoint;
}

/**
 * 在检查点数组中查找目标检查点
 */
function findCheckpointById(
  checkpoints: Y.Array<unknown>,
  checkpointId: string,
): { index: number; checkpoint: Checkpoint } | null {
  for (let i = 0; i < checkpoints.length; i += 1) {
    const checkpoint = toCheckpoint(checkpoints.get(i));
    if (checkpoint && checkpoint.id === checkpointId) {
      return { index: i, checkpoint };
    }
  }

  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * 创建检查点处理器
 */
const createCheckpointHandler: CommandHandler<
  CreateCheckpointPayload,
  string
> = async (
  command: Command<CreateCheckpointPayload>,
  context: CommandContext,
): Promise<CommandResult<string>> => {
  const { label, source } = command.payload;

  try {
    const saveDoc = yjsManager.getCurrentSave();
    if (!saveDoc) {
      return {
        success: false,
        error: "No active save loaded",
      };
    }

    const rootDoc = yjsManager.getDoc();
    const existingCheckpoints = getCheckpointsArray(saveDoc);
    const autoLabelIndex = (existingCheckpoints?.length ?? 0) + 1;

    const resolvedLabel =
      typeof label === "string" && label.trim().length > 0
        ? label.trim()
        : `检查点 #${autoLabelIndex}`;

    const snapshot = createSnapshot(saveDoc);
    const checkpoint: Checkpoint = {
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      label: resolvedLabel,
      source,
      ...snapshot,
    };

    rootDoc.transact(() => {
      const checkpoints = getOrCreateCheckpointsArray(saveDoc);
      checkpoints.push([checkpoint]);
      saveDoc.set("updatedAt", Date.now());
    });

    eventBus.emit(
      eventBus.createEvent(CheckpointEvents.CHECKPOINT_CREATED, {
        checkpointId: checkpoint.id,
        label: checkpoint.label,
        createdAt: checkpoint.createdAt,
        source: checkpoint.source,
      }),
      { correlationId: context.commandId },
    );

    return { success: true, data: checkpoint.id };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to create checkpoint",
    };
  }
};

/**
 * 恢复检查点处理器
 */
const restoreCheckpointHandler: CommandHandler<
  RestoreCheckpointPayload,
  void
> = async (
  command: Command<RestoreCheckpointPayload>,
  context: CommandContext,
): Promise<CommandResult<void>> => {
  const { checkpointId } = command.payload;

  try {
    const saveDoc = yjsManager.getCurrentSave();
    const saveId = yjsManager.getCurrentSaveId();

    if (!saveDoc || !saveId) {
      return {
        success: false,
        error: "No active save loaded",
      };
    }

    const rootDoc = yjsManager.getDoc();
    const checkpoints = getCheckpointsArray(saveDoc);

    if (!checkpoints || checkpoints.length === 0) {
      return {
        success: false,
        error: "No checkpoints available",
      };
    }

    const found = findCheckpointById(checkpoints, checkpointId);
    if (!found) {
      return {
        success: false,
        error: `Checkpoint not found: ${checkpointId}`,
      };
    }

    restoreSnapshot(saveDoc, found.checkpoint, rootDoc);

    const discardedCount = checkpoints.length - (found.index + 1);
    if (discardedCount > 0) {
      rootDoc.transact(() => {
        checkpoints.delete(found.index + 1, discardedCount);
      });
    }

    eventBus.emit(
      eventBus.createEvent(CheckpointEvents.CHECKPOINT_RESTORED, {
        checkpointId,
        discardedCount,
      }),
      { correlationId: context.commandId },
    );

    const saveLoadedPayload: SaveLoadedPayload = {
      saveId,
      previousSaveId: saveId,
      saveType: yjsManager.getSaveType(saveId),
    };

    eventBus.emit(
      eventBus.createEvent(SaveEvents.SAVE_LOADED, saveLoadedPayload),
      { correlationId: context.commandId },
    );

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to restore checkpoint",
    };
  }
};

/**
 * 删除检查点处理器
 */
const deleteCheckpointHandler: CommandHandler<
  DeleteCheckpointPayload,
  void
> = async (
  command: Command<DeleteCheckpointPayload>,
  context: CommandContext,
): Promise<CommandResult<void>> => {
  const { checkpointId } = command.payload;

  try {
    const saveDoc = yjsManager.getCurrentSave();
    if (!saveDoc) {
      return {
        success: false,
        error: "No active save loaded",
      };
    }

    const rootDoc = yjsManager.getDoc();
    const checkpoints = getCheckpointsArray(saveDoc);

    if (!checkpoints || checkpoints.length === 0) {
      return {
        success: false,
        error: "No checkpoints available",
      };
    }

    const found = findCheckpointById(checkpoints, checkpointId);
    if (!found) {
      return {
        success: false,
        error: `Checkpoint not found: ${checkpointId}`,
      };
    }

    rootDoc.transact(() => {
      checkpoints.delete(found.index, 1);
      saveDoc.set("updatedAt", Date.now());
    });

    eventBus.emit(
      eventBus.createEvent(CheckpointEvents.CHECKPOINT_DELETED, {
        checkpointId,
      }),
      { correlationId: context.commandId },
    );

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to delete checkpoint",
    };
  }
};

/**
 * 创建所有命令处理器
 */
export function createCheckpointCommandHandlers(): Record<
  string,
  CommandHandler<unknown, unknown>
> {
  return {
    [CheckpointCommands.CREATE_CHECKPOINT]:
      createCheckpointHandler as CommandHandler<unknown, unknown>,
    [CheckpointCommands.RESTORE_CHECKPOINT]:
      restoreCheckpointHandler as CommandHandler<unknown, unknown>,
    [CheckpointCommands.DELETE_CHECKPOINT]:
      deleteCheckpointHandler as CommandHandler<unknown, unknown>,
  };
}
