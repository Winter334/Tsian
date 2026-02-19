/**
 * Toggle 开关组件
 * 使用主题 Token，避免固定赛博色硬编码
 */

import { cn } from "@/lib/utils";
import { animation, borders, color, colorAlpha, glow } from "@/styles/tokens";
import { motion } from "framer-motion";
import { useState } from "react";

interface ToggleProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}

export function Toggle({
  checked,
  onCheckedChange,
  disabled = false,
  className,
}: ToggleProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const trackBorderColor = checked
    ? colorAlpha("primary", isHovered ? 0.9 : 0.75)
    : colorAlpha("border", isHovered ? 0.75 : 0.55);

  const trackBackground = checked
    ? `linear-gradient(135deg, ${color("primary")} 0%, ${color(
        "secondary"
      )} 100%)`
    : colorAlpha("bgCard", isHovered ? 0.9 : 0.72);

  const focusRing = isFocused
    ? `0 0 0 2px ${colorAlpha("primary", 0.35)}`
    : "none";
  const checkedGlow = checked
    ? glow("primary", "md", isHovered ? 0.55 : 0.45)
    : "none";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      onMouseEnter={() => !disabled && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      className={cn(
        "relative inline-flex h-6 w-11 items-center rounded-full border-2",
        "focus:outline-none",
        `transition-all duration-[${animation.duration.fast * 1000}ms]`,
        disabled && "opacity-50 cursor-not-allowed",
        !disabled && "cursor-pointer",
        className
      )}
      style={{
        background: trackBackground,
        borderColor: trackBorderColor,
        boxShadow: checked ? `${checkedGlow}, ${focusRing}` : focusRing,
      }}
    >
      <motion.span
        initial={false}
        animate={{
          x: checked ? 22 : 2,
        }}
        transition={{
          type: "spring",
          stiffness: 500,
          damping: 30,
        }}
        className="inline-block h-4 w-4 rounded-full"
        style={{
          background: checked
            ? color("textPrimary")
            : colorAlpha("textMuted", 0.9),
          boxShadow: checked
            ? `0 0 10px ${colorAlpha("primary", 0.8)}`
            : `0 0 8px ${colorAlpha("border", 0.4)}`,
        }}
      />
    </button>
  );
}

/**
 * Toggle 卡片组件
 * 带图标、标题、描述的 Toggle 开关
 */
interface ToggleCardProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  icon?: React.ReactNode;
  title: string;
  description?: string;
  disabled?: boolean;
  className?: string;
}

export function ToggleCard({
  checked,
  onCheckedChange,
  icon,
  title,
  description,
  disabled = false,
  className,
}: ToggleCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  const cardBorderColor = disabled
    ? colorAlpha("border", 0.35)
    : colorAlpha(isHovered ? "borderHover" : "border", isHovered ? 0.8 : 0.45);

  const cardBackground = disabled
    ? colorAlpha("bgCard", 0.45)
    : colorAlpha("bgCard", isHovered ? 0.8 : 0.62);

  return (
    <div
      className={cn(
        "flex items-center justify-between p-4",
        `transition-all duration-[${animation.duration.fast * 1000}ms]`,
        disabled && "opacity-60",
        className
      )}
      style={{
        border: `2px solid ${cardBorderColor}`,
        background: cardBackground,
        borderRadius: borders.radius.md,
        boxShadow: !disabled && isHovered ? glow("primary", "sm", 0.2) : "none",
      }}
      onMouseEnter={() => !disabled && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex items-center gap-3">
        {icon && (
          <div
            style={{ color: disabled ? color("textMuted") : color("primary") }}
          >
            {icon}
          </div>
        )}
        <div>
          <div
            className="text-sm font-medium"
            style={{
              color: disabled ? color("textMuted") : color("textPrimary"),
            }}
          >
            {title}
          </div>
          {description && (
            <div
              className="text-xs mt-0.5"
              style={{
                color: disabled ? color("textDisabled") : color("textMuted"),
              }}
            >
              {description}
            </div>
          )}
        </div>
      </div>
      <Toggle
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
      />
    </div>
  );
}
