/**
 * Slider 滑块组件
 * 赛博朋克风格 - 菱形指针 + 流光效果
 *
 * v2 升级：
 * - 圆形手柄 → 上下对称菱形指针
 * - 静态渐变 → 拖动时流光扫过动画
 * - 悬停时菱形浮动
 * - 支持刻度标记（marks）
 */

import { cn } from "@/lib/utils";
import { colorAlpha } from "@/styles/tokens";
import { motion } from "framer-motion";
import { useCallback, useId, useMemo, useRef, useState } from "react";

interface SliderProps {
  value: number;
  onValueChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  className?: string;
  showValue?: boolean;
  formatValue?: (value: number) => string;
  /** 刻度标记值数组（可选） */
  marks?: number[];
  /** 是否显示刻度标签（默认 true，仅当 marks 存在时生效） */
  showMarkLabels?: boolean;
  /** 拖动时显示的数值提示（可选） */
  dragTooltip?: (value: number) => string;
}

/**
 * 菱形 SVG 路径（8px × 16px）
 */
const DIAMOND_PATH = "M 4 0 L 8 8 L 4 16 L 0 8 Z";

/**
 * 菱形指针组件
 * 上下对称的两个菱形，轨道在中间穿过
 */
function DiamondPointer({
  isHovering,
  isDragging,
  uniqueId,
}: {
  isHovering: boolean;
  isDragging: boolean;
  uniqueId: string;
}) {
  const glowIntensity = isDragging ? 20 : isHovering ? 15 : 8;
  const glowColor = colorAlpha(
    "primary",
    isDragging ? 1 : isHovering ? 0.8 : 0.6
  );

  return (
    <div
      className={cn(
        "slider-diamond-pointer",
        "flex flex-col items-center pointer-events-none"
      )}
      data-floating={isHovering && !isDragging ? "true" : "false"}
      data-dragging={isDragging ? "true" : "false"}
    >
      {/* 上菱形 */}
      <svg
        width="8"
        height="16"
        viewBox="0 0 8 16"
        className="slider-diamond-top"
        style={{
          filter: `drop-shadow(0 0 ${glowIntensity}px ${glowColor})`,
        }}
      >
        <defs>
          <linearGradient
            id={`diamond-gradient-top-${uniqueId}`}
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
          >
            <stop offset="0%" stopColor={colorAlpha("primary", 1)} />
            <stop offset="50%" stopColor={colorAlpha("secondary", 1)} />
            <stop offset="100%" stopColor={colorAlpha("primary", 1)} />
          </linearGradient>
        </defs>
        <path
          d={DIAMOND_PATH}
          fill={`url(#diamond-gradient-top-${uniqueId})`}
          stroke={colorAlpha("primary", 0.9)}
          strokeWidth="0.5"
        />
      </svg>

      {/* 中间间隔（轨道穿过的位置） */}
      <div className="h-2" />

      {/* 下菱形 */}
      <svg
        width="8"
        height="16"
        viewBox="0 0 8 16"
        className="slider-diamond-bottom"
        style={{
          filter: `drop-shadow(0 0 ${glowIntensity}px ${glowColor})`,
        }}
      >
        <defs>
          <linearGradient
            id={`diamond-gradient-bottom-${uniqueId}`}
            x1="0%"
            y1="100%"
            x2="100%"
            y2="0%"
          >
            <stop offset="0%" stopColor={colorAlpha("primary", 1)} />
            <stop offset="50%" stopColor={colorAlpha("secondary", 1)} />
            <stop offset="100%" stopColor={colorAlpha("primary", 1)} />
          </linearGradient>
        </defs>
        <path
          d={DIAMOND_PATH}
          fill={`url(#diamond-gradient-bottom-${uniqueId})`}
          stroke={colorAlpha("primary", 0.9)}
          strokeWidth="0.5"
        />
      </svg>
    </div>
  );
}

export function Slider({
  value,
  onValueChange,
  min = 0,
  max = 1,
  step = 0.1,
  disabled = false,
  className,
  showValue = true,
  formatValue = (v) => v.toFixed(1),
  marks,
  showMarkLabels = true,
  dragTooltip,
}: SliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const uniqueId = useId();

  // 计算百分比
  const percentage = useMemo(() => {
    return ((value - min) / (max - min)) * 100;
  }, [value, min, max]);

  // 计算刻度位置
  const markPositions = useMemo(() => {
    if (!marks) return null;
    return marks.map((markValue) => ({
      value: markValue,
      position: ((markValue - min) / (max - min)) * 100,
      isActive: markValue <= value,
    }));
  }, [marks, min, max, value]);

  // 从位置计算值
  const calculateValue = useCallback(
    (clientX: number) => {
      if (!trackRef.current) return value;

      const rect = trackRef.current.getBoundingClientRect();
      const percent = Math.max(
        0,
        Math.min(1, (clientX - rect.left) / rect.width)
      );
      const rawValue = min + percent * (max - min);

      // 对齐到 step
      const steppedValue = Math.round(rawValue / step) * step;
      return Math.max(min, Math.min(max, steppedValue));
    },
    [min, max, step, value]
  );

  // 鼠标/触摸事件
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (disabled) return;

      e.preventDefault();
      setIsDragging(true);

      const newValue = calculateValue(e.clientX);
      onValueChange(newValue);

      // 捕获指针
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [disabled, calculateValue, onValueChange]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging || disabled) return;

      const newValue = calculateValue(e.clientX);
      onValueChange(newValue);
    },
    [isDragging, disabled, calculateValue, onValueChange]
  );

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // 键盘事件
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (disabled) return;

      let newValue = value;
      switch (e.key) {
        case "ArrowLeft":
        case "ArrowDown":
          newValue = Math.max(min, value - step);
          break;
        case "ArrowRight":
        case "ArrowUp":
          newValue = Math.min(max, value + step);
          break;
        case "Home":
          newValue = min;
          break;
        case "End":
          newValue = max;
          break;
        default:
          return;
      }
      e.preventDefault();
      onValueChange(newValue);
    },
    [disabled, value, min, max, step, onValueChange]
  );

  // 是否有刻度标记
  const hasMarks = marks && marks.length > 0;

  return (
    <div className={cn("relative", className)}>
      <div className="flex items-center gap-3">
        {/* 滑块轨道容器 - 添加 padding 防止菱形裁切 */}
        <div className="relative flex-1 py-5">
          {/* 滑块轨道 - 赛博朋克风格 */}
          <div
            ref={trackRef}
            role="slider"
            tabIndex={disabled ? -1 : 0}
            aria-valuemin={min}
            aria-valuemax={max}
            aria-valuenow={value}
            aria-disabled={disabled}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
            onKeyDown={handleKeyDown}
            className={cn(
              "relative h-2 rounded-full cursor-pointer",
              hasMarks ? "mx-3" : "mx-2",
              "focus:outline-none focus:ring-2",
              disabled && "opacity-50 cursor-not-allowed"
            )}
            style={{
              backgroundColor: colorAlpha("bgCard", 1),
              border: `2px solid ${colorAlpha("primary", 0.4)}`,
              // focus ring 通过 CSS 变量
            }}
          >
            {/* 已选择部分 - 拖动时显示流光效果 */}
            <motion.div
              className={cn(
                "absolute left-0 top-0 h-full rounded-full",
                isDragging && "slider-shimmer-track"
              )}
              data-state={isDragging ? "dragging" : "idle"}
              style={{
                width: `${percentage}%`,
                background: isDragging
                  ? undefined
                  : `linear-gradient(90deg, ${colorAlpha(
                      "primary",
                      0.9
                    )}, ${colorAlpha("secondary", 0.9)})`,
              }}
              initial={false}
              animate={{
                boxShadow: isDragging
                  ? `0 0 15px ${colorAlpha("primary", 0.7)}`
                  : `0 0 8px ${colorAlpha("primary", 0.4)}`,
              }}
              transition={{ duration: 0.15 }}
            />

            {/* 刻度标记 */}
            {markPositions?.map(({ value: markValue, position, isActive }) => (
              <div
                key={markValue}
                className="absolute top-1/2 -translate-y-1/2 w-0.5 h-3"
                style={{
                  left: `${position}%`,
                  transform: `translateX(-50%) translateY(-50%)`,
                  backgroundColor: isActive
                    ? colorAlpha("primary", 0.8)
                    : colorAlpha("primary", 0.3),
                }}
              />
            ))}

            {/* 菱形指针 - 居中定位 */}
            <div
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2"
              style={{
                left: `${percentage}%`,
              }}
            >
              <DiamondPointer
                isHovering={isHovering}
                isDragging={isDragging}
                uniqueId={uniqueId}
              />

              {/* 拖动时显示数值提示 */}
              {isDragging && dragTooltip && (
                <div
                  className="absolute -top-10 left-1/2 -translate-x-1/2 px-2 py-1 rounded text-xs font-medium whitespace-nowrap"
                  style={{
                    backgroundColor: colorAlpha("bgElevated", 0.95),
                    border: `1px solid ${colorAlpha("primary", 0.5)}`,
                    color: colorAlpha("primary", 1),
                    boxShadow: `0 0 10px ${colorAlpha("primary", 0.3)}`,
                  }}
                >
                  {dragTooltip(value)}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 数值显示（右侧） */}
        {showValue && !hasMarks && (
          <span
            className="text-sm min-w-12 text-right font-medium"
            style={{ color: colorAlpha("primary", 1) }}
          >
            {formatValue(value)}
          </span>
        )}
      </div>

      {/* 刻度标签（底部） */}
      {hasMarks && showMarkLabels && markPositions && (
        <div className="relative mx-3 mt-1">
          {markPositions.map(({ value: markValue, position }) => (
            <span
              key={markValue}
              className="absolute text-xs transform -translate-x-1/2"
              style={{
                left: `${position}%`,
                color:
                  markValue <= value
                    ? colorAlpha("primary", 1)
                    : colorAlpha("textMuted", 1),
              }}
            >
              {markValue}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
