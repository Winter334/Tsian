import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { useMemo, useState } from "react";

import { animation, color, colorAlpha, glow } from "@/styles/tokens";

type HubPosition =
  | "top-left"
  | "top-right"
  | "middle-left"
  | "middle-right"
  | "bottom-left"
  | "bottom-right"
  | "inline";

interface HubFeatureIconProps {
  position?: HubPosition;
  icon: LucideIcon;
  label: string;
  sublabel?: string;
  status?: string;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}

const positionClassMap: Record<Exclude<HubPosition, "inline">, string> = {
  "top-left": "absolute top-4 left-4 md:top-8 md:left-8",
  "top-right": "absolute top-4 right-4 md:top-8 md:right-8",
  "middle-left": "absolute top-1/2 -translate-y-1/2 left-4 md:left-8",
  "middle-right": "absolute top-1/2 -translate-y-1/2 right-4 md:right-8",
  "bottom-left": "absolute bottom-4 left-4 md:bottom-8 md:left-8",
  "bottom-right": "absolute bottom-4 right-4 md:bottom-8 md:right-8",
};

export function HubFeatureIcon({
  position = "inline",
  icon: Icon,
  label,
  sublabel,
  status,
  onClick,
  disabled = false,
  className,
}: HubFeatureIconProps) {
  const [isHovered, setIsHovered] = useState(false);

  const containerClassName = useMemo(() => {
    const positionClass =
      position === "inline" ? "" : (positionClassMap[position] ?? "");

    return [
      positionClass,
      "z-20",
      "flex flex-col items-center justify-center gap-1.5 md:gap-2",
      className,
    ]
      .filter(Boolean)
      .join(" ");
  }, [className, position]);

  const glowShadow = useMemo(() => {
    if (!isHovered || disabled) {
      return "none";
    }

    return glow("primary", "md", 0.3);
  }, [disabled, isHovered]);

  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={containerClassName}
      style={{
        opacity: disabled ? 0.45 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
        transitionProperty: "box-shadow, opacity, transform",
        transitionDuration: `${animation.duration.normal}s`,
        transitionTimingFunction: "ease",
        boxShadow: glowShadow,
      }}
      whileHover={disabled ? undefined : { scale: 1.05 }}
      whileTap={disabled ? undefined : { scale: 0.95 }}
      transition={{ duration: animation.duration.fast }}
      onHoverStart={() => {
        if (!disabled) {
          setIsHovered(true);
        }
      }}
      onHoverEnd={() => {
        if (!disabled) {
          setIsHovered(false);
        }
      }}
      title={label}
      aria-label={label}
    >
      <Icon
        className="w-6 h-6 md:w-9 md:h-9"
        style={{ color: color("primary") }}
        strokeWidth={1.8}
      />

      <span
        className="text-xs md:text-sm font-medium leading-none text-center"
        style={{ color: color("textPrimary") }}
      >
        {label}
      </span>

      {sublabel && (
        <span
          className="text-[8px] md:text-[10px] leading-none uppercase tracking-wider text-center"
          style={{ color: colorAlpha("textSecondary", 0.6) }}
        >
          {sublabel}
        </span>
      )}

      {status && (
        <span
          className="text-[8px] md:text-[10px] leading-tight text-center max-w-28 md:max-w-36"
          style={{ color: colorAlpha("textMuted", 0.8) }}
        >
          {status}
        </span>
      )}
    </motion.button>
  );
}

export type { HubFeatureIconProps, HubPosition };
