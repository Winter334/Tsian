/**
 * 房间信息 Hook
 *
 * 获取房间基本信息（只读访问）
 * ✅ 符合架构规范：UI 组件只读取状态
 */

import { useRoomStore } from "../store";

/**
 * 获取房间基本信息
 *
 * @returns 房间模式、当前房间信息、错误信息、加载状态
 *
 * @example
 * ```tsx
 * const { mode, currentRoom, error, isLoading } = useRoomInfo();
 *
 * if (mode === "offline") {
 *   return <SinglePlayerView />;
 * }
 *
 * if (isLoading) {
 *   return <LoadingSpinner />;
 * }
 *
 * return <MultiplayerView room={currentRoom} />;
 * ```
 */
export function useRoomInfo() {
  const mode = useRoomStore((s) => s.mode);
  const currentRoom = useRoomStore((s) => s.currentRoom);
  const error = useRoomStore((s) => s.error);
  const isLoading = useRoomStore((s) => s.isLoading);

  return { mode, currentRoom, error, isLoading };
}
