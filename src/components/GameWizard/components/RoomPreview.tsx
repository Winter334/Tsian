/**
 * RoomPreview 组件
 * 房间配置预览卡片
 *
 * 特点：
 * - 显示房间名、人数、回合时长摘要
 * - 配置变化时有微动画效果（使用防抖优化）
 * - 赛博朋克风格边框
 */

import { Card } from "@/components/ui";
import { cn } from "@/lib/utils";
import { colorAlpha } from "@/styles/tokens";
import { animate, motion, useMotionValue, useTransform } from "framer-motion";
import { Clock, Home, Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export interface RoomPreviewProps {
  /** 房间名称 */
  roomName: string;
  /** 最大人数 */
  maxPlayers: number;
  /** 回合时长（分钟） */
  turnDuration: number;
  /** 自定义类名 */
  className?: string;
}

/**
 * 使用防抖的数值显示 Hook
 * 快速变化时只显示最终值，避免动画堆积
 */
function useDebouncedValue<T>(value: T, delay: number = 100): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // 清除之前的定时器
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // 设置新的定时器
    timeoutRef.current = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * 数值动画组件
 * 使用 Framer Motion 的数值动画，避免 DOM 重建
 */
function AnimatedNumber({ value }: { value: number }) {
  const motionValue = useMotionValue(value);
  const rounded = useTransform(motionValue, (v) => Math.round(v));
  const [displayValue, setDisplayValue] = useState(value);

  useEffect(() => {
    const controls = animate(motionValue, value, {
      duration: 0.2,
      ease: "easeOut",
    });

    // 订阅变化更新显示值
    const unsubscribe = rounded.on("change", (v) => {
      setDisplayValue(v);
    });

    return () => {
      controls.stop();
      unsubscribe();
    };
  }, [value, motionValue, rounded]);

  return <>{displayValue}</>;
}

export function RoomPreview({
  roomName,
  maxPlayers,
  turnDuration,
  className,
}: RoomPreviewProps) {
  // 对快速变化的数值使用防抖
  const debouncedPlayers = useDebouncedValue(maxPlayers, 50);
  const debouncedDuration = useDebouncedValue(turnDuration, 50);
  const debouncedName = useDebouncedValue(roomName, 100);

  return (
    <Card variant="outlined" hover={false} className={cn("p-4", className)}>
      <div className="flex items-center justify-between text-sm">
        {/* 房间名 */}
        <motion.div
          className="flex items-center gap-2"
          initial={false}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
        >
          <Home size={16} style={{ color: colorAlpha("primary", 0.9) }} />
          <span className="font-medium max-w-30 truncate" title={debouncedName}>
            {debouncedName || "未命名房间"}
          </span>
        </motion.div>

        {/* 配置摘要 */}
        <div className="flex items-center gap-4 text-muted-foreground">
          {/* 人数 */}
          <motion.span
            className="flex items-center gap-1"
            initial={false}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
          >
            <Users size={14} />
            <span>
              <AnimatedNumber value={debouncedPlayers} />人
            </span>
          </motion.span>

          {/* 回合时长 */}
          <motion.span
            className="flex items-center gap-1"
            initial={false}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
          >
            <Clock size={14} />
            <span>
              <AnimatedNumber value={debouncedDuration} />
              分钟/回合
            </span>
          </motion.span>
        </div>
      </div>
    </Card>
  );
}
