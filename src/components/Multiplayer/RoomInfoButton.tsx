import { Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui";
import {
  useConnectionStatus,
  useRoomInfo,
  useRoomMembers,
  useTurnControl,
} from "@/modules";

import { ConnectionIndicator } from "./ConnectionIndicator";
import { RoomInfoDialog } from "./RoomInfoDialog";

interface RoomInfoButtonProps {
  onLeave?: () => void;
}

function formatTime(seconds: number): string {
  if (seconds <= 0) {
    return "0:00";
  }

  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function getConnectionHint(
  status: ReturnType<typeof useConnectionStatus>
): string {
  switch (status) {
    case "synced":
      return "在线";
    case "connected":
      return "已连接";
    case "connecting":
      return "连接中";
    case "reconnecting":
      return "重连中";
    case "error":
      return "错误";
    default:
      return "离线";
  }
}

export function RoomInfoButton({ onLeave }: RoomInfoButtonProps) {
  const { mode, currentRoom } = useRoomInfo();
  const members = useRoomMembers();
  const connectionStatus = useConnectionStatus();
  const turnControl = useTurnControl(currentRoom?.roomId ?? "");

  const [open, setOpen] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);

  useEffect(() => {
    if (
      turnControl.turnNumber <= 0 ||
      turnControl.deadline <= 0 ||
      turnControl.isLocked
    ) {
      setRemainingSeconds(null);
      return;
    }

    const updateRemaining = () => {
      const remaining = Math.max(
        0,
        Math.ceil((turnControl.deadline - Date.now()) / 1000)
      );
      setRemainingSeconds(remaining);
    };

    updateRemaining();
    const timer = window.setInterval(updateRemaining, 1000);

    return () => window.clearInterval(timer);
  }, [turnControl.turnNumber, turnControl.deadline, turnControl.isLocked]);

  const timerText = useMemo(() => {
    if (turnControl.turnNumber <= 0) {
      return "未开始";
    }

    if (turnControl.isLocked) {
      return "已锁定";
    }

    if (remainingSeconds === null) {
      return "--:--";
    }

    return formatTime(remainingSeconds);
  }, [turnControl.turnNumber, turnControl.isLocked, remainingSeconds]);

  if (mode === "offline" || !currentRoom) {
    return null;
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="h-10 gap-2 px-3 text-xs sm:text-sm"
        onClick={() => setOpen(true)}
      >
        <ConnectionIndicator status={connectionStatus} />
        <span className="hidden text-xs text-muted-foreground sm:inline">
          {getConnectionHint(connectionStatus)}
        </span>
        <span className="font-mono tabular-nums">{timerText}</span>
        <span className="flex items-center gap-1 text-muted-foreground">
          <Users size={14} />
          <span>{members.length}</span>
        </span>
      </Button>

      {typeof document !== "undefined"
        ? createPortal(
            <RoomInfoDialog
              open={open}
              onOpenChange={setOpen}
              onLeave={onLeave}
            />,
            document.body
          )
        : null}
    </>
  );
}
