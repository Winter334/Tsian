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
  | "credits" // 署名展示阶段（爆炸后，标题前）
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

/** Phase 2 - 能量启动子阶段 */
export type ChargeSubPhase =
  | "holding" // 用户按住，能量聚集
  | "primed" // 充能完成，可释放
  | "brake" // 序列开始时急刹车
  | "implode" // 松手后粒子吸入中心
  | "flash" // 闪白爆炸
  | "shockwave" // 冲击波扩散 + 碎片
  | "fadeout"; // 淡出所有效果

/** Phase 2 - 粒子模式 */
export type ParticleMode =
  | "burst" // 从中心爆发飘散（Phase 1 脉冲结束后触发）
  | "drift" // 自由飘动（idle 状态）
  | "accelerate" // 加速运动（charging 状态）
  | "brake" // 急刹车减速（sequence 开始）
  | "implode" // 向中心吸入（sequence 阶段）
  | "explode"; // 从中心向外爆炸（flash/shockwave 阶段)

/** Phase 2 - 启动序列回调 */
export interface ChargeSequenceCallbacks {
  onSequenceComplete: () => void;
  /** flash 子阶段开始（Logo 内缩后） */
  onFlashStart?: () => void;
  /** flash 峰值（爆炸触发点） */
  onFlashPeak?: () => void;
  /** 0-1 充能进度 */
  onChargeProgress?: (progress: number) => void;
}
