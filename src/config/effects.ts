/**
 * 视觉效果配置
 * 星空背景、Panel 等效果的参数配置
 */

/**
 * 星空背景配置
 */
export const STARFIELD_CONFIG = {
  /** 响应式星星数量 */
  starCount: {
    mobile: 50,
    tablet: 80,
    desktop: 120,
  },

  /** 星星大小范围 [最小, 最大] */
  starSizeRange: [0.5, 2] as [number, number],

  /** 闪烁配置 */
  twinkle: {
    enabled: true,
    /** 最小透明度 */
    minOpacity: 0.3,
    /** 最大透明度 */
    maxOpacity: 1,
    /** 闪烁周期范围 [最小, 最大] (毫秒) */
    durationRange: [2000, 5000] as [number, number],
  },

  /** 流星配置 */
  shootingStar: {
    /** 自动启用流星的最小长边（适合长条容器） */
    minLongestEdge: 560,
    /** 自动启用流星的最小短边（避免过小容器出现噪点） */
    minShortestEdge: 180,
    /** 自动启用流星的最小面积（适合弹窗/面板等非长条容器） */
    minArea: 90000,
    /** 流星出现间隔范围 [最小, 最大] (毫秒) */
    intervalRange: [8000, 15000] as [number, number],
    /** 流星速度 */
    speed: 15,
    /** 尾迹长度 */
    tailLength: 50,
  },

  /** 颜色配置 */
  colors: {
    primary: "#00e5cc",
    secondary: "#5effe8",
    white: "#ffffff",
    /** 背景色（深色） */
    background: "#110E19",
  },

  /** 性能配置 */
  performance: {
    /** 目标帧率 */
    targetFPS: 30,
  },
} as const;

/**
 * Panel 配置
 */
export const PANEL_CONFIG = {
  /** 边框发光 */
  borderGlow: {
    /** 发光颜色 */
    color: "primary" as const,
    /** 发光强度 (0-1) */
    intensity: 0.6,
    /** 是否启用脉冲动画 */
    pulseEnabled: true,
    /** 脉冲周期 (毫秒) */
    pulseDuration: 3000,
  },

  /** 边角装饰 */
  cornerAccent: {
    /** 边角线条长度 */
    size: 16,
    /** 边角线条粗细 */
    thickness: 2,
  },

  /** 扫描线效果 */
  scanLine: {
    /** 扫描速度 (毫秒) */
    speed: 8000,
    /** 扫描线透明度 */
    opacity: 0.15,
  },
} as const;

/**
 * 响应式断点
 */
export const BREAKPOINTS = {
  mobile: 768,
  tablet: 1024,
} as const;

/**
 * 根据屏幕宽度获取星星数量
 */
export function getStarCount(width: number): number {
  if (width < BREAKPOINTS.mobile) {
    return STARFIELD_CONFIG.starCount.mobile;
  }
  if (width < BREAKPOINTS.tablet) {
    return STARFIELD_CONFIG.starCount.tablet;
  }
  return STARFIELD_CONFIG.starCount.desktop;
}

/**
 * 检查是否应该启用流星效果
 */
export function shouldEnableShootingStar(
  width: number,
  height: number
): boolean {
  const safeWidth = Math.max(width, 0);
  const safeHeight = Math.max(height, 0);

  if (safeWidth === 0 || safeHeight === 0) {
    return false;
  }

  const longestEdge = Math.max(safeWidth, safeHeight);
  const shortestEdge = Math.min(safeWidth, safeHeight);
  const area = safeWidth * safeHeight;

  return (
    longestEdge >= STARFIELD_CONFIG.shootingStar.minLongestEdge ||
    (shortestEdge >= STARFIELD_CONFIG.shootingStar.minShortestEdge &&
      area >= STARFIELD_CONFIG.shootingStar.minArea)
  );
}
