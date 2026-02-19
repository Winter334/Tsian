/**
 * useMyAction - 当前用户行动状态 Hook
 *
 * 从 TurnDoc 读取当前用户的已提交行动状态
 * 这是解决"第一次提交被重置"问题的关键 Hook
 *
 * 问题根源：
 * - ActionInput 使用 useActionAwareness 的 localStatus（本地状态）
 * - 提交行动后数据写入 TurnDoc，但 localStatus 不从 TurnDoc 读取
 * - 当 TurnDoc 同步时，本地状态可能与 TurnDoc 不一致
 *
 * 解决方案：
 * - 从 TurnDoc 读取已提交的行动状态
 * - 使用 Yjs 观察器实现响应式更新
 * - 与 Awareness 状态结合使用
 */

import { subdocManager } from "@/core/yjs";
import type { PlayerAction } from "@/core/yjs/room/types";
import { useCallback, useEffect, useState } from "react";
import * as Y from "yjs";
import { useRoomStore } from "../store";
import { useTurnDocStatus } from "./useTurnDocStatus";

/**
 * 我的行动状态
 */
export interface MyActionState {
  /** 是否已提交 */
  isSubmitted: boolean;
  /** 提交的内容 */
  content: string;
  /** 提交时间 */
  submittedAt: number | null;
  /** 是否已锁定 */
  isLocked: boolean;
  /** 锁定时间 */
  lockedAt: number | null;
}

/**
 * Hook 返回值
 */
export interface UseMyActionReturn extends MyActionState {
  /** 是否正在加载（TurnDoc 未同步） */
  loading: boolean;
  /** 刷新状态 */
  refresh: () => void;
}

/**
 * 空状态
 */
const EMPTY_STATE: MyActionState = {
  isSubmitted: false,
  content: "",
  submittedAt: null,
  isLocked: false,
  lockedAt: null,
};

/**
 * useMyAction Hook
 *
 * 从 TurnDoc 读取当前用户的已提交行动状态
 *
 * @param roomId 房间 ID
 * @param turnNumber 回合号
 */
export function useMyAction(
  roomId: string | null,
  turnNumber: number
): UseMyActionReturn {
  const localUser = useRoomStore((s) => s.localUser);
  const [state, setState] = useState<MyActionState>(EMPTY_STATE);

  // 监听 TurnDoc 同步状态
  const turnDocStatus = useTurnDocStatus(roomId, turnNumber);
  const loading = turnDocStatus !== "synced";

  /**
   * 从 TurnDoc 读取当前用户的行动
   */
  const readMyAction = useCallback((): MyActionState => {
    if (!roomId || !localUser.userId || turnNumber <= 0) {
      return EMPTY_STATE;
    }

    const turnDoc = subdocManager.getTurnDoc(roomId, turnNumber);
    if (!turnDoc) {
      return EMPTY_STATE;
    }

    const actionsMap = turnDoc.getMap("actions") as Y.Map<PlayerAction>;
    const myAction = actionsMap.get(localUser.userId);

    if (!myAction) {
      return EMPTY_STATE;
    }

    return {
      isSubmitted: true,
      content: myAction.content,
      submittedAt: myAction.submittedAt,
      isLocked: !!myAction.lockedAt,
      lockedAt: myAction.lockedAt ?? null,
    };
  }, [roomId, localUser.userId, turnNumber]);

  /**
   * 刷新状态
   */
  const refresh = useCallback(() => {
    setState(readMyAction());
  }, [readMyAction]);

  // 监听 TurnDoc 的 actions 变化
  useEffect(() => {
    if (!roomId || turnNumber <= 0 || turnDocStatus !== "synced") {
      setState(EMPTY_STATE);
      return;
    }

    const turnDoc = subdocManager.getTurnDoc(roomId, turnNumber);
    if (!turnDoc) {
      setState(EMPTY_STATE);
      return;
    }

    // 初始读取
    setState(readMyAction());

    // 设置观察器
    const actionsMap = turnDoc.getMap("actions");
    const observer = () => {
      setState(readMyAction());
    };

    actionsMap.observe(observer);

    return () => {
      actionsMap.unobserve(observer);
    };
  }, [roomId, turnNumber, turnDocStatus, readMyAction]);

  return {
    ...state,
    loading,
    refresh,
  };
}
