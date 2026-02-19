/**
 * useTurnControl - 回合控制 Hook
 *
 * 管理回合超时逻辑：
 * - 监听截止时间
 * - 超时检测和处理
 * - 行动锁定状态
 *
 * 遵循架构规范：只读查询，状态修改通过 CommandBus
 *
 * ⚠️ 重要修复（2026-02-03）：
 * - 使用 useTurnActions 从 TurnDoc 读取提交状态
 * - 确保 allSubmitted 状态与 TurnDoc 同步
 * - 移除自动开始功能，全员提交后仍需 Host 手动点击开始
 */

import { subdocManager } from "@/core/yjs";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRoomStore } from "../store";
import { useActionAwareness } from "./useActionAwareness";
import { useTurnActions, type PlayerActionState } from "./useTurnActions";

// ===== 类型定义 =====

/**
 * 回合控制状态
 */
export interface TurnControlState {
  /** 当前回合号 */
  turnNumber: number;
  /** 截止时间（毫秒时间戳） */
  deadline: number;
  /** 回合总时长（毫秒） */
  totalDuration: number;
  /** 剩余时间（秒） */
  remainingSeconds: number;
  /** 是否已超时 */
  isTimeout: boolean;
  /** 是否所有行动已锁定 */
  isLocked: boolean;
  /** 玩家状态列表（从 TurnDoc 读取） */
  playersStatus: PlayerActionState[];
  /** 已提交的玩家数 */
  submittedCount: number;
  /** 总玩家数 */
  totalPlayers: number;
  /** 是否全员已提交 */
  allSubmitted: boolean;
  /** 未提交的玩家列表 */
  unsubmittedPlayers: PlayerActionState[];
}

/**
 * Hook 返回值
 */
export interface UseTurnControlReturn extends TurnControlState {
  /** 触发超时处理（显示弹窗等） */
  triggerTimeout: () => void;
  /** 确认锁定行动（重置本地状态） */
  confirmLock: () => void;
}

// ===== 常量 =====

/** 更新间隔（毫秒） */
const UPDATE_INTERVAL = 1000;

// ===== Hook 实现 =====

export function useTurnControl(roomId: string): UseTurnControlReturn {
  const currentRoom = useRoomStore((s) => s.currentRoom);
  void currentRoom; // 保留用于未来功能扩展

  // 从 MainDoc 获取当前回合号
  const [currentTurnNumber, setCurrentTurnNumber] = useState(0);

  // ⚠️ 关键修复：从 TurnDoc 读取提交状态
  // 这解决了"自动开始不触发AI回复"的问题
  const turnActions = useTurnActions(roomId, currentTurnNumber);

  // Awareness 状态（仅用于 typing indicator）
  const awarenessState = useActionAwareness();

  // 合并状态：优先使用 TurnDoc 的状态
  const playersStatus = useMemo(() => {
    // ⚠️ 关键修复：TurnDoc 加载期间返回空数组
    // 不再使用 Awareness 作为后备，避免状态不一致
    if (turnActions.loading) {
      return [];
    }

    // 合并 TurnDoc 状态和 Awareness 的 typing 状态
    // Awareness 只用于 typing indicator
    return turnActions.players.map((p) => {
      const awarenessPlayer = awarenessState.playersStatus.find(
        (ap) => ap.userId === p.userId
      );
      return {
        ...p,
        isTyping: awarenessPlayer?.isTyping || false,
      };
    });
  }, [turnActions.loading, turnActions.players, awarenessState.playersStatus]);

  // 使用 TurnDoc 的提交统计
  // ⚠️ 关键修复：不再使用 Awareness 作为后备
  // 在 TurnDoc 加载期间，显示 0/0，避免错误触发自动开始
  const submittedCount = turnActions.loading ? 0 : turnActions.submittedCount;
  const totalPlayers = turnActions.loading ? 0 : turnActions.totalPlayers;
  // ⚠️ 关键：只有 TurnDoc 同步完成后才能判断 allSubmitted
  // 这确保自动开始逻辑不会被 Awareness 的不准确状态触发
  const allSubmitted = turnActions.loading ? false : turnActions.allSubmitted;

  // 本地状态
  const [deadline, setDeadline] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [isTimeout, setIsTimeout] = useState(false);

  // 使用 TurnDoc 的锁定状态
  const isLocked = turnActions.isLocked;

  // 获取回合数据（从 MainDoc）
  useEffect(() => {
    if (!roomId) return;

    const mainDoc = subdocManager.getMainDoc(roomId);
    if (!mainDoc) return;

    const configMap = mainDoc.getMap("config");
    const metadataMap = mainDoc.getMap("metadata");

    const updateTurnInfo = () => {
      const turnNumber = (configMap.get("currentTurnNumber") as number) || 0;
      const turnDuration =
        (metadataMap.get("turnDuration") as number) || 5 * 60 * 1000;

      setCurrentTurnNumber(turnNumber);
      setTotalDuration(turnDuration);
    };

    // 初始化
    updateTurnInfo();

    // 监听变化
    const handleConfigChange = () => updateTurnInfo();
    configMap.observe(handleConfigChange);
    metadataMap.observe(handleConfigChange);

    return () => {
      configMap.unobserve(handleConfigChange);
      metadataMap.unobserve(handleConfigChange);
    };
  }, [roomId]);

  // ⚠️ 关键修复：从 TurnDoc 获取 deadline
  // 需要等待 TurnDoc 同步完成后才能读取正确的 deadline
  useEffect(() => {
    if (!roomId || currentTurnNumber <= 0 || turnActions.loading) {
      // TurnDoc 未同步时，不设置 deadline，避免错误触发超时
      return;
    }

    const turnDoc = subdocManager.getTurnDoc(roomId, currentTurnNumber);
    if (!turnDoc) {
      return;
    }

    const turnConfig = turnDoc.getMap("config");

    const updateDeadline = () => {
      const turnDeadline = (turnConfig.get("deadline") as number) || 0;
      if (turnDeadline > 0) {
        setDeadline(turnDeadline);
        // 重置超时状态，因为我们现在有了正确的 deadline
        setIsTimeout(false);
      }
    };

    // 初始化
    updateDeadline();

    // 监听 TurnDoc config 变化
    turnConfig.observe(updateDeadline);

    return () => {
      turnConfig.unobserve(updateDeadline);
    };
  }, [roomId, currentTurnNumber, turnActions.loading]);

  // 倒计时逻辑
  useEffect(() => {
    if (deadline <= 0 || isLocked) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const remaining = Math.max(0, Math.ceil((deadline - now) / 1000));
      setRemainingSeconds(remaining);

      if (remaining <= 0) {
        setIsTimeout(true);
        clearInterval(interval);
      }
    }, UPDATE_INTERVAL);

    // 立即更新一次
    const now = Date.now();
    setRemainingSeconds(Math.max(0, Math.ceil((deadline - now) / 1000)));

    return () => clearInterval(interval);
  }, [deadline, isLocked]);

  // 未提交的玩家列表
  const unsubmittedPlayers = useMemo(() => {
    return playersStatus.filter((p) => !p.isSubmitted);
  }, [playersStatus]);

  // 触发超时处理
  const triggerTimeout = useCallback(() => {
    setIsTimeout(true);
  }, []);

  // 确认锁定（重置本地状态，实际锁定由 lockActionHandler 处理）
  const confirmLock = useCallback(() => {
    setIsTimeout(false);
  }, []);

  return {
    turnNumber: currentTurnNumber,
    deadline,
    totalDuration,
    remainingSeconds,
    isTimeout,
    isLocked,
    playersStatus,
    submittedCount,
    totalPlayers,
    allSubmitted,
    unsubmittedPlayers,
    triggerTimeout,
    confirmLock,
  };
}
