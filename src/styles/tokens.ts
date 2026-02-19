/**
 * Token 工具函数
 * 返回 CSS 变量引用，实现主题联动
 */

import type { Variants } from "framer-motion";
import type { ThemeColors } from "./themes/types";

// ========== 颜色 Token ==========

type ColorKey = keyof ThemeColors;

/**
 * 获取颜色 CSS 变量引用
 */
export function color(name: ColorKey): string {
  const varName = `--color-${camelToKebab(name)}`;
  return `var(${varName})`;
}

/**
 * 获取带透明度的颜色（使用 color-mix）
 * 注意：需要浏览器支持 color-mix (Chrome 111+, Firefox 113+, Safari 16.2+)
 */
export function colorAlpha(name: ColorKey, alpha: number): string {
  return `color-mix(in srgb, ${color(name)} ${Math.round(
    alpha * 100
  )}%, transparent)`;
}

// ========== 渐变 Token ==========

/**
 * 创建线性渐变
 */
export function gradient(
  direction: string,
  ...colors: Array<ColorKey | string>
): string {
  const colorValues = colors.map((c) =>
    typeof c === "string" && c.startsWith("#") ? c : color(c as ColorKey)
  );
  return `linear-gradient(${direction}, ${colorValues.join(", ")})`;
}

/**
 * 预定义渐变
 */
export const gradients = {
  /** 主渐变（按钮填充等） */
  primary: () => gradient("135deg", "primary", "secondary", "primary"),

  /** 主渐变悬停态 */
  primaryHover: () =>
    gradient("135deg", "primaryLight", "secondaryLight", "primaryLight"),

  /** 次级渐变（透明背景） */
  subtle: () =>
    `linear-gradient(135deg, ${colorAlpha("primary", 0.1)} 0%, ${colorAlpha(
      "secondary",
      0.15
    )} 50%, ${colorAlpha("primary", 0.1)} 100%)`,

  /** 次级渐变悬停态 */
  subtleHover: () =>
    `linear-gradient(135deg, ${colorAlpha("primary", 0.25)} 0%, ${colorAlpha(
      "secondary",
      0.3
    )} 50%, ${colorAlpha("primary", 0.25)} 100%)`,

  /** 边框渐变 */
  border: () =>
    `linear-gradient(90deg, transparent, ${colorAlpha(
      "primary",
      0.3
    )}, ${colorAlpha("secondary", 0.3)}, transparent)`,

  /** 文字渐变（由青到绿，更鲜明） */
  text: () => gradient("135deg", "secondary", "primary"),

  /** 文字渐变反向（由绿到青） */
  textReverse: () => gradient("135deg", "primary", "secondary"),

  /** Header 背景 */
  headerBg: () =>
    `linear-gradient(90deg, ${colorAlpha("bgBase", 0.9)} 0%, ${colorAlpha(
      "bgElevated",
      0.9
    )} 50%, ${colorAlpha("bgBase", 0.9)} 100%)`,
};

// ========== 阴影/发光 Token ==========

type GlowSize = "sm" | "md" | "lg" | "xl";

const glowSizes: Record<GlowSize, number> = {
  sm: 8,
  md: 15,
  lg: 40,
  xl: 60,
};

/**
 * 创建发光效果
 */
export function glow(
  colorName: ColorKey = "primary",
  size: GlowSize = "md",
  alpha: number = 0.4
): string {
  return `0 0 ${glowSizes[size]}px ${colorAlpha(colorName, alpha)}`;
}

/**
 * 预定义阴影
 */
export const shadows = {
  /** 按钮发光 */
  button: () =>
    `${glow("primary", "md", 0.4)}, inset 0 0 10px rgba(255, 255, 255, 0.1)`,

  /** 按钮悬停发光 */
  buttonHover: () =>
    `${glow("primary", "lg", 0.8)}, ${glow(
      "secondary",
      "xl",
      0.5
    )}, inset 0 0 20px rgba(255, 255, 255, 0.2)`,

  /** 卡片发光 */
  card: () =>
    `${glow("primary", "lg", 0.25)}, inset 0 0 30px ${colorAlpha(
      "primary",
      0.05
    )}`,

  /** 内阴影 */
  inset: () => `inset 0 0 30px ${colorAlpha("primary", 0.05)}`,

  /** 卡片悬停发光（双色叠加） */
  cardHover: () =>
    `${glow("primary", "lg", 0.6)}, ${glow(
      "secondary",
      "xl",
      0.4
    )}, inset 0 0 40px ${colorAlpha("primary", 0.1)}`,

  /** 强烈脉动发光（用于重要按钮） */
  pulse: () =>
    `0 0 20px ${colorAlpha("primary", 0.8)}, 0 0 40px ${colorAlpha(
      "secondary",
      0.6
    )}, 0 0 60px ${colorAlpha("primary", 0.4)}`,
};

// ========== 网格背景 ==========

/**
 * 创建网格背景样式
 * @param opacity - 网格线透明度 (0-1)
 * @param size - 网格尺寸 (px)
 */
export function createGridBackground(
  opacity: number = 0.12,
  size: number = 60
): { backgroundImage: string; backgroundSize: string } {
  return {
    backgroundImage: `
      linear-gradient(${colorAlpha("primary", opacity)} 1px, transparent 1px),
      linear-gradient(90deg, ${colorAlpha(
        "secondary",
        opacity
      )} 1px, transparent 1px)
    `,
    backgroundSize: `${size}px ${size}px`,
  };
}

/**
 * 创建多层网格背景样式（大网格 + 小网格）
 * @param primaryOpacity - 主网格透明度 (0-1)
 * @param primarySize - 主网格尺寸 (px)
 * @param secondaryOpacity - 次级网格透明度 (0-1)
 * @param secondarySize - 次级网格尺寸 (px)
 */
export function createMultiLayerGridBackground(
  primaryOpacity: number = 0.12,
  primarySize: number = 60,
  secondaryOpacity: number = 0.04,
  secondarySize: number = 20
): { backgroundImage: string; backgroundSize: string } {
  return {
    backgroundImage: `
      linear-gradient(${colorAlpha(
        "primary",
        primaryOpacity
      )} 1px, transparent 1px),
      linear-gradient(90deg, ${colorAlpha(
        "primary",
        primaryOpacity
      )} 1px, transparent 1px),
      linear-gradient(${colorAlpha(
        "secondary",
        secondaryOpacity
      )} 1px, transparent 1px),
      linear-gradient(90deg, ${colorAlpha(
        "secondary",
        secondaryOpacity
      )} 1px, transparent 1px)
    `,
    backgroundSize: `${primarySize}px ${primarySize}px, ${primarySize}px ${primarySize}px, ${secondarySize}px ${secondarySize}px, ${secondarySize}px ${secondarySize}px`,
  };
}

// ========== 渐变文字 ==========

/**
 * 渐变文字样式
 */
export function gradientText(gradientValue?: string): React.CSSProperties {
  return {
    background: gradientValue || gradients.text(),
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
  };
}

// ========== 动画配置 ==========

/**
 * @deprecated 优先使用 `useMotionTokens()` hook 获取主题响应的动画参数。
 * 该静态常量不随主题切换变化，仅保留向后兼容。
 * @see {@link file://src/hooks/use-motion-tokens.ts}
 */
export const animation = {
  // 时长
  duration: {
    instant: 0.1,
    fast: 0.15,
    normal: 0.2,
    slow: 0.3,
    slower: 0.5,
  },

  // 缓动函数
  easing: {
    default: "easeOut",
    smooth: [0.25, 0.46, 0.45, 0.94] as const, // easeOutQuad - 平滑过渡
    bounce: [0.68, -0.55, 0.265, 1.55] as const, // easeOutBack - 弹性回弹
    spring: { type: "spring" as const, stiffness: 300, damping: 25 },
  },

  // 交互动画
  hover: {
    scale: 1.02,
    lift: -4, // translateY 上浮距离
    duration: 0.2,
  },

  tap: {
    scale: 0.98,
    duration: 0.1,
  },
};

// ========== 统一入场动画变体 ==========

/**
 * 遮罩层动画变体
 * 用于弹窗/对话框的背景遮罩
 */
export const overlayVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: animation.duration.normal },
  },
  exit: {
    opacity: 0,
    transition: { duration: animation.duration.normal },
  },
};

/**
 * 面板/弹窗内容动画变体
 * 用于弹窗主体内容的入场动画
 */
export const panelVariants: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.95,
    y: 10,
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      duration: animation.duration.normal,
      ease: "easeOut",
    },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: 10,
    transition: {
      duration: animation.duration.fast,
    },
  },
};

/**
 * 内部步骤切换动画变体（向前导航）
 * 用于向导、设置页面等的步骤切换
 * @deprecated 使用 `createStepVariants(config, 'forward')` 替代，支持主题响应。
 * @see {@link file://src/styles/motion-variants.ts}
 */
export const stepForwardVariants: Variants = {
  hidden: { opacity: 0, x: 20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: animation.duration.fast },
  },
  exit: {
    opacity: 0,
    x: -20,
    transition: { duration: animation.duration.fast },
  },
};

/**
 * 内部步骤切换动画变体（向后导航）
 * 用于返回上一步时的动画
 * @deprecated 使用 `createStepVariants(config, 'backward')` 替代，支持主题响应。
 * @see {@link file://src/styles/motion-variants.ts}
 */
export const stepBackwardVariants: Variants = {
  hidden: { opacity: 0, x: -20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: animation.duration.fast },
  },
  exit: {
    opacity: 0,
    x: 20,
    transition: { duration: animation.duration.fast },
  },
};

/**
 * 列表项动画变体
 * 用于列表项的入场动画（需配合 custom 属性传入 index）
 * @deprecated 使用 `createStaggerVariants(config)` 替代，支持主题响应。
 * @see {@link file://src/styles/motion-variants.ts}
 */
export const listItemVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: (index: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: animation.duration.fast,
      delay: index * 0.03,
    },
  }),
  exit: {
    opacity: 0,
    y: -10,
    transition: { duration: animation.duration.fast },
  },
};

/**
 * 淡入淡出动画变体
 * 用于简单的显示/隐藏切换
 */
export const fadeVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: animation.duration.fast },
  },
  exit: {
    opacity: 0,
    transition: { duration: animation.duration.fast },
  },
};

// ========== 边框 ==========

export const borders = {
  width: {
    DEFAULT: "1px",
    medium: "2px",
  },
  radius: {
    sm: "4px",
    DEFAULT: "6px",
    md: "8px",
    lg: "12px",
    full: "9999px",
  },
};

// ========== 间距 ==========

export const spacing = {
  component: {
    sm: "0.5rem",
    DEFAULT: "1rem",
    lg: "1.5rem",
  },
};

// ========== 字体 ==========

export const typography = {
  fontFamily: {
    display: '"Orbitron", "Fira Code", monospace',
    mono: '"Fira Code", "Consolas", monospace',
    body: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  fontWeight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
};

// ========== 毛玻璃效果 ==========

/**
 * 创建毛玻璃效果
 * 自动包含降级方案（不支持 backdrop-filter 时使用半透明背景）
 */
export function glassmorphism(opacity: number = 0.1): React.CSSProperties {
  return {
    backgroundColor: colorAlpha("bgCard", opacity),
    backdropFilter: "blur(10px)",
    WebkitBackdropFilter: "blur(10px)",
    border: `1px solid ${colorAlpha("border", 0.3)}`,
  };
}

// ========== 终端文本样式 ==========

/**
 * 终端/监控面板文本样式
 */
export function terminalText(): React.CSSProperties {
  return {
    fontFamily: typography.fontFamily.mono,
    color: color("textSecondary"),
    textShadow: `0 0 5px ${colorAlpha("primary", 0.5)}`,
    letterSpacing: "0.05em",
  };
}

// ========== 内部工具 ==========

function camelToKebab(str: string): string {
  return str.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
}
