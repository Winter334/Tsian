/**
 * 创建房间 Hook
 *
 * 通过 CommandBus 发送创建房间命令
 * ✅ 符合架构规范：通过 CommandBus 发送命令
 */

import { RoomCommands } from "@/domain/commands/room";
import { useCommand } from "@/hooks";
import { getOrCreateUserId, saveDisplayName } from "@/lib/user-identity";
import { useCallback, useState } from "react";

/**
 * 创建房间选项
 */
export interface CreateRoomOptions {
  /** 房间名称 */
  name: string;
  /** 房主显示名称 */
  hostDisplayName: string;
  /** 最大玩家数（2-8，默认 4） */
  maxPlayers?: number;
  /** 回合时长（分钟，默认 5） */
  turnDuration?: number;
}

/**
 * 创建房间结果
 */
export interface CreateRoomResult {
  success: boolean;
  data?: {
    roomId: string;
    code: string;
  };
  error?: string;
}

/**
 * 创建房间 Hook
 *
 * @returns create 函数、创建状态、错误信息
 *
 * @example
 * ```tsx
 * const { create, isCreating, error } = useCreateRoom();
 *
 * const handleCreate = async () => {
 *   const result = await create({
 *     name: "我的房间",
 *     hostDisplayName: "玩家1",
 *     maxPlayers: 4,
 *     turnDuration: 5,
 *   });
 *
 *   if (result.success) {
 *     console.log("房间码:", result.data.code);
 *   }
 * };
 * ```
 */
export function useCreateRoom() {
  const dispatch = useCommand();
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = useCallback(
    async (options: CreateRoomOptions): Promise<CreateRoomResult> => {
      setIsCreating(true);
      setError(null);

      try {
        // 保存显示名到 localStorage
        saveDisplayName(options.hostDisplayName);

        const result = await dispatch({
          type: RoomCommands.CREATE_ROOM,
          payload: {
            name: options.name,
            hostUserId: getOrCreateUserId(),
            hostDisplayName: options.hostDisplayName,
            maxPlayers: options.maxPlayers ?? 4,
            turnDuration: (options.turnDuration ?? 5) * 60 * 1000,
          },
        });

        if (result.success) {
          return {
            success: true,
            data: result.data as { roomId: string; code: string },
          };
        } else {
          const errorMsg = result.error || "创建房间失败";
          setError(errorMsg);
          return { success: false, error: errorMsg };
        }
      } catch (e) {
        const errorMsg = e instanceof Error ? e.message : "创建房间失败";
        setError(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setIsCreating(false);
      }
    },
    [dispatch]
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return { create, isCreating, error, clearError };
}
