import { ConfirmDialog } from "@/components/ui";

interface RestoreConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  type: "revert" | "regenerate";
  checkpointLabel?: string;
}

export function RestoreConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  type,
  checkpointLabel,
}: RestoreConfirmDialogProps) {
  if (type === "revert") {
    return (
      <ConfirmDialog
        open={open}
        onOpenChange={onOpenChange}
        title="回溯到此检查点？"
        description={`将恢复到「${checkpointLabel ?? "该检查点"}」，此检查点之后的所有游戏进度将被丢弃。`}
        confirmText="确认回溯"
        cancelText="取消"
        variant="destructive"
        onConfirm={onConfirm}
      />
    );
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="重新生成？"
      description="将回溯到上一个检查点并重新发送您的消息，当前回复及之后的内容将被丢弃。"
      confirmText="确认重新生成"
      cancelText="取消"
      variant="destructive"
      onConfirm={onConfirm}
    />
  );
}
