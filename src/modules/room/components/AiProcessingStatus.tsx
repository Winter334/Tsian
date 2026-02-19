/**
 * AiProcessingStatus - AI 处理状态显示组件
 *
 * 显示 AI 处理的各种状态：
 * - processing: 正在处理
 * - retrying: 正在重试 (x/3)
 * - failed: 失败，显示错误信息
 * - aborted: 已中断
 *
 * Host 和 Guest 显示不同的 UI：
 * - Host: 显示操作按钮
 * - Guest: 显示等待提示
 *
 * @module room/components/AiProcessingStatus
 */

import { Button } from "@/components/ui";
import type { AiAborted, AiError, AiStatus } from "@/core/yjs/room/types";
import { RoomCommands } from "@/domain/commands/room";
import { useCommand } from "@/hooks/use-command";
import { cn } from "@/lib/utils";
import { borders, color, colorAlpha } from "@/styles/tokens";
import {
  AlertCircle,
  Ban,
  Loader2,
  RefreshCw,
  Settings,
  SkipForward,
  WifiOff,
} from "lucide-react";
import { useCallback, useState } from "react";
import { useRoomStore } from "../store";

// ===== 类型定义 =====

interface AiProcessingStatusProps {
  /** 房间 ID */
  roomId: string;
  /** 当前回合号 */
  turnNumber: number;
  /** AI 状态 */
  status: AiStatus;
  /** 错误信息 */
  error: AiError | null;
  /** 中断信息 */
  aborted: AiAborted | null;
  /** 自定义样式 */
  className?: string;
}

// ===== 错误类型映射 =====

const ERROR_MESSAGES: Record<string, string> = {
  network: "网络连接失败",
  timeout: "请求超时",
  rate_limit: "请求过于频繁",
  auth: "API Key 无效",
  quota: "配额已用尽",
  model_not_found: "模型不存在",
  context_length: "上下文过长",
  content_filter: "内容被过滤",
  unknown: "未知错误",
};

const ABORT_REASON_MESSAGES: Record<string, string> = {
  host_cancel: "房主已取消",
  host_offline: "房主离线",
  regenerate: "正在重新生成",
};

// ===== 组件实现 =====

export function AiProcessingStatus({
  roomId,
  turnNumber,
  status,
  error,
  aborted,
  className,
}: AiProcessingStatusProps) {
  const dispatch = useCommand();
  const isHost = useRoomStore((s) => s.currentRoom?.isHost ?? false);
  const [isLoading, setIsLoading] = useState(false);

  // 取消 AI 处理
  const handleCancel = useCallback(async () => {
    setIsLoading(true);
    try {
      await dispatch({
        type: RoomCommands.CANCEL_AI_TURN,
        payload: {
          roomId,
          turnNumber,
          userId: useRoomStore.getState().localUser.userId,
        },
      });
    } finally {
      setIsLoading(false);
    }
  }, [dispatch, roomId, turnNumber]);

  // 重新生成
  const handleRegenerate = useCallback(async () => {
    setIsLoading(true);
    try {
      await dispatch({
        type: RoomCommands.REGENERATE_AI_TURN,
        payload: {
          roomId,
          turnNumber,
          userId: useRoomStore.getState().localUser.userId,
        },
      });
    } finally {
      setIsLoading(false);
    }
  }, [dispatch, roomId, turnNumber]);

  // 重试
  const handleRetry = useCallback(async () => {
    setIsLoading(true);
    try {
      await dispatch({
        type: RoomCommands.PROCESS_AI_TURN,
        payload: {
          roomId,
          turnNumber,
          userId: useRoomStore.getState().localUser.userId,
        },
      });
    } finally {
      setIsLoading(false);
    }
  }, [dispatch, roomId, turnNumber]);

  // 空闲/已完成状态不显示
  if (status === "idle" || status === "completed") {
    return null;
  }

  // 正在处理
  if (status === "processing") {
    return (
      <div
        className={cn(
          "flex items-center justify-between p-4 rounded-xl border",
          className
        )}
        style={{
          background: colorAlpha("primary", 0.1),
          borderColor: colorAlpha("primary", 0.3),
          borderRadius: borders.radius.lg,
        }}
      >
        <div className="flex items-center gap-3">
          <Loader2
            className="w-5 h-5 animate-spin"
            style={{ color: color("primary") }}
          />
          <span className="text-sm" style={{ color: color("textPrimary") }}>
            AI 正在生成回复...
          </span>
        </div>

        {/* Host 可取消 */}
        {isHost && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCancel}
            disabled={isLoading}
          >
            <Ban className="w-4 h-4 mr-1" />
            取消
          </Button>
        )}
      </div>
    );
  }

  // 正在重试
  if (status === "retrying") {
    const retryCount = error?.retryCount ?? 0;
    const maxRetries = 3;

    return (
      <div
        className={cn(
          "flex items-center justify-between p-4 rounded-xl border",
          className
        )}
        style={{
          background: colorAlpha("warning", 0.1),
          borderColor: colorAlpha("warning", 0.3),
          borderRadius: borders.radius.lg,
        }}
      >
        <div className="flex items-center gap-3">
          <RefreshCw
            className="w-5 h-5 animate-spin"
            style={{ color: color("warning") }}
          />
          <span className="text-sm" style={{ color: color("textPrimary") }}>
            正在重试 ({retryCount + 1}/{maxRetries})...
          </span>
        </div>

        {/* Host 可取消 */}
        {isHost && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCancel}
            disabled={isLoading}
          >
            <Ban className="w-4 h-4 mr-1" />
            取消
          </Button>
        )}
      </div>
    );
  }

  // 失败状态
  if (status === "failed") {
    const errorMessage =
      error?.message || ERROR_MESSAGES[error?.type ?? "unknown"];
    const canAutoRetry =
      error?.type === "network" ||
      error?.type === "timeout" ||
      error?.type === "rate_limit";

    return (
      <div
        className={cn("p-4 rounded-xl border", className)}
        style={{
          background: colorAlpha("error", 0.1),
          borderColor: colorAlpha("error", 0.3),
          borderRadius: borders.radius.lg,
        }}
      >
        <div className="flex items-start gap-3 mb-3">
          <AlertCircle
            className="w-5 h-5 mt-0.5"
            style={{ color: color("error") }}
          />
          <div className="flex-1">
            <div
              className="text-sm font-medium"
              style={{ color: color("error") }}
            >
              AI 处理失败
            </div>
            <div
              className="text-xs mt-1"
              style={{ color: color("textSecondary") }}
            >
              {errorMessage}
            </div>
          </div>
        </div>

        {/* Host 显示操作按钮 */}
        {isHost ? (
          <div className="flex gap-2">
            {canAutoRetry && (
              <Button
                variant="default"
                size="sm"
                onClick={handleRetry}
                disabled={isLoading}
                className="flex-1"
              >
                <RefreshCw className="w-4 h-4 mr-1" />
                重试
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRegenerate}
              disabled={isLoading}
              className="flex-1"
            >
              <RefreshCw className="w-4 h-4 mr-1" />
              重新生成
            </Button>
            {error?.type === "auth" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  // 打开设置页面（需要通过事件或路由）
                  window.dispatchEvent(
                    new CustomEvent("open-settings", { detail: { tab: "ai" } })
                  );
                }}
              >
                <Settings className="w-4 h-4 mr-1" />
                设置
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                // TODO: 实现跳过回合
                console.log("Skip turn");
              }}
              disabled={isLoading}
            >
              <SkipForward className="w-4 h-4 mr-1" />
              跳过
            </Button>
          </div>
        ) : (
          /* Guest 显示等待提示 */
          <div
            className="text-center text-sm py-2"
            style={{ color: color("textSecondary") }}
          >
            AI 处理遇到问题，等待房主处理...
          </div>
        )}
      </div>
    );
  }

  // 已中断状态
  if (status === "aborted") {
    const reason = aborted?.reason ?? "host_cancel";
    const reasonMessage = ABORT_REASON_MESSAGES[reason];

    // Host 离线特殊显示
    if (reason === "host_offline") {
      return (
        <div
          className={cn("p-4 rounded-xl border", className)}
          style={{
            background: colorAlpha("warning", 0.1),
            borderColor: colorAlpha("warning", 0.3),
            borderRadius: borders.radius.lg,
          }}
        >
          <div className="flex items-center gap-3">
            <WifiOff className="w-5 h-5" style={{ color: color("warning") }} />
            <span className="text-sm" style={{ color: color("textPrimary") }}>
              房主离线，AI 处理中断
            </span>
          </div>
        </div>
      );
    }

    return (
      <div
        className={cn("p-4 rounded-xl border", className)}
        style={{
          background: colorAlpha("bgCard", 0.8),
          borderColor: colorAlpha("textSecondary", 0.3),
          borderRadius: borders.radius.lg,
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Ban
              className="w-5 h-5"
              style={{ color: color("textSecondary") }}
            />
            <span className="text-sm" style={{ color: color("textSecondary") }}>
              {reasonMessage}
            </span>
          </div>

          {/* Host 可重新生成 */}
          {isHost && (
            <Button
              variant="default"
              size="sm"
              onClick={handleRegenerate}
              disabled={isLoading}
            >
              <RefreshCw className="w-4 h-4 mr-1" />
              重新生成
            </Button>
          )}
        </div>
      </div>
    );
  }

  return null;
}
