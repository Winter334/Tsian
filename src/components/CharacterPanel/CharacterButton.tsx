/**
 * 角色面板快捷按钮
 *
 * 显示在游戏界面 Header 中，点击打开角色面板 Dialog。
 * 风格参考 PresetButton / LorebookButton。
 */

import { motion } from "framer-motion";
import { UserCircle } from "lucide-react";

import { animation, colorAlpha } from "@/styles/tokens";

import { usePlayerCharacter } from ".";

interface CharacterButtonProps {
  /** 点击回调 */
  onClick: () => void;
}

/**
 * 角色面板快捷按钮
 */
export function CharacterButton({ onClick }: CharacterButtonProps) {
  const character = usePlayerCharacter();

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
      title="查看角色信息"
    >
      <UserCircle size={16} />
      <span className="hidden max-w-24 truncate sm:inline">
        {character?.name ?? "角色"}
      </span>
    </motion.button>
  );
}
