/**
 * HexButton 组件
 * 赛博朋克风格的六边形按钮
 *
 * 特点：
 * - SVG 六边形形状
 * - 多种状态样式（点亮/未点亮/悬停预览/锁定）
 * - Framer Motion 动画支持
 */

import { cn } from "@/lib/utils";
import { animation, colorAlpha, glow, gradients } from "@/styles/tokens";
import { motion, type Variants } from "framer-motion";
import { forwardRef, useMemo } from "react";

export type HexButtonState = "active" | "inactive" | "preview" | "locked";

export interface HexButtonProps {
  /** 按钮状态 */
  state: HexButtonState;
  /** 点击回调 */
  onClick?: () => void;
  /** 鼠标进入回调 */
  onMouseEnter?: () => void;
  /** 鼠标离开回调 */
  onMouseLeave?: () => void;
  /** 是否禁用 */
  disabled?: boolean;
  /** 自定义类名 */
  className?: string;
  /** 动画延迟索引（用于连锁动画） */
  animationIndex?: number;
}

// 六边形尺寸常量
const HEX_WIDTH = 37;
const HEX_HEIGHT = 32;

// 六边形 SVG 路径（使用相对坐标）
// 从顶部中点开始，顺时针绘制
const hexPath = `
  M ${HEX_WIDTH / 2} 0
  L ${HEX_WIDTH} ${HEX_HEIGHT * 0.25}
  L ${HEX_WIDTH} ${HEX_HEIGHT * 0.75}
  L ${HEX_WIDTH / 2} ${HEX_HEIGHT}
  L 0 ${HEX_HEIGHT * 0.75}
  L 0 ${HEX_HEIGHT * 0.25}
  Z
`.trim();

/** 动画变体 */
const hexVariants: Variants = {
  // 点亮动画
  active: {
    scale: 1,
    transition: {
      duration: animation.duration.normal,
      ease: "easeOut",
    },
  },
  // 激活时的弹跳动画
  activate: {
    scale: [1, 1.08, 1],
    transition: {
      duration: 0.25,
      ease: "easeOut",
    },
  },
  // 未点亮状态
  inactive: {
    scale: 1,
    transition: {
      duration: animation.duration.normal,
    },
  },
  // 悬停预览
  preview: {
    scale: 1.02,
    transition: {
      duration: animation.duration.fast,
    },
  },
};

export const HexButton = forwardRef<HTMLButtonElement, HexButtonProps>(
  function HexButton(
    {
      state,
      onClick,
      onMouseEnter,
      onMouseLeave,
      disabled = false,
      className,
      animationIndex = 0,
    },
    ref
  ) {
    // 根据状态计算样式
    const styles = useMemo(() => {
      const isActive = state === "active" || state === "locked";
      const isPreview = state === "preview";

      return {
        fill: isActive ? gradients.primary() : "transparent",
        stroke: isActive
          ? colorAlpha("primary", 0.8)
          : isPreview
          ? colorAlpha("primary", 0.6)
          : colorAlpha("primary", 0.3),
        filter: isActive
          ? `drop-shadow(${glow("primary", "md", 0.6)})`
          : isPreview
          ? `drop-shadow(${glow("primary", "sm", 0.3)})`
          : "none",
      };
    }, [state]);

    // 确定使用哪个动画变体
    const animateVariant = state === "preview" ? "preview" : state;

    return (
      <motion.button
        ref={ref}
        type="button"
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        disabled={disabled || state === "locked"}
        className={cn(
          "relative focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
          "transition-colors",
          disabled && "cursor-not-allowed opacity-50",
          state === "locked" && "cursor-default",
          className
        )}
        style={{
          width: HEX_WIDTH,
          height: HEX_HEIGHT,
        }}
        variants={hexVariants}
        animate={animateVariant}
        initial={false}
        whileTap={!disabled && state !== "locked" ? { scale: 0.95 } : undefined}
        transition={{
          delay: animationIndex * 0.03,
        }}
      >
        <svg
          width={HEX_WIDTH}
          height={HEX_HEIGHT}
          viewBox={`0 0 ${HEX_WIDTH} ${HEX_HEIGHT}`}
          className="absolute inset-0"
        >
          <defs>
            {/* 渐变填充定义 */}
            <linearGradient
              id={`hex-gradient-${animationIndex}`}
              x1="0%"
              y1="0%"
              x2="100%"
              y2="100%"
            >
              <stop
                offset="0%"
                style={{ stopColor: "var(--color-primary)", stopOpacity: 1 }}
              />
              <stop
                offset="50%"
                style={{ stopColor: "var(--color-secondary)", stopOpacity: 1 }}
              />
              <stop
                offset="100%"
                style={{ stopColor: "var(--color-primary)", stopOpacity: 1 }}
              />
            </linearGradient>
          </defs>
          <motion.path
            d={hexPath}
            fill={
              state === "active" || state === "locked"
                ? `url(#hex-gradient-${animationIndex})`
                : "transparent"
            }
            stroke={styles.stroke}
            strokeWidth={2}
            style={{
              filter: styles.filter,
            }}
            initial={false}
            animate={{
              fillOpacity: state === "active" || state === "locked" ? 1 : 0,
            }}
            transition={{
              duration: animation.duration.normal,
            }}
          />
        </svg>
      </motion.button>
    );
  }
);

// 导出常量供其他组件使用
export const HEX_BUTTON_WIDTH = HEX_WIDTH;
export const HEX_BUTTON_HEIGHT = HEX_HEIGHT;
