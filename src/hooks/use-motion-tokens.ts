/**
 * 主题动画参数 Hook
 * 替代 tokens.ts 中的静态 animation 常量，实现主题响应
 */

import { useMemo } from "react";
import { useTheme } from "./use-theme";

/**
 * 获取当前主题的动画参数（响应主题切换）
 * 替代 tokens.ts 中的静态 animation 常量
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const motion = useMotionTokens();
 *   return (
 *     <motion.div
 *       animate={{ opacity: 1 }}
 *       transition={{ duration: motion.duration.fast }}
 *     />
 *   );
 * }
 * ```
 */
export function useMotionTokens() {
  const { theme } = useTheme();
  const m = theme.effects.animation.motion;
  const hover = theme.effects.animation.hover;

  return useMemo(
    () => ({
      duration: m.duration,
      staggerBase: m.staggerBase,
      stepOffset: m.stepOffset,
      itemOffset: m.itemOffset,
      spring: m.spring,
      /** 便捷 easing 预设 */
      easing: {
        default: "easeOut" as const,
        smooth: [0.25, 0.46, 0.45, 0.94] as const,
        bounce: [0.68, -0.55, 0.265, 1.55] as const,
        dramatic: [0.16, 1, 0.3, 1] as const,
      },
      /** 便捷 hover 配置 */
      hover: {
        scale: hover.scale,
        glow: hover.glow,
        glitch: hover.glitch,
      },
    }),
    [m, hover]
  );
}
