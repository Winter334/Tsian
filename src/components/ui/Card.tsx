/**
 * Card 容器组件
 * 可交互的卡片容器：支持主题化形态、可覆盖 hover 动画
 */

import { motion, type TargetAndTransition } from "framer-motion";
import {
  forwardRef,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";

import { useThemeComponent } from "@/hooks/use-theme-component";
import { cn } from "@/lib/utils";
import { animation, colorAlpha, shadows } from "@/styles/tokens";

export type CardVariant = "default" | "elevated" | "outlined";

export interface CardProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;

  /** 视觉变体 */
  variant?: CardVariant;

  /** 交互 */
  onClick?: () => void;
  hover?: boolean;

  /** 主题配置覆盖（默认读取 theme.components.card） */
  borderRadius?: string;
  hoverScale?: number;
  hoverLift?: number;

  /** 兼容扩展：是否启用悬停高亮视觉（默认 true） */
  glowOnHover?: boolean;

  /** 自定义动画（会覆盖默认值） */
  whileHover?: TargetAndTransition;
  whileTap?: TargetAndTransition;
}

const VARIANT_STYLES = {
  default: {
    base: {
      background: `linear-gradient(135deg, ${colorAlpha(
        "primary",
        0.05
      )} 0%, ${colorAlpha("secondary", 0.08)} 50%, ${colorAlpha(
        "primary",
        0.05
      )} 100%)`,
      border: `2px solid ${colorAlpha("primary", 0.3)}`,
    },
    hover: {
      background: `linear-gradient(135deg, ${colorAlpha(
        "primary",
        0.08
      )} 0%, ${colorAlpha("secondary", 0.12)} 50%, ${colorAlpha(
        "primary",
        0.08
      )} 100%)`,
      boxShadow: shadows.cardHover(),
    },
  },
  elevated: {
    base: {
      background: `linear-gradient(135deg, ${colorAlpha(
        "primary",
        0.03
      )} 0%, ${colorAlpha("secondary", 0.06)} 50%, ${colorAlpha(
        "primary",
        0.03
      )} 100%)`,
      border: `2px solid ${colorAlpha("primary", 0.4)}`,
      boxShadow: shadows.card(),
    },
    hover: {
      background: `linear-gradient(135deg, ${colorAlpha(
        "primary",
        0.06
      )} 0%, ${colorAlpha("secondary", 0.1)} 50%, ${colorAlpha(
        "primary",
        0.06
      )} 100%)`,
      boxShadow: shadows.cardHover(),
    },
  },
  outlined: {
    base: {
      background: "transparent",
      border: `2px solid ${colorAlpha("border", 0.4)}`,
    },
    hover: {
      background: `linear-gradient(135deg, ${colorAlpha(
        "primary",
        0.03
      )} 0%, ${colorAlpha("secondary", 0.05)} 100%)`,
      boxShadow: shadows.card(),
    },
  },
} as const;

const GLASS_EFFECT: CSSProperties = {
  backdropFilter: "blur(10px)",
  WebkitBackdropFilter: "blur(10px)",
};

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  {
    children,
    className,
    style,
    variant = "default",
    onClick,
    hover = true,
    borderRadius,
    hoverScale,
    hoverLift,
    glowOnHover = true,
    whileHover,
    whileTap,
  },
  ref
) {
  const cardTheme = useThemeComponent("card");
  const variantConfig = VARIANT_STYLES[variant];

  const resolvedBorderRadius = borderRadius ?? cardTheme.borderRadius;
  const resolvedHoverScale = hoverScale ?? cardTheme.hoverScale;
  const resolvedHoverLift = hoverLift ?? cardTheme.hoverLift;

  const baseStyles: CSSProperties = {
    ...GLASS_EFFECT,
    ...variantConfig.base,
    borderRadius: resolvedBorderRadius,
    ...style,
  };

  const defaultHoverAnimation: TargetAndTransition = {
    scale: resolvedHoverScale,
    y: resolvedHoverLift,
    borderColor: colorAlpha("primary", 0.6),
    ...(glowOnHover ? variantConfig.hover : {}),
  };

  const hoverAnimation: TargetAndTransition | undefined = hover
    ? {
        ...defaultHoverAnimation,
        ...whileHover,
      }
    : undefined;

  const tapAnimation: TargetAndTransition | undefined =
    whileTap ?? (onClick ? { scale: animation.tap.scale } : undefined);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!onClick) {
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onClick();
    }
  };

  return (
    <motion.div
      ref={ref}
      style={baseStyles}
      className={cn("p-6", onClick && "cursor-pointer", className)}
      whileHover={hoverAnimation}
      whileTap={tapAnimation}
      transition={{
        duration: cardTheme.hoverDuration,
        ease: [...animation.easing.smooth],
      }}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={handleKeyDown}
    >
      {children}
    </motion.div>
  );
});
