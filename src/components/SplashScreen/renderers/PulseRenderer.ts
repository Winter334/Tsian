import { Graphics } from "@/lib/pixi";
import type { SplashCanvasContext, SplashRenderer } from "../types";

const PULSE_COLOR = 0x00e5cc;
const PULSE_DURATION_MS = 600;
const PULSE_RADIUS_OVERSCAN_MULTIPLIER = 1.08;
const PULSE_START_ALPHA = 0.62;
const PULSE_PEAK_ALPHA = 1;
const PULSE_END_ALPHA = 0;
const PULSE_FADE_START_PROGRESS = 0.88;
const PULSE_START_LINE_WIDTH = 2;
const PULSE_END_LINE_WIDTH = 3.4;
const PULSE_FOCUS_START_PROGRESS = 0.78;
const PULSE_FOCUS_END_PROGRESS = 0.96;
const PULSE_FOCUS_LINE_WIDTH_BOOST = 2.2;
const PULSE_FOCUS_ALPHA_BOOST = 0.18;

function easeInCubic(t: number): number {
  return t * t * t;
}

interface ActivePulse {
  graphics: Graphics;
  centerX: number;
  centerY: number;
  normalizedCenterX: number;
  normalizedCenterY: number;
  elapsedMs: number;
  maxRadius: number;
  onComplete: (() => void) | null;
  completionNotified: boolean;
}

export class PulseRenderer implements SplashRenderer {
  private ctx: SplashCanvasContext | null = null;
  private pulses: ActivePulse[] = [];
  private screenWidth: number = 0;
  private screenHeight: number = 0;

  init(ctx: SplashCanvasContext): void {
    this.ctx = ctx;
    this.screenWidth = Math.max(1, ctx.screen.width);
    this.screenHeight = Math.max(1, ctx.screen.height);
  }

  update(elapsed: number, delta: number): void {
    if (!this.ctx) return;
    if (this.pulses.length === 0) return;

    const elapsedMs = this.resolveElapsedMs(elapsed, delta);

    for (let index = this.pulses.length - 1; index >= 0; index -= 1) {
      const pulse = this.pulses[index];
      pulse.elapsedMs += elapsedMs;

      const progress = this.clamp(pulse.elapsedMs / PULSE_DURATION_MS, 0, 1);
      const easedRadiusProgress = easeInCubic(progress);
      const radius = this.lerp(pulse.maxRadius, 0, easedRadiusProgress);
      const focusBoost = this.getFocusBoost(progress);
      const alpha = this.getPulseAlpha(progress, focusBoost);
      const lineWidth = this.getPulseLineWidth(progress, focusBoost);

      pulse.graphics.clear();
      pulse.graphics.lineStyle(lineWidth, PULSE_COLOR, alpha);
      pulse.graphics.drawCircle(pulse.centerX, pulse.centerY, radius);

      const isCompleted = pulse.elapsedMs >= PULSE_DURATION_MS || progress >= 1;
      if (isCompleted) {
        if (!pulse.completionNotified) {
          pulse.completionNotified = true;
          pulse.onComplete?.();
        }

        pulse.graphics.removeFromParent();
        pulse.graphics.destroy();
        this.pulses.splice(index, 1);
      }
    }
  }

  resize(width: number, height: number): void {
    this.screenWidth = Math.max(1, width);
    this.screenHeight = Math.max(1, height);

    for (const pulse of this.pulses) {
      pulse.centerX = pulse.normalizedCenterX * this.screenWidth;
      pulse.centerY = pulse.normalizedCenterY * this.screenHeight;
    }
  }

  destroy(): void {
    for (const pulse of this.pulses) {
      pulse.graphics.removeFromParent();
      pulse.graphics.destroy();
    }

    this.pulses = [];
    this.ctx = null;
  }

  triggerPulse(
    centerX: number,
    centerY: number,
    maxRadius: number = this.getTargetRadius(),
    onComplete?: () => void,
  ): void {
    if (!this.ctx) return;

    const graphics = new Graphics();
    this.ctx.layers.ui.addChild(graphics);

    const normalizedCenterX = this.clamp(centerX / this.screenWidth, 0, 1);
    const normalizedCenterY = this.clamp(centerY / this.screenHeight, 0, 1);
    const resolvedMaxRadius =
      Number.isFinite(maxRadius) && maxRadius > 0
        ? maxRadius
        : this.getTargetRadius();

    const pulse: ActivePulse = {
      graphics,
      centerX,
      centerY,
      normalizedCenterX,
      normalizedCenterY,
      elapsedMs: 0,
      maxRadius: resolvedMaxRadius,
      onComplete: onComplete ?? null,
      completionNotified: false,
    };

    this.pulses.push(pulse);
  }

  isActive(): boolean {
    return this.pulses.length > 0;
  }

  private getTargetRadius(): number {
    const halfDiagonal = Math.hypot(this.screenWidth, this.screenHeight) * 0.5;
    return halfDiagonal * PULSE_RADIUS_OVERSCAN_MULTIPLIER;
  }

  private getPulseAlpha(progress: number, focusBoost: number): number {
    if (progress < PULSE_FADE_START_PROGRESS) {
      const riseProgress = this.clamp(
        progress / PULSE_FADE_START_PROGRESS,
        0,
        1,
      );
      const baseAlpha = this.lerp(
        PULSE_START_ALPHA,
        PULSE_PEAK_ALPHA,
        easeInCubic(riseProgress),
      );
      return this.clamp(baseAlpha + focusBoost * PULSE_FOCUS_ALPHA_BOOST, 0, 1);
    }

    const fadeProgress = this.clamp(
      (progress - PULSE_FADE_START_PROGRESS) / (1 - PULSE_FADE_START_PROGRESS),
      0,
      1,
    );

    return this.lerp(
      PULSE_PEAK_ALPHA,
      PULSE_END_ALPHA,
      easeInCubic(fadeProgress),
    );
  }

  private getPulseLineWidth(progress: number, focusBoost: number): number {
    const baseLineWidth = this.lerp(
      PULSE_START_LINE_WIDTH,
      PULSE_END_LINE_WIDTH,
      easeInCubic(progress),
    );

    return baseLineWidth + focusBoost * PULSE_FOCUS_LINE_WIDTH_BOOST;
  }

  private getFocusBoost(progress: number): number {
    if (
      progress <= PULSE_FOCUS_START_PROGRESS ||
      progress >= PULSE_FOCUS_END_PROGRESS
    ) {
      return 0;
    }

    const focusProgress = this.clamp(
      (progress - PULSE_FOCUS_START_PROGRESS) /
        (PULSE_FOCUS_END_PROGRESS - PULSE_FOCUS_START_PROGRESS),
      0,
      1,
    );

    return Math.sin(focusProgress * Math.PI);
  }

  private resolveElapsedMs(elapsed: number, delta: number): number {
    void elapsed;
    if (delta > 0) return delta;
    return 1000 / 60;
  }

  private lerp(from: number, to: number, t: number): number {
    return from + (to - from) * t;
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }
}
