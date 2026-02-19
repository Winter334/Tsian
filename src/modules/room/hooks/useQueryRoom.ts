/**
 * 查询房间 Hook
 *
 * 通过 CommandBus 查询房间信息（用于加入前预览）
 * ✅ 符合架构规范：通过 CommandBus 发送命令
 */

import { RoomCommands, type QueryRoomResult } from "@/domain/commands/room";
import { useCommand } from "@/hooks";
import { useCallback, useState } from "react";

/**
 * 房间预览信息
 */
export interface RoomPreview {
  /** 房间 ID */
  roomId: string;
  /** 房间名称 */
  name: string;
  /** 房主显示名称 */
  hostName: string;
  /** 当前成员数 */
  memberCount: number;
  /** 最大玩家数 */
  maxPlayers: number;
}

/**
 * 查询房间 Hook
 *
 * 用于加入房间前预览房间信息
 *
 * @returns 房间预览、查询状态、错误信息、查询函数、重置函数
 *
 * @example
 * ```tsx
 * const { roomPreview, isQuerying, queryError, query, reset } = useQueryRoom();
 *
 * // 输入房间码后自动查询
 * const handleCodeChange = (code: string) => {
 *   if (code.length === 6) {
 *     query(code);
 *   } else {
 *     reset();
 *   }
 * };
 *
 * // 显示房间预览
 * {roomPreview && (
 *   <div>
 *     <p>房间名: {roomPreview.name}</p>
 *     <p>房主: {roomPreview.hostName}</p>
 *     <p>人数: {roomPreview.memberCount}/{roomPreview.maxPlayers}</p>
 *   </div>
 * )}
 * ```
 */
export function useQueryRoom() {
  const dispatch = useCommand();
  const [roomPreview, setRoomPreview] = useState<RoomPreview | null>(null);
  const [isQuerying, setIsQuerying] = useState(false);
  const [queryError, setQueryError] = useState<string | null>(null);

  const query = useCallback(
    async (code: string) => {
      setIsQuerying(true);
      setQueryError(null);
      setRoomPreview(null);

      try {
        const result = await dispatch({
          type: RoomCommands.QUERY_ROOM,
          payload: { code },
        });

        if (result.success) {
          const data = result.data as QueryRoomResult;
          setRoomPreview({
            roomId: data.roomId,
            name: data.name,
            hostName: data.hostName,
            memberCount: data.memberCount,
            maxPlayers: data.maxPlayers,
          });
          return { success: true, data };
        } else {
          const errorMsg = result.error || "房间不存在或已过期";
          setQueryError(errorMsg);
          return { success: false, error: errorMsg };
        }
      } catch {
        const errorMsg = "查询失败，请检查网络";
        setQueryError(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setIsQuerying(false);
      }
    },
    [dispatch]
  );

  const reset = useCallback(() => {
    setRoomPreview(null);
    setQueryError(null);
  }, []);

  return { roomPreview, isQuerying, queryError, query, reset };
}
