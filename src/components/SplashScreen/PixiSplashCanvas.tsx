/**
 * PixiJS 统一画布组件
 * Sprint 2: 终端文字渲染
 *
 * 提供 PixiJS 画布的统一管理，包括：
 * - 画布初始化和销毁
 * - 响应式尺寸适配
 * - 滤镜管理
 * - 动画循环控制
 * - 终端文字渲染（与故障效果统一）
 */
import {
  BOOT_SEQUENCE,
  BOOTING_CONFIG,
  GLITCH_EFFECTS,
  type GlitchType,
  PERFORMANCE_CONFIG,
  SPLASH_COLORS,
  type SplashPhase,
  SUBTLE_EFFECTS,
  TRANSITION_CONFIG,
} from "@/config/splash";
import type { Filter } from "@/lib/pixi";
import {
  AngryNoiseFilter,
  Application,
  Container,
  CRTFilter,
  GlitchFilter,
  Graphics,
  Point,
  RGBSplitFilter,
  Text,
  TextStyle,
} from "@/lib/pixi";
import { useCallback, useEffect, useRef } from "react";

// ============================================================================
// 类型定义
// ============================================================================

interface PixiSplashCanvasProps {
  /** 当前画面状态 */
  phase: SplashPhase;
  /** 子元素渲染回调 */
  onReady?: (context: CanvasContext) => void;
  /** 每帧更新回调 */
  onUpdate?: (context: CanvasContext, delta: number) => void;
  /** 画布销毁回调 */
  onDestroy?: () => void;
  /** 启动序列完成回调 */
  onBootComplete?: () => void;
  /** 过渡动画完成回调 */
  onTransitionComplete?: () => void;
}

/**
 * 画布上下文，提供给子组件使用
 */
export interface CanvasContext {
  /** PixiJS 应用实例 */
  app: Application;
  /** 主舞台容器 */
  stage: Container;
  /** 背景层容器 */
  backgroundLayer: Container;
  /** 内容层容器 */
  contentLayer: Container;
  /** UI 层容器 */
  uiLayer: Container;
  /** 滤镜管理器 */
  filters: FilterManager;
  /** 故障效果调度器 */
  glitchScheduler: GlitchScheduler;
  /** 终端渲染器 */
  terminalRenderer: TerminalRenderer;
  /** 过渡渲染器 */
  transitionRenderer: TransitionRenderer;
  /** 屏幕尺寸 */
  screen: { width: number; height: number };
}

// ============================================================================
// 滤镜管理器
// ============================================================================

export class FilterManager {
  private glitchFilter: GlitchFilter;
  private rgbSplitFilter: RGBSplitFilter;
  private crtFilter: CRTFilter;
  private container: Container;
  private subtleEnabled: boolean = true;
  private crtEnabled: boolean = true;

  constructor(container: Container) {
    this.container = container;

    // 创建故障滤镜
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

    // 创建 RGB 分离滤镜
    this.rgbSplitFilter = new RGBSplitFilter(
      new Point(SUBTLE_EFFECTS.rgbSplit.red.x, SUBTLE_EFFECTS.rgbSplit.red.y),
      new Point(0, 0),
      new Point(SUBTLE_EFFECTS.rgbSplit.blue.x, SUBTLE_EFFECTS.rgbSplit.blue.y)
    );

    // 创建 CRT 滤镜（持续效果，但非常轻微）
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

    // 应用滤镜
    this.container.filters = [
      this.glitchFilter,
      this.rgbSplitFilter,
      this.crtFilter,
    ] as unknown as Filter[];
  }

  /**
   * 设置轻微持续 RGB 分离效果
   */
  setSubtleRGB(enabled: boolean): void {
    this.subtleEnabled = enabled;
    if (!enabled) {
      (this.rgbSplitFilter.red as Point).set(0, 0);
      (this.rgbSplitFilter.blue as Point).set(0, 0);
    } else {
      (this.rgbSplitFilter.red as Point).set(
        SUBTLE_EFFECTS.rgbSplit.red.x,
        SUBTLE_EFFECTS.rgbSplit.red.y
      );
      (this.rgbSplitFilter.blue as Point).set(
        SUBTLE_EFFECTS.rgbSplit.blue.x,
        SUBTLE_EFFECTS.rgbSplit.blue.y
      );
    }
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
    this.glitchFilter.direction = 0; // 水平方向
  }

  /**
   * 触发自定义撕裂效果（过渡阶段专用）
   * @param offset 偏移量
   * @param slices 切片数量
   * @param direction 方向角度（0=水平，90=垂直）
   */
  triggerTearCustom(
    offset: number,
    slices: number,
    direction: number = 0
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
      Math.random() * 3 - 1.5
    );
    (this.rgbSplitFilter.blue as Point).set(
      scaledOffset + Math.random() * 3,
      Math.random() * 3 - 1.5
    );
  }

  /**
   * 触发自定义 RGB 分离（过渡阶段专用）
   */
  triggerRGBSplitCustom(
    redX: number,
    blueX: number,
    jitter: number,
    redY: number = 0,
    blueY: number = 0
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
        SUBTLE_EFFECTS.rgbSplit.red.y
      );
      (this.rgbSplitFilter.blue as Point).set(
        SUBTLE_EFFECTS.rgbSplit.blue.x,
        SUBTLE_EFFECTS.rgbSplit.blue.y
      );
    } else {
      (this.rgbSplitFilter.red as Point).set(0, 0);
      (this.rgbSplitFilter.blue as Point).set(0, 0);
    }
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
      // 禁用时将 CRT 效果参数设为最小
      this.crtFilter.lineContrast = 0;
      this.crtFilter.noise = 0;
      this.crtFilter.vignetting = 0;
    } else {
      // 恢复默认值
      this.crtFilter.lineContrast = 0.1;
      this.crtFilter.noise = 0.02;
      this.crtFilter.vignetting = 0.15;
    }
  }

  /**
   * 销毁滤镜
   */
  destroy(): void {
    this.glitchFilter.destroy();
    this.rgbSplitFilter.destroy();
    this.crtFilter.destroy();
  }
}

// ============================================================================
// 故障效果调度器
// ============================================================================

export class GlitchScheduler {
  private filterManager: FilterManager;
  private nextGlitchTime: number = 0;
  private activeGlitch: { type: GlitchType; endTime: number } | null = null;
  private enabled: boolean = false;
  private minInterval: number;
  private maxInterval: number;
  private shakeContainer: Container | null = null;
  private originalPosition: { x: number; y: number } = { x: 0, y: 0 };

  constructor(
    filterManager: FilterManager,
    minInterval: number,
    maxInterval: number
  ) {
    this.filterManager = filterManager;
    this.minInterval = minInterval;
    this.maxInterval = maxInterval;
    this.scheduleNext();
  }

  /**
   * 设置要抖动的容器
   */
  setShakeTarget(container: Container): void {
    this.shakeContainer = container;
    this.originalPosition = { x: container.x, y: container.y };
  }

  /**
   * 启用/禁用调度器
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.activeGlitch = null;
      this.filterManager.reset();
      if (this.shakeContainer) {
        this.shakeContainer.x = this.originalPosition.x;
        this.shakeContainer.y = this.originalPosition.y;
      }
    }
  }

  /**
   * 安排下一次故障
   */
  private scheduleNext(): void {
    const interval =
      this.minInterval + Math.random() * (this.maxInterval - this.minInterval);
    this.nextGlitchTime = performance.now() + interval;
  }

  /**
   * 触发随机故障
   */
  private triggerRandomGlitch(): void {
    const types: GlitchType[] = ["tear", "rgb", "shake"];
    // 随机选择 1-2 种效果
    const count = 1 + Math.floor(Math.random() * 2);
    const selectedTypes: GlitchType[] = [];

    for (let i = 0; i < count; i++) {
      const randomIndex = Math.floor(Math.random() * types.length);
      if (!selectedTypes.includes(types[randomIndex])) {
        selectedTypes.push(types[randomIndex]);
      }
    }

    // 计算最长持续时间
    let maxDuration = 0;
    for (const type of selectedTypes) {
      const duration = GLITCH_EFFECTS[type].duration;
      maxDuration = Math.max(maxDuration, duration);

      // 触发对应效果
      switch (type) {
        case "tear":
          this.filterManager.triggerTear();
          break;
        case "rgb":
          this.filterManager.triggerRGBSplit();
          break;
        case "shake":
          // 抖动效果在 update 中处理
          break;
      }
    }

    this.activeGlitch = {
      type: selectedTypes[0], // 主要类型用于抖动判断
      endTime: performance.now() + maxDuration,
    };
  }

  /**
   * 每帧更新
   */
  update(): void {
    if (!this.enabled) return;

    const now = performance.now();

    // 检查是否需要触发新故障
    if (!this.activeGlitch && now >= this.nextGlitchTime) {
      this.triggerRandomGlitch();
      this.scheduleNext();
    }

    // 更新活动故障
    if (this.activeGlitch) {
      if (now >= this.activeGlitch.endTime) {
        // 故障结束
        this.filterManager.reset();
        if (this.shakeContainer) {
          this.shakeContainer.x = this.originalPosition.x;
          this.shakeContainer.y = this.originalPosition.y;
        }
        this.activeGlitch = null;
      } else {
        // 更新抖动效果
        if (this.shakeContainer) {
          const config = GLITCH_EFFECTS.shake;
          this.shakeContainer.x =
            this.originalPosition.x +
            (Math.random() * 2 - 1) * config.amplitude;
          this.shakeContainer.y =
            this.originalPosition.y +
            (Math.random() * 2 - 1) * config.amplitude;
        }
      }
    }
  }
}

// ============================================================================
// 终端渲染器
// ============================================================================

export class TerminalRenderer {
  private textContainer: Container;
  private cursorGraphic: Graphics;
  private lines: Text[] = [];
  private cursorVisible: boolean = true;
  private cursorBlinkTimer: number = 0;
  private textStyle: TextStyle;
  private highlightStyle: TextStyle;
  private successStyle: TextStyle;

  // 打印状态
  private phase: SplashPhase = "waiting";
  private waitingText: string = "CLICK TO START...";
  private waitingCharIndex: number = 0;
  private waitingComplete: boolean = false;

  // 启动序列状态
  private bootPhaseIndex: number = 0;
  private bootLineIndex: number = 0;
  private bootCharIndex: number = 0;
  private lastPrintTime: number = 0;
  private bootComplete: boolean = false;
  private currentLineCreated: boolean = false; // 标记当前行是否已创建

  // 回调
  private onBootComplete?: () => void;

  constructor(parentContainer: Container, onBootComplete?: () => void) {
    this.onBootComplete = onBootComplete;

    // 创建文本容器
    this.textContainer = new Container();
    this.textContainer.x = 64;
    this.textContainer.y = 64;
    parentContainer.addChild(this.textContainer);

    // 创建文本样式
    this.textStyle = new TextStyle({
      fontFamily:
        '"JetBrains Mono", "Fira Code", "Cascadia Code", Consolas, monospace',
      fontSize: 14,
      fill: 0x5effe8, // 亮青色
      letterSpacing: 0.5,
    });

    this.highlightStyle = new TextStyle({
      fontFamily:
        '"JetBrains Mono", "Fira Code", "Cascadia Code", Consolas, monospace',
      fontSize: 14,
      fill: 0x5effe8, // 亮青色
      fontWeight: "bold",
      letterSpacing: 0.5,
    });

    this.successStyle = new TextStyle({
      fontFamily:
        '"JetBrains Mono", "Fira Code", "Cascadia Code", Consolas, monospace',
      fontSize: 14,
      fill: 0x4ade80, // green-400 (保持成功色)
      fontWeight: "bold",
      letterSpacing: 0.5,
    });

    // 创建光标
    this.cursorGraphic = new Graphics();
    this.cursorGraphic.beginFill(0x00e5cc); // 霓虹青色
    this.cursorGraphic.drawRect(0, 0, 8, 16);
    this.cursorGraphic.endFill();
    this.textContainer.addChild(this.cursorGraphic);

    // 添加第一行
    this.addLine("");
  }

  private addLine(text: string, type: string = "normal"): Text {
    let style = this.textStyle;
    if (type === "highlight") style = this.highlightStyle;
    if (type === "success") style = this.successStyle;

    const textObj = new Text(text, style);
    // 使用更紧凑的行高（字体大小14px + 4px间距 = 18px）
    textObj.y = this.lines.length * 18;
    this.textContainer.addChild(textObj);
    this.lines.push(textObj);
    return textObj;
  }

  private updateCursor(): void {
    if (this.lines.length === 0) return;

    const lastLine = this.lines[this.lines.length - 1];
    this.cursorGraphic.x = lastLine.x + lastLine.width + 2;
    this.cursorGraphic.y = lastLine.y;
    this.cursorGraphic.visible = this.cursorVisible && !this.bootComplete;
  }

  setPhase(newPhase: SplashPhase): void {
    if (this.phase === newPhase) return;
    this.phase = newPhase;

    if (newPhase === "booting" && this.waitingComplete) {
      // 开始启动序列
      this.bootPhaseIndex = 0;
      this.bootLineIndex = 0;
      this.bootCharIndex = 0;
      this.lastPrintTime = performance.now();
    }
  }

  update(delta: number): void {
    const now = performance.now();

    // 光标闪烁
    this.cursorBlinkTimer += delta;
    if (this.cursorBlinkTimer > 30) {
      // 约 500ms
      this.cursorBlinkTimer = 0;
      this.cursorVisible = !this.cursorVisible;
    }

    if (this.phase === "waiting") {
      this.updateWaiting(now);
    } else if (this.phase === "booting") {
      this.updateBooting(now);
    }

    this.updateCursor();
  }

  private updateWaiting(now: number): void {
    if (this.waitingComplete) return;

    // 逐字打印等待文字
    if (this.waitingCharIndex < this.waitingText.length) {
      if (now - this.lastPrintTime > 50) {
        this.waitingCharIndex++;
        this.lines[0].text = this.waitingText.slice(0, this.waitingCharIndex);
        this.lastPrintTime = now;
      }
    } else {
      this.waitingComplete = true;
    }
  }

  private updateBooting(now: number): void {
    if (this.bootComplete) return;
    if (!this.waitingComplete) return;

    // 检查是否完成所有阶段
    if (this.bootPhaseIndex >= BOOT_SEQUENCE.length) {
      this.bootComplete = true;
      this.cursorVisible = false;
      setTimeout(() => {
        this.onBootComplete?.();
      }, 500);
      return;
    }

    const bootPhase = BOOT_SEQUENCE[this.bootPhaseIndex];

    // 检查是否完成当前阶段
    if (this.bootLineIndex >= bootPhase.lines.length) {
      const delay = bootPhase.afterDelay || 0;
      if (now - this.lastPrintTime > delay) {
        this.bootPhaseIndex++;
        this.bootLineIndex = 0;
        this.bootCharIndex = 0;
        this.lastPrintTime = now;
      }
      return;
    }

    const line = bootPhase.lines[this.bootLineIndex];
    const speed =
      BOOTING_CONFIG.speed[line.type] || BOOTING_CONFIG.speed.normal;

    if (line.type === "fast") {
      // 快速滚动：整行直接显示
      if (now - this.lastPrintTime > speed) {
        this.addLine(line.text, line.type);
        this.bootLineIndex++;
        this.bootCharIndex = 0;
        this.lastPrintTime = now;
      }
    } else {
      // 逐字打印
      // 处理空行：直接跳过
      if (line.text.length === 0) {
        if (now - this.lastPrintTime > BOOTING_CONFIG.speed.lineDelay) {
          this.addLine("", line.type);
          this.bootLineIndex++;
          this.bootCharIndex = 0;
          this.currentLineCreated = false;
          this.lastPrintTime = now;
        }
        return;
      }

      // 只在当前行未创建时添加新行
      if (this.bootCharIndex === 0 && !this.currentLineCreated) {
        this.addLine("", line.type);
        this.currentLineCreated = true;
      }

      if (this.bootCharIndex < line.text.length) {
        if (now - this.lastPrintTime > speed) {
          this.bootCharIndex++;
          const lastLine = this.lines[this.lines.length - 1];
          lastLine.text = line.text.slice(0, this.bootCharIndex);
          this.lastPrintTime = now;
        }
      } else {
        // 当前行完成
        if (now - this.lastPrintTime > BOOTING_CONFIG.speed.lineDelay) {
          this.bootLineIndex++;
          this.bootCharIndex = 0;
          this.currentLineCreated = false; // 重置标志
          this.lastPrintTime = now;
        }
      }
    }
  }

  destroy(): void {
    this.textContainer.destroy({ children: true });
  }
}

// ============================================================================
// 过渡渲染器
// ============================================================================

/**
 * 过渡状态渲染器
 * 实现：扫描线揭示作者署名 + Glitch 切换效果
 */
export class TransitionRenderer {
  private container: Container;
  private signatureContainer: Container | null = null;
  private prefixText: Text | null = null;
  private signatureText: Text | null = null;
  private signatureRingContainer: Container | null = null;
  private signatureRings: Array<{ container: Container; speed: number }> = [];
  private scanLineLeft: Graphics | null = null;
  private scanLineRight: Graphics | null = null;
  private trailLeft: Graphics | null = null;
  private trailRight: Graphics | null = null;
  private chargeGridGraphics: Graphics | null = null;
  private maskGraphics: Graphics | null = null;
  private gridGraphics: Graphics | null = null;
  private filterManager: FilterManager;
  private glitchScheduler: GlitchScheduler;

  // 愤怒噪声滤镜
  private angryNoiseFilter: AngryNoiseFilter | null = null;
  private angryNoiseTime: number = 0;

  // 状态
  private isActive: boolean = false;
  private rgbFlipSign: number = 1;
  private nextRgbFlipTime: number = 0;
  private lastGlitchUpdate: number = 0;
  private startTime: number = 0;
  private phase:
    | "fadeOut"
    | "blackScreen"
    | "scanReveal"
    | "hold"
    | "glitch"
    | "complete" = "fadeOut";
  private onComplete?: () => void;

  // Glitch 爆发状态
  private burstFramesRemaining: number = 0;
  private currentBurstIntensity: number = 1;

  // 终端容器引用（用于淡出）
  private terminalContainer: Container | null = null;

  // 屏幕尺寸
  private screenWidth: number = 0;
  private screenHeight: number = 0;

  // 扫描线当前位置
  private currentScanOffset: number = 0;

  constructor(
    parentContainer: Container,
    filterManager: FilterManager,
    glitchScheduler: GlitchScheduler,
    screenWidth: number,
    screenHeight: number
  ) {
    this.container = new Container();
    this.container.visible = false;
    parentContainer.addChild(this.container);

    this.filterManager = filterManager;
    this.glitchScheduler = glitchScheduler;
    this.screenWidth = screenWidth;
    this.screenHeight = screenHeight;

    this.createGrid();
    this.createChargeGrid();
    this.createSignature();
    this.createScanLines();
    this.createAngryNoiseFilter();
  }

  /**
   * 创建愤怒噪声滤镜
   */
  private createAngryNoiseFilter(): void {
    this.angryNoiseFilter = new AngryNoiseFilter();
    this.angryNoiseFilter.setResolution(this.screenWidth, this.screenHeight);
    // 设置 Genuary 2026 logo 风格的颜色（匹配示例）
    this.angryNoiseFilter.setColors(
      [0.0, 0.33, 1.0], // 青色（匹配示例 vec3(0, .33, 1)）
      [1.0, 0.0, 0.33], // 品红色（匹配示例 vec3(1, 0, .33)）
      [1.0, 1.0, 1.0] // 白色核心
    );
    // 设置边缘参数
    this.angryNoiseFilter.setEdgeParams(
      3.0, // 描边厚度
      10.0, // 喷溅扩散范围（增加以产生更明显的破碎边缘）
      1.2 // 噪声缩放
    );
    this.angryNoiseFilter.intensity = 1.0;

    // 立即应用滤镜到署名容器
    if (this.signatureContainer) {
      this.signatureContainer.filters = [
        this.angryNoiseFilter,
      ] as unknown as Filter[];
    }
  }

  /**
   * 创建背景网格
   */
  private createGrid(): void {
    this.gridGraphics = new Graphics();
    this.gridGraphics.visible = false;
    this.gridGraphics.alpha = 0;
    this.container.addChild(this.gridGraphics);

    this.drawGrid();
  }

  /**
   * 绘制网格
   */
  private drawGrid(): void {
    if (!this.gridGraphics) return;

    const config = TRANSITION_CONFIG.grid;
    this.gridGraphics.clear();
    // 线条透明度设为 1，通过 gridGraphics.alpha 控制整体透明度
    this.gridGraphics.lineStyle(config.lineWidth, config.color, 1);

    // 绘制垂直线
    for (let x = 0; x <= this.screenWidth; x += config.spacing) {
      this.gridGraphics.moveTo(x, 0);
      this.gridGraphics.lineTo(x, this.screenHeight);
    }

    // 绘制水平线
    for (let y = 0; y <= this.screenHeight; y += config.spacing) {
      this.gridGraphics.moveTo(0, y);
      this.gridGraphics.lineTo(this.screenWidth, y);
    }
  }

  /**
   * 创建充能网格（用于扫描线扫过时的发光效果）
   */
  private createChargeGrid(): void {
    this.chargeGridGraphics = new Graphics();
    this.chargeGridGraphics.visible = false;
    this.container.addChild(this.chargeGridGraphics);
  }

  /**
   * 绘制充能网格（在扫描线附近绘制发光效果）
   */
  private drawChargeGrid(): void {
    if (!this.chargeGridGraphics) return;

    const gridConfig = TRANSITION_CONFIG.grid;
    const chargeConfig = TRANSITION_CONFIG.gridCharge;
    const centerX = this.screenWidth / 2;

    // 计算左右扫描线的位置
    const leftScanX = centerX - this.currentScanOffset;
    const rightScanX = centerX + this.currentScanOffset;

    this.chargeGridGraphics.clear();

    // 只在扫描线附近绘制充能效果（在遮罩范围内）
    // 绘制垂直线充能效果
    for (let x = 0; x <= this.screenWidth; x += gridConfig.spacing) {
      // 只绘制在扫描区域内的线
      if (x < leftScanX || x > rightScanX) continue;

      // 计算与扫描线的距离
      const distToLeft = Math.abs(x - leftScanX);
      const distToRight = Math.abs(x - rightScanX);
      const minDist = Math.min(distToLeft, distToRight);

      // 如果在充能范围内，绘制发光效果
      if (minDist < chargeConfig.width) {
        const alpha =
          (1 - minDist / chargeConfig.width) * chargeConfig.maxAlpha;

        // 绘制发光的垂直线
        this.chargeGridGraphics.lineStyle(
          gridConfig.lineWidth + 2,
          gridConfig.color,
          alpha
        );
        this.chargeGridGraphics.moveTo(x, 0);
        this.chargeGridGraphics.lineTo(x, this.screenHeight);
      }
    }

    // 绘制水平线充能效果（只在扫描区域内，扫描线附近的区域）
    for (let y = 0; y <= this.screenHeight; y += gridConfig.spacing) {
      // 左侧扫描线附近的水平线段（只在扫描区域内）
      // 起点：扫描区域左边界（leftScanX）
      // 终点：左扫描线 + 充能宽度，但不超过右扫描线
      const leftSegStartX = leftScanX; // 从扫描区域左边界开始
      const leftSegEndX = Math.min(rightScanX, leftScanX + chargeConfig.width);

      if (leftSegStartX < leftSegEndX) {
        // 绘制左侧充能区域的水平线段（带衰减）
        const segments = 10;
        for (let s = 0; s < segments; s++) {
          const segStartX =
            leftSegStartX + (leftSegEndX - leftSegStartX) * (s / segments);
          const segEndX =
            leftSegStartX +
            (leftSegEndX - leftSegStartX) * ((s + 1) / segments);
          const segCenterX = (segStartX + segEndX) / 2;
          const distToScan = Math.abs(segCenterX - leftScanX);

          if (distToScan < chargeConfig.width) {
            const alpha =
              (1 - distToScan / chargeConfig.width) * chargeConfig.maxAlpha;
            this.chargeGridGraphics.lineStyle(
              gridConfig.lineWidth + 2,
              gridConfig.color,
              alpha
            );
            this.chargeGridGraphics.moveTo(segStartX, y);
            this.chargeGridGraphics.lineTo(segEndX, y);
          }
        }
      }

      // 右侧扫描线附近的水平线段（只在扫描区域内）
      // 起点：右扫描线 - 充能宽度，但不小于左扫描线
      // 终点：扫描区域右边界（rightScanX）
      const rightSegStartX = Math.max(
        leftScanX,
        rightScanX - chargeConfig.width
      );
      const rightSegEndX = rightScanX; // 到扫描区域右边界

      // 确保右侧区域不与左侧区域重叠
      if (rightSegStartX < rightSegEndX && rightSegStartX > leftSegEndX) {
        // 绘制右侧充能区域的水平线段（带衰减）
        const segments = 10;
        for (let s = 0; s < segments; s++) {
          const segStartX =
            rightSegStartX + (rightSegEndX - rightSegStartX) * (s / segments);
          const segEndX =
            rightSegStartX +
            (rightSegEndX - rightSegStartX) * ((s + 1) / segments);
          const segCenterX = (segStartX + segEndX) / 2;
          const distToScan = Math.abs(segCenterX - rightScanX);

          if (distToScan < chargeConfig.width) {
            const alpha =
              (1 - distToScan / chargeConfig.width) * chargeConfig.maxAlpha;
            this.chargeGridGraphics.lineStyle(
              gridConfig.lineWidth + 2,
              gridConfig.color,
              alpha
            );
            this.chargeGridGraphics.moveTo(segStartX, y);
            this.chargeGridGraphics.lineTo(segEndX, y);
          }
        }
      }
    }
  }

  /**
   * 更新网格充能状态
   */
  private updateGridCharge(): void {
    // 直接重绘充能网格（实时计算，不再使用衰减数组）
    this.drawChargeGrid();
  }

  /**
   * 创建作者署名文字
   */
  private createSignature(): void {
    const config = TRANSITION_CONFIG.signature;

    // 创建署名容器
    this.signatureContainer = new Container();
    this.signatureContainer.visible = false;
    this.container.addChild(this.signatureContainer);

    // 创建前缀文字样式 - 使用更粗的字体
    const prefixStyle = new TextStyle({
      fontFamily:
        '"JetBrains Mono", "Fira Code", "Cascadia Code", Consolas, monospace',
      fontSize: config.prefixFontSize,
      fontWeight: "bold",
      fill: 0xffffff,
      letterSpacing: 4,
      // 移除阴影，让滤镜效果更清晰
    });

    // 创建前缀文字
    this.prefixText = new Text(config.prefix, prefixStyle);
    this.prefixText.anchor.set(0.5, 0.5);
    this.signatureContainer.addChild(this.prefixText);

    // 创建主文字样式 - 使用更粗的黑体字体
    const mainStyle = new TextStyle({
      fontFamily:
        '"Noto Sans SC Black", "Source Han Sans SC Heavy", "Microsoft YaHei", "PingFang SC", sans-serif',
      fontSize: config.fontSize,
      fontWeight: "900", // 最粗
      fill: 0xffffff, // 纯白色，让滤镜添加颜色
      letterSpacing: config.letterSpacing || 24,
      // 移除阴影和渐变，让滤镜效果更清晰
    });

    // 创建主文字
    this.signatureText = new Text(config.text, mainStyle);
    this.signatureText.anchor.set(0.5, 0.5);
    this.signatureContainer.addChild(this.signatureText);

    // 创建环形文字容器（置于底层）
    this.signatureRingContainer = new Container();
    this.signatureRingContainer.alpha = config.rings.alpha;
    this.signatureRingContainer.visible = false;
    const signatureIndex = this.container.getChildIndex(
      this.signatureContainer
    );
    this.container.addChildAt(this.signatureRingContainer, signatureIndex);

    // 布局：前缀在上，主文字在下
    this.layoutSignature();

    // 创建遮罩
    // 遮罩从中心向两侧扩展，初始宽度为0
    this.maskGraphics = new Graphics();
    this.maskGraphics.beginFill(0xffffff);
    this.maskGraphics.drawRect(0, 0, 0, this.screenHeight); // 初始宽度为0，署名完全不可见
    this.maskGraphics.endFill();
    this.maskGraphics.x = this.screenWidth / 2;
    this.maskGraphics.y = 0;

    // 遮罩需要添加到舞台上才能正常工作
    // 但设置 renderable = false 防止遮罩本身被渲染为白色矩形
    this.maskGraphics.renderable = false;
    this.container.addChild(this.maskGraphics);

    // 应用遮罩到署名容器 - 署名只在遮罩区域内可见
    this.signatureContainer.mask = this.maskGraphics;

    // 确保署名容器的 alpha 为 1（无额外的透明度动画）
    this.signatureContainer.alpha = 1;
  }

  /**
   * 布局署名元素
   */
  private layoutSignature(): void {
    if (!this.signatureContainer || !this.prefixText || !this.signatureText)
      return;

    const centerX = this.screenWidth / 2;
    const centerY = this.screenHeight / 2;
    const config = TRANSITION_CONFIG.signature;

    // 前缀在主文字上方
    this.prefixText.x = centerX;
    this.prefixText.y = centerY - 70;

    // 主文字居中
    this.signatureText.x = centerX;
    this.signatureText.y = centerY + 20;

    // 环形文字布局
    if (this.signatureRingContainer) {
      const signatureCenterY = centerY - 25;
      this.signatureRingContainer.x = centerX;
      this.signatureRingContainer.y = signatureCenterY;

      const baseRadius =
        Math.max(this.signatureText.width, this.prefixText.width) * 0.6 +
        config.rings.basePadding;

      this.createSignatureRings(baseRadius);
    }
  }

  /**
   * 创建环形文字
   */
  private createSignatureRings(baseRadius: number): void {
    if (!this.signatureRingContainer || !this.signatureText) return;

    const ringConfig = TRANSITION_CONFIG.signature.rings;
    this.signatureRingContainer.removeChildren();
    this.signatureRings = [];

    for (let i = 0; i < ringConfig.count; i += 1) {
      const ringContainer = new Container();
      const radius = baseRadius + i * ringConfig.radiusStep;
      const ringText = ringConfig.text.repeat(ringConfig.repeat);
      const characters = ringText.split("");
      const angleStep = (Math.PI * 2) / characters.length;

      const ringStyle = new TextStyle({
        fontFamily: ringConfig.fontFamily,
        fontSize: ringConfig.fontSize,
        fontWeight: ringConfig.fontWeight,
        fill: ringConfig.color,
        letterSpacing: ringConfig.letterSpacing,
        stroke: ringConfig.strokeColor,
        strokeThickness: ringConfig.strokeThickness,
      });

      characters.forEach((char: string, index: number) => {
        const charText = new Text(char, ringStyle);
        charText.anchor.set(0.5, 0.5);

        const angle = ringConfig.startAngle + angleStep * index;
        charText.x = Math.cos(angle) * radius;
        charText.y = Math.sin(angle) * radius;
        charText.rotation = angle + Math.PI / 2;

        ringContainer.addChild(charText);
      });

      ringContainer.rotation =
        ringConfig.startRotation + i * ringConfig.rotationStep;
      this.signatureRingContainer.addChild(ringContainer);

      const direction = i % 2 === 0 ? 1 : -1;
      this.signatureRings.push({
        container: ringContainer,
        speed: ringConfig.speed * direction,
      });
    }
  }

  /**
   * 更新环形文字旋转
   */
  private updateSignatureRings(delta: number): void {
    if (this.signatureRings.length === 0) return;

    const deltaSeconds = delta / PERFORMANCE_CONFIG.targetFPS;
    for (const ring of this.signatureRings) {
      ring.container.rotation += ring.speed * deltaSeconds;
    }
  }

  /**
   * 创建扫描线
   */
  private createScanLines(): void {
    const config = TRANSITION_CONFIG.scanLine;

    // 左侧拖尾（向右渐变，因为左扫描线向左移动）
    this.trailLeft = new Graphics();
    this.trailLeft.x = this.screenWidth / 2;
    this.trailLeft.visible = false;
    this.container.addChild(this.trailLeft);

    // 右侧拖尾（向左渐变，因为右扫描线向右移动）
    this.trailRight = new Graphics();
    this.trailRight.x = this.screenWidth / 2;
    this.trailRight.visible = false;
    this.container.addChild(this.trailRight);

    // 左侧扫描线
    this.scanLineLeft = new Graphics();
    this.scanLineLeft.beginFill(config.color);
    this.scanLineLeft.drawRect(
      -config.width / 2,
      0,
      config.width,
      this.screenHeight
    );
    this.scanLineLeft.endFill();
    this.scanLineLeft.x = this.screenWidth / 2;
    this.scanLineLeft.visible = false;
    this.container.addChild(this.scanLineLeft);

    // 右侧扫描线
    this.scanLineRight = new Graphics();
    this.scanLineRight.beginFill(config.color);
    this.scanLineRight.drawRect(
      -config.width / 2,
      0,
      config.width,
      this.screenHeight
    );
    this.scanLineRight.endFill();
    this.scanLineRight.x = this.screenWidth / 2;
    this.scanLineRight.visible = false;
    this.container.addChild(this.scanLineRight);
  }

  /**
   * 更新扫描线拖尾效果
   */
  private updateTrails(): void {
    const config = TRANSITION_CONFIG.scanLine;
    const trailConfig = config.trail;
    const trailWidth = trailConfig.width;

    // 更新左侧拖尾（拖尾在扫描线右侧，向中心方向）
    if (this.trailLeft) {
      this.trailLeft.clear();
      const leftScanX = this.screenWidth / 2 - this.currentScanOffset;

      // 绘制渐变拖尾（从扫描线位置向右渐变）
      const steps = 20;
      for (let i = 0; i < steps; i++) {
        const t = i / steps;
        const alpha = trailConfig.alpha * (1 - t) * (1 - t); // 二次衰减
        const x = config.width / 2 + t * trailWidth;
        const nextX = config.width / 2 + ((i + 1) / steps) * trailWidth;

        this.trailLeft.beginFill(config.color, alpha);
        this.trailLeft.drawRect(x, 0, nextX - x, this.screenHeight);
        this.trailLeft.endFill();
      }

      this.trailLeft.x = leftScanX;
    }

    // 更新右侧拖尾（拖尾在扫描线左侧，向中心方向）
    if (this.trailRight) {
      this.trailRight.clear();
      const rightScanX = this.screenWidth / 2 + this.currentScanOffset;

      // 绘制渐变拖尾（从扫描线位置向左渐变）
      const steps = 20;
      for (let i = 0; i < steps; i++) {
        const t = i / steps;
        const alpha = trailConfig.alpha * (1 - t) * (1 - t); // 二次衰减
        const x = -config.width / 2 - ((i + 1) / steps) * trailWidth;
        const nextX = -config.width / 2 - t * trailWidth;

        this.trailRight.beginFill(config.color, alpha);
        this.trailRight.drawRect(x, 0, nextX - x, this.screenHeight);
        this.trailRight.endFill();
      }

      this.trailRight.x = rightScanX;
    }
  }

  /**
   * 设置终端容器引用（用于淡出动画）
   */
  setTerminalContainer(container: Container): void {
    this.terminalContainer = container;
  }

  /**
   * 开始过渡动画
   */
  start(onComplete: () => void): void {
    this.isActive = true;
    this.startTime = performance.now();
    this.phase = "fadeOut";
    this.onComplete = onComplete;
    this.container.visible = true;

    // 禁用随机故障效果
    this.glitchScheduler.setEnabled(false);
  }

  /**
   * 更新动画
   */
  update(delta: number): void {
    if (!this.isActive) return;

    const elapsed = performance.now() - this.startTime;
    const timeline = TRANSITION_CONFIG.timeline;

    // 更新愤怒噪声滤镜时间
    if (this.angryNoiseFilter) {
      this.angryNoiseTime += delta * 0.016; // 转换为秒
      this.angryNoiseFilter.time = this.angryNoiseTime;
    }

    // 阶段判断和更新
    if (elapsed < timeline.textFadeEnd) {
      this.updateFadeOut(elapsed, timeline.textFadeEnd);
    } else if (elapsed < timeline.scanLineStart) {
      this.updateBlackScreen();
    } else if (elapsed < timeline.scanLineEnd) {
      this.updateScanReveal(
        elapsed,
        timeline.scanLineStart,
        timeline.scanLineEnd
      );
    } else if (elapsed < timeline.glitchStart) {
      this.updateHold(elapsed, timeline.scanLineEnd, timeline.glitchStart);
    } else if (elapsed < timeline.complete) {
      this.updateGlitch(elapsed, timeline.glitchStart, timeline.complete);
    } else {
      this.complete();
    }

    this.updateSignatureRings(delta);
  }

  /**
   * 淡出阶段
   */
  private updateFadeOut(elapsed: number, endTime: number): void {
    if (this.phase !== "fadeOut") return;

    const progress = elapsed / endTime;
    if (this.terminalContainer) {
      this.terminalContainer.alpha = 1 - progress;
    }
  }

  /**
   * 黑屏阶段
   */
  private updateBlackScreen(): void {
    if (this.phase === "fadeOut") {
      this.phase = "blackScreen";
      if (this.terminalContainer) {
        this.terminalContainer.visible = false;
      }
    }
  }

  /**
   * 扫描线揭示阶段
   */
  private updateScanReveal(
    elapsed: number,
    startTime: number,
    endTime: number
  ): void {
    if (this.phase === "blackScreen") {
      this.phase = "scanReveal";
      // 显示署名容器、扫描线、拖尾和网格
      if (this.signatureContainer) this.signatureContainer.visible = true;
      if (this.signatureRingContainer)
        this.signatureRingContainer.visible = true;
      if (this.scanLineLeft) this.scanLineLeft.visible = true;
      if (this.scanLineRight) this.scanLineRight.visible = true;
      if (this.trailLeft) this.trailLeft.visible = true;
      if (this.trailRight) this.trailRight.visible = true;
      if (this.gridGraphics) {
        this.gridGraphics.visible = true;
        this.gridGraphics.alpha = TRANSITION_CONFIG.grid.alpha;
      }
      if (this.chargeGridGraphics) {
        this.chargeGridGraphics.visible = true;
        this.chargeGridGraphics.alpha = 1;
      }
    }

    const progress = (elapsed - startTime) / (endTime - startTime);
    // 使用线性进度（无缓动），让扫描线匀速移动
    // 这样署名会随着扫描线匀速显示，没有"停顿"感
    const linearProgress = Math.min(1, Math.max(0, progress));

    // 扫描线扩展到屏幕边缘
    const halfScreenWidth = this.screenWidth / 2;
    this.currentScanOffset = halfScreenWidth * linearProgress;

    // 更新扫描线位置（从中心向两侧扩展到屏幕边缘）
    // 扫描线紧贴遮罩边缘
    if (this.scanLineLeft) {
      this.scanLineLeft.x = this.screenWidth / 2 - this.currentScanOffset;
    }
    if (this.scanLineRight) {
      this.scanLineRight.x = this.screenWidth / 2 + this.currentScanOffset;
    }

    // 更新拖尾效果
    this.updateTrails();

    // 更新网格充能效果
    this.updateGridCharge();

    // 更新遮罩（覆盖整个扫描区域，署名紧贴扫描线边缘显示）
    if (this.maskGraphics) {
      this.maskGraphics.clear();
      this.maskGraphics.beginFill(0xffffff);
      const maskWidth = this.currentScanOffset * 2;
      this.maskGraphics.drawRect(
        -maskWidth / 2,
        0,
        maskWidth,
        this.screenHeight
      );
      this.maskGraphics.endFill();
      this.maskGraphics.x = this.screenWidth / 2;
      // 确保遮罩不被渲染为白色矩形
      this.maskGraphics.renderable = false;
    }

    // 网格也应用遮罩效果（只显示扫描线之间的部分）
    if (this.gridGraphics) {
      this.gridGraphics.mask = this.maskGraphics;
    }

    if (this.signatureRingContainer) {
      this.signatureRingContainer.mask = this.maskGraphics;
    }

    // 充能网格也应用遮罩效果
    if (this.chargeGridGraphics) {
      this.chargeGridGraphics.mask = this.maskGraphics;
    }
  }

  /**
   * 署名停留阶段
   */
  private updateHold(
    elapsed: number,
    startTime: number,
    _endTime: number
  ): void {
    if (this.phase === "scanReveal") {
      this.phase = "hold";
      // 隐藏扫描线和拖尾
      if (this.scanLineLeft) this.scanLineLeft.visible = false;
      if (this.scanLineRight) this.scanLineRight.visible = false;
      if (this.trailLeft) this.trailLeft.visible = false;
      if (this.trailRight) this.trailRight.visible = false;
      if (this.chargeGridGraphics) this.chargeGridGraphics.visible = false;

      // 移除遮罩，完全显示文字
      if (this.signatureContainer) {
        this.signatureContainer.mask = null;
      }

      if (this.signatureRingContainer) {
        this.signatureRingContainer.mask = null;
      }

      // 网格完全显示（移除遮罩）
      if (this.gridGraphics) {
        this.gridGraphics.mask = null;
        this.gridGraphics.alpha = TRANSITION_CONFIG.grid.alpha;
      }

      // 充能网格也移除遮罩
      if (this.chargeGridGraphics) {
        this.chargeGridGraphics.mask = null;
      }

      // 隐藏遮罩图形，防止白屏
      if (this.maskGraphics) {
        this.maskGraphics.visible = false;
      }
    }

    // 呼吸效果 - 调整滤镜强度
    const holdElapsed = elapsed - startTime;
    const glowPeriod = TRANSITION_CONFIG.signature.glowPeriod;
    const glowProgress =
      (Math.sin((holdElapsed / glowPeriod) * Math.PI * 2) + 1) / 2;

    // 使用滤镜强度来实现呼吸效果
    if (this.angryNoiseFilter) {
      const baseIntensity = 1.0;
      const intensityRange = 0.3;
      this.angryNoiseFilter.intensity =
        baseIntensity + glowProgress * intensityRange;
    }
  }

  /**
   * Glitch 切换阶段 - 模拟 Three.js GlitchPass 风格
   * 特点：随机爆发、低帧率更新、不可预测的强烈效果
   */
  private updateGlitch(
    elapsed: number,
    startTime: number,
    endTime: number
  ): void {
    if (this.phase === "hold") {
      this.phase = "glitch";
      // 重置爆发状态
      this.burstFramesRemaining = 0;
      this.currentBurstIntensity = 1;
    }

    const progress = (elapsed - startTime) / (endTime - startTime);
    const config = TRANSITION_CONFIG.glitchTransition;

    // 控制更新节奏（模拟低帧率 Glitch，类似示例的 fps=20）
    const now = performance.now();
    if (now - this.lastGlitchUpdate < config.updateInterval) {
      return;
    }
    this.lastGlitchUpdate = now;

    // 基础强度曲线（先增后减，但更激进）
    let baseIntensity: number;
    if (progress < 0.3) {
      // 快速上升
      baseIntensity = (progress / 0.3) * 0.8;
    } else if (progress < 0.7) {
      // 高强度维持
      baseIntensity = 0.8 + Math.random() * 0.2;
    } else {
      // 快速下降
      baseIntensity = ((1 - progress) / 0.3) * 0.8;
    }

    // 随机爆发检测
    if (this.burstFramesRemaining > 0) {
      this.burstFramesRemaining--;
    } else if (Math.random() < config.burst.chance) {
      // 触发新的爆发
      this.burstFramesRemaining = config.burst.duration;
      this.currentBurstIntensity = config.burst.intensityMultiplier;
    } else {
      this.currentBurstIntensity = 1;
    }

    // 最终强度 = 基础强度 × 爆发倍数 × 放大系数
    const intensity =
      baseIntensity * this.currentBurstIntensity * config.amplification;

    // 应用撕裂效果 - 更随机、更激进
    const isBurst = this.burstFramesRemaining > 0;
    const tearSlices = isBurst
      ? config.tear.maxSlices +
        Math.floor(Math.random() * config.tear.sliceJitter)
      : config.tear.slices +
        Math.floor(intensity * config.tear.sliceBoost) +
        Math.floor(Math.random() * config.tear.sliceJitter);

    // 偏移量随机化，有时候会有极端值
    const tearOffset = isBurst
      ? config.tear.maxOffset * (0.5 + Math.random() * 0.5)
      : config.tear.minOffset +
        (config.tear.maxOffset - config.tear.minOffset) *
          intensity *
          (0.5 + Math.random() * 0.5);

    // 随机决定撕裂方向（水平或垂直）
    const isVerticalTear = Math.random() < config.tear.verticalChance;
    const tearDirection = isVerticalTear ? config.tear.verticalDirection : 0;

    this.filterManager.triggerTearCustom(tearOffset, tearSlices, tearDirection);

    // 应用 RGB 分离 - 更激进的翻转和偏移，增强垂直分量
    if (now >= this.nextRgbFlipTime) {
      this.rgbFlipSign *= -1;
      this.nextRgbFlipTime =
        now + config.rgb.flipInterval * (0.5 + Math.random() * 0.5);
    }

    const rgbOffset = isBurst
      ? config.rgb.maxOffset * (0.7 + Math.random() * 0.3)
      : config.rgb.minOffset +
        (config.rgb.maxOffset - config.rgb.minOffset) * intensity;

    // 随机决定是否以垂直方向为主
    const isVerticalDominant =
      Math.random() < config.rgb.verticalDominantChance;

    let redX: number, redY: number, blueX: number, blueY: number;

    if (isVerticalDominant) {
      // 垂直主导：Y偏移大，X偏移小
      redX = (Math.random() * 2 - 1) * config.rgb.jitter;
      blueX = (Math.random() * 2 - 1) * config.rgb.jitter;
      redY =
        -rgbOffset * this.rgbFlipSign +
        (Math.random() * 2 - 1) * config.rgb.jitter;
      blueY =
        rgbOffset * this.rgbFlipSign +
        (Math.random() * 2 - 1) * config.rgb.jitter;
    } else {
      // 水平主导：X偏移大，Y偏移作为补充
      redX =
        -rgbOffset * this.rgbFlipSign +
        (Math.random() * 2 - 1) * config.rgb.jitter;
      blueX =
        rgbOffset * this.rgbFlipSign +
        (Math.random() * 2 - 1) * config.rgb.jitter;
      redY = (Math.random() * 2 - 1) * config.rgb.yOffset * intensity;
      blueY = (Math.random() * 2 - 1) * config.rgb.yOffset * intensity;
    }

    this.filterManager.triggerRGBSplitCustom(redX, blueX, 0, redY, blueY);

    // 画面抖动
    if (config.shake.enabled && this.container.parent) {
      const shakeAmount =
        config.shake.amplitude * intensity * (isBurst ? 2 : 1);
      this.container.parent.x = (Math.random() * 2 - 1) * shakeAmount;
      this.container.parent.y = (Math.random() * 2 - 1) * shakeAmount;
    }

    // 闪烁效果
    if (config.flicker.enabled && Math.random() < config.flicker.chance) {
      const flickerAlpha =
        config.flicker.alphaMin +
        Math.random() * (config.flicker.alphaMax - config.flicker.alphaMin);
      if (this.signatureContainer) {
        this.signatureContainer.alpha = flickerAlpha;
      }
    }

    // 淡出署名和网格
    if (progress > 0.3) {
      const fadeProgress = (progress - 0.3) / 0.7;
      if (this.signatureContainer && !config.flicker.enabled) {
        this.signatureContainer.alpha = 1 - fadeProgress;
      } else if (this.signatureContainer) {
        // 闪烁模式下的淡出
        this.signatureContainer.alpha = Math.min(
          this.signatureContainer.alpha,
          1 - fadeProgress
        );
      }
      if (this.gridGraphics) {
        this.gridGraphics.alpha =
          TRANSITION_CONFIG.grid.alpha * (1 - fadeProgress);
      }
    }
  }

  /**
   * 完成过渡
   */
  private complete(): void {
    if (this.phase === "complete") return;
    this.phase = "complete";
    this.isActive = false;

    // 重置滤镜
    this.filterManager.reset();

    // 重置容器位置
    if (this.container.parent) {
      this.container.parent.x = 0;
      this.container.parent.y = 0;
    }

    // 隐藏过渡容器
    this.container.visible = false;

    // 调用完成回调
    this.onComplete?.();
  }

  /**
   * 更新屏幕尺寸
   */
  resize(width: number, height: number): void {
    this.screenWidth = width;
    this.screenHeight = height;

    // 更新署名布局
    this.layoutSignature();

    // 更新网格
    this.drawGrid();

    // 更新扫描线
    if (this.scanLineLeft) {
      this.scanLineLeft.clear();
      this.scanLineLeft.beginFill(TRANSITION_CONFIG.scanLine.color);
      this.scanLineLeft.drawRect(
        -TRANSITION_CONFIG.scanLine.width / 2,
        0,
        TRANSITION_CONFIG.scanLine.width,
        height
      );
      this.scanLineLeft.endFill();
    }

    if (this.scanLineRight) {
      this.scanLineRight.clear();
      this.scanLineRight.beginFill(TRANSITION_CONFIG.scanLine.color);
      this.scanLineRight.drawRect(
        -TRANSITION_CONFIG.scanLine.width / 2,
        0,
        TRANSITION_CONFIG.scanLine.width,
        height
      );
      this.scanLineRight.endFill();
    }
  }

  /**
   * 销毁
   */
  destroy(): void {
    this.container.destroy({ children: true });
  }
}

// ============================================================================
// 画布组件
// ============================================================================

export function PixiSplashCanvas({
  phase,
  onReady,
  onUpdate,
  onDestroy,
  onBootComplete,
  onTransitionComplete,
}: PixiSplashCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const contextRef = useRef<CanvasContext | null>(null);
  const animationRef = useRef<number>(0);
  const isInitializedRef = useRef(false);

  // 使用 ref 存储回调，避免重新初始化
  const onReadyRef = useRef(onReady);
  const onUpdateRef = useRef(onUpdate);
  const onDestroyRef = useRef(onDestroy);
  const onBootCompleteRef = useRef(onBootComplete);
  const onTransitionCompleteRef = useRef(onTransitionComplete);

  // 更新 refs
  useEffect(() => {
    onReadyRef.current = onReady;
    onUpdateRef.current = onUpdate;
    onDestroyRef.current = onDestroy;
    onBootCompleteRef.current = onBootComplete;
    onTransitionCompleteRef.current = onTransitionComplete;
  }, [onReady, onUpdate, onDestroy, onBootComplete, onTransitionComplete]);

  // 清理函数
  const cleanup = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = 0;
    }
    if (contextRef.current) {
      contextRef.current.filters.destroy();
      onDestroyRef.current?.();
    }
    if (appRef.current) {
      appRef.current.destroy(true, { children: true, texture: true });
      appRef.current = null;
    }
    contextRef.current = null;
    isInitializedRef.current = false;
  }, []);

  // 初始化 PixiJS（只执行一次）
  const initApp = useCallback(() => {
    if (!containerRef.current || appRef.current || isInitializedRef.current)
      return;

    isInitializedRef.current = true;
    const width = window.innerWidth;
    const height = window.innerHeight;

    // 创建 PixiJS 应用
    const app = new Application({
      width,
      height,
      backgroundAlpha: 0,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });

    containerRef.current.appendChild(app.view as HTMLCanvasElement);
    appRef.current = app;

    // 创建层级容器
    const backgroundLayer = new Container();
    const contentLayer = new Container();
    const uiLayer = new Container();

    app.stage.addChild(backgroundLayer);
    app.stage.addChild(contentLayer);
    app.stage.addChild(uiLayer);

    // 添加纯黑背景
    const background = new Graphics();
    background.beginFill(SPLASH_COLORS.black);
    background.drawRect(0, 0, width, height);
    background.endFill();
    backgroundLayer.addChild(background);

    // 创建滤镜管理器
    const filters = new FilterManager(app.stage);

    // 创建故障调度器
    const glitchScheduler = new GlitchScheduler(filters, 2000, 5000);
    glitchScheduler.setShakeTarget(app.stage);

    // 创建终端渲染器（使用 ref 获取最新的回调）
    const terminalRenderer = new TerminalRenderer(contentLayer, () => {
      onBootCompleteRef.current?.();
    });

    // 创建过渡渲染器
    const transitionRenderer = new TransitionRenderer(
      uiLayer,
      filters,
      glitchScheduler,
      width,
      height
    );
    // 设置终端容器引用（用于淡出动画）
    transitionRenderer.setTerminalContainer(contentLayer);

    // 创建上下文
    const context: CanvasContext = {
      app,
      stage: app.stage,
      backgroundLayer,
      contentLayer,
      uiLayer,
      filters,
      glitchScheduler,
      terminalRenderer,
      transitionRenderer,
      screen: { width, height },
    };

    contextRef.current = context;

    // 通知就绪（使用 ref）
    onReadyRef.current?.(context);

    // 动画循环
    let lastTime = performance.now();
    const animate = () => {
      const now = performance.now();
      const delta = (now - lastTime) / (1000 / PERFORMANCE_CONFIG.targetFPS);
      lastTime = now;

      if (contextRef.current) {
        // 更新故障调度器
        contextRef.current.glitchScheduler.update();

        // 更新终端渲染器
        contextRef.current.terminalRenderer.update(delta);

        // 更新过渡渲染器
        contextRef.current.transitionRenderer.update(delta);

        // 更新 CRT 效果
        contextRef.current.filters.updateCRT(delta);

        // 调用外部更新回调（使用 ref）
        onUpdateRef.current?.(contextRef.current, delta);
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();
  }, []);

  // 初始化（只执行一次）
  useEffect(() => {
    initApp();
    return cleanup;
  }, [initApp, cleanup]);

  // 响应尺寸变化
  useEffect(() => {
    const handleResize = () => {
      if (!appRef.current || !contextRef.current) return;

      const width = window.innerWidth;
      const height = window.innerHeight;

      appRef.current.renderer.resize(width, height);
      contextRef.current.screen = { width, height };

      // 重绘背景
      const bg = contextRef.current.backgroundLayer.children[0] as Graphics;
      if (bg) {
        bg.clear();
        bg.beginFill(SPLASH_COLORS.black);
        bg.drawRect(0, 0, width, height);
        bg.endFill();
      }

      // 更新过渡渲染器尺寸
      contextRef.current.transitionRenderer.resize(width, height);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // 根据状态控制故障调度器和终端渲染器
  useEffect(() => {
    if (!contextRef.current) return;

    // Waiting 和 Booting 状态都启用随机故障
    contextRef.current.glitchScheduler.setEnabled(
      phase === "waiting" || phase === "booting"
    );

    // 更新终端渲染器状态
    contextRef.current.terminalRenderer.setPhase(phase);

    // 当进入 transition 状态时，启动过渡动画
    if (phase === "transition") {
      contextRef.current.transitionRenderer.start(() => {
        onTransitionCompleteRef.current?.();
      });
    }
  }, [phase]);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50"
      style={{ width: "100vw", height: "100vh" }}
    />
  );
}
