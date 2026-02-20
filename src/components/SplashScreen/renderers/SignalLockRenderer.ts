import { SIGNAL_LOCK_CONFIG } from "@/config/splash";
import { SignalNoiseFilter } from "../filters/SignalNoiseFilter";
import type {
  FilterManagerInterface,
  SignalLockSubPhase,
  SplashCanvasContext,
  SplashRenderer,
} from "../types";
import { LogoRenderer } from "./LogoRenderer";
import { ParticleRenderer } from "./ParticleRenderer";
import { PulseRenderer } from "./PulseRenderer";

const TIMELINE = {
  SEARCH_START: SIGNAL_LOCK_CONFIG.timeline.searchStart,
  SEARCH_END: SIGNAL_LOCK_CONFIG.timeline.searchEnd,

  GLIMPSE_START: SIGNAL_LOCK_CONFIG.timeline.glimpseStart,
  FLASH_1: SIGNAL_LOCK_CONFIG.flashes[0].time,
  FLASH_2: SIGNAL_LOCK_CONFIG.flashes[1].time,
  FLASH_3: SIGNAL_LOCK_CONFIG.flashes[2].time,
  FLASH_4: SIGNAL_LOCK_CONFIG.flashes[3].time,
  FLASH_5: SIGNAL_LOCK_CONFIG.flashes[4].time,
  GLIMPSE_END: SIGNAL_LOCK_CONFIG.timeline.glimpseEnd,

  RADIAL_START: SIGNAL_LOCK_CONFIG.timeline.radialStart,
  RADIAL_END: SIGNAL_LOCK_CONFIG.timeline.radialEnd,

  CONFIRM_START: SIGNAL_LOCK_CONFIG.timeline.confirmStart,
  PULSE_TRIGGER: SIGNAL_LOCK_CONFIG.timeline.pulseTrigger,
  CONFIRM_END: SIGNAL_LOCK_CONFIG.timeline.confirmEnd,
} as const;

const CONFIRM_RGB_START_OFFSET = 7;
const CONFIRM_RGB_END_OFFSET = 1;
const CONFIRM_TEAR_START_OFFSET = 8;
const CONFIRM_TEAR_START_SLICES = 3;
const CONFIRM_NOISE_LAYER_FADE_DURATION = 120;
const CONFIRM_PULSE_OVERSCAN_MULTIPLIER = 1.08;

interface FlashScheduleItem {
  time: number;
  duration: number;
  rgbIntensity: number;
  jitter: number;
}

function easeInOutCubic(t: number): number {
  if (t < 0.5) {
    return 4 * t * t * t;
  }

  return 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export class SignalLockRenderer implements SplashRenderer {
  // 子渲染器（内部持有，不从外部传入）
  private _logo: LogoRenderer;
  private _pulse: PulseRenderer;

  // 滤镜（内部创建）
  private _noiseFilter: SignalNoiseFilter;

  // 外部依赖（init 时注入）
  private _filterManager: FilterManagerInterface | null = null;
  private _ctx: SplashCanvasContext | null = null;
  private _particle: ParticleRenderer | null = null;

  // 状态
  private _subPhase: SignalLockSubPhase = "search";
  private _elapsed = 0; // 总经过时间（ms）
  private _isComplete = false;
  private _onComplete: (() => void) | null = null;

  // 闪现调度
  private _flashSchedule: FlashScheduleItem[];
  private _flashTriggered: boolean[];

  private _radialInitialized = false;
  private _confirmInitialized = false;
  private _pulseTriggered = false;
  private _radialGlitchAccumulator = 0;
  private _dynamicMaxClearRadius = 1;
  private _confirmEffectsSettled = false;

  constructor() {
    this._logo = new LogoRenderer();
    this._pulse = new PulseRenderer();

    this._noiseFilter = new SignalNoiseFilter();

    this._flashSchedule = SIGNAL_LOCK_CONFIG.flashes.map((flash) => ({
      time: flash.time,
      duration: flash.duration,
      rgbIntensity: flash.rgbIntensity,
      jitter: flash.jitter,
    }));

    this._flashTriggered = this._flashSchedule.map(() => false);
  }

  /** 设置完成回调 */
  setOnComplete(callback: () => void): void {
    this._onComplete = callback;
  }

  /** 设置 FilterManager（外部注入） */
  setFilterManager(fm: FilterManagerInterface): void {
    this._filterManager = fm;
    this._filterManager.setCRTEnabled(true);
  }

  /** 注入共享粒子渲染器 */
  setParticleRenderer(particle: ParticleRenderer): void {
    this._particle = particle;
  }

  /** 暴露 LogoRenderer，供 Phase 2 导演器复用 */
  getLogoRenderer(): LogoRenderer {
    return this._logo;
  }

  init(ctx: SplashCanvasContext): void {
    if (this._ctx && this._ctx !== ctx) {
      this._detachNoiseFilter();
    }

    this._ctx = ctx;
    this._resetRuntimeState();

    this._logo.init(ctx);
    this._pulse.init(ctx);

    this._logo.setVisible(false);
    this._logo.setAlpha(0);
    this._logo.setJitter(0);

    const noiseConfig = SIGNAL_LOCK_CONFIG.noise;
    const [scanRingR, scanRingG, scanRingB] = noiseConfig.scanRingColor;

    this._noiseFilter.enabled = true;
    this._noiseFilter.time = 0;
    this._noiseFilter.intensity = noiseConfig.initialIntensity;
    this._noiseFilter.clearRadius = 0;
    this._noiseFilter.noiseScale = noiseConfig.noiseScale;
    this._noiseFilter.flickerSpeed = noiseConfig.flickerSpeed;
    this._noiseFilter.scanRingWidth = noiseConfig.scanRingWidth;
    this._noiseFilter.setScanRingColor(scanRingR, scanRingG, scanRingB);
    this._noiseFilter.setClearCenter(0.5, 0.5);

    this._dynamicMaxClearRadius = this._computeMaxClearRadius(
      ctx.screen.width,
      ctx.screen.height,
    );

    ctx.layers.noise.visible = true;
    ctx.layers.noise.alpha = 1;

    this._attachNoiseFilter();

    if (this._filterManager) {
      this._filterManager.setCRTEnabled(true);
      this._filterManager.reset();
    }
  }

  update(elapsed: number, delta: number): void {
    if (!this._ctx) return;

    const safeElapsed = Math.max(0, elapsed);
    const safeDelta = Math.max(0, delta);

    // 以外部计时为准
    this._elapsed = safeElapsed;

    // 每帧驱动噪声动画
    this._noiseFilter.time += safeDelta * 0.001;

    if (!this._isComplete) {
      this._subPhase = this._resolveSubPhase(this._elapsed);

      switch (this._subPhase) {
        case "search":
          this._updateSearch(this._elapsed, safeDelta);
          break;
        case "glimpse":
          this._updateGlimpse(this._elapsed, safeDelta);
          break;
        case "radialLock":
          this._updateRadialLock(this._elapsed, safeDelta);
          break;
        case "confirm":
          this._updateConfirm(this._elapsed, safeDelta);
          break;
      }
    }

    // 子渲染器每帧都更新
    this._logo.update(this._elapsed, safeDelta);
    this._pulse.update(this._elapsed, safeDelta);
  }

  resize(width: number, height: number): void {
    this._logo.resize(width, height);
    this._pulse.resize(width, height);

    this._noiseFilter.setClearCenter(0.5, 0.5);
    this._dynamicMaxClearRadius = this._computeMaxClearRadius(width, height);
  }

  destroy(): void {
    this._logo.destroy();
    this._pulse.destroy();

    this._detachNoiseFilter();
    this._noiseFilter.destroy();

    this._ctx = null;
    this._filterManager = null;
    this._particle = null;
    this._onComplete = null;
  }

  private _updateSearch(elapsed: number, delta: number): void {
    void delta;

    if (elapsed < TIMELINE.SEARCH_START || elapsed >= TIMELINE.SEARCH_END) {
      return;
    }

    this._noiseFilter.intensity = 1;
    this._noiseFilter.clearRadius = 0;
    this._noiseFilter.setClearCenter(0.5, 0.5);

    if (this._ctx) {
      this._ctx.layers.noise.visible = true;
      this._ctx.layers.noise.alpha = 1;
    }
  }

  private _updateGlimpse(elapsed: number, delta: number): void {
    void delta;

    if (elapsed < TIMELINE.GLIMPSE_START || elapsed >= TIMELINE.GLIMPSE_END) {
      this._logo.setJitter(0);
      return;
    }

    this._noiseFilter.enabled = true;
    this._noiseFilter.intensity = 1;
    this._noiseFilter.clearRadius = 0;
    this._noiseFilter.setClearCenter(0.5, 0.5);

    if (this._ctx) {
      this._ctx.layers.noise.visible = true;
      this._ctx.layers.noise.alpha = 1;
    }

    let activeFlashIndex = -1;
    for (let index = 0; index < this._flashSchedule.length; index += 1) {
      const flash = this._flashSchedule[index];
      if (elapsed >= flash.time && elapsed < flash.time + flash.duration) {
        activeFlashIndex = index;
        break;
      }
    }

    if (activeFlashIndex < 0) {
      this._logo.setJitter(0);
      return;
    }

    const flash = this._flashSchedule[activeFlashIndex];
    this._logo.setJitter(flash.jitter);

    if (this._flashTriggered[activeFlashIndex]) {
      return;
    }

    this._flashTriggered[activeFlashIndex] = true;
    this._logo.flash(flash.duration);

    this._filterManager?.triggerRGBSplit(flash.rgbIntensity);
    this._filterManager?.triggerTear(flash.rgbIntensity * 0.6);
  }

  private _updateRadialLock(elapsed: number, delta: number): void {
    if (elapsed < TIMELINE.RADIAL_START || elapsed >= TIMELINE.RADIAL_END) {
      return;
    }

    if (!this._radialInitialized) {
      this._logo.lockVisible();
      this._logo.setJitter(0);
      this._radialGlitchAccumulator = 0;
      this._radialInitialized = true;
    }

    const progress = clamp01(
      (elapsed - TIMELINE.RADIAL_START) /
        (TIMELINE.RADIAL_END - TIMELINE.RADIAL_START),
    );
    const eased = easeInOutCubic(progress);

    this._noiseFilter.intensity = 1;
    this._noiseFilter.clearRadius = eased * this._dynamicMaxClearRadius;
    this._noiseFilter.setClearCenter(0.5, 0.5);

    if (this._ctx) {
      this._ctx.layers.noise.visible = true;
      this._ctx.layers.noise.alpha = 1;
    }

    if (!this._filterManager) return;

    this._radialGlitchAccumulator += Math.max(0, delta);
    const intervalMs = 120 + progress * 360;

    if (this._radialGlitchAccumulator < intervalMs) {
      return;
    }

    this._radialGlitchAccumulator = 0;
    const intensity = (1 - progress) * 0.35;

    if (intensity <= 0.02) {
      this._filterManager.reset();
      return;
    }

    this._filterManager.triggerRGBSplit(intensity);
    this._filterManager.triggerTear(intensity * 0.5);
  }

  private _updateConfirm(elapsed: number, delta: number): void {
    void delta;

    if (elapsed < TIMELINE.CONFIRM_START) {
      return;
    }

    const ctx = this._ctx;
    if (!ctx) {
      return;
    }

    if (!this._confirmInitialized) {
      this._noiseFilter.enabled = true;
      this._noiseFilter.clearRadius = this._dynamicMaxClearRadius;
      this._noiseFilter.setClearCenter(0.5, 0.5);
      this._logo.lockVisible();
      this._logo.startIdleAnimation();
      this._logo.setJitter(0);
      this._confirmInitialized = true;
      this._confirmEffectsSettled = false;
    }

    const fadeDuration = Math.max(
      1,
      TIMELINE.PULSE_TRIGGER - TIMELINE.CONFIRM_START,
    );
    const fadeProgress = clamp01(
      (elapsed - TIMELINE.CONFIRM_START) / fadeDuration,
    );
    const easedFadeProgress = easeInOutCubic(fadeProgress);
    const noiseLayer = ctx.layers.noise;

    if (fadeProgress < 1) {
      this._noiseFilter.enabled = true;
      this._noiseFilter.intensity = 1 - easedFadeProgress;
      this._noiseFilter.clearRadius = this._dynamicMaxClearRadius;
      this._noiseFilter.setClearCenter(0.5, 0.5);

      const layerFadeProgress = clamp01(
        (elapsed - TIMELINE.CONFIRM_START) / CONFIRM_NOISE_LAYER_FADE_DURATION,
      );
      const layerAlpha = 1 - easeInOutCubic(layerFadeProgress);

      noiseLayer.alpha = layerAlpha;
      noiseLayer.visible = layerAlpha > 0.001;
    } else {
      this._noiseFilter.intensity = 0;
      this._noiseFilter.clearRadius = 0;
      this._noiseFilter.setClearCenter(0.5, 0.5);
      this._noiseFilter.enabled = false;

      noiseLayer.alpha = 0;
      noiseLayer.visible = false;
    }

    if (this._filterManager) {
      if (fadeProgress < 1) {
        const rgbOffset = this._lerp(
          CONFIRM_RGB_START_OFFSET,
          CONFIRM_RGB_END_OFFSET,
          easedFadeProgress,
        );
        const rgbJitter = this._lerp(1.5, 0, easedFadeProgress);
        const tearOffset = this._lerp(
          CONFIRM_TEAR_START_OFFSET,
          0,
          easedFadeProgress,
        );
        const tearSlices = this._lerp(
          CONFIRM_TEAR_START_SLICES,
          1,
          easedFadeProgress,
        );

        this._filterManager.triggerRGBSplitCustom(
          -rgbOffset,
          rgbOffset,
          rgbJitter,
          0,
          0,
        );
        this._filterManager.triggerTearCustom(tearOffset, tearSlices, 0);
      } else if (!this._confirmEffectsSettled) {
        this._filterManager.reset();
        this._confirmEffectsSettled = true;
      }
    }

    if (!this._pulseTriggered && elapsed >= TIMELINE.PULSE_TRIGGER) {
      const centerX = ctx.screen.width * 0.5;
      const centerY = ctx.screen.height * 0.5;
      const maxRadius =
        Math.hypot(ctx.screen.width, ctx.screen.height) *
        0.5 *
        CONFIRM_PULSE_OVERSCAN_MULTIPLIER;

      this._pulse.triggerPulse(centerX, centerY, maxRadius);

      if (this._particle) {
        const logoCenter = this._logo.getCenter();
        this._particle.setCenter(logoCenter.x, logoCenter.y);
        // 不再从中心迸发，保持星空自然漂移
        this._particle.setMode("drift");
      }

      this._pulseTriggered = true;
    }

    if (this._isComplete || elapsed < TIMELINE.CONFIRM_END) {
      return;
    }

    this._isComplete = true;
    this._onComplete?.();
  }

  private _resolveSubPhase(elapsed: number): SignalLockSubPhase {
    if (elapsed < TIMELINE.GLIMPSE_START) {
      return "search";
    }

    if (elapsed < TIMELINE.RADIAL_START) {
      return "glimpse";
    }

    if (elapsed < TIMELINE.CONFIRM_START) {
      return "radialLock";
    }

    return "confirm";
  }

  private _computeMaxClearRadius(width: number, height: number): number {
    const safeWidth = Math.max(1, width);
    const safeHeight = Math.max(1, height);
    const halfDiagonal = Math.hypot(safeWidth, safeHeight) * 0.5;
    const minDimension = Math.max(1, Math.min(safeWidth, safeHeight));

    const baseRadius = halfDiagonal / minDimension;
    const ringGlowMargin =
      Math.max(0, SIGNAL_LOCK_CONFIG.noise.scanRingWidth) * 4;
    const transitionMargin = 3 / minDimension;
    const overscanMultiplier = 1.08;

    return (
      (baseRadius + ringGlowMargin + transitionMargin) * overscanMultiplier
    );
  }

  private _lerp(from: number, to: number, t: number): number {
    const progress = clamp01(t);
    return from + (to - from) * progress;
  }

  private _attachNoiseFilter(): void {
    if (!this._ctx) return;

    const noiseLayer = this._ctx.layers.noise;
    const existing = noiseLayer.filters ?? [];
    if (existing.includes(this._noiseFilter)) {
      return;
    }

    noiseLayer.filters = [this._noiseFilter, ...existing];
  }

  private _detachNoiseFilter(): void {
    if (!this._ctx) return;

    const noiseLayer = this._ctx.layers.noise;
    const current = noiseLayer.filters ?? [];
    const next = current.filter((filter) => filter !== this._noiseFilter);

    noiseLayer.filters = next.length > 0 ? next : null;
  }

  private _resetRuntimeState(): void {
    this._subPhase = "search";
    this._elapsed = 0;
    this._isComplete = false;

    this._radialInitialized = false;
    this._confirmInitialized = false;
    this._pulseTriggered = false;
    this._radialGlitchAccumulator = 0;
    this._confirmEffectsSettled = false;
    this._flashTriggered = this._flashSchedule.map(() => false);
  }
}
