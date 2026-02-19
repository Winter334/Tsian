import { Flag } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui";

import { CheckpointPanel } from "./CheckpointPanel";

/**
 * 检查点管理入口按钮
 *
 * 显示在 Header 中，点击后打开检查点管理弹窗。
 */
export function CheckpointButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen(true)}
        title="检查点"
        aria-label="打开检查点管理"
      >
        <Flag className="h-4 w-4" />
      </Button>

      <CheckpointPanel open={open} onOpenChange={setOpen} />
    </>
  );
}
