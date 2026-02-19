/**
 * AiHostControls - Host AI 控制按钮组件
 *
 * Host 在 completed 状态下的控制按钮：
 * - 重新生成
 * - 开始下一回合
 *
 * 其他状态（processing/retrying/failed/aborted）由 AiProcessingStatus 处理
 *
 * @module room/components/AiHostControls
 */

import { Button } from "@/components/ui";
import type { AiStatus } from "@/core/yjs/room/types";
import { RoomCommands } from "@/domain/commands/room";
import { useCommand } from "@/hooks/use-command";
import { cn } from "@/lib/utils";
import { borders, color, colorAlpha } from "@/styles/tokens";
import { ChevronRight, RefreshCw } from "lucide-react";
import { useCallback, useState } from "react";
import { useRoomStore } from "../store";

// ===== 类型定义 =====

interface AiHostControlsProps {
  /** 房间 ID */
  roomId: string;
  /** 当前回合号 */
  turnNumber: number;
  /** AI 状态 */
  aiStatus: AiStatus;
  /** 自定义样式 */
  className?: string;
}

// ===== 组件实现 =====

export function AiHostControls({
  roomId,
  turnNumber,
  aiStatus,
  className,
}: AiHostControlsProps) {
  const dispatch = useCommand();
  const isHost = useRoomStore((s) => s.currentRoom?.isHost ?? false);
  const userId = useRoomStore((s) => s.localUser.userId);
  const [isLoading, setIsLoading] = useState(false);

  // 重新生成
  const handleRegenerate = useCallback(async () => {
    setIsLoading(true);
    try {
      await dispatch({
        type: RoomCommands.REGENERATE_AI_TURN,
        payload: { roomId, turnNumber, userId },
      });
    } finally {
      setIsLoading(false);
    }
  }, [dispatch, roomId, turnNumber, userId]);

  // 开始下一回合
  const handleNextTurn = useCallback(async () => {
    setIsLoading(true);
    try {
      // 先完成当前回合
      await dispatch({
        type: RoomCommands.COMPLETE_TURN,
        payload: { roomId, turnNumber },
      });
      // 开始下一回合
      await dispatch({
        type: RoomCommands.START_TURN,
        payload: { roomId },
      });
    } finally {
      setIsLoading(false);
    }
  }, [dispatch, roomId, turnNumber]);

  // 非 Host 不显示
  if (!isHost) return null;

  // 空闲状态不显示
  if (aiStatus === "idle") return null;

  // processing/retrying/failed/aborted: 不显示
  // AiProcessingStatus 已包含所有必要的操作按钮
  if (
    aiStatus === "processing" ||
    aiStatus === "retrying" ||
    aiStatus === "failed" ||
    aiStatus === "aborted"
  ) {
    return null;
  }

  // completed: 重新生成 + 开始下一回合
  if (aiStatus === "completed") {
    return (
      <div
        className={cn(
          "flex items-center justify-between p-3 rounded-xl border",
          className
        )}
        style={{
          background: colorAlpha("bgCard", 0.5),
          borderColor: colorAlpha("success", 0.3),
          borderRadius: borders.radius.lg,
        }}
      >
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRegenerate}
          disabled={isLoading}
        >
          <RefreshCw className="w-4 h-4 mr-1" />
          重新生成
        </Button>

        <Button
          variant="default"
          size="default"
          onClick={handleNextTurn}
          disabled={isLoading}
          style={{ background: color("success") }}
        >
          <ChevronRight className="w-4 h-4 mr-1" />
          开始下一回合
        </Button>
      </div>
    );
  }

  return null;
}

/**
 * GuestWaitingMessage - Guest 等待消息组件
 *
 * 显示 Guest 在等待 Host 操作时的消息
 */
interface GuestWaitingMessageProps {
  /** AI 状态 */
  aiStatus: AiStatus;
  /** 中断原因 */
  abortReason?: string;
  /** 自定义样式 */
  className?: string;
}

export function GuestWaitingMessage({
  aiStatus,
  abortReason,
  className,
}: GuestWaitingMessageProps) {
  const isHost = useRoomStore((s) => s.currentRoom?.isHost ?? false);

  // Host 不显示
  if (isHost) return null;

  // 只有特定状态显示
  if (
    aiStatus !== "failed" &&
    aiStatus !== "aborted" &&
    aiStatus !== "completed"
  ) {
    return null;
  }

  let message = "";

  if (aiStatus === "failed") {
    message = "AI 处理遇到问题，等待房主处理...";
  } else if (aiStatus === "aborted" && abortReason === "host_offline") {
    message = "房主离线，AI 处理中断";
  } else if (aiStatus === "completed") {
    message = "等待房主开始下一回合...";
  }

  if (!message) return null;

  return (
    <div
      className={cn("text-center py-3 px-4 rounded-xl", className)}
      style={{
        background: colorAlpha("bgCard", 0.5),
        color: color("textSecondary"),
        borderRadius: borders.radius.lg,
      }}
    >
      <span className="text-sm">{message}</span>
    </div>
  );
}
