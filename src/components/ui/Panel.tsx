/**
 * Panel 容器组件
 * 纯视觉容器：负责背景、边框、发光与入场动画
 */

import { motion, type Variants } from "framer-motion";
import { forwardRef, type CSSProperties, type ReactNode } from "react";

import { StarfieldBackground } from "@/components/effects/StarfieldBackground";
import { PANEL_CONFIG } from "@/config/effects";
import { useThemeComponent, useThemeEffectSwitches } from "@/hooks";
import { cn } from "@/lib/utils";
import {
  color,
  colorAlpha,
  createGridBackground,
  glow,
  panelVariants,
  shadows,
} from "@/styles/tokens";

export type PanelVariant =
  | "default"
  | "elevated"
  | "outlined"
  | "glass"
  | "solid";
export type PanelBackground = "starfield" | "grid" | "none";

export interface PanelProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;

  /** 视觉变体 */
  variant?: PanelVariant;

  /** 背景效果 */
  background?: PanelBackground;

  /**
   * 忽略主题背景开关
   * 仅在 background="starfield" 时生效，true 时强制渲染星空层
   */
  ignoreThemeEffects?: boolean;

  /** 主题配置覆盖（默认读取 theme.components.panel） */
  borderRadius?: string;
  borderWidth?: string;
  backdropBlur?: string;
  backgroundOpacity?: number;

  /** 边框发光 */
  borderGlow?: boolean;

  /** 入场动画 */
  enterAnimation?: boolean;

  /** Escape Hatch：完全跳过容器样式 */
  unstyled?: boolean;
}

/** 无动画变体 */
const STATIC_VARIANTS: Variants = {
  hidden: { opacity: 1, scale: 1, y: 0 },
  visible: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 1, scale: 1, y: 0 },
};

export const Panel = forwardRef<HTMLDivElement, PanelProps>(function Panel(
  {
    children,
    className,
    style,
    variant = "default",
    background = "none",
    borderRadius,
    borderWidth,
    backdropBlur,
    backgroundOpacity,
    ignoreThemeEffects = false,
    borderGlow = true,
    enterAnimation = true,
    unstyled = false,
  },
  ref
) {
  const panelTheme = useThemeComponent("panel");
  const { isParticlesEnabled } = useThemeEffectSwitches();

  const resolvedBorderRadius = borderRadius ?? panelTheme.borderRadius;
  const resolvedBorderWidth = borderWidth ?? panelTheme.borderWidth;
  const resolvedBackdropBlur = backdropBlur ?? panelTheme.backdropBlur;
  const resolvedBackgroundOpacity =
    backgroundOpacity ?? panelTheme.backgroundOpacity;

  if (unstyled) {
    return <>{children}</>;
  }

  const gridBackground =
    background === "grid" ? createGridBackground(0.08, 40) : undefined;

  const borderColor =
    variant === "outlined"
      ? colorAlpha("border", 0.45)
      : variant === "elevated"
      ? colorAlpha("primary", 0.6)
      : colorAlpha("primary", 0.5);

  const backgroundValue =
    variant === "solid"
      ? color("bgElevated")
      : variant === "outlined"
      ? colorAlpha("bgElevated", Math.min(0.35, resolvedBackgroundOpacity))
      : colorAlpha("bgElevated", resolvedBackgroundOpacity);

  const shadowLayers: string[] = [];
  if (variant === "elevated") {
    shadowLayers.push(shadows.card());
  }
  if (borderGlow) {
    shadowLayers.push(
      `${glow(
        "primary",
        "lg",
        PANEL_CONFIG.borderGlow.intensity
      )}, inset 0 0 30px ${colorAlpha("primary", 0.05)}`
    );
  }

  const composedStyle: CSSProperties = {
    background: backgroundValue,
    borderStyle: "solid",
    borderWidth: resolvedBorderWidth,
    borderColor,
    borderRadius: resolvedBorderRadius,
    backdropFilter:
      variant === "solid" ? "none" : `blur(${resolvedBackdropBlur})`,
    WebkitBackdropFilter:
      variant === "solid" ? "none" : `blur(${resolvedBackdropBlur})`,
    ...(shadowLayers.length > 0 ? { boxShadow: shadowLayers.join(", ") } : {}),
    ...gridBackground,
    ...style,
  };

  const shouldRenderStarfield =
    background === "starfield" && (ignoreThemeEffects || isParticlesEnabled);

  return (
    <motion.div
      ref={ref}
      variants={enterAnimation ? panelVariants : STATIC_VARIANTS}
      initial="hidden"
      animate="visible"
      exit="exit"
      className={cn("relative w-full overflow-hidden", className)}
      style={composedStyle}
    >
      {shouldRenderStarfield && (
        <div
          className="absolute inset-0 overflow-hidden"
          style={{ zIndex: 0, borderRadius: resolvedBorderRadius }}
        >
          <StarfieldBackground transparentBackground useThemeColors />
        </div>
      )}

      <div className="relative z-10">{children}</div>
    </motion.div>
  );
});
