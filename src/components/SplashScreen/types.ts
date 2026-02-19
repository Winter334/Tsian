import type { Application, Container } from "@/lib/pixi";
import type { SignalNoiseFilter } from "./filters/SignalNoiseFilter";

/** 供后续 FilterManager 使用的信号噪声滤镜类型 */
export type SignalNoiseFilterType = SignalNoiseFilter;

/** 开屏动画阶段 */
export type SplashPhase =
  | "intro" // 信号锁定阶段（自动播放）
  | "idle" // Logo 已揭示，等待用户交互
  | "charging" // 用户按住 Logo，能量聚集（Phase 2 用）
  | "sequence" // 启动序列（Phase 2 用）
  | "complete"; // 动画完成，进入标题画面

/** 信号锁定子阶段 */
export type SignalLockSubPhase =
  | "search" // 4a. 搜索噪声
  | "glimpse" // 4b. 信号闪现
  | "radialLock" // 4c. 径向锁定
  | "confirm"; // 4d. 确认脉冲

/** 画布上下文 - 渲染器共享 */
export interface SplashCanvasContext {
  app: Application;
  stage: Container;
  layers: {
    background: Container;
    noise: Container;
    content: Container;
    ui: Container;
  };
  screen: { width: number; height: number };
}

/** 渲染器通用接口 */
export interface SplashRenderer {
  /** 初始化渲染器 */
  init(ctx: SplashCanvasContext): void;
  /** 每帧更新 */
  update(elapsed: number, delta: number): void;
  /** 处理窗口 resize */
  resize(width: number, height: number): void;
  /** 销毁资源 */
  destroy(): void;
}

/** FilterManager 接口（从现有 PixiSplashCanvas 中抽象） */
export interface FilterManagerInterface {
  /** 触发撕裂效果 */
  triggerTear(intensity?: number): void;
  /** 触发 RGB 色差 */
  triggerRGBSplit(intensity?: number): void;
  /** 触发自定义撕裂效果 */
  triggerTearCustom(offset: number, slices: number, direction?: number): void;
  /** 触发自定义 RGB 分离 */
  triggerRGBSplitCustom(
    redX: number,
    blueX: number,
    jitter: number,
    redY?: number,
    blueY?: number,
  ): void;
  /** 启用/禁用轻微 RGB 偏移 */
  setSubtleRGB(enabled: boolean): void;
  /** 重置所有滤镜到默认 */
  reset(): void;
  /** 更新 CRT 效果 */
  updateCRT(delta: number): void;
  /** 启用/禁用 CRT */
  setCRTEnabled(enabled: boolean): void;
  /** 销毁滤镜 */
  destroy(): void;
}
