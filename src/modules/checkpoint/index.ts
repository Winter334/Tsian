/**
 * Checkpoint 模块入口
 *
 * 负责注册检查点命令处理器与自动检查点事件监听。
 */

import { commandBus, registry } from "@/core";
import type { ModuleManifest } from "@/core/registry";
import { yjsManager } from "@/core/yjs";
import { CheckpointCommands } from "@/domain/commands/checkpoint";
import { ChatEvents } from "@/domain/events/chat";
import { RoomEvents } from "@/domain/events/room";
import { useRoomStore } from "@/modules/room";
import { createCheckpointCommandHandlers } from "./handlers";

/**
 * 自动创建检查点
 */
function dispatchAutoCheckpoint(): void {
  commandBus
    .dispatch({
      type: CheckpointCommands.CREATE_CHECKPOINT,
      payload: { source: "auto" },
    })
    .catch(console.error);
}

/**
 * Checkpoint 模块 Manifest
 */
const manifest: ModuleManifest = {
  id: "lyra.checkpoint",
  version: "0.1.0",
  commands: createCheckpointCommandHandlers(),
  eventHandlers: {
    // 单人模式：AI 流式响应完成后自动创建检查点
    [ChatEvents.STREAM_END]: () => {
      const saveId = yjsManager.getCurrentSaveId();
      if (!saveId) return;

      const saveType = yjsManager.getSaveType(saveId);
      if (saveType !== "solo") return;

      dispatchAutoCheckpoint();
    },

    // 联机模式：回合完成后自动创建检查点（仅 Host）
    [RoomEvents.TURN_COMPLETED]: () => {
      const saveId = yjsManager.getCurrentSaveId();
      if (!saveId) return;

      const saveType = yjsManager.getSaveType(saveId);
      if (saveType !== "multiplayer") return;

      const isHost = useRoomStore.getState().currentRoom?.isHost ?? false;
      if (!isHost) return;

      dispatchAutoCheckpoint();
    },
  },
};

/**
 * 注册 Checkpoint 模块
 */
export async function registerCheckpointModule(): Promise<void> {
  await registry.register(manifest);
}
