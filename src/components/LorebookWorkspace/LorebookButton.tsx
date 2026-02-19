/**
 * 世界书快捷按钮组件
 *
 * 显示在游戏界面 Header 中，点击打开世界书工作区。
 * 参考 PresetButton 的风格。
 */

import { motion } from "framer-motion";
import { BookOpen } from "lucide-react";

import { animation, colorAlpha } from "@/styles/tokens";

interface LorebookButtonProps {
  /** 点击回调 */
  onClick: () => void;
}

/**
 * 世界书快捷按钮
 */
export function LorebookButton({ onClick }: LorebookButtonProps) {
  return (
    <motion.button
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-1.5 rounded text-sm"
      style={{
        background: colorAlpha("secondary", 0.1),
        border: `1px solid ${colorAlpha("secondary", 0.3)}`,
        color: colorAlpha("secondary", 1),
      }}
      whileHover={{
        scale: 1.02,
        background: colorAlpha("secondary", 0.15),
        borderColor: colorAlpha("secondary", 0.5),
      }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: animation.duration.fast }}
      title="打开世界书管理"
    >
      <BookOpen size={16} />
      <span className="hidden sm:inline">世界书</span>
    </motion.button>
  );
}
