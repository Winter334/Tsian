/**
 * useTurnActions - 回合行动状态 Hook
 *
 * 从 TurnDoc 读取所有玩家的行动提交状态
 * 这是解决"自动开始不触发AI回复"问题的关键 Hook
 *
 * 问题根源：
 * - useTurnControl 中的 allSubmitted 来自 useActionAwareness（Awareness 状态）
 * - Awareness 是临时状态，可能与 TurnDoc 不同步
 * - 当 Guest 提交时，Host 的 Awareness 可能没有及时更新
 *
 * 解决方案：
 * - 从 TurnDoc 读取实际的行动提交状态
 * - 使用 Yjs 观察器实现响应式更新
 * - 提供准确的 allSubmitted 状态
 */

import { subdocManager } from "@/core/yjs";
import type { Member, PlayerAction } from "@/core/yjs/room/types";
import { useCallback, useEffect, useMemo, useState } from "react";
import * as Y from "yjs";
import { useTurnDocStatus } from "./useTurnDocStatus";

/**
 * 玩家行动信息
 */
export interface PlayerActionState {
  userId: string;
  displayName: string;
  isSubmitted: boolean;
  content: string;
  submittedAt: number | null;
  isLocked: boolean;
  /** 是否正在输入（来自 Awareness，可选） */
  isTyping?: boolean;
}

/**
 * Hook 返回值
 */
export interface UseTurnActionsReturn {
  /** 所有玩家的行动状态 */
  players: PlayerActionState[];
  /** 已提交的玩家数 */
  submittedCount: number;
  /** 总玩家数 */
  totalPlayers: number;
  /** 是否全员已提交 */
  allSubmitted: boolean;
  /** 回合是否已锁定 */
  isLocked: boolean;
  /** 锁定原因 */
  lockReason: string | null;
  /** 是否正在加载 */
  loading: boolean;
  /** 刷新状态 */
  refresh: () => void;
}

/**
 * useTurnActions Hook
 *
 * 从 TurnDoc 读取所有玩家的行动提交状态
 *
 * @param roomId 房间 ID
 * @param turnNumber 回合号
 */
export function useTurnActions(
  roomId: string | null,
  turnNumber: number
): UseTurnActionsReturn {
  const [players, setPlayers] = useState<PlayerActionState[]>([]);
  const [isLocked, setIsLocked] = useState(false);
  const [lockReason, setLockReason] = useState<string | null>(null);

  // 监听 TurnDoc 同步状态
  const turnDocStatus = useTurnDocStatus(roomId, turnNumber);
  const loading = turnDocStatus !== "synced";

  /**
   * 从 TurnDoc 和 MainDoc 读取所有玩家的行动状态
   */
  const readAllActions = useCallback((): {
    players: PlayerActionState[];
    isLocked: boolean;
    lockReason: string | null;
  } => {
    if (!roomId || turnNumber <= 0) {
      return { players: [], isLocked: false, lockReason: null };
    }

    const mainDoc = subdocManager.getMainDoc(roomId);
    const turnDoc = subdocManager.getTurnDoc(roomId, turnNumber);

    if (!mainDoc || !turnDoc) {
      return { players: [], isLocked: false, lockReason: null };
    }

    // 读取成员列表
    const membersMap = mainDoc.getMap("members") as Y.Map<Member>;
    const actionsMap = turnDoc.getMap("actions") as Y.Map<PlayerAction>;
    const configMap = turnDoc.getMap("config");

    // 读取锁定状态
    const locked = (configMap.get("isLocked") as boolean) || false;
    const reason = (configMap.get("lockReason") as string) || null;

    // 构建玩家状态列表
    const playerStates: PlayerActionState[] = [];
    membersMap.forEach((member, oderId) => {
      const action = actionsMap.get(oderId);
      playerStates.push({
        userId: oderId,
        displayName: member.displayName,
        isSubmitted: !!action,
        content: action?.content || "",
        submittedAt: action?.submittedAt || null,
        isLocked: !!action?.lockedAt,
      });
    });

    // 按加入时间排序
    playerStates.sort((a, b) => {
      const memberA = membersMap.get(a.userId);
      const memberB = membersMap.get(b.userId);
      return (memberA?.joinedAt || 0) - (memberB?.joinedAt || 0);
    });

    return { players: playerStates, isLocked: locked, lockReason: reason };
  }, [roomId, turnNumber]);

  /**
   * 刷新状态
   */
  const refresh = useCallback(() => {
    const result = readAllActions();
    setPlayers(result.players);
    setIsLocked(result.isLocked);
    setLockReason(result.lockReason);
  }, [readAllActions]);

  // 监听 TurnDoc 的 actions 和 config 变化
  useEffect(() => {
    if (!roomId || turnNumber <= 0 || turnDocStatus !== "synced") {
      setPlayers([]);
      setIsLocked(false);
      setLockReason(null);
      return;
    }

    const turnDoc = subdocManager.getTurnDoc(roomId, turnNumber);
    const mainDoc = subdocManager.getMainDoc(roomId);
    if (!turnDoc || !mainDoc) {
      return;
    }

    // 初始读取
    refresh();

    // 设置观察器
    const actionsMap = turnDoc.getMap("actions");
    const configMap = turnDoc.getMap("config");
    const membersMap = mainDoc.getMap("members");

    const observer = () => refresh();

    actionsMap.observe(observer);
    configMap.observe(observer);
    membersMap.observe(observer);

    return () => {
      actionsMap.unobserve(observer);
      configMap.unobserve(observer);
      membersMap.unobserve(observer);
    };
  }, [roomId, turnNumber, turnDocStatus, refresh]);

  // 计算统计数据
  const submittedCount = useMemo(
    () => players.filter((p) => p.isSubmitted).length,
    [players]
  );
  const totalPlayers = players.length;
  const allSubmitted = useMemo(
    () => totalPlayers > 0 && submittedCount >= totalPlayers,
    [submittedCount, totalPlayers]
  );

  return {
    players,
    submittedCount,
    totalPlayers,
    allSubmitted,
    isLocked,
    lockReason,
    loading,
    refresh,
  };
}
