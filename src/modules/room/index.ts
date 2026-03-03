/**
 * 房间模块
 *
 * 负责联机房间的创建、加入、回合管理等功能
 *
 * ⚠️ 架构说明：
 * - 命令处理器负责业务逻辑和状态修改
 * - 事件订阅负责更新 Store（事件驱动）
 * - UI 组件只读取 Store，不直接调用修改方法
 * - Yjs 文档变化通过 RoomSyncBridge 同步到 Store 并派生事件
 */

import { commandBus } from "@/core/command-bus";
import { eventBus } from "@/core/event-bus";
import {
  historyDocProvider,
  multiplayerProvider,
  subdocManager,
  turnDocProvider,
} from "@/core/yjs";
import { RoomCommands } from "@/domain/commands/room";
import {
  RoomEvents,
  type MemberJoinedEvent,
  type MemberLeftEvent,
  type RoomCreatedEvent,
} from "@/domain/events/room";
import { SaveEvents, type SaveLoadedPayload } from "@/domain/events/save";
import {
  cancelAiTurnHandler,
  processAiTurnHandler,
  regenerateAiTurnHandler,
} from "./commands/ai-handlers";
import {
  advancePhaseHandler,
  completePhaseHandler,
  completeTurnHandler,
  createCharacterHandler,
  createNpcHandler,
  createRoomHandler,
  deleteRoomHandler,
  endGameHandler,
  enterPhaseHandler,
  extendTurnDeadlineHandler,
  forceStartTurnHandler,
  joinRoomHandler,
  kickMemberHandler,
  leaveRoomHandler,
  lockActionHandler,
  queryRoomHandler,
  startGameHandler,
  startTurnHandler,
  submitActionHandler,
  transferHostHandler,
  updateActionHandler,
  updateCharacterHandler,
  updateMemberStatusHandler,
  updateNpcInfoHandler,
  updateNpcStatusHandler,
  updateRoomSettingsHandler,
} from "./commands/handlers";
import { useRoomStore } from "./store";
import { RoomSyncBridge } from "./sync";

// ===== 事件订阅取消函数 =====
let unsubscribers: Array<() => void> = [];

// ===== RoomSyncBridge 实例 =====
let roomSyncBridge: RoomSyncBridge | null = null;

/**
 * 设置 RoomSyncBridge
 *
 * 在房间连接同步完成后调用，负责：
 * 1. 监听 Yjs 状态变化
 * 2. 派生领域事件（GAME_STARTED, MEMBER_JOINED 等）
 * 3. 同步状态到 Store
 */
function setupRoomSyncBridge(roomId: string): void {
  // 幂等检查：如果已有同房间的 SyncBridge 实例且正常运行，跳过
  if (roomSyncBridge && roomSyncBridge.roomId === roomId) {
    console.log(
      `[Room] SyncBridge already active for room ${roomId}, skipping setup`,
    );
    return;
  }

  // 如果有旧的（不同房间的）实例，先销毁
  if (roomSyncBridge) {
    console.log("[Room] Replacing SyncBridge for different room");
    cleanupRoomSyncBridge();
  }

  // 创建新实例
  console.info("[RoomSyncDiag] setupRoomSyncBridge:create", {
    roomId,
    providerStatus: multiplayerProvider.getStatus(),
  });
  roomSyncBridge = new RoomSyncBridge(roomId);
  roomSyncBridge.setup();
}

/**
 * 清理 RoomSyncBridge
 */
function cleanupRoomSyncBridge(): void {
  if (roomSyncBridge) {
    console.info("[RoomSyncDiag] cleanupRoomSyncBridge", {
      roomId: roomSyncBridge.roomId,
    });
    roomSyncBridge.destroy();
    roomSyncBridge = null;
  }
}

/**
 * 预防性清理 SyncBridge
 *
 * 用于 create/join 前或 provider disconnected 时，确保旧实例被销毁。
 */
function resetSyncBridgeState(reason: string): void {
  if (roomSyncBridge) {
    console.info("[RoomSyncDiag] resetSyncBridgeState", {
      reason,
      roomId: roomSyncBridge.roomId,
    });
  }
  cleanupRoomSyncBridge();
}

/**
 * 设置事件订阅
 *
 * 订阅房间相关事件，自动更新 Store 状态
 */
function setupEventSubscriptions(): void {
  const store = useRoomStore.getState();

  // 房间创建事件
  unsubscribers.push(
    eventBus.on(RoomEvents.ROOM_CREATED, (event) => {
      const payload = event.payload as RoomCreatedEvent;
      store.setCurrentRoom({
        roomId: payload.roomId,
        code: payload.code,
        name: payload.name,
        isHost: true,
        maxPlayers: payload.maxPlayers,
        turnDuration: payload.turnDuration,
      });
      store.setMode("online");
      store.setLoading(false);
    }),
  );

  // 成员加入事件
  unsubscribers.push(
    eventBus.on(RoomEvents.MEMBER_JOINED, (event) => {
      const payload = event.payload as MemberJoinedEvent;
      const currentRoom = useRoomStore.getState().currentRoom;

      // 如果是当前用户加入（非房主），更新房间信息
      const localUser = useRoomStore.getState().localUser;
      if (payload.userId === localUser.userId && !currentRoom) {
        store.setCurrentRoom({
          roomId: payload.roomId,
          code: "", // 需要从其他地方获取
          name: "", // 需要从其他地方获取
          isHost: payload.role === "host",
          maxPlayers: 8,
          turnDuration: 5 * 60 * 1000,
        });
        store.setMode("online");
      }

      // store.addMember() 已移除：由 SyncBridge.applySnapshotToStore() 通过 setMembers() 覆盖
      store.setLoading(false);
    }),
  );

  // 成员离开事件
  unsubscribers.push(
    eventBus.on(RoomEvents.MEMBER_LEFT, (event) => {
      const payload = event.payload as MemberLeftEvent;
      const localUser = useRoomStore.getState().localUser;

      // 如果是当前用户离开，重置状态
      if (payload.userId === localUser.userId) {
        store.reset();
      }
      // 其他成员离开：由 SyncBridge.applySnapshotToStore() 通过 setMembers() 覆盖
    }),
  );

  // 连接事件
  unsubscribers.push(
    eventBus.on(RoomEvents.CONNECTED, () => {
      store.setConnectionStatus("connected");
    }),
  );

  // 成员被踢事件：当前用户被踢时立即收口离房态
  unsubscribers.push(
    eventBus.on(RoomEvents.MEMBER_KICKED, (event) => {
      const payload = event.payload as { roomId: string; userId: string };
      const localUserId = useRoomStore.getState().localUser.userId;

      if (payload.userId !== localUserId) {
        return;
      }

      historyDocProvider.disconnect(payload.roomId);
      turnDocProvider.disconnectAll();
      multiplayerProvider.disconnect();
      subdocManager.leaveRoom(payload.roomId);
      store.reset();
      store.setError("你已被房主移出房间");
    }),
  );

  // 断开连接事件
  unsubscribers.push(
    eventBus.on(RoomEvents.DISCONNECTED, () => {
      const currentRoom = useRoomStore.getState().currentRoom;
      if (currentRoom) {
        historyDocProvider.disconnect(currentRoom.roomId);
        turnDocProvider.disconnectAll();
        subdocManager.leaveRoom(currentRoom.roomId);
        store.reset();
      }
      store.setConnectionStatus("disconnected");
    }),
  );

  // 重连中事件
  unsubscribers.push(
    eventBus.on(RoomEvents.RECONNECTING, () => {
      store.setConnectionStatus("reconnecting");
    }),
  );

  // 存档加载事件 - 当加载单人存档时重置房间状态
  unsubscribers.push(
    eventBus.on(SaveEvents.SAVE_LOADED, (event) => {
      const payload = event.payload as SaveLoadedPayload;

      // 只有加载单人存档时才重置房间状态
      if (payload.saveType === "solo") {
        store.reset();
      }
    }),
  );

  // 重连成功事件
  unsubscribers.push(
    eventBus.on(RoomEvents.RECONNECTED, () => {
      store.setConnectionStatus("synced");
    }),
  );

  // 成员状态更新事件
  unsubscribers.push(
    eventBus.on(RoomEvents.MEMBER_STATUS_UPDATED, (event) => {
      const payload = event.payload as {
        roomId: string;
        userId: string;
        status: "online" | "away" | "offline";
      };
      store.updateMemberStatus(payload.userId, payload.status);
    }),
  );

  // 房主转让事件
  unsubscribers.push(
    eventBus.on(RoomEvents.HOST_TRANSFERRED, (event) => {
      const payload = event.payload as {
        roomId: string;
        previousHostId: string;
        newHostId: string;
      };
      const localUser = useRoomStore.getState().localUser;
      const currentRoom = useRoomStore.getState().currentRoom;

      if (currentRoom) {
        // 更新当前用户是否为房主（isHost 是 UI 级别状态，SyncBridge 未覆盖）
        store.setCurrentRoom({
          ...currentRoom,
          isHost: payload.newHostId === localUser.userId,
        });
      }

      // 成员角色更新已由 SyncBridge.applySnapshotToStore() 通过 setMembers() 覆盖
    }),
  );
}

/**
 * 设置 MultiplayerProvider 事件监听
 *
 * 将 Provider 的连接状态变化转发为事件
 */
function setupProviderListeners(): void {
  // 监听连接状态变化
  multiplayerProvider.on("onStatusChange", (status) => {
    const store = useRoomStore.getState();
    store.setConnectionStatus(status);

    // disconnected 必须无条件清理 SyncBridge
    // 因为 multiplayerProvider.disconnect() 会先清空 config，再触发 disconnected
    if (status === "disconnected") {
      cleanupRoomSyncBridge();
    }

    // 根据状态发布对应事件
    const config = multiplayerProvider.getConfig();
    if (!config) {
      // disconnected 允许无 config，其余状态记日志便于排查
      if (status !== "disconnected") {
        console.warn("[RoomSyncDiag] onStatusChange without config", {
          status,
        });
      }
      return;
    }

    const eventPayload = {
      roomId: config.roomId,
      userId: config.userId,
      timestamp: Date.now(),
    };

    switch (status) {
      case "connected":
        eventBus.emit(eventBus.createEvent(RoomEvents.CONNECTED, eventPayload));
        break;
      case "synced":
        // 同步完成后设置 RoomSyncBridge（幂等，重复调用安全）
        setupRoomSyncBridge(config.roomId);
        eventBus.emit(
          eventBus.createEvent(RoomEvents.RECONNECTED, eventPayload),
        );
        break;
      case "reconnecting":
        // 通知 SyncBridge 重连中
        if (roomSyncBridge) {
          roomSyncBridge.onReconnect();
        }
        eventBus.emit(
          eventBus.createEvent(RoomEvents.RECONNECTING, eventPayload),
        );
        break;
      case "disconnected":
        eventBus.emit(
          eventBus.createEvent(RoomEvents.DISCONNECTED, eventPayload),
        );
        break;
      case "error":
        store.setError("连接错误");
        break;
    }
  });

  // 监听同步完成（确保覆盖首次同步的情况）
  multiplayerProvider.on("onSynced", () => {
    const store = useRoomStore.getState();
    store.setConnectionStatus("synced");

    // 幂等调用，重复触发安全
    const config = multiplayerProvider.getConfig();
    if (config) {
      setupRoomSyncBridge(config.roomId);
    }
  });

  // 监听错误
  multiplayerProvider.on("onError", (error) => {
    const store = useRoomStore.getState();
    store.setError(error.message);
    store.setConnectionStatus("error");
  });
}

/**
 * 注册房间模块
 */
export function registerRoomModule(): void {
  // 注册命令处理器
  commandBus.register(RoomCommands.CREATE_ROOM, async (command, context) => {
    // 关键修复：新会话前强制重置，避免 setupCompleted 脏状态跳过 setup
    resetSyncBridgeState("before_create_room");

    // 设置加载状态
    useRoomStore.getState().setLoading(true);
    return createRoomHandler(
      command.payload as Parameters<typeof createRoomHandler>[0],
      context,
    );
  });

  commandBus.register(RoomCommands.JOIN_ROOM, async (command, context) => {
    // 关键修复：新会话前强制重置，避免 setupCompleted 脏状态跳过 setup
    resetSyncBridgeState("before_join_room");

    // 设置加载状态
    useRoomStore.getState().setLoading(true);
    return joinRoomHandler(
      command.payload as Parameters<typeof joinRoomHandler>[0],
      context,
    );
  });

  commandBus.register(RoomCommands.LEAVE_ROOM, async (command, context) => {
    return leaveRoomHandler(
      command.payload as Parameters<typeof leaveRoomHandler>[0],
      context,
    );
  });

  commandBus.register(
    RoomCommands.UPDATE_MEMBER_STATUS,
    async (command, context) => {
      return updateMemberStatusHandler(
        command.payload as Parameters<typeof updateMemberStatusHandler>[0],
        context,
      );
    },
  );

  commandBus.register(RoomCommands.START_TURN, async (command, context) => {
    return startTurnHandler(
      command.payload as Parameters<typeof startTurnHandler>[0],
      context,
    );
  });

  commandBus.register(RoomCommands.SUBMIT_ACTION, async (command, context) => {
    return submitActionHandler(
      command.payload as Parameters<typeof submitActionHandler>[0],
      context,
    );
  });

  commandBus.register(RoomCommands.TRANSFER_HOST, async (command, context) => {
    return transferHostHandler(
      command.payload as Parameters<typeof transferHostHandler>[0],
      context,
    );
  });

  commandBus.register(RoomCommands.QUERY_ROOM, async (command, context) => {
    return queryRoomHandler(
      command.payload as Parameters<typeof queryRoomHandler>[0],
      context,
    );
  });

  // Phase 相关命令
  commandBus.register(RoomCommands.ENTER_PHASE, async (command, context) => {
    return enterPhaseHandler(
      command.payload as Parameters<typeof enterPhaseHandler>[0],
      context,
    );
  });

  commandBus.register(RoomCommands.COMPLETE_PHASE, async (command, context) => {
    return completePhaseHandler(
      command.payload as Parameters<typeof completePhaseHandler>[0],
      context,
    );
  });

  commandBus.register(RoomCommands.ADVANCE_PHASE, async (command, context) => {
    return advancePhaseHandler(
      command.payload as Parameters<typeof advancePhaseHandler>[0],
      context,
    );
  });

  commandBus.register(RoomCommands.START_GAME, async (command, context) => {
    return startGameHandler(
      command.payload as Parameters<typeof startGameHandler>[0],
      context,
    );
  });

  commandBus.register(RoomCommands.END_GAME, async (command, context) => {
    return endGameHandler(
      command.payload as Parameters<typeof endGameHandler>[0],
      context,
    );
  });

  // 回合控制命令
  commandBus.register(
    RoomCommands.EXTEND_TURN_DEADLINE,
    async (command, context) => {
      return extendTurnDeadlineHandler(
        command.payload as Parameters<typeof extendTurnDeadlineHandler>[0],
        context,
      );
    },
  );

  commandBus.register(
    RoomCommands.FORCE_START_TURN,
    async (command, context) => {
      return forceStartTurnHandler(
        command.payload as Parameters<typeof forceStartTurnHandler>[0],
        context,
      );
    },
  );

  commandBus.register(RoomCommands.LOCK_ACTION, async (command, context) => {
    return lockActionHandler(
      command.payload as Parameters<typeof lockActionHandler>[0],
      context,
    );
  });

  commandBus.register(RoomCommands.COMPLETE_TURN, async (command, context) => {
    return completeTurnHandler(
      command.payload as Parameters<typeof completeTurnHandler>[0],
      context,
    );
  });

  // ===== AI 处理命令（2.4 新增） =====
  commandBus.register(
    RoomCommands.PROCESS_AI_TURN,
    async (command, context) => {
      return processAiTurnHandler(
        command.payload as Parameters<typeof processAiTurnHandler>[0],
        context,
      );
    },
  );

  commandBus.register(RoomCommands.CANCEL_AI_TURN, async (command, context) => {
    return cancelAiTurnHandler(
      command.payload as Parameters<typeof cancelAiTurnHandler>[0],
      context,
    );
  });

  commandBus.register(
    RoomCommands.REGENERATE_AI_TURN,
    async (command, context) => {
      return regenerateAiTurnHandler(
        command.payload as Parameters<typeof regenerateAiTurnHandler>[0],
        context,
      );
    },
  );

  // ===== 角色管理命令 =====
  commandBus.register(
    RoomCommands.CREATE_CHARACTER,
    async (command, context) => {
      return createCharacterHandler(
        command.payload as Parameters<typeof createCharacterHandler>[0],
        context,
      );
    },
  );

  commandBus.register(
    RoomCommands.UPDATE_CHARACTER,
    async (command, context) => {
      return updateCharacterHandler(
        command.payload as Parameters<typeof updateCharacterHandler>[0],
        context,
      );
    },
  );

  // ===== 踢出/删除命令 =====
  commandBus.register(RoomCommands.KICK_MEMBER, async (command, context) => {
    return kickMemberHandler(
      command.payload as Parameters<typeof kickMemberHandler>[0],
      context,
    );
  });

  commandBus.register(RoomCommands.DELETE_ROOM, async (command, context) => {
    return deleteRoomHandler(
      command.payload as Parameters<typeof deleteRoomHandler>[0],
      context,
    );
  });

  // ===== 房间设置/行动命令 =====
  commandBus.register(
    RoomCommands.UPDATE_ROOM_SETTINGS,
    async (command, context) => {
      return updateRoomSettingsHandler(
        command.payload as Parameters<typeof updateRoomSettingsHandler>[0],
        context,
      );
    },
  );

  commandBus.register(RoomCommands.UPDATE_ACTION, async (command, context) => {
    return updateActionHandler(
      command.payload as Parameters<typeof updateActionHandler>[0],
      context,
    );
  });

  // ===== NPC 管理命令 =====
  commandBus.register(RoomCommands.CREATE_NPC, async (command, context) => {
    return createNpcHandler(
      command.payload as Parameters<typeof createNpcHandler>[0],
      context,
    );
  });

  commandBus.register(
    RoomCommands.UPDATE_NPC_STATUS,
    async (command, context) => {
      return updateNpcStatusHandler(
        command.payload as Parameters<typeof updateNpcStatusHandler>[0],
        context,
      );
    },
  );

  commandBus.register(
    RoomCommands.UPDATE_NPC_INFO,
    async (command, context) => {
      return updateNpcInfoHandler(
        command.payload as Parameters<typeof updateNpcInfoHandler>[0],
        context,
      );
    },
  );

  // 设置事件订阅
  setupEventSubscriptions();

  // 设置 AI 事件订阅（2.4 新增）
  setupAiEventSubscriptions();

  // 设置 Provider 监听
  setupProviderListeners();
}

/**
 * 设置 AI 相关事件订阅
 *
 * 通过事件驱动实现模块解耦：
 * - 订阅 ACTION_LOCKED 事件
 * - Host 自动触发 AI 处理
 * - 可热插拔：移除此函数调用即可禁用自动 AI 处理
 */
function setupAiEventSubscriptions(): void {
  unsubscribers.push(
    eventBus.on(RoomEvents.ACTION_LOCKED, (event) => {
      const { roomId, turnNumber } = event.payload as {
        roomId: string;
        turnNumber: number;
        lockedAt: number;
        reason: string;
      };

      // 只有 Host 触发 AI 处理
      const currentRoom = useRoomStore.getState().currentRoom;
      const localUser = useRoomStore.getState().localUser;

      if (!currentRoom?.isHost) {
        return; // 非 Host，忽略
      }

      // 延迟触发，确保锁定状态已同步
      setTimeout(async () => {
        try {
          await commandBus.dispatch({
            type: RoomCommands.PROCESS_AI_TURN,
            payload: {
              roomId,
              turnNumber,
              userId: localUser.userId,
            },
          });
        } catch {
          // AI 处理失败，静默处理
        }
      }, 100);
    }),
  );

  // AI 完成后自动归档回合（写入 HistoryDoc + SaveSlot）
  unsubscribers.push(
    eventBus.on(RoomEvents.AI_RESPONSE_COMPLETED, (event) => {
      const { roomId, turnNumber } = event.payload as {
        roomId: string;
        turnNumber: number;
      };

      const currentRoom = useRoomStore.getState().currentRoom;
      if (!currentRoom?.isHost) {
        return; // 非 Host，忽略
      }

      // 自动完成回合（aiResponse 从 TurnDoc 读取）
      commandBus
        .dispatch({
          type: RoomCommands.COMPLETE_TURN,
          payload: {
            roomId,
            turnNumber,
          },
        })
        .catch(() => {
          // 自动完成回合失败，静默处理
        });
    }),
  );
}

/**
 * 注销房间模块
 *
 * 清理事件订阅和连接
 */
export function unregisterRoomModule(): void {
  // 取消所有事件订阅
  unsubscribers.forEach((unsub) => unsub());
  unsubscribers = [];

  // 清理 RoomSyncBridge
  cleanupRoomSyncBridge();

  // 断开连接
  multiplayerProvider.disconnect();

  // 重置 Store
  useRoomStore.getState().reset();
}

// 导出处理器（供测试使用）
export {
  completeTurnHandler,
  createCharacterHandler,
  createRoomHandler,
  joinRoomHandler,
  leaveRoomHandler,
  queryRoomHandler,
  startTurnHandler,
  submitActionHandler,
  transferHostHandler,
  updateCharacterHandler,
  updateMemberStatusHandler,
} from "./commands/handlers";

// 导出 Store（供 UI 只读访问）
export {
  selectHost,
  selectIsConnected,
  selectIsHost,
  selectIsReconnecting,
  selectOnlineMemberCount,
  useRoomStore,
  type CurrentRoom,
  type LocalUser,
  type RoomMode,
} from "./store";

// 导出 Hooks（供 UI 组件使用）
export {
  // AI 相关 Hooks
  useAiResponse,
  useAiResponseWithDoc,
  useAiStatus,
  useAiStatusWithDoc,
  useConnectionStatus,
  // 操作
  useCreateRoom,
  useJoinRoom,
  useLeaveRoom,
  useQueryRoom,
  // 角色相关
  useRoomCharacters,
  // 状态读取
  useRoomInfo,
  useRoomMembers,
  // 回合控制
  useTurnControl,
  // 消息展示
  useTurnMessages,
  type AiStatusInfo,
  // 类型
  type CreateRoomOptions,
  type CreateRoomResult,
  type JoinRoomResult,
  type LeaveRoomResult,
  type RoomPreview,
  type TurnControlState,
  type TurnMessagesState,
  type UseRoomCharactersResult,
  type UseTurnControlReturn,
  type UseTurnMessagesReturn,
} from "./hooks";

// 导出组件（供 UI 使用）
export {
  // 行动输入
  ActionInput,
  ActionStatusIndicator,
  AiHostControls,
  // AI 处理状态
  AiProcessingStatus,
  CountdownProgress,
  // 回合控制
  CountdownTimer,
  GuestWaitingMessage,
  TimeoutDialog,
  // 消息展示
  TurnNarrativeFlow,
  TurnTimeoutController,
  // 类型
  type TimeoutAction,
} from "./components";
