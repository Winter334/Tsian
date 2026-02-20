/**
 * 开屏与标题画面配置
 *
 * Phase 1:
 * - 开屏使用信号锁定动画（Signal Lock）
 * - 旧的 waiting/booting/transition 状态配置已移除
 */

export const SPLASH_COLORS = {
  /** 霓虹青色 - 主题色 */
  cyan: 0x00e5cc,
  /** 青色 CSS 格式 */
  cyanCSS: "#00e5cc",
  /** 白色 */
  white: 0xffffff,
  /** 黑色 - 背景 */
  black: 0x000000,
  /** 绿色 - 成功状态 */
  green: 0x4ade80,
  /** 蓝绿色 - 辅色 */
  teal: 0x0d9488,
} as const;

/**
 * 故障效果参数（FilterManager 依赖）
 */
export const GLITCH_EFFECTS = {
  /** Type A - 水平撕裂 */
  tear: {
    /** 错位幅度范围（像素） */
    offsetMin: 10,
    offsetMax: 30,
    /** 持续时间（毫秒） */
    duration: 150,
    /** 切片数量 */
    slices: 5,
  },

  /** Type B - RGB 剧烈分离 */
  rgb: {
    /** 通道偏移范围（像素） */
    offsetMin: 5,
    offsetMax: 15,
    /** 持续时间（毫秒） */
    duration: 100,
  },

  /** Type C - 画面抖动 */
  shake: {
    /** 抖动幅度（像素） */
    amplitude: 3,
    /** 抖动频率（Hz） */
    frequency: 45,
    /** 持续时间（毫秒） */
    duration: 200,
  },
} as const;

/**
 * 轻微持续效果配置（FilterManager 依赖）
 */
export const SUBTLE_EFFECTS = {
  /** 持续 RGB 色差 */
  rgbSplit: {
    /** 是否启用 */
    enabled: true,
    /** 红色通道偏移 */
    red: { x: 1, y: 0 },
    /** 蓝色通道偏移 */
    blue: { x: -1, y: 0 },
  },
} as const;

/** 信号锁定动画配置 */
export const SIGNAL_LOCK_CONFIG = {
  /** 时间线节点（ms） */
  timeline: {
    searchStart: 0,
    hudShow: 200,
    searchEnd: 800,
    glimpseStart: 800,
    glimpseEnd: 2000,
    radialStart: 2000,
    radialEnd: 3200,
    confirmStart: 3200,
    pulseTrigger: 3400,
    hintShow: 3600,
    confirmEnd: 3800,
  },

  /** 闪现参数 */
  flashes: [
    { time: 800, duration: 100, rgbIntensity: 0.8, jitter: 15 },
    { time: 1100, duration: 120, rgbIntensity: 0.9, jitter: 12 },
    { time: 1350, duration: 150, rgbIntensity: 1.0, jitter: 8 },
    { time: 1550, duration: 180, rgbIntensity: 0.7, jitter: 5 },
    { time: 1800, duration: 200, rgbIntensity: 0.5, jitter: 3 },
  ],

  /** 噪声滤镜参数 */
  noise: {
    initialIntensity: 1.0,
    noiseScale: 1.5,
    flickerSpeed: 8.0,
    scanRingWidth: 0.015,
    scanRingColor: [0.0, 0.9, 0.8] as const,
    // clearRadius 上限由 SignalLockRenderer 按当前分辨率动态计算，确保 4c 在 3200ms 恰好覆盖边角
  },

  /** HUD 文字 */
  hudTexts: {
    scanning: "SCANNING... FREQ 847.32 MHz",
    detected: "SIGNAL DETECTED... LOCKING...",
    locking: "LOCKING SIGNAL...",
    locked: "SIGNAL LOCKED",
  },
} as const;

// ============================================================================
// Title 状态配置
// ============================================================================

export const TITLE_CONFIG = {
  /** 待机效果配置 */
  idle: {
    /** Logo 呼吸发光周期（秒） */
    logoBreathePeriod: 3,
    /** 偶发故障间隔范围（毫秒） */
    glitchIntervalMin: 8000,
    glitchIntervalMax: 15000,
  },

  /** 淡化代码雨配置 */
  matrixRain: {
    /** 密度倍率（相对于普通配置） */
    densityMultiplier: 0.3,
    /** 透明度倍率 */
    alphaMultiplier: 0.48,
    /** 速度倍率 */
    speedMultiplier: 0.6,
    /** 整体透明度 */
    opacity: 0.2,
    /** 字体大小 */
    fontSize: 14,
    /** 字符集 */
    chars:
      "系统代码网络终端启动加载连接接口协议数据命令执行循环函数变量模块神经意识觉醒链接",
  },

  /** 静态网格配置（移除动态交互效果） */
  staticGrid: {
    /** 是否启用 */
    enabled: true,
    /** 网格间距（像素） */
    spacing: 60,
    /** 网格线颜色 */
    color: 0x00e5cc,
    /** 基础透明度 */
    baseAlpha: 0.08,
    /** 网格线宽度 */
    lineWidth: 1,
  },

  /** 交互式网格配置（已弃用，保留供参考） */
  interactiveGrid: {
    /** 网格间距（像素） */
    spacing: 60,
    /** 网格线颜色 */
    color: 0x00e5cc,
    /** 基础透明度 */
    baseAlpha: 0.12,
    /** 网格线宽度 */
    lineWidth: 1,
    /** 鼠标影响半径（像素） */
    influenceRadius: 150,
    /** 高亮透明度增量 */
    highlightAlpha: 0.4,
    /** 透视效果（越远越暗） */
    perspective: {
      enabled: true,
      /** 消失点 Y 坐标（屏幕高度的比例，0.3 表示 30%） */
      vanishY: 0.3,
      /** 最小透明度（远处） */
      minAlpha: 0.03,
    },
    /** 动画配置 */
    animation: {
      /** 流动速度（像素/秒） */
      flowSpeed: 20,
      /** 脉动周期（毫秒） */
      pulsePeriod: 4000,
      /** 脉动幅度 */
      pulseAmplitude: 0.1,
    },
  },

  /** 边角装饰配置 */
  cornerDecorations: {
    /** 装饰线条长度 */
    size: 48,
    /** 线条宽度 */
    lineWidth: 2,
    /** 边距 */
    margin: 16,
    /** 角落小方块大小 */
    dotSize: 8,
  },

  /** Discord 链接配置 */
  discord: {
    /** 链接 URL */
    url: "https://discord.gg/your-invite",
    /** 图标大小 */
    iconSize: 24,
  },

  /** 在线人数指示器配置 */
  onlineIndicator: {
    /** 扫描动画周期（毫秒） */
    scanPeriod: 2000,
    /** 脉冲动画周期（毫秒） */
    pulsePeriod: 1500,
  },

  /** 背景层配置 */
  background: {
    /** 渐变色 - 近乎纯黑（增强霓虹效果对比） */
    gradientStart: 0x010202,
    gradientEnd: 0x030505,
  },

  /** 点阵纹理配置 */
  noiseTexture: {
    /** 是否启用 */
    enabled: true,
    /** 噪点类型：'dot' = 点阵（推荐）, 'turbulence' = SVG 噪点, 'animated' = 动态噪点 */
    type: "dot" as "dot" | "turbulence" | "animated",
    /** 点阵间距（像素） */
    size: 4,
    /** 点的半径（像素） */
    dotRadius: 1.5,
    /** 整体透明度 */
    opacity: 1,
    /** 点阵颜色（带透明度的白色，增加可见度） */
    color: "rgba(255, 255, 255, 0.08)",
    /** 动态噪点配置（备用，当前未使用） */
    animated: {
      baseFrequency: 0.65,
      numOctaves: 3,
    },
  },

  /** CRT 效果配置（减弱版） */
  crt: {
    /** 扫描线透明度 */
    scanlineAlpha: 0.08,
    /** 噪点强度 */
    noiseIntensity: 0.02,
    /** 暗角强度 */
    vignetteIntensity: 0.25,
  },

  /** 视差效果配置 */
  parallax: {
    /** 是否启用视差效果 */
    enabled: true,
    /** 最大位移量（像素） */
    maxOffset: 30,
    /** 平滑系数（0-1，越小越平滑） */
    smoothing: 0.08,
    /**
     * 各层深度配置
     * depth 值说明：1 = 不移动（固定），0 = 移动最大
     * 值越大，移动越慢；值越小，移动越快
     */
    layers: {
      /** 背景层（代码雨），移动很慢 */
      background: 0.9,
      /** 纹理层（点阵），移动稍慢 */
      texture: 0.85,
      /** 条幅层（斜向双条幅），移动适中 */
      banners: 0.7,
      /** 装饰层（装饰文字、浮动粒子），移动较快 */
      decorative: 0.5,
      /** UI层（Logo、菜单按钮等），完全不移动 */
      ui: 1,
    },
  },

  /** 斜向条幅配置 - 视觉分割屏幕 */
  diagonalBanners: {
    /** 是否启用 */
    enabled: true,
    /** 倾斜角度（度），正数向右倾斜 */
    angle: 12,
    /** 条幅宽度（像素） */
    width: 280,
    /** 条幅水平位置百分比（从左边算起） */
    position: 62,
    /** 背景不透明度（使用纯黑色背景增强对比） */
    bgOpacity: 0.95,
    /** 主条幅（向下滚动） */
    primary: {
      text: "神経接続・意識覚醒・記憶同期・系統就緒・感知覚醒・神経回路・",
      fontSize: 56,
      speed: 90,
      opacity: 0.75,
    },
    /** 副条幅（向上滚动） */
    secondary: {
      text: "NEURAL LINK・SYSTEM READY・PROTOCOL ENGAGED・CONSCIOUSNESS SYNC・",
      fontSize: 42,
      speed: 65,
      opacity: 0.55,
    },
  },
} as const;

// ============================================================================
// 性能配置
// ============================================================================

export const PERFORMANCE_CONFIG = {
  /** 目标帧率 */
  targetFPS: 60,
  /** 是否在失去焦点时暂停动画 */
  pauseOnBlur: true,
  /** 移动端简化效果 */
  mobileSimplified: true,
} as const;

/** Phase 2 - 能量启动配置 */
export const CHARGE_SEQUENCE_CONFIG = {
  /** 长按充能 */
  charge: {
    holdThreshold: 800, // ms，需要按住的最短时间
    progressEasing: "easeInQuad", // 充能进度曲线（描述性，实际用代码实现）
  },

  /** 粒子系统 */
  particles: {
    count: 60, // 粒子数量
    burstSpeed: { min: 2, max: 6 }, // 爆发初速度
    driftSpeed: { min: 0.2, max: 0.8 }, // 飘动速度
    accelerateMultiplier: 3, // charging 时速度倍增
    implodeDuration: 800, // 吸入持续时间 (ms)
    explodeSpeed: { min: 8, max: 15 }, // 爆炸速度
    size: { min: 1, max: 3 }, // 粒子尺寸范围
    color: [0, 0.9, 0.8], // 主题青色 RGB (0-1)
    trailLength: 3, // 拖尾长度（帧数）
  },

  /** 闪电效果 */
  lightning: {
    minInterval: 200, // 最小间隔 (ms)
    maxInterval: 600, // 最大间隔 (ms)
    segments: { min: 5, max: 10 }, // 折线段数
    spread: 30, // 折线偏移幅度 (px)
    duration: 150, // 单次闪电可见时间 (ms)
    color: [0.6, 0.9, 1.0], // 浅青白色
    width: 2, // 线宽
  },

  /** 启动序列时间线 */
  sequence: {
    brakeDuration: 240, // 急刹车持续时间
    implodeDuration: 800, // 粒子吸入时间
    logoShrinkDelay: 200, // Logo 内缩延迟（相对吸入结束）
    logoShrinkDuration: 200, // Logo 内缩时间
    flashDelay: 0, // 闪白延迟（相对 Logo 内缩结束）
    flashDuration: 300, // 闪白持续时间
    shockwaveDuration: 400, // 冲击波持续时间
    fadeoutDuration: 500, // 最终淡出时间
    totalDuration: 1900, // 总时长参考值
  },

  /** 爆炸效果 */
  explosion: {
    shockwaveMaxRadius: 600, // 冲击波最大半径 (px)
    shockwaveWidth: 4, // 冲击波环宽度
    shockwaveColor: [0, 0.9, 0.8], // 主题青色
    debrisCount: 30, // 碎片数量
    debrisSpeed: { min: 5, max: 12 }, // 碎片速度
    debrisSize: { min: 2, max: 5 }, // 碎片尺寸
  },
} as const;
