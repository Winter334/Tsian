import { Container, Graphics } from "@/lib/pixi";
import type { SplashCanvasContext, SplashRenderer } from "../types";

const LOGO_SIZE_RATIO = 0.2;
const LOGO_REFERENCE_SIZE = 80;
const FRAME_DURATION_MS = 1000 / 60;

const FRAME_SIZE = 56;
const FRAME_HALF_SIZE = FRAME_SIZE / 2;

const OUTER_FRAME_COLOR = 0x00b8a3;
const INNER_FRAME_COLOR = 0x00d4ff;
const CROSSHAIR_COLOR = 0x00c4b4;
const RIFT_GLOW_COLOR = 0x00d4ff;
const RIFT_GRADIENT_OUTER_COLOR = 0x00a8cc;
const RIFT_GRADIENT_MID_COLOR = 0x00e5cc;
const RIFT_GRADIENT_CORE_COLOR = 0x5ee5ff;
const RIFT_INNER_LINE_COLOR = 0xffffff;
const SINGULARITY_COLOR = 0xffffff;

const OUTER_FRAME_BASE_ALPHA = 0.62;
const INNER_FRAME_BASE_ALPHA = 0.5;
const CROSSHAIR_BASE_ALPHA = 0.3;
const RIFT_GLOW_BASE_ALPHA = 0.2;
const RIFT_GRADIENT_OUTER_BASE_ALPHA = 0.32;
const RIFT_GRADIENT_MID_BASE_ALPHA = 0.52;
const RIFT_GRADIENT_CORE_BASE_ALPHA = 0.82;
const RIFT_INNER_LINE_BASE_ALPHA = 0.75;
const SINGULARITY_BASE_ALPHA = 0.9;

const OUTER_FRAME_LINE_WIDTH = 1;
const INNER_FRAME_LINE_WIDTH = 1;
const CROSSHAIR_LINE_WIDTH = 1;
const RIFT_GLOW_LINE_WIDTH = 7;
const RIFT_INNER_LINE_WIDTH = 1;

const OUTER_FRAME_BASE_ROTATION = Math.PI / 4;
const INNER_FRAME_BASE_ROTATION = Math.PI / 8;
const SINGULARITY_BASE_ROTATION = Math.PI / 4;

const OUTER_FRAME_ROTATION_SPEED = -0.003;
const INNER_FRAME_ROTATION_SPEED = 0.005;
const SINGULARITY_ROTATION_SPEED = 0.02;

const CHARGE_ROTATION_SPEED_MULTIPLIER = 11;
const SEQUENCE_ROTATION_SPEED_MULTIPLIER = 34;
const CHARGE_FLICKER_SPEED_MULTIPLIER = 2.1;
const CHARGE_LAYER_ALPHA_BOOST = 0.16;

const CHARGE_JITTER_MIN = 0.5;
const CHARGE_JITTER_MAX = 3;
const CHARGE_FLICKER_MIN = 0.85;
const CHARGE_FLICKER_MAX = 1;
const CHARGE_FLICKER_SPEED = 15;

const SHRINK_TARGET_SCALE = 0;

const SPLASH_DEBUG_ENABLED =
  typeof window !== "undefined" &&
  import.meta.env.DEV &&
  new URLSearchParams(window.location.search).has("splashDebug");

function debugLog(message: string, payload?: Record<string, unknown>): void {
  if (!SPLASH_DEBUG_ENABLED) return;

  if (payload) {
    console.debug(`[SplashDebug][LogoRenderer] ${message}`, payload);
    return;
  }

  console.debug(`[SplashDebug][LogoRenderer] ${message}`);
}

const RIFT_POLYGON: number[] = [
  0, -40, 8, -8, 40, 0, 8, 8, 0, 40, -8, 8, -40, 0, -8, -8,
];

const RIFT_INNER_POLYGON: number[] = [
  0, -32, 5, -5, 32, 0, 5, 5, 0, 32, -5, 5, -32, 0, -5, -5,
];

export class LogoRenderer implements SplashRenderer {
  private logoContainer: Container | null = null;

  private outerFrame: Graphics | null = null;
  private innerFrame: Graphics | null = null;
  private crosshair: Graphics | null = null;
  private riftGlow: Graphics | null = null;
  private riftBodyOuter: Graphics | null = null;
  private riftBodyMid: Graphics | null = null;
  private riftBodyCore: Graphics | null = null;
  private riftInnerLine: Graphics | null = null;
  private singularity: Graphics | null = null;

  private screenWidth = 0;
  private screenHeight = 0;
  private basePosition: { x: number; y: number } = { x: 0, y: 0 };

  private visible = false;
  private baseAlpha = 0;
  private jitterMax = 0;

  private flashDuration = 0;
  private flashTimer = 0;
  private lockedVisible = false;
  private baseScale = 1;

  private idleAnimationEnabled = false;
  private idleTimeSeconds = 0;

  private chargingActive = false;
  private chargeProgress = 0;
  private chargeTimeSeconds = 0;
  private isInSequence = false;

  private manualScale = 1;
  private currentScale = 1;

  private shrinkActive = false;
  private shrinkDurationMs = 0;
  private shrinkElapsedMs = 0;
  private shrinkFromScale = 1;
  private shrinkToScale = SHRINK_TARGET_SCALE;
  private shrinkScaleOverride: number | null = null;
  private shrinkOverrideAlpha: number | null = null;
  private shrinkFromAlpha = 0;

  private debugLastShrinkBucket = -1;
  private debugLockedVisualLogged = false;

  init(ctx: SplashCanvasContext): void {
    if (this.logoContainer) {
      this.destroy();
    }

    this.screenWidth = Math.max(1, ctx.screen.width);
    this.screenHeight = Math.max(1, ctx.screen.height);

    this.basePosition = {
      x: this.screenWidth * 0.5,
      y: this.screenHeight * 0.5,
    };

    const logoContainer = new Container();
    const outerFrame = new Graphics();
    const innerFrame = new Graphics();
    const crosshair = new Graphics();
    const riftGlow = new Graphics();
    const riftBodyOuter = new Graphics();
    const riftBodyMid = new Graphics();
    const riftBodyCore = new Graphics();
    const riftInnerLine = new Graphics();
    const singularity = new Graphics();

    logoContainer.addChild(outerFrame);
    logoContainer.addChild(innerFrame);
    logoContainer.addChild(crosshair);
    logoContainer.addChild(riftGlow);
    logoContainer.addChild(riftBodyOuter);
    logoContainer.addChild(riftBodyMid);
    logoContainer.addChild(riftBodyCore);
    logoContainer.addChild(riftInnerLine);
    logoContainer.addChild(singularity);

    logoContainer.alpha = 0;
    logoContainer.visible = false;

    this.logoContainer = logoContainer;
    this.outerFrame = outerFrame;
    this.innerFrame = innerFrame;
    this.crosshair = crosshair;
    this.riftGlow = riftGlow;
    this.riftBodyOuter = riftBodyOuter;
    this.riftBodyMid = riftBodyMid;
    this.riftBodyCore = riftBodyCore;
    this.riftInnerLine = riftInnerLine;
    this.singularity = singularity;

    this.drawStaticLayers();
    this.applyIdleLayerDefaults();

    this.flashDuration = 0;
    this.flashTimer = 0;
    this.lockedVisible = false;
    this.idleAnimationEnabled = false;
    this.idleTimeSeconds = 0;

    this.chargingActive = false;
    this.chargeProgress = 0;
    this.chargeTimeSeconds = 0;
    this.isInSequence = false;

    this.manualScale = 1;
    this.currentScale = 1;
    this.shrinkActive = false;
    this.shrinkDurationMs = 0;
    this.shrinkElapsedMs = 0;
    this.shrinkFromScale = 1;
    this.shrinkToScale = SHRINK_TARGET_SCALE;
    this.shrinkScaleOverride = null;
    this.shrinkOverrideAlpha = null;
    this.shrinkFromAlpha = 0;
    this.debugLastShrinkBucket = -1;
    this.debugLockedVisualLogged = false;

    ctx.layers.content.addChild(logoContainer);

    this.applyLayout();
    this.applyPositionWithJitter();
  }

  update(elapsed: number, delta: number): void {
    void elapsed;
    if (!this.logoContainer) return;

    const deltaMs = this.resolveDeltaMs(delta);
    this.advanceRuntime(deltaMs);

    if (this.lockedVisible) {
      this.applyLockedVisual(deltaMs);
      return;
    }

    if (this.flashTimer > 0) {
      this.flashTimer = Math.max(0, this.flashTimer - deltaMs);

      const progress = 1 - this.flashTimer / Math.max(1, this.flashDuration);
      const flashAlpha = progress <= 0.5 ? progress * 2 : (1 - progress) * 2;

      this.logoContainer.visible = true;
      this.logoContainer.alpha = this.clamp(flashAlpha, 0, 1);
      this.applyContainerScale();
      this.applyPositionWithJitter();

      if (this.flashTimer === 0) {
        this.logoContainer.alpha = this.resolveContainerAlpha(this.baseAlpha);
        this.logoContainer.visible = this.visible || this.baseAlpha > 0;
        this.applyContainerScale();
        this.applyPositionWithJitter();
      }
      return;
    }

    this.logoContainer.alpha = this.resolveContainerAlpha(this.baseAlpha);
    this.logoContainer.visible = this.visible || this.baseAlpha > 0;
    this.applyContainerScale();
    this.applyPositionWithJitter();

    if (this.idleAnimationEnabled && this.logoContainer.visible) {
      this.updateIdleAnimation(deltaMs);
    }
  }

  resize(width: number, height: number): void {
    this.screenWidth = Math.max(1, width);
    this.screenHeight = Math.max(1, height);
    this.basePosition = {
      x: this.screenWidth * 0.5,
      y: this.screenHeight * 0.5,
    };
    this.applyLayout();
    this.applyPositionWithJitter();
  }

  destroy(): void {
    if (this.logoContainer) {
      this.logoContainer.removeFromParent();
      this.logoContainer.destroy({ children: true });
      this.logoContainer = null;
    }

    this.outerFrame = null;
    this.innerFrame = null;
    this.crosshair = null;
    this.riftGlow = null;
    this.riftBodyOuter = null;
    this.riftBodyMid = null;
    this.riftBodyCore = null;
    this.riftInnerLine = null;
    this.singularity = null;

    this.flashDuration = 0;
    this.flashTimer = 0;
    this.lockedVisible = false;
    this.baseScale = 1;
    this.idleAnimationEnabled = false;
    this.idleTimeSeconds = 0;

    this.chargingActive = false;
    this.chargeProgress = 0;
    this.chargeTimeSeconds = 0;
    this.isInSequence = false;

    this.manualScale = 1;
    this.currentScale = 1;
    this.shrinkActive = false;
    this.shrinkDurationMs = 0;
    this.shrinkElapsedMs = 0;
    this.shrinkFromScale = 1;
    this.shrinkToScale = SHRINK_TARGET_SCALE;
    this.shrinkScaleOverride = null;
    this.shrinkOverrideAlpha = null;
    this.shrinkFromAlpha = 0;
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    if (!this.logoContainer || this.lockedVisible) {
      if (this.lockedVisible) {
        debugLog("setVisible ignored because lockedVisible=true", {
          requestedVisible: visible,
        });
      }
      return;
    }

    this.logoContainer.visible =
      visible || this.baseAlpha > 0 || this.flashTimer > 0;
  }

  setAlpha(alpha: number): void {
    this.baseAlpha = this.clamp(alpha, 0, 1);
    if (!this.logoContainer || this.lockedVisible) {
      if (this.lockedVisible) {
        debugLog("setAlpha ignored because lockedVisible=true", {
          requestedAlpha: Number(this.baseAlpha.toFixed(3)),
        });
      }
      return;
    }
    if (this.flashTimer > 0) return;

    this.logoContainer.alpha = this.resolveContainerAlpha(this.baseAlpha);
    this.logoContainer.visible = this.visible || this.baseAlpha > 0;
  }

  setPosition(x: number, y: number): void {
    this.basePosition = { x, y };
    this.applyPositionWithJitter();
  }

  setJitter(maxOffset: number): void {
    this.jitterMax = Math.max(0, maxOffset);
  }

  setCharging(active: boolean): void {
    this.chargingActive = active;

    if (!active) {
      this.chargeTimeSeconds = 0;
    }

    this.applyContainerScale();
  }

  setChargeProgress(progress: number): void {
    const safeProgress = Number.isFinite(progress) ? progress : 0;
    this.chargeProgress = this.clamp(safeProgress, 0, 1);
    this.applyContainerScale();
  }

  setSequenceMode(active: boolean): void {
    this.isInSequence = active;
  }

  shrink(duration: number): void {
    const safeDuration = Number.isFinite(duration) ? duration : 0;
    const resolvedDuration = Math.max(1, safeDuration);

    this.shrinkActive = true;
    this.shrinkDurationMs = resolvedDuration;
    this.shrinkElapsedMs = 0;
    this.shrinkFromScale = Math.max(0, this.getScale());
    this.shrinkToScale = SHRINK_TARGET_SCALE;
    this.shrinkScaleOverride = this.shrinkFromScale;
    this.shrinkFromAlpha = this.resolveContainerAlpha(this.baseAlpha);
    this.shrinkOverrideAlpha = this.shrinkFromAlpha;
    this.debugLastShrinkBucket = -1;

    debugLog("shrink started", {
      durationMs: resolvedDuration,
      fromScale: Number(this.shrinkFromScale.toFixed(3)),
      toScale: Number(this.shrinkToScale.toFixed(3)),
      lockedVisible: this.lockedVisible,
    });

    this.applyContainerScale();
  }

  setScale(scale: number): void {
    const safeScale = Number.isFinite(scale) ? scale : 1;
    this.manualScale = Math.max(0, safeScale);

    this.shrinkActive = false;
    this.shrinkDurationMs = 0;
    this.shrinkElapsedMs = 0;
    this.shrinkScaleOverride = null;
    this.shrinkOverrideAlpha = null;
    this.shrinkFromAlpha = 0;

    this.applyContainerScale();
  }

  getScale(): number {
    return this.currentScale;
  }

  flash(duration: number): void {
    if (this.lockedVisible || !this.logoContainer) return;

    this.flashDuration = Math.max(1, duration);
    this.flashTimer = this.flashDuration;
    this.logoContainer.visible = true;
    this.logoContainer.alpha = 0;
  }

  startIdleAnimation(): void {
    this.idleAnimationEnabled = true;
    this.idleTimeSeconds = 0;

    if (!this.logoContainer || !this.lockedVisible) return;
    this.applyLockedVisual(0);
  }

  /**
   * @deprecated 兼容旧 API，内部转发到 startIdleAnimation
   */
  startBreathing(): void {
    this.startIdleAnimation();
  }

  lockVisible(): void {
    this.lockedVisible = true;
    this.flashTimer = 0;
    this.flashDuration = 0;
    this.jitterMax = 0;
    this.visible = true;
    this.baseAlpha = 1;
    this.idleAnimationEnabled = false;
    this.idleTimeSeconds = 0;

    this.chargingActive = false;
    this.chargeProgress = 0;
    this.chargeTimeSeconds = 0;
    this.isInSequence = false;

    this.manualScale = 1;
    this.currentScale = 1;
    this.shrinkActive = false;
    this.shrinkDurationMs = 0;
    this.shrinkElapsedMs = 0;
    this.shrinkFromScale = 1;
    this.shrinkToScale = SHRINK_TARGET_SCALE;
    this.shrinkScaleOverride = null;
    this.shrinkOverrideAlpha = null;
    this.shrinkFromAlpha = 0;
    this.debugLastShrinkBucket = -1;
    this.debugLockedVisualLogged = false;

    debugLog("lockVisible invoked", {
      visible: this.visible,
      baseAlpha: this.baseAlpha,
    });

    if (!this.logoContainer) return;
    this.applyLockedVisual(0);
  }

  hideInstantly(): void {
    this.lockedVisible = false;
    this.visible = false;
    this.baseAlpha = 0;
    this.flashTimer = 0;
    this.flashDuration = 0;
    this.idleAnimationEnabled = false;
    this.chargingActive = false;
    this.chargeProgress = 0;
    this.isInSequence = false;

    this.shrinkActive = false;
    this.shrinkDurationMs = 0;
    this.shrinkElapsedMs = 0;
    this.shrinkScaleOverride = 0;
    this.shrinkOverrideAlpha = null;
    this.shrinkFromAlpha = 0;
    this.currentScale = 0;
    this.debugLockedVisualLogged = false;

    debugLog("hideInstantly invoked");

    if (!this.logoContainer) return;
    this.applyIdleLayerDefaults();
    this.applyContainerScale();
    this.logoContainer.alpha = 0;
    this.logoContainer.visible = false;
    this.logoContainer.position.set(this.basePosition.x, this.basePosition.y);
  }

  getCenter(): { x: number; y: number } {
    return { ...this.basePosition };
  }

  private applyLayout(): void {
    const targetSize =
      Math.min(this.screenWidth, this.screenHeight) * LOGO_SIZE_RATIO;
    this.baseScale = targetSize / LOGO_REFERENCE_SIZE;
    this.applyContainerScale();
  }

  private applyPositionWithJitter(): void {
    if (!this.logoContainer) return;

    let offsetX = 0;
    let offsetY = 0;

    if (this.jitterMax > 0) {
      offsetX += (Math.random() * 2 - 1) * this.jitterMax;
      offsetY += (Math.random() * 2 - 1) * this.jitterMax;
    }

    if (this.chargingActive && this.chargeProgress > 0.5) {
      const halfP = this.clamp((this.chargeProgress - 0.5) * 2, 0, 1);
      const amplitude = this.lerp(CHARGE_JITTER_MIN, CHARGE_JITTER_MAX, halfP);
      offsetX += (Math.random() * 2 - 1) * amplitude;
      offsetY += (Math.random() * 2 - 1) * amplitude;
    }

    this.logoContainer.position.set(
      this.basePosition.x + offsetX,
      this.basePosition.y + offsetY,
    );
  }

  private applyLockedVisual(deltaMs: number): void {
    if (!this.logoContainer) return;

    this.logoContainer.visible = true;
    this.logoContainer.alpha = this.resolveContainerAlpha(1);
    this.applyContainerScale();
    this.logoContainer.position.set(this.basePosition.x, this.basePosition.y);

    if (!this.debugLockedVisualLogged) {
      this.debugLockedVisualLogged = true;
      debugLog("applyLockedVisual forcing visibility", {
        forcedVisible: this.logoContainer.visible,
        forcedAlpha: Number(this.logoContainer.alpha.toFixed(3)),
        currentScale: Number(this.currentScale.toFixed(3)),
      });
    }

    if (!this.idleAnimationEnabled) {
      this.applyIdleLayerDefaults();
      return;
    }

    this.updateIdleAnimation(deltaMs);
  }

  private updateIdleAnimation(deltaMs: number): void {
    const frameDelta = deltaMs / FRAME_DURATION_MS;
    this.idleTimeSeconds += deltaMs / 1000;

    const chargeProgress = this.chargingActive ? this.chargeProgress : 0;
    const firstHalfProgress = this.chargingActive
      ? this.clamp(chargeProgress * 2, 0, 1)
      : 0;
    const secondHalfProgress =
      this.chargingActive && chargeProgress > 0.5
        ? this.clamp((chargeProgress - 0.5) * 2, 0, 1)
        : 0;
    const isPrimed = this.chargingActive && chargeProgress >= 1;

    const rotationMultiplier = this.isInSequence
      ? SEQUENCE_ROTATION_SPEED_MULTIPLIER
      : this.lerp(1, CHARGE_ROTATION_SPEED_MULTIPLIER, chargeProgress);
    const flickerMultiplier = this.lerp(
      1,
      CHARGE_FLICKER_SPEED_MULTIPLIER,
      chargeProgress,
    );
    const crosshairFrequencyMultiplier = 1 + secondHalfProgress * 4;
    const layerAlphaBoost = chargeProgress * CHARGE_LAYER_ALPHA_BOOST;
    const visualTime = this.idleTimeSeconds * flickerMultiplier;
    const chargeVisualProgress = Math.max(
      firstHalfProgress,
      secondHalfProgress > 0 ? 1 : 0,
    );
    const easedChargeProgress = chargeProgress * chargeProgress;
    const easedOuterChargeProgress = easedChargeProgress * chargeProgress;

    if (this.outerFrame) {
      this.outerFrame.rotation +=
        OUTER_FRAME_ROTATION_SPEED * frameDelta * rotationMultiplier;
      this.outerFrame.alpha = this.clamp(
        OUTER_FRAME_BASE_ALPHA +
          Math.sin(visualTime * 1.4) * 0.1 +
          layerAlphaBoost * 0.25,
        0,
        1,
      );
    }

    if (this.innerFrame) {
      this.innerFrame.rotation +=
        INNER_FRAME_ROTATION_SPEED * frameDelta * rotationMultiplier;
      this.innerFrame.alpha = this.clamp(
        INNER_FRAME_BASE_ALPHA + layerAlphaBoost * 0.2,
        0,
        1,
      );
    }

    if (this.crosshair) {
      this.crosshair.alpha = this.clamp(
        CROSSHAIR_BASE_ALPHA +
          Math.sin(visualTime * 2 * crosshairFrequencyMultiplier) * 0.1 +
          layerAlphaBoost * 0.2,
        0,
        1,
      );
    }

    const riftPulse = Math.sin(visualTime * 1.2);

    if (this.riftGlow) {
      const pulseAlpha =
        RIFT_GLOW_BASE_ALPHA +
        Math.sin(visualTime * 1.2) * 0.03 +
        layerAlphaBoost * 0.28;
      const chargedAlpha = this.lerp(
        RIFT_GLOW_BASE_ALPHA,
        0.9,
        chargeVisualProgress,
      );
      const glowAlpha =
        pulseAlpha + (chargedAlpha - pulseAlpha) * easedChargeProgress;
      this.riftGlow.alpha = this.clamp(glowAlpha, 0, 1);
    }

    if (this.riftBodyOuter) {
      this.riftBodyOuter.scale.set(
        1 + riftPulse * (0.012 + easedChargeProgress * 0.006),
      );
      const baseOuterAlpha =
        RIFT_GRADIENT_OUTER_BASE_ALPHA +
        Math.sin(visualTime * 1.1 + 0.5) * 0.06;
      const outerChargeBoost = easedOuterChargeProgress * 0.3;
      this.riftBodyOuter.alpha = this.clamp(
        baseOuterAlpha + outerChargeBoost,
        0,
        1,
      );
    }

    if (this.riftBodyMid) {
      this.riftBodyMid.scale.set(
        0.82 + riftPulse * (0.018 + chargeVisualProgress * 0.012),
      );
      this.riftBodyMid.alpha = this.clamp(
        RIFT_GRADIENT_MID_BASE_ALPHA +
          Math.sin(visualTime * 1.3 + 0.2) * 0.07 +
          layerAlphaBoost * 0.5,
        0,
        1,
      );
    }

    if (this.riftBodyCore) {
      this.riftBodyCore.scale.set(
        0.56 + riftPulse * (0.022 + chargeVisualProgress * 0.014),
      );
      this.riftBodyCore.alpha = this.clamp(
        RIFT_GRADIENT_CORE_BASE_ALPHA +
          Math.sin(visualTime * 1.6 + 0.9) * 0.08 +
          layerAlphaBoost * 0.65,
        0,
        1,
      );
    }

    if (this.singularity) {
      const singularityRotationBoost = isPrimed ? 5 : 1 + firstHalfProgress * 3;
      const pulseAlpha =
        0.7 + Math.sin(visualTime * 4) * 0.3 + layerAlphaBoost * 0.45;
      const chargedAlpha = isPrimed
        ? 1
        : this.lerp(SINGULARITY_BASE_ALPHA, 0.95, chargeVisualProgress);

      this.singularity.rotation +=
        SINGULARITY_ROTATION_SPEED *
        frameDelta *
        rotationMultiplier *
        singularityRotationBoost;
      this.singularity.alpha = this.clamp(
        Math.max(pulseAlpha, chargedAlpha),
        0,
        1,
      );

      const singularityScale =
        (isPrimed ? 1.12 : 1) +
        Math.sin(visualTime * 3.4) * 0.06 +
        chargeVisualProgress * 0.05;
      this.singularity.scale.set(Math.max(0, singularityScale));
    }
  }

  private drawStaticLayers(): void {
    this.drawOuterFrame();
    this.drawInnerFrame();
    this.drawCrosshair();
    this.drawRiftGlow();
    this.drawRiftGradientLayers();
    this.drawRiftInnerLine();
    this.drawSingularity();
  }

  private drawOuterFrame(): void {
    if (!this.outerFrame) return;
    this.outerFrame.clear();
    this.outerFrame.lineStyle(OUTER_FRAME_LINE_WIDTH, OUTER_FRAME_COLOR, 1);
    this.outerFrame.drawRect(
      -FRAME_HALF_SIZE,
      -FRAME_HALF_SIZE,
      FRAME_SIZE,
      FRAME_SIZE,
    );
  }

  private drawInnerFrame(): void {
    if (!this.innerFrame) return;
    this.innerFrame.clear();
    this.innerFrame.lineStyle(INNER_FRAME_LINE_WIDTH, INNER_FRAME_COLOR, 1);
    this.innerFrame.drawRect(
      -FRAME_HALF_SIZE,
      -FRAME_HALF_SIZE,
      FRAME_SIZE,
      FRAME_SIZE,
    );
  }

  private drawCrosshair(): void {
    if (!this.crosshair) return;
    this.crosshair.clear();
    this.crosshair.lineStyle(CROSSHAIR_LINE_WIDTH, CROSSHAIR_COLOR, 1);
    this.crosshair.moveTo(0, -35);
    this.crosshair.lineTo(0, 35);
    this.crosshair.moveTo(-35, 0);
    this.crosshair.lineTo(35, 0);
  }

  private drawRiftGlow(): void {
    if (!this.riftGlow) return;
    this.riftGlow.clear();
    this.riftGlow.lineStyle(RIFT_GLOW_LINE_WIDTH, RIFT_GLOW_COLOR, 1);
    this.riftGlow.drawPolygon(RIFT_POLYGON);
  }

  private drawRiftGradientLayers(): void {
    if (!this.riftBodyOuter || !this.riftBodyMid || !this.riftBodyCore) return;

    this.riftBodyOuter.clear();
    this.riftBodyOuter.beginFill(RIFT_GRADIENT_OUTER_COLOR, 1);
    this.riftBodyOuter.drawPolygon(RIFT_POLYGON);
    this.riftBodyOuter.endFill();

    this.riftBodyMid.clear();
    this.riftBodyMid.beginFill(RIFT_GRADIENT_MID_COLOR, 1);
    this.riftBodyMid.drawPolygon(RIFT_POLYGON);
    this.riftBodyMid.endFill();

    this.riftBodyCore.clear();
    this.riftBodyCore.beginFill(RIFT_GRADIENT_CORE_COLOR, 1);
    this.riftBodyCore.drawPolygon(RIFT_POLYGON);
    this.riftBodyCore.endFill();
  }

  private drawRiftInnerLine(): void {
    if (!this.riftInnerLine) return;
    this.riftInnerLine.clear();
    this.riftInnerLine.lineStyle(
      RIFT_INNER_LINE_WIDTH,
      RIFT_INNER_LINE_COLOR,
      1,
    );
    this.riftInnerLine.drawPolygon(RIFT_INNER_POLYGON);
  }

  private drawSingularity(): void {
    if (!this.singularity) return;
    this.singularity.clear();
    this.singularity.beginFill(SINGULARITY_COLOR, 1);
    this.singularity.drawRect(-3, -3, 6, 6);
    this.singularity.endFill();
  }

  private applyIdleLayerDefaults(): void {
    if (this.outerFrame) {
      this.outerFrame.rotation = OUTER_FRAME_BASE_ROTATION;
      this.outerFrame.alpha = OUTER_FRAME_BASE_ALPHA;
    }

    if (this.innerFrame) {
      this.innerFrame.rotation = INNER_FRAME_BASE_ROTATION;
      this.innerFrame.alpha = INNER_FRAME_BASE_ALPHA;
    }

    if (this.crosshair) {
      this.crosshair.alpha = CROSSHAIR_BASE_ALPHA;
    }

    if (this.riftGlow) {
      this.riftGlow.scale.set(1);
      this.riftGlow.alpha = RIFT_GLOW_BASE_ALPHA;
    }

    if (this.riftBodyOuter) {
      this.riftBodyOuter.scale.set(1);
      this.riftBodyOuter.alpha = RIFT_GRADIENT_OUTER_BASE_ALPHA;
    }

    if (this.riftBodyMid) {
      this.riftBodyMid.scale.set(0.82);
      this.riftBodyMid.alpha = RIFT_GRADIENT_MID_BASE_ALPHA;
    }

    if (this.riftBodyCore) {
      this.riftBodyCore.scale.set(0.56);
      this.riftBodyCore.alpha = RIFT_GRADIENT_CORE_BASE_ALPHA;
    }

    if (this.riftInnerLine) {
      this.riftInnerLine.alpha = RIFT_INNER_LINE_BASE_ALPHA;
    }

    if (this.singularity) {
      this.singularity.rotation = SINGULARITY_BASE_ROTATION;
      this.singularity.alpha = SINGULARITY_BASE_ALPHA;
      this.singularity.scale.set(1);
    }
  }

  private advanceRuntime(deltaMs: number): void {
    if (this.chargingActive) {
      this.chargeTimeSeconds += deltaMs / 1000;
    } else {
      this.chargeTimeSeconds = 0;
    }

    if (!this.shrinkActive) {
      this.applyContainerScale();
      return;
    }

    this.shrinkElapsedMs = Math.min(
      this.shrinkDurationMs,
      this.shrinkElapsedMs + deltaMs,
    );

    const progress = this.clamp(
      this.shrinkElapsedMs / Math.max(1, this.shrinkDurationMs),
      0,
      1,
    );

    if (progress <= 0.15) {
      const stageProgress = this.clamp(progress / 0.15, 0, 1);
      this.shrinkScaleOverride = this.lerp(
        this.shrinkFromScale,
        1.3,
        stageProgress,
      );
      this.shrinkOverrideAlpha = this.lerp(
        this.shrinkFromAlpha,
        1,
        stageProgress,
      );
    } else {
      const stageProgress = this.clamp((progress - 0.15) / 0.85, 0, 1);
      this.shrinkScaleOverride = this.lerp(
        1.3,
        this.shrinkToScale,
        stageProgress,
      );
      this.shrinkOverrideAlpha = this.lerp(1, 0, stageProgress);
    }

    if (SPLASH_DEBUG_ENABLED) {
      const progressBucket = Math.floor(progress * 8);
      if (progressBucket !== this.debugLastShrinkBucket) {
        this.debugLastShrinkBucket = progressBucket;
        debugLog("shrink progress", {
          progress: Number(progress.toFixed(3)),
          shrinkScaleOverride: Number(
            (this.shrinkScaleOverride ?? 0).toFixed(4),
          ),
          shrinkOverrideAlpha: Number(
            (this.shrinkOverrideAlpha ?? 0).toFixed(4),
          ),
          lockedVisible: this.lockedVisible,
        });
      }
    }

    if (progress >= 1) {
      this.shrinkActive = false;
      this.shrinkScaleOverride = this.shrinkToScale;
      this.shrinkOverrideAlpha = 0;
      debugLog("shrink completed", {
        finalScaleOverride: Number((this.shrinkScaleOverride ?? 0).toFixed(4)),
      });
    }

    this.applyContainerScale();
  }

  private resolveScaleMultiplier(): number {
    if (this.shrinkScaleOverride !== null) {
      return Math.max(0, this.shrinkScaleOverride);
    }

    return Math.max(0, this.manualScale);
  }

  private applyContainerScale(): void {
    const resolvedScale = this.resolveScaleMultiplier();
    this.currentScale = resolvedScale;

    if (!this.logoContainer) return;
    this.logoContainer.scale.set(this.baseScale * resolvedScale);
  }

  private resolveContainerAlpha(baseAlpha: number): number {
    if (this.shrinkOverrideAlpha !== null) {
      return this.clamp(this.shrinkOverrideAlpha, 0, 1);
    }

    if (this.chargingActive && this.chargeProgress > 0.65) {
      const flicker =
        CHARGE_FLICKER_MIN +
        (CHARGE_FLICKER_MAX - CHARGE_FLICKER_MIN) *
          (0.5 + 0.5 * Math.sin(this.chargeTimeSeconds * CHARGE_FLICKER_SPEED));

      return this.clamp(baseAlpha * flicker, 0, 1);
    }

    return this.clamp(baseAlpha, 0, 1);
  }

  private resolveDeltaMs(delta: number): number {
    if (delta > 0) return delta;
    return FRAME_DURATION_MS;
  }

  private lerp(from: number, to: number, t: number): number {
    return from + (to - from) * t;
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }
}
