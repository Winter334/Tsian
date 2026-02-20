import { CHARGE_SEQUENCE_CONFIG } from "@/config/splash";
import type {
  ChargeSequenceCallbacks,
  ChargeSubPhase,
  FilterManagerInterface,
  SplashCanvasContext,
  SplashRenderer,
} from "../types";
import { EnergyRingRenderer } from "./EnergyRingRenderer";
import { ExplosionRenderer } from "./ExplosionRenderer";
import { LightningRenderer } from "./LightningRenderer";
import { LogoRenderer } from "./LogoRenderer";
import { ParticleRenderer } from "./ParticleRenderer";

const CHARGE_HOLD_THRESHOLD_MS = Math.max(
  1,
  CHARGE_SEQUENCE_CONFIG.charge.holdThreshold,
);

const CHARGING_LIGHTNING_MIN_INTENSITY = 0.12;
const CHARGING_LIGHTNING_MAX_INTENSITY = 1;

const CHARGING_RGB_MIN_OFFSET = 1.2;
const CHARGING_RGB_MAX_OFFSET = 4.2;
const CHARGING_RGB_MIN_JITTER = 0.12;
const CHARGING_RGB_MAX_JITTER = 0.45;

const SEQUENCE_LIGHTNING_BURST_COUNT = 12;
const PEAK_LIGHTNING_BURST_COUNT = 18;

const FLASH_RGB_OFFSET = 14;
const FLASH_RGB_JITTER = 1.8;
const FLASH_TEAR_OFFSET = 12;
const FLASH_TEAR_SLICES = 7;

const SHOCKWAVE_RGB_OFFSET = 8;
const SHOCKWAVE_RGB_JITTER = 1.1;

const FLASH_PEAK_RATIO = 0.38;
const LOGO_SHRINK_LEAD_RATIO = 0.65;
const LOGO_SHRINK_MIN_LEAD_MS = 80;

const BASE_WARP_FACTOR = 0.5;
const MAX_WARP_FACTOR = 28;
const IDLE_WARP_FACTOR = 0;

const SEQUENCE_TIMELINE = (() => {
  const brakeEnd = Math.max(0, CHARGE_SEQUENCE_CONFIG.sequence.brakeDuration);
  const implodeDuration = Math.max(
    0,
    CHARGE_SEQUENCE_CONFIG.sequence.implodeDuration,
  );
  const implodeStart = brakeEnd;
  const implodeEnd = implodeStart + implodeDuration;

  const logoShrinkDuration = Math.max(
    1,
    CHARGE_SEQUENCE_CONFIG.sequence.logoShrinkDuration,
  );
  const logoShrinkLeadMs = Math.min(
    implodeDuration * 0.5,
    Math.max(
      LOGO_SHRINK_MIN_LEAD_MS,
      logoShrinkDuration * LOGO_SHRINK_LEAD_RATIO,
    ),
  );
  const logoShrinkStart = Math.max(implodeStart, implodeEnd - logoShrinkLeadMs);
  const logoShrinkEnd = logoShrinkStart + logoShrinkDuration;

  const flashDelay = Math.max(0, CHARGE_SEQUENCE_CONFIG.sequence.flashDelay);
  const flashDuration = Math.max(
    1,
    CHARGE_SEQUENCE_CONFIG.sequence.flashDuration,
  );
  const flashStart = Math.max(
    implodeEnd + flashDelay,
    logoShrinkEnd - logoShrinkDuration * 0.35 + flashDelay,
  );
  const flashPeak = flashStart + flashDuration * FLASH_PEAK_RATIO;

  const shockwaveEnd =
    flashPeak + Math.max(1, CHARGE_SEQUENCE_CONFIG.sequence.shockwaveDuration);
  const fadeoutEnd =
    shockwaveEnd + Math.max(1, CHARGE_SEQUENCE_CONFIG.sequence.fadeoutDuration);

  return {
    brakeEnd,
    implodeStart,
    implodeEnd,
    logoShrinkStart,
    logoShrinkEnd,
    flashStart,
    flashPeak,
    shockwaveEnd,
    fadeoutEnd,
  };
})();

const SPLASH_DEBUG_ENABLED =
  typeof window !== "undefined" &&
  import.meta.env.DEV &&
  new URLSearchParams(window.location.search).has("splashDebug");

function debugLog(message: string, payload?: Record<string, unknown>): void {
  if (!SPLASH_DEBUG_ENABLED) return;

  if (payload) {
    console.debug(`[SplashDebug][ChargeSequenceRenderer] ${message}`, payload);
    return;
  }

  console.debug(`[SplashDebug][ChargeSequenceRenderer] ${message}`);
}

interface ChargeSequenceRuntimeCallbacks extends ChargeSequenceCallbacks {
  onFlashStart?: () => void;
  onFlashPeak?: () => void;
}

export class ChargeSequenceRenderer implements SplashRenderer {
  private _particle: ParticleRenderer | null = null;
  private _energyRing: EnergyRingRenderer | null = null;
  private _lightning = new LightningRenderer();
  private _explosion = new ExplosionRenderer();

  private _ctx: SplashCanvasContext | null = null;
  private _logo: LogoRenderer | null = null;
  private _filterManager: FilterManagerInterface | null = null;
  private _callbacks: ChargeSequenceRuntimeCallbacks | null = null;

  private _elapsed = 0;
  private _chargeStartTime = 0;
  private _sequenceStartTime = 0;

  private _subPhase: ChargeSubPhase = "holding";

  private _isCharging = false;
  private _isSequencing = false;
  private _primed = false;
  private _chargeProgress = 0;

  private _burstTriggered = false;
  private _implodeModeActivated = false;
  private _logoShrinkTriggered = false;
  private _flashStarted = false;
  private _flashPeakTriggered = false;
  private _fadeoutSettled = false;
  private _sequenceCompleteNotified = false;
  private _debugLastSubPhase: ChargeSubPhase | null = null;

  init(ctx: SplashCanvasContext): void {
    if (this._ctx && this._ctx !== ctx) {
      this._lightning.destroy();
      this._explosion.destroy();
    }

    this._ctx = ctx;

    const lightningContext = this._withContentLayer(ctx, ctx.layers.ui);

    this._lightning.init(lightningContext);
    this._explosion.init(ctx);

    this._resetRuntimeState();
    this._syncCenters();

    this._lightning.setActive(false);
    this._lightning.setIntensity(0);

    this._energyRing?.setChargeProgress(0);
    this._energyRing?.hide();

    this._logo?.setCharging(false);
    this._logo?.setChargeProgress(0);
    this._logo?.setSequenceMode(false);
    this._filterManager?.setSubtleRGB(false);
  }

  update(elapsed: number, delta: number): void {
    const safeElapsed = Math.max(0, elapsed);
    const safeDelta = Math.max(0, delta);

    this._elapsed = safeElapsed;
    this._syncCenters();

    if (this._isCharging) {
      this._updateCharging(safeElapsed);
    }

    if (this._isSequencing) {
      this._updateSequence(safeElapsed);
    }

    this._lightning.update(safeElapsed, safeDelta);
    this._explosion.update(safeElapsed, safeDelta);
  }

  resize(width: number, height: number): void {
    this._lightning.resize(width, height);
    this._explosion.resize(width, height);
    this._syncCenters();
  }

  destroy(): void {
    this._lightning.destroy();
    this._explosion.destroy();

    this._logo?.setCharging(false);
    this._logo?.setChargeProgress(0);
    this._logo?.setSequenceMode(false);
    this._energyRing?.hide();

    if (this._filterManager) {
      this._filterManager.setSubtleRGB(false);
      this._filterManager.reset();
    }

    this._ctx = null;
    this._logo = null;
    this._filterManager = null;
    this._callbacks = null;
    this._particle = null;
    this._energyRing = null;

    this._resetRuntimeState();
  }

  setLogoRenderer(logo: LogoRenderer): void {
    this._logo = logo;
    this._logo.setCharging(this._isCharging);
    this._logo.setChargeProgress(this._chargeProgress);
    this._logo.setSequenceMode(this._isSequencing);
    this._syncCenters();
  }

  setFilterManager(fm: FilterManagerInterface): void {
    this._filterManager = fm;

    if (this._isCharging) {
      this._filterManager.setSubtleRGB(true);
      return;
    }

    this._filterManager.setSubtleRGB(false);
  }

  setCallbacks(callbacks: ChargeSequenceCallbacks): void {
    this._callbacks = callbacks as ChargeSequenceRuntimeCallbacks;
  }

  setParticleRenderer(particle: ParticleRenderer): void {
    this._particle = particle;
    this._syncCenters();
  }

  setEnergyRingRenderer(energyRing: EnergyRingRenderer): void {
    this._energyRing = energyRing;
    this._energyRing.setChargeProgress(this._chargeProgress);

    if (!this._isCharging && !this._isSequencing) {
      this._energyRing.hide();
    }
  }

  enterCharging(): void {
    if (this._isSequencing) {
      return;
    }

    this._isCharging = true;
    this._primed = false;
    this._chargeProgress = 0;
    this._chargeStartTime = this._elapsed;
    this._subPhase = "holding";

    this._particle?.setMode("accelerate");
    this._particle?.setWarpFactor(BASE_WARP_FACTOR);
    this._lightning.setActive(true);
    this._lightning.setIntensity(CHARGING_LIGHTNING_MIN_INTENSITY);

    this._logo?.setCharging(true);
    this._logo?.setChargeProgress(0);
    this._logo?.setSequenceMode(false);

    this._energyRing?.fadeIn(300);
    this._energyRing?.setChargeProgress(0);

    this._callbacks?.onChargeProgress?.(0);

    this._filterManager?.setSubtleRGB(true);
    this._filterManager?.triggerRGBSplitCustom(
      -CHARGING_RGB_MIN_OFFSET,
      CHARGING_RGB_MIN_OFFSET,
      CHARGING_RGB_MIN_JITTER,
      0,
      0,
    );

    debugLog("enterCharging", {
      elapsedMs: Math.round(this._elapsed),
      holdThresholdMs: CHARGE_HOLD_THRESHOLD_MS,
    });
  }

  cancelCharging(): void {
    this._isCharging = false;
    this._primed = false;
    this._chargeProgress = 0;
    this._chargeStartTime = 0;
    this._subPhase = "holding";

    this._particle?.setMode("drift");
    this._particle?.setWarpFactor(BASE_WARP_FACTOR);
    this._lightning.setActive(false);
    this._lightning.setIntensity(0);
    this._lightning.clearBolts();

    this._logo?.setCharging(false);
    this._logo?.setChargeProgress(0);
    this._logo?.setSequenceMode(false);

    this._energyRing?.hide();

    this._callbacks?.onChargeProgress?.(0);

    if (this._filterManager) {
      this._filterManager.setSubtleRGB(false);
      this._filterManager.reset();
    }

    debugLog("cancelCharging", {
      elapsedMs: Math.round(this._elapsed),
    });
  }

  enterSequence(): void {
    if (!this._isCharging && !this._primed) {
      this.cancelCharging();
      return;
    }

    if (!this._primed) {
      this._primed = true;
      this._chargeProgress = 1;
      this._callbacks?.onChargeProgress?.(1);
    }

    this._isCharging = false;
    this._isSequencing = true;
    this._sequenceStartTime = this._elapsed;
    this._subPhase = "brake";

    this._resetSequenceRuntimeFlags();

    const center = this._resolveCenter();
    this._particle?.setCenter(center.x, center.y);
    this._particle?.setMode("brake");
    this._particle?.setWarpFactor(BASE_WARP_FACTOR);
    this._lightning.setActive(true);
    this._lightning.setIntensity(CHARGING_LIGHTNING_MAX_INTENSITY);
    this._lightning.triggerBurst(SEQUENCE_LIGHTNING_BURST_COUNT);
    this._burstTriggered = true;

    this._logo?.setCharging(false);
    this._logo?.setChargeProgress(1);
    this._logo?.setSequenceMode(true);

    this._energyRing?.setChargeProgress(1);

    this._filterManager?.setSubtleRGB(false);
    this._filterManager?.triggerRGBSplit(0.8);
    this._filterManager?.triggerTear(0.65);

    debugLog("enterSequence", {
      sequenceStartMs: Math.round(this._sequenceStartTime),
      timeline: {
        brakeEnd: SEQUENCE_TIMELINE.brakeEnd,
        implodeStart: SEQUENCE_TIMELINE.implodeStart,
        implodeEnd: SEQUENCE_TIMELINE.implodeEnd,
        logoShrinkStart: SEQUENCE_TIMELINE.logoShrinkStart,
        logoShrinkEnd: SEQUENCE_TIMELINE.logoShrinkEnd,
        flashStart: SEQUENCE_TIMELINE.flashStart,
        flashPeak: SEQUENCE_TIMELINE.flashPeak,
        shockwaveEnd: SEQUENCE_TIMELINE.shockwaveEnd,
        fadeoutEnd: SEQUENCE_TIMELINE.fadeoutEnd,
      },
    });
  }

  getChargeProgress(): number {
    return this._chargeProgress;
  }

  isPrimed(): boolean {
    return this._primed;
  }

  /** 返回当前 stage 抖动强度（0 = 无抖动，1 = 最大抖动） */
  getStageShakeIntensity(): number {
    if (!this._isSequencing) {
      return 0;
    }

    const elapsed = Math.max(0, this._elapsed - this._sequenceStartTime);
    const implodeStart = SEQUENCE_TIMELINE.implodeStart;
    const implodeEnd = SEQUENCE_TIMELINE.implodeEnd;
    const implodeMid = implodeStart + (implodeEnd - implodeStart) * 0.5;
    const flashEnd = SEQUENCE_TIMELINE.flashPeak;

    if (elapsed < implodeMid || elapsed >= flashEnd) {
      return 0;
    }

    if (elapsed < implodeEnd) {
      const duration = Math.max(1, implodeEnd - implodeMid);
      return this._clamp01((elapsed - implodeMid) / duration);
    }

    const duration = Math.max(1, flashEnd - implodeEnd);
    return this._clamp01(1 - (elapsed - implodeEnd) / duration);
  }

  private _updateCharging(elapsed: number): void {
    const progress = this._clamp01(
      (elapsed - this._chargeStartTime) / CHARGE_HOLD_THRESHOLD_MS,
    );

    this._chargeProgress = progress;
    this._subPhase = progress >= 1 ? "primed" : "holding";

    if (progress >= 1) {
      this._primed = true;
    }

    this._lightning.setIntensity(
      this._lerp(
        CHARGING_LIGHTNING_MIN_INTENSITY,
        CHARGING_LIGHTNING_MAX_INTENSITY,
        progress,
      ),
    );

    this._logo?.setChargeProgress(progress);
    this._energyRing?.setChargeProgress(progress);
    this._callbacks?.onChargeProgress?.(progress);
    this._particle?.setWarpFactor(
      this._lerp(BASE_WARP_FACTOR, MAX_WARP_FACTOR, progress),
    );

    const rgbOffset = this._lerp(
      CHARGING_RGB_MIN_OFFSET,
      CHARGING_RGB_MAX_OFFSET,
      progress,
    );
    const rgbJitter = this._lerp(
      CHARGING_RGB_MIN_JITTER,
      CHARGING_RGB_MAX_JITTER,
      progress,
    );

    this._filterManager?.triggerRGBSplitCustom(
      -rgbOffset,
      rgbOffset,
      rgbJitter,
      0,
      0,
    );
  }

  private _updateSequence(elapsed: number): void {
    const sequenceElapsed = Math.max(0, elapsed - this._sequenceStartTime);

    this._subPhase = this._resolveSequenceSubPhase(sequenceElapsed);

    if (this._subPhase !== this._debugLastSubPhase) {
      debugLog("sequence sub-phase changed", {
        from: this._debugLastSubPhase ?? "none",
        to: this._subPhase,
        sequenceElapsedMs: Math.round(sequenceElapsed),
      });
      this._debugLastSubPhase = this._subPhase;
    }

    switch (this._subPhase) {
      case "brake":
        this._handleBrakePhase(sequenceElapsed);
        break;
      case "implode":
        this._handleImplodePhase(sequenceElapsed);
        break;
      case "flash":
        this._handleFlashPhase(sequenceElapsed);
        break;
      case "shockwave":
        this._handleShockwavePhase(sequenceElapsed);
        break;
      case "fadeout":
        this._handleFadeoutPhase(sequenceElapsed);
        break;
      case "holding":
      case "primed":
        break;
    }

    if (
      sequenceElapsed >= SEQUENCE_TIMELINE.fadeoutEnd &&
      !this._sequenceCompleteNotified
    ) {
      this._sequenceCompleteNotified = true;
      this._isSequencing = false;
      this._primed = false;
      this._chargeProgress = 0;

      this._lightning.setActive(false);
      this._lightning.setIntensity(0);
      this._lightning.clearBolts();

      this._logo?.setCharging(false);
      this._logo?.setChargeProgress(0);
      this._logo?.setSequenceMode(false);
      this._logo?.hideInstantly();
      this._energyRing?.hide();
      this._particle?.setWarpFactor(IDLE_WARP_FACTOR);

      debugLog("sequence complete", {
        sequenceElapsedMs: Math.round(sequenceElapsed),
      });

      this._callbacks?.onChargeProgress?.(0);
      this._callbacks?.onSequenceComplete();
    }
  }

  private _handleBrakePhase(_sequenceElapsed: number): void {
    if (!this._burstTriggered) {
      this._lightning.triggerBurst(SEQUENCE_LIGHTNING_BURST_COUNT);
      this._burstTriggered = true;
    }
  }

  private _handleImplodePhase(sequenceElapsed: number): void {
    if (!this._implodeModeActivated) {
      const center = this._resolveCenter();
      this._particle?.setCenter(center.x, center.y);
      this._particle?.setMode("implode");
      this._particle?.setWarpFactor(IDLE_WARP_FACTOR);
      this._energyRing?.startImplode(
        CHARGE_SEQUENCE_CONFIG.sequence.implodeDuration,
      );
      this._implodeModeActivated = true;
    }

    if (!this._burstTriggered) {
      this._lightning.triggerBurst(SEQUENCE_LIGHTNING_BURST_COUNT);
      this._burstTriggered = true;
    }

    if (
      sequenceElapsed >= SEQUENCE_TIMELINE.logoShrinkStart &&
      !this._logoShrinkTriggered
    ) {
      this._logoShrinkTriggered = true;
      this._logo?.shrink(CHARGE_SEQUENCE_CONFIG.sequence.logoShrinkDuration);
    }
  }

  private _handleFlashPhase(sequenceElapsed: number): void {
    this._handleImplodePhase(sequenceElapsed);

    if (!this._flashStarted) {
      this._flashStarted = true;
      this._callbacks?.onFlashStart?.();
      this._energyRing?.hide();

      debugLog("flash phase started", {
        sequenceElapsedMs: Math.round(sequenceElapsed),
      });

      this._filterManager?.triggerRGBSplitCustom(
        -FLASH_RGB_OFFSET,
        FLASH_RGB_OFFSET,
        FLASH_RGB_JITTER,
        0,
        0,
      );
      this._filterManager?.triggerTearCustom(
        FLASH_TEAR_OFFSET,
        FLASH_TEAR_SLICES,
        0,
      );
    }

    if (
      sequenceElapsed >= SEQUENCE_TIMELINE.flashPeak &&
      !this._flashPeakTriggered
    ) {
      this._flashPeakTriggered = true;
      this._callbacks?.onFlashPeak?.();

      const center = this._resolveCenter();
      this._particle?.setCenter(center.x, center.y);

      debugLog("flash peak", {
        sequenceElapsedMs: Math.round(sequenceElapsed),
        centerX: Number(center.x.toFixed(2)),
        centerY: Number(center.y.toFixed(2)),
      });

      this._explosion.trigger(center.x, center.y);
      this._particle?.setMode("explode");
      this._particle?.setWarpFactor(IDLE_WARP_FACTOR);
      this._logo?.hideInstantly();
      this._lightning.triggerBurst(PEAK_LIGHTNING_BURST_COUNT);
    }
  }

  private _handleShockwavePhase(sequenceElapsed: number): void {
    this._handleFlashPhase(sequenceElapsed);

    const progress = this._clamp01(
      (sequenceElapsed - SEQUENCE_TIMELINE.flashPeak) /
        Math.max(1, CHARGE_SEQUENCE_CONFIG.sequence.shockwaveDuration),
    );

    this._lightning.setIntensity(this._lerp(0.9, 0.35, progress));

    const rgbOffset = this._lerp(
      FLASH_RGB_OFFSET,
      SHOCKWAVE_RGB_OFFSET,
      progress,
    );
    const rgbJitter = this._lerp(
      FLASH_RGB_JITTER,
      SHOCKWAVE_RGB_JITTER,
      progress,
    );

    this._filterManager?.triggerRGBSplitCustom(
      -rgbOffset,
      rgbOffset,
      rgbJitter,
      0,
      0,
    );
  }

  private _handleFadeoutPhase(sequenceElapsed: number): void {
    const fadeProgress = this._clamp01(
      (sequenceElapsed - SEQUENCE_TIMELINE.shockwaveEnd) /
        Math.max(1, CHARGE_SEQUENCE_CONFIG.sequence.fadeoutDuration),
    );

    this._lightning.setIntensity(this._lerp(0.3, 0, fadeProgress));

    if (fadeProgress >= 0.2) {
      this._lightning.setActive(false);
    }

    if (!this._fadeoutSettled && fadeProgress >= 1) {
      this._fadeoutSettled = true;
      this._filterManager?.reset();
    }
  }

  private _resolveSequenceSubPhase(sequenceElapsed: number): ChargeSubPhase {
    if (sequenceElapsed < SEQUENCE_TIMELINE.brakeEnd) {
      return "brake";
    }

    if (sequenceElapsed < SEQUENCE_TIMELINE.flashStart) {
      return "implode";
    }

    if (sequenceElapsed < SEQUENCE_TIMELINE.flashPeak) {
      return "flash";
    }

    if (sequenceElapsed < SEQUENCE_TIMELINE.shockwaveEnd) {
      return "shockwave";
    }

    return "fadeout";
  }

  private _syncCenters(): void {
    const center = this._resolveCenter();
    this._particle?.setCenter(center.x, center.y);
    this._lightning.setCenter(center.x, center.y);
  }

  private _resolveCenter(): { x: number; y: number } {
    if (this._logo) {
      return this._logo.getCenter();
    }

    if (this._ctx) {
      return {
        x: this._ctx.screen.width * 0.5,
        y: this._ctx.screen.height * 0.5,
      };
    }

    return { x: 0, y: 0 };
  }

  private _withContentLayer(
    ctx: SplashCanvasContext,
    content: SplashCanvasContext["layers"]["content"],
  ): SplashCanvasContext {
    return {
      ...ctx,
      layers: {
        ...ctx.layers,
        content,
      },
    };
  }

  private _resetRuntimeState(): void {
    this._elapsed = 0;
    this._chargeStartTime = 0;
    this._sequenceStartTime = 0;

    this._subPhase = "holding";
    this._isCharging = false;
    this._isSequencing = false;
    this._primed = false;
    this._chargeProgress = 0;
    this._debugLastSubPhase = null;

    this._resetSequenceRuntimeFlags();
  }

  private _resetSequenceRuntimeFlags(): void {
    this._burstTriggered = false;
    this._implodeModeActivated = false;
    this._logoShrinkTriggered = false;
    this._flashStarted = false;
    this._flashPeakTriggered = false;
    this._fadeoutSettled = false;
    this._sequenceCompleteNotified = false;
  }

  private _lerp(from: number, to: number, t: number): number {
    const progress = this._clamp01(t);
    return from + (to - from) * progress;
  }

  private _clamp01(value: number): number {
    return Math.max(0, Math.min(1, value));
  }
}
