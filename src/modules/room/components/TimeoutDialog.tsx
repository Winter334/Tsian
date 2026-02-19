/**
 * TimeoutDialog - 回合超时处理弹窗
 *
 * 当回合时间到但有人未提交时，弹出此对话框让 Host 选择处理方式：
 * - 跳过未提交玩家
 * - 使用默认行动"观望"
 * - 延长时间
 * - 踢出未提交玩家
 *
 * 遵循架构规范：通过 CommandBus 执行操作
 */

import { Button, Dialog, DialogContent } from "@/components/ui";
import { RoomCommands } from "@/domain/commands/room";
import { useCommand } from "@/hooks/use-command";
import { cn } from "@/lib/utils";
import { color, colorAlpha } from "@/styles/tokens";
import {
  AlertTriangle,
  Clock,
  Eye,
  SkipForward,
  UserMinus,
  X,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import type { PlayerActionState } from "../hooks/useTurnActions";

// ===== 类型定义 =====

interface TimeoutDialogProps {
  /** 是否显示 */
  open: boolean;
  /** 关闭回调 */
  onClose: () => void;
  /** 房间 ID */
  roomId: string;
  /** 当前回合号 */
  turnNumber: number;
  /** 未提交的玩家列表 */
  unsubmittedPlayers: PlayerActionState[];
  /** 处理完成回调 */
  onHandled?: (action: TimeoutAction) => void;
}

/**
 * 超时处理方式
 */
export type TimeoutAction =
  | "skip" // 跳过未提交玩家
  | "default" // 使用默认行动
  | "extend" // 延长时间
  | "kick"; // 踢出未提交玩家

// ===== 延长时间选项 =====

const EXTEND_OPTIONS = [
  { label: "+1分钟", minutes: 1 },
  { label: "+3分钟", minutes: 3 },
  { label: "+5分钟", minutes: 5 },
];

// ===== 组件实现 =====

export function TimeoutDialog({
  open,
  onClose,
  roomId,
  turnNumber,
  unsubmittedPlayers,
  onHandled,
}: TimeoutDialogProps) {
  const dispatch = useCommand();
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedAction, setSelectedAction] = useState<TimeoutAction | null>(
    null
  );

  // 跳过未提交玩家
  const handleSkip = useCallback(async () => {
    setSelectedAction("skip");
    setIsProcessing(true);
    try {
      // 强制进入下一阶段，跳过未提交玩家
      await dispatch({
        type: RoomCommands.FORCE_START_TURN,
        payload: {
          roomId,
          turnNumber,
          skipUnsubmitted: true,
        },
      });
      onHandled?.("skip");
      onClose();
    } finally {
      setIsProcessing(false);
      setSelectedAction(null);
    }
  }, [dispatch, roomId, turnNumber, onHandled, onClose]);

  // 使用默认行动
  const handleDefaultAction = useCallback(async () => {
    setSelectedAction("default");
    setIsProcessing(true);
    try {
      // 为所有未提交的玩家提交默认行动"观望"
      for (const player of unsubmittedPlayers) {
        await dispatch({
          type: RoomCommands.SUBMIT_ACTION,
          payload: {
            roomId,
            turnNumber,
            userId: player.userId,
            content: "观望局势",
            metadata: { isDefault: true },
          },
        });
      }
      // 然后强制开始
      await dispatch({
        type: RoomCommands.FORCE_START_TURN,
        payload: {
          roomId,
          turnNumber,
        },
      });
      onHandled?.("default");
      onClose();
    } finally {
      setIsProcessing(false);
      setSelectedAction(null);
    }
  }, [dispatch, roomId, turnNumber, unsubmittedPlayers, onHandled, onClose]);

  // 延长时间
  const handleExtend = useCallback(
    async (minutes: number) => {
      setSelectedAction("extend");
      setIsProcessing(true);
      try {
        await dispatch({
          type: RoomCommands.EXTEND_TURN_DEADLINE,
          payload: {
            roomId,
            turnNumber,
            additionalTime: minutes * 60 * 1000,
          },
        });
        onHandled?.("extend");
        onClose();
      } finally {
        setIsProcessing(false);
        setSelectedAction(null);
      }
    },
    [dispatch, roomId, turnNumber, onHandled, onClose]
  );

  // 踢出未提交玩家
  const handleKick = useCallback(async () => {
    setSelectedAction("kick");
    setIsProcessing(true);
    try {
      // 踢出所有未提交的玩家
      for (const player of unsubmittedPlayers) {
        await dispatch({
          type: RoomCommands.KICK_MEMBER,
          payload: {
            roomId,
            userId: player.userId,
            reason: "timeout",
          },
        });
      }
      // 然后强制开始
      await dispatch({
        type: RoomCommands.FORCE_START_TURN,
        payload: {
          roomId,
          turnNumber,
        },
      });
      onHandled?.("kick");
      onClose();
    } finally {
      setIsProcessing(false);
      setSelectedAction(null);
    }
  }, [dispatch, roomId, turnNumber, unsubmittedPlayers, onHandled, onClose]);

  // 未提交玩家名单
  const unsubmittedNames = useMemo(() => {
    return unsubmittedPlayers.map((p) => p.displayName).join("、");
  }, [unsubmittedPlayers]);

  const handleClose = useCallback(() => {
    if (!isProcessing) {
      onClose();
    }
  }, [isProcessing, onClose]);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          handleClose();
        }
      }}
      closeOnEscape={false}
    >
      <DialogContent
        width="sm"
        variant="outlined"
        background="none"
        borderGlow={false}
        closeOnBackdropClick={false}
        showCloseButton={false}
        header={
          <div
            className="flex items-start justify-between gap-4 p-4"
            style={{
              borderBottom: `1px solid ${colorAlpha("warning", 0.35)}`,
            }}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="p-2 rounded-lg"
                style={{ background: colorAlpha("warning", 0.2) }}
              >
                <AlertTriangle
                  className="w-6 h-6"
                  style={{ color: color("warning") }}
                />
              </div>
              <div className="min-w-0">
                <h3
                  className="text-lg font-semibold"
                  style={{ color: color("textPrimary") }}
                >
                  回合超时
                </h3>
                <p
                  className="text-sm"
                  style={{ color: color("textSecondary") }}
                >
                  以下玩家未提交行动
                </p>
              </div>
            </div>

            <button
              onClick={handleClose}
              className="p-1 rounded-lg transition-colors hover:bg-opacity-10"
              style={{ color: color("textMuted") }}
              disabled={isProcessing}
              aria-label="关闭超时处理对话框"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        }
      >
        {/* 未提交玩家列表 */}
        <div
          className="mb-6 p-3 rounded-lg"
          style={{ background: colorAlpha("bgBase", 0.5) }}
        >
          <p
            className="text-sm font-medium"
            style={{ color: color("warning") }}
          >
            {unsubmittedNames}
          </p>
        </div>

        {/* 操作选项 */}
        <div className="space-y-3">
          {/* 跳过未提交玩家 */}
          <Button
            variant="outline"
            size="default"
            onClick={handleSkip}
            disabled={isProcessing}
            className={cn(
              "w-full justify-start",
              selectedAction === "skip" && "opacity-70"
            )}
          >
            <SkipForward className="w-4 h-4 mr-3" />
            <div className="text-left">
              <div>跳过未提交玩家</div>
              <div className="text-xs" style={{ color: color("textMuted") }}>
                这些玩家本回合不参与
              </div>
            </div>
          </Button>

          {/* 使用默认行动 */}
          <Button
            variant="outline"
            size="default"
            onClick={handleDefaultAction}
            disabled={isProcessing}
            className={cn(
              "w-full justify-start",
              selectedAction === "default" && "opacity-70"
            )}
          >
            <Eye className="w-4 h-4 mr-3" />
            <div className="text-left">
              <div>使用默认行动</div>
              <div className="text-xs" style={{ color: color("textMuted") }}>
                自动提交"观望局势"
              </div>
            </div>
          </Button>

          {/* 延长时间 */}
          <div
            className="p-3 rounded-lg border"
            style={{
              borderColor: colorAlpha("border", 0.3),
              background: colorAlpha("bgCard", 0.5),
            }}
          >
            <div className="flex items-center gap-2 mb-2">
              <Clock
                className="w-4 h-4"
                style={{ color: color("textSecondary") }}
              />
              <span
                className="text-sm font-medium"
                style={{ color: color("textSecondary") }}
              >
                延长时间
              </span>
            </div>
            <div className="flex gap-2">
              {EXTEND_OPTIONS.map((option) => (
                <Button
                  key={option.minutes}
                  variant="ghost"
                  size="sm"
                  onClick={() => handleExtend(option.minutes)}
                  disabled={isProcessing}
                  className="flex-1 text-xs"
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>

          {/* 踢出玩家 */}
          <Button
            variant="destructive"
            size="default"
            onClick={handleKick}
            disabled={isProcessing}
            className={cn(
              "w-full justify-start",
              selectedAction === "kick" && "opacity-70"
            )}
          >
            <UserMinus className="w-4 h-4 mr-3" />
            <div className="text-left">
              <div>踢出未提交玩家</div>
              <div className="text-xs opacity-70">将这些玩家移出房间</div>
            </div>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
