import type { FilterManagerInterface } from "@/components/SplashScreen/types";
import { GLITCH_EFFECTS, SUBTLE_EFFECTS } from "@/config/splash";
import type { Filter } from "@/lib/pixi";
import {
  Container,
  CRTFilter,
  GlitchFilter,
  Point,
  RGBSplitFilter,
} from "@/lib/pixi";

interface FilterManagerOptions {
  subtleEnabled?: boolean;
  crtEnabled?: boolean;
}

/**
 * 开屏滤镜管理器
 *
 * 从旧版 PixiSplashCanvas 中提取，保留原有 API 行为。
 */
export class FilterManager implements FilterManagerInterface {
  private glitchFilter: GlitchFilter;
  private rgbSplitFilter: RGBSplitFilter;
  private crtFilter: CRTFilter;
  private container: Container;
  private subtleEnabled: boolean;
  private crtEnabled: boolean;

  constructor(container: Container, options: FilterManagerOptions = {}) {
    this.container = container;
    this.subtleEnabled =
      options.subtleEnabled ?? SUBTLE_EFFECTS.rgbSplit.enabled;
    this.crtEnabled = options.crtEnabled ?? true;

    this.glitchFilter = new GlitchFilter({
      slices: 0,
      offset: 0,
      direction: 0,
      fillMode: 2,
      average: false,
      minSize: 8,
      sampleSize: 512,
      seed: Math.random(),
    });

    this.rgbSplitFilter = new RGBSplitFilter(
      new Point(SUBTLE_EFFECTS.rgbSplit.red.x, SUBTLE_EFFECTS.rgbSplit.red.y),
      new Point(0, 0),
      new Point(SUBTLE_EFFECTS.rgbSplit.blue.x, SUBTLE_EFFECTS.rgbSplit.blue.y),
    );

    this.crtFilter = new CRTFilter({
      curvature: 0.5,
      lineWidth: 1,
      lineContrast: 0.1,
      noise: 0.02,
      noiseSize: 1,
      vignetting: 0.15,
      vignettingAlpha: 0.3,
      vignettingBlur: 0.3,
      seed: Math.random(),
    });

    this.container.filters = [
      this.glitchFilter,
      this.rgbSplitFilter,
      this.crtFilter,
    ] as unknown as Filter[];

    this.setSubtleRGB(this.subtleEnabled);
    this.setCRTEnabled(this.crtEnabled);
  }

  /**
   * 设置轻微持续 RGB 分离效果
   */
  setSubtleRGB(enabled: boolean): void {
    this.subtleEnabled = enabled;
    if (!enabled) {
      (this.rgbSplitFilter.red as Point).set(0, 0);
      (this.rgbSplitFilter.blue as Point).set(0, 0);
      return;
    }

    (this.rgbSplitFilter.red as Point).set(
      SUBTLE_EFFECTS.rgbSplit.red.x,
      SUBTLE_EFFECTS.rgbSplit.red.y,
    );
    (this.rgbSplitFilter.blue as Point).set(
      SUBTLE_EFFECTS.rgbSplit.blue.x,
      SUBTLE_EFFECTS.rgbSplit.blue.y,
    );
  }

  /**
   * 触发水平撕裂效果
   */
  triggerTear(intensity: number = 1): void {
    const config = GLITCH_EFFECTS.tear;
    const offset =
      config.offsetMin + Math.random() * (config.offsetMax - config.offsetMin);

    this.glitchFilter.offset = offset * intensity;
    this.glitchFilter.slices = config.slices + Math.floor(Math.random() * 5);
    this.glitchFilter.seed = Math.random();
    this.glitchFilter.direction = 0;
  }

  /**
   * 触发自定义撕裂效果
   */
  triggerTearCustom(
    offset: number,
    slices: number,
    direction: number = 0,
  ): void {
    this.glitchFilter.offset = offset;
    this.glitchFilter.slices = Math.max(1, Math.floor(slices));
    this.glitchFilter.seed = Math.random();
    this.glitchFilter.direction = direction;
  }

  /**
   * 触发 RGB 剧烈分离效果
   */
  triggerRGBSplit(intensity: number = 1): void {
    const config = GLITCH_EFFECTS.rgb;
    const offset =
      config.offsetMin + Math.random() * (config.offsetMax - config.offsetMin);
    const scaledOffset = offset * intensity;

    (this.rgbSplitFilter.red as Point).set(
      -scaledOffset + Math.random() * 3,
      Math.random() * 3 - 1.5,
    );
    (this.rgbSplitFilter.blue as Point).set(
      scaledOffset + Math.random() * 3,
      Math.random() * 3 - 1.5,
    );
  }

  /**
   * 触发自定义 RGB 分离
   */
  triggerRGBSplitCustom(
    redX: number,
    blueX: number,
    jitter: number,
    redY: number = 0,
    blueY: number = 0,
  ): void {
    const jitterX = (Math.random() * 2 - 1) * jitter;
    const jitterY = (Math.random() * 2 - 1) * jitter;

    (this.rgbSplitFilter.red as Point).set(redX + jitterX, redY + jitterY);
    (this.rgbSplitFilter.blue as Point).set(blueX + jitterX, blueY - jitterY);
  }

  /**
   * 重置所有效果到默认状态
   */
  reset(): void {
    this.glitchFilter.offset = 0;
    this.glitchFilter.slices = 0;

    if (this.subtleEnabled) {
      (this.rgbSplitFilter.red as Point).set(
        SUBTLE_EFFECTS.rgbSplit.red.x,
        SUBTLE_EFFECTS.rgbSplit.red.y,
      );
      (this.rgbSplitFilter.blue as Point).set(
        SUBTLE_EFFECTS.rgbSplit.blue.x,
        SUBTLE_EFFECTS.rgbSplit.blue.y,
      );
      return;
    }

    (this.rgbSplitFilter.red as Point).set(0, 0);
    (this.rgbSplitFilter.blue as Point).set(0, 0);
  }

  /**
   * 更新 CRT 时间（用于动态效果）
   */
  updateCRT(delta: number): void {
    if (!this.crtEnabled) return;

    this.crtFilter.time += delta * 0.01;
    this.crtFilter.seed = Math.random();
  }

  /**
   * 启用/禁用 CRT 效果
   */
  setCRTEnabled(enabled: boolean): void {
    this.crtEnabled = enabled;

    if (!enabled) {
      this.crtFilter.lineContrast = 0;
      this.crtFilter.noise = 0;
      this.crtFilter.vignetting = 0;
      return;
    }

    this.crtFilter.lineContrast = 0.1;
    this.crtFilter.noise = 0.02;
    this.crtFilter.vignetting = 0.15;
  }

  /**
   * 销毁滤镜
   */
  destroy(): void {
    this.container.filters = null;
    this.glitchFilter.destroy();
    this.rgbSplitFilter.destroy();
    this.crtFilter.destroy();
  }
}
