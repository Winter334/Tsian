import { GradientFlowOverlay, ScanLine } from "@/components/effects";
import { APP_CONFIG } from "@/config/app";
import { TITLE_CONFIG } from "@/config/splash";
import { useThemeEffects } from "@/hooks";
import { color, colorAlpha, glow, gradientText } from "@/styles/tokens";
import { motion } from "framer-motion";
import { FolderOpen, Play, RotateCcw, Settings } from "lucide-react";
import { useMemo, useState } from "react";
import { DiagonalBanners } from "./DiagonalBanners";
import { FloatingParticles } from "./FloatingParticles";
import { Logo } from "./Logo";
import { MatrixRain } from "./MatrixRain";
import { MenuButton } from "./MenuButton";
import { MouseEffect } from "./MouseEffect";
import { NoiseTexture } from "./NoiseTexture";
import {
  ParallaxContainer,
  type ParallaxLayerConfig,
} from "./ParallaxContainer";
import { PixiBackground } from "./PixiBackground";

interface TitleScreenProps {
  onStart?: () => void;
  onContinue?: () => void;
  onSettings?: () => void;
  onSaveManager?: () => void;
  hasSaveData?: boolean;
}

/**
 * 游戏标题画面
 * Phase 6: 标题屏幕背景重新设计
 *
 * 布局设计：
 * - 大 Logo 居中
 * - 菜单按钮右下
 * - Discord 链接左上
 * - 在线人数右上
 *
 * 背景层级（从后到前）：
 * 1. MatrixRain - 代码雨效果（matrixRain 开关）
 * 2. NoiseTexture - 动态噪点纹理（noise 开关）
 * 3. PixiBackground - 静态网格（基础层，始终保留）
 * 4. MouseEffect - 鼠标交互尾迹（轻量 SVG 事件驱动）
 * 5. GradientFlowOverlay - 渐变流（gradientFlow 开关）
 * 6. DiagonalBanners - 斜向双条幅
 * 7. FloatingParticles - 浮动粒子（particles 开关）
 * 8. UI Layer - 交互元素（不参与视差）
 */
export function TitleScreen({
  onStart,
  onContinue,
  onSettings,
  onSaveManager,
  hasSaveData = false,
}: TitleScreenProps) {
  const [isBackgroundReady, setIsBackgroundReady] = useState(false);

  const backgroundEffects = useThemeEffects();
  const isMatrixRainEnabled = backgroundEffects.matrixRain;
  const isParticlesEnabled = backgroundEffects.particles;
  const isScanlinesEnabled = backgroundEffects.scanlines;
  const isNoiseEnabled = backgroundEffects.noise;
  const isGradientFlowEnabled = backgroundEffects.gradientFlow;

  // 边角装饰渐变
  const cornerGradient = useMemo(() => {
    return `linear-gradient(135deg, ${color("primary")}, ${color(
      "secondary",
    )})`;
  }, []);

  const cornerGradientReverse = useMemo(() => {
    return `linear-gradient(135deg, ${color("secondary")}, ${color(
      "primary",
    )})`;
  }, []);

  // 构建视差层配置
  // depth 值说明：1 = 不移动（固定），0 = 移动最大
  const layers = useMemo((): ParallaxLayerConfig[] => {
    const depthConfig = TITLE_CONFIG.parallax?.layers ?? {
      background: 0.9, // 背景层，移动很慢
      texture: 0.85, // 纹理层，移动稍慢
      banners: 0.7, // 条幅层，移动适中
      decorative: 0.5, // 装饰层，移动较快
      ui: 1, // UI层，完全不移动
    };

    const layerConfigs: ParallaxLayerConfig[] = [];

    // 背景层：代码雨效果（移动最慢）
    if (isMatrixRainEnabled) {
      layerConfigs.push({
        depth: depthConfig.background,
        children: <MatrixRain />,
      });
    }

    // 纹理层：动态噪点纹理
    if (isNoiseEnabled) {
      layerConfigs.push({
        depth: depthConfig.texture,
        children: <NoiseTexture />,
      });
    }

    // 网格层：静态网格（无鼠标交互动画）
    layerConfigs.push({
      depth: depthConfig.texture,
      children: <PixiBackground onReady={() => setIsBackgroundReady(true)} />,
    });

    // 鼠标交互层：SVG 尾迹 + 轻量爆裂粒子（保留 pointer-events-none）
    layerConfigs.push({
      depth: depthConfig.texture,
      children: <MouseEffect className="z-5" />,
    });

    // 渐变流层：轻量缓慢流动
    if (isGradientFlowEnabled) {
      layerConfigs.push({
        depth: depthConfig.texture,
        children: <GradientFlowOverlay />,
      });
    }

    // 条幅层：斜向双条幅
    layerConfigs.push({
      depth: depthConfig.banners,
      children: <DiagonalBanners />,
    });

    // 装饰层：浮动粒子
    if (isParticlesEnabled) {
      layerConfigs.push({
        depth: depthConfig.decorative,
        children: <FloatingParticles />,
      });
    }

    // UI 层：不移动，包含所有交互元素
    layerConfigs.push({
      depth: depthConfig.ui,
      children: (
        <UILayer
          isBackgroundReady={isBackgroundReady}
          cornerGradient={cornerGradient}
          cornerGradientReverse={cornerGradientReverse}
          onStart={onStart}
          onContinue={onContinue}
          onSettings={onSettings}
          onSaveManager={onSaveManager}
          hasSaveData={hasSaveData}
        />
      ),
    });

    return layerConfigs;
  }, [
    isBackgroundReady,
    cornerGradient,
    cornerGradientReverse,
    isGradientFlowEnabled,
    isMatrixRainEnabled,
    isNoiseEnabled,
    isParticlesEnabled,
    onStart,
    onContinue,
    onSettings,
    onSaveManager,
    hasSaveData,
  ]);

  return (
    <div className="fixed inset-0 overflow-hidden">
      {/* 背景色层 - 最底层 */}
      <div
        className="absolute inset-0 -z-10"
        style={{ background: color("bgBase") }}
      />

      {/* 视差容器：包含所有背景层 */}
      <ParallaxContainer layers={layers} />

      {isScanlinesEnabled && (
        <>
          {/* 扫描线效果（静态）- 不参与视差 */}
          <div
            className="fixed inset-0 z-20 pointer-events-none opacity-30"
            style={{
              background:
                "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0, 0, 0, 0.3) 2px, rgba(0, 0, 0, 0.3) 4px)",
            }}
          />

          {/* 扫描线组件（动态）- 不参与视差 */}
          <ScanLine />
        </>
      )}
    </div>
  );
}

/**
 * UI 层组件
 * 包含所有不参与视差的交互元素
 */
interface UILayerProps {
  isBackgroundReady: boolean;
  cornerGradient: string;
  cornerGradientReverse: string;
  onStart?: () => void;
  onContinue?: () => void;
  onSettings?: () => void;
  onSaveManager?: () => void;
  hasSaveData: boolean;
}

function UILayer({
  isBackgroundReady,
  cornerGradient,
  cornerGradientReverse,
  onStart,
  onContinue,
  onSettings,
  onSaveManager,
  hasSaveData,
}: UILayerProps) {
  return (
    <>
      {/* 左上角：Discord 链接 */}
      <motion.a
        href={TITLE_CONFIG.discord.url}
        target="_blank"
        rel="noopener noreferrer"
        className="fixed top-6 left-6 z-20 flex items-center gap-2 group cursor-pointer"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: isBackgroundReady ? 1 : 0, x: 0 }}
        transition={{ delay: 0.5, duration: 0.5 }}
        whileHover={{ scale: 1.05 }}
      >
        {/* Discord 图标 - 简化线条版 */}
        <svg
          width={TITLE_CONFIG.discord.iconSize}
          height={TITLE_CONFIG.discord.iconSize}
          viewBox="0 0 24 24"
          fill="none"
          className="stroke-cyan-400 group-hover:stroke-cyan-300 transition-colors"
          strokeWidth="1.5"
        >
          <path
            d="M9.5 11.5a1 1 0 100 2 1 1 0 000-2zm5 0a1 1 0 100 2 1 1 0 000-2z"
            fill="currentColor"
          />
          <path d="M5.5 16c.5 2.5 3.5 3.5 6.5 3.5s6-1 6.5-3.5c0 0 .5-4 0-7s-3-4-3-4l-1 2h-5l-1-2s-2.5 1-3 4-.5 7-.5 7z" />
        </svg>
        <span
          className="text-sm font-mono text-cyan-400/70 group-hover:text-cyan-300 transition-colors opacity-0 group-hover:opacity-100"
          style={{ marginLeft: 4 }}
        >
          加入社区
        </span>
      </motion.a>

      {/* 右上角：在线人数指示器 - 增强毛玻璃效果 */}
      <motion.div
        className="fixed top-6 right-6 z-20 flex items-center gap-2"
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: isBackgroundReady ? 1 : 0, x: 0 }}
        transition={{ delay: 0.6, duration: 0.5 }}
      >
        <div
          className="glass-card flex items-center gap-2 px-4 py-2 rounded-lg border corner-accent"
          style={{
            minWidth: 120,
            borderColor: colorAlpha("primary", 0.5),
          }}
        >
          {/* 脉动指示灯 */}
          <motion.div
            className="w-2.5 h-2.5 rounded-full"
            style={{
              background: color("primary"),
              boxShadow: glow("primary", "sm", 0.8),
            }}
            animate={{
              opacity: [0.6, 1, 0.6],
              scale: [0.9, 1.2, 0.9],
            }}
            transition={{
              duration: TITLE_CONFIG.onlineIndicator.pulsePeriod / 1000,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
          <span
            className="text-xs font-semibold terminal-text"
            style={{ color: color("textSecondary") }}
          >
            扫描信号...
          </span>
        </div>
      </motion.div>

      {/* Logo：移动端顶部居中，桌面端左侧居中 */}
      <div className="fixed top-[25%] left-0 right-0 md:left-16 lg:left-24 md:right-auto md:top-1/2 md:-translate-y-1/2 z-10 flex justify-center md:block">
        <motion.div
          initial={{ opacity: 0, x: -50, scale: 0.9 }}
          animate={{
            opacity: isBackgroundReady ? 1 : 0,
            x: 0,
            scale: 1,
          }}
          transition={{ delay: 0.3, duration: 0.8, ease: "easeOut" }}
          className="transform scale-100 md:scale-125 lg:scale-150 origin-center md:origin-left"
        >
          <Logo />
        </motion.div>
      </div>

      {/* 菜单按钮：移动端底部居中，桌面端右下角 */}
      <div className="fixed bottom-6 left-4 right-4 md:bottom-8 md:right-8 md:left-auto z-30 flex flex-col items-center md:items-end gap-2 md:gap-3">
        <MenuButton
          onClick={onStart}
          icon={<Play size={16} />}
          delay={0.4}
          variant="primary"
        >
          开始新游戏
        </MenuButton>

        <MenuButton
          onClick={onContinue}
          icon={<RotateCcw size={16} />}
          disabled={!hasSaveData}
          delay={0.5}
          variant="secondary"
        >
          继续游戏
        </MenuButton>

        <MenuButton
          onClick={onSaveManager}
          icon={<FolderOpen size={16} />}
          delay={0.6}
          variant="secondary"
        >
          存档管理
        </MenuButton>

        <MenuButton
          onClick={onSettings}
          icon={<Settings size={16} />}
          delay={0.7}
          variant="secondary"
        >
          系统设置
        </MenuButton>
      </div>

      {/* 左下角：版本号 */}
      <motion.div
        className="fixed bottom-6 left-6 z-30 text-sm font-mono"
        style={gradientText(
          `linear-gradient(90deg, ${colorAlpha(
            "primary",
            0.5,
          )} 0%, ${colorAlpha("secondary", 0.5)} 100%)`,
        )}
        initial={{ opacity: 0 }}
        animate={{ opacity: isBackgroundReady ? 1 : 0 }}
        transition={{ delay: 0.8, duration: 0.5 }}
      >
        v{APP_CONFIG.version}
      </motion.div>

      {/* 边角装饰 - 左上 */}
      <motion.div
        className="fixed top-4 left-4 z-25 pointer-events-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: isBackgroundReady ? 1 : 0 }}
        transition={{ delay: 0.2, duration: 0.3 }}
      >
        <div
          className="w-12 h-12"
          style={{
            borderTop: "2px solid",
            borderLeft: "2px solid",
            borderImage: `${cornerGradient} 1`,
          }}
        />
        <div
          className="absolute top-0 left-0 w-2 h-2"
          style={{ background: cornerGradient }}
        />
      </motion.div>

      {/* 边角装饰 - 右上 */}
      <motion.div
        className="fixed top-4 right-4 z-25 pointer-events-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: isBackgroundReady ? 1 : 0 }}
        transition={{ delay: 0.25, duration: 0.3 }}
      >
        <div
          className="w-12 h-12"
          style={{
            borderTop: "2px solid",
            borderRight: "2px solid",
            borderImage: `${cornerGradientReverse} 1`,
          }}
        />
        <div
          className="absolute top-0 right-0 w-2 h-2"
          style={{ background: cornerGradientReverse }}
        />
      </motion.div>

      {/* 边角装饰 - 左下 */}
      <motion.div
        className="fixed bottom-4 left-4 z-25 pointer-events-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: isBackgroundReady ? 1 : 0 }}
        transition={{ delay: 0.3, duration: 0.3 }}
      >
        <div
          className="w-12 h-12"
          style={{
            borderBottom: "2px solid",
            borderLeft: "2px solid",
            borderImage: `${cornerGradientReverse} 1`,
          }}
        />
        <div
          className="absolute bottom-0 left-0 w-2 h-2"
          style={{ background: cornerGradientReverse }}
        />
      </motion.div>

      {/* 边角装饰 - 右下 */}
      <motion.div
        className="fixed bottom-4 right-4 z-25 pointer-events-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: isBackgroundReady ? 1 : 0 }}
        transition={{ delay: 0.35, duration: 0.3 }}
      >
        <div
          className="w-12 h-12"
          style={{
            borderBottom: "2px solid",
            borderRight: "2px solid",
            borderImage: `${cornerGradient} 1`,
          }}
        />
        <div
          className="absolute bottom-0 right-0 w-2 h-2"
          style={{ background: cornerGradient }}
        />
      </motion.div>
    </>
  );
}

export { Logo } from "./Logo";
export { MenuButton } from "./MenuButton";
export { PixiBackground } from "./PixiBackground";
