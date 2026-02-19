/**
 * 主题系统类型定义
 */

// ========== 颜色类型 ==========

export interface ThemeColors {
  // 主色
  primary: string;
  primaryLight: string;
  primaryDark: string;

  // 辅色
  secondary: string;
  secondaryLight: string;
  secondaryDark: string;

  // 背景
  bgBase: string;
  bgElevated: string;
  bgCard: string;
  bgOverlay: string;

  // 文字
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textDisabled: string;

  // 边框
  border: string;
  borderHover: string;
  borderFocus: string;
  borderMuted: string;

  // 语义色
  success: string;
  warning: string;
  error: string;
}

// ========== 动效配置类型 ==========

export interface ThemeAnimation {
  /** CSS transition 字符串（保留兼容） */
  transition: {
    fast: string;
    normal: string;
    slow: string;
  };
  /** 悬停效果 */
  hover: {
    scale: number;
    glow: boolean;
    glitch: boolean;
  };
  /** Framer Motion 消费的数值参数（主题响应） */
  motion: {
    /** 时长（秒） */
    duration: {
      instant: number; // 微交互 (tap feedback)
      fast: number; // 快速过渡 (tooltip, fade)
      normal: number; // 标准过渡 (step switch)
      slow: number; // 慢速过渡 (page enter)
      slower: number; // 戏剧性过渡 (splash)
    };
    /** 交错延迟基数（秒） */
    staggerBase: number;
    /** 步骤切换位移距离（px） */
    stepOffset: number;
    /** 列表项入场位移（px） */
    itemOffset: number;
    /** 弹性配置 */
    spring: {
      stiffness: number;
      damping: number;
    };
  };
}

/** ThemeAnimation.motion 的类型别名，方便独立引用 */
export type ThemeMotionConfig = ThemeAnimation["motion"];

export interface ThemeBackgroundEffects {
  matrixRain: boolean;
  particles: boolean;
  scanlines: boolean;
  noise: boolean;
  gradientFlow: boolean;
}

export interface ThemeEffects {
  animation: ThemeAnimation;
  backgroundEffects: ThemeBackgroundEffects;
}

// ========== 组件形态配置类型 ==========

export interface ThemeComponentConfig {
  panel: {
    borderRadius: string;
    borderWidth: string;
    backdropBlur: string;
    backgroundOpacity: number;
  };
  card: {
    borderRadius: string;
    hoverScale: number;
    hoverLift: number;
    hoverDuration: number;
  };
  button: {
    borderRadius: string;
    fontWeight: number;
  };
  overlay: {
    backdropBlur: string;
    backgroundOpacity: number;
  };
}

export type ThemeComponentConfigInput = {
  [K in keyof ThemeComponentConfig]?: Partial<ThemeComponentConfig[K]>;
};

// ========== 主题定义 ==========

export interface Theme {
  id: string;
  name: string;
  colors: ThemeColors;
  effects: ThemeEffects;
  components: ThemeComponentConfig;
}

// ========== CSS 变量名映射 ==========

/**
 * 将 camelCase 颜色键名转换为 kebab-case CSS 变量名
 */
export function colorKeyToCSSVar(key: keyof ThemeColors): string {
  return `--color-${key.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase()}`;
}

/**
 * 获取所有颜色的 CSS 变量名
 */
export const colorCSSVars: Record<keyof ThemeColors, string> = {
  primary: "--color-primary",
  primaryLight: "--color-primary-light",
  primaryDark: "--color-primary-dark",
  secondary: "--color-secondary",
  secondaryLight: "--color-secondary-light",
  secondaryDark: "--color-secondary-dark",
  bgBase: "--color-bg-base",
  bgElevated: "--color-bg-elevated",
  bgCard: "--color-bg-card",
  bgOverlay: "--color-bg-overlay",
  textPrimary: "--color-text-primary",
  textSecondary: "--color-text-secondary",
  textMuted: "--color-text-muted",
  textDisabled: "--color-text-disabled",
  border: "--color-border",
  borderHover: "--color-border-hover",
  borderFocus: "--color-border-focus",
  borderMuted: "--color-border-muted",
  success: "--color-success",
  warning: "--color-warning",
  error: "--color-error",
};
