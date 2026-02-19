/**
 * PlayerCountSelector 组件
 * 六边形数字按钮组，用于选择最大玩家人数
 *
 * 特点：
 * - 7个六边形按钮（2-8人）
 * - 悬停上浮效果
 * - 选中状态发光脉冲
 * - 切换弹跳动画
 * - 相邻按钮涟漪效果
 */

import { cn } from "@/lib/utils";
import { animation, colorAlpha, glow, gradients } from "@/styles/tokens";
import { motion, type Variants } from "framer-motion";
import { Users } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export interface PlayerCountSelectorProps {
  /** 当前选中值 (2-8) */
  value: number;
  /** 值变化回调 */
  onChange: (value: number) => void;
  /** 是否禁用 */
  disabled?: boolean;
  /** 自定义类名 */
  className?: string;
}

// 可选人数范围
const OPTIONS = [2, 3, 4, 5, 6, 7, 8] as const;

// 六边形尺寸（更高的六边形，接近正六边形比例）
const HEX_WIDTH = 40;
const HEX_HEIGHT = 46;

// 六边形 SVG 路径
const hexPath = `
  M ${HEX_WIDTH / 2} 0
  L ${HEX_WIDTH} ${HEX_HEIGHT * 0.25}
  L ${HEX_WIDTH} ${HEX_HEIGHT * 0.75}
  L ${HEX_WIDTH / 2} ${HEX_HEIGHT}
  L 0 ${HEX_HEIGHT * 0.75}
  L 0 ${HEX_HEIGHT * 0.25}
  Z
`.trim();

// 按钮动画变体
const buttonVariants: Variants = {
  default: {
    scale: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 400,
      damping: 25,
    },
  },
  hover: {
    scale: 1.05,
    y: -2,
    transition: {
      type: "spring",
      stiffness: 400,
      damping: 25,
    },
  },
  selected: {
    scale: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 400,
      damping: 25,
    },
  },
  tap: {
    scale: 0.95,
    transition: {
      duration: 0.1,
    },
  },
};

// 选中时的弹跳动画关键帧
const SELECT_SCALE_KEYFRAMES = [1, 1.15, 1] as const;
const SELECT_EASE: [number, number, number, number] = [0.34, 1.56, 0.64, 1]; // 弹性曲线

interface HexNumberButtonProps {
  num: number;
  isSelected: boolean;
  isHovered: boolean;
  isRippling: boolean;
  rippleDistance: number;
  disabled: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  index: number;
}

function HexNumberButton({
  num,
  isSelected,
  isHovered,
  isRippling,
  rippleDistance,
  disabled,
  onClick,
  onMouseEnter,
  onMouseLeave,
  index,
}: HexNumberButtonProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);

  // 计算样式
  const styles = useMemo(() => {
    return {
      fill: isSelected ? gradients.primary() : "transparent",
      stroke: isSelected
        ? colorAlpha("primary", 0.9)
        : isHovered
        ? colorAlpha("primary", 0.6)
        : colorAlpha("primary", 0.3),
      filter: isSelected
        ? `drop-shadow(${glow("primary", "md", 0.6)})`
        : isHovered
        ? `drop-shadow(${glow("primary", "sm", 0.3)})`
        : "none",
      textColor: isSelected
        ? colorAlpha("textPrimary", 1)
        : isHovered
        ? colorAlpha("primary", 0.9)
        : colorAlpha("textSecondary", 0.7),
    };
  }, [isSelected, isHovered]);

  // 涟漪效果动画
  const rippleVariant = useMemo(() => {
    if (!isRippling || rippleDistance === 0) return {};
    return {
      scale: [1, 1 + 0.03 / rippleDistance, 1],
      opacity: [1, 0.8, 1],
      transition: {
        delay: rippleDistance * 0.05,
        duration: 0.2,
      },
    };
  }, [isRippling, rippleDistance]);

  // 确定当前动画状态
  const animateState = isSelected
    ? "selected"
    : isHovered
    ? "hover"
    : "default";

  return (
    <motion.button
      ref={buttonRef}
      type="button"
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      disabled={disabled}
      className={cn(
        "relative focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
        "transition-colors",
        disabled && "cursor-not-allowed opacity-50"
      )}
      style={{
        width: HEX_WIDTH,
        height: HEX_HEIGHT,
      }}
      variants={buttonVariants}
      animate={animateState}
      initial={false}
      whileTap={!disabled ? "tap" : undefined}
      role="radio"
      aria-checked={isSelected}
      aria-label={`${num}人`}
    >
      {/* 涟漪效果层 */}
      {isRippling && (
        <motion.div
          className="absolute inset-0"
          animate={rippleVariant}
          initial={false}
        />
      )}

      {/* 六边形 SVG */}
      <svg
        width={HEX_WIDTH}
        height={HEX_HEIGHT}
        viewBox={`0 0 ${HEX_WIDTH} ${HEX_HEIGHT}`}
        className="absolute inset-0"
      >
        <defs>
          {/* 渐变填充定义 */}
          <linearGradient
            id={`hex-num-gradient-${index}`}
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

          {/* 内发光效果 */}
          <radialGradient
            id={`hex-inner-glow-${index}`}
            cx="50%"
            cy="50%"
            r="50%"
          >
            <stop
              offset="0%"
              style={{
                stopColor: "var(--color-primary)",
                stopOpacity: isSelected ? 0.3 : 0,
              }}
            />
            <stop
              offset="70%"
              style={{ stopColor: "var(--color-primary)", stopOpacity: 0 }}
            />
          </radialGradient>
        </defs>

        {/* 内发光层 */}
        {isSelected && (
          <path
            d={hexPath}
            fill={`url(#hex-inner-glow-${index})`}
            className="pointer-events-none"
          />
        )}

        {/* 主六边形 */}
        <motion.path
          d={hexPath}
          fill={isSelected ? `url(#hex-num-gradient-${index})` : "transparent"}
          stroke={styles.stroke}
          strokeWidth={2}
          style={{
            filter: styles.filter,
          }}
          initial={false}
          animate={
            isSelected
              ? {
                  fillOpacity: 1,
                  scale: SELECT_SCALE_KEYFRAMES as unknown as number[],
                }
              : { fillOpacity: 0 }
          }
          transition={{
            duration: animation.duration.normal,
            scale: {
              duration: 0.3,
              ease: SELECT_EASE,
            },
          }}
        />
      </svg>

      {/* 数字文本 - 使用 CSS 动画实现脉冲效果 */}
      <span
        className={cn(
          "absolute inset-0 flex items-center justify-center font-semibold text-base pointer-events-none",
          isSelected && "animate-pulse-glow"
        )}
        style={{
          fontFamily: "'Orbitron', 'Rajdhani', monospace",
          color: styles.textColor,
          textShadow: isSelected ? `0 0 8px currentColor` : "none",
        }}
      >
        {num}
      </span>
    </motion.button>
  );
}

export function PlayerCountSelector({
  value,
  onChange,
  disabled = false,
  className,
}: PlayerCountSelectorProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [prevValue, setPrevValue] = useState(value);
  const [rippleCenter, setRippleCenter] = useState<number | null>(null);

  // 处理值变化时的涟漪效果
  useEffect(() => {
    if (prevValue !== value) {
      // 触发涟漪效果
      const newIndex = OPTIONS.indexOf(value as (typeof OPTIONS)[number]);
      setRippleCenter(newIndex);
      setPrevValue(value);

      // 清除涟漪效果
      const timer = setTimeout(() => {
        setRippleCenter(null);
      }, 300);

      return () => clearTimeout(timer);
    }
  }, [value, prevValue]);

  const handleClick = useCallback(
    (num: number) => {
      if (!disabled && num !== value) {
        onChange(num);
      }
    },
    [disabled, value, onChange]
  );

  const handleMouseEnter = useCallback((index: number) => {
    setHoveredIndex(index);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setHoveredIndex(null);
  }, []);

  return (
    <div className={cn("flex flex-col items-center gap-4", className)}>
      {/* 标题行 */}
      <div className="flex items-center gap-2 text-sm font-medium">
        <Users size={16} style={{ color: colorAlpha("primary", 0.9) }} />
        <span>最大人数</span>
      </div>

      {/* 按钮行 */}
      <div
        className="flex gap-2 justify-center flex-wrap"
        role="radiogroup"
        aria-label="选择最大玩家人数"
      >
        {OPTIONS.map((num, index) => {
          const isSelected = value === num;
          const isHovered = hoveredIndex === index;
          const isRippling = rippleCenter !== null && rippleCenter !== index;
          const rippleDistance =
            rippleCenter !== null ? Math.abs(index - rippleCenter) : 0;

          return (
            <HexNumberButton
              key={num}
              num={num}
              isSelected={isSelected}
              isHovered={isHovered}
              isRippling={isRippling}
              rippleDistance={rippleDistance}
              disabled={disabled}
              onClick={() => handleClick(num)}
              onMouseEnter={() => handleMouseEnter(index)}
              onMouseLeave={handleMouseLeave}
              index={index}
            />
          );
        })}
      </div>
    </div>
  );
}
