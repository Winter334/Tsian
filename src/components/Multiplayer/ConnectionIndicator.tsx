/**
 * 连接状态指示器
 *
 * 显示当前与服务器的连接状态
 */

import type { ConnectionStatus } from "@/core/yjs/multiplayer-provider";

interface ConnectionIndicatorProps {
  status: ConnectionStatus;
  size?: "sm" | "md";
}

export function ConnectionIndicator({
  status,
  size = "sm",
}: ConnectionIndicatorProps) {
  const config: Record<ConnectionStatus, { color: string; animate: boolean }> =
    {
      disconnected: { color: "bg-gray-400", animate: false },
      connecting: { color: "bg-yellow-400", animate: true },
      connected: { color: "bg-blue-400", animate: false },
      synced: { color: "bg-green-400", animate: false },
      reconnecting: { color: "bg-yellow-400", animate: true },
      error: { color: "bg-red-400", animate: false },
    };

  const { color, animate } = config[status];
  const sizeClass = size === "sm" ? "w-2 h-2" : "w-3 h-3";

  return (
    <div
      className={`${sizeClass} rounded-full ${color} ${
        animate ? "animate-pulse" : ""
      }`}
    />
  );
}
