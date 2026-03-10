/**
 * Toggle 开关组件 — Glitch 赛博朋克风格
 * 切换时带有 RGB 色差分离（chromatic aberration）、扫描线纹理、闪光特效
 * 使用主题 Token + Framer Motion，不引入额外依赖
 */

import { cn } from "@/lib/utils";
import { animation, borders, color, colorAlpha, glow } from "@/styles/tokens";
import { motion } from "framer-motion";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

// ========== Toggle（标准尺寸） ==========

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
  const [isGlitching, setIsGlitching] = useState(false);
  const [glitchKey, setGlitchKey] = useState(0);
  const prevCheckedRef = useRef(checked);

  // useLayoutEffect 确保 glitch 效果与 thumb 移动同步启动（无 1 帧延迟）
  // 通过对比前一个 checked 值跳过初始 mount，兼容 React Strict Mode 的 remount 行为
  useLayoutEffect(() => {
    if (prevCheckedRef.current === checked) return;
    prevCheckedRef.current = checked;
    setIsGlitching(true);
    setGlitchKey((k) => k + 1);
  }, [checked]);

  // 延迟清除 glitch 状态
  useEffect(() => {
    if (isGlitching) {
      const timer = setTimeout(() => setIsGlitching(false), 400);
      return () => clearTimeout(timer);
    }
  }, [isGlitching]);

  const toX = checked ? 22 : 2;
  const fromX = checked ? 2 : 22;

  // ---- Track 样式 ----
  const trackBorderColor = checked
    ? colorAlpha("primary", isHovered ? 0.9 : 0.75)
    : colorAlpha("border", isHovered ? 0.75 : 0.55);

  const trackBg = checked
    ? `linear-gradient(135deg, ${color("primary")} 0%, ${color("secondary")} 100%)`
    : colorAlpha("bgCard", isHovered ? 0.9 : 0.72);

  const focusRing = isFocused
    ? `0 0 0 2px ${colorAlpha("primary", 0.35)}`
    : "none";

  const checkedGlow = checked
    ? glow("primary", "md", isHovered ? 0.55 : 0.45)
    : "none";

  // ---- Thumb 阴影（glitch 时色差分离，加大偏移使效果更明显） ----
  const thumbShadow = isGlitching
    ? `5px 0 10px rgba(255, 30, 70, 0.8), -5px 0 10px rgba(30, 130, 255, 0.8), 0 0 14px ${colorAlpha("primary", 1)}`
    : checked
      ? `0 0 10px ${colorAlpha("primary", 0.8)}`
      : `0 0 8px ${colorAlpha("border", 0.4)}`;

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
        "relative inline-flex h-6 w-11 shrink-0 items-center overflow-hidden rounded-sm border-2",
        "focus:outline-none",
        "transition-all duration-150",
        disabled && "opacity-50 cursor-not-allowed",
        !disabled && "cursor-pointer",
        className,
      )}
      style={{
        background: trackBg,
        borderColor: trackBorderColor,
        boxShadow: checked ? `${checkedGlow}, ${focusRing}` : focusRing,
      }}
    >
      {/* 斜线扫描线纹理 */}
      <span
        className="absolute inset-0 pointer-events-none rounded-[3px]"
        style={{
          backgroundImage: `repeating-linear-gradient(
            -45deg,
            transparent 0px,
            transparent 3px,
            ${colorAlpha("bgBase", 0.1)} 3px,
            ${colorAlpha("bgBase", 0.1)} 4px
          )`,
        }}
      />

      {/* Glitch 闪光 — 切换时轨道闪一下 */}
      {isGlitching && (
        <motion.span
          key={`flash-${glitchKey}`}
          initial={{ opacity: 0.6 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="absolute inset-0 pointer-events-none rounded-[3px] z-30"
          style={{
            background: `linear-gradient(90deg, transparent 20%, ${colorAlpha("primary", 0.4)} 50%, transparent 80%)`,
          }}
        />
      )}

      {/* 光扫线 — 一道亮线从一侧扫到另一侧 */}
      {isGlitching && (
        <motion.span
          key={`sweep-${glitchKey}`}
          initial={{ x: fromX - 8, opacity: 1 }}
          animate={{ x: toX + 8, opacity: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="absolute top-0 bottom-0 w-0.75 pointer-events-none z-20"
          style={{
            background: `linear-gradient(to bottom, transparent 10%, ${color("textPrimary")} 50%, transparent 90%)`,
            filter: "blur(0.5px)",
          }}
        />
      )}

      {/* 色差分离残影 — 红色通道（Y 方向也偏移，使其不被 thumb 遮挡） */}
      {isGlitching && (
        <motion.span
          key={`ghost-r-${glitchKey}`}
          initial={{ x: fromX + 2, y: -2, opacity: 0.8 }}
          animate={{ x: toX + 4, y: 0, opacity: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="absolute h-4 w-4 rounded-xs pointer-events-none"
          style={{
            background: "rgba(255, 30, 60, 0.5)",
            filter: "blur(0.5px)",
          }}
        />
      )}

      {/* 色差分离残影 — 蓝色通道 */}
      {isGlitching && (
        <motion.span
          key={`ghost-b-${glitchKey}`}
          initial={{ x: fromX - 2, y: 2, opacity: 0.8 }}
          animate={{ x: toX - 4, y: 0, opacity: 0 }}
          transition={{ duration: 0.22, ease: "easeOut", delay: 0.03 }}
          className="absolute h-4 w-4 rounded-xs pointer-events-none"
          style={{
            background: "rgba(30, 100, 255, 0.5)",
            filter: "blur(0.5px)",
          }}
        />
      )}

      {/* 主 Thumb 滑块 — 方形数据块风格 */}
      <motion.span
        initial={false}
        animate={{ x: toX }}
        transition={{
          type: "spring",
          stiffness: 380,
          damping: 24,
        }}
        className="relative inline-block h-4 w-4 rounded-xs z-10"
        style={{
          background: checked
            ? color("textPrimary")
            : colorAlpha("textMuted", 0.9),
          boxShadow: thumbShadow,
          transition: "box-shadow 0.15s ease-out",
        }}
      >
        {/* Thumb 内部十字标记 — 增加科技感 */}
        <span
          className="absolute inset-0 pointer-events-none flex items-center justify-center"
          style={{ opacity: checked ? 0.4 : 0.2 }}
        >
          <span
            className="absolute w-1.5 h-px"
            style={{ background: checked ? color("bgBase") : color("border") }}
          />
          <span
            className="absolute w-px h-1.5"
            style={{ background: checked ? color("bgBase") : color("border") }}
          />
        </span>
      </motion.span>
    </button>
  );
}

// ========== MiniToggle（紧凑尺寸） ==========

interface MiniToggleProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}

/**
 * 紧凑型 Glitch 滑块开关
 * 内置 stopPropagation，适用于可点击的列表项内部
 */
export function MiniToggle({
  checked,
  onCheckedChange,
  disabled = false,
}: MiniToggleProps) {
  const [isGlitching, setIsGlitching] = useState(false);
  const [glitchKey, setGlitchKey] = useState(0);
  const prevCheckedRef = useRef(checked);

  // 通过对比前一个 checked 值跳过初始 mount，兼容 React Strict Mode 的 remount 行为
  useLayoutEffect(() => {
    if (prevCheckedRef.current === checked) return;
    prevCheckedRef.current = checked;
    setIsGlitching(true);
    setGlitchKey((k) => k + 1);
  }, [checked]);

  useEffect(() => {
    if (isGlitching) {
      const timer = setTimeout(() => setIsGlitching(false), 350);
      return () => clearTimeout(timer);
    }
  }, [isGlitching]);

  const toX = checked ? 12 : 2;
  const fromX = checked ? 2 : 12;

  // Thumb 阴影（glitch 时色差分离）
  const thumbShadow = isGlitching
    ? `3px 0 6px rgba(255, 30, 70, 0.7), -3px 0 6px rgba(30, 130, 255, 0.7), 0 0 10px ${colorAlpha("primary", 0.9)}`
    : checked
      ? `0 0 6px ${colorAlpha("primary", 0.6)}`
      : `0 0 4px ${colorAlpha("border", 0.3)}`;

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onCheckedChange(!checked);
      }}
      className={cn(
        "relative inline-flex h-4 w-7 shrink-0 items-center overflow-hidden rounded-[3px]",
        "transition-all duration-200",
        disabled && "opacity-50 cursor-not-allowed",
        !disabled && "cursor-pointer",
      )}
      style={{
        background: checked
          ? `linear-gradient(135deg, ${color("primary")} 0%, ${color("secondary")} 100%)`
          : colorAlpha("bgCard", 0.6),
        border: `1px solid ${colorAlpha(
          checked ? "primary" : "border",
          checked ? 0.6 : 0.4,
        )}`,
        boxShadow: checked ? glow("primary", "sm", 0.3) : "none",
      }}
      title={checked ? "点击禁用" : "点击启用"}
    >
      {/* 斜线扫描线纹理 */}
      <span
        className="absolute inset-0 pointer-events-none rounded-xs"
        style={{
          backgroundImage: `repeating-linear-gradient(
            -45deg,
            transparent 0px,
            transparent 2px,
            ${colorAlpha("bgBase", 0.08)} 2px,
            ${colorAlpha("bgBase", 0.08)} 3px
          )`,
        }}
      />

      {/* Glitch 闪光 */}
      {isGlitching && (
        <motion.span
          key={`mini-flash-${glitchKey}`}
          initial={{ opacity: 0.5 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="absolute inset-0 pointer-events-none rounded-xs z-30"
          style={{
            background: `linear-gradient(90deg, transparent 15%, ${colorAlpha("primary", 0.35)} 50%, transparent 85%)`,
          }}
        />
      )}

      {/* 色差分离残影 — 红色通道 */}
      {isGlitching && (
        <motion.span
          key={`mini-r-${glitchKey}`}
          initial={{ x: fromX + 1, y: -1, opacity: 0.7 }}
          animate={{ x: toX + 3, y: 0, opacity: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="absolute h-2.5 w-2.5 rounded-[1px] pointer-events-none"
          style={{
            background: "rgba(255, 30, 60, 0.45)",
            filter: "blur(0.5px)",
          }}
        />
      )}

      {/* 色差分离残影 — 蓝色通道 */}
      {isGlitching && (
        <motion.span
          key={`mini-b-${glitchKey}`}
          initial={{ x: fromX - 1, y: 1, opacity: 0.7 }}
          animate={{ x: toX - 3, y: 0, opacity: 0 }}
          transition={{ duration: 0.2, ease: "easeOut", delay: 0.02 }}
          className="absolute h-2.5 w-2.5 rounded-[1px] pointer-events-none"
          style={{
            background: "rgba(30, 100, 255, 0.45)",
            filter: "blur(0.5px)",
          }}
        />
      )}

      {/* 主 Thumb 滑块 — 方形 */}
      <motion.span
        initial={false}
        animate={{ x: toX }}
        transition={{ type: "spring", stiffness: 380, damping: 24 }}
        className="relative inline-block h-2.5 w-2.5 rounded-[1px] z-10"
        style={{
          background: checked
            ? color("textPrimary")
            : colorAlpha("textMuted", 0.7),
          boxShadow: thumbShadow,
          transition: "box-shadow 0.12s ease-out",
        }}
      />
    </button>
  );
}

// ========== ToggleCard ==========

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
        className,
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
