/**
 * 房间状态 Store
 *
 * 管理联机房间的状态，包括：
 * - 当前房间信息
 * - 连接状态
 * - 成员列表
 * - 本地用户信息
 *
 * ⚠️ 架构说明：
 * - Store 的修改方法只能被 handlers.ts 调用
 * - UI 组件只能读取状态，不能直接调用修改方法
 * - 状态修改必须通过 CommandBus 触发
 */

import type { ConnectionStatus } from "@/core/yjs/multiplayer-provider";
import type { Member } from "@/core/yjs/room/types";
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

// ===== 类型定义 =====

/**
 * 房间模式
 */
export type RoomMode = "offline" | "online";

/**
 * 当前房间信息
 */
export interface CurrentRoom {
  /** 房间 ID */
  roomId: string;
  /** 房间码 */
  code: string;
  /** 房间名称 */
  name: string;
  /** 是否为房主 */
  isHost: boolean;
  /** 最大玩家数 */
  maxPlayers: number;
  /** 回合时长（毫秒） */
  turnDuration: number;
}

/**
 * 本地用户信息
 */
export interface LocalUser {
  /** 用户 ID */
  userId: string;
  /** 显示名称 */
  displayName: string;
}

/**
 * 房间状态
 */
interface RoomState {
  /** 当前模式（离线/在线） */
  mode: RoomMode;

  /** 当前房间信息（联机时有值） */
  currentRoom: CurrentRoom | null;

  /** 连接状态 */
  connectionStatus: ConnectionStatus;

  /** 成员列表（从 Yjs 同步） */
  members: Member[];

  /** 本地用户信息 */
  localUser: LocalUser;

  /** 错误信息 */
  error: string | null;

  /** 是否正在加载 */
  isLoading: boolean;
}

/**
 * 房间操作（仅供 handlers 调用）
 *
 * ⚠️ UI 组件不应直接调用这些方法
 */
interface RoomActions {
  /** 设置模式 */
  setMode: (mode: RoomMode) => void;

  /** 设置当前房间 */
  setCurrentRoom: (room: CurrentRoom | null) => void;

  /** 更新连接状态 */
  setConnectionStatus: (status: ConnectionStatus) => void;

  /** 更新成员列表 */
  setMembers: (members: Member[]) => void;

  /** 添加成员 */
  addMember: (member: Member) => void;

  /** 移除成员 */
  removeMember: (userId: string) => void;

  /** 更新成员状态 */
  updateMemberStatus: (userId: string, status: Member["status"]) => void;

  /** 设置本地用户 */
  setLocalUser: (user: LocalUser) => void;

  /** 设置错误 */
  setError: (error: string | null) => void;

  /** 设置加载状态 */
  setLoading: (loading: boolean) => void;

  /** 重置状态（离开房间时调用） */
  reset: () => void;
}

// ===== 初始状态 =====

const initialState: RoomState = {
  mode: "offline",
  currentRoom: null,
  connectionStatus: "disconnected",
  members: [],
  localUser: {
    userId: "",
    displayName: "",
  },
  error: null,
  isLoading: false,
};

// ===== Store 实现 =====

export const useRoomStore = create<RoomState & RoomActions>()(
  immer((set) => ({
    ...initialState,

    setMode: (mode) => {
      set((state) => {
        state.mode = mode;
      });
    },

    setCurrentRoom: (room) => {
      set((state) => {
        state.currentRoom = room;
        state.mode = room ? "online" : "offline";
      });
    },

    setConnectionStatus: (status) => {
      set((state) => {
        state.connectionStatus = status;
        // 连接错误时设置错误信息
        if (status === "error") {
          state.error = "连接失败";
        } else if (status === "synced") {
          state.error = null;
        }
      });
    },

    setMembers: (members) => {
      set((state) => {
        state.members = members;
      });
    },

    addMember: (member) => {
      set((state) => {
        const exists = state.members.some((m) => m.userId === member.userId);
        if (!exists) {
          state.members.push(member);
        }
      });
    },

    removeMember: (userId) => {
      set((state) => {
        state.members = state.members.filter((m) => m.userId !== userId);
      });
    },

    updateMemberStatus: (userId, status) => {
      set((state) => {
        const member = state.members.find((m) => m.userId === userId);
        if (member) {
          member.status = status;
          member.lastActiveAt = Date.now();
        }
      });
    },

    setLocalUser: (user) => {
      set((state) => {
        state.localUser = user;
      });
    },

    setError: (error) => {
      set((state) => {
        state.error = error;
      });
    },

    setLoading: (loading) => {
      set((state) => {
        state.isLoading = loading;
      });
    },

    reset: () => {
      set((state) => {
        state.mode = "offline";
        state.currentRoom = null;
        state.connectionStatus = "disconnected";
        state.members = [];
        state.error = null;
        state.isLoading = false;
        // 保留 localUser
      });
    },
  }))
);

// ===== 选择器（供 UI 组件使用） =====

/**
 * 获取当前用户是否为房主
 */
export const selectIsHost = (state: RoomState): boolean => {
  return state.currentRoom?.isHost ?? false;
};

/**
 * 获取在线成员数量
 */
export const selectOnlineMemberCount = (state: RoomState): number => {
  return state.members.filter((m) => m.status === "online").length;
};

/**
 * 获取房主信息
 */
export const selectHost = (state: RoomState): Member | undefined => {
  return state.members.find((m) => m.role === "host");
};

/**
 * 检查是否已连接到房间
 */
export const selectIsConnected = (state: RoomState): boolean => {
  return (
    state.mode === "online" &&
    (state.connectionStatus === "connected" ||
      state.connectionStatus === "synced")
  );
};

/**
 * 检查是否正在重连
 */
export const selectIsReconnecting = (state: RoomState): boolean => {
  return state.connectionStatus === "reconnecting";
};
