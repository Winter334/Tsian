/**
 * 存储警告横幅组件
 *
 * 当存储空间不足时显示警告
 */

import { Button } from "@/components/ui/button";
import { color, colorAlpha } from "@/styles/tokens";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Database, X } from "lucide-react";
import { useState } from "react";
import { useStorageQuota } from "../hooks/useStorageQuota";
import type { StorageWarningLevel } from "../storage-quota";

interface StorageWarningBannerProps {
  /** 是否显示关闭按钮 */
  dismissible?: boolean;
  /** 关闭后的回调 */
  onDismiss?: () => void;
  /** 自定义类名 */
  className?: string;
}

/**
 * 获取警告级别对应的颜色
 */
function getWarningColor(level: StorageWarningLevel): string {
  switch (level) {
    case "full":
    case "critical":
      return "error";
    case "warning":
      return "warning";
    default:
      return "primary";
  }
}

/**
 * 存储警告横幅
 *
 * @example
 * ```tsx
 * // 在 App 顶部显示
 * <StorageWarningBanner dismissible />
 * ```
 */
export function StorageWarningBanner({
  dismissible = true,
  onDismiss,
  className,
}: StorageWarningBannerProps) {
  const { usage, warningLevel, warningMessage, formatBytes, refresh } =
    useStorageQuota({
      refreshInterval: 60000, // 每分钟刷新一次
    });

  const [dismissed, setDismissed] = useState(false);

  // 不需要警告或已关闭
  if (warningLevel === "normal" || dismissed || !warningMessage) {
    return null;
  }

  const colorName = getWarningColor(warningLevel);

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className={className}
        style={{
          background: colorAlpha(colorName as "error" | "warning", 0.15),
          borderBottom: `1px solid ${colorAlpha(
            colorName as "error" | "warning",
            0.3
          )}`,
        }}
      >
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          {/* 图标 */}
          <div
            className="shrink-0 p-2 rounded-full"
            style={{
              background: colorAlpha(colorName as "error" | "warning", 0.2),
            }}
          >
            {warningLevel === "full" ? (
              <Database
                className="w-5 h-5"
                style={{ color: color(colorName as "error" | "warning") }}
              />
            ) : (
              <AlertTriangle
                className="w-5 h-5"
                style={{ color: color(colorName as "error" | "warning") }}
              />
            )}
          </div>

          {/* 消息 */}
          <div className="flex-1 min-w-0">
            <p
              className="text-sm font-medium"
              style={{ color: color(colorName as "error" | "warning") }}
            >
              {warningMessage}
            </p>
            {usage && (
              <p
                className="text-xs mt-0.5"
                style={{ color: color("textMuted") }}
              >
                已使用 {formatBytes(usage.used)} / {formatBytes(usage.quota)}
              </p>
            )}
          </div>

          {/* 操作按钮 */}
          <div className="shrink-0 flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={refresh}
              className="text-xs"
            >
              刷新
            </Button>

            {dismissible && (
              <button
                onClick={handleDismiss}
                className="p-1 rounded hover:bg-white/10 transition-colors"
                style={{ color: color("textMuted") }}
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

/**
 * 存储使用情况指示器（紧凑版）
 *
 * @example
 * ```tsx
 * // 在设置页面显示
 * <StorageIndicator />
 * ```
 */
export function StorageIndicator() {
  const { usage, warningLevel, isLoading, formatBytes, refresh, isPersistent } =
    useStorageQuota();

  if (isLoading || !usage || !usage.supported) {
    return null;
  }

  const colorName = getWarningColor(warningLevel);

  return (
    <div className="space-y-2">
      {/* 进度条 */}
      <div className="flex items-center gap-3">
        <Database className="w-4 h-4" style={{ color: color("textMuted") }} />
        <div className="flex-1">
          <div
            className="h-2 rounded-full overflow-hidden"
            style={{ background: colorAlpha("primary", 0.2) }}
          >
            <motion.div
              className="h-full rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${usage.percentage}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              style={{
                background: color(colorName as "error" | "warning" | "primary"),
              }}
            />
          </div>
        </div>
        <span
          className="text-xs font-mono"
          style={{ color: color("textMuted") }}
        >
          {usage.percentage}%
        </span>
      </div>

      {/* 详细信息 */}
      <div className="flex items-center justify-between text-xs">
        <span style={{ color: color("textMuted") }}>
          {formatBytes(usage.used)} / {formatBytes(usage.quota)}
        </span>
        <div className="flex items-center gap-2">
          {isPersistent && (
            <span
              className="px-1.5 py-0.5 rounded text-xs"
              style={{
                background: colorAlpha("success", 0.2),
                color: color("success"),
              }}
            >
              持久化
            </span>
          )}
          <button
            onClick={refresh}
            className="hover:underline"
            style={{ color: color("primary") }}
          >
            刷新
          </button>
        </div>
      </div>
    </div>
  );
}
