import { AnimatePresence, motion } from "framer-motion";
import { RotateCcw, Trash2 } from "lucide-react";
import { useCallback, useState } from "react";

import {
  Button,
  Card,
  ConfirmDialog,
  Dialog,
  DialogContent,
  ScrollArea,
  useToast,
} from "@/components/ui";
import { CheckpointCommands } from "@/domain/commands/checkpoint";
import type { Checkpoint } from "@/domain/entities/checkpoint";
import { useCommand } from "@/hooks";
import { useCheckpoints } from "@/modules/checkpoint/hooks/useCheckpoints";
import { color, colorAlpha, listItemVariants } from "@/styles/tokens";

interface CheckpointPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * 格式化检查点时间：
 * - 今天：HH:mm
 * - 非今天：M月D日 HH:mm
 */
function formatCheckpointTime(timestamp: number): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return "--:--";
  }

  const now = new Date();
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  if (isToday) {
    return `${hours}:${minutes}`;
  }

  return `${date.getMonth() + 1}月${date.getDate()}日 ${hours}:${minutes}`;
}

function getSourceLabel(source: Checkpoint["source"]): string {
  return source === "manual" ? "手动" : "自动";
}

/**
 * 检查点管理面板（Dialog）
 */
export function CheckpointPanel({ open, onOpenChange }: CheckpointPanelProps) {
  const checkpoints = useCheckpoints();
  const dispatch = useCommand();
  const { toast } = useToast();

  const [selectedCheckpoint, setSelectedCheckpoint] =
    useState<Checkpoint | null>(null);
  const [restoreConfirmOpen, setRestoreConfirmOpen] = useState(false);
  const [restoringCheckpointId, setRestoringCheckpointId] = useState<
    string | null
  >(null);
  const [deletingCheckpointId, setDeletingCheckpointId] = useState<
    string | null
  >(null);

  const handleAskRestore = useCallback((checkpoint: Checkpoint) => {
    setSelectedCheckpoint(checkpoint);
    setRestoreConfirmOpen(true);
  }, []);

  const handleRestore = useCallback(async () => {
    if (!selectedCheckpoint) {
      return;
    }

    const target = selectedCheckpoint;
    setRestoringCheckpointId(target.id);

    try {
      const result = await dispatch({
        type: CheckpointCommands.RESTORE_CHECKPOINT,
        payload: { checkpointId: target.id },
      });

      if (result.success) {
        toast("success", "回溯成功", `已回溯到「${target.label}」`);
      } else {
        toast("error", "回溯失败", result.error || "无法回溯到该检查点");
      }
    } catch {
      toast("error", "回溯失败", "请稍后重试");
    } finally {
      setRestoringCheckpointId(null);
      setSelectedCheckpoint(null);
    }
  }, [dispatch, selectedCheckpoint, toast]);

  const handleDelete = useCallback(
    async (checkpoint: Checkpoint) => {
      setDeletingCheckpointId(checkpoint.id);

      try {
        const result = await dispatch({
          type: CheckpointCommands.DELETE_CHECKPOINT,
          payload: { checkpointId: checkpoint.id },
        });

        if (!result.success) {
          toast("error", "删除失败", result.error || "无法删除该检查点");
        }
      } catch {
        toast("error", "删除失败", "请稍后重试");
      } finally {
        setDeletingCheckpointId(null);
      }
    },
    [dispatch, toast],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="检查点"
        width="md"
        background="starfield"
        borderGlow
        enterAnimation
      >
        {checkpoints.length === 0 ? (
          <div className="flex min-h-56 items-center justify-center px-4 py-12 text-center">
            <p className="text-sm" style={{ color: color("textMuted") }}>
              暂无检查点，游戏过程中将自动创建
            </p>
          </div>
        ) : (
          <ScrollArea maxHeight="65vh" className="pr-1">
            <div className="space-y-3">
              <AnimatePresence initial={false} mode="popLayout">
                {checkpoints.map((checkpoint, index) => {
                  const isRestoring = restoringCheckpointId === checkpoint.id;
                  const isDeleting = deletingCheckpointId === checkpoint.id;

                  return (
                    <motion.div
                      key={checkpoint.id}
                      variants={listItemVariants}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                      custom={index}
                      layout
                    >
                      <Card
                        variant="default"
                        hover
                        glowOnHover
                        className="group p-4"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <h3
                                className="truncate font-medium"
                                style={{ color: color("textPrimary") }}
                                title={checkpoint.label}
                              >
                                {checkpoint.label}
                              </h3>
                              <span
                                className="shrink-0 rounded px-1.5 py-0.5 text-xs"
                                style={{
                                  background: colorAlpha(
                                    checkpoint.source === "manual"
                                      ? "secondary"
                                      : "primary",
                                    0.16,
                                  ),
                                  color:
                                    checkpoint.source === "manual"
                                      ? color("secondaryLight")
                                      : color("primaryLight"),
                                }}
                              >
                                {getSourceLabel(checkpoint.source)}
                              </span>
                            </div>
                            <p
                              className="mt-2 text-sm"
                              style={{ color: colorAlpha("primary", 0.7) }}
                            >
                              {formatCheckpointTime(checkpoint.createdAt)}
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleAskRestore(checkpoint)}
                              disabled={isRestoring}
                              style={{ color: color("primaryLight") }}
                            >
                              <RotateCcw className="mr-1 h-4 w-4" />
                              {isRestoring ? "回溯中..." : "回溯到此"}
                            </Button>

                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                void handleDelete(checkpoint);
                              }}
                              disabled={isDeleting || isRestoring}
                              className="opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100"
                              style={{ color: colorAlpha("error", 0.7) }}
                              title="删除检查点"
                              aria-label="删除检查点"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </Card>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </ScrollArea>
        )}

        <ConfirmDialog
          open={restoreConfirmOpen}
          onOpenChange={(nextOpen) => {
            setRestoreConfirmOpen(nextOpen);
            if (!nextOpen) {
              setSelectedCheckpoint(null);
            }
          }}
          title="回溯到检查点"
          description={`将丢弃「${selectedCheckpoint?.label ?? ""}」之后的所有游戏进度，此操作不可撤销。是否继续？`}
          confirmText="确认回溯"
          cancelText="取消"
          variant="destructive"
          onConfirm={() => {
            void handleRestore();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
