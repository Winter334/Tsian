import { CHARGE_SEQUENCE_CONFIG } from "@/config/splash";
import { Graphics } from "@/lib/pixi";
import type {
  ParticleMode,
  SplashCanvasContext,
  SplashRenderer,
} from "../types";

const FRAME_DURATION_MS = 1000 / 60;
const SCREEN_PADDING = 32;
const BURST_TO_DRIFT_DELAY_MS = 520;

const BASE_ALPHA_MIN = 0.42;
const BASE_ALPHA_MAX = 0.92;
const MIN_VISIBLE_ALPHA = 0.01;
const EPSILON = 0.0001;

const PARTICLE_BASE_SIZE_SCALE = 0.58;

const BURST_DAMPING = 0.965;
const DRIFT_DAMPING = 0.985;
const BRAKE_DAMPING = 0.85;
const EXPLODE_DAMPING = 0.935;

const FOCAL_LENGTH = 128;
const MAX_Z = 1000;
const MIN_Z = 1;
const BASE_WARP_FACTOR = 0.5;
const MAX_WARP_FACTOR = 28;
const WARP_TRAIL_THRESHOLD = 5;

const ACCELERATE_RADIAL_SPEED_MIN = 2.2;
const ACCELERATE_RADIAL_SPEED_MAX = 26;
const ACCELERATE_DIRECTION_BLEND_BASE = 0.2;
const ACCELERATE_DIRECTION_BLEND_BOOST = 0.48;
const ACCELERATE_SPEED_BLEND_BASE = 0.12;
const ACCELERATE_SPEED_BLEND_BOOST = 0.52;
const ACCELERATE_RECYCLE_RADIUS_MIN = 8;
const ACCELERATE_RECYCLE_RADIUS_MAX_FACTOR = 0.22;

const IMPLODE_DURATION_MS = Math.max(
  1,
  CHARGE_SEQUENCE_CONFIG.particles.implodeDuration,
);
const IMPLODE_COLLAPSE_POWER = 4;
const IMPLODE_ALPHA_FALLOFF_POWER = 1.7;
const IMPLODE_CENTER_THRESHOLD = 2;

const EXPLODE_POOL_MULTIPLIER = 3;

const PARTICLE_COUNT = Math.max(1, CHARGE_SEQUENCE_CONFIG.particles.count);
const EXPLODE_PARTICLE_COUNT = Math.max(
  PARTICLE_COUNT,
  Math.round(PARTICLE_COUNT * EXPLODE_POOL_MULTIPLIER),
);
const TRAIL_LENGTH = Math.max(6, CHARGE_SEQUENCE_CONFIG.particles.trailLength);

const CONFIRM_BURST_SPEED_MIN = 34;
const CONFIRM_BURST_SPEED_MAX = 72;
const CONFIRM_BURST_START_RADIUS_FACTOR = 0.024;

const IMPLODE_PARTICLE_MULTIPLIER = 2.25;
const IMPLODE_ACTIVE_PARTICLE_COUNT = Math.min(
  EXPLODE_PARTICLE_COUNT,
  Math.max(
    PARTICLE_COUNT,
    Math.round(PARTICLE_COUNT * IMPLODE_PARTICLE_MULTIPLIER),
  ),
);

const SPLASH_DEBUG_ENABLED =
  typeof window !== "undefined" &&
  import.meta.env.DEV &&
  new URLSearchParams(window.location.search).has("splashDebug");

function debugLog(message: string, payload?: Record<string, unknown>): void {
  if (!SPLASH_DEBUG_ENABLED) return;

  if (payload) {
    console.debug(`[SplashDebug][ParticleRenderer] ${message}`, payload);
    return;
  }

  console.debug(`[SplashDebug][ParticleRenderer] ${message}`);
}

type BurstPreset = "default" | "confirmFullscreen";

interface ParticleModeOptions {
  burstPreset?: BurstPreset;
}

interface Particle {
  active: boolean;
  x: number;
  y: number;
  z: number;
  prevX: number;
  prevY: number;
  prevProjX: number;
  prevProjY: number;
  vx: number;
  vy: number;
  alpha: number;
  size: number;
  baseSize: number;
  color: number;
  pulseOffset: number;
  warpDirectionX: number;
  warpDirectionY: number;
  implodeStartX: number;
  implodeStartY: number;
  implodeStartDistance: number;
  implodeSpinDirection: number;
  implodeSpinPhase: number;
  trailX: number[];
  trailY: number[];
}

export class ParticleRenderer implements SplashRenderer {
  private ctx: SplashCanvasContext | null = null;
  private graphics: Graphics | null = null;
  private particles: Particle[] = [];

  private mode: ParticleMode = "drift";

  private screenWidth = 1;
  private screenHeight = 1;
  private centerX = 0;
  private centerY = 0;

  private elapsedMs = 0;
  private modeElapsedMs = 0;
  private accelerateProgress = 0;
  private implodeProgress = 0;
  private _warpFactor = BASE_WARP_FACTOR;
  private _targetWarpFactor = BASE_WARP_FACTOR;

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

    this.graphics = new Graphics();
    this.ctx.layers.content.addChild(this.graphics);

    this.ensureParticlePool();
    this.mode = "drift";
    this.elapsedMs = 0;
    this.modeElapsedMs = 0;
    this.accelerateProgress = 0;
    this.implodeProgress = 0;
    this._warpFactor = BASE_WARP_FACTOR;
    this._targetWarpFactor = BASE_WARP_FACTOR;

    this.deactivateAllParticles();
    this.initializeStarfield(PARTICLE_COUNT);
    this.renderParticles();
  }

  update(elapsed: number, delta: number): void {
    if (!this.graphics) return;

    const deltaMs = this.resolveDeltaMs(delta);
    const frameScale = deltaMs / FRAME_DURATION_MS;

    this.elapsedMs = Math.max(0, elapsed);
    this.modeElapsedMs += deltaMs;

    switch (this.mode) {
      case "burst":
        this.updateBurst(frameScale);
        if (this.modeElapsedMs >= BURST_TO_DRIFT_DELAY_MS) {
          this.mode = "drift";
          this.modeElapsedMs = 0;
          this.trimToBaseStarCount();
          this.stabilizeForDrift("burst");
        }
        break;
      case "drift":
        this.updateDrift(frameScale);
        break;
      case "accelerate":
        this.updateAccelerate(frameScale);
        break;
      case "brake":
        this.updateBrake(frameScale);
        break;
      case "implode":
        this.updateImplode(frameScale);
        break;
      case "explode":
        this.updateExplode(frameScale);
        break;
    }

    this.renderParticles();
  }

  resize(width: number, height: number): void {
    const previousWidth = Math.max(1, this.screenWidth);
    const previousHeight = Math.max(1, this.screenHeight);
    const normalizedCenterX = this.centerX / previousWidth;
    const normalizedCenterY = this.centerY / previousHeight;

    this.screenWidth = Math.max(1, width);
    this.screenHeight = Math.max(1, height);

    this.centerX = normalizedCenterX * this.screenWidth;
    this.centerY = normalizedCenterY * this.screenHeight;

    const scaleX = this.screenWidth / previousWidth;
    const scaleY = this.screenHeight / previousHeight;

    for (const particle of this.particles) {
      if (!particle.active) continue;

      particle.x *= scaleX;
      particle.y *= scaleY;
      particle.prevX *= scaleX;
      particle.prevY *= scaleY;
      particle.vx *= scaleX;
      particle.vy *= scaleY;
      this.wrapPosition(particle);
      this.resetTrail(particle, particle.x, particle.y);
      this.resetProjectionHistory(particle);
    }

    if (this.mode === "implode") {
      this.prepareImplodeState();
    }
  }

  destroy(): void {
    if (this.graphics) {
      this.graphics.removeFromParent();
      this.graphics.destroy();
      this.graphics = null;
    }

    this.deactivateAllParticles();

    this.ctx = null;
    this.elapsedMs = 0;
    this.modeElapsedMs = 0;
    this.accelerateProgress = 0;
    this.implodeProgress = 0;
    this._warpFactor = BASE_WARP_FACTOR;
    this._targetWarpFactor = BASE_WARP_FACTOR;
  }

  setMode(mode: ParticleMode, options: ParticleModeOptions = {}): void {
    const retriggerableMode =
      mode === "burst" || mode === "implode" || mode === "explode";

    if (
      mode === this.mode &&
      !retriggerableMode &&
      (mode !== "drift" || this.hasActiveParticles())
    ) {
      return;
    }

    const previousMode = this.mode;
    const burstPreset = options.burstPreset ?? "default";

    this.mode = mode;
    this.modeElapsedMs = 0;
    this.accelerateProgress = 0;
    this.implodeProgress = 0;

    if (mode === "implode" || mode === "explode") {
      this.setWarpFactor(0);
    } else {
      this.setWarpFactor(BASE_WARP_FACTOR);
    }

    debugLog("mode switch", {
      from: previousMode,
      to: mode,
      retriggered: mode === previousMode,
      burstPreset,
      activeParticles: this.particles.filter((particle) => particle.active)
        .length,
    });

    switch (mode) {
      case "burst":
        this.triggerBurstFromCenter(burstPreset);
        break;
      case "drift":
        if (previousMode === "explode") {
          this.initializeStarfield(PARTICLE_COUNT);
          break;
        }

        if (!this.hasActiveParticles()) {
          this.initializeStarfield(PARTICLE_COUNT);
          break;
        }

        this.trimToBaseStarCount();
        this.stabilizeForDrift(previousMode);
        break;
      case "accelerate":
        if (!this.hasActiveParticles()) {
          this.initializeStarfield(PARTICLE_COUNT);
        }
        this.trimToBaseStarCount();
        this.prepareAccelerateState();
        break;
      case "brake":
        this.prepareBrakeState();
        this.accelerateProgress = 1;
        break;
      case "implode":
        this.ensureImplodeParticleDensity();
        this.prepareImplodeState();
        break;
      case "explode":
        this.triggerExplosionBurstFromCenter();
        break;
    }

    this.renderParticles();
  }

  setCenter(x: number, y: number): void {
    this.centerX = this.clamp(
      x,
      -SCREEN_PADDING,
      this.screenWidth + SCREEN_PADDING,
    );
    this.centerY = this.clamp(
      y,
      -SCREEN_PADDING,
      this.screenHeight + SCREEN_PADDING,
    );

    if (this.mode === "implode") {
      this.prepareImplodeState();
    }
  }

  setWarpFactor(target: number): void {
    this._targetWarpFactor = this.clamp(target, 0, MAX_WARP_FACTOR);
  }

  isActive(): boolean {
    for (const particle of this.particles) {
      if (particle.active && particle.alpha > MIN_VISIBLE_ALPHA) {
        return true;
      }
    }

    return false;
  }

  deactivateAll(): void {
    this.deactivateAllParticles();
    this.modeElapsedMs = 0;
    this.accelerateProgress = 0;
    this.implodeProgress = 0;
    this._warpFactor = BASE_WARP_FACTOR;
    this._targetWarpFactor = BASE_WARP_FACTOR;
    this.renderParticles();
  }

  private hasActiveParticles(): boolean {
    for (const particle of this.particles) {
      if (particle.active) {
        return true;
      }
    }

    return false;
  }

  private ensureParticlePool(): void {
    if (this.particles.length === EXPLODE_PARTICLE_COUNT) {
      return;
    }

    this.particles = [];
    for (let index = 0; index < EXPLODE_PARTICLE_COUNT; index += 1) {
      this.particles.push(this.createParticle());
    }
  }

  private deactivateParticle(particle: Particle): void {
    particle.active = false;
    particle.alpha = 0;
    particle.vx = 0;
    particle.vy = 0;
    particle.z = FOCAL_LENGTH;
    particle.implodeStartDistance = 0;
    this.resetProjectionHistory(particle);
  }

  private deactivateAllParticles(): void {
    for (const particle of this.particles) {
      this.deactivateParticle(particle);
    }
  }

  private createParticle(): Particle {
    const trailX = new Array<number>(TRAIL_LENGTH);
    const trailY = new Array<number>(TRAIL_LENGTH);

    for (let index = 0; index < TRAIL_LENGTH; index += 1) {
      trailX[index] = 0;
      trailY[index] = 0;
    }

    return {
      active: false,
      x: 0,
      y: 0,
      z: FOCAL_LENGTH,
      prevX: 0,
      prevY: 0,
      prevProjX: 0,
      prevProjY: 0,
      vx: 0,
      vy: 0,
      alpha: 0,
      size: 0,
      baseSize: 0,
      color: this.resolveParticleColor(),
      pulseOffset: 0,
      warpDirectionX: 0,
      warpDirectionY: 1,
      implodeStartX: 0,
      implodeStartY: 0,
      implodeStartDistance: 0,
      implodeSpinDirection: 1,
      implodeSpinPhase: 0,
      trailX,
      trailY,
    };
  }

  private trimToBaseStarCount(): void {
    let kept = 0;

    for (const particle of this.particles) {
      if (!particle.active) continue;

      if (kept < PARTICLE_COUNT) {
        kept += 1;
        continue;
      }

      this.deactivateParticle(particle);
    }

    for (const particle of this.particles) {
      if (kept >= PARTICLE_COUNT) {
        break;
      }

      if (particle.active) continue;

      this.activateStarParticle(particle);
      kept += 1;
    }
  }

  private ensureImplodeParticleDensity(): void {
    let activeCount = 0;

    for (const particle of this.particles) {
      if (particle.active) {
        activeCount += 1;
      }
    }

    if (activeCount > IMPLODE_ACTIVE_PARTICLE_COUNT) {
      let kept = 0;
      for (const particle of this.particles) {
        if (!particle.active) continue;

        if (kept < IMPLODE_ACTIVE_PARTICLE_COUNT) {
          kept += 1;
          continue;
        }

        this.deactivateParticle(particle);
      }
      activeCount = IMPLODE_ACTIVE_PARTICLE_COUNT;
    }

    if (activeCount >= IMPLODE_ACTIVE_PARTICLE_COUNT) {
      return;
    }

    for (const particle of this.particles) {
      if (activeCount >= IMPLODE_ACTIVE_PARTICLE_COUNT) {
        break;
      }

      if (particle.active) continue;

      this.activateStarParticle(particle);
      activeCount += 1;
    }
  }

  private initializeStarfield(activeCount: number): void {
    const normalizedCount = this.clamp(
      Math.round(activeCount),
      0,
      this.particles.length,
    );

    for (let index = 0; index < this.particles.length; index += 1) {
      const particle = this.particles[index];
      if (index < normalizedCount) {
        this.activateStarParticle(particle);
      } else {
        this.deactivateParticle(particle);
      }
    }
  }

  private activateStarParticle(particle: Particle): void {
    const direction = this.randomRange(0, Math.PI * 2);
    const speed = this.randomRange(
      CHARGE_SEQUENCE_CONFIG.particles.driftSpeed.min,
      CHARGE_SEQUENCE_CONFIG.particles.driftSpeed.max,
    );
    const baseSize =
      this.randomRange(
        CHARGE_SEQUENCE_CONFIG.particles.size.min,
        CHARGE_SEQUENCE_CONFIG.particles.size.max,
      ) * PARTICLE_BASE_SIZE_SCALE;

    const x = this.centerX + this.randomSigned(this.screenWidth);
    const y = this.centerY + this.randomSigned(this.screenHeight);

    particle.active = true;
    particle.x = x;
    particle.y = y;
    particle.z = this.randomRange(MIN_Z, MAX_Z);
    particle.prevX = x;
    particle.prevY = y;
    particle.prevProjX = 0;
    particle.prevProjY = 0;
    particle.vx = Math.cos(direction) * speed;
    particle.vy = Math.sin(direction) * speed;
    particle.alpha = this.randomRange(BASE_ALPHA_MIN, BASE_ALPHA_MAX);
    particle.baseSize = baseSize;
    particle.size = baseSize * this.randomRange(0.92, 1.08);
    particle.color = this.resolveParticleColor();
    particle.pulseOffset = this.randomRange(0, Math.PI * 2);
    particle.warpDirectionX = Math.cos(direction);
    particle.warpDirectionY = Math.sin(direction);
    particle.implodeStartX = x;
    particle.implodeStartY = y;
    particle.implodeStartDistance = 0;
    particle.implodeSpinDirection = Math.random() < 0.5 ? -1 : 1;
    particle.implodeSpinPhase = this.randomRange(0, Math.PI * 2);
    this.resetTrail(particle, x, y);
  }

  private activateCenterParticle(
    particle: Particle,
    speedMin: number,
    speedMax: number,
    alphaMin: number,
    alphaMax: number,
    sizeScaleMin: number,
    sizeScaleMax: number,
    maxStartRadius: number,
  ): void {
    const angle = this.randomRange(0, Math.PI * 2);
    const speed = this.randomRange(speedMin, speedMax);
    const startRadius = this.randomRange(0, Math.max(0, maxStartRadius));
    const baseSize =
      this.randomRange(
        CHARGE_SEQUENCE_CONFIG.particles.size.min,
        CHARGE_SEQUENCE_CONFIG.particles.size.max,
      ) * PARTICLE_BASE_SIZE_SCALE;

    const x = this.centerX + Math.cos(angle) * startRadius;
    const y = this.centerY + Math.sin(angle) * startRadius;

    particle.active = true;
    particle.x = x;
    particle.y = y;
    particle.z = FOCAL_LENGTH;
    particle.prevX = x;
    particle.prevY = y;
    particle.prevProjX = 0;
    particle.prevProjY = 0;
    particle.vx = Math.cos(angle) * speed;
    particle.vy = Math.sin(angle) * speed;
    particle.alpha = this.randomRange(alphaMin, alphaMax);
    particle.baseSize = baseSize;
    particle.size = baseSize * this.randomRange(sizeScaleMin, sizeScaleMax);
    particle.color = this.resolveParticleColor();
    particle.pulseOffset = this.randomRange(0, Math.PI * 2);
    particle.warpDirectionX = Math.cos(angle);
    particle.warpDirectionY = Math.sin(angle);
    particle.implodeStartX = x;
    particle.implodeStartY = y;
    particle.implodeStartDistance = Math.max(
      IMPLODE_CENTER_THRESHOLD,
      startRadius,
    );
    particle.implodeSpinDirection = Math.random() < 0.5 ? -1 : 1;
    particle.implodeSpinPhase = this.randomRange(0, Math.PI * 2);

    this.resetTrail(particle, x, y);
  }

  private triggerBurstFromCenter(preset: BurstPreset): void {
    const burstSpeed = CHARGE_SEQUENCE_CONFIG.particles.burstSpeed;
    const isConfirmPreset = preset === "confirmFullscreen";

    const burstFrameCount = Math.max(
      1,
      Math.round(BURST_TO_DRIFT_DELAY_MS / FRAME_DURATION_MS),
    );
    const burstTravelFactor =
      (1 - Math.pow(BURST_DAMPING, burstFrameCount)) / (1 - BURST_DAMPING);

    const halfDiagonal = Math.hypot(this.screenWidth, this.screenHeight) * 0.5;
    const minTravelDistance = halfDiagonal * 0.92;
    const maxTravelDistance = halfDiagonal * 1.38;

    const adaptiveSpeedMin =
      minTravelDistance / Math.max(EPSILON, burstTravelFactor);
    const adaptiveSpeedMax =
      maxTravelDistance / Math.max(EPSILON, burstTravelFactor);

    const speedMin = isConfirmPreset
      ? Math.max(CONFIRM_BURST_SPEED_MIN, adaptiveSpeedMin)
      : burstSpeed.min;
    const speedMax = isConfirmPreset
      ? Math.max(speedMin + 8, CONFIRM_BURST_SPEED_MAX, adaptiveSpeedMax)
      : burstSpeed.max;
    const startRadius = isConfirmPreset
      ? Math.max(
          4,
          Math.min(this.screenWidth, this.screenHeight) *
            CONFIRM_BURST_START_RADIUS_FACTOR,
        )
      : 2;

    const alphaMin = isConfirmPreset ? 0.78 : 0.74;
    const alphaMax = 1;
    const sizeScaleMin = isConfirmPreset ? 0.86 : 0.95;
    const sizeScaleMax = isConfirmPreset ? 1.34 : 1.2;

    for (let index = 0; index < this.particles.length; index += 1) {
      const particle = this.particles[index];
      if (index >= PARTICLE_COUNT) {
        this.deactivateParticle(particle);
        continue;
      }

      this.activateCenterParticle(
        particle,
        speedMin,
        speedMax,
        alphaMin,
        alphaMax,
        sizeScaleMin,
        sizeScaleMax,
        startRadius,
      );
    }
  }

  private prepareAccelerateState(): void {
    const driftSpeed = CHARGE_SEQUENCE_CONFIG.particles.driftSpeed;

    for (const particle of this.particles) {
      if (!particle.active) continue;

      if (!Number.isFinite(particle.z) || particle.z < MIN_Z) {
        particle.z = this.randomRange(MAX_Z * 0.35, MAX_Z);
      }

      let dx = particle.x - this.centerX;
      let dy = particle.y - this.centerY;
      let distance = Math.hypot(dx, dy);

      if (distance <= EPSILON) {
        const angle = this.randomRange(0, Math.PI * 2);
        dx = Math.cos(angle);
        dy = Math.sin(angle);
        distance = 1;
      }

      particle.warpDirectionX = dx / distance;
      particle.warpDirectionY = dy / distance;

      const speed = Math.hypot(particle.vx, particle.vy);
      if (!Number.isFinite(speed) || speed < driftSpeed.min * 0.65) {
        const safeSpeed = this.randomRange(
          driftSpeed.min,
          driftSpeed.max * 1.2,
        );
        particle.vx = particle.warpDirectionX * safeSpeed;
        particle.vy = particle.warpDirectionY * safeSpeed;
      }

      particle.alpha = this.clamp(particle.alpha, BASE_ALPHA_MIN * 0.9, 1);
      particle.size = Math.max(particle.baseSize * 0.86, particle.size);
      this.resetTrail(particle, particle.x, particle.y);
      this.resetProjectionHistory(particle);
    }
  }

  private prepareBrakeState(): void {
    const driftSpeed = CHARGE_SEQUENCE_CONFIG.particles.driftSpeed;

    if (!this.hasActiveParticles()) {
      this.initializeStarfield(PARTICLE_COUNT);
    }

    this.trimToBaseStarCount();

    for (const particle of this.particles) {
      if (!particle.active) continue;

      if (!Number.isFinite(particle.z) || particle.z < MIN_Z) {
        particle.z = this.randomRange(MAX_Z * 0.28, MAX_Z * 0.92);
      }

      const speed = Math.hypot(particle.vx, particle.vy);

      if (!Number.isFinite(speed) || speed <= EPSILON) {
        const angle = this.randomRange(0, Math.PI * 2);
        const seededSpeed = this.randomRange(
          driftSpeed.min * 1.2,
          driftSpeed.max * 1.8,
        );
        particle.vx = Math.cos(angle) * seededSpeed;
        particle.vy = Math.sin(angle) * seededSpeed;
        particle.warpDirectionX = Math.cos(angle);
        particle.warpDirectionY = Math.sin(angle);
      } else {
        particle.warpDirectionX = particle.vx / speed;
        particle.warpDirectionY = particle.vy / speed;
      }

      particle.alpha = this.clamp(particle.alpha, BASE_ALPHA_MIN * 0.85, 1);
      particle.size = Math.max(particle.baseSize * 0.74, particle.size * 0.82);
      this.resetTrail(particle, particle.x, particle.y);
      this.resetProjectionHistory(particle);
    }
  }

  private prepareImplodeState(): void {
    if (!this.hasActiveParticles()) {
      this.initializeStarfield(PARTICLE_COUNT);
    }

    for (const particle of this.particles) {
      if (!particle.active) continue;

      particle.z = FOCAL_LENGTH;
      this.resetProjectionHistory(particle);

      let x = particle.x;
      let y = particle.y;

      let dx = x - this.centerX;
      let dy = y - this.centerY;
      let distance = Math.hypot(dx, dy);

      if (distance < IMPLODE_CENTER_THRESHOLD) {
        const angle = this.randomRange(0, Math.PI * 2);
        const radius = this.randomRange(
          IMPLODE_CENTER_THRESHOLD * 2,
          Math.max(
            IMPLODE_CENTER_THRESHOLD * 3,
            Math.min(this.screenWidth, this.screenHeight) * 0.12,
          ),
        );
        x = this.centerX + Math.cos(angle) * radius;
        y = this.centerY + Math.sin(angle) * radius;
        particle.x = x;
        particle.y = y;
        particle.prevX = x;
        particle.prevY = y;

        dx = x - this.centerX;
        dy = y - this.centerY;
        distance = Math.hypot(dx, dy);
      }

      particle.implodeStartX = x;
      particle.implodeStartY = y;
      particle.implodeStartDistance = Math.max(
        IMPLODE_CENTER_THRESHOLD,
        distance,
      );
      particle.warpDirectionX = dx / Math.max(EPSILON, distance);
      particle.warpDirectionY = dy / Math.max(EPSILON, distance);

      const inferredSpin = Math.sign(dx * particle.vy - dy * particle.vx);
      particle.implodeSpinDirection =
        inferredSpin === 0 ? (Math.random() < 0.5 ? -1 : 1) : inferredSpin;
      particle.implodeSpinPhase = this.randomRange(0, Math.PI * 2);

      particle.vx *= 0.45;
      particle.vy *= 0.45;
      particle.alpha = Math.max(0.82, particle.alpha);
      particle.size = Math.max(particle.baseSize * 0.92, particle.size);
      this.resetTrail(particle, particle.x, particle.y);
    }
  }

  private triggerExplosionBurstFromCenter(): void {
    const explodeSpeed = CHARGE_SEQUENCE_CONFIG.particles.explodeSpeed;
    const speedMin = explodeSpeed.min * 1.1;
    const speedMax = explodeSpeed.max * 2.15;

    for (const particle of this.particles) {
      this.activateCenterParticle(
        particle,
        speedMin,
        speedMax,
        0.76,
        1,
        0.9,
        1.45,
        6,
      );
    }
  }

  private updateBurst(frameScale: number): void {
    const damping = Math.pow(BURST_DAMPING, frameScale);

    for (const particle of this.particles) {
      if (!particle.active) continue;

      this.captureHistory(particle);

      this.applyBrownian(particle, 0.016 * frameScale);

      particle.x += particle.vx * frameScale;
      particle.y += particle.vy * frameScale;

      particle.vx *= damping;
      particle.vy *= damping;

      particle.alpha = this.clamp(
        particle.alpha * Math.pow(0.992, frameScale),
        BASE_ALPHA_MIN * 0.74,
        1,
      );
      particle.size = this.lerp(
        particle.size,
        particle.baseSize * 0.92,
        0.1 * frameScale,
      );

      this.wrapPosition(particle);
      this.pushTrailPoint(particle, particle.prevX, particle.prevY);
    }
  }

  private updateDrift(frameScale: number): void {
    const driftSpeed = CHARGE_SEQUENCE_CONFIG.particles.driftSpeed;
    const damping = Math.pow(DRIFT_DAMPING, frameScale);

    this._targetWarpFactor = BASE_WARP_FACTOR;
    this.updateWarpFactor(frameScale);

    for (const particle of this.particles) {
      if (!particle.active) continue;

      this.captureHistory(particle);
      this.applyBrownian(particle, 0.0048 * frameScale);

      particle.vx *= damping;
      particle.vy *= damping;
      this.enforceSpeedRange(
        particle,
        driftSpeed.min * 0.28,
        driftSpeed.max * 0.52,
      );

      particle.x += particle.vx * frameScale * 0.42;
      particle.y += particle.vy * frameScale * 0.42;

      particle.z -= this._warpFactor * frameScale;
      if (particle.z < MIN_Z) {
        this.recycleDepthParticle(particle);
        continue;
      }

      if (
        this.isOutOfBounds(
          particle,
          Math.max(this.screenWidth, this.screenHeight),
        )
      ) {
        this.recycleDepthParticle(particle);
        continue;
      }

      const pulse =
        0.5 + 0.5 * Math.sin(this.elapsedMs * 0.0021 + particle.pulseOffset);
      particle.alpha = this.clamp(
        this.lerp(BASE_ALPHA_MIN, BASE_ALPHA_MAX, pulse),
        0,
        1,
      );
      particle.size = particle.baseSize * (0.86 + pulse * 0.22);

      this.pushTrailPoint(particle, particle.prevX, particle.prevY);
    }
  }

  private updateAccelerate(frameScale: number): void {
    const chargeThreshold = Math.max(
      1,
      CHARGE_SEQUENCE_CONFIG.charge.holdThreshold,
    );
    const rawProgress = this.clamp(this.modeElapsedMs / chargeThreshold, 0, 1);
    this.accelerateProgress = rawProgress;

    const easedProgress = this.easeOutCubic(rawProgress);
    const warpProgress = 0.14 + easedProgress * 0.86;

    this._targetWarpFactor = this.lerp(
      BASE_WARP_FACTOR,
      MAX_WARP_FACTOR,
      rawProgress,
    );
    this.updateWarpFactor(frameScale);

    const targetBaseSpeed = this.lerp(
      ACCELERATE_RADIAL_SPEED_MIN,
      ACCELERATE_RADIAL_SPEED_MAX,
      Math.pow(rawProgress, 1.25),
    );
    const distanceNormDenominator = Math.max(
      1,
      Math.min(this.screenWidth, this.screenHeight) * 0.5,
    );

    for (const particle of this.particles) {
      if (!particle.active) continue;

      this.captureHistory(particle);

      let dx = particle.x - this.centerX;
      let dy = particle.y - this.centerY;
      let distance = Math.hypot(dx, dy);

      if (distance <= EPSILON) {
        dx = particle.warpDirectionX;
        dy = particle.warpDirectionY;
        distance = Math.hypot(dx, dy);

        if (distance <= EPSILON) {
          const angle = this.randomRange(0, Math.PI * 2);
          dx = Math.cos(angle);
          dy = Math.sin(angle);
          distance = 1;
        }
      }

      const radialX = dx / distance;
      const radialY = dy / distance;

      particle.warpDirectionX = this.lerp(
        particle.warpDirectionX,
        radialX,
        0.24 * frameScale,
      );
      particle.warpDirectionY = this.lerp(
        particle.warpDirectionY,
        radialY,
        0.24 * frameScale,
      );

      const warpDirectionLength = Math.hypot(
        particle.warpDirectionX,
        particle.warpDirectionY,
      );
      if (warpDirectionLength > EPSILON) {
        particle.warpDirectionX /= warpDirectionLength;
        particle.warpDirectionY /= warpDirectionLength;
      } else {
        particle.warpDirectionX = radialX;
        particle.warpDirectionY = radialY;
      }

      const distanceFactor =
        0.55 +
        this.clamp(distance / distanceNormDenominator, 0, 1) *
          (1.25 + rawProgress * 0.8);
      const targetSpeed = targetBaseSpeed * distanceFactor;
      const currentSpeed = Math.hypot(particle.vx, particle.vy);

      const speedBlend = this.clamp(
        (ACCELERATE_SPEED_BLEND_BASE +
          rawProgress * ACCELERATE_SPEED_BLEND_BOOST) *
          frameScale,
        0,
        1,
      );
      const nextSpeed = this.lerp(currentSpeed, targetSpeed, speedBlend);

      const desiredVX = particle.warpDirectionX * nextSpeed;
      const desiredVY = particle.warpDirectionY * nextSpeed;

      const directionBlend = this.clamp(
        (ACCELERATE_DIRECTION_BLEND_BASE +
          rawProgress * ACCELERATE_DIRECTION_BLEND_BOOST) *
          frameScale,
        0,
        1,
      );
      particle.vx = this.lerp(particle.vx, desiredVX, directionBlend);
      particle.vy = this.lerp(particle.vy, desiredVY, directionBlend);

      particle.x += particle.vx * frameScale;
      particle.y += particle.vy * frameScale;

      particle.z -=
        this._warpFactor * frameScale * this.lerp(1.05, 1.85, rawProgress);
      if (particle.z < MIN_Z) {
        this.recycleAccelerateParticle(particle, rawProgress);
        continue;
      }

      if (this.isOutOfBounds(particle, SCREEN_PADDING * 4)) {
        this.recycleAccelerateParticle(particle, rawProgress);
      }

      const speed = Math.hypot(particle.vx, particle.vy);
      const pulse =
        0.5 + 0.5 * Math.sin(this.elapsedMs * 0.006 + particle.pulseOffset);
      const depth = 1 - this.clamp(particle.z / MAX_Z, 0, 1);

      particle.alpha = this.clamp(
        0.26 +
          warpProgress * 0.34 +
          pulse * 0.06 +
          Math.min(0.24, speed * 0.015) +
          depth * 0.34,
        0.06,
        1,
      );
      particle.size =
        particle.baseSize *
        (0.4 + warpProgress * 0.36) *
        this.lerp(0.58, 1.92, depth);

      this.pushTrailPoint(particle, particle.prevX, particle.prevY);
    }
  }

  private updateBrake(frameScale: number): void {
    const damping = Math.pow(BRAKE_DAMPING, frameScale);
    this.accelerateProgress = Math.max(
      0,
      this.accelerateProgress - 0.09 * frameScale,
    );

    this._targetWarpFactor = BASE_WARP_FACTOR;
    this.updateWarpFactor(frameScale);
    this._warpFactor = this.lerp(
      this._warpFactor,
      BASE_WARP_FACTOR,
      this.clamp(0.22 * frameScale, 0, 1),
    );

    for (const particle of this.particles) {
      if (!particle.active) continue;

      this.captureHistory(particle);

      particle.x += particle.vx * frameScale;
      particle.y += particle.vy * frameScale;

      particle.vx *= damping;
      particle.vy *= damping;

      particle.z -= this._warpFactor * frameScale * 1.1;
      if (particle.z < MIN_Z) {
        this.recycleDepthParticle(particle);
        continue;
      }

      const speed = Math.hypot(particle.vx, particle.vy);
      const speedGlow = this.clamp(speed * 0.08, 0, 0.36);
      const depthGlow = 1 - this.clamp(particle.z / MAX_Z, 0, 1);

      particle.alpha = this.clamp(
        this.lerp(
          particle.alpha,
          BASE_ALPHA_MIN + speedGlow + depthGlow * 0.22,
          0.24 * frameScale,
        ),
        BASE_ALPHA_MIN * 0.62,
        1,
      );
      particle.size = this.lerp(
        particle.size,
        particle.baseSize * (0.72 + speedGlow * 0.6 + depthGlow * 0.28),
        0.22 * frameScale,
      );

      if (
        this.isOutOfBounds(
          particle,
          Math.max(this.screenWidth, this.screenHeight),
        )
      ) {
        this.recycleDepthParticle(particle);
        continue;
      }

      this.pushTrailPoint(particle, particle.prevX, particle.prevY);
    }
  }

  private recycleAccelerateParticle(
    particle: Particle,
    progress: number,
  ): void {
    const angle = this.randomRange(0, Math.PI * 2);
    const radius = this.randomRange(
      ACCELERATE_RECYCLE_RADIUS_MIN,
      Math.max(
        ACCELERATE_RECYCLE_RADIUS_MIN + 1,
        Math.min(this.screenWidth, this.screenHeight) *
          ACCELERATE_RECYCLE_RADIUS_MAX_FACTOR,
      ),
    );

    const x = this.centerX + Math.cos(angle) * radius;
    const y = this.centerY + Math.sin(angle) * radius;

    const seedSpeed = this.lerp(
      ACCELERATE_RADIAL_SPEED_MIN * 0.5,
      ACCELERATE_RADIAL_SPEED_MAX * 0.35,
      progress,
    );

    particle.x = x;
    particle.y = y;
    particle.z = this.randomRange(MAX_Z * 0.72, MAX_Z);
    particle.prevX = x;
    particle.prevY = y;

    particle.warpDirectionX = Math.cos(angle);
    particle.warpDirectionY = Math.sin(angle);
    particle.vx =
      particle.warpDirectionX *
      this.randomRange(seedSpeed * 0.6, seedSpeed * 1.25);
    particle.vy =
      particle.warpDirectionY *
      this.randomRange(seedSpeed * 0.6, seedSpeed * 1.25);

    particle.alpha = this.randomRange(0.55, 0.95);
    particle.size = particle.baseSize * this.randomRange(0.82, 1.1);

    this.resetTrail(particle, x, y);
    this.resetProjectionHistory(particle);
  }

  private recycleDepthParticle(particle: Particle): void {
    const x = this.centerX + this.randomSigned(this.screenWidth);
    const y = this.centerY + this.randomSigned(this.screenHeight);

    particle.x = x;
    particle.y = y;
    particle.z = MAX_Z;
    particle.prevX = x;
    particle.prevY = y;

    const dx = x - this.centerX;
    const dy = y - this.centerY;
    const length = Math.hypot(dx, dy);
    if (length > EPSILON) {
      particle.warpDirectionX = dx / length;
      particle.warpDirectionY = dy / length;
    } else {
      const angle = this.randomRange(0, Math.PI * 2);
      particle.warpDirectionX = Math.cos(angle);
      particle.warpDirectionY = Math.sin(angle);
    }

    particle.vx = this.randomSigned(0.45);
    particle.vy = this.randomSigned(0.45);
    this.resetTrail(particle, x, y);
    this.resetProjectionHistory(particle);
  }

  private updateImplode(frameScale: number): void {
    const progress = this.clamp(this.modeElapsedMs / IMPLODE_DURATION_MS, 0, 1);
    this.implodeProgress = progress;

    const collapse = Math.pow(progress, IMPLODE_COLLAPSE_POWER);
    const centerSnap = Math.pow(progress, 2.3);

    for (const particle of this.particles) {
      if (!particle.active) continue;

      this.captureHistory(particle);
      particle.z = FOCAL_LENGTH;

      const remaining = Math.max(0, 1 - collapse);
      const targetX =
        this.centerX + (particle.implodeStartX - this.centerX) * remaining;
      const targetY =
        this.centerY + (particle.implodeStartY - this.centerY) * remaining;

      const catchup = this.clamp((0.2 + centerSnap * 0.78) * frameScale, 0, 1);
      particle.x = this.lerp(particle.x, targetX, catchup);
      particle.y = this.lerp(particle.y, targetY, catchup);

      const pullX = this.centerX - particle.x;
      const pullY = this.centerY - particle.y;
      const pullDistance = Math.hypot(pullX, pullY);

      if (pullDistance > EPSILON) {
        const normalizedStartDistance = Math.max(
          IMPLODE_CENTER_THRESHOLD,
          particle.implodeStartDistance,
        );
        const proximity =
          1 - this.clamp(pullDistance / normalizedStartDistance, 0, 1);

        const inwardX = pullX / pullDistance;
        const inwardY = pullY / pullDistance;
        const tangentialX = -inwardY * particle.implodeSpinDirection;
        const tangentialY = inwardX * particle.implodeSpinDirection;

        const radialSuction =
          (0.06 + Math.pow(proximity, 3.2) * 0.74 + centerSnap * 0.22) *
          frameScale;
        particle.x += pullX * radialSuction;
        particle.y += pullY * radialSuction;

        const radiusRatio = this.clamp(
          pullDistance / normalizedStartDistance,
          0.06,
          1,
        );
        const angularMomentum = this.clamp(1 / radiusRatio, 1, 5.8);
        const swirlWobble =
          0.82 +
          0.18 * Math.sin(this.elapsedMs * 0.009 + particle.implodeSpinPhase);
        const tangentialMagnitude = this.clamp(
          (0.42 + progress * 1.2 + Math.pow(proximity, 1.7) * 1.4) *
            angularMomentum *
            swirlWobble *
            frameScale,
          0,
          9.5,
        );

        particle.x += tangentialX * tangentialMagnitude;
        particle.y += tangentialY * tangentialMagnitude;

        particle.implodeSpinPhase +=
          (0.05 + proximity * 0.2) * frameScale * particle.implodeSpinDirection;
      }

      particle.vx = particle.x - particle.prevX;
      particle.vy = particle.y - particle.prevY;

      const distanceToCenter = Math.hypot(
        this.centerX - particle.x,
        this.centerY - particle.y,
      );
      const speed = Math.hypot(particle.vx, particle.vy);

      const life = 1 - Math.pow(progress, IMPLODE_ALPHA_FALLOFF_POWER);
      const centerFade = distanceToCenter < 30 ? distanceToCenter / 30 : 1;
      const speedGlow = this.clamp(speed * 0.28, 0, 0.48);

      particle.alpha = this.clamp(
        (0.2 + life * 0.92 + speedGlow) * centerFade,
        0,
        1,
      );
      particle.size = Math.max(
        0.14,
        particle.baseSize * (0.82 - progress * 0.46 + speedGlow * 0.28),
      );

      if (
        progress >= 0.985 &&
        distanceToCenter <= IMPLODE_CENTER_THRESHOLD * 3.5
      ) {
        this.deactivateParticle(particle);
        continue;
      }

      this.pushTrailPoint(particle, particle.prevX, particle.prevY);
    }
  }

  private updateExplode(frameScale: number): void {
    const damping = Math.pow(EXPLODE_DAMPING, frameScale);

    for (const particle of this.particles) {
      if (!particle.active) continue;

      this.captureHistory(particle);
      particle.z = FOCAL_LENGTH;

      particle.x += particle.vx * frameScale;
      particle.y += particle.vy * frameScale;

      particle.vx *= damping;
      particle.vy *= damping;

      const speed = Math.hypot(particle.vx, particle.vy);

      particle.alpha = this.clamp(
        particle.alpha * Math.pow(0.915, frameScale),
        0,
        1,
      );
      particle.size = Math.max(
        0.12,
        particle.baseSize * (0.25 + Math.min(1.8, speed * 0.045)),
      );

      this.pushTrailPoint(particle, particle.prevX, particle.prevY);

      if (
        particle.alpha <= MIN_VISIBLE_ALPHA ||
        this.isOutOfBounds(particle, SCREEN_PADDING * 4)
      ) {
        this.deactivateParticle(particle);
      }
    }
  }

  private stabilizeForDrift(previousMode: ParticleMode): void {
    const driftSpeed = CHARGE_SEQUENCE_CONFIG.particles.driftSpeed;
    const fromHighEnergy =
      previousMode === "burst" ||
      previousMode === "accelerate" ||
      previousMode === "brake" ||
      previousMode === "implode" ||
      previousMode === "explode";

    for (const particle of this.particles) {
      if (!particle.active) continue;

      const direction = Math.atan2(particle.vy, particle.vx);
      const safeDirection = Number.isFinite(direction)
        ? direction
        : this.randomRange(0, Math.PI * 2);

      const adjustedDirection = fromHighEnergy
        ? safeDirection + this.randomSigned(0.35)
        : safeDirection;
      const speed = this.randomRange(driftSpeed.min, driftSpeed.max);

      particle.vx = Math.cos(adjustedDirection) * speed;
      particle.vy = Math.sin(adjustedDirection) * speed;
      particle.z = fromHighEnergy
        ? this.randomRange(MAX_Z * 0.35, MAX_Z)
        : this.clamp(particle.z, MIN_Z, MAX_Z);
      particle.alpha = this.clamp(
        particle.alpha,
        BASE_ALPHA_MIN,
        BASE_ALPHA_MAX,
      );
      particle.size = particle.baseSize;
      particle.implodeStartDistance = 0;
      this.resetTrail(particle, particle.x, particle.y);
      this.resetProjectionHistory(particle);
    }
  }

  private renderParticles(): void {
    if (!this.graphics) return;

    this.graphics.clear();

    const drawTrail =
      (this.mode === "burst" ||
        this.mode === "accelerate" ||
        this.mode === "brake" ||
        this.mode === "implode" ||
        this.mode === "explode") &&
      TRAIL_LENGTH > 0;

    const trailIntensity =
      this.mode === "accelerate"
        ? 0.82 + this.accelerateProgress * 1.4
        : this.mode === "brake"
          ? 0.9 + this.accelerateProgress * 0.5
          : this.mode === "implode"
            ? 1.35
            : this.mode === "explode"
              ? 1.5
              : this.mode === "burst"
                ? 0.72
                : 0.6;

    const depthMode =
      this.mode === "drift" ||
      this.mode === "accelerate" ||
      this.mode === "brake";

    for (const particle of this.particles) {
      if (!particle.active) continue;
      if (particle.alpha <= MIN_VISIBLE_ALPHA) continue;

      const renderZ = this.resolveRenderZ(particle);
      const projected = this.projectPoint(particle.x, particle.y, renderZ);
      const perspectiveScale = this.clamp(projected.scale, 0.22, 3.4);
      const depthAlphaFactor = depthMode
        ? this.clamp(0.22 + (1 - renderZ / MAX_Z) * 0.9, 0.18, 1)
        : 1;
      const renderAlpha = this.clamp(particle.alpha * depthAlphaFactor, 0, 1);
      if (renderAlpha <= MIN_VISIBLE_ALPHA) continue;

      const renderSize = Math.max(0.12, particle.size * perspectiveScale);
      const alphaScale =
        particle.alpha > EPSILON
          ? this.clamp(renderAlpha / particle.alpha, 0, 2.5)
          : 1;

      if (drawTrail) {
        this.renderTrail(
          particle,
          trailIntensity,
          renderZ,
          alphaScale,
          perspectiveScale,
        );
      }

      if (this.mode === "accelerate" || this.mode === "brake") {
        this.renderWarpStreak(
          particle,
          projected.x,
          projected.y,
          renderZ,
          renderAlpha,
          renderSize,
        );
      } else if (this.mode === "implode") {
        this.renderImplodeStreak(
          particle,
          renderZ,
          alphaScale,
          perspectiveScale,
        );
      } else if (this.mode === "explode") {
        this.renderExplodeStreak(
          particle,
          1.3,
          projected.x,
          projected.y,
          renderZ,
          alphaScale,
          perspectiveScale,
        );
      } else if (this.mode === "burst") {
        this.renderExplodeStreak(
          particle,
          0.65,
          projected.x,
          projected.y,
          renderZ,
          alphaScale,
          perspectiveScale,
        );
      }

      if (depthMode && this._warpFactor > WARP_TRAIL_THRESHOLD) {
        this.renderWarpTrail(
          particle,
          projected.x,
          projected.y,
          renderZ,
          renderAlpha,
          renderSize,
        );
      } else {
        particle.prevProjX = projected.x;
        particle.prevProjY = projected.y;
      }

      this.drawCircle(
        projected.x,
        projected.y,
        renderSize,
        particle.color,
        renderAlpha,
      );
    }

    if (this.mode === "implode") {
      this.renderImplodeCore();
    }
  }

  private renderTrail(
    particle: Particle,
    intensity: number,
    renderZ: number,
    alphaScale: number,
    sizeScale: number,
  ): void {
    for (let index = TRAIL_LENGTH - 1; index >= 0; index -= 1) {
      const ratio = (TRAIL_LENGTH - index) / (TRAIL_LENGTH + 1);
      const alpha = particle.alpha * alphaScale * ratio * 0.36 * intensity;
      if (alpha <= MIN_VISIBLE_ALPHA) continue;

      const size = Math.max(
        0.14,
        particle.size * sizeScale * (0.2 + ratio * 0.28),
      );
      const projected = this.projectPoint(
        particle.trailX[index],
        particle.trailY[index],
        renderZ,
      );

      this.drawCircle(projected.x, projected.y, size, particle.color, alpha);
    }
  }

  private renderWarpStreak(
    particle: Particle,
    headX: number,
    headY: number,
    renderZ: number,
    alpha: number,
    size: number,
  ): void {
    if (!this.graphics) return;

    const speed = Math.hypot(particle.vx, particle.vy);
    let dirX = particle.warpDirectionX;
    let dirY = particle.warpDirectionY;

    if (speed > EPSILON) {
      dirX = particle.vx / speed;
      dirY = particle.vy / speed;
    } else {
      const directionLength = Math.hypot(dirX, dirY);
      if (directionLength <= EPSILON) return;
      dirX /= directionLength;
      dirY /= directionLength;
    }

    const depth = 1 - this.clamp(renderZ / MAX_Z, 0, 1);
    const perspective = this.clamp(
      FOCAL_LENGTH / Math.max(renderZ, MIN_Z),
      0.35,
      2.6,
    );

    const length = this.clamp(
      (5 + speed * 3.4) *
        (0.22 + this.accelerateProgress * 1.6) *
        this.lerp(0.35, 1.85, depth) *
        perspective,
      3,
      210,
    );
    const streakAlpha = this.clamp(
      alpha *
        (0.34 + this.accelerateProgress * 0.42 + speed * 0.008 + depth * 0.34),
      0,
      0.98,
    );
    const width = this.clamp(
      size * (0.24 + this.accelerateProgress * 0.45 + depth * 0.35),
      0.28,
      4.2,
    );

    const segmentCount = 5;
    for (let index = 0; index < segmentCount; index += 1) {
      const t0 = index / segmentCount;
      const t1 = (index + 1) / segmentCount;

      const x0 = headX - dirX * length * t0;
      const y0 = headY - dirY * length * t0;
      const x1 = headX - dirX * length * t1;
      const y1 = headY - dirY * length * t1;

      const segmentAlpha = streakAlpha * Math.pow(1 - t0, 1.45);
      if (segmentAlpha <= MIN_VISIBLE_ALPHA) continue;

      const segmentWidth = this.clamp(width * (1 - t0 * 0.68), 0.18, width);

      this.graphics.lineStyle(segmentWidth, particle.color, segmentAlpha);
      this.graphics.moveTo(x0, y0);
      this.graphics.lineTo(x1, y1);
    }
  }

  private renderImplodeStreak(
    particle: Particle,
    renderZ: number,
    alphaScale: number,
    sizeScale: number,
  ): void {
    if (!this.graphics) return;

    const pointsX: number[] = [];
    const pointsY: number[] = [];

    const head = this.projectPoint(particle.x, particle.y, renderZ);
    pointsX.push(head.x);
    pointsY.push(head.y);

    const historyCount = Math.min(TRAIL_LENGTH, 8);
    for (let index = 0; index < historyCount; index += 1) {
      const projected = this.projectPoint(
        particle.trailX[index],
        particle.trailY[index],
        renderZ,
      );
      pointsX.push(projected.x);
      pointsY.push(projected.y);
    }

    if (pointsX.length < 2) return;

    const speed = Math.hypot(particle.vx, particle.vy);
    const progress = Math.pow(this.implodeProgress, 1.08);

    const alpha = this.clamp(
      particle.alpha *
        alphaScale *
        (0.48 + progress * 0.7 + Math.min(0.45, speed * 0.08)),
      0,
      1,
    );
    const width = this.clamp(
      particle.size * sizeScale * (0.42 + progress * 0.88),
      0.45,
      3.6,
    );

    const segmentCount = pointsX.length - 1;
    for (let index = 0; index < segmentCount; index += 1) {
      const ratio = index / segmentCount;
      const segmentAlpha = alpha * Math.pow(1 - ratio, 1.28);
      if (segmentAlpha <= MIN_VISIBLE_ALPHA) continue;

      const segmentWidth = this.clamp(width * (1 - ratio * 0.55), 0.24, width);

      this.graphics.lineStyle(segmentWidth, particle.color, segmentAlpha);
      this.graphics.moveTo(pointsX[index], pointsY[index]);
      this.graphics.lineTo(pointsX[index + 1], pointsY[index + 1]);
    }
  }

  private renderExplodeStreak(
    particle: Particle,
    lengthBoost: number,
    headX: number,
    headY: number,
    renderZ: number,
    alphaScale: number,
    sizeScale: number,
  ): void {
    if (!this.graphics) return;

    const speed = Math.hypot(particle.vx, particle.vy);
    if (speed <= 0.12) return;

    const nx = particle.vx / speed;
    const ny = particle.vy / speed;

    const perspective = this.clamp(
      FOCAL_LENGTH / Math.max(renderZ, MIN_Z),
      0.5,
      2.2,
    );
    const length = this.clamp(speed * 2.6 * lengthBoost * perspective, 1.5, 90);
    const tailX = headX - nx * length;
    const tailY = headY - ny * length;

    const alpha = this.clamp(particle.alpha * alphaScale * 0.76, 0, 0.95);
    const width = this.clamp(particle.size * sizeScale * 0.42, 0.45, 2.2);

    this.graphics.lineStyle(width, particle.color, alpha);
    this.graphics.moveTo(headX, headY);
    this.graphics.lineTo(tailX, tailY);
  }

  private renderWarpTrail(
    particle: Particle,
    projX: number,
    projY: number,
    renderZ: number,
    alpha: number,
    size: number,
  ): void {
    if (!this.graphics) return;

    const prevX = particle.prevProjX;
    const prevY = particle.prevProjY;

    if (prevX !== 0 || prevY !== 0) {
      const depth = 1 - this.clamp(renderZ / MAX_Z, 0, 1);
      const warpStrength = this.clamp(
        (this._warpFactor - WARP_TRAIL_THRESHOLD) /
          Math.max(EPSILON, MAX_WARP_FACTOR - WARP_TRAIL_THRESHOLD),
        0,
        1,
      );
      const width = this.clamp(
        size * (0.16 + depth * 0.36) + this._warpFactor * 0.05,
        0.2,
        4.4,
      );
      const trailAlpha = this.clamp(
        alpha * (0.16 + warpStrength * 0.74),
        0,
        0.98,
      );

      if (trailAlpha > MIN_VISIBLE_ALPHA) {
        this.graphics.lineStyle(width, particle.color, trailAlpha);
        this.graphics.moveTo(prevX, prevY);
        this.graphics.lineTo(projX, projY);
      }
    }

    particle.prevProjX = projX;
    particle.prevProjY = projY;
  }

  private resolveRenderZ(particle: Particle): number {
    if (
      this.mode === "drift" ||
      this.mode === "accelerate" ||
      this.mode === "brake"
    ) {
      return this.clamp(particle.z, MIN_Z, MAX_Z);
    }

    return FOCAL_LENGTH;
  }

  private projectPoint(
    x: number,
    y: number,
    z: number,
  ): { x: number; y: number; scale: number } {
    const safeZ = Math.max(z, MIN_Z);
    const scale = FOCAL_LENGTH / safeZ;

    return {
      x: (x - this.centerX) * scale + this.centerX,
      y: (y - this.centerY) * scale + this.centerY,
      scale,
    };
  }

  private renderImplodeCore(): void {
    if (!this.graphics) return;

    if (this.implodeProgress <= 0.5) {
      return;
    }

    const t = this.clamp((this.implodeProgress - 0.5) / 0.5, 0, 1);
    const color = this.rgb01ToHex(
      CHARGE_SEQUENCE_CONFIG.particles.color[0],
      CHARGE_SEQUENCE_CONFIG.particles.color[1],
      CHARGE_SEQUENCE_CONFIG.particles.color[2],
    );

    const outerRadius = 1.8 + Math.pow(t, 1.2) * 8;
    const innerRadius = 0.8 + Math.pow(t, 2) * 4;
    const outerAlpha = Math.pow(t, 1.1) * 0.55;
    const innerAlpha = Math.pow(t, 1.4) * 0.85;

    this.drawCircle(this.centerX, this.centerY, outerRadius, color, outerAlpha);
    this.drawCircle(
      this.centerX,
      this.centerY,
      innerRadius,
      0xffffff,
      innerAlpha,
    );
  }

  private drawCircle(
    x: number,
    y: number,
    radius: number,
    color: number,
    alpha: number,
  ): void {
    if (!this.graphics) return;
    if (radius <= 0) return;

    this.graphics.beginFill(color, this.clamp(alpha, 0, 1));
    this.graphics.drawCircle(x, y, radius);
    this.graphics.endFill();
  }

  private updateWarpFactor(frameScale: number): void {
    const blend = this.clamp(0.05 * frameScale, 0, 1);
    this._warpFactor += (this._targetWarpFactor - this._warpFactor) * blend;
    this._warpFactor = this.clamp(this._warpFactor, 0, MAX_WARP_FACTOR);
  }

  private captureHistory(particle: Particle): void {
    particle.prevX = particle.x;
    particle.prevY = particle.y;
  }

  private pushTrailPoint(particle: Particle, x: number, y: number): void {
    if (TRAIL_LENGTH <= 0) return;

    for (let index = TRAIL_LENGTH - 1; index > 0; index -= 1) {
      particle.trailX[index] = particle.trailX[index - 1];
      particle.trailY[index] = particle.trailY[index - 1];
    }

    particle.trailX[0] = x;
    particle.trailY[0] = y;
  }

  private resetTrail(particle: Particle, x: number, y: number): void {
    if (TRAIL_LENGTH <= 0) return;

    for (let index = 0; index < TRAIL_LENGTH; index += 1) {
      particle.trailX[index] = x;
      particle.trailY[index] = y;
    }
  }

  private resetProjectionHistory(particle: Particle): void {
    particle.prevProjX = 0;
    particle.prevProjY = 0;
  }

  private applyBrownian(particle: Particle, intensity: number): void {
    particle.vx += this.randomSigned(intensity);
    particle.vy += this.randomSigned(intensity);
  }

  private enforceSpeedRange(
    particle: Particle,
    minSpeed: number,
    maxSpeed: number,
  ): void {
    const speed = Math.hypot(particle.vx, particle.vy);

    if (speed < EPSILON) {
      const direction = this.randomRange(0, Math.PI * 2);
      particle.vx = Math.cos(direction) * minSpeed;
      particle.vy = Math.sin(direction) * minSpeed;
      return;
    }

    const clampedSpeed = this.clamp(speed, minSpeed, maxSpeed);
    const scale = clampedSpeed / speed;
    particle.vx *= scale;
    particle.vy *= scale;
  }

  private wrapPosition(particle: Particle): void {
    if (particle.x < -SCREEN_PADDING) {
      particle.x = this.screenWidth + SCREEN_PADDING;
    } else if (particle.x > this.screenWidth + SCREEN_PADDING) {
      particle.x = -SCREEN_PADDING;
    }

    if (particle.y < -SCREEN_PADDING) {
      particle.y = this.screenHeight + SCREEN_PADDING;
    } else if (particle.y > this.screenHeight + SCREEN_PADDING) {
      particle.y = -SCREEN_PADDING;
    }
  }

  private isOutOfBounds(particle: Particle, padding: number): boolean {
    return (
      particle.x < -padding ||
      particle.x > this.screenWidth + padding ||
      particle.y < -padding ||
      particle.y > this.screenHeight + padding
    );
  }

  private resolveParticleColor(): number {
    const [baseR, baseG, baseB] = CHARGE_SEQUENCE_CONFIG.particles.color;
    const hueShift = this.randomSigned(0.08);
    const saturationShift = this.randomSigned(0.06);

    const r = this.clamp(baseR + hueShift * 0.4 - saturationShift * 0.15, 0, 1);
    const g = this.clamp(baseG + hueShift * 0.2 + saturationShift * 0.3, 0, 1);
    const b = this.clamp(baseB - hueShift * 0.3 + saturationShift * 0.18, 0, 1);

    return this.rgb01ToHex(r, g, b);
  }

  private rgb01ToHex(r: number, g: number, b: number): number {
    const rr = Math.round(this.clamp(r, 0, 1) * 255);
    const gg = Math.round(this.clamp(g, 0, 1) * 255);
    const bb = Math.round(this.clamp(b, 0, 1) * 255);

    return (rr << 16) | (gg << 8) | bb;
  }

  private resolveDeltaMs(delta: number): number {
    if (Number.isFinite(delta) && delta > 0) {
      return delta;
    }

    return FRAME_DURATION_MS;
  }

  private randomRange(min: number, max: number): number {
    if (max <= min) {
      return min;
    }
    return min + Math.random() * (max - min);
  }

  private randomSigned(magnitude: number): number {
    return (Math.random() * 2 - 1) * magnitude;
  }

  private easeOutCubic(t: number): number {
    const clamped = this.clamp01(t);
    return 1 - Math.pow(1 - clamped, 3);
  }

  private lerp(from: number, to: number, t: number): number {
    return from + (to - from) * t;
  }

  private clamp01(value: number): number {
    return this.clamp(value, 0, 1);
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }
}
