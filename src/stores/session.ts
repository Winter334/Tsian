/**
 * Session 聚合 Store
 *
 * 聚合会话态（只读）：不作为业务写入入口。
 * 数据来源：
 * - SaveEvents（存档加载/删除）
 * - RoomEvents + RoomStore 快照
 * - 本地身份（userId）
 */

import { eventBus } from "@/core";
import { yjsManager, type ConnectionStatus } from "@/core/yjs";
import { RoomEvents } from "@/domain/events/room";
import { SaveEvents, type SaveLoadedPayload } from "@/domain/events/save";
import { getOrCreateUserId } from "@/lib/user-identity";
import { useRoomStore } from "@/modules/room/store";
import { create } from "zustand";

export type SessionMode = "solo" | "multiplayer";

export interface SessionState {
  /** 联机运行态（来自 RoomStore） */
  mode: "offline" | "online";
  /** 当前存档类型（来自 SaveEvents / yjsManager） */
  saveType: "solo" | "multiplayer";
  /** 当前存档 ID */
  saveId: string | null;
  /** 当前房间 ID（联机时存在） */
  roomId: string | null;
  /** 当前用户是否房主 */
  isHost: boolean;
  /** 连接状态（复用 Room 类型） */
  connectionStatus: ConnectionStatus;
  /** 本地用户 ID（room.localUser 优先，回退 identity） */
  localUserId: string;
}

const INITIAL_SESSION_STATE: SessionState = {
  mode: "offline",
  saveType: "solo",
  saveId: null,
  roomId: null,
  isHost: false,
  connectionStatus: "disconnected",
  localUserId: getOrCreateUserId(),
};

/**
 * 只读 Session Store
 *
 * 注意：不暴露写入 action；内部通过 useSessionStore.setState 同步聚合快照。
 */
export const useSessionStore = create<SessionState>(
  () => INITIAL_SESSION_STATE,
);

export const selectIsOnline = (state: SessionState): boolean =>
  state.mode === "online";

export const selectIsMultiplayer = (state: SessionState): boolean =>
  state.saveType === "multiplayer";

export const selectSessionMode = (state: SessionState): SessionMode =>
  state.saveType === "multiplayer" || state.mode === "online"
    ? "multiplayer"
    : "solo";

let initialized = false;
let syncQueued = false;
let pendingSaveOverride: Partial<
  Pick<SessionState, "saveId" | "saveType">
> | null = null;
const unsubscribers: Array<() => void> = [];

const TERMINAL_CONNECTION_STATUSES: ReadonlySet<ConnectionStatus> = new Set([
  "disconnected",
  "error",
]);

function normalizeRoomId(roomId: string | null | undefined): string | null {
  if (typeof roomId !== "string") {
    return null;
  }

  const trimmedRoomId = roomId.trim();
  return trimmedRoomId.length > 0 ? trimmedRoomId : null;
}

function readSaveSnapshot(): Pick<SessionState, "saveId" | "saveType"> {
  const saveId = yjsManager.getCurrentSaveId();

  if (!saveId) {
    return {
      saveId: null,
      saveType: "solo",
    };
  }

  return {
    saveId,
    saveType: yjsManager.getSaveType(saveId),
  };
}

function readRoomSnapshot(): Pick<
  SessionState,
  "mode" | "roomId" | "isHost" | "connectionStatus" | "localUserId"
> {
  const roomState = useRoomStore.getState();
  const roomId = normalizeRoomId(roomState.currentRoom?.roomId);

  return {
    mode: roomState.mode,
    roomId,
    isHost: roomId !== null ? (roomState.currentRoom?.isHost ?? false) : false,
    connectionStatus: roomState.connectionStatus,
    localUserId: roomState.localUser.userId || getOrCreateUserId(),
  };
}

function normalizeSessionSnapshot(snapshot: SessionState): SessionState {
  const hasValidRoom = snapshot.roomId !== null;
  const shouldConvergeOffline =
    !hasValidRoom &&
    TERMINAL_CONNECTION_STATUSES.has(snapshot.connectionStatus);

  if (shouldConvergeOffline) {
    return {
      ...snapshot,
      mode: "offline",
      roomId: null,
      isHost: false,
    };
  }

  if (!hasValidRoom && snapshot.isHost) {
    return {
      ...snapshot,
      isHost: false,
    };
  }

  return snapshot;
}

function isEqualSessionState(a: SessionState, b: SessionState): boolean {
  return (
    a.mode === b.mode &&
    a.saveType === b.saveType &&
    a.saveId === b.saveId &&
    a.roomId === b.roomId &&
    a.isHost === b.isHost &&
    a.connectionStatus === b.connectionStatus &&
    a.localUserId === b.localUserId
  );
}

function syncSessionState(
  saveOverride?: Partial<Pick<SessionState, "saveId" | "saveType">>,
): void {
  const previous = useSessionStore.getState();

  const next = normalizeSessionSnapshot({
    ...previous,
    ...readSaveSnapshot(),
    ...readRoomSnapshot(),
    ...saveOverride,
  });

  if (!isEqualSessionState(previous, next)) {
    useSessionStore.setState(next);
  }
}

function scheduleSync(
  saveOverride?: Partial<Pick<SessionState, "saveId" | "saveType">>,
): void {
  if (saveOverride) {
    pendingSaveOverride = {
      ...(pendingSaveOverride ?? {}),
      ...saveOverride,
    };
  }

  if (syncQueued) {
    return;
  }

  syncQueued = true;
  queueMicrotask(() => {
    syncQueued = false;
    const override = pendingSaveOverride;
    pendingSaveOverride = null;
    syncSessionState(override ?? undefined);
  });
}

/**
 * 初始化 SessionStore（幂等）
 */
export function initializeSessionStore(): void {
  if (initialized) {
    return;
  }

  initialized = true;

  // 初始快照
  syncSessionState();

  // 监听 Save 关键事件
  unsubscribers.push(
    eventBus.on<SaveLoadedPayload>(SaveEvents.SAVE_LOADED, (event) => {
      scheduleSync({
        saveId: event.payload.saveId,
        saveType: event.payload.saveType,
      });
    }),
  );
  unsubscribers.push(
    eventBus.on(SaveEvents.SAVE_DELETED, () => {
      scheduleSync();
    }),
  );

  // 监听 Room 关键事件
  const roomSyncEvents: string[] = [
    RoomEvents.ROOM_CREATED,
    RoomEvents.ROOM_DELETED,
    RoomEvents.MEMBER_JOINED,
    RoomEvents.MEMBER_LEFT,
    RoomEvents.MEMBER_KICKED,
    RoomEvents.HOST_TRANSFERRED,
    RoomEvents.CONNECTED,
    RoomEvents.DISCONNECTED,
    RoomEvents.RECONNECTING,
    RoomEvents.RECONNECTED,
  ];

  for (const eventType of roomSyncEvents) {
    unsubscribers.push(
      eventBus.on(eventType, () => {
        scheduleSync();
      }),
    );
  }

  // 监听 RoomStore 变化（只读快照同步）
  unsubscribers.push(
    useRoomStore.subscribe(() => {
      scheduleSync();
    }),
  );

  // 本地身份变更（跨 tab）
  if (typeof window !== "undefined") {
    const onStorage = (event: StorageEvent) => {
      if (event.key === "lyra.userId") {
        scheduleSync();
      }
    };

    window.addEventListener("storage", onStorage);
    unsubscribers.push(() => {
      window.removeEventListener("storage", onStorage);
    });
  }
}
