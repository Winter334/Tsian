/**
 * TurnTimeoutController - 回合超时控制器
 *
 * 将超时弹窗触发责任从 TurnStatusPanel 抽离，
 * 仅负责监听超时状态并管理 TimeoutDialog 生命周期。
 */
import { useCallback, useEffect, useState } from "react";
import { useTurnControl } from "../hooks/useTurnControl";
import { useRoomStore } from "../store";
import { TimeoutDialog } from "./TimeoutDialog";

// ===== 类型定义 =====

interface TurnTimeoutControllerProps {
  /** 房间 ID */
  roomId: string;
}

// ===== 组件实现 =====

export function TurnTimeoutController({ roomId }: TurnTimeoutControllerProps) {
  const isHost = useRoomStore((s) => s.currentRoom?.isHost ?? false);
  const { turnNumber, isTimeout, unsubmittedPlayers, confirmLock } =
    useTurnControl(roomId);

  const [open, setOpen] = useState(false);

  const hasUnsubmittedPlayers = unsubmittedPlayers.length > 0;

  // 监听超时状态，决定是否显示处理弹窗
  useEffect(() => {
    if (turnNumber <= 0 || !isTimeout) {
      return;
    }

    if (isHost && hasUnsubmittedPlayers) {
      setOpen(true);
      return;
    }

    // 全员已提交或非 Host：重置本地超时状态，避免重复触发
    confirmLock();
  }, [turnNumber, isTimeout, isHost, hasUnsubmittedPlayers, confirmLock]);

  const handleClose = useCallback(() => {
    setOpen(false);
  }, []);

  const handleHandled = useCallback(() => {
    setOpen(false);
    confirmLock();
  }, [confirmLock]);

  if (turnNumber <= 0) {
    return null;
  }

  return (
    <TimeoutDialog
      open={open}
      onClose={handleClose}
      roomId={roomId}
      turnNumber={turnNumber}
      unsubmittedPlayers={unsubmittedPlayers}
      onHandled={handleHandled}
    />
  );
}
