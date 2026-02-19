/**
 * CountdownTimer - 回合倒计时显示组件
 *
 * 显示剩余时间，带有动画效果：
 * - 正常状态：显示剩余时间
 * - 紧急状态（<30秒）：红色闪烁
 * - 超时状态：显示"时间已到"
 *
 * 遵循架构规范：只读显示，不修改状态
 */

import { cn } from "@/lib/utils";
import { animation, borders, color, colorAlpha } from "@/styles/tokens";
import { AlertTriangle, Clock } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

// ===== 类型定义 =====

interface CountdownTimerProps {
  /** 截止时间（毫秒时间戳） */
  deadline: number;
  /** 超时回调 */
  onTimeout?: () => void;
  /** 自定义样式类 */
  className?: string;
  /** 紧急阈值（秒），默认 30 秒 */
  urgentThreshold?: number;
  /** 是否显示图标 */
  showIcon?: boolean;
  /** 尺寸 */
  size?: "sm" | "md" | "lg";
}

// ===== 工具函数 =====

/**
 * 格式化时间显示
 */
function formatTime(seconds: number): string {
  if (seconds <= 0) return "0:00";

  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

// ===== 组件实现 =====

export function CountdownTimer({
  deadline,
  onTimeout,
  className,
  urgentThreshold = 30,
  showIcon = true,
  size = "md",
}: CountdownTimerProps) {
  const [remainingSeconds, setRemainingSeconds] = useState(() => {
    const now = Date.now();
    return Math.max(0, Math.ceil((deadline - now) / 1000));
  });

  // 倒计时逻辑
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const remaining = Math.max(0, Math.ceil((deadline - now) / 1000));
      setRemainingSeconds(remaining);

      if (remaining <= 0) {
        clearInterval(interval);
        onTimeout?.();
      }
    }, 1000);

    // 立即更新一次
    const now = Date.now();
    setRemainingSeconds(Math.max(0, Math.ceil((deadline - now) / 1000)));

    return () => clearInterval(interval);
  }, [deadline, onTimeout]);

  // 判断是否紧急
  const isUrgent = useMemo(() => {
    return remainingSeconds <= urgentThreshold && remainingSeconds > 0;
  }, [remainingSeconds, urgentThreshold]);

  // 判断是否已超时
  const isExpired = useMemo(() => {
    return remainingSeconds <= 0;
  }, [remainingSeconds]);

  // 样式计算
  const containerStyles = useMemo(() => {
    if (isExpired) {
      return {
        background: colorAlpha("error", 0.2),
        borderColor: colorAlpha("error", 0.5),
        color: color("error"),
      };
    }

    if (isUrgent) {
      return {
        background: colorAlpha("warning", 0.2),
        borderColor: colorAlpha("warning", 0.5),
        color: color("warning"),
      };
    }

    return {
      background: colorAlpha("bgCard", 0.5),
      borderColor: colorAlpha("border", 0.3),
      color: color("textPrimary"),
    };
  }, [isExpired, isUrgent]);

  // 尺寸样式
  const sizeStyles = useMemo(() => {
    switch (size) {
      case "sm":
        return {
          padding: "0.25rem 0.5rem",
          fontSize: "0.75rem",
          iconSize: "w-3 h-3",
        };
      case "lg":
        return {
          padding: "0.75rem 1.25rem",
          fontSize: "1.25rem",
          iconSize: "w-6 h-6",
        };
      default:
        return {
          padding: "0.5rem 1rem",
          fontSize: "1rem",
          iconSize: "w-4 h-4",
        };
    }
  }, [size]);

  // 显示文本
  const displayText = useMemo(() => {
    if (isExpired) {
      return "时间已到";
    }

    return formatTime(remainingSeconds);
  }, [isExpired, remainingSeconds]);

  // 图标选择
  const Icon = useMemo(() => {
    if (isUrgent || isExpired) return AlertTriangle;
    return Clock;
  }, [isUrgent, isExpired]);

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 font-mono border rounded-lg",
        `transition-all duration-[${animation.duration.normal * 1000}ms]`,
        isUrgent && "animate-pulse",
        className
      )}
      style={{
        ...containerStyles,
        padding: sizeStyles.padding,
        fontSize: sizeStyles.fontSize,
        borderRadius: borders.radius.lg,
      }}
    >
      {showIcon && <Icon className={sizeStyles.iconSize} />}
      <span className="font-semibold tabular-nums">{displayText}</span>
    </div>
  );
}

// ===== 进度条版本 =====

interface CountdownProgressProps extends CountdownTimerProps {
  /** 总时长（毫秒） */
  totalDuration: number;
}

export function CountdownProgress({
  deadline,
  totalDuration,
  onTimeout,
  className,
  urgentThreshold = 30,
}: CountdownProgressProps) {
  const [progress, setProgress] = useState(100);
  const [remainingSeconds, setRemainingSeconds] = useState(() => {
    const now = Date.now();
    return Math.max(0, Math.ceil((deadline - now) / 1000));
  });

  // 倒计时逻辑
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const remaining = deadline - now;
      const remainingSec = Math.max(0, Math.ceil(remaining / 1000));
      const progressPercent = Math.max(0, (remaining / totalDuration) * 100);

      setRemainingSeconds(remainingSec);
      setProgress(progressPercent);

      if (remaining <= 0) {
        clearInterval(interval);
        onTimeout?.();
      }
    }, 100); // 更新更频繁以获得平滑进度条

    return () => clearInterval(interval);
  }, [deadline, totalDuration, onTimeout]);

  const isUrgent = remainingSeconds <= urgentThreshold && remainingSeconds > 0;
  const isExpired = remainingSeconds <= 0;

  // 进度条颜色
  const progressColor = useMemo(() => {
    if (isExpired) return color("error");
    if (isUrgent) return color("warning");
    return color("primary");
  }, [isExpired, isUrgent]);

  return (
    <div className={cn("w-full", className)}>
      {/* 时间文本 */}
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm" style={{ color: color("textSecondary") }}>
          剩余时间
        </span>
        <span
          className={cn(
            "font-mono font-semibold tabular-nums",
            isUrgent && "animate-pulse"
          )}
          style={{
            color: isExpired
              ? color("error")
              : isUrgent
              ? color("warning")
              : color("textPrimary"),
          }}
        >
          {isExpired ? "时间已到" : formatTime(remainingSeconds)}
        </span>
      </div>

      {/* 进度条 */}
      <div
        className="w-full h-2 rounded-full overflow-hidden"
        style={{
          background: colorAlpha("bgCard", 0.5),
          border: `1px solid ${colorAlpha("border", 0.2)}`,
        }}
      >
        <div
          className={cn(
            "h-full rounded-full transition-all",
            isUrgent && "animate-pulse"
          )}
          style={{
            width: `${progress}%`,
            background: progressColor,
            transition: "width 0.1s linear",
          }}
        />
      </div>
    </div>
  );
}
