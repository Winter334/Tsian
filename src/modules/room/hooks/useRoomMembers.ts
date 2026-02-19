/**
 * 房间成员 Hook
 *
 * 获取房间成员列表（只读访问）
 * ✅ 符合架构规范：UI 组件只读取状态
 */

import type { Member } from "@/core/yjs/room/types";
import { useRoomStore } from "../store";

/**
 * 获取房间成员列表
 *
 * @returns 成员数组
 *
 * @example
 * ```tsx
 * const members = useRoomMembers();
 *
 * return (
 *   <ul>
 *     {members.map((member) => (
 *       <li key={member.userId}>
 *         {member.displayName}
 *         {member.role === "host" && " (房主)"}
 *       </li>
 *     ))}
 *   </ul>
 * );
 * ```
 */
export function useRoomMembers(): Member[] {
  return useRoomStore((s) => s.members);
}
