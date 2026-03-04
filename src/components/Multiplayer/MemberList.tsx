/**
 * 成员列表组件
 *
 * 显示房间内的所有成员
 */

import type { Member } from "@/core/yjs/room/types";
import { Crown } from "lucide-react";
import type { ReactNode } from "react";

import { color, colorAlpha } from "@/styles/tokens";

interface MemberListProps {
  members: Member[];
  localUserId: string;
  compact?: boolean;
  renderExtra?: (member: Member) => ReactNode;
}

function MemberStatusDot({
  status,
  compact,
}: {
  status: Member["status"];
  compact?: boolean;
}) {
  return (
    <div
      className={compact ? "h-1.5 w-1.5 rounded-full" : "h-2 w-2 rounded-full"}
      style={{
        background: status === "online" ? color("success") : color("warning"),
      }}
    />
  );
}

export function MemberList({
  members,
  localUserId,
  compact = false,
  renderExtra,
}: MemberListProps) {
  if (compact) {
    return (
      <div className="space-y-1">
        {members.map((member) => {
          const extraContent = renderExtra?.(member);
          return (
            <div
              key={member.userId}
              className="flex items-center justify-between gap-2 text-sm"
            >
              <div className="flex min-w-0 items-center gap-2">
                <MemberStatusDot status={member.status} compact />
                <span className="truncate">{member.displayName}</span>
                {member.role === "host" && (
                  <Crown size={12} style={{ color: color("warning") }} />
                )}
              </div>
              {extraContent ? (
                <div className="shrink-0">{extraContent}</div>
              ) : null}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {members.map((member) => {
        const extraContent = renderExtra?.(member);
        return (
          <div
            key={member.userId}
            className="flex items-center gap-3 rounded-lg p-2"
            style={{ background: colorAlpha("bgElevated", 0.32) }}
          >
            <MemberStatusDot status={member.status} />

            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20">
              <span className="text-sm font-medium">
                {(member.displayName[0] ?? "?").toUpperCase()}
              </span>
            </div>

            <div className="flex min-w-0 flex-1 items-center gap-2">
              <span
                className={
                  member.userId === localUserId
                    ? "truncate font-medium"
                    : "truncate"
                }
              >
                {member.displayName}
                {member.userId === localUserId && " (你)"}
              </span>

              {member.role === "host" && (
                <span
                  className="flex items-center gap-1 rounded px-2 py-0.5 text-xs text-primary"
                  style={{ background: colorAlpha("primary", 0.2) }}
                >
                  <Crown size={10} />
                  房主
                </span>
              )}
            </div>

            {extraContent ? (
              <div className="shrink-0">{extraContent}</div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
