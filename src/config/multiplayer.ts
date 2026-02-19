/**
 * 联机配置
 *
 * 管理 Hocuspocus 服务器连接配置
 * 支持开发/生产环境自动切换，以及用户自定义服务器
 */

/**
 * 联机配置接口
 */
export interface MultiplayerConfig {
  /** HTTP API 地址 */
  apiUrl: string;
  /** WebSocket 地址 */
  wsUrl: string;
  /** 是否使用自定义服务器 */
  useCustomServer: boolean;
}

/**
 * 自定义服务器设置（存储在 settings 中）
 */
export interface CustomServerSettings {
  /** 是否启用自定义服务器 */
  useCustomServer: boolean;
  /** 自定义 API 地址 */
  customApiUrl: string;
  /** 自定义 WebSocket 地址 */
  customWsUrl: string;
}

/**
 * 生产环境配置（官方服务器）
 */
const PROD_CONFIG: MultiplayerConfig = {
  apiUrl: "https://lyra-ws.lyrashore.com/api",
  wsUrl: "wss://lyra-ws.lyrashore.com/ws",
  useCustomServer: false,
};

/**
 * 开发环境配置
 */
const DEV_CONFIG: MultiplayerConfig = {
  apiUrl: "http://localhost:3000/api",
  wsUrl: "ws://localhost:1234",
  useCustomServer: false,
};

/**
 * 获取默认配置（根据环境自动选择）
 */
function getDefaultConfig(): MultiplayerConfig {
  return import.meta.env.DEV ? DEV_CONFIG : PROD_CONFIG;
}

/**
 * 从 localStorage 读取自定义服务器设置
 */
function getCustomServerSettings(): CustomServerSettings | null {
  try {
    const stored = localStorage.getItem("lyra.multiplayer");
    if (stored) {
      return JSON.parse(stored) as CustomServerSettings;
    }
  } catch {
    // 忽略解析错误
  }
  return null;
}

/**
 * 保存自定义服务器设置到 localStorage
 */
export function saveCustomServerSettings(settings: CustomServerSettings): void {
  localStorage.setItem("lyra.multiplayer", JSON.stringify(settings));
}

/**
 * 获取当前联机配置
 *
 * 优先级：
 * 1. 用户自定义服务器设置
 * 2. 环境默认配置（开发/生产）
 */
export function getMultiplayerConfig(): MultiplayerConfig {
  const customSettings = getCustomServerSettings();

  if (customSettings?.useCustomServer) {
    return {
      apiUrl: customSettings.customApiUrl,
      wsUrl: customSettings.customWsUrl,
      useCustomServer: true,
    };
  }

  return getDefaultConfig();
}

/**
 * 验证服务器地址格式
 */
export function validateServerUrl(url: string, type: "api" | "ws"): boolean {
  try {
    const parsed = new URL(url);
    if (type === "api") {
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } else {
      return parsed.protocol === "ws:" || parsed.protocol === "wss:";
    }
  } catch {
    return false;
  }
}

/**
 * 检查是否为开发环境
 */
export function isDevelopment(): boolean {
  return import.meta.env.DEV;
}

/**
 * 获取当前环境名称
 */
export function getEnvironmentName(): string {
  const config = getMultiplayerConfig();
  if (config.useCustomServer) {
    return "自定义服务器";
  }
  return import.meta.env.DEV ? "开发环境" : "生产环境";
}
