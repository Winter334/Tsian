/**
 * 存储配额监控 Hook
 */

import { useCallback, useEffect, useState } from "react";
import {
  checkStorageAndWarn,
  formatBytes,
  getStorageUsage,
  getStorageWarningLevel,
  isPersistentStorage,
  requestPersistentStorage,
  type StorageThresholds,
  type StorageUsage,
  type StorageWarningLevel,
} from "../storage-quota";

/**
 * 存储配额状态
 */
export interface StorageQuotaState {
  /** 存储使用情况 */
  usage: StorageUsage | null;
  /** 警告级别 */
  warningLevel: StorageWarningLevel;
  /** 警告消息 */
  warningMessage: string | null;
  /** 是否为持久化存储 */
  isPersistent: boolean;
  /** 是否正在加载 */
  isLoading: boolean;
  /** 刷新数据 */
  refresh: () => Promise<void>;
  /** 请求持久化存储 */
  requestPersistence: () => Promise<boolean>;
  /** 格式化字节 */
  formatBytes: (bytes: number) => string;
}

/**
 * 存储配额监控 Hook
 *
 * @param options - 配置选项
 * @returns 存储配额状态
 *
 * @example
 * ```tsx
 * function StorageIndicator() {
 *   const { usage, warningLevel, warningMessage } = useStorageQuota();
 *
 *   if (warningLevel !== 'normal' && warningMessage) {
 *     return <Alert variant="warning">{warningMessage}</Alert>;
 *   }
 *
 *   return (
 *     <div>
 *       已使用: {usage?.percentage}%
 *     </div>
 *   );
 * }
 * ```
 */
export function useStorageQuota(options?: {
  /** 自动刷新间隔（毫秒），0 表示不自动刷新 */
  refreshInterval?: number;
  /** 警告阈值 */
  thresholds?: StorageThresholds;
}): StorageQuotaState {
  const { refreshInterval = 0, thresholds } = options || {};

  const [usage, setUsage] = useState<StorageUsage | null>(null);
  const [warningLevel, setWarningLevel] =
    useState<StorageWarningLevel>("normal");
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  const [isPersistent, setIsPersistent] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // 刷新数据
  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await checkStorageAndWarn(thresholds);
      setUsage(result.usage);
      setWarningLevel(result.level);
      setWarningMessage(result.message);

      const persistent = await isPersistentStorage();
      setIsPersistent(persistent);
    } catch (error) {
      console.error("[useStorageQuota] Failed to refresh:", error);
    } finally {
      setIsLoading(false);
    }
  }, [thresholds]);

  // 请求持久化存储
  const requestPersistence = useCallback(async () => {
    const granted = await requestPersistentStorage();
    if (granted) {
      setIsPersistent(true);
    }
    return granted;
  }, []);

  // 初始加载
  useEffect(() => {
    refresh();
  }, [refresh]);

  // 自动刷新
  useEffect(() => {
    if (refreshInterval <= 0) return;

    const timer = setInterval(refresh, refreshInterval);
    return () => clearInterval(timer);
  }, [refresh, refreshInterval]);

  return {
    usage,
    warningLevel,
    warningMessage,
    isPersistent,
    isLoading,
    refresh,
    requestPersistence,
    formatBytes,
  };
}

/**
 * 简化版 Hook：只返回是否需要警告
 */
export function useStorageWarning(thresholds?: StorageThresholds): {
  shouldWarn: boolean;
  level: StorageWarningLevel;
  message: string | null;
} {
  const [state, setState] = useState<{
    shouldWarn: boolean;
    level: StorageWarningLevel;
    message: string | null;
  }>({
    shouldWarn: false,
    level: "normal",
    message: null,
  });

  useEffect(() => {
    async function check() {
      const usage = await getStorageUsage();
      const level = getStorageWarningLevel(usage, thresholds);
      const shouldWarn = level !== "normal";

      let message: string | null = null;
      if (shouldWarn) {
        const { message: msg } = await checkStorageAndWarn(thresholds);
        message = msg;
      }

      setState({ shouldWarn, level, message });
    }

    check();
  }, [thresholds]);

  return state;
}
