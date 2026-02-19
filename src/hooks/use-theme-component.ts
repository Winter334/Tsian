/**
 * 组件主题配置 Hook
 * 提供对 theme.components.* 的类型安全访问
 */

import { type ThemeComponentConfig } from "@/styles/themes";
import { useTheme } from "./use-theme";

export type ThemeComponentKey = keyof ThemeComponentConfig;

/**
 * 读取指定组件的主题配置
 *
 * @example
 * const panelConfig = useThemeComponent("panel");
 * const cardConfig = useThemeComponent("card");
 */
export function useThemeComponent<K extends ThemeComponentKey>(
  key: K
): ThemeComponentConfig[K] {
  const { theme } = useTheme();
  return theme.components[key];
}

/**
 * 读取完整组件主题配置
 */
export function useThemeComponents(): ThemeComponentConfig {
  const { theme } = useTheme();
  return theme.components;
}
