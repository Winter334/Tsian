/**
 * 连接状态 Hook
 *
 * 获取当前连接状态（只读访问）
 * ✅ 符合架构规范：UI 组件只读取状态
 */

import type { ConnectionStatus } from "@/core/yjs/multiplayer-provider";
import { useRoomStore } from "../store";

/**
 * 获取连接状态
 *
 * @returns 连接状态
 *
 * 状态说明：
 * - `disconnected`: 未连接
 * - `connecting`: 正在连接
 * - `connected`: 已连接（WebSocket 建立）
 * - `synced`: 已同步（Yjs 文档同步完成）
 * - `reconnecting`: 正在重连
 * - `error`: 连接错误
 *
 * @example
 * ```tsx
 * const status = useConnectionStatus();
 *
 * return (
 *   <div className={`
 *     w-2 h-2 rounded-full
 *     ${status === "synced" ? "bg-green-500" : ""}
 *     ${status === "connecting" || status === "reconnecting" ? "bg-yellow-500 animate-pulse" : ""}
 *     ${status === "error" ? "bg-red-500" : ""}
 *     ${status === "disconnected" ? "bg-gray-400" : ""}
 *   `} />
 * );
 * ```
 */
export function useConnectionStatus(): ConnectionStatus {
  return useRoomStore((s) => s.connectionStatus);
}
