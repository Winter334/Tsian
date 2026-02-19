import { TITLE_CONFIG } from "@/config/splash";

/**
 * 点阵纹理组件
 * 使用 CSS radial-gradient 创建复古 CRT 显示器风格的点阵效果
 * Phase 2: 标题屏幕背景重新设计
 */
export function NoiseTexture() {
  const config = TITLE_CONFIG.noiseTexture;

  // 如果配置中禁用了点阵效果，则不渲染
  if (!config?.enabled) {
    return null;
  }

  const { size, dotRadius, opacity, color } = config;

  // 使用 radial-gradient 创建密集点阵图案
  // 每个点是一个小圆点，通过 background-size 控制密度
  const dotPattern = `radial-gradient(circle at center, ${color} ${dotRadius}px, transparent ${dotRadius}px)`;

  return (
    <div
      className="fixed inset-0 pointer-events-none"
      style={{
        zIndex: 1, // 在 MatrixRain (z-0) 之上，在其他元素之下
        background: dotPattern,
        backgroundSize: `${size}px ${size}px`,
        opacity: opacity,
      }}
      aria-hidden="true"
    />
  );
}
