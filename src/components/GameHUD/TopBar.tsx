import { motion } from "framer-motion";
import { Menu } from "lucide-react";
import { useMemo } from "react";

import { ConnectionIndicator } from "@/components/Multiplayer";
import { useTurnControl } from "@/modules";
import { selectSessionMode, useSessionStore } from "@/stores";
import { animation, colorAlpha, glow } from "@/styles/tokens";

import { HubReturnButton } from "./HubReturnButton";

interface TopBarProps {
  onOpenLeftSidebar: () => void;
  onOpenRightSidebar: () => void;
  onReturnToHub: () => void;
  onOpenRoomInfo: () => void;
  disabled?: boolean;
}

interface TopBarIconButtonProps {
  onClick: () => void;
  ariaLabel: string;
  disabled?: boolean;
}

function formatTime(seconds: number): string {
  if (seconds <= 0) {
    return "0:00";
  }

  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function TopBarIconButton({
  onClick,
  ariaLabel,
  disabled = false,
}: TopBarIconButtonProps) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        "md:hidden h-8 w-8 rounded-full",
        "inline-flex items-center justify-center",
        "backdrop-blur-sm",
        disabled ? "cursor-not-allowed opacity-50" : undefined,
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        background: colorAlpha("bgElevated", 0.58),
        border: `1px solid ${colorAlpha("primary", 0.2)}`,
        color: colorAlpha("textPrimary", 0.95),
      }}
      whileHover={disabled ? undefined : { scale: 1.04 }}
      whileTap={disabled ? undefined : { scale: 0.96 }}
      transition={{ duration: animation.duration.fast }}
      aria-label={ariaLabel}
    >
      <Menu className="h-4 w-4" />
    </motion.button>
  );
}

export function TopBar({
  onOpenLeftSidebar,
  onOpenRightSidebar,
  onReturnToHub,
  onOpenRoomInfo,
  disabled = false,
}: TopBarProps) {
  const sessionMode = useSessionStore(selectSessionMode);
  const roomId = useSessionStore((s) => s.roomId);
  const connectionStatus = useSessionStore((s) => s.connectionStatus);

  const turnControl = useTurnControl(roomId ?? "");
  const isMultiplayer = sessionMode === "multiplayer";

  const timerText = useMemo(() => {
    if (!roomId || turnControl.turnNumber <= 0) {
      return "未开始";
    }

    if (turnControl.isLocked) {
      return "已锁定";
    }

    if (turnControl.deadline <= 0) {
      return "--:--";
    }

    return formatTime(turnControl.remainingSeconds);
  }, [
    roomId,
    turnControl.deadline,
    turnControl.isLocked,
    turnControl.remainingSeconds,
    turnControl.turnNumber,
  ]);

  return (
    <header
      className="h-10 shrink-0 px-3 flex items-center gap-2"
      style={{
        borderBottom: `1px solid ${colorAlpha("primary", 0.15)}`,
        background: colorAlpha("bgElevated", 0.8),
      }}
    >
      <div className="shrink-0 flex items-center">
        <TopBarIconButton
          onClick={onOpenLeftSidebar}
          ariaLabel="打开角色状态侧栏"
          disabled={disabled}
        />
      </div>

      <div className="flex-1 min-w-0 flex items-center justify-center">
        {isMultiplayer ? (
          <motion.button
            type="button"
            onClick={onOpenRoomInfo}
            disabled={disabled}
            className={[
              "h-8 max-w-full px-3 rounded-full",
              "inline-flex items-center gap-2",
              "text-xs sm:text-sm",
              "backdrop-blur-sm",
              disabled ? "cursor-not-allowed opacity-55" : undefined,
            ]
              .filter(Boolean)
              .join(" ")}
            style={{
              background: colorAlpha("bgElevated", 0.56),
              border: `1px solid ${colorAlpha("primary", 0.2)}`,
              color: colorAlpha("textPrimary", 0.95),
            }}
            whileHover={
              disabled
                ? undefined
                : {
                    scale: 1.02,
                    boxShadow: glow("primary", "sm", 0.2),
                  }
            }
            whileTap={disabled ? undefined : { scale: 0.98 }}
            transition={{ duration: animation.duration.fast }}
            aria-label="查看房间信息"
          >
            <span className="font-mono tabular-nums">{timerText}</span>
            <ConnectionIndicator status={connectionStatus} />
          </motion.button>
        ) : null}
      </div>

      <div className="shrink-0 flex items-center gap-2">
        <TopBarIconButton
          onClick={onOpenRightSidebar}
          ariaLabel="打开右侧功能栏侧栏"
          disabled={disabled}
        />
        <HubReturnButton
          onClick={onReturnToHub}
          floating={false}
          className="h-8 w-8"
          disabled={disabled}
        />
      </div>
    </header>
  );
}

export type { TopBarProps };
