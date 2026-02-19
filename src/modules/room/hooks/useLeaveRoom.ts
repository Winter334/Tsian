/**
 * 离开房间 Hook
 *
 * 通过 CommandBus 发送离开房间命令
 * ✅ 符合架构规范：通过 CommandBus 发送命令
 */

import { RoomCommands } from "@/domain/commands/room";
import { useCommand } from "@/hooks";
import { getOrCreateUserId } from "@/lib/user-identity";
import { useCallback, useState } from "react";
import { useRoomInfo } from "./useRoomInfo";

/**
 * 离开房间结果
 */
export interface LeaveRoomResult {
  success: boolean;
  error?: string;
}

/**
 * 离开房间 Hook
 *
 * @returns leave 函数、离开状态
 *
 * @example
 * ```tsx
 * const { leave, isLeaving } = useLeaveRoom();
 *
 * const handleLeave = async () => {
 *   const result = await leave();
 *   if (result.success) {
 *     // 返回标题画面或其他处理
 *   }
 * };
 *
 * return (
 *   <Button onClick={handleLeave} disabled={isLeaving}>
 *     {isLeaving ? "离开中..." : "离开房间"}
 *   </Button>
 * );
 * ```
 */
export function useLeaveRoom() {
  const dispatch = useCommand();
  const { currentRoom } = useRoomInfo();
  const [isLeaving, setIsLeaving] = useState(false);

  const leave = useCallback(async (): Promise<LeaveRoomResult> => {
    // 如果没有当前房间，直接返回成功
    if (!currentRoom) {
      return { success: true };
    }

    setIsLeaving(true);

    try {
      const result = await dispatch({
        type: RoomCommands.LEAVE_ROOM,
        payload: {
          roomId: currentRoom.roomId,
          userId: getOrCreateUserId(),
        },
      });

      if (result.success) {
        return { success: true };
      } else {
        return { success: false, error: result.error || "离开房间失败" };
      }
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : "离开房间失败";
      return { success: false, error: errorMsg };
    } finally {
      setIsLeaving(false);
    }
  }, [dispatch, currentRoom]);

  return { leave, isLeaving };
}
