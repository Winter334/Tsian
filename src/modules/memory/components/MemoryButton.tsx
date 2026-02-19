import { Brain } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui";

import { MemoryManagerDialog } from "./MemoryManagerDialog";

/**
 * 记忆管理入口按钮
 *
 * 显示在 Header 中，点击后打开记忆管理弹窗。
 */
export function MemoryButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen(true)}
        title="记忆管理"
        aria-label="打开记忆管理"
      >
        <Brain className="h-4 w-4" />
      </Button>

      <MemoryManagerDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
