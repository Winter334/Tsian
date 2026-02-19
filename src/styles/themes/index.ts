/**
 * 主题系统入口
 */

import { cyberpunkTheme } from "./cyberpunk";
import { minimalTheme } from "./minimal";
import type {
  Theme,
  ThemeComponentConfig,
  ThemeComponentConfigInput,
  ThemeMotionConfig,
} from "./types";

// ========== 主题注册表 ==========

export const themes: Record<string, Theme> = {
  cyberpunk: cyberpunkTheme,
  minimal: minimalTheme,
};

export const defaultThemeId = "cyberpunk";

export const defaultThemeMotionConfig: ThemeMotionConfig = {
  duration: {
    instant: 0.1,
    fast: 0.2,
    normal: 0.35,
    slow: 0.5,
    slower: 0.8,
  },
  staggerBase: 0.06,
  stepOffset: 40,
  itemOffset: 20,
  spring: { stiffness: 300, damping: 25 },
};

// ========== 工具函数 ==========

export const defaultThemeComponentConfig: ThemeComponentConfig = {
  panel: {
    borderRadius: "12px",
    borderWidth: "2px",
    backdropBlur: "10px",
    backgroundOpacity: 0.8,
  },
  card: {
    borderRadius: "12px",
    hoverScale: 1.02,
    hoverLift: -4,
    hoverDuration: 0.2,
  },
  button: {
    borderRadius: "8px",
    fontWeight: 600,
  },
  overlay: {
    backdropBlur: "4px",
    backgroundOpacity: 0.95,
  },
};

type ThemeWithOptionalComponents = Omit<Theme, "components"> & {
  components?: ThemeComponentConfigInput;
};

export function normalizeThemeComponents(
  components?: ThemeComponentConfigInput
): ThemeComponentConfig {
  return {
    panel: {
      ...defaultThemeComponentConfig.panel,
      ...components?.panel,
    },
    card: {
      ...defaultThemeComponentConfig.card,
      ...components?.card,
    },
    button: {
      ...defaultThemeComponentConfig.button,
      ...components?.button,
    },
    overlay: {
      ...defaultThemeComponentConfig.overlay,
      ...components?.overlay,
    },
  };
}

function normalizeTheme(theme: Theme | ThemeWithOptionalComponents): Theme {
  const normalized = {
    ...theme,
    components: normalizeThemeComponents(theme.components),
  };

  // 确保 animation.motion 存在（兼容自定义主题缺少此字段）
  if (!normalized.effects.animation.motion) {
    normalized.effects = {
      ...normalized.effects,
      animation: {
        ...normalized.effects.animation,
        motion: defaultThemeMotionConfig,
      },
    };
  }

  return normalized as Theme;
}

/**
 * 获取主题
 */
export function getTheme(id: string): Theme {
  const theme = themes[id] || themes[defaultThemeId];
  return normalizeTheme(theme);
}

/**
 * 获取所有主题列表
 */
export function getAllThemes(): Theme[] {
  return Object.values(themes).map((theme) => normalizeTheme(theme));
}

/**
 * 生成主题的 CSS 变量字符串
 */
export function generateThemeCSSVars(theme: Theme): string {
  const vars: string[] = [];

  // 颜色变量
  for (const [key, value] of Object.entries(theme.colors)) {
    const cssVarName = `--color-${camelToKebab(key)}`;
    vars.push(`${cssVarName}: ${value}`);
  }

  return vars.join(";\n  ");
}

/**
 * 将主题应用到 DOM
 */
export function applyThemeToDOM(themeId: string): void {
  const theme = getTheme(themeId);

  // 设置 data-theme 属性
  document.documentElement.setAttribute("data-theme", theme.id);

  // 直接设置 CSS 变量（用于动态切换）
  const root = document.documentElement;
  for (const [key, value] of Object.entries(theme.colors)) {
    const cssVarName = `--color-${camelToKebab(key)}`;
    root.style.setProperty(cssVarName, value);
  }

  // 动画变量
  const m = theme.effects.animation.motion;
  root.style.setProperty("--anim-duration-instant", `${m.duration.instant}s`);
  root.style.setProperty("--anim-duration-fast", `${m.duration.fast}s`);
  root.style.setProperty("--anim-duration-normal", `${m.duration.normal}s`);
  root.style.setProperty("--anim-duration-slow", `${m.duration.slow}s`);
  root.style.setProperty("--anim-duration-slower", `${m.duration.slower}s`);
  root.style.setProperty("--anim-stagger-base", `${m.staggerBase}s`);
  root.style.setProperty("--anim-step-offset", `${m.stepOffset}px`);
  root.style.setProperty("--anim-item-offset", `${m.itemOffset}px`);
}

// ========== 内部工具 ==========

function camelToKebab(str: string): string {
  return str.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
}

// ========== 类型导出 ==========

export type {
  Theme,
  ThemeAnimation,
  ThemeColors,
  ThemeComponentConfig,
  ThemeComponentConfigInput,
  ThemeEffects,
  ThemeMotionConfig,
} from "./types";
