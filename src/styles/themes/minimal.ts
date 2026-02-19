/**
 * 极简主题
 * 简约低干扰风格 - 收敛光效、弱化动态、降低玻璃感
 */

import type { Theme } from "./types";

export const minimalTheme: Theme = {
  id: "minimal",
  name: "极简",
  colors: {
    // 主色
    primary: "#3b82f6",
    primaryLight: "#60a5fa",
    primaryDark: "#2563eb",

    // 辅色
    secondary: "#8b5cf6",
    secondaryLight: "#a78bfa",
    secondaryDark: "#7c3aed",

    // 背景
    bgBase: "#0f172a",
    bgElevated: "#111827",
    bgCard: "#1f2937",
    bgOverlay: "rgba(15, 23, 42, 0.92)",

    // 文字
    textPrimary: "#f8fafc",
    textSecondary: "#e2e8f0",
    textMuted: "#94a3b8",
    textDisabled: "rgba(148, 163, 184, 0.45)",

    // 边框
    border: "rgba(148, 163, 184, 0.32)",
    borderHover: "#cbd5e1",
    borderFocus: "#60a5fa",
    borderMuted: "rgba(148, 163, 184, 0.16)",

    // 语义色
    success: "#10b981",
    warning: "#f59e0b",
    error: "#ef4444",
  },

  components: {
    panel: {
      borderRadius: "8px",
      borderWidth: "1px",
      backdropBlur: "0px",
      backgroundOpacity: 1,
    },
    card: {
      borderRadius: "8px",
      hoverScale: 1,
      hoverLift: 0,
      hoverDuration: 0.15,
    },
    button: {
      borderRadius: "6px",
      fontWeight: 500,
    },
    overlay: {
      backdropBlur: "0px",
      backgroundOpacity: 0.9,
    },
  },

  effects: {
    animation: {
      transition: {
        fast: "0.1s ease-out",
        normal: "0.15s ease-out",
        slow: "0.25s ease-out",
      },
      hover: {
        scale: 1,
        glow: false,
        glitch: false,
      },
      motion: {
        duration: {
          instant: 0.08,
          fast: 0.15,
          normal: 0.25,
          slow: 0.35,
          slower: 0.5,
        },
        staggerBase: 0.04,
        stepOffset: 20,
        itemOffset: 12,
        spring: { stiffness: 400, damping: 30 },
      },
    },
    backgroundEffects: {
      matrixRain: false,
      particles: false,
      scanlines: false,
      noise: false,
      gradientFlow: false,
    },
  },
};
