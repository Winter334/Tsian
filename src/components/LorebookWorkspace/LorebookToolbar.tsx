/**
 * 世界书工作区顶部工具栏
 *
 * 阶段1：标题 + 关闭按钮
 * 阶段2：新建世界书按钮
 */

import { Plus, Settings2, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { animation, color, colorAlpha, gradientText } from "@/styles/tokens";

interface LorebookToolbarProps {
  /** 关闭工作区 */
  onClose: () => void;
  /** 新建世界书 */
  onCreateLorebook: () => void;
  /** 打开全局设置 */
  onOpenGlobalSettings: () => void;
}

export function LorebookToolbar({
  onClose,
  onCreateLorebook,
  onOpenGlobalSettings,
}: LorebookToolbarProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between",
        "px-4 py-3",
        "border-b shrink-0"
      )}
      style={{
        borderColor: colorAlpha("primary", 0.25),
        background: colorAlpha("bgElevated", 0.5),
      }}
    >
      {/* 左侧：标题 */}
      <h1 className="text-lg font-semibold" style={gradientText()}>
        世界书管理
      </h1>

      {/* 右侧：操作按钮 */}
      <div className="flex items-center gap-1">
        {/* 新建世界书 */}
        <button
          onClick={onCreateLorebook}
          className={cn("p-2 rounded-md", "transition-all")}
          style={{
            color: color("textMuted"),
            transitionDuration: `${animation.duration.fast * 1000}ms`,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = color("primary");
            e.currentTarget.style.background = colorAlpha("primary", 0.1);
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = color("textMuted");
            e.currentTarget.style.background = "transparent";
          }}
          aria-label="新建世界书"
          title="新建世界书"
        >
          <Plus size={20} />
        </button>

        {/* 全局设置 */}
        <button
          onClick={onOpenGlobalSettings}
          className={cn("p-2 rounded-md", "transition-all")}
          style={{
            color: color("textMuted"),
            transitionDuration: `${animation.duration.fast * 1000}ms`,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = color("primary");
            e.currentTarget.style.background = colorAlpha("primary", 0.1);
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = color("textMuted");
            e.currentTarget.style.background = "transparent";
          }}
          aria-label="全局设置"
          title="全局设置"
        >
          <Settings2 size={20} />
        </button>

        {/* 关闭按钮 */}
        <button
          onClick={onClose}
          className={cn("p-2 rounded-md", "transition-all")}
          style={{
            color: color("textMuted"),
            transitionDuration: `${animation.duration.fast * 1000}ms`,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = color("textPrimary");
            e.currentTarget.style.background = colorAlpha("primary", 0.1);
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = color("textMuted");
            e.currentTarget.style.background = "transparent";
          }}
          aria-label="关闭工作区"
        >
          <X size={20} />
        </button>
      </div>
    </div>
  );
}
