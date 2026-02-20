import { CHARGE_SEQUENCE_CONFIG } from "@/config/splash";
import { Graphics } from "@/lib/pixi";
import type { SplashCanvasContext, SplashRenderer } from "../types";

const EXPLOSION_CONFIG = CHARGE_SEQUENCE_CONFIG.explosion;

const FRAME_DURATION_MS = 1000 / 60;
const SHOCKWAVE_DURATION_MS = Math.max(
  1,
  CHARGE_SEQUENCE_CONFIG.sequence.shockwaveDuration,
);
const DEBRIS_DURATION_MS = Math.max(
  SHOCKWAVE_DURATION_MS * 1.35,
  SHOCKWAVE_DURATION_MS + 180,
);

const SHOCKWAVE_START_ALPHA = 0.9;
const SHOCKWAVE_MIN_VISIBLE_RADIUS = 0.5;
const SHOCKWAVE_BASE_WIDTH = 40;
const SHOCKWAVE_END_WIDTH = 12;
const SHOCKWAVE_RING_OFFSET = 10;
const SHOCKWAVE_SECONDARY_COLOR = 0xff3d5c;
const SHOCKWAVE_CORE_COLOR = 0xffffff;

const DEBRIS_ALPHA_MIN = 0.65;
const DEBRIS_ALPHA_MAX = 1;
const DEBRIS_VELOCITY_DAMPING = 0.93;
const DEBRIS_ANGULAR_DAMPING = 0.965;
const DEBRIS_SPIN_MIN = 0.05;
const DEBRIS_SPIN_MAX = 0.2;
const DEBRIS_HEIGHT_RATIO_MIN = 0.45;
const DEBRIS_HEIGHT_RATIO_MAX = 0.95;
const DEBRIS_ALPHA_FALLOFF_POWER = 1.25;
const DEBRIS_OUT_OF_BOUNDS_PADDING = 180;

const MIN_VISIBLE_ALPHA = 0.01;

const SPLASH_DEBUG_ENABLED =
  typeof window !== "undefined" &&
  import.meta.env.DEV &&
  new URLSearchParams(window.location.search).has("splashDebug");

function debugLog(message: string, payload?: Record<string, unknown>): void {
  if (!SPLASH_DEBUG_ENABLED) return;

  if (payload) {
    console.debug(`[SplashDebug][ExplosionRenderer] ${message}`, payload);
    return;
  }

  console.debug(`[SplashDebug][ExplosionRenderer] ${message}`);
}

function easeOutQuad(t: number): number {
  const clamped = Math.max(0, Math.min(1, t));
  return 1 - (1 - clamped) * (1 - clamped);
}

interface DebrisParticle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  rotation: number;
  angularVelocity: number;
  baseAlpha: number;
  alpha: number;
  elapsedMs: number;
  durationMs: number;
}

export class ExplosionRenderer implements SplashRenderer {
  private ctx: SplashCanvasContext | null = null;
  private shockwaveGraphics: Graphics | null = null;
  private debrisGraphics: Graphics | null = null;

  private screenWidth = 1;
  private screenHeight = 1;

  private centerX = 0;
  private centerY = 0;
  private normalizedCenterX = 0.5;
  private normalizedCenterY = 0.5;

  private active = false;
  private shockwaveElapsedMs = 0;

  private shockwaveColor = 0;
  private debrisColor = 0;

  private debrisPool: DebrisParticle[] = [];

  private debugLastFrameBucket = -1;

  init(ctx: SplashCanvasContext): void {
    this.destroyGraphics();

    this.ctx = ctx;
    this.screenWidth = Math.max(1, ctx.screen.width);
    this.screenHeight = Math.max(1, ctx.screen.height);

    this.centerX = this.screenWidth * 0.5;
    this.centerY = this.screenHeight * 0.5;
    this.normalizedCenterX = 0.5;
    this.normalizedCenterY = 0.5;

    this.shockwaveColor = this.rgb01ToHex(
      EXPLOSION_CONFIG.shockwaveColor[0],
      EXPLOSION_CONFIG.shockwaveColor[1],
      EXPLOSION_CONFIG.shockwaveColor[2],
    );
    this.debrisColor = this.shockwaveColor;

    this.shockwaveGraphics = new Graphics();
    this.debrisGraphics = new Graphics();

    ctx.layers.ui.addChild(this.shockwaveGraphics);
    ctx.layers.ui.addChild(this.debrisGraphics);

    this.ensureDebrisPool();
    this.resetPlaybackState();
    this.clearGraphics();
    this.debugLastFrameBucket = -1;
  }

  update(elapsed: number, delta: number): void {
    void elapsed;
    if (!this.ctx || !this.active) return;
    if (!this.shockwaveGraphics || !this.debrisGraphics) return;

    const deltaMs = this.resolveDeltaMs(delta);
    const frameScale = deltaMs / FRAME_DURATION_MS;

    this.shockwaveElapsedMs = Math.min(
      SHOCKWAVE_DURATION_MS,
      this.shockwaveElapsedMs + deltaMs,
    );

    this.updateDebrisParticles(deltaMs, frameScale);

    this.renderShockwave();
    this.renderDebris();
    this.logFrameState();

    if (this.isShockwaveFinished() && !this.hasActiveDebris()) {
      this.active = false;
      this.clearGraphics();
      debugLog("explosion finished");
    }
  }

  resize(width: number, height: number): void {
    const prevWidth = Math.max(1, this.screenWidth);
    const prevHeight = Math.max(1, this.screenHeight);

    this.screenWidth = Math.max(1, width);
    this.screenHeight = Math.max(1, height);

    const scaleX = this.screenWidth / prevWidth;
    const scaleY = this.screenHeight / prevHeight;
    const velocityScale = (scaleX + scaleY) * 0.5;

    this.centerX = this.normalizedCenterX * this.screenWidth;
    this.centerY = this.normalizedCenterY * this.screenHeight;

    for (const particle of this.debrisPool) {
      if (!particle.active) continue;

      particle.x *= scaleX;
      particle.y *= scaleY;
      particle.vx *= velocityScale;
      particle.vy *= velocityScale;
    }

    if (this.active) {
      this.renderShockwave();
      this.renderDebris();
    }
  }

  destroy(): void {
    this.resetPlaybackState();
    this.clearDebrisPool();
    this.clearGraphics();
    this.destroyGraphics();
    this.ctx = null;
  }

  trigger(centerX: number, centerY: number): void {
    if (!this.ctx || !this.shockwaveGraphics || !this.debrisGraphics) return;

    this.centerX = this.clamp(
      centerX,
      -DEBRIS_OUT_OF_BOUNDS_PADDING,
      this.screenWidth + DEBRIS_OUT_OF_BOUNDS_PADDING,
    );
    this.centerY = this.clamp(
      centerY,
      -DEBRIS_OUT_OF_BOUNDS_PADDING,
      this.screenHeight + DEBRIS_OUT_OF_BOUNDS_PADDING,
    );
    this.normalizedCenterX = this.clamp(this.centerX / this.screenWidth, 0, 1);
    this.normalizedCenterY = this.clamp(this.centerY / this.screenHeight, 0, 1);

    this.active = true;
    this.shockwaveElapsedMs = 0;

    this.activateDebrisParticles();

    this.renderShockwave();
    this.renderDebris();
    this.debugLastFrameBucket = -1;

    debugLog("trigger", {
      centerX: Number(this.centerX.toFixed(2)),
      centerY: Number(this.centerY.toFixed(2)),
      debrisCount: this.debrisPool.length,
      shockwaveDurationMs: SHOCKWAVE_DURATION_MS,
    });
  }

  isActive(): boolean {
    return this.active;
  }

  private ensureDebrisPool(): void {
    const targetCount = Math.max(
      0,
      Math.round(EXPLOSION_CONFIG.debrisCount * 3),
    );

    if (this.debrisPool.length === targetCount) {
      return;
    }

    this.debrisPool = [];
    for (let index = 0; index < targetCount; index += 1) {
      this.debrisPool.push(this.createDebrisParticle());
    }
  }

  private createDebrisParticle(): DebrisParticle {
    return {
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      width: 0,
      height: 0,
      rotation: 0,
      angularVelocity: 0,
      baseAlpha: 0,
      alpha: 0,
      elapsedMs: 0,
      durationMs: DEBRIS_DURATION_MS,
    };
  }

  private activateDebrisParticles(): void {
    for (const particle of this.debrisPool) {
      this.activateDebrisParticle(particle);
    }
  }

  private activateDebrisParticle(particle: DebrisParticle): void {
    const direction = this.randomRange(0, Math.PI * 2);
    const speed = this.randomRange(
      EXPLOSION_CONFIG.debrisSpeed.min,
      EXPLOSION_CONFIG.debrisSpeed.max,
    );
    const baseSize = this.randomRange(
      EXPLOSION_CONFIG.debrisSize.min,
      EXPLOSION_CONFIG.debrisSize.max,
    );

    particle.active = true;
    particle.x = this.centerX;
    particle.y = this.centerY;
    particle.vx = Math.cos(direction) * speed;
    particle.vy = Math.sin(direction) * speed;

    particle.width = Math.max(0.6, baseSize * this.randomRange(0.9, 1.5));
    particle.height = Math.max(
      0.5,
      baseSize *
        this.randomRange(DEBRIS_HEIGHT_RATIO_MIN, DEBRIS_HEIGHT_RATIO_MAX),
    );

    particle.rotation = this.randomRange(0, Math.PI * 2);
    particle.angularVelocity = this.randomSigned(
      this.randomRange(DEBRIS_SPIN_MIN, DEBRIS_SPIN_MAX),
    );

    particle.baseAlpha = this.randomRange(DEBRIS_ALPHA_MIN, DEBRIS_ALPHA_MAX);
    particle.alpha = particle.baseAlpha;

    particle.elapsedMs = 0;
    particle.durationMs = DEBRIS_DURATION_MS * this.randomRange(0.82, 1.24);
  }

  private updateDebrisParticles(deltaMs: number, frameScale: number): void {
    const velocityDamping = Math.pow(DEBRIS_VELOCITY_DAMPING, frameScale);
    const angularDamping = Math.pow(DEBRIS_ANGULAR_DAMPING, frameScale);

    for (const particle of this.debrisPool) {
      if (!particle.active) continue;

      particle.elapsedMs += deltaMs;

      particle.x += particle.vx * frameScale;
      particle.y += particle.vy * frameScale;
      particle.vx *= velocityDamping;
      particle.vy *= velocityDamping;

      particle.rotation += particle.angularVelocity * frameScale;
      particle.angularVelocity *= angularDamping;

      const lifeProgress = this.clamp(
        particle.elapsedMs / Math.max(1, particle.durationMs),
        0,
        1,
      );
      const life = Math.max(0, 1 - lifeProgress);

      particle.alpha = this.clamp(
        particle.baseAlpha * Math.pow(life, DEBRIS_ALPHA_FALLOFF_POWER),
        0,
        1,
      );

      if (
        lifeProgress >= 1 ||
        particle.alpha <= MIN_VISIBLE_ALPHA ||
        this.isOutOfBounds(particle)
      ) {
        particle.active = false;
        particle.alpha = 0;
      }
    }
  }

  private renderShockwave(): void {
    if (!this.shockwaveGraphics) return;

    this.shockwaveGraphics.clear();

    const progress = this.clamp(
      this.shockwaveElapsedMs / SHOCKWAVE_DURATION_MS,
      0,
      1,
    );
    if (progress >= 1) {
      return;
    }

    const eased = easeOutQuad(progress);
    const radius = this.lerp(0, EXPLOSION_CONFIG.shockwaveMaxRadius, eased);
    const lineWidth = Math.max(
      1,
      this.lerp(SHOCKWAVE_BASE_WIDTH, SHOCKWAVE_END_WIDTH, eased),
    );
    const life = this.clamp(Math.pow(1 - progress, 1.1), 0, 1);

    if (radius < SHOCKWAVE_MIN_VISIBLE_RADIUS || life <= MIN_VISIBLE_ALPHA) {
      return;
    }

    this.drawShockwaveRing(
      radius + SHOCKWAVE_RING_OFFSET,
      lineWidth,
      this.shockwaveColor,
      SHOCKWAVE_START_ALPHA * life * 0.78,
    );
    this.drawShockwaveRing(
      Math.max(0, radius - SHOCKWAVE_RING_OFFSET),
      lineWidth * 0.82,
      SHOCKWAVE_SECONDARY_COLOR,
      SHOCKWAVE_START_ALPHA * life * 0.52,
    );
    this.drawShockwaveRing(
      radius,
      lineWidth * 0.92,
      SHOCKWAVE_CORE_COLOR,
      SHOCKWAVE_START_ALPHA * life,
    );
  }

  private drawShockwaveRing(
    radius: number,
    lineWidth: number,
    color: number,
    alpha: number,
  ): void {
    if (!this.shockwaveGraphics) return;
    if (radius < SHOCKWAVE_MIN_VISIBLE_RADIUS) return;
    if (alpha <= MIN_VISIBLE_ALPHA) return;

    this.shockwaveGraphics.lineStyle(
      Math.max(1, lineWidth),
      color,
      this.clamp(alpha, 0, 1),
    );
    this.shockwaveGraphics.drawCircle(this.centerX, this.centerY, radius);
  }

  private renderDebris(): void {
    if (!this.debrisGraphics) return;

    this.debrisGraphics.clear();

    for (const particle of this.debrisPool) {
      if (!particle.active) continue;
      if (particle.alpha <= MIN_VISIBLE_ALPHA) continue;
      this.drawDebrisParticle(particle);
    }
  }

  private drawDebrisParticle(particle: DebrisParticle): void {
    if (!this.debrisGraphics) return;

    const halfW = particle.width * 0.5;
    const halfH = particle.height * 0.5;
    const cos = Math.cos(particle.rotation);
    const sin = Math.sin(particle.rotation);

    const x1 = particle.x - halfW * cos + halfH * sin;
    const y1 = particle.y - halfW * sin - halfH * cos;

    const x2 = particle.x + halfW * cos + halfH * sin;
    const y2 = particle.y + halfW * sin - halfH * cos;

    const x3 = particle.x + halfW * cos - halfH * sin;
    const y3 = particle.y + halfW * sin + halfH * cos;

    const x4 = particle.x - halfW * cos - halfH * sin;
    const y4 = particle.y - halfW * sin + halfH * cos;

    this.debrisGraphics.beginFill(
      this.debrisColor,
      this.clamp(particle.alpha, 0, 1),
    );
    this.debrisGraphics.drawPolygon([x1, y1, x2, y2, x3, y3, x4, y4]);
    this.debrisGraphics.endFill();
  }

  private logFrameState(): void {
    if (!SPLASH_DEBUG_ENABLED || !this.active) return;

    const bucket = Math.floor(this.shockwaveElapsedMs / 120);
    if (bucket === this.debugLastFrameBucket) return;
    this.debugLastFrameBucket = bucket;

    debugLog("frame", {
      shockwaveElapsedMs: Math.round(this.shockwaveElapsedMs),
      shockwaveDurationMs: SHOCKWAVE_DURATION_MS,
      activeDebris: this.countActiveDebris(),
    });
  }

  private countActiveDebris(): number {
    let count = 0;
    for (const particle of this.debrisPool) {
      if (particle.active) {
        count += 1;
      }
    }
    return count;
  }

  private hasActiveDebris(): boolean {
    for (const particle of this.debrisPool) {
      if (particle.active) {
        return true;
      }
    }
    return false;
  }

  private isShockwaveFinished(): boolean {
    return this.shockwaveElapsedMs >= SHOCKWAVE_DURATION_MS;
  }

  private isOutOfBounds(particle: DebrisParticle): boolean {
    return (
      particle.x < -DEBRIS_OUT_OF_BOUNDS_PADDING ||
      particle.x > this.screenWidth + DEBRIS_OUT_OF_BOUNDS_PADDING ||
      particle.y < -DEBRIS_OUT_OF_BOUNDS_PADDING ||
      particle.y > this.screenHeight + DEBRIS_OUT_OF_BOUNDS_PADDING
    );
  }

  private clearDebrisPool(): void {
    for (const particle of this.debrisPool) {
      particle.active = false;
      particle.alpha = 0;
      particle.elapsedMs = 0;
    }
  }

  private resetPlaybackState(): void {
    this.active = false;
    this.shockwaveElapsedMs = SHOCKWAVE_DURATION_MS;
  }

  private destroyGraphics(): void {
    if (this.shockwaveGraphics) {
      this.shockwaveGraphics.removeFromParent();
      this.shockwaveGraphics.destroy();
      this.shockwaveGraphics = null;
    }

    if (this.debrisGraphics) {
      this.debrisGraphics.removeFromParent();
      this.debrisGraphics.destroy();
      this.debrisGraphics = null;
    }
  }

  private clearGraphics(): void {
    this.shockwaveGraphics?.clear();
    this.debrisGraphics?.clear();
  }

  private resolveDeltaMs(delta: number): number {
    if (Number.isFinite(delta) && delta > 0) {
      return delta;
    }
    return FRAME_DURATION_MS;
  }

  private rgb01ToHex(red: number, green: number, blue: number): number {
    const r = Math.round(this.clamp(red, 0, 1) * 255);
    const g = Math.round(this.clamp(green, 0, 1) * 255);
    const b = Math.round(this.clamp(blue, 0, 1) * 255);

    return (r << 16) | (g << 8) | b;
  }

  private randomRange(min: number, max: number): number {
    if (max <= min) {
      return min;
    }
    return min + Math.random() * (max - min);
  }

  private randomSigned(magnitude: number): number {
    return this.randomRange(-magnitude, magnitude);
  }

  private lerp(from: number, to: number, t: number): number {
    return from + (to - from) * t;
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }
}
