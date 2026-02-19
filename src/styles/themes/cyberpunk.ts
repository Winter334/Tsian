/**
 * 赛博朋克主题
 * Cyan 青色系 - 深色背景 + 霓虹青色
 */

import type { Theme } from "./types";

export const cyberpunkTheme: Theme = {
  id: "cyberpunk",
  name: "赛博朋克",
  colors: {
    // 主色 - Cyan 霓虹青色（明亮的科技感）
    primary: "#00e5cc", // 霓虹青色
    primaryLight: "#5effe8", // 亮青色
    primaryDark: "#00b8a3", // 深青色

    // 辅色 - 明亮的青蓝色（让渐变更鲜明）
    secondary: "#00d4ff", // 明亮青蓝色
    secondaryLight: "#5ee5ff", // 亮青蓝色
    secondaryDark: "#00a8cc", // 深青蓝色

    // 背景 - 近乎纯黑（增强霓虹效果对比）
    bgBase: "#010202", // 近乎纯黑
    bgElevated: "#040606", // 稍亮的层级
    bgCard: "#030505", // 卡片背景
    bgOverlay: "rgba(1, 2, 2, 0.97)",

    // 文字 - 青色调高对比度
    textPrimary: "#e0fffe", // 近白的青色调
    textSecondary: "#5effe8", // 亮青色
    textMuted: "#4db6ac", // 柔和的青色
    textDisabled: "rgba(0, 229, 204, 0.35)",

    // 边框 - 青色系
    border: "rgba(0, 229, 204, 0.4)",
    borderHover: "#5effe8", // 亮青色
    borderFocus: "#00e5cc",
    borderMuted: "rgba(0, 229, 204, 0.15)",

    // 语义色
    success: "#10b981", // 保持绿色
    warning: "#f59e0b", // 保持橙色
    error: "#ef4444", // 保持红色
  },
  // 组件形态配置（阶段 0：供容器层/复合层读取）
  // 默认值对齐当前 Panel/Card/Dialog 的真实视觉参数
  components: {
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
  },
  effects: {
    animation: {
      transition: {
        fast: "0.1s ease-out",
        normal: "0.2s ease-out",
        slow: "0.4s cubic-bezier(0.16, 1, 0.3, 1)",
      },
      hover: {
        scale: 1.03,
        glow: true,
        glitch: true,
      },
      motion: {
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
      },
    },
    backgroundEffects: {
      matrixRain: true,
      particles: true,
      scanlines: true,
      noise: false,
      gradientFlow: false,
    },
  },
};
