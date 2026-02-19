/**
 * Yjs/IndexedDB 错误处理组件
 */

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { color, colorAlpha } from "@/styles/tokens";
import { AlertTriangle, Database, RefreshCw } from "lucide-react";
import type { StorageErrorType } from "./error-utils";

// 重新导出类型以保持向后兼容
export type { StorageErrorType } from "./error-utils";

interface StorageErrorInfo {
  type: StorageErrorType;
  title: string;
  description: string;
  suggestion: string;
  canRetry: boolean;
}

const ERROR_INFO: Record<StorageErrorType, Omit<StorageErrorInfo, "type">> = {
  "indexeddb-not-supported": {
    title: "浏览器不支持本地存储",
    description:
      "你的浏览器不支持 IndexedDB，无法保存游戏进度。这可能是因为浏览器版本过旧或处于隐私模式。",
    suggestion:
      "请使用 Chrome 89+ / Firefox 111+ / Safari 15.2+ / Edge 89+ 等现代浏览器，并确保未处于隐私/无痕模式。",
    canRetry: false,
  },
  "indexeddb-blocked": {
    title: "存储访问被阻止",
    description:
      "浏览器阻止了对本地存储的访问。这可能是因为隐私设置、浏览器扩展或企业策略。",
    suggestion:
      "请检查浏览器设置，确保允许网站使用本地存储。如果使用了隐私扩展，请将本站加入白名单。",
    canRetry: true,
  },
  "indexeddb-quota-exceeded": {
    title: "存储空间不足",
    description: "本地存储空间已满，无法保存更多数据。",
    suggestion: "请清理浏览器缓存或删除不需要的存档，释放存储空间后重试。",
    canRetry: true,
  },
  "indexeddb-unknown": {
    title: "存储初始化失败",
    description: "初始化本地存储时发生未知错误。",
    suggestion: "请刷新页面重试。如果问题持续，请尝试清除浏览器缓存。",
    canRetry: true,
  },
};

interface StorageErrorDialogProps {
  open: boolean;
  errorType: StorageErrorType;
  onRetry?: () => void;
  onDismiss?: () => void;
}

/**
 * 存储错误对话框
 */
export function StorageErrorDialog({
  open,
  errorType,
  onRetry,
  onDismiss,
}: StorageErrorDialogProps) {
  const info = ERROR_INFO[errorType];

  return (
    <Dialog open={open} onOpenChange={() => onDismiss?.()}>
      <DialogContent title={info.title} className="max-w-md">
        {/* 图标 */}
        <div className="flex justify-center mb-4">
          <div
            className="p-4 rounded-full"
            style={{
              background: colorAlpha("error", 0.15),
            }}
          >
            {errorType === "indexeddb-quota-exceeded" ? (
              <Database
                className="w-12 h-12"
                style={{ color: color("error") }}
              />
            ) : (
              <AlertTriangle
                className="w-12 h-12"
                style={{ color: color("error") }}
              />
            )}
          </div>
        </div>

        {/* 描述 */}
        <p
          className="text-center mb-4"
          style={{ color: color("textSecondary") }}
        >
          {info.description}
        </p>

        {/* 建议 */}
        <div
          className="p-3 rounded-lg mb-4"
          style={{
            background: colorAlpha("warning", 0.1),
            border: `1px solid ${colorAlpha("warning", 0.3)}`,
          }}
        >
          <p className="text-sm" style={{ color: color("warning") }}>
            提示：{info.suggestion}
          </p>
        </div>

        {/* 操作按钮 */}
        <DialogFooter>
          {info.canRetry && onRetry && (
            <Button onClick={onRetry} variant="default">
              <RefreshCw className="w-4 h-4 mr-2" />
              重试
            </Button>
          )}
          {onDismiss && (
            <Button onClick={onDismiss} variant="ghost">
              {info.canRetry ? "取消" : "我知道了"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
