import { useEffect, useState } from "react";

import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  Textarea,
} from "@/components/ui";

interface SummaryEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  content: string;
  onSave: (content: string) => void;
}

/**
 * 总结编辑弹窗（小总结/大总结共用）
 */
export function SummaryEditDialog({
  open,
  onOpenChange,
  title,
  content,
  onSave,
}: SummaryEditDialogProps) {
  const [editContent, setEditContent] = useState(content);

  useEffect(() => {
    if (open) {
      setEditContent(content);
    }
  }, [open, content]);

  const handleSave = () => {
    onSave(editContent);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={title} width="lg" animateLifecycle>
        <div className="space-y-3">
          <Textarea
            value={editContent}
            onChange={(event) => setEditContent(event.target.value)}
            rows={12}
            placeholder="请输入总结内容"
          />
        </div>

        <DialogFooter className="mt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            取消
          </Button>
          <Button type="button" onClick={handleSave}>
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
