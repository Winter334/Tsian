/**
 * Game 模块命令处理器（G1 骨架）
 */

import type { CommandHandler } from "@/core/command-bus";

export function createGameCommandHandlers(): Record<
  string,
  CommandHandler<unknown, unknown>
> {
  return {};
}
