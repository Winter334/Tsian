/**
 * useActionAwareness - 行动输入状态同步 Hook
 *
 * 使用 Yjs Awareness 在房间内同步玩家的输入状态：
 * - 输入中...（正在打字）
 * - 已提交
 * - 已锁定
 *
 * 遵循架构规范：只读查询 Awareness 数据，不修改业务状态
 */

import { multiplayerProvider } from "@/core/yjs";
import { useCallback, useEffect, useState } from "react";
import type { Awareness } from "y-protocols/awareness";
import { useRoomStore } from "../store";

// ===== 类型定义 =====

/**
 * 行动状态
 */
export type ActionStatus = "empty" | "draft" | "submitted" | "locked";

/**
 * 玩家行动 Awareness 状态
 */
export interface ActionAwarenessState {
  /** 用户 ID */
  id: string;
  /** 用户名 */
  name: string;
  /** 行动状态 */
  actionStatus: ActionStatus;
  /** 是否正在输入（typing indicator） */
  isTyping: boolean;
  /** 最后输入时间 */
  lastTypingAt: number;
  /** 最后更新时间 */
  lastActiveAt: number;
}

/**
 * 玩家行动状态信息（用于 UI 显示）
 */
export interface PlayerActionInfo {
  userId: string;
  displayName: string;
  status: ActionStatus;
  isTyping: boolean;
}

/**
 * Hook 返回值
 */
export interface UseActionAwarenessReturn {
  /** 当前用户的行动状态 */
  localStatus: ActionStatus;
  /** 设置本地行动状态 */
  setLocalStatus: (status: ActionStatus) => void;
  /** 设置正在输入状态 */
  setTyping: (isTyping: boolean) => void;
  /** 同时设置状态和 typing（避免闭包问题） */
  setStatusAndTyping: (status: ActionStatus, typing: boolean) => void;
  /** 所有玩家的行动状态 */
  playersStatus: PlayerActionInfo[];
  /** 已提交的玩家数量 */
  submittedCount: number;
  /** 总玩家数量 */
  totalPlayers: number;
  /** 是否全员已提交 */
  allSubmitted: boolean;
}

// ===== 常量 =====

/** Awareness 字段名 */
const AWARENESS_FIELD = "action";

/** 输入超时时间（毫秒），超过此时间不再显示 "正在输入..." */
const TYPING_TIMEOUT = 3000;

// ===== Hook 实现 =====

export function useActionAwareness(): UseActionAwarenessReturn {
  const localUser = useRoomStore((s) => s.localUser);
  const members = useRoomStore((s) => s.members);
  const connectionStatus = useRoomStore((s) => s.connectionStatus);

  const [localStatus, setLocalStatusState] = useState<ActionStatus>("empty");
  const [isTyping, setIsTypingState] = useState(false);
  const [playersStatus, setPlayersStatus] = useState<PlayerActionInfo[]>([]);

  // 获取 Awareness 实例
  const getAwareness = useCallback((): Awareness | null => {
    return multiplayerProvider.getAwareness();
  }, []);

  // 更新本地 Awareness 状态
  const updateLocalAwareness = useCallback(
    (status: ActionStatus, typing: boolean) => {
      const awareness = getAwareness();
      if (!awareness || !localUser.userId) return;

      const state: ActionAwarenessState = {
        id: localUser.userId,
        name: localUser.displayName,
        actionStatus: status,
        isTyping: typing,
        lastTypingAt: typing ? Date.now() : 0,
        lastActiveAt: Date.now(),
      };

      awareness.setLocalStateField(AWARENESS_FIELD, state);
    },
    [getAwareness, localUser]
  );

  // 设置本地行动状态
  const setLocalStatus = useCallback(
    (status: ActionStatus) => {
      setLocalStatusState(status);
      updateLocalAwareness(status, isTyping);
    },
    [isTyping, updateLocalAwareness]
  );

  // 设置正在输入状态
  const setTyping = useCallback(
    (typing: boolean) => {
      setIsTypingState(typing);
      updateLocalAwareness(localStatus, typing);
    },
    [localStatus, updateLocalAwareness]
  );

  // 同时设置状态和 typing（避免闭包问题）
  const setStatusAndTyping = useCallback(
    (status: ActionStatus, typing: boolean) => {
      setLocalStatusState(status);
      setIsTypingState(typing);
      updateLocalAwareness(status, typing);
    },
    [updateLocalAwareness]
  );

  // 监听 Awareness 变化
  useEffect(() => {
    // 仅在同步完成后启用 Awareness 监听
    if (connectionStatus !== "synced") return;

    const awareness = getAwareness();
    if (!awareness) return;

    const handleChange = () => {
      const now = Date.now();
      const states = awareness.getStates();
      const newPlayersStatus: PlayerActionInfo[] = [];

      // 遍历所有 Awareness 状态
      states.forEach((state) => {
        const actionState = state[AWARENESS_FIELD] as
          | ActionAwarenessState
          | undefined;
        if (actionState && actionState.id) {
          // 检查 typing 状态是否超时
          const isStillTyping =
            actionState.isTyping &&
            actionState.lastTypingAt > 0 &&
            now - actionState.lastTypingAt < TYPING_TIMEOUT;

          newPlayersStatus.push({
            userId: actionState.id,
            displayName: actionState.name,
            status: actionState.actionStatus,
            isTyping: isStillTyping,
          });
        }
      });

      // 按成员列表顺序排序
      newPlayersStatus.sort((a, b) => {
        const aIndex = members.findIndex((m) => m.userId === a.userId);
        const bIndex = members.findIndex((m) => m.userId === b.userId);
        return aIndex - bIndex;
      });

      setPlayersStatus(newPlayersStatus);
    };

    // 初始化
    handleChange();

    // 订阅变化
    awareness.on("change", handleChange);

    return () => {
      awareness.off("change", handleChange);
    };
  }, [connectionStatus, getAwareness, members]);

  // 初始化本地状态
  useEffect(() => {
    if (localUser.userId) {
      updateLocalAwareness(localStatus, isTyping);
    }
  }, [localUser.userId, localStatus, isTyping, updateLocalAwareness]);

  // 计算统计数据
  const submittedCount = playersStatus.filter(
    (p) => p.status === "submitted" || p.status === "locked"
  ).length;
  const totalPlayers = members.length;
  const allSubmitted = totalPlayers > 0 && submittedCount >= totalPlayers;

  return {
    localStatus,
    setLocalStatus,
    setTyping,
    setStatusAndTyping,
    playersStatus,
    submittedCount,
    totalPlayers,
    allSubmitted,
  };
}
