/**
 * 预设按钮组件
 *
 * 显示当前激活预设名称，点击打开预设工作区
 * 用于聊天界面 Header
 */

import { motion } from "framer-motion";
import { FileText } from "lucide-react";

import { usePresetStore } from "@/lib/prompt";
import { animation, colorAlpha } from "@/styles/tokens";

interface PresetButtonProps {
  /** 点击回调 */
  onClick: () => void;
}

/**
 * 预设按钮
 */
export function PresetButton({ onClick }: PresetButtonProps) {
  const activePreset = usePresetStore((s) => s.activePreset);

  return (
    <motion.button
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-1.5 rounded text-sm"
      style={{
        background: colorAlpha("primary", 0.1),
        border: `1px solid ${colorAlpha("primary", 0.3)}`,
        color: colorAlpha("primary", 1),
      }}
      whileHover={{
        scale: 1.02,
        background: colorAlpha("primary", 0.15),
        borderColor: colorAlpha("primary", 0.5),
      }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: animation.duration.fast }}
      title="打开预设工作区"
    >
      <FileText size={16} />
      <span className="hidden max-w-32 truncate sm:inline">
        {activePreset?.name || "选择预设"}
      </span>
    </motion.button>
  );
}
