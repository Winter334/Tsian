/**
 * 开屏动画配置
 * Sprint 0: 基础设施准备
 *
 * 集中管理所有开屏动画相关的配置参数
 */

// ============================================================================
// 画面状态定义
// ============================================================================

/**
 * 开屏动画画面状态
 * - Waiting: 等待用户点击
 * - Booting: 终端启动序列
 * - Transition: 过渡到标题画面
 * - Title: 标题画面（完成状态）
 */
export type SplashPhase = "waiting" | "booting" | "transition" | "title";

/**
 * 状态转换定义
 */
export const PHASE_TRANSITIONS: Record<
  SplashPhase,
  { next: SplashPhase | null; trigger: string }
> = {
  waiting: { next: "booting", trigger: "用户点击" },
  booting: { next: "transition", trigger: "启动序列完成" },
  transition: { next: "title", trigger: "过渡动画完成" },
  title: { next: null, trigger: "最终状态" },
} as const;

// ============================================================================
// 颜色配置
// ============================================================================

/**
 * 主题颜色（十六进制）
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

// ============================================================================
// Waiting 状态配置
// ============================================================================

export const WAITING_CONFIG = {
  /** 闪烁光标配置 */
  cursor: {
    /** 光标宽度（像素） */
    width: 12,
    /** 光标高度（像素） */
    height: 24,
    /** 闪烁频率（Hz，每秒闪烁次数） */
    blinkRate: 0.7,
    /** 光标颜色 */
    color: SPLASH_COLORS.cyan,
  },

  /** 点击开始提示配置 */
  prompt: {
    /** 提示文字 */
    text: "CLICK TO START",
    /** 字体大小 */
    fontSize: 16,
    /** 字体颜色（透明度） */
    alpha: 0.6,
    /** 呼吸效果最小透明度 */
    breatheMin: 0.5,
    /** 呼吸效果最大透明度 */
    breatheMax: 0.8,
    /** 呼吸周期（秒） */
    breathePeriod: 2,
  },

  /** 故障效果配置 */
  glitch: {
    /** 最小触发间隔（毫秒） */
    minInterval: 2000,
    /** 最大触发间隔（毫秒） */
    maxInterval: 5000,
    /** 故障持续时间范围（毫秒） */
    durationMin: 100,
    durationMax: 300,
  },
} as const;

// ============================================================================
// 故障效果配置
// ============================================================================

/**
 * 故障效果类型
 */
export type GlitchType = "tear" | "rgb" | "shake";

/**
 * 故障效果参数
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
 * 轻微持续效果配置
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

// ============================================================================
// Booting 状态配置
// ============================================================================

/**
 * 启动序列行类型
 */
export type BootLineType = "fast" | "normal" | "highlight" | "success";

/**
 * 启动序列行配置
 */
export interface BootLine {
  /** 文本内容 */
  text: string;
  /** 打印类型 */
  type: BootLineType;
  /** 行间延迟（毫秒），覆盖默认值 */
  delay?: number;
}

/**
 * 启动序列阶段
 */
export interface BootPhase {
  /** 阶段名称（用于调试） */
  name: string;
  /** 该阶段的行 */
  lines: BootLine[];
  /** 阶段完成后的延迟（毫秒） */
  afterDelay?: number;
  /** 阶段开始前触发故障效果 */
  glitchBefore?: boolean;
}

/**
 * 启动序列配置 - 四个阶段
 */
export const BOOT_SEQUENCE: BootPhase[] = [
  // 第一阶段：系统初始化（快速滚动）
  {
    name: "系统初始化",
    lines: [
      { text: "[0x00000000] BIOS POST... OK", type: "fast" },
      { text: "[0x00001A3F] Memory check: 16384MB detected", type: "fast" },
      { text: "[0x00002B7C] CPU: Neural Processing Unit v3.7", type: "fast" },
      { text: "[0x00003E20] Loading kernel modules...", type: "fast" },
      { text: "[0x00004F91] > drv_consciousness.sys", type: "fast" },
      { text: "[0x00005D42] > drv_perception.sys", type: "fast" },
      { text: "[0x00006A8B] > drv_memory_stream.sys", type: "fast" },
      { text: "[0x00007C3E] Initializing neural interface...", type: "fast" },
    ],
    afterDelay: 200,
  },
  // 第二阶段：核心加载（标准速度）
  {
    name: "核心加载",
    lines: [
      { text: "> 加载意识核心...", type: "normal" },
      { text: "> 初始化感知矩阵...", type: "normal" },
      { text: "> 建立神经桥接...", type: "normal" },
      { text: "> 同步记忆流...", type: "normal" },
    ],
    afterDelay: 300,
    glitchBefore: true,
  },
  // 第三阶段：关键信息（高亮显示）
  {
    name: "关键信息",
    lines: [
      { text: "[SYSTEM] Neural handshake complete", type: "highlight" },
      { text: "[SYSTEM] Consciousness sync: 100%", type: "highlight" },
      { text: "[SYSTEM] Ready to connect", type: "highlight" },
    ],
    afterDelay: 400,
    glitchBefore: true,
  },
  // 第四阶段：成功确认（作者署名移至 Transition 状态）
  {
    name: "连接成功",
    lines: [{ text: "[OK] 连接成功 ✓", type: "success" }],
    afterDelay: 300,
  },
];

export const BOOTING_CONFIG = {
  /** 文本打印速度配置 */
  speed: {
    /** 快速滚动（毫秒/行）- 整行直接显示 */
    fast: 15,
    /** 标准打印（毫秒/字符） */
    normal: 18,
    /** 高亮打印（毫秒/字符） */
    highlight: 15,
    /** 成功信息（毫秒/字符） */
    success: 20,
    /** 行间默认延迟（毫秒） */
    lineDelay: 30,
  },

  /** 启动期间故障效果配置（行级效果，已弃用，保留配置供参考） */
  glitch: {
    /** 随机行偏移概率 */
    lineOffsetChance: 0.05,
    /** 偏移幅度范围（像素） */
    lineOffsetRange: { min: 5, max: 20 },
    /** 随机乱码概率 */
    garbleChance: 0.03,
    /** 乱码字符 */
    garbleChars: "█▓▒░╔╗╚╝║═╬╠╣╦╩▀▄■□",
    /** 乱码持续时间（毫秒） */
    garbleDuration: 150,
  },
} as const;

// ============================================================================
// Transition 状态配置
// ============================================================================

export const TRANSITION_CONFIG = {
  /** 总过渡时长（毫秒） */
  totalDuration: 3600,

  /** 时间节点（相对于过渡开始，毫秒） */
  timeline: {
    /** 启动文本开始淡出 */
    textFadeStart: 0,
    /** 启动文本淡出完成 */
    textFadeEnd: 300,
    /** 黑屏等待 */
    blackScreen: 600,
    /** 扫描线开始 */
    scanLineStart: 800,
    /** 扫描线完成（署名完全显示）- 延长扫描时间 */
    scanLineEnd: 2000,
    /** 署名停留结束 */
    signatureHold: 2600,
    /** Glitch 效果开始 */
    glitchStart: 2900,
    /** Glitch 高潮 */
    glitchPeak: 3100,
    /** 标题画面入场 */
    titleEnter: 3300,
    /** 过渡完成 */
    complete: 3600,
  },

  /** 淡出动画时长（毫秒） */
  fadeOutDuration: 300,

  /** 作者署名配置 */
  signature: {
    /** 署名前缀 */
    prefix: "Created by",
    /** 署名文字 */
    text: "流萤白沙",
    /** 前缀字体大小（像素） */
    prefixFontSize: 24,
    /** 主文字字体大小（像素） */
    fontSize: 96,
    /** 主颜色（霓虹青色） */
    primaryColor: 0x00e5cc,
    /** 渐变结束色（蓝绿色） */
    secondaryColor: 0x0d9488,
    /** 呼吸发光周期（毫秒） */
    glowPeriod: 1500,
    /** 发光强度 */
    glowIntensity: 0.3,
    /** 主文字字间距（像素） */
    letterSpacing: 24,
    /** 环形文字配置 */
    rings: {
      /** 环形文字内容 */
      text: "TSIAN · SIGNATURE · ",
      /** 文本重复次数 */
      repeat: 4,
      /** 环数 */
      count: 3,
      /** 基础半径额外间距 */
      basePadding: 60,
      /** 半径递增 */
      radiusStep: 32,
      /** 字体 */
      fontFamily:
        '"JetBrains Mono", "Fira Code", "Cascadia Code", Consolas, monospace',
      /** 字号 */
      fontSize: 18,
      /** 字重 */
      fontWeight: "600",
      /** 字距 */
      letterSpacing: 1,
      /** 主颜色（接近 Created by） */
      color: 0xffffff,
      /** 描边颜色 */
      strokeColor: 0x000000,
      /** 描边厚度 */
      strokeThickness: 2,
      /** 透明度 */
      alpha: 0.85,
      /** 起始角度 */
      startAngle: -Math.PI / 2,
      /** 起始旋转 */
      startRotation: 0,
      /** 环间旋转偏移 */
      rotationStep: Math.PI / 12,
      /** 旋转速度（弧度/秒） */
      speed: 0.15,
    },
  },

  /** 扫描线配置 */
  scanLine: {
    /** 扫描线颜色 */
    color: 0x00e5cc,
    /** 扫描线宽度（像素） */
    width: 4,
    /** 扫描线发光强度 */
    glowIntensity: 0.8,
    /** 扫描动画时长（毫秒） - 已弃用，使用 timeline 控制 */
    duration: 400,
    /** 拖尾效果配置 */
    trail: {
      /** 拖尾宽度（像素） */
      width: 80,
      /** 拖尾透明度（从扫描线向外渐变到0） */
      alpha: 0.6,
    },
  },

  /** 网格充能效果配置 */
  gridCharge: {
    /** 充能区域宽度（像素，扫描线两侧） */
    width: 120,
    /** 充能时的最大透明度 */
    maxAlpha: 0.8,
    /** 充能衰减速度（每帧衰减比例） */
    decayRate: 0.95,
  },

  /** Glitch 切换效果配置 - 模拟 Three.js GlitchPass 风格 */
  glitchTransition: {
    /** 画面撕裂配置 */
    tear: {
      /** 基础切片数量 */
      slices: 8,
      /** 最大切片数量（随机爆发时） */
      maxSlices: 30,
      /** 最小偏移（像素） */
      minOffset: 20,
      /** 最大偏移（像素） */
      maxOffset: 200,
      /** 额外切片增量（随强度提升） */
      sliceBoost: 15,
      /** 切片随机扰动 */
      sliceJitter: 12,
      /** 垂直撕裂概率（0-1） */
      verticalChance: 0.3,
      /** 垂直撕裂时的方向角度（90度=垂直） */
      verticalDirection: 90,
    },
    /** RGB 分离配置 */
    rgb: {
      /** 最小偏移（像素） */
      minOffset: 10,
      /** 最大偏移（像素） */
      maxOffset: 100,
      /** 色道翻转间隔（毫秒） */
      flipInterval: 60,
      /** 额外抖动幅度 */
      jitter: 8,
      /** Y轴偏移范围（增强垂直分量） */
      yOffset: 30,
      /** 垂直主导概率（Y偏移大于X偏移） */
      verticalDominantChance: 0.25,
    },
    /** Glitch 更新节奏（毫秒，模拟低帧率感 - 类似示例的 fps=20） */
    updateInterval: 50,
    /** 随机爆发配置 */
    burst: {
      /** 爆发概率（每次更新时） */
      chance: 0.15,
      /** 爆发强度倍数 */
      intensityMultiplier: 2.5,
      /** 爆发持续帧数 */
      duration: 3,
    },
    /** 画面抖动配置 */
    shake: {
      /** 抖动幅度（像素） */
      amplitude: 4,
      /** 是否启用 */
      enabled: true,
    },
    /** 闪烁效果配置 */
    flicker: {
      /** 是否启用 */
      enabled: true,
      /** 闪烁概率 */
      chance: 0.08,
      /** 闪烁透明度范围 */
      alphaMin: 0.7,
      alphaMax: 1.0,
    },
    /** 放大系数（类似 glitchAmplification） */
    amplification: 0.5,
  },

  /** 背景网格配置 */
  grid: {
    /** 网格颜色 */
    color: 0x00e5cc,
    /** 网格线透明度 */
    alpha: 0.15,
    /** 网格间距（像素） */
    spacing: 40,
    /** 网格线宽度 */
    lineWidth: 1,
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
      speed: 90, // 更快的滚动速度
      opacity: 0.75,
    },
    /** 副条幅（向上滚动） */
    secondary: {
      text: "NEURAL LINK・SYSTEM READY・PROTOCOL ENGAGED・CONSCIOUSNESS SYNC・",
      fontSize: 42,
      speed: 65, // 与主条幅速度差异明显
      opacity: 0.55,
    },
  },
} as const;

// ============================================================================
// 动画缓动函数
// ============================================================================

export const EASING = {
  /** 线性 */
  linear: (t: number) => t,
  /** 缓入 */
  easeIn: (t: number) => t * t,
  /** 缓出 */
  easeOut: (t: number) => 1 - (1 - t) * (1 - t),
  /** 缓入缓出 */
  easeInOut: (t: number) =>
    t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
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
