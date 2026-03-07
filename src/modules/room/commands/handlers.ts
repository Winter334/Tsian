/**
 * 房间命令处理器
 *
 * 遵循 DDD + CommandBus 架构：
 * - 所有状态修改都在这里进行
 * - 状态型事件由 SyncBridge 统一派生（基于 Yjs 状态变化）
 * - 意图型事件通过 EventMeta 传递上下文
 * - 本地业务事件仍由 Handler 直接发布
 * - 集成 API 调用和 MultiplayerProvider
 *
 * ⚠️ 架构说明（SyncBridge 改造后）：
 * - Handler 负责状态变更，不直接 emit 可由 SyncBridge 派生的事件
 * - SyncBridge 派生的事件：GAME_STARTED, GAME_ENDED, TURN_STARTED,
 *   MEMBER_JOINED, MEMBER_LEFT/KICKED, HOST_TRANSFERRED, PHASE_ENTERED
 * - Handler 保留的事件：ROOM_CREATED, ACTION_SUBMITTED, ACTION_LOCKED,
 *   PHASE_COMPLETED, PHASE_ADVANCED, TURN_COMPLETED, TURN_DEADLINE_EXTENDED
 *
 * @see plans/room-sync-bridge-proposal.md
 */

import { getMultiplayerConfig } from "@/config/multiplayer";
import { commandBus } from "@/core";
import type { CommandContext, CommandResult } from "@/core/command-bus";
import { eventBus } from "@/core/event-bus";
import type { Member, SaveMemberInfo } from "@/core/yjs";
import {
  apiClient,
  ApiError,
  historyDocProvider,
  multiplayerProvider,
  subdocManager,
  turnDocProvider,
  yjsManager,
} from "@/core/yjs";
import { generateRoomCode } from "@/core/yjs/subdoc-manager";
import {
  MemoryCommands,
  type AddMiniSummaryPayload,
} from "@/domain/commands/memory";
import type {
  CompleteTurnPayload,
  CreateCharacterPayload,
  CreateNpcPayload,
  CreateRoomPayload,
  DeleteRoomPayload,
  JoinRoomPayload,
  KickMemberPayload,
  LeaveRoomPayload,
  QueryRoomPayload,
  QueryRoomResult,
  StartTurnPayload,
  SubmitActionPayload,
  TransferHostPayload,
  UpdateActionPayload,
  UpdateCharacterPayload,
  UpdateNpcInfoPayload,
  UpdateNpcStatusPayload,
  UpdateRoomSettingsPayload,
  WithdrawActionPayload,
} from "@/domain/commands/room";
import {
  canOperateCharacter,
  createCharacter,
  type Character,
} from "@/domain/entities/character";
import {
  RoomEvents,
  type ActionSubmittedEvent,
  type ActionWithdrawnEvent,
  type CharacterCreatedEvent,
  type CharacterUpdatedEvent,
  type NpcCreatedEvent,
  type NpcInfoUpdatedEvent,
  type NpcStatusChangedEvent,
  type RoomCreatedEvent,
  type TurnCompletedEvent,
} from "@/domain/events/room";
import { SaveEvents } from "@/domain/events/save";
import { postProcessNarrativeForPersist } from "@/lib/post-process";
import { usePresetStore } from "@/lib/prompt";
import { computeFullStats } from "@/lib/rules/stats-pipeline";
import { getUniqueTag } from "@/lib/user-identity";
import {
  getRuntimeWorldConfig,
  resolveWorldConfig,
} from "@/lib/world/resolve-config";
import {
  worldConfigFromYMap,
  worldConfigToYMap,
} from "@/lib/world/world-config-codec";
import {
  applyCharacterUpdates,
  characterToYMap,
  yMapToCharacter,
} from "@/modules/game/repository";
import * as Y from "yjs";
import { useRoomStore } from "../store";
import type { HostTransferMeta, MemberActionMeta } from "../sync/types";

// ===== 常量 =====

/** 房间码冲突时的最大重试次数 */
const MAX_CODE_RETRY = 3;

// ===== EventMeta 写入辅助函数 =====

/**
 * 写入成员事件元数据到 Yjs eventMeta Map
 *
 * **这是 EventMeta 成员操作的唯一写入入口。**
 *
 * 用于意图型事件（如 MEMBER_KICKED），在状态变更前记录意图信息，
 * 供 SyncBridge 在 deriveRoomEvents 中通过 EventMetaReader 消费。
 *
 * ⚠️ 架构约束：EventMeta 写入只能在 handler 中进行，
 * SyncBridge 只负责消费（读取+清理）。
 *
 * @param roomId 房间 ID
 * @param userId 用户 ID
 * @param meta 元数据
 */
function writeMemberActionMeta(
  roomId: string,
  userId: string,
  meta: MemberActionMeta,
): void {
  const mainDoc = subdocManager.getMainDoc(roomId);
  if (!mainDoc) {
    console.warn(
      `[RoomHandler] Cannot write member action meta: MainDoc not found for ${roomId}`,
    );
    return;
  }

  mainDoc.transact(() => {
    const eventMetaMap = mainDoc.getMap("eventMeta");

    // 确保 memberActions Map 存在
    let memberActionsMap = eventMetaMap.get("memberActions") as
      | Y.Map<MemberActionMeta>
      | undefined;
    if (!memberActionsMap) {
      memberActionsMap = new Y.Map<MemberActionMeta>();
      eventMetaMap.set("memberActions", memberActionsMap);
    }

    memberActionsMap.set(userId, meta);
  });
}

/**
 * 写入 Host 转让元数据到 Yjs eventMeta Map
 *
 * **这是 EventMeta Host 转让的唯一写入入口。**
 *
 * 用于区分主动转让和自动转让，供 SyncBridge 在 deriveRoomEvents 中
 * 通过 EventMetaReader 消费。
 *
 * ⚠️ 架构约束：EventMeta 写入只能在 handler 中进行，
 * SyncBridge 只负责消费（读取+清理）。
 *
 * @param roomId 房间 ID
 * @param meta 元数据
 */
function writeHostTransferMeta(roomId: string, meta: HostTransferMeta): void {
  const mainDoc = subdocManager.getMainDoc(roomId);
  if (!mainDoc) {
    console.warn(
      `[RoomHandler] Cannot write host transfer meta: MainDoc not found for ${roomId}`,
    );
    return;
  }

  mainDoc.transact(() => {
    const eventMetaMap = mainDoc.getMap("eventMeta");
    eventMetaMap.set("hostTransfer", meta);
  });
}

// ===== 创建房间 =====

/**
 * 创建房间命令处理器
 *
 * 流程：
 * 1. 生成 roomId 和 code
 * 2. 调用 API 注册房间（冲突时自动重试）
 * 3. 获取 Token
 * 4. 创建本地 Yjs 文档
 * 5. 连接 WebSocket
 * 6. 发布事件（触发 Store 更新）
 */
export async function createRoomHandler(
  payload: CreateRoomPayload,
  _context: CommandContext,
): Promise<CommandResult<{ roomId: string; code: string }>> {
  const roomId = crypto.randomUUID();
  const now = Date.now();
  let code: string = "";
  let retryCount = 0;

  // 联机建档的 WorldConfig 默认值来源：当前活动 Preset
  const activePreset = usePresetStore.getState().activePreset;
  const defaultWorldConfig = resolveWorldConfig(activePreset);
  let authoritativeWorldConfig = defaultWorldConfig;

  if (payload.fromSaveId) {
    const saveSlot = yjsManager.getSaveSlots().get(payload.fromSaveId) as
      | Y.Map<unknown>
      | undefined;
    const worldConfigValue = saveSlot?.get("worldConfig");
    if (worldConfigValue instanceof Y.Map) {
      const decodedWorldConfig = worldConfigFromYMap(worldConfigValue);
      if (decodedWorldConfig) {
        authoritativeWorldConfig = decodedWorldConfig;
      }
    }
  }

  // 确保 API 客户端已配置
  const config = getMultiplayerConfig();
  if (!apiClient.getBaseUrl()) {
    apiClient.setBaseUrl(config.apiUrl);
  }

  try {
    // 步骤 1: 注册房间到服务器（带重试）
    while (retryCount < MAX_CODE_RETRY) {
      code = generateRoomCode();

      try {
        await apiClient.registerRoom({
          roomId,
          code,
          hostUserId: payload.hostUserId,
          hostDisplayName: payload.hostDisplayName,
          name: payload.name,
          maxPlayers: payload.maxPlayers,
        });
        break;
      } catch (error) {
        if (error instanceof ApiError && error.status === 409) {
          // 房间码冲突，重试
          retryCount++;
          if (retryCount >= MAX_CODE_RETRY) {
            return {
              success: false,
              error: "无法生成唯一房间码，请稍后重试",
            };
          }
        } else {
          throw error;
        }
      }
    }

    // 步骤 2: 获取 Token
    const tokenResponse = await apiClient.getToken({
      userId: payload.hostUserId,
      roomId,
      role: "host",
    });

    // 步骤 3: 准备 saveId（核心匹配字段）
    // 续玩时使用现有存档的 id，新建时后续创建存档时生成
    // saveId 将在步骤 6 处理存档后写入 MainDoc
    let saveId: string | undefined;
    if (payload.fromSaveId) {
      // 续玩场景：使用现有存档的 id 作为 saveId
      saveId = payload.fromSaveId;
    }
    // 新建场景：saveId 将在创建存档后获取

    // 步骤 4: 创建本地 Yjs 文档
    // 注意：saveId 将在步骤 6 处理存档后写入
    const { mainDoc } = subdocManager.createMainDoc(roomId, {
      name: payload.name,
      hostUserId: payload.hostUserId,
      maxPlayers: payload.maxPlayers,
      turnDuration: payload.turnDuration,
      saveId, // 续玩时传入，新建时为 undefined
    });

    // 写入房间权威 worldConfig（Host 侧来源快照）
    const encodedWorldConfig = worldConfigToYMap(authoritativeWorldConfig);
    const mainDocWorldConfigMap = mainDoc.getMap("worldConfig");
    mainDocWorldConfigMap.set("version", encodedWorldConfig.get("version"));
    mainDocWorldConfigMap.set("data", encodedWorldConfig.get("data"));

    // 更新 mainDoc 的 code（因为 createMainDoc 会生成新的 code，我们需要用服务器确认的 code）
    const metadataMap = mainDoc.getMap("metadata");
    metadataMap.set("code", code);

    // 添加房主作为第一个成员
    const membersMap = mainDoc.getMap("members") as Y.Map<Member>;
    const hostMember: Member = {
      userId: payload.hostUserId,
      displayName: payload.hostDisplayName,
      role: "host",
      joinedAt: now,
      lastActiveAt: now,
      status: "online",
    };
    membersMap.set(payload.hostUserId, hostMember);

    // 步骤 4: 连接 WebSocket
    await multiplayerProvider.connect(
      {
        roomId,
        userId: payload.hostUserId,
        displayName: payload.hostDisplayName,
        role: "host",
        token: tokenResponse.token,
        tokenExpiresAt: tokenResponse.expiresAt,
        wsUrl: config.wsUrl,
        onTokenRefresh: async () => {
          // Token 刷新回调
          return apiClient.getToken({
            userId: payload.hostUserId,
            roomId,
            role: "host",
          });
        },
      },
      mainDoc,
    );

    // 连接 HistoryDoc（复用 MainDoc 的 WebSocket）
    const mpConfig = multiplayerProvider.getConfig();
    if (mpConfig) {
      historyDocProvider.setConfig({
        roomId: mpConfig.roomId,
        token: mpConfig.token,
        wsUrl: mpConfig.wsUrl,
      });
      const historyDoc = await subdocManager.loadHistoryDoc(roomId);
      await historyDocProvider.connect(roomId, historyDoc);
      try {
        await historyDocProvider.waitForSync(roomId, 10000);
      } catch {
        // HistoryDoc 同步超时，继续执行
      }
    }

    // 步骤 5: 设置 localUser（确保事件处理能正确识别当前用户）
    useRoomStore.getState().setLocalUser({
      userId: payload.hostUserId,
      displayName: payload.hostDisplayName,
    });

    // 步骤 6: 处理存档
    // saveId 在步骤 3 已初始化（续玩场景）或在此处创建（新建场景）

    if (payload.fromSaveId) {
      // 从现有存档创建房间（联机续玩场景）
      // 存档已在 App.tsx 的 handleStartNewParty 中加载
      // saveId 已在步骤 3 设置为 payload.fromSaveId

      // 读取存档的 currentTurnNumber 并恢复到 MainDoc
      const saveSlot = yjsManager.getSaveSlots().get(saveId!) as
        | Y.Map<unknown>
        | undefined;
      if (saveSlot) {
        saveSlot.set(
          "worldConfig",
          worldConfigToYMap(authoritativeWorldConfig),
        );

        const savedTurnNumber =
          (saveSlot.get("currentTurnNumber") as number) || 0;
        if (savedTurnNumber > 0) {
          const configMap = mainDoc.getMap("config");
          configMap.set("currentTurnNumber", savedTurnNumber);
        }

        // === 消息迁移：使用 lastRoomId 判断是否需要迁移 ===
        // 续玩时 roomId 会变化，需要将旧的消息迁移到新的 conversationId 下
        const lastRoomId = saveSlot.get("lastRoomId") as string | undefined;

        if (lastRoomId && lastRoomId !== roomId) {
          const oldConversationId = `room:${lastRoomId}:main`;
          const newConversationId = `room:${roomId}:main`;

          const messagesMap = saveSlot.get("messages") as
            | Y.Map<Y.Array<unknown>>
            | undefined;

          if (messagesMap) {
            const oldMessages = messagesMap.get(oldConversationId) as
              | Y.Array<unknown>
              | undefined;

            if (oldMessages && oldMessages.length > 0) {
              const messageCount = oldMessages.length;

              // 使用 Yjs 事务批量操作，避免多次触发变更检测
              const rootDoc = yjsManager.getDoc();
              if (rootDoc) {
                rootDoc.transact(() => {
                  // 创建新的消息数组
                  let newMessages = messagesMap.get(newConversationId) as
                    | Y.Array<unknown>
                    | undefined;
                  if (!newMessages) {
                    newMessages = new Y.Array<unknown>();
                    messagesMap.set(newConversationId, newMessages);
                  }

                  // 批量迁移消息：使用 insert 一次性插入所有消息
                  // 避免逐条 push 导致的性能问题
                  const migratedMessages: unknown[] = [];
                  for (let i = 0; i < messageCount; i++) {
                    const msg = oldMessages.get(i) as Record<string, unknown>;
                    migratedMessages.push({
                      ...msg,
                      conversationId: newConversationId,
                    });
                  }

                  // 一次性插入所有消息
                  newMessages.insert(newMessages.length, migratedMessages);

                  // 删除旧的消息数组（节省空间，避免重复）
                  messagesMap.delete(oldConversationId);
                });
              }
            }
          }

          // archivedTurns 不需要迁移，因为它不依赖 conversationId
        }

        // === 角色恢复：从 SaveSlot 恢复 characters 到 MainDoc ===
        const savedCharacters = saveSlot.get("characters") as
          | Y.Map<Y.Map<unknown>>
          | undefined;

        if (savedCharacters && savedCharacters.size > 0) {
          const charactersMap = mainDoc.getMap("characters") as Y.Map<
            Y.Map<unknown>
          >;

          // 使用 Yjs 事务批量操作
          const rootDoc = yjsManager.getDoc();
          if (rootDoc) {
            rootDoc.transact(() => {
              savedCharacters.forEach((savedCharMap, characterId) => {
                // 检查是否已存在（避免重复添加）
                if (!charactersMap.has(characterId)) {
                  // savedCharMap 已经是 Y.Map，但不能跨 Doc 共享，需要重新创建
                  const newCharMap = characterToYMap(
                    yMapToCharacter(savedCharMap),
                  );
                  charactersMap.set(characterId, newCharMap);
                }
              });
            });
          }
        }
      }

      // 更新存档的房间信息（包括 lastRoomId）
      yjsManager.updateSaveRoomConfig(saveId!, {
        lastRoomId: roomId, // 更新 lastRoomId 为当前 roomId
        roomCode: code,
        maxPlayers: payload.maxPlayers ?? 8,
        turnDuration: payload.turnDuration ?? 5 * 60 * 1000,
      });
    } else {
      // 创建新的联机存档
      const hostMemberInfo: SaveMemberInfo = {
        displayName: payload.hostDisplayName,
        role: "host",
      };

      // 创建存档并获取 saveId
      saveId = yjsManager.createSave({
        name: payload.name || `联机存档 ${code}`,
        type: "multiplayer",
        roomCode: code,
        members: [hostMemberInfo],
      });

      // 写入 WorldConfig 快照（联机建档与单机建档保持一致）
      const createdSave = yjsManager.getSaveSlots().get(saveId) as
        | Y.Map<unknown>
        | undefined;
      if (createdSave) {
        createdSave.set(
          "worldConfig",
          worldConfigToYMap(authoritativeWorldConfig),
        );
      }

      // 将 saveId 写入 MainDoc（新建场景）
      const configMap = mainDoc.getMap("config");
      configMap.set("saveId", saveId);

      // 保存房间配置到存档（包括 lastRoomId）
      yjsManager.updateSaveRoomConfig(saveId, {
        lastRoomId: roomId, // 设置初始 lastRoomId
        maxPlayers: payload.maxPlayers ?? 8,
        turnDuration: payload.turnDuration ?? 5 * 60 * 1000,
      });

      // 加载新创建的存档
      const previousSaveId = yjsManager.getCurrentSaveId();
      yjsManager.loadSave(saveId);

      // 发布 SAVE_CREATED 事件（通知 Chat 模块初始化会话）
      const saveName = payload.name || `联机存档 ${code}`;
      eventBus.emit(
        eventBus.createEvent(SaveEvents.SAVE_CREATED, {
          saveId,
          name: saveName,
        }),
      );

      // 对齐 Save 模块行为：联机建档后也发布 SAVE_LOADED
      eventBus.emit(
        eventBus.createEvent(SaveEvents.SAVE_LOADED, {
          saveId,
          previousSaveId,
          saveType: "multiplayer",
        }),
      );
    }

    // 步骤 7: 发布 ROOM_CREATED 事件（本地业务事件，不由 SyncBridge 派生）
    // 这个事件用于通知 UI 房间创建成功，包含房间码等信息
    const event: RoomCreatedEvent = {
      roomId,
      code,
      name: payload.name,
      hostUserId: payload.hostUserId,
      hostDisplayName: payload.hostDisplayName,
      maxPlayers: payload.maxPlayers ?? 8,
      turnDuration: payload.turnDuration ?? 5 * 60 * 1000,
      createdAt: now,
    };
    eventBus.emit(eventBus.createEvent(RoomEvents.ROOM_CREATED, event));

    // ⚠️ SyncBridge 改造：移除 MEMBER_JOINED 和 CONNECTED 事件的 emit
    // 这些事件将由 SyncBridge 通过 Yjs 状态变化自动派生
    // - MEMBER_JOINED: 由 members Map 变化触发
    // - CONNECTED: 由 MultiplayerProvider 状态回调触发（保留在 index.ts）

    return { success: true, data: { roomId, code } };
  } catch (error) {
    // 清理：如果部分创建成功，需要清理
    if (subdocManager.getMainDoc(roomId)) {
      subdocManager.leaveRoom(roomId);
    }
    multiplayerProvider.disconnect();

    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ===== 加入房间 =====

/**
 * 加入房间命令处理器
 *
 * 流程：
 * 1. 调用 API 查询房间
 * 2. 调用 API 添加成员
 * 3. 获取 Token
 * 4. 加载/创建本地 Yjs 文档
 * 5. 连接 WebSocket
 * 6. 发布事件（触发 Store 更新）
 */
export async function joinRoomHandler(
  payload: JoinRoomPayload,
  _context: CommandContext,
): Promise<CommandResult<{ roomId: string; isHost: boolean }>> {
  const { code, userId, displayName } = payload;
  const now = Date.now();

  // 联机建档的 WorldConfig 本地回退值来源：当前活动 Preset
  const activePreset = usePresetStore.getState().activePreset;
  const fallbackWorldConfig = resolveWorldConfig(activePreset);
  let authoritativeWorldConfig = fallbackWorldConfig;

  const applyAuthoritativeWorldConfigToSave = (saveId: string): void => {
    const saveSlot = yjsManager.getSaveSlots().get(saveId) as
      | Y.Map<unknown>
      | undefined;
    if (saveSlot) {
      saveSlot.set("worldConfig", worldConfigToYMap(authoritativeWorldConfig));
    }
  };

  // 确保 API 客户端已配置
  const config = getMultiplayerConfig();
  if (!apiClient.getBaseUrl()) {
    apiClient.setBaseUrl(config.apiUrl);
  }

  try {
    // 步骤 1: 调用 API 查询房间
    let roomId: string;
    try {
      const queryResponse = await apiClient.queryRoom(code);
      roomId = queryResponse.roomId;
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        return { success: false, error: "房间不存在或已过期" };
      }
      throw error;
    }

    // 步骤 2: 调用 API 添加成员
    try {
      await apiClient.addMember({
        roomId,
        userId,
        displayName,
      });
    } catch (error) {
      // 如果已经是成员，继续流程
      if (!(error instanceof ApiError && error.status === 409)) {
        throw error;
      }
    }

    // 步骤 3: 获取 Token
    const tokenResponse = await apiClient.getToken({
      userId,
      roomId,
      role: "guest",
    });

    // 步骤 4: 加载或创建本地 Yjs 文档
    // 首先检查本地是否有房间引用
    let mainDoc: Y.Doc;
    const localRoomRef = subdocManager.findRoomByCode(code);

    if (localRoomRef) {
      // 本地已有房间引用，加载 MainDoc
      mainDoc = await subdocManager.loadMainDoc(roomId);
    } else {
      // 本地没有房间引用，需要从服务器同步
      // 创建一个空的 MainDoc，不设置任何默认值
      // 这样可以避免覆盖服务器端的房间设置（如 maxPlayers）
      mainDoc = subdocManager.createEmptyMainDoc(roomId);
    }

    // 步骤 5: 连接 WebSocket（先连接，让 Yjs 同步数据）
    // 加入房间的用户默认是 guest（isHost 在同步后确定）
    await multiplayerProvider.connect(
      {
        roomId,
        userId,
        displayName,
        role: "guest", // 加入时默认是 guest
        token: tokenResponse.token,
        tokenExpiresAt: tokenResponse.expiresAt,
        wsUrl: config.wsUrl,
        onTokenRefresh: async () => {
          return apiClient.getToken({
            userId,
            roomId,
            role: "guest",
          });
        },
      },
      mainDoc,
    );

    // 设置 localUser（确保事件处理能正确识别当前用户）
    const store = useRoomStore.getState();
    store.setLocalUser({
      userId,
      displayName,
    });

    // ⚠️ 关键修改：使用 waitForSync 替代硬编码的 500ms 等待
    // 确保 MainDoc 数据同步完成后再进行后续操作
    try {
      await multiplayerProvider.waitForSync(10000);
      console.info("[RoomSyncDiag] joinRoomHandler waitForSync success", {
        roomId,
        userId,
        providerStatus: multiplayerProvider.getStatus(),
      });
    } catch {
      console.warn("[RoomSyncDiag] joinRoomHandler waitForSync timeout", {
        roomId,
        userId,
        providerStatus: multiplayerProvider.getStatus(),
      });
      // MainDoc 同步超时，继续执行
    }

    const mainDocWorldConfigMap = mainDoc.getMap("worldConfig");
    const syncedWorldConfig = worldConfigFromYMap(
      mainDocWorldConfigMap as Y.Map<unknown>,
    );
    if (syncedWorldConfig) {
      authoritativeWorldConfig = syncedWorldConfig;
    }

    // 连接 HistoryDoc（复用 MainDoc 的 WebSocket）
    const mpConfig = multiplayerProvider.getConfig();
    if (mpConfig) {
      historyDocProvider.setConfig({
        roomId: mpConfig.roomId,
        token: mpConfig.token,
        wsUrl: mpConfig.wsUrl,
      });
      const historyDoc = await subdocManager.loadHistoryDoc(roomId);
      await historyDocProvider.connect(roomId, historyDoc);
      try {
        await historyDocProvider.waitForSync(roomId, 10000);
      } catch {
        // HistoryDoc 同步超时，继续执行
      }
    }

    // 获取成员信息（同步后应该能看到其他成员）
    const membersMap = mainDoc.getMap("members") as Y.Map<Member>;
    const existingMember = membersMap.get(userId);
    const isHost = existingMember?.role === "host";

    console.info("[RoomSyncDiag] joinRoomHandler before member patch", {
      roomId,
      userId,
      membersSizeBeforePatch: membersMap.size,
      existingMemberRole: existingMember?.role ?? null,
      existingMemberStatus: existingMember?.status ?? null,
    });

    // 如果是新成员，添加到文档
    if (!existingMember) {
      const newMember: Member = {
        userId,
        displayName,
        role: "guest",
        joinedAt: now,
        lastActiveAt: now,
        status: "online",
      };
      membersMap.set(userId, newMember);
    } else {
      // 更新在线状态
      const updatedMember: Member = {
        ...existingMember,
        status: "online",
        lastActiveAt: now,
      };
      membersMap.set(userId, updatedMember);
    }

    // 从 mainDoc 获取房间信息（同步后应该有正确的值）
    const metadataMap = mainDoc.getMap("metadata");
    const roomName = (metadataMap.get("name") as string) || `Room ${code}`;
    const maxPlayers = (metadataMap.get("maxPlayers") as number) || 8;
    const turnDuration =
      (metadataMap.get("turnDuration") as number) || 5 * 60 * 1000;

    // 直接设置 currentRoom（避免事件处理中信息丢失）
    store.setCurrentRoom({
      roomId,
      code,
      name: roomName,
      isHost,
      maxPlayers,
      turnDuration,
    });

    // 加载当前回合（如果有）并连接 TurnDoc
    const configMap = mainDoc.getMap("config");
    const currentTurnNumber =
      (configMap.get("currentTurnNumber") as number) || 0;
    if (currentTurnNumber > 0) {
      // 设置 TurnDocProvider 配置
      const mpConfig = multiplayerProvider.getConfig();
      if (mpConfig) {
        turnDocProvider.setConfig({
          roomId: mpConfig.roomId,
          token: mpConfig.token,
          wsUrl: mpConfig.wsUrl,
        });
      }

      // ⚠️ 关键修改：区分 Host 和 Guest 的 TurnDoc 处理
      // - Host: 使用 createTurnDoc() 初始化完整结构
      // - Guest: 使用 joinTurnDoc() 创建空壳，等待服务器填充
      let turnDoc = subdocManager.getTurnDoc(roomId, currentTurnNumber);
      if (!turnDoc) {
        if (isHost) {
          // Host 重连时创建完整结构（理论上不应该走到这里，因为 Host 创建房间时已创建）
          turnDoc = subdocManager.createTurnDoc(roomId, currentTurnNumber);
        } else {
          // Guest 加入时使用 joinTurnDoc，不初始化结构
          turnDoc = subdocManager.joinTurnDoc(roomId, currentTurnNumber);
        }
      }
      await turnDocProvider.connect(roomId, currentTurnNumber, turnDoc);

      // 等待 TurnDoc 同步完成
      try {
        await turnDocProvider.waitForSync(roomId, currentTurnNumber, 10000);
      } catch {
        // TurnDoc 同步超时，继续执行
      }
    }

    // === Guest 存档处理：使用 saveId 匹配存档 ===
    // saveId 是核心匹配字段，所有玩家使用相同的 saveId
    const saves = yjsManager.listSaves();
    const currentSaveId = yjsManager.getCurrentSaveId();

    // 从 MainDoc 读取 saveId（核心匹配字段）
    // 复用上面已获取的 configMap
    const hostSaveId = configMap.get("saveId") as string | undefined;

    // 使用 saveId 匹配存档（100% 可靠）
    // saveId 就是存档的 id，所有玩家使用相同的 saveId
    const matchedSave = hostSaveId
      ? saves.find((s) => s.id === hostSaveId)
      : undefined;

    // 检查当前存档是否匹配
    const isCurrentMatching = currentSaveId === hostSaveId;

    let guestSaveId: string | null = currentSaveId ?? null;

    if (!isCurrentMatching) {
      if (matchedSave) {
        // 找到匹配的存档，加载它
        const previousSaveId = yjsManager.getCurrentSaveId();
        yjsManager.loadSave(matchedSave.id);
        guestSaveId = matchedSave.id;

        // matchedSave 路径也必须执行 Host 权威 worldConfig 回填，避免沿用本地旧配置
        applyAuthoritativeWorldConfigToSave(matchedSave.id);

        // 对齐 Save 模块行为：联机入房加载存档后发布 SAVE_LOADED
        eventBus.emit(
          eventBus.createEvent(SaveEvents.SAVE_LOADED, {
            saveId: matchedSave.id,
            previousSaveId,
            saveType: "multiplayer",
          }),
        );
      } else if (hostSaveId) {
        // 没有找到匹配的存档，使用 createSaveWithId 创建相同 saveId 的存档
        const guestMemberInfo: SaveMemberInfo = {
          displayName,
          role: isHost ? "host" : "guest",
        };

        // 使用 createSaveWithId 创建与 Host 相同 saveId 的存档
        guestSaveId = yjsManager.createSaveWithId(hostSaveId, {
          name: `联机存档 ${code}`,
          type: "multiplayer",
          roomCode: code,
          members: [guestMemberInfo],
        });

        // 写入 WorldConfig 快照（联机建档与单机建档保持一致）
        const createdGuestSave = yjsManager.getSaveSlots().get(guestSaveId) as
          | Y.Map<unknown>
          | undefined;
        if (createdGuestSave) {
          createdGuestSave.set(
            "worldConfig",
            worldConfigToYMap(authoritativeWorldConfig),
          );
        }

        const previousSaveId = yjsManager.getCurrentSaveId();
        yjsManager.loadSave(guestSaveId);

        // 对齐 Save 模块行为：联机入房创建并加载存档后发布 SAVE_LOADED
        eventBus.emit(
          eventBus.createEvent(SaveEvents.SAVE_LOADED, {
            saveId: guestSaveId,
            previousSaveId,
            saveType: "multiplayer",
          }),
        );
      } else {
        // 兼容旧逻辑：如果 MainDoc 没有 saveId，回退到创建新存档
        const guestMemberInfo: SaveMemberInfo = {
          displayName,
          role: isHost ? "host" : "guest",
        };

        guestSaveId = yjsManager.createSave({
          name: `联机存档 ${code}`,
          type: "multiplayer",
          roomCode: code,
          members: [guestMemberInfo],
        });

        // 写入 WorldConfig 快照（兼容旧房间缺失 saveId 的回退建档路径）
        const fallbackGuestSave = yjsManager.getSaveSlots().get(guestSaveId) as
          | Y.Map<unknown>
          | undefined;
        if (fallbackGuestSave) {
          fallbackGuestSave.set(
            "worldConfig",
            worldConfigToYMap(authoritativeWorldConfig),
          );
        }

        const previousSaveId = yjsManager.getCurrentSaveId();
        yjsManager.loadSave(guestSaveId);

        // 对齐 Save 模块行为：联机入房创建并加载存档后发布 SAVE_LOADED
        eventBus.emit(
          eventBus.createEvent(SaveEvents.SAVE_LOADED, {
            saveId: guestSaveId,
            previousSaveId,
            saveType: "multiplayer",
          }),
        );
      }
    }

    // === Guest 消息迁移：使用 lastRoomId 判断是否需要迁移 ===
    if (guestSaveId) {
      const saveSlot = yjsManager.getSaveSlots().get(guestSaveId) as
        | Y.Map<unknown>
        | undefined;
      if (saveSlot) {
        // 使用 lastRoomId 判断是否需要迁移
        const lastRoomId = saveSlot.get("lastRoomId") as string | undefined;

        if (lastRoomId && lastRoomId !== roomId) {
          const oldConversationId = `room:${lastRoomId}:main`;
          const newConversationId = `room:${roomId}:main`;

          const messagesMap = saveSlot.get("messages") as
            | Y.Map<Y.Array<unknown>>
            | undefined;

          if (messagesMap) {
            const oldMessages = messagesMap.get(oldConversationId) as
              | Y.Array<unknown>
              | undefined;

            if (oldMessages && oldMessages.length > 0) {
              const messageCount = oldMessages.length;

              const rootDoc = yjsManager.getDoc();
              if (rootDoc) {
                rootDoc.transact(() => {
                  let newMessages = messagesMap.get(newConversationId) as
                    | Y.Array<unknown>
                    | undefined;
                  if (!newMessages) {
                    newMessages = new Y.Array<unknown>();
                    messagesMap.set(newConversationId, newMessages);
                  }

                  const migratedMessages: unknown[] = [];
                  for (let i = 0; i < messageCount; i++) {
                    const msg = oldMessages.get(i) as Record<string, unknown>;
                    migratedMessages.push({
                      ...msg,
                      conversationId: newConversationId,
                    });
                  }

                  newMessages.insert(newMessages.length, migratedMessages);
                  messagesMap.delete(oldConversationId);
                });
              }
            }
          }
        }
      }
    }

    // 更新存档的房间配置（包括 lastRoomId）
    if (guestSaveId) {
      yjsManager.updateSaveRoomConfig(guestSaveId, {
        lastRoomId: roomId, // 更新 lastRoomId 为当前 roomId
        roomCode: code,
        maxPlayers,
        turnDuration,
      });
    }

    // ⚠️ SyncBridge 改造：移除 MEMBER_JOINED 和 CONNECTED 事件的 emit
    // 这些事件将由 SyncBridge 通过 Yjs 状态变化自动派生
    // - MEMBER_JOINED: 由 members Map 变化触发（成员添加到 membersMap 时）
    // - CONNECTED: 由 MultiplayerProvider 状态回调触发（保留在 index.ts）

    // === 跨设备续玩优化：更新角色的 operatorUserId ===
    // 当用户通过 uniqueTag 匹配到角色时，更新 operatorUserId 为当前设备的 userId
    // 这样后续操作可以直接通过 userId 匹配，更高效
    const uniqueTag = getUniqueTag();
    if (uniqueTag) {
      const charactersMap = mainDoc.getMap("characters") as Y.Map<
        Y.Map<unknown>
      >;
      charactersMap.forEach((charMap) => {
        const operatorUniqueTag = charMap.get("operatorUniqueTag") as string;
        const operatorUserId = charMap.get("operatorUserId") as string;

        // 如果 uniqueTag 匹配但 userId 不匹配，说明是跨设备续玩
        if (operatorUniqueTag === uniqueTag && operatorUserId !== userId) {
          charMap.set("operatorUserId", userId);
          charMap.set("updatedAt", now);
        }
      });
    }

    return { success: true, data: { roomId, isHost } };
  } catch (error) {
    // 清理
    multiplayerProvider.disconnect();

    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ===== 离开房间 =====

/**
 * 离开房间命令处理器
 *
 * 流程：
 * 1. 检查是否为房主
 * 2. 如果是房主，设置 disbanded 标记（通知其他成员）
 * 3. 写入 EventMeta（供 SyncBridge 派生正确事件类型）
 * 4. 从 Yjs 文档中删除成员（触发同步）
 * 5. 通知后端移除成员
 * 6. 断开 WebSocket 连接
 * 7. 卸载本地文档
 * 8. 如果是房主，通知服务器删除房间
 *
 * ⚠️ SyncBridge 改造：
 * - MEMBER_LEFT 事件由 SyncBridge 派生（基于 membersLeft 变化）
 * - 通过 EventMeta 传递 "leave" 意图，派生正确的事件类型
 * - DISCONNECTED 事件由 MultiplayerProvider 状态回调触发
 */
export async function leaveRoomHandler(
  payload: LeaveRoomPayload,
  _context: CommandContext,
): Promise<CommandResult<void>> {
  try {
    const { roomId, userId } = payload;
    const now = Date.now();

    const mainDoc = subdocManager.getMainDoc(roomId);
    let isHost = false;

    if (!mainDoc) {
      // 如果没有本地文档，只需断开连接
      multiplayerProvider.disconnect();
      return { success: true };
    }

    // 检查是否为房主
    const metadataMap = mainDoc.getMap("metadata");
    const hostUserId = metadataMap.get("hostUserId") as string | undefined;
    isHost = hostUserId === userId;

    const membersMap = mainDoc.getMap("members") as Y.Map<Member>;
    const member = membersMap.get(userId);

    if (isHost) {
      // 房主解散房间：设置 disbanded 标记（这会通过 Yjs 同步到其他成员）
      metadataMap.set("disbanded", true);
      metadataMap.set("disbandedAt", now);

      // 等待一小段时间让 Yjs 同步 disbanded 标记
      await new Promise((resolve) => setTimeout(resolve, 300));
    } else if (member) {
      // ⚠️ SyncBridge 改造：先写入 EventMeta，再删除成员
      // 这样 SyncBridge 在检测到成员离开时可以读取元数据派生正确的事件类型
      writeMemberActionMeta(roomId, userId, {
        action: "leave",
        at: now,
      });

      // 非房主：从成员列表中删除（这会通过 Yjs 同步到其他客户端）
      membersMap.delete(userId);
    }

    // ⚠️ SyncBridge 改造：移除 MEMBER_LEFT 和 DISCONNECTED 事件的 emit
    // 这些事件将由 SyncBridge 和 MultiplayerProvider 自动派生
    // - MEMBER_LEFT: 由 SyncBridge 派生（基于 membersLeft + EventMeta）
    // - DISCONNECTED: 由 MultiplayerProvider 状态回调触发

    // 非房主：通知后端移除成员
    if (!isHost) {
      try {
        await apiClient.removeMember({ roomId, userId });
      } catch {
        // 移除失败不影响离开流程
      }
    }

    // 断开 HistoryDoc 连接
    historyDocProvider.disconnect(roomId);

    // 断开所有 TurnDoc 连接
    turnDocProvider.disconnectAll();

    // 断开 WebSocket 连接
    multiplayerProvider.disconnect();

    // 卸载本地文档缓存
    subdocManager.leaveRoom(roomId);

    // 如果是房主，通知服务器删除房间
    if (isHost) {
      try {
        await apiClient.deleteRoom(roomId, userId);
      } catch {
        // 删除失败不影响离开流程
      }
    }

    return { success: true };
  } catch (error) {
    // 确保断开连接
    multiplayerProvider.disconnect();

    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ===== 更新成员状态 =====

interface UpdateMemberStatusPayload {
  roomId: string;
  userId: string;
  status: "online" | "away" | "offline";
}

/**
 * 更新成员状态命令处理器
 */
export async function updateMemberStatusHandler(
  payload: UpdateMemberStatusPayload,
  _context: CommandContext,
): Promise<CommandResult<void>> {
  try {
    const { roomId, userId, status } = payload;

    const mainDoc = subdocManager.getMainDoc(roomId);
    if (!mainDoc) {
      return { success: false, error: `MainDoc not found: ${roomId}` };
    }

    const membersMap = mainDoc.getMap("members") as Y.Map<Member>;
    const member = membersMap.get(userId);

    if (member) {
      const updatedMember: Member = {
        ...member,
        status,
        lastActiveAt: Date.now(),
      };
      membersMap.set(userId, updatedMember);

      // 发布事件
      eventBus.emit(
        eventBus.createEvent(RoomEvents.MEMBER_STATUS_UPDATED, {
          roomId,
          userId,
          status,
        }),
      );
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ===== 开始新回合 =====

/**
 * 开始新回合命令处理器
 */
export async function startTurnHandler(
  payload: StartTurnPayload,
  _context: CommandContext,
): Promise<CommandResult<{ turnNumber: number }>> {
  try {
    const { roomId, duration } = payload;
    const now = Date.now();

    const mainDoc = subdocManager.getMainDoc(roomId);
    if (!mainDoc) {
      return { success: false, error: `MainDoc not found: ${roomId}` };
    }

    // 获取当前回合号并递增
    const configMap = mainDoc.getMap("config");
    const currentTurnNumber =
      (configMap.get("currentTurnNumber") as number) || 0;
    const newTurnNumber = currentTurnNumber + 1;

    // 获取回合时长
    const metadataMap = mainDoc.getMap("metadata");
    const turnDuration =
      duration || (metadataMap.get("turnDuration") as number) || 5 * 60 * 1000;
    const deadline = now + turnDuration;

    // 断开旧回合的 TurnDoc
    if (currentTurnNumber > 0) {
      turnDocProvider.disconnect(roomId, currentTurnNumber);
    }

    // 创建新回合文档
    const turnDoc = subdocManager.createTurnDoc(
      roomId,
      newTurnNumber,
      deadline,
    );

    // 更新 MainDoc 的当前回合号
    configMap.set("currentTurnNumber", newTurnNumber);

    // 在 MainDoc 中注册引用
    const turnDocRefs = mainDoc.getMap("turnDocRefs");
    turnDocRefs.set(String(newTurnNumber), turnDoc.guid);

    // 连接新回合的 TurnDoc
    const mpConfig = multiplayerProvider.getConfig();
    if (mpConfig) {
      turnDocProvider.setConfig({
        roomId: mpConfig.roomId,
        token: mpConfig.token,
        wsUrl: mpConfig.wsUrl,
      });
      await turnDocProvider.connect(roomId, newTurnNumber, turnDoc);
    }

    // ⚠️ SyncBridge 改造：移除 TURN_STARTED 事件的 emit
    // 这个事件将由 SyncBridge 通过检测 currentTurnNumber 变化自动派生

    return { success: true, data: { turnNumber: newTurnNumber } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ===== 提交行动 =====

/**
 * 提交行动命令处理器
 */
export async function submitActionHandler(
  payload: SubmitActionPayload,
  _context: CommandContext,
): Promise<CommandResult<void>> {
  try {
    const { roomId, turnNumber, userId, content, metadata } = payload;
    const now = Date.now();

    const turnDoc = subdocManager.getTurnDoc(roomId, turnNumber);
    if (!turnDoc) {
      return {
        success: false,
        error: `TurnDoc not found: ${roomId}:${turnNumber}`,
      };
    }

    // 添加行动
    const actionsMap = turnDoc.getMap("actions");
    actionsMap.set(userId, {
      userId,
      content,
      submittedAt: now,
      metadata,
    });

    // 获取已提交数量
    const submittedCount = actionsMap.size;
    const totalPlayers = subdocManager.getMemberCount(roomId);

    // 发布事件
    const event: ActionSubmittedEvent = {
      roomId,
      turnNumber,
      userId,
      submittedAt: now,
      submittedCount,
      totalPlayers,
    };
    eventBus.emit(eventBus.createEvent(RoomEvents.ACTION_SUBMITTED, event));

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * 撤回行动命令处理器
 */
export async function withdrawActionHandler(
  payload: WithdrawActionPayload,
  _context: CommandContext,
): Promise<CommandResult<void>> {
  try {
    const { roomId, turnNumber, userId, operatorId } = payload;
    const now = Date.now();

    if (!operatorId || !userId) {
      return {
        success: false,
        error: "Invalid action operator",
      };
    }

    const localUserId = useRoomStore.getState().localUser.userId;
    if (!localUserId || localUserId !== operatorId) {
      return {
        success: false,
        error: "Invalid action operator",
      };
    }

    const mainDoc = subdocManager.getMainDoc(roomId);
    if (!mainDoc) {
      return { success: false, error: `MainDoc not found: ${roomId}` };
    }

    const membersMap = mainDoc.getMap("members") as Y.Map<Member>;
    if (!membersMap.has(userId) || !membersMap.has(operatorId)) {
      return {
        success: false,
        error: "Only room members can withdraw action",
      };
    }

    const canWithdrawSelf = operatorId === userId;
    const canWithdrawAsHost =
      operatorId !== userId && subdocManager.isHost(roomId, operatorId);
    if (!canWithdrawSelf && !canWithdrawAsHost) {
      return {
        success: false,
        error: "Only self or host can withdraw action",
      };
    }

    const turnDoc = subdocManager.getTurnDoc(roomId, turnNumber);
    if (!turnDoc) {
      return {
        success: false,
        error: `TurnDoc not found: ${roomId}:${turnNumber}`,
      };
    }

    const configMap = turnDoc.getMap("config");
    const status = configMap.get("status") as string | undefined;
    if (status === "completed") {
      return {
        success: false,
        error: "Cannot withdraw action in completed turn",
      };
    }

    const isLocked = Boolean(configMap.get("isLocked"));
    if (isLocked) {
      return {
        success: false,
        error: "Cannot withdraw action after turn is locked",
      };
    }

    const actionsMap = turnDoc.getMap("actions");
    if (!actionsMap.has(userId)) {
      return {
        success: false,
        error: `No submitted action found for user: ${userId}`,
      };
    }

    actionsMap.delete(userId);

    const submittedCount = actionsMap.size;
    const totalPlayers = subdocManager.getMemberCount(roomId);

    const event: ActionWithdrawnEvent = {
      roomId,
      turnNumber,
      userId,
      operatorId,
      withdrawnAt: now,
      submittedCount,
      totalPlayers,
    };
    eventBus.emit(eventBus.createEvent(RoomEvents.ACTION_WITHDRAWN, event));

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ===== 转让房主 =====

/**
 * 转让房主命令处理器
 */
export async function transferHostHandler(
  payload: TransferHostPayload,
  _context: CommandContext,
): Promise<CommandResult<void>> {
  try {
    const { roomId, currentHostId, newHostId } = payload;
    const now = Date.now();

    const mainDoc = subdocManager.getMainDoc(roomId);
    if (!mainDoc) {
      return { success: false, error: `MainDoc not found: ${roomId}` };
    }

    const membersMap = mainDoc.getMap("members") as Y.Map<Member>;
    const currentHost = membersMap.get(currentHostId);
    const newHost = membersMap.get(newHostId);

    if (!currentHost || currentHost.role !== "host") {
      return {
        success: false,
        error: `Current host not found or not a host: ${currentHostId}`,
      };
    }

    if (!newHost) {
      return { success: false, error: `New host not found: ${newHostId}` };
    }

    // ⚠️ SyncBridge 改造：先写入 EventMeta，再更新状态
    // 这样 SyncBridge 在检测到 hostUserId 变化时可以读取元数据派生正确的事件类型
    writeHostTransferMeta(roomId, {
      from: currentHostId,
      to: newHostId,
      type: "manual",
      at: now,
    });

    // 更新角色
    membersMap.set(currentHostId, { ...currentHost, role: "guest" });
    membersMap.set(newHostId, { ...newHost, role: "host" });

    // 更新 metadata
    const metadataMap = mainDoc.getMap("metadata");
    metadataMap.set("hostUserId", newHostId);
    metadataMap.set("updatedAt", now);

    // ⚠️ SyncBridge 改造：移除 HOST_TRANSFERRED 事件的 emit
    // 这个事件将由 SyncBridge 通过检测 hostUserId 变化 + EventMeta 自动派生

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ===== 查询房间 =====

/**
 * 查询房间命令处理器
 *
 * 用于加入房间前预览房间信息
 *
 * 流程：
 * 1. 调用 API 查询房间
 * 2. 返回房间预览信息
 */
export async function queryRoomHandler(
  payload: QueryRoomPayload,
  _context: CommandContext,
): Promise<CommandResult<QueryRoomResult>> {
  const { code } = payload;

  // 确保 API 客户端已配置
  const config = getMultiplayerConfig();
  if (!apiClient.getBaseUrl()) {
    apiClient.setBaseUrl(config.apiUrl);
  }

  try {
    // 调用 API 查询房间详情
    const queryResponse = await apiClient.queryRoomDetails(code);

    return {
      success: true,
      data: {
        roomId: queryResponse.roomId,
        name: queryResponse.name || `房间 ${code}`,
        hostName: queryResponse.hostDisplayName || "未知",
        memberCount: queryResponse.memberCount || 1,
        maxPlayers: queryResponse.maxPlayers || 8,
      },
    };
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status === 404) {
        return { success: false, error: "房间不存在或已过期" };
      }
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ===== Phase 管理 =====

import type {
  AdvancePhasePayload,
  CompletePhasePayload,
  EndGamePayload,
  EnterPhasePayload,
  StartGamePayload,
} from "@/domain/commands/room";
import {
  createPhaseInstance,
  DEFAULT_FLOW_TEMPLATE,
  getNextPhaseInfo,
  PhaseTypes,
  type PhaseInstance,
  type PhaseType,
} from "@/domain/entities/phase";
import type {
  PhaseAdvancedEvent,
  PhaseCompletedEvent,
} from "@/domain/events/room";

/**
 * 进入阶段命令处理器
 *
 * 创建一个新的阶段实例并将其设置为当前阶段
 */
export async function enterPhaseHandler(
  payload: EnterPhasePayload,
  _context: CommandContext,
): Promise<CommandResult<{ phaseId: string }>> {
  try {
    const { roomId, phaseType, configOverride, turnNumber } = payload;

    const mainDoc = subdocManager.getMainDoc(roomId);
    if (!mainDoc) {
      return { success: false, error: `MainDoc not found: ${roomId}` };
    }

    // 创建阶段实例
    const phaseInstance = createPhaseInstance(
      phaseType as PhaseType,
      configOverride,
    );

    // 根据 turnNumber 决定存储位置
    if (turnNumber === 0) {
      // 预游戏阶段，存储在 MainDoc.preGamePhases
      const preGamePhases = mainDoc.getArray("preGamePhases");
      preGamePhases.push([phaseInstance]);
    } else {
      // 回合内阶段，存储在 TurnDoc.phases
      const turnDoc = subdocManager.getTurnDoc(roomId, turnNumber);
      if (!turnDoc) {
        return {
          success: false,
          error: `TurnDoc not found: ${roomId}:${turnNumber}`,
        };
      }
      const phases = turnDoc.getArray("phases");
      phases.push([phaseInstance]);

      // 更新 TurnDoc 的当前阶段索引
      turnDoc.getMap("config").set("currentPhaseIndex", phases.length - 1);
    }

    // 更新 MainDoc 的当前阶段 ID
    const configMap = mainDoc.getMap("config");
    configMap.set("currentPhaseId", phaseInstance.id);

    // ⚠️ SyncBridge 改造：移除 PHASE_ENTERED 事件的 emit
    // 这个事件将由 SyncBridge 通过检测 currentPhaseId 变化自动派生

    return { success: true, data: { phaseId: phaseInstance.id } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * 完成当前阶段命令处理器
 */
export async function completePhaseHandler(
  payload: CompletePhasePayload,
  _context: CommandContext,
): Promise<CommandResult<void>> {
  try {
    const { roomId, phaseId, data } = payload;
    const now = Date.now();

    const mainDoc = subdocManager.getMainDoc(roomId);
    if (!mainDoc) {
      return { success: false, error: `MainDoc not found: ${roomId}` };
    }

    const configMap = mainDoc.getMap("config");
    const currentPhaseId = configMap.get("currentPhaseId") as string | null;

    if (currentPhaseId !== phaseId) {
      return {
        success: false,
        error: `Phase ID mismatch: expected ${currentPhaseId}, got ${phaseId}`,
      };
    }

    const currentTurnNumber =
      (configMap.get("currentTurnNumber") as number) || 0;

    // 查找并更新阶段实例
    let phaseInstance: PhaseInstance | null = null;
    let phaseType: string = "";

    if (currentTurnNumber === 0) {
      // 预游戏阶段
      const preGamePhases = mainDoc.getArray("preGamePhases");
      for (let i = 0; i < preGamePhases.length; i++) {
        const phase = preGamePhases.get(i) as PhaseInstance;
        if (phase.id === phaseId) {
          phaseInstance = {
            ...phase,
            completedAt: now,
            data: { ...phase.data, ...data },
            updatedAt: now,
          };
          phaseType = phase.type;
          preGamePhases.delete(i);
          preGamePhases.insert(i, [phaseInstance]);
          break;
        }
      }
    } else {
      // 回合内阶段
      const turnDoc = subdocManager.getTurnDoc(roomId, currentTurnNumber);
      if (turnDoc) {
        const phases = turnDoc.getArray("phases");
        for (let i = 0; i < phases.length; i++) {
          const phase = phases.get(i) as PhaseInstance;
          if (phase.id === phaseId) {
            phaseInstance = {
              ...phase,
              completedAt: now,
              data: { ...phase.data, ...data },
              updatedAt: now,
            };
            phaseType = phase.type;
            phases.delete(i);
            phases.insert(i, [phaseInstance]);
            break;
          }
        }
      }
    }

    if (!phaseInstance) {
      return { success: false, error: `Phase not found: ${phaseId}` };
    }

    // 发布事件
    const event: PhaseCompletedEvent = {
      roomId,
      phaseId,
      phaseType,
      turnNumber: currentTurnNumber,
      data: phaseInstance.data,
      completedAt: now,
    };
    eventBus.emit(eventBus.createEvent(RoomEvents.PHASE_COMPLETED, event));

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * 推进到下一阶段命令处理器
 *
 * 自动根据流程模板决定下一阶段
 */
export async function advancePhaseHandler(
  payload: AdvancePhasePayload,
  _context: CommandContext,
): Promise<CommandResult<{ nextPhaseId: string; isNewTurn: boolean }>> {
  try {
    const { roomId } = payload;
    const now = Date.now();

    const mainDoc = subdocManager.getMainDoc(roomId);
    if (!mainDoc) {
      return { success: false, error: `MainDoc not found: ${roomId}` };
    }

    const configMap = mainDoc.getMap("config");
    const currentPhaseId = configMap.get("currentPhaseId") as string | null;
    const currentTurnNumber =
      (configMap.get("currentTurnNumber") as number) || 0;
    const currentPhaseIndex =
      (configMap.get("currentPhaseIndex") as number) || 0;

    // 获取当前阶段类型
    let currentPhaseType: PhaseType | null = null;

    if (currentTurnNumber === 0) {
      const preGamePhases = mainDoc.getArray("preGamePhases");
      if (preGamePhases.length > 0) {
        const lastPhase = preGamePhases.get(
          preGamePhases.length - 1,
        ) as PhaseInstance;
        currentPhaseType = lastPhase.type as PhaseType;
      }
    } else {
      const turnDoc = subdocManager.getTurnDoc(roomId, currentTurnNumber);
      if (turnDoc) {
        const phases = turnDoc.getArray("phases");
        if (phases.length > 0) {
          const lastPhase = phases.get(phases.length - 1) as PhaseInstance;
          currentPhaseType = lastPhase.type as PhaseType;
        }
      }
    }

    if (!currentPhaseType) {
      return { success: false, error: "No current phase to advance from" };
    }

    // 使用默认流程模板计算下一阶段
    const nextInfo = getNextPhaseInfo(
      DEFAULT_FLOW_TEMPLATE,
      currentPhaseType,
      currentTurnNumber,
      currentPhaseIndex,
    );

    if (!nextInfo) {
      // 流程结束
      return { success: false, error: "Flow has ended, no next phase" };
    }

    const { nextPhase, nextTurnNumber, nextPhaseIndex, isNewTurn } = nextInfo;

    // 如果是新回合，需要先创建 TurnDoc
    // ⚠️ 关键修改：只有 Host 才能创建新回合的 TurnDoc
    // Guest 的回合切换由 RoomSyncBridge 监听 currentTurnNumber 变化自动处理
    if (isNewTurn && nextTurnNumber > 0) {
      // 获取当前用户是否为 Host
      const store = useRoomStore.getState();
      const isHost = store.currentRoom?.isHost ?? false;

      // 断开旧回合的 TurnDoc
      if (currentTurnNumber > 0) {
        turnDocProvider.disconnect(roomId, currentTurnNumber);
      }

      if (isHost) {
        // Host: 创建新回合的 TurnDoc 并初始化完整结构
        const metadataMap = mainDoc.getMap("metadata");
        const turnDuration =
          (metadataMap.get("turnDuration") as number) || 5 * 60 * 1000;
        const deadline = now + turnDuration;

        const newTurnDoc = subdocManager.createTurnDoc(
          roomId,
          nextTurnNumber,
          deadline,
        );

        // 更新 MainDoc 的当前回合号（这会触发 Guest 的 RoomSyncBridge 自动切换）
        configMap.set("currentTurnNumber", nextTurnNumber);

        // 在 MainDoc 中注册引用
        const turnDocRefs = mainDoc.getMap("turnDocRefs");
        turnDocRefs.set(String(nextTurnNumber), newTurnDoc.guid);

        // 连接新回合的 TurnDoc
        const mpConfig = multiplayerProvider.getConfig();
        if (mpConfig) {
          turnDocProvider.setConfig({
            roomId: mpConfig.roomId,
            token: mpConfig.token,
            wsUrl: mpConfig.wsUrl,
          });
          await turnDocProvider.connect(roomId, nextTurnNumber, newTurnDoc);
        }
      } else {
        // Guest: 不创建 TurnDoc，只更新本地状态
        // TurnDoc 的创建和连接由 RoomSyncBridge 监听 currentTurnNumber 变化自动处理
        // 这里只需要等待 MainDoc 同步后，RoomSyncBridge 会自动调用 joinTurnDoc
      }
    }

    // 创建下一阶段实例
    const nextPhaseInstance = createPhaseInstance(
      nextPhase.type,
      nextPhase.config,
    );

    // 存储新阶段
    if (nextTurnNumber === 0) {
      const preGamePhases = mainDoc.getArray("preGamePhases");
      preGamePhases.push([nextPhaseInstance]);
    } else if (nextTurnNumber > 0) {
      const turnDoc = subdocManager.getTurnDoc(roomId, nextTurnNumber);
      if (turnDoc) {
        const phases = turnDoc.getArray("phases");
        phases.push([nextPhaseInstance]);
        turnDoc.getMap("config").set("currentPhaseIndex", phases.length - 1);
      }
    } else {
      // nextTurnNumber < 0 表示结束阶段，存储在 preGamePhases（或可单独存储）
      const preGamePhases = mainDoc.getArray("preGamePhases");
      preGamePhases.push([nextPhaseInstance]);
    }

    // 更新配置
    configMap.set("currentPhaseId", nextPhaseInstance.id);
    configMap.set("currentPhaseIndex", nextPhaseIndex);

    // 发布推进事件（本地业务事件，保留 - SyncBridge 不派生 PHASE_ADVANCED）
    const advanceEvent: PhaseAdvancedEvent = {
      roomId,
      previousPhaseId: currentPhaseId || "",
      previousPhaseType: currentPhaseType,
      nextPhaseId: nextPhaseInstance.id,
      nextPhaseType: nextPhase.type,
      turnNumber: nextTurnNumber,
      isNewTurn,
      advancedAt: now,
    };
    eventBus.emit(
      eventBus.createEvent(RoomEvents.PHASE_ADVANCED, advanceEvent),
    );

    // ⚠️ SyncBridge 改造：移除 PHASE_ENTERED 事件的 emit
    // 这个事件将由 SyncBridge 通过检测 currentPhaseId 变化自动派生
    // TURN_STARTED 也由 SyncBridge 派生（当 isNewTurn && currentTurnNumber 增加时）

    return {
      success: true,
      data: { nextPhaseId: nextPhaseInstance.id, isNewTurn },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * 开始游戏命令处理器
 *
 * 从 lobby 阶段进入第一回合
 *
 * ⚠️ 角色检查：开始游戏前会检查所有成员是否都有角色
 */
export async function startGameHandler(
  payload: StartGamePayload,
  _context: CommandContext,
): Promise<CommandResult<{ turnNumber: number }>> {
  try {
    const { roomId, userId } = payload;
    const now = Date.now();

    const mainDoc = subdocManager.getMainDoc(roomId);
    if (!mainDoc) {
      return { success: false, error: `MainDoc not found: ${roomId}` };
    }

    // 验证是否为 Host
    if (!subdocManager.isHost(roomId, userId)) {
      return { success: false, error: "Only host can start the game" };
    }

    // === 角色检查：确保所有成员都有角色 ===
    const membersMap = mainDoc.getMap("members") as Y.Map<Member>;
    const charactersMap = mainDoc.getMap("characters") as Y.Map<Y.Map<unknown>>;

    // 收集所有成员的 userId
    const memberUserIds: string[] = [];
    membersMap.forEach((_member, odUserId) => {
      memberUserIds.push(odUserId);
    });

    // 收集所有角色的 operatorUserId
    const characterOperatorIds = new Set<string>();
    charactersMap.forEach((charMap) => {
      const operatorUserId = charMap.get("operatorUserId") as string;
      if (operatorUserId) {
        characterOperatorIds.add(operatorUserId);
      }
    });

    // 检查是否有成员没有角色
    const membersWithoutCharacter = memberUserIds.filter(
      (odUserId) => !characterOperatorIds.has(odUserId),
    );

    if (membersWithoutCharacter.length > 0) {
      // 获取没有角色的成员名称
      const missingNames: string[] = [];
      membersWithoutCharacter.forEach((odUserId) => {
        const member = membersMap.get(odUserId);
        if (member) {
          missingNames.push(member.displayName);
        }
      });

      return {
        success: false,
        error: `以下玩家尚未创建角色：${missingNames.join("、")}`,
      };
    }

    const configMap = mainDoc.getMap("config");
    const currentTurnNumber =
      (configMap.get("currentTurnNumber") as number) || 0;

    if (currentTurnNumber > 0) {
      // 续玩场景：从 currentTurnNumber + 1 开始新回合
      const metadataMap = mainDoc.getMap("metadata");
      if (metadataMap.get("status") !== "playing") {
        metadataMap.set("status", "playing");
        metadataMap.set("updatedAt", now);
      }

      const turnDuration =
        (metadataMap.get("turnDuration") as number) || 5 * 60 * 1000;
      const deadline = now + turnDuration;
      const nextTurnNumber = currentTurnNumber + 1;

      const turnDoc = subdocManager.createTurnDoc(
        roomId,
        nextTurnNumber,
        deadline,
      );

      // 更新 MainDoc 配置为新回合
      configMap.set("currentTurnNumber", nextTurnNumber);

      // 注册 TurnDoc 引用
      const turnDocRefs = mainDoc.getMap("turnDocRefs");
      turnDocRefs.set(String(nextTurnNumber), turnDoc.guid);

      // 连接 TurnDoc
      const mpConfig = multiplayerProvider.getConfig();
      if (mpConfig) {
        turnDocProvider.setConfig({
          roomId: mpConfig.roomId,
          token: mpConfig.token,
          wsUrl: mpConfig.wsUrl,
        });
        await turnDocProvider.connect(roomId, nextTurnNumber, turnDoc);
      }

      // 创建首个阶段（action_input）
      const firstPhase = createPhaseInstance(PhaseTypes.ACTION_INPUT, {
        deadline,
      });
      const phases = turnDoc.getArray("phases");
      phases.push([firstPhase]);
      turnDoc.getMap("config").set("currentPhaseIndex", 0);

      // 更新当前阶段 ID
      configMap.set("currentPhaseId", firstPhase.id);
      configMap.set("currentPhaseIndex", 0);

      return { success: true, data: { turnNumber: nextTurnNumber } };
    }

    // 完成当前 lobby 阶段
    const currentPhaseId = configMap.get("currentPhaseId") as string | null;
    if (currentPhaseId) {
      const preGamePhases = mainDoc.getArray("preGamePhases");
      for (let i = 0; i < preGamePhases.length; i++) {
        const phase = preGamePhases.get(i) as PhaseInstance;
        if (phase.id === currentPhaseId && phase.type === PhaseTypes.LOBBY) {
          const completedPhase: PhaseInstance = {
            ...phase,
            completedAt: now,
            updatedAt: now,
          };
          preGamePhases.delete(i);
          preGamePhases.insert(i, [completedPhase]);
          break;
        }
      }
    }

    // 更新房间状态为 playing
    const metadataMap = mainDoc.getMap("metadata");
    metadataMap.set("status", "playing");
    metadataMap.set("updatedAt", now);

    // 创建第一回合
    const turnDuration =
      (metadataMap.get("turnDuration") as number) || 5 * 60 * 1000;
    const deadline = now + turnDuration;
    const firstTurnNumber = 1;

    const turnDoc = subdocManager.createTurnDoc(
      roomId,
      firstTurnNumber,
      deadline,
    );

    // 更新 MainDoc 配置
    configMap.set("currentTurnNumber", firstTurnNumber);

    // 注册 TurnDoc 引用
    const turnDocRefs = mainDoc.getMap("turnDocRefs");
    turnDocRefs.set(String(firstTurnNumber), turnDoc.guid);

    // 设置 TurnDocProvider 配置并连接 TurnDoc
    const mpConfig = multiplayerProvider.getConfig();
    if (mpConfig) {
      turnDocProvider.setConfig({
        roomId: mpConfig.roomId,
        token: mpConfig.token,
        wsUrl: mpConfig.wsUrl,
      });
      await turnDocProvider.connect(roomId, firstTurnNumber, turnDoc);
    }

    // 创建第一个回合阶段（action_input）
    const firstPhase = createPhaseInstance(PhaseTypes.ACTION_INPUT, {
      deadline,
    });
    const phases = turnDoc.getArray("phases");
    phases.push([firstPhase]);
    turnDoc.getMap("config").set("currentPhaseIndex", 0);

    // 更新当前阶段 ID
    configMap.set("currentPhaseId", firstPhase.id);
    configMap.set("currentPhaseIndex", 0);

    // ⚠️ SyncBridge 改造：移除所有由 SyncBridge 派生的事件 emit
    // - GAME_STARTED: 由 SyncBridge 检测 status: waiting → playing 派生
    // - TURN_STARTED: 由 SyncBridge 检测 currentTurnNumber 增加派生
    // - PHASE_ENTERED: 由 SyncBridge 检测 currentPhaseId 变化派生

    return { success: true, data: { turnNumber: firstTurnNumber } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * 结束游戏命令处理器
 */
export async function endGameHandler(
  payload: EndGamePayload,
  _context: CommandContext,
): Promise<CommandResult<void>> {
  try {
    const { roomId, userId } = payload;
    const now = Date.now();

    const mainDoc = subdocManager.getMainDoc(roomId);
    if (!mainDoc) {
      return { success: false, error: `MainDoc not found: ${roomId}` };
    }

    // 验证是否为 Host
    if (!subdocManager.isHost(roomId, userId)) {
      return { success: false, error: "Only host can end the game" };
    }

    const configMap = mainDoc.getMap("config");

    // 更新房间状态
    const metadataMap = mainDoc.getMap("metadata");
    metadataMap.set("status", "ended");
    metadataMap.set("updatedAt", now);

    // 创建结束阶段
    const endedPhase = createPhaseInstance(PhaseTypes.ENDED);
    const preGamePhases = mainDoc.getArray("preGamePhases");
    preGamePhases.push([endedPhase]);

    // 更新当前阶段
    configMap.set("currentPhaseId", endedPhase.id);
    configMap.set("currentTurnNumber", -1); // -1 表示游戏结束

    // ⚠️ SyncBridge 改造：移除 GAME_ENDED 事件的 emit
    // 这个事件将由 SyncBridge 通过检测 status: playing → ended 派生

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ===== 延长回合时间 =====

/**
 * 延长回合截止时间 Payload
 */
export interface ExtendTurnDeadlinePayload {
  /** 房间 ID */
  roomId: string;
  /** 回合号 */
  turnNumber: number;
  /** 额外时间（毫秒） */
  additionalTime: number;
}

/**
 * 延长回合截止时间命令处理器
 *
 * 仅 Host 可调用，将当前回合的截止时间延长
 */
export async function extendTurnDeadlineHandler(
  payload: ExtendTurnDeadlinePayload,
  _context: CommandContext,
): Promise<CommandResult<{ newDeadline: number }>> {
  try {
    const { roomId, turnNumber, additionalTime } = payload;
    const now = Date.now();

    // 获取 TurnDoc
    const turnDoc = subdocManager.getTurnDoc(roomId, turnNumber);
    if (!turnDoc) {
      return {
        success: false,
        error: `TurnDoc not found: ${roomId}:${turnNumber}`,
      };
    }

    // 获取当前截止时间
    const configMap = turnDoc.getMap("config");
    const currentDeadline = (configMap.get("deadline") as number) || now;

    // 计算新截止时间（从当前时间或原截止时间取较大值开始计算）
    const baseTime = Math.max(now, currentDeadline);
    const newDeadline = baseTime + additionalTime;

    // 更新截止时间
    configMap.set("deadline", newDeadline);
    configMap.set("updatedAt", now);

    // 发布事件
    eventBus.emit(
      eventBus.createEvent(RoomEvents.TURN_DEADLINE_EXTENDED, {
        roomId,
        turnNumber,
        previousDeadline: currentDeadline,
        newDeadline,
        additionalTime,
        extendedAt: now,
      }),
    );

    return { success: true, data: { newDeadline } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ===== 强制开始回合 =====

/**
 * 强制开始回合 Payload
 */
export interface ForceStartTurnPayload {
  /** 房间 ID */
  roomId: string;
  /** 回合号 */
  turnNumber: number;
  /** 是否跳过未提交玩家（不使用默认行动） */
  skipUnsubmitted?: boolean;
}

/**
 * 强制开始回合命令处理器
 *
 * 仅 Host 可调用，立即锁定所有行动并进入下一阶段
 */
export async function forceStartTurnHandler(
  payload: ForceStartTurnPayload,
  _context: CommandContext,
): Promise<CommandResult<void>> {
  try {
    const { roomId, turnNumber, skipUnsubmitted = false } = payload;
    const now = Date.now();

    // 获取 TurnDoc
    const turnDoc = subdocManager.getTurnDoc(roomId, turnNumber);
    if (!turnDoc) {
      return {
        success: false,
        error: `TurnDoc not found: ${roomId}:${turnNumber}`,
      };
    }

    // 锁定所有行动
    const actionsMap = turnDoc.getMap("actions");
    const configMap = turnDoc.getMap("config");

    // 更新锁定状态
    configMap.set("isLocked", true);
    configMap.set("lockedAt", now);
    configMap.set("lockReason", "force_start");

    // 标记跳过的玩家
    if (skipUnsubmitted) {
      const mainDoc = subdocManager.getMainDoc(roomId);
      if (mainDoc) {
        const membersMap = mainDoc.getMap("members");
        const skippedPlayers: string[] = [];

        membersMap.forEach((_member, oderId) => {
          if (!actionsMap.has(oderId)) {
            skippedPlayers.push(oderId);
          }
        });

        configMap.set("skippedPlayers", skippedPlayers);
      }
    }

    // 发布锁定事件
    eventBus.emit(
      eventBus.createEvent(RoomEvents.ACTION_LOCKED, {
        roomId,
        turnNumber,
        lockedAt: now,
        reason: "force_start",
        skippedPlayers: skipUnsubmitted
          ? (configMap.get("skippedPlayers") as string[]) || []
          : [],
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

// ===== 锁定行动 =====

/**
 * 锁定行动 Payload
 */
export interface LockActionPayload {
  /** 房间 ID */
  roomId: string;
  /** 回合号 */
  turnNumber: number;
  /** 锁定原因 */
  reason: "timeout" | "all_submitted" | "force_start" | "host_decision";
}

/**
 * 锁定行动命令处理器
 *
 * 锁定当前回合的所有行动，阻止进一步修改
 */
export async function lockActionHandler(
  payload: LockActionPayload,
  _context: CommandContext,
): Promise<CommandResult<void>> {
  try {
    const { roomId, turnNumber, reason } = payload;
    const now = Date.now();

    // 获取 MainDoc（用于检查 Host 身份）
    const mainDoc = subdocManager.getMainDoc(roomId);
    if (!mainDoc) {
      return { success: false, error: `MainDoc not found: ${roomId}` };
    }

    // 获取 TurnDoc
    const turnDoc = subdocManager.getTurnDoc(roomId, turnNumber);
    if (!turnDoc) {
      return {
        success: false,
        error: `TurnDoc not found: ${roomId}:${turnNumber}`,
      };
    }

    const configMap = turnDoc.getMap("config");

    // 检查是否已锁定
    if (configMap.get("isLocked")) {
      return { success: true }; // 已锁定，无需重复操作
    }

    // 更新锁定状态
    configMap.set("isLocked", true);
    configMap.set("lockedAt", now);
    configMap.set("lockReason", reason);

    // 发布事件
    eventBus.emit(
      eventBus.createEvent(RoomEvents.ACTION_LOCKED, {
        roomId,
        turnNumber,
        lockedAt: now,
        reason,
      }),
    );

    // AI 处理由 AI 模块通过事件订阅自行触发（解耦设计）
    // 参见 src/modules/room/index.ts 中的 setupAiEventSubscriptions()

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ===== 完成回合 =====

import type { PlayerAction } from "@/core/yjs/room/types";
import { TurnDelta } from "@/domain";
import {
  convertTurnToMessages,
  toMessageEntities,
} from "../services/turn-converter";

/**
 * 完成回合命令处理器
 *
 * 流程：
 * 1. 获取 TurnDoc 数据
 * 2. 转换为消息格式
 * 3. 双写：TurnDoc 归档 + HistoryDoc 消息存储
 * 4. 发布 TURN_COMPLETED 事件
 */
export async function completeTurnHandler(
  payload: CompleteTurnPayload,
  _context: CommandContext,
): Promise<CommandResult<void>> {
  try {
    const { roomId, turnNumber, aiResponse } = payload;
    const now = Date.now();

    // 获取 MainDoc
    const mainDoc = subdocManager.getMainDoc(roomId);
    if (!mainDoc) {
      return { success: false, error: `MainDoc not found: ${roomId}` };
    }

    // 获取 TurnDoc
    const turnDoc = subdocManager.getTurnDoc(roomId, turnNumber);
    if (!turnDoc) {
      return {
        success: false,
        error: `TurnDoc not found: ${roomId}:${turnNumber}`,
      };
    }

    // 获取成员信息
    const membersMap = mainDoc.getMap("members") as Y.Map<Member>;
    const members = new Map<string, Member>();
    membersMap.forEach((member, id) => {
      members.set(id, member);
    });

    // 获取角色信息（用于显示角色名称而非玩家名称）
    const charactersMap = mainDoc.getMap("characters") as Y.Map<Y.Map<unknown>>;
    const characters: Character[] = [];
    charactersMap.forEach((charMap) => {
      try {
        const character = yMapToCharacter(charMap);
        characters.push(character);
      } catch (err) {
        console.warn("[completeTurnHandler] Failed to extract character:", err);
      }
    });

    // 获取玩家行动
    const actionsMap = turnDoc.getMap("actions") as Y.Map<PlayerAction>;
    const actions = new Map<string, PlayerAction>();
    actionsMap.forEach((action, userId) => {
      actions.set(userId, action);
    });

    // 读取 TurnDoc 的 AI 响应（作为默认值）
    const aiResponseText = turnDoc.getText("aiResponse");
    const resolvedAiResponse =
      aiResponse !== undefined ? aiResponse : aiResponseText.toString();

    // 更新 TurnDoc 的 AI 响应（仅在传入时才覆盖）
    if (aiResponse !== undefined) {
      aiResponseText.delete(0, aiResponseText.length);
      aiResponseText.insert(0, aiResponse);
    }

    // 检查是否已完成（防止重复调用）
    const turnConfig = turnDoc.getMap("config");
    const existingStatus = turnConfig.get("status") as string | undefined;
    if (existingStatus === "completed") {
      return { success: true };
    }

    // 更新 TurnDoc 状态
    turnConfig.set("status", "completed");
    turnConfig.set("completedAt", now);

    // 获取会话 ID（使用默认的房间主会话）
    const conversationId = `room:${roomId}:main`;

    // 在写入消息前先执行持久化后处理，避免结构标签泄漏到消息正文
    let cleanedAiResponse = resolvedAiResponse;
    let miniSummary: string | undefined;
    try {
      const activePreset = await usePresetStore
        .getState()
        .getPresetForPurpose("narrative");
      const postProcessResult = postProcessNarrativeForPersist({
        rawText: resolvedAiResponse,
        presetRules: activePreset?.postProcessRules,
      });

      cleanedAiResponse = postProcessResult.text;
      miniSummary = postProcessResult.miniSummary;

      if (postProcessResult.warnings.length > 0) {
        console.warn(
          "[Room:completeTurn] 后处理警告:",
          postProcessResult.warnings,
        );
      }
    } catch (postProcessError) {
      console.warn(
        "[Room:completeTurn] 后处理失败，回退到原始 AI 响应:",
        postProcessError instanceof Error
          ? postProcessError.message
          : postProcessError,
      );
    }

    if (aiResponseText.toString() !== cleanedAiResponse) {
      aiResponseText.delete(0, aiResponseText.length);
      aiResponseText.insert(0, cleanedAiResponse);
    }

    // 转换回合数据为消息格式（传入角色信息以显示角色名称）
    const conversionResult = convertTurnToMessages({
      turnNumber,
      actions,
      members,
      characters,
      aiResponse: cleanedAiResponse,
      completedAt: now,
      conversationId,
    });

    // 加载 HistoryDoc 并写入消息
    const historyDoc = await subdocManager.loadHistoryDoc(roomId);
    const messagesMap = historyDoc.getMap("messages") as Y.Map<
      Y.Array<unknown>
    >;

    // 确保会话消息数组存在
    let messagesArray = messagesMap.get(conversationId) as
      | Y.Array<unknown>
      | undefined;
    if (!messagesArray) {
      messagesArray = new Y.Array<unknown>();
      messagesMap.set(conversationId, messagesArray);
    }

    // 转换为 Message 实体并写入
    const messageEntities = toMessageEntities(
      conversionResult.messages,
      conversationId,
    );
    for (const msg of messageEntities) {
      messagesArray.push([msg]);
    }

    // ── Memory 后处理：写入提取的小总结 ──
    if (miniSummary) {
      // 方案 C（房主统一分配索引）：从 HistoryDoc 消息数组长度计算
      const assistantMessageIndex = messagesArray.length - 1;

      // 找到本回合最后一条 assistant 消息 ID
      let assistantMessageId = `turn-${turnNumber}-assistant`;
      for (let i = messageEntities.length - 1; i >= 0; i--) {
        const message = messageEntities[i];
        if (message.role === "assistant") {
          assistantMessageId = message.id;
          break;
        }
      }

      const miniSummaryPayload: AddMiniSummaryPayload = {
        conversationId,
        messageId: assistantMessageId,
        messageIndex: assistantMessageIndex,
        content: miniSummary,
        roomId,
      };

      try {
        const dispatchResult = await commandBus.dispatch({
          type: MemoryCommands.ADD_MINI_SUMMARY,
          payload: miniSummaryPayload,
        });

        if (!dispatchResult.success) {
          console.warn(
            `[Room:completeTurn] 写入小总结失败，但已保留消息与回合归档: ${dispatchResult.error ?? "未知错误"}`,
            {
              conversationId,
              roomId,
              turnNumber,
              messageId: assistantMessageId,
              messageIndex: assistantMessageIndex,
            },
          );
        }
      } catch (error) {
        console.warn(
          "[Room:completeTurn] 写入小总结失败，但已保留消息与回合归档:",
          error instanceof Error ? error.message : error,
          {
            conversationId,
            roomId,
            turnNumber,
            messageId: assistantMessageId,
            messageIndex: assistantMessageIndex,
          },
        );
      }
    }

    // 归档回合数据到 HistoryDoc
    const archivedTurns = historyDoc.getArray("archivedTurns");
    const turnDeltaArray = turnDoc.getArray("deltas");
    const deltas: TurnDelta[] = (turnDeltaArray.toArray() as unknown[]).filter(
      (d): d is TurnDelta => {
        if (typeof d !== "object" || d === null) {
          return false;
        }

        const delta = d as Record<string, unknown>;
        return (
          typeof delta.deltaVersion === "string" &&
          typeof delta.commitStatus === "string"
        );
      },
    );
    const archiveData = {
      turnNumber,
      completedAt: now,
      actions: Object.fromEntries(actions),
      aiResponseLength: cleanedAiResponse.length,
      deltas,
    };

    // 压缩并存储（简化版：直接存储 JSON）
    archivedTurns.push([
      {
        turnNumber,
        completedAt: now,
        deltas,
        compressedData: JSON.stringify(archiveData),
      },
    ]);

    // === 新增：写入 SaveSlot（持久化） ===
    const currentSaveId = yjsManager.getCurrentSaveId();

    if (currentSaveId) {
      const saveSlot = yjsManager.getSaveSlots().get(currentSaveId) as
        | Y.Map<unknown>
        | undefined;
      if (saveSlot) {
        // 1. 写入消息到 SaveSlot
        const saveMessagesMap = saveSlot.get("messages") as
          | Y.Map<Y.Array<unknown>>
          | undefined;
        if (saveMessagesMap) {
          let saveMsgArray = saveMessagesMap.get(conversationId) as
            | Y.Array<unknown>
            | undefined;
          if (!saveMsgArray) {
            saveMsgArray = new Y.Array<unknown>();
            saveMessagesMap.set(conversationId, saveMsgArray);
          }

          for (const msg of messageEntities) {
            saveMsgArray.push([msg]);
          }
        }

        // 2. 更新回合号
        saveSlot.set("currentTurnNumber", turnNumber);

        // 3. 归档回合数据到 SaveSlot（可选，用于回放）
        let saveArchivedTurns = saveSlot.get("archivedTurns") as
          | Y.Array<unknown>
          | undefined;
        if (!saveArchivedTurns) {
          saveArchivedTurns = new Y.Array<unknown>();
          saveSlot.set("archivedTurns", saveArchivedTurns);
        }

        // 构建归档数据（包含玩家显示名）
        const actionsWithDisplayName: Record<
          string,
          {
            userId: string;
            content: string;
            submittedAt: number;
            displayName?: string;
          }
        > = {};
        actions.forEach((action, odUserId) => {
          const member = members.get(odUserId);
          actionsWithDisplayName[odUserId] = {
            userId: odUserId,
            content: action.content,
            submittedAt: action.submittedAt,
            displayName: member?.displayName,
          };
        });

        saveArchivedTurns.push([
          {
            turnNumber,
            completedAt: now,
            actions: actionsWithDisplayName,
            aiResponseLength: cleanedAiResponse.length,
          },
        ]);

        // 4. 更新存档时间戳
        saveSlot.set("updatedAt", now);
      }
    }

    // 发布回合完成事件
    const event: TurnCompletedEvent = {
      roomId,
      turnNumber,
      aiResponse: cleanedAiResponse,
      completedAt: now,
    };
    eventBus.emit(eventBus.createEvent(RoomEvents.TURN_COMPLETED, event));

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ===== 角色管理 =====

/**
 * 创建角色命令处理器
 *
 * 流程：
 * 1. 验证房间存在
 * 2. 检查用户是否已有角色（可选：一个用户只能有一个角色）
 * 3. 创建角色实体
 * 4. 写入 MainDoc.characters（使用嵌套 Y.Map）
 * 5. 发布 CHARACTER_CREATED 事件
 */
export async function createCharacterHandler(
  payload: CreateCharacterPayload,
  _context: CommandContext,
): Promise<CommandResult<{ characterId: string }>> {
  try {
    const { roomId, userId, uniqueTag, characterData } = payload;

    const mainDoc = subdocManager.getMainDoc(roomId);
    if (!mainDoc) {
      return { success: false, error: `MainDoc not found: ${roomId}` };
    }

    // 获取 characters Map
    const charactersMap = mainDoc.getMap("characters") as Y.Map<Y.Map<unknown>>;

    // 检查用户是否已有角色（通过 operatorUserId 或 operatorUniqueTag 匹配）
    let existingCharacterId: string | null = null;
    charactersMap.forEach((charMap, charId) => {
      const operatorUserId = charMap.get("operatorUserId") as string;
      const operatorUniqueTag = charMap.get("operatorUniqueTag") as string;
      if (operatorUserId === userId || operatorUniqueTag === uniqueTag) {
        existingCharacterId = charId;
      }
    });

    if (existingCharacterId) {
      return {
        success: false,
        error: `用户已有角色，请使用更新命令修改角色信息`,
      };
    }

    const runtimeWorldConfig = getRuntimeWorldConfig();
    const fullStats = computeFullStats({
      baseAttributes: characterData.attributes ?? {},
      primaryAttributes: runtimeWorldConfig.primaryAttributes,
      derivedStats: runtimeWorldConfig.derivedStats,
    });

    const mergedAttributes: Record<string, unknown> = {
      ...(characterData.attributes ?? {}),
    };

    for (const stat of runtimeWorldConfig.derivedStats) {
      if (!stat.isResource) continue;

      const maxField = stat.maxField;
      const computedCurrent = fullStats[stat.key];
      const computedMax =
        typeof maxField === "string" ? fullStats[maxField] : undefined;

      const resolvedCurrent =
        typeof computedCurrent === "number" && Number.isFinite(computedCurrent)
          ? computedCurrent
          : typeof computedMax === "number" && Number.isFinite(computedMax)
            ? computedMax
            : undefined;

      if (
        mergedAttributes[stat.key] === undefined &&
        typeof resolvedCurrent === "number"
      ) {
        mergedAttributes[stat.key] = resolvedCurrent;
      }

      if (
        typeof maxField === "string" &&
        mergedAttributes[maxField] === undefined &&
        typeof computedMax === "number" &&
        Number.isFinite(computedMax)
      ) {
        mergedAttributes[maxField] = computedMax;
      }
    }

    // 创建角色实体
    const character = createCharacter({
      ...characterData,
      attributes: mergedAttributes,
      creatorUniqueTag: uniqueTag,
      operatorUserId: userId,
      operatorUniqueTag: uniqueTag,
      status: "active",
    });

    // 写入 MainDoc.characters（使用嵌套 Y.Map 支持增量同步）
    mainDoc.transact(() => {
      const charMap = characterToYMap(character);
      charactersMap.set(character.id, charMap);
    });

    // 发布 CHARACTER_CREATED 事件
    const event: CharacterCreatedEvent = {
      roomId,
      character,
    };
    eventBus.emit(eventBus.createEvent(RoomEvents.CHARACTER_CREATED, event));

    return { success: true, data: { characterId: character.id } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * 更新角色命令处理器
 *
 * 流程：
 * 1. 验证房间和角色存在
 * 2. 验证操作权限（userId 或 uniqueTag 匹配）
 * 3. 更新角色属性
 * 4. 发布 CHARACTER_UPDATED 事件
 */
export async function updateCharacterHandler(
  payload: UpdateCharacterPayload,
  _context: CommandContext,
): Promise<CommandResult<void>> {
  try {
    const { roomId, characterId, userId, uniqueTag, updates } = payload;
    let updatedAt = Date.now();

    const mainDoc = subdocManager.getMainDoc(roomId);
    if (!mainDoc) {
      return { success: false, error: `MainDoc not found: ${roomId}` };
    }

    // 获取 characters Map
    const charactersMap = mainDoc.getMap("characters") as Y.Map<Y.Map<unknown>>;

    // 获取角色
    const charMap = charactersMap.get(characterId);
    if (!charMap) {
      return { success: false, error: `角色不存在: ${characterId}` };
    }

    // 构建角色对象用于权限检查
    const character = yMapToCharacter(charMap);

    // 验证操作权限
    if (!canOperateCharacter(character, userId, uniqueTag)) {
      return { success: false, error: "无权操作此角色" };
    }

    // 更新角色属性（使用 transact 确保原子性）
    mainDoc.transact(() => {
      applyCharacterUpdates(charMap, updates);
      const nextUpdatedAt = charMap.get("updatedAt");
      if (typeof nextUpdatedAt === "number") {
        updatedAt = nextUpdatedAt;
      }
    });

    // 发布 CHARACTER_UPDATED 事件
    const event: CharacterUpdatedEvent = {
      roomId,
      characterId,
      operatorUserId: userId,
      operatorUniqueTag: uniqueTag,
      updates,
      updatedAt,
    };
    eventBus.emit(eventBus.createEvent(RoomEvents.CHARACTER_UPDATED, event));

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * 踢出成员命令处理器
 */
export async function kickMemberHandler(
  payload: KickMemberPayload,
  _context: CommandContext,
): Promise<CommandResult<void>> {
  try {
    const { roomId, userId, targetUserId } = payload;
    const now = Date.now();

    const mainDoc = subdocManager.getMainDoc(roomId);
    if (!mainDoc) {
      return { success: false, error: `MainDoc not found: ${roomId}` };
    }

    // 验证是否为 Host
    if (!subdocManager.isHost(roomId, userId)) {
      return { success: false, error: "Only host can kick members" };
    }

    const membersMap = mainDoc.getMap("members") as Y.Map<Member>;
    const targetMember = membersMap.get(targetUserId);
    if (!targetMember) {
      return {
        success: false,
        error: `Target member not found: ${targetUserId}`,
      };
    }

    if (targetUserId === userId) {
      return { success: false, error: "Host cannot kick themselves" };
    }

    writeMemberActionMeta(roomId, targetUserId, {
      action: "kick",
      by: userId,
      reason: payload.reason,
      at: now,
    });

    membersMap.delete(targetUserId);

    // 后端权威路径：kick 成功后应主动断开目标连接并广播成员变更。
    // 前端兼容兜底：若本地正是被踢目标，立即执行离房清理，避免继续停留房间态。
    const localUserId = useRoomStore.getState().localUser.userId;
    if (targetUserId === localUserId) {
      historyDocProvider.disconnect(roomId);
      turnDocProvider.disconnectAll();
      multiplayerProvider.disconnect();
      subdocManager.leaveRoom(roomId);
      useRoomStore.getState().reset();
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * 删除房间命令处理器
 */
export async function deleteRoomHandler(
  payload: DeleteRoomPayload,
  _context: CommandContext,
): Promise<CommandResult<void>> {
  try {
    const { roomId, userId } = payload;
    const now = Date.now();

    const mainDoc = subdocManager.getMainDoc(roomId);
    if (!mainDoc) {
      return { success: false, error: `MainDoc not found: ${roomId}` };
    }

    // 验证是否为 Host
    if (!subdocManager.isHost(roomId, userId)) {
      return { success: false, error: "Only host can delete room" };
    }

    mainDoc.transact(() => {
      const metadataMap = mainDoc.getMap("metadata");
      metadataMap.set("disbanded", true);
      metadataMap.set("disbandedAt", now);
      metadataMap.set("status", "ended");
    });

    eventBus.emit(
      eventBus.createEvent(RoomEvents.ROOM_DELETED, {
        roomId,
        userId,
        deletedAt: now,
      }),
    );

    // 先尝试后端房间删除契约，失败时继续执行本地兜底清理，避免幽灵连接/幽灵房间。
    try {
      await apiClient.deleteRoom(roomId, userId);
    } catch {
      // API 不可用时保持前端收口，等待后端恢复后由服务端权威拒绝旧 roomId 写入
    }

    // 无论后端调用是否成功，都执行本地 teardown
    historyDocProvider.disconnect(roomId);
    turnDocProvider.disconnectAll();
    multiplayerProvider.disconnect();
    subdocManager.leaveRoom(roomId);
    useRoomStore.getState().reset();

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * 更新房间设置命令处理器
 */
export async function updateRoomSettingsHandler(
  payload: UpdateRoomSettingsPayload,
  _context: CommandContext,
): Promise<CommandResult<void>> {
  try {
    const { roomId, userId, settings } = payload;
    const now = Date.now();

    const mainDoc = subdocManager.getMainDoc(roomId);
    if (!mainDoc) {
      return { success: false, error: `MainDoc not found: ${roomId}` };
    }

    // 验证是否为 Host
    if (!subdocManager.isHost(roomId, userId)) {
      return { success: false, error: "Only host can update room settings" };
    }

    const metadataMap = mainDoc.getMap("metadata");
    const status = metadataMap.get("status") as string | undefined;
    if (status !== "waiting") {
      return {
        success: false,
        error: "Cannot update room settings after game started",
      };
    }

    mainDoc.transact(() => {
      if ("name" in settings) {
        metadataMap.set("name", settings.name);
      }
      if ("maxPlayers" in settings) {
        metadataMap.set("maxPlayers", settings.maxPlayers);
      }
      if ("turnDuration" in settings) {
        metadataMap.set("turnDuration", settings.turnDuration);
      }
      metadataMap.set("updatedAt", now);
    });

    eventBus.emit(
      eventBus.createEvent(RoomEvents.ROOM_SETTINGS_UPDATED, {
        roomId,
        settings,
        updatedAt: now,
        userId,
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
 * 修改行动命令处理器
 */
export async function updateActionHandler(
  payload: UpdateActionPayload,
  _context: CommandContext,
): Promise<CommandResult<void>> {
  try {
    const { roomId, turnNumber, userId, content, metadata } = payload;
    const now = Date.now();

    const localUserId = useRoomStore.getState().localUser.userId;
    if (!localUserId || localUserId !== userId) {
      return {
        success: false,
        error: "Invalid action operator",
      };
    }

    const mainDoc = subdocManager.getMainDoc(roomId);
    if (!mainDoc) {
      return { success: false, error: `MainDoc not found: ${roomId}` };
    }

    const membersMap = mainDoc.getMap("members") as Y.Map<Member>;
    if (!membersMap.has(userId)) {
      return {
        success: false,
        error: "Only room members can update action",
      };
    }

    const turnDoc = subdocManager.getTurnDoc(roomId, turnNumber);
    if (!turnDoc) {
      return {
        success: false,
        error: `TurnDoc not found: ${roomId}:${turnNumber}`,
      };
    }

    const configMap = turnDoc.getMap("config");
    const status = configMap.get("status") as string | undefined;
    if (status === "completed") {
      return {
        success: false,
        error: "Cannot update action in completed turn",
      };
    }

    const isLocked = Boolean(configMap.get("isLocked"));
    if (isLocked) {
      return {
        success: false,
        error: "Cannot update action after turn is locked",
      };
    }

    const actionsMap = turnDoc.getMap("actions");
    if (!actionsMap.has(userId)) {
      return {
        success: false,
        error: `No submitted action found for user: ${userId}`,
      };
    }

    actionsMap.set(userId, {
      userId,
      content,
      submittedAt: now,
      metadata,
    });

    eventBus.emit(
      eventBus.createEvent(RoomEvents.ACTION_UPDATED, {
        roomId,
        turnNumber,
        userId,
        updatedAt: now,
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
 * 创建 NPC 命令处理器
 */
export async function createNpcHandler(
  payload: CreateNpcPayload,
  _context: CommandContext,
): Promise<CommandResult<{ characterId: string }>> {
  try {
    const { roomId } = payload;

    const mainDoc = subdocManager.getMainDoc(roomId);
    if (!mainDoc) {
      return { success: false, error: `MainDoc not found: ${roomId}` };
    }

    const userId = useRoomStore.getState().localUser.userId;
    if (!userId) {
      return { success: false, error: "当前用户未登录或 userId 缺失" };
    }

    const uniqueTag = getUniqueTag();
    if (!uniqueTag) {
      return { success: false, error: "无法获取 uniqueTag" };
    }

    if (!subdocManager.isHost(roomId, userId)) {
      return { success: false, error: "Only host can create NPC" };
    }

    const charactersMap = mainDoc.getMap("characters") as Y.Map<Y.Map<unknown>>;

    const character = createCharacter({
      name: payload.name,
      description: payload.description,
      personality: payload.personality,
      appearance: payload.appearance,
      age: payload.age,
      gender: payload.gender,
      attributes: payload.attributes,
      talentIds: payload.talentIds,
      controlType: "npc",
      operatorUserId: userId,
      operatorUniqueTag: uniqueTag,
      creatorUniqueTag: uniqueTag,
      status: "active",
    });

    mainDoc.transact(() => {
      charactersMap.set(character.id, characterToYMap(character));
    });

    const event: NpcCreatedEvent = {
      roomId,
      characterId: character.id,
      name: character.name,
      description: character.description,
      personality: character.personality,
      appearance: character.appearance,
      talentIds: character.talentIds,
      createdAt: character.createdAt,
    };
    eventBus.emit(eventBus.createEvent(RoomEvents.NPC_CREATED, event));

    return { success: true, data: { characterId: character.id } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * 更新 NPC 状态命令处理器
 */
export async function updateNpcStatusHandler(
  payload: UpdateNpcStatusPayload,
  _context: CommandContext,
): Promise<CommandResult<void>> {
  try {
    const { roomId, characterId, status } = payload;
    const now = Date.now();

    const mainDoc = subdocManager.getMainDoc(roomId);
    if (!mainDoc) {
      return { success: false, error: `MainDoc not found: ${roomId}` };
    }

    const userId = useRoomStore.getState().localUser.userId;
    if (!userId) {
      return { success: false, error: "当前用户未登录或 userId 缺失" };
    }

    const charactersMap = mainDoc.getMap("characters") as Y.Map<Y.Map<unknown>>;
    const charMap = charactersMap.get(characterId);
    if (!charMap) {
      return { success: false, error: `角色不存在: ${characterId}` };
    }

    const character = yMapToCharacter(charMap);
    if (character.controlType !== "npc") {
      return { success: false, error: `目标角色不是 NPC: ${characterId}` };
    }

    if (!subdocManager.isHost(roomId, userId)) {
      return { success: false, error: "Only host can update NPC status" };
    }

    const previousStatus = character.status;

    mainDoc.transact(() => {
      charMap.set("status", status);
      charMap.set("updatedAt", now);
    });

    const event: NpcStatusChangedEvent = {
      roomId,
      characterId,
      previousStatus,
      newStatus: status,
      changedAt: now,
    };
    eventBus.emit(eventBus.createEvent(RoomEvents.NPC_STATUS_CHANGED, event));

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * 更新 NPC 信息命令处理器
 */
export async function updateNpcInfoHandler(
  payload: UpdateNpcInfoPayload,
  _context: CommandContext,
): Promise<CommandResult<void>> {
  try {
    const { roomId, characterId, updates } = payload;
    const now = Date.now();

    const mainDoc = subdocManager.getMainDoc(roomId);
    if (!mainDoc) {
      return { success: false, error: `MainDoc not found: ${roomId}` };
    }

    const userId = useRoomStore.getState().localUser.userId;
    if (!userId) {
      return { success: false, error: "当前用户未登录或 userId 缺失" };
    }

    const charactersMap = mainDoc.getMap("characters") as Y.Map<Y.Map<unknown>>;
    const charMap = charactersMap.get(characterId);
    if (!charMap) {
      return { success: false, error: `角色不存在: ${characterId}` };
    }

    const character = yMapToCharacter(charMap);
    if (character.controlType !== "npc") {
      return { success: false, error: `目标角色不是 NPC: ${characterId}` };
    }

    if (!subdocManager.isHost(roomId, userId)) {
      return { success: false, error: "Only host can update NPC info" };
    }

    mainDoc.transact(() => {
      for (const [key, value] of Object.entries(updates)) {
        if (value !== undefined) {
          charMap.set(key, value);
        }
      }
      charMap.set("updatedAt", now);
    });

    const event: NpcInfoUpdatedEvent = {
      roomId,
      characterId,
      updates,
      updatedAt: now,
    };
    eventBus.emit(eventBus.createEvent(RoomEvents.NPC_INFO_UPDATED, event));

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
