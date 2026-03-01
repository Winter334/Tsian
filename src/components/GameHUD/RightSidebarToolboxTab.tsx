import { Activity, Archive } from "lucide-react";

import { color, colorAlpha } from "@/styles/tokens";

import { ToolboxEntryButton } from "./ToolboxEntryButton";

interface RightSidebarToolboxTabProps {
  onOpenAiInsight: () => void;
  onOpenArchiveManager: () => void;
}

export function RightSidebarToolboxTab({
  onOpenAiInsight,
  onOpenArchiveManager,
}: RightSidebarToolboxTabProps) {
  return (
    <div className="p-4 space-y-3">
      <section>
        <h2
          className="text-sm font-bold tracking-wider uppercase"
          style={{ color: color("textPrimary") }}
        >
          工具箱
        </h2>
        <p
          className="text-xs mt-0.5"
          style={{ color: colorAlpha("textSecondary", 0.8) }}
        >
          运行时功能入口
        </p>
      </section>

      <section className="space-y-2">
        <ToolboxEntryButton
          icon={Activity}
          label="AI 洞察"
          description="查看各 AI 的返回内容"
          onClick={onOpenAiInsight}
        />
        <ToolboxEntryButton
          icon={Archive}
          label="世界档案"
          description="管理叙事实体"
          onClick={onOpenArchiveManager}
        />
      </section>
    </div>
  );
}

export type { RightSidebarToolboxTabProps };
