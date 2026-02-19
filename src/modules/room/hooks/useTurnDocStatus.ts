/**
 * useTurnDocStatus - TurnDoc 同步状态 Hook
 *
 * 监听指定回合的 TurnDoc 同步状态变化
 * 使用 useSyncExternalStore 实现响应式订阅
 *
 * @module room/hooks/useTurnDocStatus
 */

import { turnDocProvider } from "@/core/yjs";
import type { ConnectionStatus } from "@/core/yjs/multiplayer-provider";
import { useCallback, useSyncExternalStore } from "react";

/**
 * useTurnDocStatus Hook
 *
 * 监听指定回合的 TurnDoc 同步状态
 *
 * @param roomId - 房间 ID
 * @param turnNumber - 回合号
 * @returns TurnDoc 的连接状态
 */
export function useTurnDocStatus(
  roomId: string | null,
  turnNumber: number
): ConnectionStatus {
  // 订阅函数
  const subscribe = useCallback(
    (callback: () => void) => {
      if (!roomId || turnNumber <= 0) {
        return () => {};
      }

      // 订阅 turnDocProvider 的状态变化
      return turnDocProvider.subscribe((event) => {
        if (event.roomId === roomId && event.turnNumber === turnNumber) {
          callback();
        }
      });
    },
    [roomId, turnNumber]
  );

  // 获取快照
  const getSnapshot = useCallback(() => {
    if (!roomId || turnNumber <= 0) {
      return "disconnected";
    }
    return turnDocProvider.getStatus(roomId, turnNumber);
  }, [roomId, turnNumber]);

  // 服务端快照
  const getServerSnapshot = useCallback(
    () => "disconnected" as ConnectionStatus,
    []
  );

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * useTurnDocSynced Hook
 *
 * 检查指定回合的 TurnDoc 是否已同步
 *
 * @param roomId - 房间 ID
 * @param turnNumber - 回合号
 * @returns 是否已同步
 */
export function useTurnDocSynced(
  roomId: string | null,
  turnNumber: number
): boolean {
  const status = useTurnDocStatus(roomId, turnNumber);
  return status === "synced";
}
