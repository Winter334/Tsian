/**
 * 加入房间 Hook
 *
 * 通过 CommandBus 发送加入房间命令
 * ✅ 符合架构规范：通过 CommandBus 发送命令
 */

import { RoomCommands } from "@/domain/commands/room";
import { useCommand } from "@/hooks";
import { getOrCreateUserId, saveDisplayName } from "@/lib/user-identity";
import type { WorldConfig } from "@/lib/world";
import { getRuntimeWorldConfig } from "@/lib/world/resolve-config";
import { useCallback, useState } from "react";

/**
 * 加入房间结果
 */
export interface JoinRoomResult {
  success: boolean;
  data?: {
    roomId: string;
    code: string;
    worldConfig: WorldConfig;
  };
  error?: string;
}

/**
 * 加入房间 Hook
 *
 * @returns join 函数、加入状态、错误信息
 *
 * @example
 * ```tsx
 * const { join, isJoining, error } = useJoinRoom();
 *
 * const handleJoin = async () => {
 *   const result = await join("ABC123", "玩家2");
 *
 *   if (result.success) {
 *     console.log("成功加入房间:", result.data.roomId);
 *   }
 * };
 * ```
 */
export function useJoinRoom() {
  const dispatch = useCommand();
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const join = useCallback(
    async (code: string, displayName: string): Promise<JoinRoomResult> => {
      setIsJoining(true);
      setError(null);

      try {
        // 保存显示名到 localStorage
        saveDisplayName(displayName);

        const result = await dispatch({
          type: RoomCommands.JOIN_ROOM,
          payload: {
            code,
            userId: getOrCreateUserId(),
            displayName,
          },
        });

        if (result.success) {
          const data = result.data as {
            roomId: string;
            code?: string;
            worldConfig?: WorldConfig;
          };

          return {
            success: true,
            data: {
              roomId: data.roomId,
              code: data.code ?? code,
              worldConfig: data.worldConfig ?? getRuntimeWorldConfig(),
            },
          };
        } else {
          const errorMsg = result.error || "加入房间失败";
          setError(errorMsg);
          return { success: false, error: errorMsg };
        }
      } catch (e) {
        const errorMsg = e instanceof Error ? e.message : "加入房间失败";
        setError(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setIsJoining(false);
      }
    },
    [dispatch],
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return { join, isJoining, error, clearError };
}
