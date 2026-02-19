/**
 * 命令发送 Hook
 */

import { commandBus, type Command, type CommandResult } from "@/core";
import { useCallback } from "react";

/**
 * 发送命令的 Hook
 *
 * @returns dispatch 函数
 *
 * @example
 * ```tsx
 * const dispatch = useCommand();
 *
 * const handleSend = async () => {
 *   const result = await dispatch({
 *     type: ChatCommands.SEND_MESSAGE,
 *     payload: { content: 'Hello!' },
 *   });
 *   if (!result.success) {
 *     console.error(result.error);
 *   }
 * };
 * ```
 */
export function useCommand() {
  const dispatch = useCallback(
    async <C, R>(command: Command<C>): Promise<CommandResult<R>> => {
      return commandBus.dispatch<C, R>(command);
    },
    []
  );

  return dispatch;
}
