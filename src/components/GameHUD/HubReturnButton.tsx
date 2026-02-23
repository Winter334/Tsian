import { motion } from "framer-motion";
import { X } from "lucide-react";

import { animation, colorAlpha, glow } from "@/styles/tokens";

interface HubReturnButtonProps {
  onClick: () => void;
  className?: string;
}

export function HubReturnButton({ onClick, className }: HubReturnButtonProps) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      title="返回大厅"
      className={[
        "absolute top-3 right-3 z-50",
        "w-10 h-10 rounded-full",
        "inline-flex items-center justify-center",
        "backdrop-blur-sm",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        background: colorAlpha("bgElevated", 0.6),
        border: `1px solid ${colorAlpha("primary", 0.2)}`,
        color: colorAlpha("textPrimary", 0.95),
      }}
      whileHover={{
        scale: 1.05,
        boxShadow: glow("primary", "md", 0.35),
      }}
      whileTap={{ scale: 0.96 }}
      transition={{ duration: animation.duration.fast }}
      aria-label="返回大厅"
    >
      <X className="w-4 h-4" />
    </motion.button>
  );
}

export type { HubReturnButtonProps };
