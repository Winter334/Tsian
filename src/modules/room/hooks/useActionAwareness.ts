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

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  subscribeActionAwareness,
  updateLocalActionAwareness,
  type ActionAwarenessState,
  type ActionStatus,
  type PlayerActionInfo,
} from "../awareness";
import { useRoomStore } from "../store";

// ===== 类型定义 =====

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

// ===== Hook 实现 =====

export function useActionAwareness(): UseActionAwarenessReturn {
  const localUser = useRoomStore((s) => s.localUser);
  const members = useRoomStore((s) => s.members);
  const connectionStatus = useRoomStore((s) => s.connectionStatus);

  const [localStatus, setLocalStatusState] = useState<ActionStatus>("empty");
  const [isTyping, setIsTypingState] = useState(false);
  const [playersStatus, setPlayersStatus] = useState<PlayerActionInfo[]>([]);

  const applyLocalAwareness = useCallback(
    (status: ActionStatus, typing: boolean) => {
      updateLocalActionAwareness({
        userId: localUser.userId,
        displayName: localUser.displayName,
        status,
        isTyping: typing,
      });
    },
    [localUser.displayName, localUser.userId],
  );

  // 设置本地行动状态
  const setLocalStatus = useCallback(
    (status: ActionStatus) => {
      setLocalStatusState(status);
      applyLocalAwareness(status, isTyping);
    },
    [applyLocalAwareness, isTyping],
  );

  // 设置正在输入状态
  const setTyping = useCallback(
    (typing: boolean) => {
      setIsTypingState(typing);
      applyLocalAwareness(localStatus, typing);
    },
    [applyLocalAwareness, localStatus],
  );

  // 同时设置状态和 typing（避免闭包问题）
  const setStatusAndTyping = useCallback(
    (status: ActionStatus, typing: boolean) => {
      setLocalStatusState(status);
      setIsTypingState(typing);
      applyLocalAwareness(status, typing);
    },
    [applyLocalAwareness],
  );

  // 监听 Awareness 变化
  useEffect(() => {
    // 仅在同步完成后启用 Awareness 监听
    if (connectionStatus !== "synced") {
      setPlayersStatus([]);
      return;
    }

    const unsubscribe = subscribeActionAwareness(members, setPlayersStatus);
    if (!unsubscribe) {
      setPlayersStatus([]);
      return;
    }

    return unsubscribe;
  }, [connectionStatus, members]);

  // 初始化本地状态
  useEffect(() => {
    if (!localUser.userId) {
      return;
    }

    applyLocalAwareness(localStatus, isTyping);
  }, [applyLocalAwareness, isTyping, localStatus, localUser.userId]);

  // 计算统计数据
  const submittedCount = useMemo(
    () =>
      playersStatus.filter(
        (player) => player.status === "submitted" || player.status === "locked",
      ).length,
    [playersStatus],
  );
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

export type { ActionAwarenessState, ActionStatus, PlayerActionInfo };
