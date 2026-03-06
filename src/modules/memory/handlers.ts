/**
 * Memory 模块命令处理器
 *
 * 每个处理器流程：
 * 1. 写入 Repository（Yjs 持久化）
 * 2. 更新 Store（响应式状态）
 * 3. 发出领域事件
 */

import { eventBus } from "@/core";
import type {
  Command,
  CommandContext,
  CommandHandler,
  CommandResult,
} from "@/core/command-bus";
import { subdocManager } from "@/core/yjs";
import { MemoryCommands } from "@/domain/commands";
import type {
  AddManualMemoryPayload,
  AddMiniSummaryPayload,
  DeleteManualMemoryPayload,
  TriggerCompressionPayload,
  UpdateManualMemoryPayload,
  UpdateMegaSummaryPayload,
  UpdateMiniSummaryPayload,
} from "@/domain/commands/memory";
import type { MegaSummary } from "@/domain/entities/memory";
import { MemoryEvents } from "@/domain/events";
import type {
  ManualMemoryAddedPayload,
  ManualMemoryDeletedPayload,
  ManualMemoryUpdatedPayload,
  MegaSummaryAddedPayload,
  MegaSummaryUpdatedPayload,
  MiniSummaryAddedPayload,
  MiniSummaryCompressedPayload,
  MiniSummaryUpdatedPayload,
} from "@/domain/events/memory";
import { checkAndTriggerCompression } from "./compression";
import {
  getMemoryRepository,
  getMultiplayerMemoryRepository,
  type MemoryRepository,
} from "./repository";
import { useMemoryStore } from "./store";

/**
 * 根据 roomId 获取正确的 MemoryRepository
 *
 * - roomId 存在：从 HistoryDoc 获取联机 Repository
 * - roomId 不存在：获取单机 Repository（SaveDoc）
 */
async function resolveRepository(roomId?: string): Promise<MemoryRepository> {
  if (roomId) {
    const historyDoc = await subdocManager.loadHistoryDoc(roomId);
    return getMultiplayerMemoryRepository(historyDoc, roomId);
  }

  return getMemoryRepository();
}

/**
 * 添加小总结处理器
 */
const addMiniSummaryHandler: CommandHandler<
  AddMiniSummaryPayload,
  { summaryId: string }
> = async (
  command: Command<AddMiniSummaryPayload>,
  context: CommandContext,
): Promise<CommandResult<{ summaryId: string }>> => {
  try {
    const { conversationId, messageId, messageIndex, content } =
      command.payload;

    const repo = await resolveRepository(command.payload.roomId);
    const store = useMemoryStore.getState();

    const summary = repo.addMiniSummary(conversationId, {
      messageId,
      messageIndex,
      content,
    });

    store.addMiniSummary(conversationId, summary);

    eventBus.emit(
      eventBus.createEvent<MiniSummaryAddedPayload>(
        MemoryEvents.MINI_SUMMARY_ADDED,
        { conversationId, summary },
        "lyra.memory",
      ),
      { correlationId: context.commandId },
    );

    void checkAndTriggerCompression(
      conversationId,
      command.payload.roomId,
      context.commandId,
    ).catch((error) => {
      console.warn(
        "[Memory] Failed to trigger compression check:",
        error instanceof Error ? error.message : error,
      );
    });

    return {
      success: true,
      data: { summaryId: summary.id },
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to add mini summary",
    };
  }
};

/**
 * 更新小总结处理器
 */
const updateMiniSummaryHandler: CommandHandler<
  UpdateMiniSummaryPayload,
  void
> = async (
  command: Command<UpdateMiniSummaryPayload>,
  context: CommandContext,
): Promise<CommandResult<void>> => {
  try {
    const { conversationId, summaryId, content } = command.payload;

    const repo = await resolveRepository(command.payload.roomId);
    const store = useMemoryStore.getState();

    repo.updateMiniSummary(conversationId, summaryId, content);
    store.updateMiniSummary(conversationId, summaryId, content);

    eventBus.emit(
      eventBus.createEvent<MiniSummaryUpdatedPayload>(
        MemoryEvents.MINI_SUMMARY_UPDATED,
        { conversationId, summaryId },
        "lyra.memory",
      ),
      { correlationId: context.commandId },
    );

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to update mini summary",
    };
  }
};

/**
 * 更新大总结处理器
 */
const updateMegaSummaryHandler: CommandHandler<
  UpdateMegaSummaryPayload,
  void
> = async (
  command: Command<UpdateMegaSummaryPayload>,
  context: CommandContext,
): Promise<CommandResult<void>> => {
  try {
    const { conversationId, summaryId, content } = command.payload;

    const repo = await resolveRepository(command.payload.roomId);
    const store = useMemoryStore.getState();

    repo.updateMegaSummary(conversationId, summaryId, content);
    store.updateMegaSummary(conversationId, summaryId, content);

    eventBus.emit(
      eventBus.createEvent<MegaSummaryUpdatedPayload>(
        MemoryEvents.MEGA_SUMMARY_UPDATED,
        { conversationId, summaryId },
        "lyra.memory",
      ),
      { correlationId: context.commandId },
    );

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to update mega summary",
    };
  }
};

/**
 * 添加手动记忆处理器
 */
const addManualMemoryHandler: CommandHandler<
  AddManualMemoryPayload,
  { memoryId: string }
> = async (
  command: Command<AddManualMemoryPayload>,
  context: CommandContext,
): Promise<CommandResult<{ memoryId: string }>> => {
  try {
    const { conversationId, sourceContent, summary, tags, sourceMessageId } =
      command.payload;

    const repo = await resolveRepository(command.payload.roomId);
    const store = useMemoryStore.getState();

    const memory = repo.addManualMemory(conversationId, {
      sourceContent,
      summary,
      tags,
      sourceMessageId,
    });

    store.addManualMemory(conversationId, memory);

    eventBus.emit(
      eventBus.createEvent<ManualMemoryAddedPayload>(
        MemoryEvents.MANUAL_MEMORY_ADDED,
        { conversationId, memory },
        "lyra.memory",
      ),
      { correlationId: context.commandId },
    );

    return {
      success: true,
      data: { memoryId: memory.id },
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to add manual memory",
    };
  }
};

/**
 * 更新手动记忆处理器
 */
const updateManualMemoryHandler: CommandHandler<
  UpdateManualMemoryPayload,
  void
> = async (
  command: Command<UpdateManualMemoryPayload>,
  context: CommandContext,
): Promise<CommandResult<void>> => {
  try {
    const { conversationId, id, updates } = command.payload;

    const repo = await resolveRepository(command.payload.roomId);
    const store = useMemoryStore.getState();

    const existing = repo
      .getManualMemories(conversationId)
      .find((memory) => memory.id === id);

    if (!existing) {
      return { success: false, error: "Manual memory not found" };
    }

    repo.updateManualMemory(conversationId, id, updates);

    const currentList = repo.getManualMemories(conversationId);
    store.setManualMemories(conversationId, currentList);

    const updated = currentList.find((memory) => memory.id === id);
    if (!updated) {
      return { success: false, error: "Manual memory not found after update" };
    }

    eventBus.emit(
      eventBus.createEvent<ManualMemoryUpdatedPayload>(
        MemoryEvents.MANUAL_MEMORY_UPDATED,
        { conversationId, memory: updated },
        "lyra.memory",
      ),
      { correlationId: context.commandId },
    );

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to update manual memory",
    };
  }
};

/**
 * 删除手动记忆处理器
 */
const deleteManualMemoryHandler: CommandHandler<
  DeleteManualMemoryPayload,
  void
> = async (
  command: Command<DeleteManualMemoryPayload>,
  context: CommandContext,
): Promise<CommandResult<void>> => {
  try {
    const { conversationId, id } = command.payload;

    const repo = await resolveRepository(command.payload.roomId);
    const store = useMemoryStore.getState();

    const existing = repo
      .getManualMemories(conversationId)
      .find((memory) => memory.id === id);

    if (!existing) {
      return { success: false, error: "Manual memory not found" };
    }

    repo.deleteManualMemory(conversationId, id);
    store.deleteManualMemory(conversationId, id);

    eventBus.emit(
      eventBus.createEvent<ManualMemoryDeletedPayload>(
        MemoryEvents.MANUAL_MEMORY_DELETED,
        { conversationId, memoryId: id },
        "lyra.memory",
      ),
      { correlationId: context.commandId },
    );

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to delete manual memory",
    };
  }
};

/**
 * 触发压缩处理器
 *
 * 说明：
 * - 本处理器负责将外部压缩结果写入存储
 * - 压缩 AI 调用在后续 Phase 中实现
 */
const triggerCompressionHandler: CommandHandler<
  TriggerCompressionPayload,
  { megaSummaryId: string }
> = async (
  command: Command<TriggerCompressionPayload>,
  context: CommandContext,
): Promise<CommandResult<{ megaSummaryId: string }>> => {
  try {
    const { conversationId, miniSummaryIds, megaSummaryContent, messageRange } =
      command.payload;

    if (miniSummaryIds.length === 0) {
      return { success: false, error: "miniSummaryIds is empty" };
    }

    if (messageRange.from > messageRange.to) {
      return { success: false, error: "Invalid messageRange" };
    }

    const repo = await resolveRepository(command.payload.roomId);
    const store = useMemoryStore.getState();

    const megaSummary: MegaSummary = {
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      content: megaSummaryContent,
      sourceMiniSummaryIds: [...miniSummaryIds],
      messageRange,
    };

    repo.addMegaSummary(conversationId, megaSummary);
    repo.markAsCompressed(conversationId, miniSummaryIds, megaSummary.id);

    store.addMegaSummary(conversationId, megaSummary);
    store.markMiniSummariesCompressed(
      conversationId,
      miniSummaryIds,
      megaSummary.id,
    );

    eventBus.emit(
      eventBus.createEvent<MegaSummaryAddedPayload>(
        MemoryEvents.MEGA_SUMMARY_ADDED,
        { conversationId, summary: megaSummary },
        "lyra.memory",
      ),
      { correlationId: context.commandId },
    );

    eventBus.emit(
      eventBus.createEvent<MiniSummaryCompressedPayload>(
        MemoryEvents.MINI_SUMMARY_COMPRESSED,
        {
          conversationId,
          miniSummaryIds,
          megaSummaryId: megaSummary.id,
        },
        "lyra.memory",
      ),
      { correlationId: context.commandId },
    );

    return {
      success: true,
      data: { megaSummaryId: megaSummary.id },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to compress",
    };
  }
};

/**
 * 创建 Memory 命令处理器映射
 */
export function createMemoryCommandHandlers(): Record<
  string,
  CommandHandler<unknown, unknown>
> {
  return {
    [MemoryCommands.ADD_MINI_SUMMARY]: addMiniSummaryHandler as CommandHandler<
      unknown,
      unknown
    >,
    [MemoryCommands.ADD_MANUAL_MEMORY]:
      addManualMemoryHandler as CommandHandler<unknown, unknown>,
    [MemoryCommands.UPDATE_MANUAL_MEMORY]:
      updateManualMemoryHandler as CommandHandler<unknown, unknown>,
    [MemoryCommands.DELETE_MANUAL_MEMORY]:
      deleteManualMemoryHandler as CommandHandler<unknown, unknown>,
    [MemoryCommands.TRIGGER_COMPRESSION]:
      triggerCompressionHandler as CommandHandler<unknown, unknown>,
    [MemoryCommands.UPDATE_MINI_SUMMARY]:
      updateMiniSummaryHandler as CommandHandler<unknown, unknown>,
    [MemoryCommands.UPDATE_MEGA_SUMMARY]:
      updateMegaSummaryHandler as CommandHandler<unknown, unknown>,
  };
}
