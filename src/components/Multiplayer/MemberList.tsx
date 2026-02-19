/**
 * 成员列表组件
 *
 * 显示房间内的所有成员
 */

import type { Member } from "@/core/yjs/room/types";
import { Crown } from "lucide-react";

interface MemberListProps {
  members: Member[];
  localUserId: string;
  compact?: boolean;
}

export function MemberList({
  members,
  localUserId,
  compact = false,
}: MemberListProps) {
  if (compact) {
    return (
      <div className="space-y-1">
        {members.map((member) => (
          <div key={member.userId} className="flex items-center gap-2 text-sm">
            <div
              className={`w-1.5 h-1.5 rounded-full ${
                member.status === "online" ? "bg-green-500" : "bg-yellow-500"
              }`}
            />
            <span className="truncate">{member.displayName}</span>
            {member.role === "host" && (
              <Crown size={12} className="text-yellow-500" />
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {members.map((member) => (
        <div
          key={member.userId}
          className="flex items-center gap-3 p-2 rounded-lg bg-muted/30"
        >
          {/* 在线状态 */}
          <div
            className={`w-2 h-2 rounded-full ${
              member.status === "online" ? "bg-green-500" : "bg-yellow-500"
            }`}
          />

          {/* 头像 */}
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
            <span className="text-sm font-medium">
              {member.displayName[0].toUpperCase()}
            </span>
          </div>

          {/* 名称 */}
          <span className={member.userId === localUserId ? "font-medium" : ""}>
            {member.displayName}
            {member.userId === localUserId && " (你)"}
          </span>

          {/* 角色标签 */}
          {member.role === "host" && (
            <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded flex items-center gap-1">
              <Crown size={10} />
              房主
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
