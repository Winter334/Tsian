/**
 * 应用配置
 * Logo 名称等可在此处修改
 */
export const APP_CONFIG = {
  /** 应用名称（显示在 Logo 处） */
  name: "此间",
  /** 版本号 */
  version: "0.1.0",
  /** 应用描述 */
  description: "纯网页 AI 角色扮演游戏框架",
} as const;

/**
 * 代码雨配置（模仿示例项目的 Matrix 风格）
 */
export const MATRIX_CONFIG = {
  /** 日文片假名 + 数字字符集（与示例项目一致） */
  chars:
    "01アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン",
  /** 字体大小 */
  fontSize: 14,
  /** 下落速度（降低以获得更平缓的效果） */
  speed: 0.5,
  /** 主题色（霓虹青色，适配深黑背景） */
  color: "rgba(0, 229, 204, 0.25)",
  /** 头部高亮色（亮青色） */
  headColor: "rgba(94, 255, 232, 0.55)",
  /** 背景淡出速度（控制拖尾长度） */
  fadeOpacity: 0.05,
} as const;

/**
 * 浮动粒子配置
 */
export const PARTICLES_CONFIG = {
  /** 粒子数量 */
  count: 30,
  /** 字符集 */
  chars: ["0", "1", "{", "}", "[", "]", "<", ">", "/", "*"],
  /** 动画时长范围（秒） */
  durationRange: [6, 10],
} as const;
