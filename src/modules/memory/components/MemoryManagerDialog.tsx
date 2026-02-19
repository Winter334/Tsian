import { useState } from "react";

import { Dialog, DialogContent } from "@/components/ui";
import { color, colorAlpha, glow } from "@/styles/tokens";

import { ManualMemoryList } from "./ManualMemoryList";
import { MegaSummaryList } from "./MegaSummaryList";
import { MiniSummaryList } from "./MiniSummaryList";

interface MemoryManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type TabType = "mini" | "mega" | "manual";

const TABS: Array<{ key: TabType; label: string }> = [
  { key: "mini", label: "小总结" },
  { key: "mega", label: "大总结" },
  { key: "manual", label: "手动记忆" },
];

/**
 * 记忆管理主弹窗
 *
 * 功能：
 * - 大尺寸 Dialog 容器
 * - 三个分页入口（小总结 / 大总结 / 手动记忆）
 * - 三类记忆列表的查看与管理
 */
export function MemoryManagerDialog({
  open,
  onOpenChange,
}: MemoryManagerDialogProps) {
  const [activeTab, setActiveTab] = useState<TabType>("mini");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="记忆管理" width={1100} animateLifecycle>
        {/* 用负边距抵消 DialogContent 的内边距，获得工作区式布局 */}
        <div className="-m-4 flex h-[72vh] min-h-135 flex-col">
          <nav
            className="flex items-center gap-2 border-b px-4 py-3"
            role="tablist"
            aria-label="记忆管理标签"
            style={{ borderColor: colorAlpha("primary", 0.2) }}
          >
            {TABS.map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-controls={`memory-manager-panel-${tab.key}`}
                  onClick={() => setActiveTab(tab.key)}
                  className="rounded-md px-3 py-1.5 text-sm font-medium transition-all duration-200"
                  style={{
                    color: isActive ? color("primary") : color("textMuted"),
                    background: isActive
                      ? colorAlpha("primary", 0.16)
                      : "transparent",
                    border: `1px solid ${
                      isActive
                        ? colorAlpha("primary", 0.5)
                        : colorAlpha("primary", 0.22)
                    }`,
                    boxShadow: isActive ? glow("primary", "sm", 0.2) : "none",
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </nav>

          <section
            id={`memory-manager-panel-${activeTab}`}
            role="tabpanel"
            className="min-h-0 flex-1 p-4"
          >
            {activeTab === "mini" && <MiniSummaryList />}
            {activeTab === "mega" && <MegaSummaryList />}
            {activeTab === "manual" && <ManualMemoryList />}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
