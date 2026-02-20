import { CHARGE_SEQUENCE_CONFIG, SPLASH_COLORS } from "@/config/splash";
import { Graphics } from "@/lib/pixi";
import type { SplashCanvasContext, SplashRenderer } from "../types";

const LIGHTNING_CONFIG = CHARGE_SEQUENCE_CONFIG.lightning;

const LIGHTNING_POOL_SIZE = 8;
const MAX_LIGHTNING_POINTS = Math.max(2, LIGHTNING_CONFIG.segments.max + 1);

const FRAME_DURATION_MS = 1000 / 60;
const MIN_LIGHTNING_RADIUS = 80;
const MAX_LIGHTNING_RADIUS = 200;

const LIGHTNING_MIN_INTENSITY = 0.02;
const BURST_INTENSITY_FLOOR = 0.9;

const CENTER_JITTER_BASE = 6;
const CENTER_JITTER_INTENSITY_BOOST = 10;

const DURATION_VARIANCE_MIN = 0.85;
const DURATION_VARIANCE_MAX = 1.2;

const BASE_ALPHA_MIN = 0.35;
const BASE_ALPHA_MAX = 1;
const OUTER_ALPHA_MULTIPLIER = 0.72;
const INNER_ALPHA_BOOST = 1.15;

const OUTER_WIDTH_MULTIPLIER = 1.2;
const OUTER_WIDTH_INTENSITY_BOOST = 0.35;
const INNER_WIDTH_MULTIPLIER = 0.56;
const BURST_WIDTH_MULTIPLIER = 1.15;
const GLOW_LAYER_WIDTH_MULTIPLIER = 3.5;
const GLOW_LAYER_ALPHA_MULTIPLIER = 0.25;
const LIGHTNING_GLOW_COLOR = 0x00e5cc;

const SPREAD_BASE_SCALE = 0.55;
const SPREAD_INTENSITY_SCALE = 0.95;
const SPREAD_TANGENT_SCALE = 0.2;
const BURST_SPREAD_MULTIPLIER = 1.25;

const FLICKER_BASE = 0.8;
const FLICKER_AMPLITUDE = 0.2;

const DRAW_EPSILON = 0.01;
const POINT_OVERSCAN = 32;
const CORE_COLOR_BLEND = 0.58;

interface LightningBolt {
  active: boolean;
  elapsedMs: number;
  durationMs: number;
  baseAlpha: number;
  currentAlpha: number;
  outerWidth: number;
  innerWidth: number;
  glowWidth: number;
  flickerPhase: number;
  flickerSpeed: number;
  pointCount: number;
  pointsX: number[];
  pointsY: number[];
  spawnOrder: number;
}

export class LightningRenderer implements SplashRenderer {
  private ctx: SplashCanvasContext | null = null;
  private graphics: Graphics | null = null;
  private bolts: LightningBolt[] = [];

  private screenWidth = 1;
  private screenHeight = 1;
  private centerX = 0;
  private centerY = 0;

  private active = false;
  private intensity = 0;
  private spawnTimerMs = 0;
  private spawnCounter = 0;

  private lightningColor = 0;
  private coreColor: number = SPLASH_COLORS.white;

  init(ctx: SplashCanvasContext): void {
    if (this.graphics) {
      this.graphics.removeFromParent();
      this.graphics.destroy();
      this.graphics = null;
    }

    this.ctx = ctx;
    this.screenWidth = Math.max(1, ctx.screen.width);
    this.screenHeight = Math.max(1, ctx.screen.height);
    this.centerX = this.screenWidth * 0.5;
    this.centerY = this.screenHeight * 0.5;

    this.lightningColor = this.resolveLightningColor();
    this.coreColor = this.mixColor(
      this.lightningColor,
      SPLASH_COLORS.white,
      CORE_COLOR_BLEND,
    );

    this.graphics = new Graphics();
    ctx.layers.content.addChild(this.graphics);

    this.ensureBoltPool();
    this.resetBolts();

    this.spawnTimerMs = this.getSpawnInterval(this.intensity);
    this.renderBolts();
  }

  update(elapsed: number, delta: number): void {
    void elapsed;
    if (!this.ctx || !this.graphics) return;

    const deltaMs = this.resolveDeltaMs(delta);

    if (this.active && this.intensity > LIGHTNING_MIN_INTENSITY) {
      this.spawnTimerMs -= deltaMs;
      let safety = 0;

      while (this.spawnTimerMs <= 0 && safety < LIGHTNING_POOL_SIZE * 2) {
        this.spawnLightning(this.intensity, false);
        this.spawnTimerMs += this.getSpawnInterval(this.intensity);
        safety += 1;
      }
    } else {
      this.spawnTimerMs = this.getSpawnInterval(this.intensity);
    }

    for (const bolt of this.bolts) {
      if (!bolt.active) continue;

      bolt.elapsedMs += deltaMs;
      const progress = this.clamp(
        bolt.elapsedMs / Math.max(1, bolt.durationMs),
        0,
        1,
      );

      if (progress >= 1) {
        bolt.active = false;
        bolt.currentAlpha = 0;
        continue;
      }

      const life = 1 - progress;
      bolt.flickerPhase += bolt.flickerSpeed * (deltaMs / FRAME_DURATION_MS);
      const flicker =
        FLICKER_BASE + Math.sin(bolt.flickerPhase) * FLICKER_AMPLITUDE;

      bolt.currentAlpha = this.clamp(
        bolt.baseAlpha * life * life * Math.max(0.45, flicker),
        0,
        1,
      );
    }

    this.renderBolts();
  }

  resize(width: number, height: number): void {
    const safePrevWidth = Math.max(1, this.screenWidth);
    const safePrevHeight = Math.max(1, this.screenHeight);

    const normalizedCenterX = this.centerX / safePrevWidth;
    const normalizedCenterY = this.centerY / safePrevHeight;

    this.screenWidth = Math.max(1, width);
    this.screenHeight = Math.max(1, height);

    const scaleX = this.screenWidth / safePrevWidth;
    const scaleY = this.screenHeight / safePrevHeight;

    this.centerX = this.clamp(
      normalizedCenterX * this.screenWidth,
      -POINT_OVERSCAN,
      this.screenWidth + POINT_OVERSCAN,
    );
    this.centerY = this.clamp(
      normalizedCenterY * this.screenHeight,
      -POINT_OVERSCAN,
      this.screenHeight + POINT_OVERSCAN,
    );

    for (const bolt of this.bolts) {
      if (!bolt.active) continue;

      for (let index = 0; index < bolt.pointCount; index += 1) {
        bolt.pointsX[index] *= scaleX;
        bolt.pointsY[index] *= scaleY;
      }
    }

    this.renderBolts();
  }

  destroy(): void {
    if (this.graphics) {
      this.graphics.removeFromParent();
      this.graphics.destroy();
      this.graphics = null;
    }

    this.resetBolts();
    this.ctx = null;
    this.active = false;
    this.spawnTimerMs = 0;
  }

  setActive(active: boolean): void {
    this.active = active;
    this.spawnTimerMs = active ? 0 : this.getSpawnInterval(this.intensity);
  }

  setIntensity(intensity: number): void {
    this.intensity = this.clamp(intensity, 0, 1);

    if (this.active) {
      this.spawnTimerMs = Math.min(
        this.spawnTimerMs,
        this.getSpawnInterval(this.intensity),
      );
    }
  }

  setCenter(x: number, y: number): void {
    this.centerX = this.clamp(
      x,
      -POINT_OVERSCAN,
      this.screenWidth + POINT_OVERSCAN,
    );
    this.centerY = this.clamp(
      y,
      -POINT_OVERSCAN,
      this.screenHeight + POINT_OVERSCAN,
    );
  }

  triggerBurst(count: number): void {
    if (count <= 0) return;
    const resolvedCount = Math.floor(count);

    for (let index = 0; index < resolvedCount; index += 1) {
      this.spawnLightning(
        Math.max(this.intensity, BURST_INTENSITY_FLOOR),
        true,
      );
    }

    if (this.active) {
      this.spawnTimerMs = Math.min(
        this.spawnTimerMs,
        this.getSpawnInterval(Math.max(this.intensity, BURST_INTENSITY_FLOOR)) *
          0.5,
      );
    }

    this.renderBolts();
  }

  clearBolts(): void {
    this.resetBolts();
    this.spawnTimerMs = this.getSpawnInterval(this.intensity);
    this.renderBolts();
  }

  private ensureBoltPool(): void {
    if (this.bolts.length === LIGHTNING_POOL_SIZE) {
      return;
    }

    this.bolts = [];
    for (let index = 0; index < LIGHTNING_POOL_SIZE; index += 1) {
      this.bolts.push(this.createBolt());
    }
  }

  private createBolt(): LightningBolt {
    const pointsX = new Array<number>(MAX_LIGHTNING_POINTS);
    const pointsY = new Array<number>(MAX_LIGHTNING_POINTS);

    for (let index = 0; index < MAX_LIGHTNING_POINTS; index += 1) {
      pointsX[index] = 0;
      pointsY[index] = 0;
    }

    return {
      active: false,
      elapsedMs: 0,
      durationMs: LIGHTNING_CONFIG.duration,
      baseAlpha: 0,
      currentAlpha: 0,
      outerWidth: LIGHTNING_CONFIG.width,
      innerWidth: Math.max(1, LIGHTNING_CONFIG.width * INNER_WIDTH_MULTIPLIER),
      glowWidth: Math.max(
        1,
        LIGHTNING_CONFIG.width *
          OUTER_WIDTH_MULTIPLIER *
          GLOW_LAYER_WIDTH_MULTIPLIER,
      ),
      flickerPhase: 0,
      flickerSpeed: 0,
      pointCount: 0,
      pointsX,
      pointsY,
      spawnOrder: -1,
    };
  }

  private resetBolts(): void {
    for (const bolt of this.bolts) {
      bolt.active = false;
      bolt.elapsedMs = 0;
      bolt.durationMs = LIGHTNING_CONFIG.duration;
      bolt.baseAlpha = 0;
      bolt.currentAlpha = 0;
      bolt.pointCount = 0;
      bolt.spawnOrder = -1;
    }

    this.spawnCounter = 0;
  }

  private spawnLightning(intensity: number, burst: boolean): void {
    const resolvedIntensity = this.clamp(
      burst ? Math.max(intensity, BURST_INTENSITY_FLOOR) : intensity,
      0,
      1,
    );

    const bolt = this.acquireBolt();
    const centerJitter =
      CENTER_JITTER_BASE + resolvedIntensity * CENTER_JITTER_INTENSITY_BOOST;

    const startX = this.centerX + this.randomSigned(centerJitter);
    const startY = this.centerY + this.randomSigned(centerJitter);

    const direction = this.randomRange(0, Math.PI * 2);
    const perpendicularDirection = direction + Math.PI * 0.5;

    const radius = this.randomRange(MIN_LIGHTNING_RADIUS, MAX_LIGHTNING_RADIUS);
    const endX = startX + Math.cos(direction) * radius;
    const endY = startY + Math.sin(direction) * radius;

    const minSegments = Math.max(1, LIGHTNING_CONFIG.segments.min);
    const maxSegments = Math.max(minSegments, LIGHTNING_CONFIG.segments.max);
    const segments = this.randomInt(minSegments, maxSegments);

    const pointCount = Math.min(MAX_LIGHTNING_POINTS, segments + 1);

    const spreadBase =
      LIGHTNING_CONFIG.spread *
      (SPREAD_BASE_SCALE + resolvedIntensity * SPREAD_INTENSITY_SCALE);
    const spread = burst ? spreadBase * BURST_SPREAD_MULTIPLIER : spreadBase;

    bolt.active = true;
    bolt.elapsedMs = 0;
    bolt.durationMs =
      LIGHTNING_CONFIG.duration *
      this.randomRange(DURATION_VARIANCE_MIN, DURATION_VARIANCE_MAX);
    bolt.baseAlpha = this.clamp(
      this.lerp(BASE_ALPHA_MIN, BASE_ALPHA_MAX, resolvedIntensity) *
        this.randomRange(0.84, 1),
      0,
      1,
    );
    bolt.currentAlpha = bolt.baseAlpha;

    const widthBase =
      LIGHTNING_CONFIG.width * (burst ? BURST_WIDTH_MULTIPLIER : 1);
    bolt.outerWidth = Math.max(
      1,
      widthBase *
        (OUTER_WIDTH_MULTIPLIER +
          resolvedIntensity * OUTER_WIDTH_INTENSITY_BOOST),
    );
    bolt.innerWidth = Math.max(1, widthBase * INNER_WIDTH_MULTIPLIER);
    bolt.glowWidth = Math.max(1, bolt.outerWidth * GLOW_LAYER_WIDTH_MULTIPLIER);
    bolt.flickerPhase = this.randomRange(0, Math.PI * 2);
    bolt.flickerSpeed = this.randomRange(0.18, 0.42);
    bolt.pointCount = pointCount;
    bolt.spawnOrder = this.spawnCounter;
    this.spawnCounter += 1;

    for (let index = 0; index < pointCount; index += 1) {
      const progress = index / Math.max(1, pointCount - 1);
      let pointX = this.lerp(startX, endX, progress);
      let pointY = this.lerp(startY, endY, progress);

      if (index !== 0 && index !== pointCount - 1) {
        const spreadWeight = Math.sin(progress * Math.PI);
        const perpendicularOffset = this.randomSigned(spread * spreadWeight);
        const tangentOffset = this.randomSigned(
          spread * SPREAD_TANGENT_SCALE * resolvedIntensity * spreadWeight,
        );

        pointX +=
          Math.cos(perpendicularDirection) * perpendicularOffset +
          Math.cos(direction) * tangentOffset;
        pointY +=
          Math.sin(perpendicularDirection) * perpendicularOffset +
          Math.sin(direction) * tangentOffset;
      }

      bolt.pointsX[index] = this.clamp(
        pointX,
        -POINT_OVERSCAN,
        this.screenWidth + POINT_OVERSCAN,
      );
      bolt.pointsY[index] = this.clamp(
        pointY,
        -POINT_OVERSCAN,
        this.screenHeight + POINT_OVERSCAN,
      );
    }
  }

  private acquireBolt(): LightningBolt {
    for (const bolt of this.bolts) {
      if (!bolt.active) {
        return bolt;
      }
    }

    let oldestBolt = this.bolts[0];
    for (let index = 1; index < this.bolts.length; index += 1) {
      const current = this.bolts[index];
      if (current.spawnOrder < oldestBolt.spawnOrder) {
        oldestBolt = current;
      }
    }

    oldestBolt.active = false;
    oldestBolt.currentAlpha = 0;
    return oldestBolt;
  }

  private renderBolts(): void {
    if (!this.graphics) return;

    this.graphics.clear();

    for (const bolt of this.bolts) {
      if (!bolt.active) continue;
      if (bolt.pointCount < 2) continue;
      if (bolt.currentAlpha <= DRAW_EPSILON) continue;

      this.drawBoltPath(
        bolt,
        bolt.glowWidth,
        LIGHTNING_GLOW_COLOR,
        bolt.currentAlpha *
          OUTER_ALPHA_MULTIPLIER *
          GLOW_LAYER_ALPHA_MULTIPLIER,
      );

      this.drawBoltPath(
        bolt,
        bolt.outerWidth,
        this.lightningColor,
        bolt.currentAlpha * OUTER_ALPHA_MULTIPLIER,
      );

      this.drawBoltPath(
        bolt,
        bolt.innerWidth,
        this.coreColor,
        this.clamp(bolt.currentAlpha * INNER_ALPHA_BOOST, 0, 1),
      );
    }
  }

  private drawBoltPath(
    bolt: LightningBolt,
    lineWidth: number,
    color: number,
    alpha: number,
  ): void {
    if (!this.graphics) return;
    if (alpha <= DRAW_EPSILON) return;

    this.graphics.lineStyle(
      Math.max(0.5, lineWidth),
      color,
      this.clamp(alpha, 0, 1),
    );
    this.graphics.moveTo(bolt.pointsX[0], bolt.pointsY[0]);

    for (let index = 1; index < bolt.pointCount; index += 1) {
      this.graphics.lineTo(bolt.pointsX[index], bolt.pointsY[index]);
    }
  }

  private getSpawnInterval(intensity: number): number {
    return this.lerp(
      LIGHTNING_CONFIG.maxInterval,
      LIGHTNING_CONFIG.minInterval,
      this.clamp(intensity, 0, 1),
    );
  }

  private resolveLightningColor(): number {
    const [red, green, blue] = LIGHTNING_CONFIG.color;
    return this.rgbFloatToHex(red, green, blue);
  }

  private rgbFloatToHex(red: number, green: number, blue: number): number {
    const r = this.clamp(Math.round(red * 255), 0, 255);
    const g = this.clamp(Math.round(green * 255), 0, 255);
    const b = this.clamp(Math.round(blue * 255), 0, 255);

    return (r << 16) | (g << 8) | b;
  }

  private mixColor(from: number, to: number, t: number): number {
    const ratio = this.clamp(t, 0, 1);

    const fromR = (from >> 16) & 0xff;
    const fromG = (from >> 8) & 0xff;
    const fromB = from & 0xff;

    const toR = (to >> 16) & 0xff;
    const toG = (to >> 8) & 0xff;
    const toB = to & 0xff;

    const mixedR = Math.round(this.lerp(fromR, toR, ratio));
    const mixedG = Math.round(this.lerp(fromG, toG, ratio));
    const mixedB = Math.round(this.lerp(fromB, toB, ratio));

    return (mixedR << 16) | (mixedG << 8) | mixedB;
  }

  private resolveDeltaMs(delta: number): number {
    if (delta > 0) return delta;
    return FRAME_DURATION_MS;
  }

  private randomInt(min: number, max: number): number {
    if (max <= min) return min;
    return Math.floor(this.randomRange(min, max + 1));
  }

  private randomRange(min: number, max: number): number {
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
