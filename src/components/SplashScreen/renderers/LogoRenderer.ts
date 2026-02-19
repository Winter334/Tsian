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

    ctx.layers.content.addChild(logoContainer);

    this.applyLayout();
    this.applyPositionWithJitter();
  }

  update(elapsed: number, delta: number): void {
    void elapsed;
    if (!this.logoContainer) return;

    const deltaMs = this.resolveDeltaMs(delta);

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
      this.applyPositionWithJitter();

      if (this.flashTimer === 0) {
        this.logoContainer.alpha = this.baseAlpha;
        this.logoContainer.visible = this.visible || this.baseAlpha > 0;
        this.applyPositionWithJitter();
      }
      return;
    }

    this.logoContainer.alpha = this.baseAlpha;
    this.logoContainer.visible = this.visible || this.baseAlpha > 0;
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
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    if (!this.logoContainer || this.lockedVisible) return;

    this.logoContainer.visible =
      visible || this.baseAlpha > 0 || this.flashTimer > 0;
  }

  setAlpha(alpha: number): void {
    this.baseAlpha = this.clamp(alpha, 0, 1);
    if (!this.logoContainer || this.lockedVisible) return;
    if (this.flashTimer > 0) return;

    this.logoContainer.alpha = this.baseAlpha;
    this.logoContainer.visible = this.visible || this.baseAlpha > 0;
  }

  setPosition(x: number, y: number): void {
    this.basePosition = { x, y };
    this.applyPositionWithJitter();
  }

  setJitter(maxOffset: number): void {
    this.jitterMax = Math.max(0, maxOffset);
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

    if (!this.logoContainer) return;
    this.applyLockedVisual(0);
  }

  getCenter(): { x: number; y: number } {
    return { ...this.basePosition };
  }

  private applyLayout(): void {
    if (!this.logoContainer) return;

    const targetSize =
      Math.min(this.screenWidth, this.screenHeight) * LOGO_SIZE_RATIO;
    this.baseScale = targetSize / LOGO_REFERENCE_SIZE;
    this.logoContainer.scale.set(this.baseScale);
  }

  private applyPositionWithJitter(): void {
    if (!this.logoContainer) return;

    if (this.jitterMax > 0) {
      const offsetX = (Math.random() * 2 - 1) * this.jitterMax;
      const offsetY = (Math.random() * 2 - 1) * this.jitterMax;
      this.logoContainer.position.set(
        this.basePosition.x + offsetX,
        this.basePosition.y + offsetY,
      );
      return;
    }

    this.logoContainer.position.set(this.basePosition.x, this.basePosition.y);
  }

  private applyLockedVisual(deltaMs: number): void {
    if (!this.logoContainer) return;

    this.logoContainer.visible = true;
    this.logoContainer.alpha = 1;
    this.logoContainer.scale.set(this.baseScale);
    this.logoContainer.position.set(this.basePosition.x, this.basePosition.y);

    if (!this.idleAnimationEnabled) {
      this.applyIdleLayerDefaults();
      return;
    }

    this.updateIdleAnimation(deltaMs);
  }

  private updateIdleAnimation(deltaMs: number): void {
    const frameDelta = deltaMs / FRAME_DURATION_MS;
    this.idleTimeSeconds += deltaMs / 1000;

    if (this.outerFrame) {
      this.outerFrame.rotation += OUTER_FRAME_ROTATION_SPEED * frameDelta;
      this.outerFrame.alpha = this.clamp(
        OUTER_FRAME_BASE_ALPHA + Math.sin(this.idleTimeSeconds * 1.4) * 0.1,
        0,
        1,
      );
    }

    if (this.innerFrame) {
      this.innerFrame.rotation += INNER_FRAME_ROTATION_SPEED * frameDelta;
      this.innerFrame.alpha = INNER_FRAME_BASE_ALPHA;
    }

    if (this.crosshair) {
      this.crosshair.alpha = this.clamp(
        0.2 + Math.sin(this.idleTimeSeconds * 2) * 0.1,
        0,
        1,
      );
    }

    const riftPulse = Math.sin(this.idleTimeSeconds * 1.2);

    if (this.riftGlow) {
      this.riftGlow.alpha = this.clamp(
        RIFT_GLOW_BASE_ALPHA + Math.sin(this.idleTimeSeconds * 1.2) * 0.03,
        0,
        1,
      );
    }

    if (this.riftBodyOuter) {
      this.riftBodyOuter.scale.set(1 + riftPulse * 0.016);
      this.riftBodyOuter.alpha = this.clamp(
        RIFT_GRADIENT_OUTER_BASE_ALPHA +
          Math.sin(this.idleTimeSeconds * 1.1 + 0.5) * 0.06,
        0,
        1,
      );
    }

    if (this.riftBodyMid) {
      this.riftBodyMid.scale.set(0.82 + riftPulse * 0.018);
      this.riftBodyMid.alpha = this.clamp(
        RIFT_GRADIENT_MID_BASE_ALPHA +
          Math.sin(this.idleTimeSeconds * 1.3 + 0.2) * 0.07,
        0,
        1,
      );
    }

    if (this.riftBodyCore) {
      this.riftBodyCore.scale.set(0.56 + riftPulse * 0.022);
      this.riftBodyCore.alpha = this.clamp(
        RIFT_GRADIENT_CORE_BASE_ALPHA +
          Math.sin(this.idleTimeSeconds * 1.6 + 0.9) * 0.08,
        0,
        1,
      );
    }

    if (this.singularity) {
      this.singularity.rotation += SINGULARITY_ROTATION_SPEED * frameDelta;
      this.singularity.alpha = this.clamp(
        0.7 + Math.sin(this.idleTimeSeconds * 4) * 0.3,
        0,
        1,
      );
      const singularityScale = 1 + Math.sin(this.idleTimeSeconds * 3.4) * 0.06;
      this.singularity.scale.set(singularityScale);
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

  private resolveDeltaMs(delta: number): number {
    if (delta > 0) return delta;
    return FRAME_DURATION_MS;
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }
}
