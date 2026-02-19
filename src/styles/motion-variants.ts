/**
 * 统一动画 Variants 工厂
 *
 * 替代各步骤组件中重复定义的 variants（formItemVariants、sectionVariants、
 * rowVariants、cardItemVariants），以及 tokens.ts 中的 stepForwardVariants /
 * stepBackwardVariants / listItemVariants。
 *
 * 使用方式：结合 useMotionTokens() hook 获取主题配置后调用工厂函数。
 */

import type { Variants } from "framer-motion";
import type { ThemeMotionConfig } from "./themes/types";

/**
 * 创建步骤切换 variants（方向感知）
 *
 * @param config 动画配置（来自 useMotionTokens()）
 * @param direction 导航方向
 */
export function createStepVariants(
  config: ThemeMotionConfig,
  direction: "forward" | "backward"
): Variants {
  const sign = direction === "forward" ? 1 : -1;
  return {
    hidden: { opacity: 0, x: sign * config.stepOffset },
    visible: {
      opacity: 1,
      x: 0,
      transition: {
        duration: config.duration.normal,
        ease: [0.16, 1, 0.3, 1], // easeOutExpo
      },
    },
    exit: {
      opacity: 0,
      x: -sign * config.stepOffset,
      transition: {
        duration: config.duration.fast,
        ease: "easeIn",
      },
    },
  };
}

/**
 * 创建交错入场 variants（列表项/表单项）
 *
 * @param config 动画配置（来自 useMotionTokens()）
 * @param axis 入场方向 'y'（默认，从下方）或 'x'（从右侧）
 * @param initialDelay 首项延迟（秒），默认 0.1
 */
export function createStaggerVariants(
  config: ThemeMotionConfig,
  axis: "x" | "y" = "y",
  initialDelay: number = 0.1
): Variants {
  return {
    hidden: {
      opacity: 0,
      ...(axis === "y" ? { y: config.itemOffset } : { x: config.itemOffset }),
    },
    visible: (index: number = 0) => ({
      opacity: 1,
      ...(axis === "y" ? { y: 0 } : { x: 0 }),
      transition: {
        delay: initialDelay + index * config.staggerBase,
        duration: config.duration.fast,
        ease: [0.0, 0.0, 0.2, 1.0],
      },
    }),
    exit: {
      opacity: 0,
      ...(axis === "y"
        ? { y: -config.itemOffset / 2 }
        : { x: -config.itemOffset / 2 }),
      transition: {
        duration: config.duration.instant,
      },
    },
  };
}

/**
 * 创建容器 variants（用于编排子元素的 stagger）
 *
 * @param config 动画配置（来自 useMotionTokens()）
 * @param staggerChildren 自定义 stagger 间隔，默认使用 config.staggerBase
 */
export function createContainerVariants(
  config: ThemeMotionConfig,
  staggerChildren?: number
): Variants {
  return {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: staggerChildren ?? config.staggerBase,
        delayChildren: 0.1,
      },
    },
    exit: {
      opacity: 0,
      transition: { duration: config.duration.fast },
    },
  };
}
