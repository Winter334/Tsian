/**
 * ChoiceCard - 选项卡片组件
 * 单个可点击的选项
 * 增强风格：毛玻璃效果、四角装饰、强发光
 */

import { cn } from "@/lib/utils";
import { color, colorAlpha, shadows } from "@/styles/tokens";
import { motion } from "framer-motion";

interface ChoiceCardProps {
  text: string;
  onClick: (text: string) => void;
  disabled?: boolean;
  className?: string;
}

export function ChoiceCard({
  text,
  onClick,
  disabled = false,
  className,
}: ChoiceCardProps) {
  return (
    <motion.button
      type="button"
      onClick={() => onClick(text)}
      disabled={disabled}
      className={cn(
        // 基础样式 - 增大尺寸
        "relative w-full text-left px-6 py-4 text-base font-medium rounded-lg",
        // 毛玻璃效果 + 四角装饰
        "corner-accent hover-glow",
        // 边框增强
        "border-2",
        // 过渡效果
        "transition-all duration-200",
        // 禁用状态
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
      style={{
        color: color("textPrimary"), // 提升文字亮度
        background: colorAlpha("bgCard", 0.5), // 提升背景亮度
        borderColor: colorAlpha("primary", 0.6), // 提升边框亮度
        backdropFilter: "blur(10px)",
        textShadow: `0 0 5px ${colorAlpha("primary", 0.3)}`, // 添加文字发光
      }}
      whileHover={
        disabled
          ? {}
          : {
              scale: 1.02,
              boxShadow: shadows.cardHover(),
              borderColor: colorAlpha("primary", 0.9),
              background: colorAlpha("bgCard", 0.7), // 悬停时进一步提亮
            }
      }
      whileTap={disabled ? {} : { scale: 0.98 }}
    >
      {/* 内部发光效果 - 增强 */}
      <div
        className="absolute inset-0 rounded-lg opacity-0 hover:opacity-100 transition-opacity duration-200 pointer-events-none"
        style={{
          background: `radial-gradient(circle at center, ${colorAlpha(
            "primary",
            0.2
          )} 0%, transparent 70%)`,
        }}
      />

      {/* 文本内容 */}
      <span className="relative z-10">{text}</span>
    </motion.button>
  );
}
