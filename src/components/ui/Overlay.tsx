/**
 * Overlay 容器组件
 * 仅负责遮罩层视觉与点击事件，不包含业务行为
 */

import { motion } from "framer-motion";
import { forwardRef, type CSSProperties } from "react";

import { useThemeComponent } from "@/hooks/use-theme-component";
import { cn } from "@/lib/utils";
import {
  colorAlpha,
  createMultiLayerGridBackground,
  overlayVariants,
} from "@/styles/tokens";

export interface OverlayProps {
  onClick?: () => void;
  className?: string;
  style?: CSSProperties;

  /** 主题配置覆盖（默认读取 theme.components.overlay） */
  backdropBlur?: string;
  backgroundOpacity?: number;

  /** 背景效果 */
  showGrid?: boolean;
}

export const Overlay = forwardRef<HTMLDivElement, OverlayProps>(
  function Overlay(
    {
      onClick,
      className,
      style,
      backdropBlur,
      backgroundOpacity,
      showGrid = true,
    },
    ref
  ) {
    const overlayTheme = useThemeComponent("overlay");
    const resolvedBlur = backdropBlur ?? overlayTheme.backdropBlur;
    const resolvedOpacity = backgroundOpacity ?? overlayTheme.backgroundOpacity;

    return (
      <motion.div
        ref={ref}
        variants={overlayVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        className={cn("fixed inset-0 z-50", className)}
        style={{
          backgroundColor: colorAlpha("bgBase", resolvedOpacity),
          backdropFilter: `blur(${resolvedBlur})`,
          WebkitBackdropFilter: `blur(${resolvedBlur})`,
          ...(showGrid
            ? createMultiLayerGridBackground(0.1, 60, 0.04, 20)
            : {}),
          ...style,
        }}
        onClick={onClick}
      />
    );
  }
);
