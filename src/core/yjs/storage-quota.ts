/**
 * 存储配额监控
 *
 * 提供 IndexedDB 存储使用情况检测和警告功能
 */

/**
 * 存储使用情况
 */
export interface StorageUsage {
  /** 已使用空间（字节） */
  used: number;
  /** 总配额（字节） */
  quota: number;
  /** 使用百分比 (0-100) */
  percentage: number;
  /** 剩余空间（字节） */
  remaining: number;
  /** 是否支持 Storage API */
  supported: boolean;
}

/**
 * 存储警告级别
 */
export type StorageWarningLevel = "normal" | "warning" | "critical" | "full";

/**
 * 警告阈值配置
 */
export interface StorageThresholds {
  /** 警告阈值（百分比） */
  warning: number;
  /** 严重警告阈值（百分比） */
  critical: number;
}

/**
 * 默认阈值
 */
const DEFAULT_THRESHOLDS: StorageThresholds = {
  warning: 70, // 70% 时警告
  critical: 90, // 90% 时严重警告
};

/**
 * 获取存储使用情况
 * 使用 Storage API（如果可用）
 */
export async function getStorageUsage(): Promise<StorageUsage> {
  // 检查 Storage API 是否可用
  if (!navigator.storage || !navigator.storage.estimate) {
    return {
      used: 0,
      quota: 0,
      percentage: 0,
      remaining: 0,
      supported: false,
    };
  }

  try {
    const estimate = await navigator.storage.estimate();
    const used = estimate.usage || 0;
    const quota = estimate.quota || 0;
    const percentage = quota > 0 ? Math.round((used / quota) * 100) : 0;
    const remaining = quota - used;

    return {
      used,
      quota,
      percentage,
      remaining,
      supported: true,
    };
  } catch {
    return {
      used: 0,
      quota: 0,
      percentage: 0,
      remaining: 0,
      supported: false,
    };
  }
}

/**
 * 获取存储警告级别
 */
export function getStorageWarningLevel(
  usage: StorageUsage,
  thresholds: StorageThresholds = DEFAULT_THRESHOLDS
): StorageWarningLevel {
  if (!usage.supported) {
    return "normal"; // 无法检测时不警告
  }

  if (usage.percentage >= 100) {
    return "full";
  }

  if (usage.percentage >= thresholds.critical) {
    return "critical";
  }

  if (usage.percentage >= thresholds.warning) {
    return "warning";
  }

  return "normal";
}

/**
 * 格式化字节大小为人类可读格式
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB"];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const size = bytes / Math.pow(k, i);

  return `${size.toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

/**
 * 获取警告消息
 */
export function getStorageWarningMessage(
  level: StorageWarningLevel,
  usage: StorageUsage
): string | null {
  switch (level) {
    case "full":
      return `存储空间已满！已使用 ${formatBytes(
        usage.used
      )}，无法保存更多数据。请删除不需要的存档。`;
    case "critical":
      return `存储空间严重不足！已使用 ${usage.percentage}%（${formatBytes(
        usage.used
      )} / ${formatBytes(usage.quota)}），剩余 ${formatBytes(
        usage.remaining
      )}。`;
    case "warning":
      return `存储空间不足，已使用 ${usage.percentage}%（${formatBytes(
        usage.used
      )} / ${formatBytes(usage.quota)}）。`;
    case "normal":
    default:
      return null;
  }
}

/**
 * 检查存储并返回警告信息（如果需要）
 */
export async function checkStorageAndWarn(
  thresholds?: StorageThresholds
): Promise<{
  usage: StorageUsage;
  level: StorageWarningLevel;
  message: string | null;
}> {
  const usage = await getStorageUsage();
  const level = getStorageWarningLevel(usage, thresholds);
  const message = getStorageWarningMessage(level, usage);

  return { usage, level, message };
}

/**
 * 请求持久化存储
 * 防止浏览器在存储压力下自动清除数据
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (!navigator.storage || !navigator.storage.persist) {
    return false;
  }

  try {
    // 检查是否已经是持久化存储
    const isPersisted = await navigator.storage.persisted();
    if (isPersisted) {
      return true;
    }

    // 请求持久化
    const granted = await navigator.storage.persist();
    return granted;
  } catch {
    return false;
  }
}

/**
 * 检查是否为持久化存储
 */
export async function isPersistentStorage(): Promise<boolean> {
  if (!navigator.storage || !navigator.storage.persisted) {
    return false;
  }

  try {
    return await navigator.storage.persisted();
  } catch {
    return false;
  }
}
