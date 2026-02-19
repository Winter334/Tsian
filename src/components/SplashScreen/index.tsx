/**
 * 开屏动画组件
 * Sprint 3: Transition 状态实现
 *
 * 统一使用 PixiJS 画布实现所有开屏动画效果
 * 画面状态：Waiting -> Booting -> Transition -> Title
 *
 * 终端文字渲染已迁移到 PixiJS (TerminalRenderer)
 * 过渡动画由 TransitionRenderer 处理（扫描线揭示 + Glitch 切换）
 * 故障效果由 FilterManager 和 GlitchScheduler 处理
 */
import { type SplashPhase } from "@/config/splash";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useState } from "react";
import type { CanvasContext } from "./PixiSplashCanvas";
import { PixiSplashCanvas } from "./PixiSplashCanvas";

interface SplashScreenProps {
  onComplete: () => void;
}

/**
 * 开屏动画主组件
 */
export function SplashScreen({ onComplete }: SplashScreenProps) {
  const [phase, setPhase] = useState<SplashPhase>("waiting");

  /**
   * 处理画布就绪
   */
  const handleCanvasReady = useCallback((_context: CanvasContext) => {
    // 画布已就绪
  }, []);

  /**
   * 每帧更新 - 故障效果在 PixiSplashCanvas 中统一处理
   */
  const handleUpdate = useCallback(
    (_context: CanvasContext, _delta: number) => {
      // 故障效果由 PixiSplashCanvas 的 GlitchScheduler 处理
    },
    []
  );

  /**
   * 处理点击
   */
  const handleClick = useCallback(() => {
    if (phase === "waiting") {
      // 进入 Booting 状态
      setPhase("booting");
    }
  }, [phase]);

  /**
   * 处理启动序列完成
   */
  const handleBootComplete = useCallback(() => {
    setPhase("transition");
  }, []);

  /**
   * 处理过渡完成（由 TransitionRenderer 触发）
   */
  const handleTransitionComplete = useCallback(() => {
    setPhase("title");
    onComplete();
  }, [onComplete]);

  return (
    <AnimatePresence>
      {phase !== "title" && (
        <motion.div
          className="fixed inset-0 z-50 cursor-pointer overflow-hidden"
          onClick={handleClick}
          exit={{
            opacity: 0,
            transition: { duration: 0.3 },
          }}
        >
          {/* PixiJS 统一画布 - 处理背景、故障效果、终端文字和过渡动画 */}
          <PixiSplashCanvas
            phase={phase}
            onReady={handleCanvasReady}
            onUpdate={handleUpdate}
            onBootComplete={handleBootComplete}
            onTransitionComplete={handleTransitionComplete}
          />

          {/* 边角装饰 - Waiting 和 Booting 状态显示 */}
          {(phase === "waiting" || phase === "booting") && (
            <CornerDecorations />
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * 边角装饰
 */
function CornerDecorations() {
  return (
    <>
      <div className="fixed top-6 left-6 w-8 h-8 border-t border-l border-cyan-500/30 pointer-events-none" />
      <div className="fixed top-6 right-6 w-8 h-8 border-t border-r border-cyan-500/30 pointer-events-none" />
      <div className="fixed bottom-6 left-6 w-8 h-8 border-b border-l border-cyan-500/30 pointer-events-none" />
      <div className="fixed bottom-6 right-6 w-8 h-8 border-b border-r border-cyan-500/30 pointer-events-none" />
    </>
  );
}

// 导出子组件供其他模块使用
export { PixiSplashCanvas } from "./PixiSplashCanvas";
export type { CanvasContext } from "./PixiSplashCanvas";
