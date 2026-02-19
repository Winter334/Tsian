import {
  animation,
  borders,
  color,
  colorAlpha,
  gradients,
  shadows,
} from "@/styles/tokens";
import { motion } from "framer-motion";
import { useMemo, type ReactNode } from "react";

interface MenuButtonProps {
  children: ReactNode;
  onClick?: () => void;
  icon?: ReactNode;
  disabled?: boolean;
  delay?: number;
  variant?: "primary" | "secondary";
}

/**
 * 菜单按钮组件
 * 支持主题切换：渐变填充 + 悬停发光
 */
export function MenuButton({
  children,
  onClick,
  icon,
  disabled = false,
  delay = 0,
  variant = "primary",
}: MenuButtonProps) {
  const isPrimary = variant === "primary";

  // 使用 Token 系统计算样式
  const styles = useMemo(() => {
    return {
      background: isPrimary ? gradients.primary() : gradients.subtle(),
      boxShadow: isPrimary
        ? shadows.button()
        : `0 0 10px ${colorAlpha("primary", 0.2)}`,
      borderColor: isPrimary
        ? color("primaryLight")
        : colorAlpha("primary", 0.4),
      textColor: isPrimary ? "black" : color("textMuted"),
    };
  }, [isPrimary]);

  // 悬停样式
  const hoverStyles = useMemo(() => {
    return {
      boxShadow: isPrimary
        ? shadows.buttonHover()
        : `0 0 35px ${colorAlpha("primary", 0.6)}, 0 0 60px ${colorAlpha(
            "secondary",
            0.4,
          )}`,
      borderColor: color("primaryLight"),
      background: isPrimary
        ? gradients.primaryHover()
        : gradients.subtleHover(),
    };
  }, [isPrimary]);

  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      className={`
        relative group w-full max-w-64 md:w-64 px-6 py-3.5
        font-medium text-base tracking-wide
        border-2 overflow-hidden
        ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}
      `}
      style={{
        background: styles.background,
        boxShadow: styles.boxShadow,
        borderColor: styles.borderColor,
        color: styles.textColor,
        borderRadius: borders.radius.md,
      }}
      initial={{
        opacity: 0,
        scaleX: 0,
        filter: "blur(10px)",
      }}
      animate={{
        opacity: 1,
        scaleX: 1,
        filter: "blur(0px)",
      }}
      transition={{
        // 初始动画使用延迟
        opacity: { delay, duration: animation.duration.slower },
        scaleX: { duration: animation.duration.slow, delay },
        filter: { duration: 0.4, delay: delay + 0.1 },
        // 悬浮相关属性使用即时过渡
        scale: { duration: animation.duration.instant },
        boxShadow: { duration: animation.duration.instant },
        borderColor: { duration: animation.duration.instant },
        background: { duration: animation.duration.instant },
      }}
      whileHover={
        disabled
          ? {}
          : {
              scale: animation.hover.scale,
              boxShadow: hoverStyles.boxShadow,
              borderColor: hoverStyles.borderColor,
              background: hoverStyles.background,
            }
      }
      whileTap={disabled ? {} : { scale: animation.tap.scale }}
    >
      {/* 悬浮光晕层 */}
      <motion.div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 pointer-events-none"
        style={{
          background: `radial-gradient(circle at center, ${colorAlpha(
            "primaryLight",
            0.3,
          )} 0%, transparent 70%)`,
        }}
        initial={false}
        transition={{ duration: animation.duration.fast }}
      />

      {/* 内容 */}
      <span className="relative flex items-center justify-center gap-3 z-10">
        {icon && <span>{icon}</span>}
        <span>{children}</span>
        {isPrimary && (
          <motion.span
            className="ml-1"
            animate={{ x: [0, 3, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            →
          </motion.span>
        )}
      </span>
    </motion.button>
  );
}
