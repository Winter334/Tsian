/**
 * Chat 命令处理器
 *
 * 重构说明：
 * - 业务数据操作通过 ChatRepository（Yjs 持久化）
 * - UI 临时状态通过 useChatUIStore（内存）
 * - Repository 操作会自动发布领域事件
 * - AI 调用通过 AiExecutor 统一处理（支持重试、取消）
 * - IRNR 流水线（G4）：如果 parser 预设可用，走 IRNR 流程
 */

import { commandBus, eventBus, services } from "@/core";
import type {
  Command,
  CommandContext,
  CommandHandler,
  CommandResult,
} from "@/core/command-bus";
import { IRNR_PIPELINE_SERVICE_TOKEN } from "@/core/services/tokens";
import { yjsManager } from "@/core/yjs";
import type {
  ClearConversationPayload,
  CreateConversationPayload,
  DeleteConversationPayload,
  DeleteMessagePayload,
  EditMessagePayload,
  RegenerateFromCheckpointPayload,
  SelectConversationPayload,
  SendMessagePayload,
} from "@/domain/commands/chat";
import { ChatCommands } from "@/domain/commands/chat";
import {
  CheckpointCommands,
  type RestoreCheckpointPayload,
} from "@/domain/commands/checkpoint";
import { createConversation } from "@/domain/entities/conversation";
import { createMessage } from "@/domain/entities/message";
import { ChatEvents } from "@/domain/events/chat";
import type { IrnrPipelineResult } from "@/domain/types";
import { resolveAIConfig } from "@/lib/ai/resolve-config";
import { buildVariableContext, usePresetStore } from "@/lib/prompt";
import { getLastDisplayName } from "@/lib/user-identity";
import {
  createGameStateRepository,
  type GameStateRepository,
} from "@/modules/game/repository";
import type { EntityData } from "@/modules/game/services/entity-accessor";
import { applyStructuralChanges } from "@/modules/game/services/structural-change-consumer";
import { prepareMemoryData } from "@/modules/memory/memory-injector";
import { applyArchiveUpdatesAndSync } from "@/modules/world-archive/apply-updates";
import { autoRegisterNpcs } from "@/modules/world-archive/auto-register";
import type { ArchiveUpdate } from "@/modules/world-archive/types";
import { useSettingsStore } from "@/stores/settings";
import * as Y from "yjs";
import { getChatRepository } from "../repository/factory";
import { useChatUIStore } from "../store/ui-store";
import { StreamSession } from "../utils/stream-session";

/**
 * 发送消息处理器
 *
 * 数据流：
 * 1. 通过 Repository 添加用户消息（自动持久化到 Yjs + 发布事件）
 * 2. 如果是用户消息，创建 AI 响应消息
 * 3. 流式更新 AI 响应内容
 * 4. UI 状态（loading, streamingMessageId）通过 useChatUIStore 管理
 */
const sendMessageHandler: CommandHandler<SendMessagePayload, void> = async (
  command: Command<SendMessagePayload>,
  context: CommandContext,
): Promise<CommandResult<void>> => {
  const { content, conversationId, role = "user" } = command.payload;
  const uiStore = useChatUIStore.getState();

  let session: StreamSession | undefined;

  try {
    // 获取 Repository 实例
    const repository = getChatRepository();

    // 1. 创建用户消息
    const userMessage = createMessage({
      role,
      content,
      conversationId,
    });

    // ✅ 通过 Repository 添加（自动持久化 + 发布事件）
    repository.addMessage(conversationId, userMessage);

    // 如果是 user 消息，需要触发 AI 响应
    if (role === "user") {
      // 2. 创建 AI 响应消息（初始为空）
      const assistantMessage = createMessage({
        role: "assistant",
        content: "",
        conversationId,
      });

      // ✅ 通过 Repository 添加
      repository.addMessage(conversationId, assistantMessage);
      const assistantMessageIndex = Math.max(
        repository.getMessageCount(conversationId) - 1,
        0,
      );

      // UI 临时状态
      uiStore.setStreamingMessageId(assistantMessage.id);
      uiStore.setLoading(true);

      // 创建 StreamSession（统一 chunk/完成/失败/清理逻辑）
      session = new StreamSession({
        repository,
        uiStore,
        eventBus,
        messageId: assistantMessage.id,
        conversationId,
        correlationId: context.commandId,
      });

      eventBus.emit(
        eventBus.createEvent(ChatEvents.STREAM_START, {
          messageId: assistantMessage.id,
          conversationId,
        }),
        { correlationId: context.commandId },
      );

      // 3. 获取激活的预设（叙事预设）
      const presetStore = usePresetStore.getState();
      const narrativePreset = presetStore.activePreset;
      if (!narrativePreset) {
        throw new Error("未找到激活的预设，请在设置中配置预设。");
      }

      const settingsStore = useSettingsStore.getState();
      const presetProfileId = narrativePreset.aiProfileId;
      const boundProfile = presetProfileId
        ? settingsStore.getProfileById(presetProfileId)
        : undefined;
      const profile = settingsStore.getProfileOrFallback(presetProfileId);

      if (!presetProfileId || !boundProfile) {
        // TODO: handler 层暂时无法直接使用 React ToastContext，后续应通过 eventBus 接入全局 toast 提示
        console.warn(
          `[AI] 预设"${narrativePreset.name}"未绑定 AI Profile，使用"${profile.name}"作为兜底`,
        );
      }

      const aiConfig = resolveAIConfig(profile, narrativePreset.aiSettings);

      // 4. 从 Repository 获取消息历史
      const chatHistory = repository.getMessages(conversationId).map((m) => ({
        role: m.role as "system" | "user" | "assistant",
        content: m.content,
      }));

      // 5. 构建变量上下文 — 从 Yjs 存档读取角色信息
      const playerName = getLastDisplayName();

      let characterInfo:
        | {
            name: string;
            description?: string;
            personality?: string;
            appearance?: string;
            dimensionSelections?: Record<string, string>;
            talentIds?: string[];
            attributes?: Record<string, unknown>;
          }
        | undefined;

      // Solo IRNR：通过 GameStateRepository 从存档读取角色数据
      let soloIrnrEntities: EntityData[] = [];
      let playerCharacterId: string | undefined;
      let gameStateRepo: GameStateRepository | null = null;

      const currentSave = yjsManager.getCurrentSave();
      if (currentSave) {
        const charactersMap = currentSave.get("characters");
        const rootDoc = yjsManager.getDoc();

        if (
          charactersMap &&
          typeof charactersMap === "object" &&
          "size" in charactersMap &&
          rootDoc
        ) {
          gameStateRepo = createGameStateRepository(
            charactersMap as Y.Map<Y.Map<unknown>>,
            rootDoc,
          );

          const playerChar = gameStateRepo.getPlayerCharacter();
          if (playerChar) {
            characterInfo = {
              name: playerChar.name,
              description: playerChar.description,
              personality: playerChar.personality,
              appearance: playerChar.appearance,
              dimensionSelections: playerChar.dimensionSelections,
              talentIds: playerChar.talentIds,
              attributes: playerChar.attributes,
            };
            playerCharacterId = playerChar.id;
          }

          soloIrnrEntities = gameStateRepo.toEntityDataList({
            includeActor: playerCharacterId,
          });
        }
      }

      const displayName = characterInfo?.name || playerName || "冒险者";

      // 准备分段记忆注入数据（供 memorySummary marker 渲染）
      // 提取 assistant 消息列表给 prepareMemoryData
      const allMessages = repository.getMessages(conversationId);
      const assistantMessages = allMessages
        .filter((m) => m.role === "assistant" && m.content.trim() !== "")
        .map((m) => ({
          id: m.id,
          content: m.content,
          messageIndex: allMessages.indexOf(m),
        }));

      const memoryData = prepareMemoryData(
        conversationId,
        narrativePreset,
        assistantMessages,
      );

      const variableContext = buildVariableContext("solo", {
        user: {
          name: displayName,
          character: characterInfo
            ? {
                name: characterInfo.name,
                description: characterInfo.description,
                personality: characterInfo.personality,
                appearance: characterInfo.appearance,
                dimensionSelections: characterInfo.dimensionSelections,
                talentIds: characterInfo.talentIds,
                attributes: characterInfo.attributes,
              }
            : undefined,
        },
        chatHistory,
        memoryData,
        userInput: content,
      });

      // parser 预设可选——无预设时管线 Parser Agent 自动写入空 ruleScript
      const parserPreset =
        (await presetStore.getPresetForPurpose("parser")) ?? undefined;
      const directorPreset =
        (await presetStore.getPresetForPurpose("director")) ?? undefined;
      const directorPresetProfileId = directorPreset?.aiProfileId;
      const boundDirectorProfile = directorPresetProfileId
        ? settingsStore.getProfileById(directorPresetProfileId)
        : undefined;
      const directorProfile = directorPreset
        ? settingsStore.getProfileOrFallback(directorPresetProfileId)
        : undefined;

      if (
        directorPreset &&
        (!directorPresetProfileId || !boundDirectorProfile)
      ) {
        console.warn(
          `[Director AI] 预设"${directorPreset.name}"未绑定 AI Profile，使用"${directorProfile?.name ?? "默认配置"}"作为兜底`,
        );
      }

      const directorAiConfig =
        directorProfile && directorProfile.apiKey.trim() !== ""
          ? resolveAIConfig(directorProfile, directorPreset?.aiSettings)
          : undefined;

      // ── IRNR 管线流程（统一路径） ──────────────────────────
      const irnrPipelineService = services.get(IRNR_PIPELINE_SERVICE_TOKEN);
      if (!irnrPipelineService) {
        throw new Error("IRNR Pipeline Service 未注册");
      }

      const irnrInput = {
        commandId: context.commandId,
        userInput: content,
        aiConfig,
        directorAiConfig,
        narrativePreset,
        parserPreset,
        directorPreset,
        baseVariableContext: variableContext,
        actorId: playerCharacterId,
        turnNumber: assistantMessageIndex,
        entities: soloIrnrEntities,
        onNarrativeChunk: (chunk: string) => {
          session!.appendChunk(chunk);
        },
        conversationId,
        messageId: assistantMessage.id,
        messageIndex: assistantMessageIndex,
      };

      const irnrResult: IrnrPipelineResult =
        await irnrPipelineService.runSolo(irnrInput);

      if (!irnrResult.success) {
        const errorMessage = irnrResult.error ?? "IRNR 流程失败";
        session.fail(errorMessage);
        return { success: false, error: errorMessage };
      }

      // Solo IRNR：回写实体最终状态到当前存档（Upsert）
      if (
        irnrResult.finalEntityStates &&
        irnrResult.finalEntityStates.length > 0
      ) {
        let writeRepo = gameStateRepo;
        if (!writeRepo) {
          const currentSaveForWriteback = yjsManager.getCurrentSave();
          const rootDoc = yjsManager.getDoc();
          if (currentSaveForWriteback && rootDoc) {
            const charactersMap = currentSaveForWriteback.get("characters");
            if (
              charactersMap &&
              typeof charactersMap === "object" &&
              "size" in charactersMap
            ) {
              writeRepo = createGameStateRepository(
                charactersMap as Y.Map<Y.Map<unknown>>,
                rootDoc,
              );
            }
          }
        }

        if (writeRepo) {
          writeRepo.upsertFromEntityStates(
            irnrResult.finalEntityStates,
            irnrResult.createdNpcs,
          );
        }
      }

      // 消费结构化变更（物品/技能 → Inventory 命令）
      if (irnrResult.resultFrame?.structuralChanges) {
        await applyStructuralChanges(
          irnrResult.resultFrame.structuralChanges,
          commandBus,
        );
      }

      // --- 世界档案：NPC 自动建档 ---
      if (irnrResult.createdNpcs && irnrResult.createdNpcs.length > 0) {
        const currentTurn = assistantMessageIndex;
        autoRegisterNpcs(irnrResult.createdNpcs, currentTurn);
      }

      // --- 世界档案：应用导演 AI 的档案更新 ---
      if (irnrResult.archiveUpdates && irnrResult.archiveUpdates.length > 0) {
        const currentTurn = assistantMessageIndex;
        applyArchiveUpdatesAndSync(
          irnrResult.archiveUpdates as ArchiveUpdate[],
          currentTurn,
        );
      }

      const finalContent = irnrResult.narrativeText ?? "";
      session.complete(
        finalContent,
        irnrResult.resultFrame
          ? { resultFrame: irnrResult.resultFrame }
          : undefined,
      );
    }

    return { success: true };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Failed to send message";
    session?.fail(errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  } finally {
    session?.ensureCleanup();
  }
};

/**
 * 删除消息处理器
 *
 * ✅ 通过 Repository 删除（自动发布事件）
 */
const deleteMessageHandler: CommandHandler<DeleteMessagePayload, void> = async (
  command: Command<DeleteMessagePayload>,
  _context: CommandContext,
): Promise<CommandResult<void>> => {
  const { messageId, conversationId } = command.payload;

  try {
    const repository = getChatRepository();
    // ✅ Repository.deleteMessage 会自动发布 MESSAGE_DELETED 事件
    repository.deleteMessage(conversationId, messageId);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to delete message",
    };
  }
};

/**
 * 编辑消息处理器
 *
 * ✅ 通过 Repository 更新（自动发布事件）
 */
const editMessageHandler: CommandHandler<EditMessagePayload, void> = async (
  command: Command<EditMessagePayload>,
  _context: CommandContext,
): Promise<CommandResult<void>> => {
  const { messageId, conversationId, content } = command.payload;

  try {
    const repository = getChatRepository();
    repository.updateMessage(conversationId, messageId, { content });
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to edit message",
    };
  }
};

/**
 * 从检查点重新生成处理器
 *
 * 组合操作：先回溯检查点，再发送用户消息触发重新生成
 */
const regenerateFromCheckpointHandler: CommandHandler<
  RegenerateFromCheckpointPayload,
  void
> = async (
  command: Command<RegenerateFromCheckpointPayload>,
  context: CommandContext,
): Promise<CommandResult<void>> => {
  const { checkpointId, userMessage, conversationId } = command.payload;

  try {
    const restoreResult = await commandBus.dispatch<
      RestoreCheckpointPayload,
      void
    >(
      {
        type: CheckpointCommands.RESTORE_CHECKPOINT,
        payload: { checkpointId },
      },
      { correlationId: context.commandId },
    );

    if (!restoreResult.success) {
      return {
        success: false,
        error: restoreResult.error ?? "Failed to restore checkpoint",
      };
    }

    const sendResult = await commandBus.dispatch<SendMessagePayload, void>(
      {
        type: ChatCommands.SEND_MESSAGE,
        payload: {
          content: userMessage,
          conversationId,
          role: "user",
        },
      },
      { correlationId: context.commandId },
    );

    return sendResult;
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to regenerate from checkpoint",
    };
  }
};

/**
 * 创建会话处理器
 *
 * ✅ 通过 Repository 创建（自动发布事件）
 */
const createConversationHandler: CommandHandler<
  CreateConversationPayload,
  string
> = async (
  command: Command<CreateConversationPayload>,
  _context: CommandContext,
): Promise<CommandResult<string>> => {
  try {
    const repository = getChatRepository();
    const uiStore = useChatUIStore.getState();

    const conversation = createConversation(command.payload);

    // ✅ Repository.addConversation 会自动发布 CONVERSATION_CREATED 事件
    repository.addConversation(conversation);

    // 设置为当前会话（UI 状态）
    uiStore.setCurrentConversation(conversation.id);

    return { success: true, data: conversation.id };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to create conversation",
    };
  }
};

/**
 * 选择会话处理器
 *
 * 只更新 UI 状态，不涉及 Repository
 */
const selectConversationHandler: CommandHandler<
  SelectConversationPayload,
  void
> = async (
  command: Command<SelectConversationPayload>,
  context: CommandContext,
): Promise<CommandResult<void>> => {
  const uiStore = useChatUIStore.getState();
  uiStore.setCurrentConversation(command.payload.conversationId);

  eventBus.emit(
    eventBus.createEvent(ChatEvents.CONVERSATION_SELECTED, {
      conversationId: command.payload.conversationId,
    }),
    { correlationId: context.commandId },
  );

  return { success: true };
};

/**
 * 清空会话处理器
 *
 * ✅ 通过 Repository 清空消息
 */
const clearConversationHandler: CommandHandler<
  ClearConversationPayload,
  void
> = async (
  command: Command<ClearConversationPayload>,
  _context: CommandContext,
): Promise<CommandResult<void>> => {
  try {
    const repository = getChatRepository();
    repository.clearMessages(command.payload.conversationId);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to clear conversation",
    };
  }
};

/**
 * 删除会话处理器
 *
 * ✅ 通过 Repository 删除（自动发布事件）
 */
const deleteConversationHandler: CommandHandler<
  DeleteConversationPayload,
  void
> = async (
  command: Command<DeleteConversationPayload>,
  _context: CommandContext,
): Promise<CommandResult<void>> => {
  const { conversationId } = command.payload;

  try {
    const repository = getChatRepository();
    const uiStore = useChatUIStore.getState();

    // ✅ Repository.deleteConversation 会自动发布 CONVERSATION_DELETED 事件
    repository.deleteConversation(conversationId);

    // 如果删除的是当前会话，清空选择
    if (uiStore.currentConversationId === conversationId) {
      uiStore.setCurrentConversation(null);
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to delete conversation",
    };
  }
};

/**
 * 创建所有命令处理器
 */
export function createChatCommandHandlers(): Record<
  string,
  CommandHandler<unknown, unknown>
> {
  return {
    [ChatCommands.SEND_MESSAGE]: sendMessageHandler as CommandHandler<
      unknown,
      unknown
    >,
    [ChatCommands.DELETE_MESSAGE]: deleteMessageHandler as CommandHandler<
      unknown,
      unknown
    >,
    [ChatCommands.EDIT_MESSAGE]: editMessageHandler as CommandHandler<
      unknown,
      unknown
    >,
    [ChatCommands.REGENERATE_FROM_CHECKPOINT]:
      regenerateFromCheckpointHandler as CommandHandler<unknown, unknown>,
    [ChatCommands.CREATE_CONVERSATION]:
      createConversationHandler as CommandHandler<unknown, unknown>,
    [ChatCommands.SELECT_CONVERSATION]:
      selectConversationHandler as CommandHandler<unknown, unknown>,
    [ChatCommands.CLEAR_CONVERSATION]:
      clearConversationHandler as CommandHandler<unknown, unknown>,
    [ChatCommands.DELETE_CONVERSATION]:
      deleteConversationHandler as CommandHandler<unknown, unknown>,
  };
}
