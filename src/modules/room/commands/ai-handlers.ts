/**
 * AI 相关命令处理器
 *
 * 实现联机模式下的 AI 调用逻辑：
 * - Host 调用 AI，结果同步到所有玩家
 * - 支持取消/中断/重新生成
 * - G4: IRNR 流水线集成
 *
 * @module room/commands/ai-handlers
 */

import { services } from "@/core";
import type { CommandContext, CommandResult } from "@/core/command-bus/types";
import { eventBus } from "@/core/event-bus";
import { IRNR_PIPELINE_SERVICE_TOKEN } from "@/core/services/tokens";
import {
  subdocManager,
  updateResolveStatus,
  writeResultFrameToTurnDoc,
} from "@/core/yjs";
import type {
  AiAbortReason,
  AiStatus,
  Member,
  PlayerAction,
} from "@/core/yjs/room/types";
import {
  SyncPipelineArchiveChangesPayload,
  WorldArchiveCommands,
} from "@/domain";
import type {
  CancelAiTurnPayload,
  ProcessAiTurnPayload,
  RegenerateAiTurnPayload,
} from "@/domain/commands/room";
import { RoomEvents } from "@/domain/events/room";
import type { CreatedNpcData } from "@/domain/types";
import { type ResultFrame } from "@/domain/types";
import { createAiExecutor, type AiExecutor } from "@/lib/ai/executor";
import { resolveAIConfig } from "@/lib/ai/resolve-config";
import type { AdvancedSettings, AIConfig } from "@/lib/ai/types";
import { buildVariableContext, usePresetStore } from "@/lib/prompt";
import { createGameStateRepository } from "@/modules/game/repository/game-state-repository";
import { applyStructuralChanges } from "@/modules/game/services/structural-change-consumer";
import { prepareMemoryData } from "@/modules/memory/memory-injector";
import { useSettingsStore } from "@/stores/settings";
import * as Y from "yjs";

// ===== 全局状态 =====

/**
 * 当前活跃的 AI 执行器（每个房间一个）
 * Key: roomId:turnNumber
 */
const activeExecutors = new Map<string, AiExecutor>();

/**
 * 获取执行器 Key
 */
function getExecutorKey(roomId: string, turnNumber: number): string {
  return `${roomId}:${turnNumber}`;
}

// ===== 辅助函数 =====

/**
 * 验证 Host 身份
 */
function verifyHost(
  mainDoc: Y.Doc,
  userId: string,
): { success: true } | { success: false; error: string } {
  const metadataMap = mainDoc.getMap("metadata");
  const hostUserId = metadataMap.get("hostUserId") as string | undefined;

  if (hostUserId !== userId) {
    return {
      success: false,
      error: "Only host can perform this action",
    };
  }

  return { success: true };
}

/**
 * 获取当前 AI 状态
 */
function getAiStatus(turnDoc: Y.Doc): AiStatus {
  const configMap = turnDoc.getMap("config");
  return (configMap.get("aiStatus") as AiStatus) || "idle";
}

/**
 * 更新 AI 状态
 */
function updateAiStatus(
  turnDoc: Y.Doc,
  status: AiStatus,
  extra?: {
    error?: {
      type: string;
      message: string;
      retryCount: number;
      retryAfter?: number;
    };
    aborted?: {
      abortedAt: number;
      reason: AiAbortReason;
    };
  },
): void {
  const configMap = turnDoc.getMap("config");
  configMap.set("aiStatus", status);

  if (extra?.error) {
    configMap.set("aiError", extra.error);
  } else if (status !== "failed") {
    configMap.delete("aiError");
  }

  if (extra?.aborted) {
    configMap.set("aiAborted", extra.aborted);
  } else if (status !== "aborted") {
    configMap.delete("aiAborted");
  }
}

/**
 * 从 TurnDoc 读取行动数据
 */
function readActionsFromTurnDoc(turnDoc: Y.Doc): Map<string, PlayerAction> {
  const actionsMap = turnDoc.getMap("actions") as Y.Map<PlayerAction>;
  const actions = new Map<string, PlayerAction>();

  actionsMap.forEach((action, userId) => {
    actions.set(userId, action);
  });

  return actions;
}

/**
 * 从 MainDoc 读取成员数据
 */
function readMembersFromMainDoc(mainDoc: Y.Doc): Map<string, Member> {
  const membersMap = mainDoc.getMap("members") as Y.Map<Member>;
  const members = new Map<string, Member>();

  membersMap.forEach((member, id) => {
    members.set(id, member);
  });

  return members;
}

/**
 * 获取 Host 的 AI 配置
 */
function getHostAiConfig(preset?: {
  name?: string;
  aiProfileId?: string;
  aiSettings?: Partial<AdvancedSettings>;
}): AIConfig | null {
  const store = useSettingsStore.getState();
  const presetProfileId = preset?.aiProfileId;
  const boundProfile = presetProfileId
    ? store.getProfileById(presetProfileId)
    : undefined;
  const profile = store.getProfileOrFallback(presetProfileId);

  if (!presetProfileId || !boundProfile) {
    // TODO: handler 层暂时无法直接使用 React ToastContext，后续应通过 eventBus 接入全局 toast 提示
    console.warn(
      `[Room AI] 预设"${preset?.name ?? "未命名预设"}"未绑定 AI Profile，使用"${profile.name}"作为兜底`,
    );
  }

  // 检查是否配置了 API Key
  if (!profile.apiKey || profile.apiKey.trim() === "") {
    return null;
  }

  return resolveAIConfig(profile, preset?.aiSettings);
}

// ===== 命令处理器 =====

/**
 * 处理 AI 回合命令
 *
 * 流程：
 * 1. 验证 Host 身份
 * 2. 检查当前状态（防止重复调用）
 * 3. 读取玩家行动
 * 4. 构造 Prompt
 * 5. 调用 AI（流式写入 TurnDoc）
 * 6. 更新状态
 */
export async function processAiTurnHandler(
  payload: ProcessAiTurnPayload,
  context: CommandContext,
): Promise<CommandResult<void>> {
  const { roomId, turnNumber, userId } = payload;
  const executorKey = getExecutorKey(roomId, turnNumber);

  try {
    // 1. 获取文档
    const mainDoc = subdocManager.getMainDoc(roomId);
    if (!mainDoc) {
      return { success: false, error: `MainDoc not found: ${roomId}` };
    }

    const turnDoc = subdocManager.getTurnDoc(roomId, turnNumber);
    if (!turnDoc) {
      return {
        success: false,
        error: `TurnDoc not found: ${roomId}:${turnNumber}`,
      };
    }

    // 2. 验证 Host 身份
    const hostCheck = verifyHost(mainDoc, userId);
    if (!hostCheck.success) {
      return hostCheck;
    }

    // 3. 检查行动是否已锁定
    const turnConfig = turnDoc.getMap("config");
    if (!turnConfig.get("isLocked")) {
      return {
        success: false,
        error: "Actions not locked yet",
      };
    }

    // 4. 检查 AI 状态（防止重复调用）
    const currentStatus = getAiStatus(turnDoc);
    if (currentStatus === "processing" || currentStatus === "retrying") {
      return {
        success: false,
        error: `AI is already ${currentStatus}`,
      };
    }

    // 5. 获取激活的预设（叙事预设）
    const presetStore = usePresetStore.getState();
    const narrativePreset = presetStore.activePreset;
    if (!narrativePreset) {
      updateAiStatus(turnDoc, "failed", {
        error: {
          type: "config",
          message: "未配置预设，请在设置中选择预设。",
          retryCount: 0,
        },
      });

      eventBus.emit(
        eventBus.createEvent(RoomEvents.AI_RESPONSE_FAILED, {
          roomId,
          turnNumber,
          errorType: "config",
          errorMessage: "未配置预设，请在设置中选择预设。",
          retryCount: 0,
          failedAt: Date.now(),
        }),
      );

      return {
        success: false,
        error: "No active preset found. Please configure preset in settings.",
      };
    }

    // 6. 获取 AI 配置（支持预设绑定 Profile + 参数覆盖）
    const aiConfig = getHostAiConfig({
      name: narrativePreset.name,
      aiProfileId: narrativePreset.aiProfileId,
      aiSettings: narrativePreset.aiSettings,
    });
    if (!aiConfig) {
      updateAiStatus(turnDoc, "failed", {
        error: {
          type: "auth",
          message: "请先在设置中配置 AI 服务",
          retryCount: 0,
        },
      });

      eventBus.emit(
        eventBus.createEvent(RoomEvents.AI_RESPONSE_FAILED, {
          roomId,
          turnNumber,
          errorType: "auth",
          errorMessage: "请先在设置中配置 AI 服务",
          retryCount: 0,
          failedAt: Date.now(),
        }),
      );

      return {
        success: false,
        error: "AI not configured. Please configure AI service in settings.",
      };
    }

    // 7. 读取行动和成员数据
    const actions = readActionsFromTurnDoc(turnDoc);
    const members = readMembersFromMainDoc(mainDoc);

    if (actions.size === 0) {
      return {
        success: false,
        error: "No actions submitted",
      };
    }

    // 8. 获取房间名称
    const metadataMap = mainDoc.getMap("metadata");
    const roomName = (metadataMap.get("name") as string) || "联机游戏";

    // 9. 构建变量上下文
    const playersList = Array.from(members.values()).map((m) => ({
      name: m.displayName,
    }));

    const actionsList = Array.from(actions.values()).map((a) => ({
      content: a.content,
      timestamp: a.submittedAt,
    }));

    // 构建合并的用户输入文本（联机模式：包含角色名的行动列表）
    const mergedUserInput = Array.from(actions.entries())
      .sort(([, a], [, b]) => a.submittedAt - b.submittedAt)
      .map(([userId, action]) => {
        const member = members.get(userId);
        const displayName = member?.displayName || "未知玩家";
        return `【${displayName}】${action.content}`;
      })
      .join("\n");

    // 9.1 收集在场 NPC 角色（controlType === 'npc' 且 status === 'active'）
    const charactersMap = mainDoc.getMap("characters") as Y.Map<Y.Map<unknown>>;
    const repo = createGameStateRepository(charactersMap, mainDoc);
    const activeNpcs = repo
      .getActiveCharacters()
      .filter((c) => c.controlType === "npc" && c.status === "active");

    // 9.2 计算联机模式记忆注入数据（从 HistoryDoc 获取 assistant 消息）
    const conversationId = `room:${roomId}:main`;
    const historyResult = await subdocManager.getHistoryMessages(
      roomId,
      conversationId,
      { limit: Number.MAX_SAFE_INTEGER },
    );
    const historyMessages = historyResult.items.reverse(); // getHistoryMessages 返回倒序，需要翻转为时间正序
    const assistantMessages = historyMessages
      .filter((m) => m.role === "assistant" && m.content.trim() !== "")
      .map((m) => ({
        id: m.id,
        content: m.content,
        messageIndex: historyMessages.indexOf(m),
      }));

    const memoryData = prepareMemoryData(
      conversationId,
      narrativePreset,
      assistantMessages,
    );

    const variableContext = buildVariableContext("multiplayer", {
      user: { name: roomName },
      players: playersList,
      turn: {
        number: turnNumber,
        actions: actionsList,
      },
      chatHistory: [],
      memoryData,
      activeNpcs: activeNpcs.length > 0 ? activeNpcs : undefined,
      userInput: mergedUserInput,
    });

    // 10. 更新状态为 processing
    updateAiStatus(turnDoc, "processing");

    eventBus.emit(
      eventBus.createEvent(RoomEvents.AI_RESPONSE_STARTED, {
        roomId,
        turnNumber,
        startedAt: Date.now(),
      }),
    );

    // 获取 aiResponse Y.Text
    const aiResponseText = turnDoc.getText("aiResponse");

    // 清空之前的内容
    if (aiResponseText.length > 0) {
      aiResponseText.delete(0, aiResponseText.length);
    }

    // 11. 检查是否有 parser 预设（决定是否走 IRNR 流程）
    const parserPreset = await presetStore.getPresetForPurpose("parser");
    const directorPreset =
      (await presetStore.getPresetForPurpose("director")) ?? undefined;
    const directorAiConfig = directorPreset
      ? getHostAiConfig({
          name: directorPreset.name,
          aiProfileId: directorPreset.aiProfileId,
          aiSettings: directorPreset.aiSettings,
        })
      : undefined;
    const parserPresetId = presetStore.activePresetByPurpose.parser;
    const hasParserPreset = Boolean(parserPresetId && parserPreset);

    if (hasParserPreset && parserPreset) {
      // ── IRNR 流程 ──────────────────────────────────────

      const irnrPipelineService = services.get(IRNR_PIPELINE_SERVICE_TOKEN);
      if (!irnrPipelineService) {
        return {
          success: false,
          error: "IRNR Pipeline Service 未注册",
        };
      }

      // 收集联机角色实体数据（通过 Repository 统一构建）
      const entities = repo.toEntityDataList();

      // D1 fix: 获取第一个玩家角色 ID，用于传入 IRNR Pipeline 作为 actorId
      const firstPlayerCharacterId = repo.getPlayerCharacter()?.id;

      // 更新 resolveStatus
      updateResolveStatus(roomId, turnNumber, "buffered");

      const irnrResult = (await irnrPipelineService.runMultiplayer({
        commandId: `${roomId}:${turnNumber}`,
        roomId,
        turnNumber,
        userInput: actionsList.map((a) => a.content).join("\n"),
        aiConfig,
        narrativePreset,
        parserPreset,
        directorPreset,
        directorAiConfig: directorAiConfig ?? undefined,
        baseVariableContext: variableContext,
        entities,
        actorId: firstPlayerCharacterId, // D1 fix: 显式传入行动者实体 ID
        onNarrativeChunk: (chunk: string) => {
          aiResponseText.insert(aiResponseText.length, chunk);
        },
      })) as {
        success: boolean;
        error?: string;
        resultFrame?: ResultFrame;
        narrativeText?: string;
        finalEntityStates?: Array<{
          id: string;
          fields: Record<string, number | string | boolean>;
          tags: Map<string, import("@/domain/types").TagMetadata>;
        }>;
        createdNpcs?: CreatedNpcData[];
        archiveUpdates?: unknown[];
      };

      if (irnrResult.success) {
        if (irnrResult.resultFrame) {
          writeResultFrameToTurnDoc(roomId, turnNumber, irnrResult.resultFrame);
        } else {
          // 没有 resultFrame 也标记为 committed，避免卡在 buffered
          updateResolveStatus(roomId, turnNumber, "committed");
        }

        // 回写实体最终状态到 MainDoc.characters（通过 Repository Upsert）
        if (irnrResult.finalEntityStates) {
          repo.upsertFromEntityStates(
            irnrResult.finalEntityStates,
            irnrResult.createdNpcs,
          );
        }

        const { commandBus } = await import("@/core");

        // 消费结构化变更（物品/技能 → Inventory 命令）
        if (irnrResult.resultFrame?.structuralChanges) {
          await applyStructuralChanges(
            irnrResult.resultFrame.structuralChanges,
            commandBus,
          );
        }

        // --- 世界档案：通过命令链路同步 NPC 自动建档 + 导演档案更新 ---
        const archiveCommandPayload: SyncPipelineArchiveChangesPayload = {
          currentTurn: turnNumber,
          createdNpcs: irnrResult.createdNpcs,
          archiveUpdates: irnrResult.archiveUpdates,
        };

        if (
          (archiveCommandPayload.createdNpcs?.length ?? 0) > 0 ||
          (archiveCommandPayload.archiveUpdates?.length ?? 0) > 0
        ) {
          const archiveSyncResult = await commandBus.dispatch<
            SyncPipelineArchiveChangesPayload,
            void
          >(
            {
              type: WorldArchiveCommands.SYNC_PIPELINE_CHANGES,
              payload: archiveCommandPayload,
            },
            { correlationId: context.commandId },
          );

          if (!archiveSyncResult.success) {
            console.warn(
              `[WorldArchive] 命令链路同步失败：${archiveSyncResult.error ?? "unknown"}`,
            );
          }
        }

        // === NPC 自动归档检查 ===
        const NPC_AUTO_ARCHIVE_THRESHOLD = 10; // 连续 N 回合未出场则自动归档

        mainDoc.transact(() => {
          charactersMap.forEach((charMap, charId) => {
            const controlType = charMap.get("controlType") as string;
            const status = charMap.get("status") as string;

            if (controlType !== "npc") return;

            if (status === "active") {
              // active NPC：重置缺席计数
              const attrs = charMap.get("attributes") as
                | Record<string, unknown>
                | undefined;
              if (attrs && "_absentTurns" in attrs) {
                charMap.set("attributes", { ...attrs, _absentTurns: 0 });
              }
              return;
            }

            if (status === "off_scene") {
              // off_scene NPC：检查是否在本轮被引用
              const wasReferencedThisTurn = irnrResult.finalEntityStates?.some(
                (s) => s.id === charId,
              );

              if (wasReferencedThisTurn) {
                // 被引用了（可能是状态变更等），重置计数
                return;
              }

              // 增加缺席计数
              const attrs =
                (charMap.get("attributes") as Record<string, unknown>) || {};
              const currentAbsent =
                (typeof attrs._absentTurns === "number"
                  ? attrs._absentTurns
                  : 0) + 1;

              if (currentAbsent >= NPC_AUTO_ARCHIVE_THRESHOLD) {
                // 达到阈值，自动归档
                charMap.set("status", "archived");
                charMap.set("attributes", {
                  ...attrs,
                  _absentTurns: currentAbsent,
                });
                charMap.set("updatedAt", Date.now());
                console.log(
                  `[NPC 自动归档] ${charMap.get(
                    "name",
                  )} 连续 ${currentAbsent} 回合未出场，已归档`,
                );
              } else {
                charMap.set("attributes", {
                  ...attrs,
                  _absentTurns: currentAbsent,
                });
              }
            }
          });
        });

        updateAiStatus(turnDoc, "completed");

        eventBus.emit(
          eventBus.createEvent(RoomEvents.AI_RESPONSE_COMPLETED, {
            roomId,
            turnNumber,
            responseLength: irnrResult.narrativeText?.length || 0,
            completedAt: Date.now(),
          }),
        );

        return { success: true };
      } else {
        // IRNR 失败 → discard
        updateResolveStatus(roomId, turnNumber, "discarded");
        updateAiStatus(turnDoc, "failed", {
          error: {
            type: "unknown",
            message: irnrResult.error ?? "IRNR 流程失败",
            retryCount: 0,
          },
        });

        eventBus.emit(
          eventBus.createEvent(RoomEvents.AI_RESPONSE_FAILED, {
            roomId,
            turnNumber,
            errorType: "unknown",
            errorMessage: irnrResult.error ?? "IRNR 流程失败",
            retryCount: 0,
            failedAt: Date.now(),
          }),
        );

        return {
          success: false,
          error: irnrResult.error ?? "IRNR pipeline failed",
        };
      }
    } else {
      // ── 直连 AI 流程（无 parser 预设） ─────────────────
      // 提示用户 IRNR 未启用（可见提醒，非静默回退）
      const irnrWarning =
        "⚠️ 当前未启用 IRNR 规则结算（未配置 Parser 预设），以下内容为直连叙事生成。\n\n";
      console.warn("[Room AI] 未配置 Parser 预设，IRNR 规则引擎未启用。");
      aiResponseText.insert(aiResponseText.length, irnrWarning);

      const executor = createAiExecutor(aiConfig);
      activeExecutors.set(executorKey, executor);

      const directNarrativeContext = {
        ...variableContext,
        narrativeHints:
          variableContext.narrativeHints ??
          [
            "[导演提示缺省补丁] 当前为无 Parser 预设直连叙事路径。",
            "请在推进剧情时维持与当前场景、角色动机和回合行动的一致性。",
            "可适度铺垫伏笔，但不要断言未经规则结算的机械结果。",
          ].join("\n"),
      };

      const result = await executor.execute({
        preset: narrativePreset,
        variableContext: directNarrativeContext,
        onChunk: (chunk) => {
          aiResponseText.insert(aiResponseText.length, chunk);
        },
        onRetry: (attempt, maxAttempts, error) => {
          updateAiStatus(turnDoc, "retrying");

          eventBus.emit(
            eventBus.createEvent(RoomEvents.AI_RESPONSE_RETRYING, {
              roomId,
              turnNumber,
              attempt,
              maxAttempts,
              errorMessage:
                error instanceof Error ? error.message : String(error),
              retryAt: Date.now(),
            }),
          );
        },
      });

      activeExecutors.delete(executorKey);

      if (result.aborted) {
        return { success: true };
      }

      if (result.success) {
        updateAiStatus(turnDoc, "completed");

        eventBus.emit(
          eventBus.createEvent(RoomEvents.AI_RESPONSE_COMPLETED, {
            roomId,
            turnNumber,
            responseLength: result.content?.length || 0,
            completedAt: Date.now(),
          }),
        );

        return { success: true };
      } else {
        updateAiStatus(turnDoc, "failed", {
          error: result.error,
        });

        eventBus.emit(
          eventBus.createEvent(RoomEvents.AI_RESPONSE_FAILED, {
            roomId,
            turnNumber,
            errorType: result.error?.type || "unknown",
            errorMessage: result.error?.message || "Unknown error",
            retryCount: result.error?.retryCount || 0,
            failedAt: Date.now(),
          }),
        );

        return {
          success: false,
          error: result.error?.message || "AI call failed",
        };
      }
    }
  } catch (error) {
    // 清理执行器
    activeExecutors.delete(executorKey);

    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * 取消 AI 调用命令
 *
 * 流程：
 * 1. 验证 Host 身份
 * 2. 中止执行器
 * 3. 更新状态
 */
export async function cancelAiTurnHandler(
  payload: CancelAiTurnPayload,
  _context: CommandContext,
): Promise<CommandResult<void>> {
  const { roomId, turnNumber, userId, reason } = payload;
  const executorKey = getExecutorKey(roomId, turnNumber);

  try {
    // 1. 获取文档
    const mainDoc = subdocManager.getMainDoc(roomId);
    if (!mainDoc) {
      return { success: false, error: `MainDoc not found: ${roomId}` };
    }

    const turnDoc = subdocManager.getTurnDoc(roomId, turnNumber);
    if (!turnDoc) {
      return {
        success: false,
        error: `TurnDoc not found: ${roomId}:${turnNumber}`,
      };
    }

    // 2. 验证 Host 身份
    const hostCheck = verifyHost(mainDoc, userId);
    if (!hostCheck.success) {
      return hostCheck;
    }

    // 3. 检查当前状态
    const currentStatus = getAiStatus(turnDoc);
    if (currentStatus !== "processing" && currentStatus !== "retrying") {
      return {
        success: false,
        error: `Cannot cancel: AI status is ${currentStatus}`,
      };
    }

    // 4. 中止执行器
    const executor = activeExecutors.get(executorKey);
    if (executor) {
      executor.abort();
      activeExecutors.delete(executorKey);
    }

    // 5. 更新状态
    updateAiStatus(turnDoc, "aborted", {
      aborted: {
        abortedAt: Date.now(),
        reason,
      },
    });

    eventBus.emit(
      eventBus.createEvent(RoomEvents.AI_RESPONSE_CANCELLED, {
        roomId,
        turnNumber,
        reason,
        userId,
        cancelledAt: Date.now(),
      }),
    );

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * 重新生成 AI 响应命令
 *
 * 流程：
 * 1. 如果正在处理，先取消
 * 2. 清空 aiResponse
 * 3. 重新调用 AI
 */
export async function regenerateAiTurnHandler(
  payload: RegenerateAiTurnPayload,
  context: CommandContext,
): Promise<CommandResult<void>> {
  const { roomId, turnNumber, userId } = payload;
  const executorKey = getExecutorKey(roomId, turnNumber);

  try {
    // 1. 获取文档
    const mainDoc = subdocManager.getMainDoc(roomId);
    if (!mainDoc) {
      return { success: false, error: `MainDoc not found: ${roomId}` };
    }

    const turnDoc = subdocManager.getTurnDoc(roomId, turnNumber);
    if (!turnDoc) {
      return {
        success: false,
        error: `TurnDoc not found: ${roomId}:${turnNumber}`,
      };
    }

    // 2. 验证 Host 身份
    const hostCheck = verifyHost(mainDoc, userId);
    if (!hostCheck.success) {
      return hostCheck;
    }

    // 3. 如果正在处理，先取消
    const currentStatus = getAiStatus(turnDoc);
    if (currentStatus === "processing" || currentStatus === "retrying") {
      const executor = activeExecutors.get(executorKey);
      if (executor) {
        executor.abort();
        activeExecutors.delete(executorKey);
      }
    }

    // 4. 清空 aiResponse
    const aiResponseText = turnDoc.getText("aiResponse");
    if (aiResponseText.length > 0) {
      aiResponseText.delete(0, aiResponseText.length);
    }

    // 5. 重置状态
    updateAiStatus(turnDoc, "idle");

    // 6. 重新调用 AI
    return processAiTurnHandler(payload, context);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
