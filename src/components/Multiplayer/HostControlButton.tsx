import { AlertTriangle, Play, Zap } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { Button, Dialog, DialogContent } from "@/components/ui";
import { cn } from "@/lib/utils";
import { color, colorAlpha } from "@/styles/tokens";

interface HostControlButtonProps {
  /** 已提交人数 */
  submittedCount: number;
  /** 总人数 */
  totalPlayers: number;
  /** 是否已全员提交 */
  allSubmitted: boolean;
  /** 未提交玩家名称 */
  unsubmittedPlayers: string[];
  /** 是否禁用 */
  disabled?: boolean;
  /** 强制开始回调 */
  onForceStart: () => Promise<void> | void;
  /** 自定义样式 */
  className?: string;
}

function buildUnsubmittedSummary(names: string[]): string {
  if (names.length === 0) {
    return "仍有玩家未提交行动。";
  }

  if (names.length <= 4) {
    return `未提交：${names.join("、")}`;
  }

  return `未提交：${names.slice(0, 4).join("、")} 等 ${names.length} 人`;
}

export function HostControlButton({
  submittedCount,
  totalPlayers,
  allSubmitted,
  unsubmittedPlayers,
  disabled = false,
  onForceStart,
  className,
}: HostControlButtonProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const normalizedSubmitted = useMemo(() => {
    if (totalPlayers <= 0) {
      return 0;
    }
    return Math.max(0, Math.min(submittedCount, totalPlayers));
  }, [submittedCount, totalPlayers]);

  const canStart = useMemo(() => {
    return (
      !disabled && !isProcessing && totalPlayers > 0 && normalizedSubmitted > 0
    );
  }, [disabled, isProcessing, totalPlayers, normalizedSubmitted]);

  const buttonLabel = allSubmitted
    ? "立即开始"
    : `${normalizedSubmitted}/${totalPlayers}`;

  const buttonStyle = useMemo<React.CSSProperties | undefined>(() => {
    if (allSubmitted) {
      return undefined;
    }

    return {
      background: colorAlpha("warning", 0.14),
      borderColor: colorAlpha("warning", 0.5),
      color: color("warning"),
    };
  }, [allSubmitted]);

  const handleExecuteForceStart = useCallback(async () => {
    setIsProcessing(true);
    try {
      await onForceStart();
      setConfirmOpen(false);
    } finally {
      setIsProcessing(false);
    }
  }, [onForceStart]);

  const handlePrimaryClick = useCallback(() => {
    if (!canStart) {
      return;
    }

    if (allSubmitted) {
      void handleExecuteForceStart();
      return;
    }

    setConfirmOpen(true);
  }, [allSubmitted, canStart, handleExecuteForceStart]);

  return (
    <div className={cn("shrink-0", className)}>
      <Button
        type="button"
        variant={allSubmitted ? "default" : "outline"}
        size="sm"
        disabled={!canStart}
        className="h-12 min-w-22 gap-1.5 px-3 font-medium"
        style={buttonStyle}
        onClick={handlePrimaryClick}
        title={
          allSubmitted
            ? "全部提交完成，可立即开始"
            : `当前提交进度 ${buttonLabel}`
        }
      >
        {allSubmitted ? (
          <Zap className="h-4 w-4" />
        ) : (
          <Play className="h-4 w-4" />
        )}
        <span className="font-mono text-xs tabular-nums">{buttonLabel}</span>
      </Button>

      {typeof document !== "undefined"
        ? createPortal(
            <Dialog
              open={confirmOpen}
              onOpenChange={(open) => {
                if (!isProcessing) {
                  setConfirmOpen(open);
                }
              }}
              closeOnEscape={!isProcessing}
            >
              <DialogContent
                title="确认强制开始"
                description="仍有玩家未提交，本操作将立即锁定并推进本回合。"
                width="sm"
                closeOnBackdropClick={!isProcessing}
                footer={
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setConfirmOpen(false)}
                      disabled={isProcessing}
                    >
                      取消
                    </Button>
                    <Button
                      type="button"
                      variant="default"
                      onClick={() => void handleExecuteForceStart()}
                      disabled={isProcessing}
                      style={{
                        background: colorAlpha("warning", 0.85),
                        color: color("textPrimary"),
                      }}
                    >
                      {isProcessing ? "处理中..." : "确认强制开始"}
                    </Button>
                  </div>
                }
              >
                <div
                  className="rounded-lg border p-3 text-sm"
                  style={{
                    borderColor: colorAlpha("warning", 0.35),
                    background: colorAlpha("warning", 0.12),
                    color: color("textSecondary"),
                  }}
                >
                  <div
                    className="mb-1 flex items-center gap-2"
                    style={{ color: color("warning") }}
                  >
                    <AlertTriangle className="h-4 w-4" />
                    <span className="font-medium">未提交玩家提醒</span>
                  </div>
                  <p>{buildUnsubmittedSummary(unsubmittedPlayers)}</p>
                </div>
              </DialogContent>
            </Dialog>,
            document.body
          )
        : null}
    </div>
  );
}
