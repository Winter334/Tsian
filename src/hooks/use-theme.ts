/**
 * 主题切换 Hook
 */

import { useSettingsStore } from "@/stores/settings";
import {
  applyThemeToDOM,
  defaultThemeId,
  getAllThemes,
  getTheme,
  themes,
  type Theme,
} from "@/styles/themes";
import { useCallback, useEffect } from "react";

export interface UseThemeReturn {
  /** 当前主题 ID */
  themeId: string;
  /** 当前主题对象 */
  theme: Theme;
  /** 所有可用主题 */
  themes: Theme[];
  /** 切换主题 */
  setTheme: (id: string) => void;
}

/**
 * 主题切换 Hook
 *
 * @example
 * ```tsx
 * function ThemeSelector() {
 *   const { themeId, themes, setTheme } = useTheme()
 *
 *   return (
 *     <select value={themeId} onChange={e => setTheme(e.target.value)}>
 *       {themes.map(t => (
 *         <option key={t.id} value={t.id}>{t.name}</option>
 *       ))}
 *     </select>
 *   )
 * }
 * ```
 */
export function useTheme(): UseThemeReturn {
  const { themeId, setThemeId } = useSettingsStore();

  // 应用主题到 DOM
  useEffect(() => {
    const id = themeId || defaultThemeId;
    applyThemeToDOM(id);
  }, [themeId]);

  // 切换主题
  const setTheme = useCallback(
    (id: string) => {
      if (themes[id]) {
        setThemeId(id);
      }
    },
    [setThemeId]
  );

  const currentThemeId = themeId || defaultThemeId;

  return {
    themeId: currentThemeId,
    theme: getTheme(currentThemeId),
    themes: getAllThemes(),
    setTheme,
  };
}

/**
 * 获取主题动画配置的 Hook
 * 用于 Framer Motion 等动画库
 */
export function useThemeMotion() {
  const { theme } = useTheme();

  return {
    hover: {
      scale: theme.effects.animation.hover.scale,
      transition: { duration: 0.1 },
      ...(theme.effects.animation.hover.glow && {
        filter: "brightness(1.2)",
      }),
    },
    tap: {
      scale: 0.98,
    },
    // 页面过渡
    pageTransition: {
      initial: { opacity: 0, y: 20 },
      animate: { opacity: 1, y: 0 },
      exit: { opacity: 0, y: -20 },
      transition: {
        duration: parseFloat(theme.effects.animation.transition.normal),
      },
    },
  };
}

/**
 * 获取主题背景特效配置
 */
export function useThemeEffects() {
  const { theme } = useTheme();
  return theme.effects.backgroundEffects;
}

export interface ThemeEffectSwitches {
  isMatrixRainEnabled: boolean;
  isParticlesEnabled: boolean;
  isScanlinesEnabled: boolean;
  isNoiseEnabled: boolean;
  isGradientFlowEnabled: boolean;
  isGridOverlayEnabled: boolean;
  isGlassEffectEnabled: boolean;
  isStrongGlowEnabled: boolean;
}

/**
 * 统一背景特效开关语义
 * 用于避免各组件对同一开关出现解释漂移
 */
export function useThemeEffectSwitches(): ThemeEffectSwitches {
  const backgroundEffects = useThemeEffects();

  const isMatrixRainEnabled = backgroundEffects.matrixRain;
  const isParticlesEnabled = backgroundEffects.particles;
  const isScanlinesEnabled = backgroundEffects.scanlines;
  const isNoiseEnabled = backgroundEffects.noise;
  const isGradientFlowEnabled = backgroundEffects.gradientFlow;

  return {
    isMatrixRainEnabled,
    isParticlesEnabled,
    isScanlinesEnabled,
    isNoiseEnabled,
    isGradientFlowEnabled,
    isGridOverlayEnabled: isMatrixRainEnabled || isScanlinesEnabled,
    isGlassEffectEnabled:
      isParticlesEnabled || isMatrixRainEnabled || isScanlinesEnabled,
    isStrongGlowEnabled: isMatrixRainEnabled || isScanlinesEnabled,
  };
}
