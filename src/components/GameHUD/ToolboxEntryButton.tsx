import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { useState } from "react";

import { animation, color, colorAlpha, glow } from "@/styles/tokens";

interface ToolboxEntryButtonProps {
  icon: LucideIcon;
  label: string;
  description: string;
  onClick: () => void;
  badge?: number;
}

export function ToolboxEntryButton({
  icon: Icon,
  label,
  description,
  onClick,
  badge,
}: ToolboxEntryButtonProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="relative w-full rounded-lg px-3 py-2.5 flex items-center gap-3 text-left"
      style={{
        background: isHovered
          ? colorAlpha("primary", 0.08)
          : colorAlpha("bgElevated", 0.4),
        border: `1px solid ${
          isHovered ? colorAlpha("primary", 0.3) : colorAlpha("primary", 0.15)
        }`,
        boxShadow: isHovered ? glow("primary", "sm", 0.15) : "none",
      }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: animation.duration.fast }}
      aria-label={label}
      title={label}
    >
      <span
        className="inline-flex items-center justify-center w-8 h-8 rounded-md shrink-0"
        style={{
          background: colorAlpha("primary", 0.12),
          color: color("primary"),
        }}
      >
        <Icon size={16} />
      </span>

      <span className="flex-1 min-w-0 flex flex-col">
        <span
          className="text-sm font-medium leading-tight"
          style={{ color: color("textPrimary") }}
        >
          {label}
        </span>
        <span
          className="mt-0.5 text-xs leading-tight"
          style={{ color: colorAlpha("textSecondary", 0.7) }}
        >
          {description}
        </span>
      </span>

      {typeof badge === "number" && badge > 0 ? (
        <span
          className="absolute top-1.5 right-1.5 min-w-5 h-5 px-1 rounded-full inline-flex items-center justify-center text-[10px] font-semibold leading-none"
          style={{
            background: color("primary"),
            color: color("textPrimary"),
          }}
        >
          {badge > 99 ? "99+" : badge}
        </span>
      ) : null}
    </motion.button>
  );
}

export type { ToolboxEntryButtonProps };
