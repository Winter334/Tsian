import { StarfieldBackground } from "@/components/effects/StarfieldBackground";
import { APP_CONFIG } from "@/config/app";
import { useThemeEffectSwitches } from "@/hooks";
import { useSettingsStore } from "@/stores/settings";
import {
  animation,
  color,
  colorAlpha,
  createGridBackground,
  glow,
  gradients,
  gradientText,
  typography,
} from "@/styles/tokens";
import { motion } from "framer-motion";
import { FolderOpen, Home, Settings } from "lucide-react";
import { useEffect, useMemo, type ReactNode } from "react";

interface AppShellProps {
  children: ReactNode;
  onTitleClick?: () => void;
  onSettings?: () => void;
  onSaveManager?: () => void;
  headerExtra?: ReactNode;
}

/**
 * 应用布局骨架
 * Header + Main 结构，支持主题切换
 */
export function AppShell({
  children,
  onTitleClick,
  onSettings,
  onSaveManager,
  headerExtra,
}: AppShellProps) {
  const { loadSettings } = useSettingsStore();

  // 初始化时加载设置
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const {
    isGridOverlayEnabled,
    isMatrixRainEnabled,
    isParticlesEnabled,
    isScanlinesEnabled,
  } = useThemeEffectSwitches();

  // 使用 Token 系统计算网格背景样式
  const primaryGridStyles = useMemo(() => {
    if (!isGridOverlayEnabled) {
      return null;
    }

    return createGridBackground(isMatrixRainEnabled ? 0.08 : 0.05, 60);
  }, [isGridOverlayEnabled, isMatrixRainEnabled]);

  const secondaryGridStyles = useMemo(() => {
    if (!isScanlinesEnabled) {
      return null;
    }

    return createGridBackground(0.03, 20);
  }, [isScanlinesEnabled]);

  // Header 背景样式
  const headerStyles = useMemo(() => {
    return {
      background: gradients.headerBg(),
      borderBottom: "1px solid",
      borderImage: `${gradients.border()} 1`,
    };
  }, []);

  // Logo 渐变文字样式
  const logoTextStyles = useMemo(() => {
    return gradientText(gradients.text());
  }, []);

  // 按钮悬停样式
  const buttonHoverStyles = useMemo(() => {
    return {
      background: gradients.subtle(),
      boxShadow: glow("primary", "md", 0.3),
    };
  }, []);

  return (
    <div
      className="flex flex-col h-dvh overflow-hidden"
      style={{
        background: color("bgBase"),
        color: color("textPrimary"),
      }}
    >
      {/* 网格背景层 - 主网格 */}
      {primaryGridStyles && (
        <div
          className="fixed inset-0 z-0 pointer-events-none"
          style={primaryGridStyles}
        />
      )}
      {/* 网格背景层 - 次级网格 */}
      {secondaryGridStyles && (
        <div
          className="fixed inset-0 z-0 pointer-events-none"
          style={secondaryGridStyles}
        />
      )}

      {/* Header - 增强毛玻璃效果 */}
      <header
        className="glass-card h-16 shrink-0 backdrop-blur-md overflow-hidden"
        style={{
          ...headerStyles,
          borderBottom: `2px solid ${colorAlpha("primary", 0.5)}`,
          boxShadow: `0 1px 0 0 ${colorAlpha("primary", 0.3)}, ${glow(
            "primary",
            "sm",
            0.2,
          )}`,
        }}
      >
        {isParticlesEnabled && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ zIndex: 0 }}
          >
            <StarfieldBackground transparentBackground useThemeColors />
          </div>
        )}
        <div className="relative z-10 flex items-center justify-between h-full px-6">
          {/* 左侧：Logo */}
          <motion.button
            onClick={onTitleClick}
            className="flex items-center gap-2"
            whileHover={{
              scale: 1.02,
              filter: `drop-shadow(0 0 8px ${colorAlpha("primary", 0.5)})`,
            }}
            whileTap={{ scale: animation.tap.scale }}
            transition={{ duration: animation.duration.instant }}
          >
            <span style={gradientText()}>
              <Home size={20} />
            </span>
            <span
              className="font-bold text-lg tracking-wider"
              style={{
                fontFamily: typography.fontFamily.display,
                ...logoTextStyles,
              }}
            >
              {APP_CONFIG.name}
            </span>
          </motion.button>

          {/* 右侧：扩展入口 + 操作按钮 */}
          <div className="flex items-center gap-0.5 sm:gap-1">
            {headerExtra && (
              <div className="mr-1 flex items-center">{headerExtra}</div>
            )}
            {/* 存档管理按钮 */}
            <motion.button
              onClick={onSaveManager}
              className="p-2 rounded"
              style={{
                background: "transparent",
                color: color("primary"),
              }}
              whileHover={buttonHoverStyles}
              whileTap={{ scale: 0.95 }}
              transition={{ duration: animation.duration.instant }}
              title="存档管理"
            >
              <FolderOpen size={18} />
            </motion.button>

            {/* 设置按钮 */}
            <motion.button
              onClick={onSettings}
              className="p-2 rounded"
              style={{
                background: "transparent",
                color: color("primary"),
              }}
              whileHover={buttonHoverStyles}
              whileTap={{ scale: 0.95 }}
              transition={{ duration: animation.duration.instant }}
              title="设置"
            >
              <Settings size={18} />
            </motion.button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 min-h-0 overflow-hidden relative">
        {children}
      </main>

      {/* 边角装饰 - 增强发光效果 */}
      <div
        className="fixed bottom-0 left-0 w-12 h-12 pointer-events-none"
        style={{
          borderBottom: `2px solid ${colorAlpha("primary", 0.5)}`,
          borderLeft: `2px solid ${colorAlpha("primary", 0.5)}`,
          boxShadow: glow("primary", "sm", 0.3),
        }}
      />
      <div
        className="fixed bottom-0 right-0 w-12 h-12 pointer-events-none"
        style={{
          borderBottom: `2px solid ${colorAlpha("secondary", 0.5)}`,
          borderRight: `2px solid ${colorAlpha("secondary", 0.5)}`,
          boxShadow: glow("secondary", "sm", 0.3),
        }}
      />
      <div
        className="fixed top-0 left-0 w-12 h-12 pointer-events-none"
        style={{
          borderTop: `2px solid ${colorAlpha("primary", 0.5)}`,
          borderLeft: `2px solid ${colorAlpha("primary", 0.5)}`,
          boxShadow: glow("primary", "sm", 0.3),
        }}
      />
      <div
        className="fixed top-0 right-0 w-12 h-12 pointer-events-none"
        style={{
          borderTop: `2px solid ${colorAlpha("secondary", 0.5)}`,
          borderRight: `2px solid ${colorAlpha("secondary", 0.5)}`,
          boxShadow: glow("secondary", "sm", 0.3),
        }}
      />
    </div>
  );
}
