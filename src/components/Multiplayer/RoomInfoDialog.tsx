import { Check, Copy, Crown, LogOut, Users } from "lucide-react";
import { useMemo, useState } from "react";

import { Button, Dialog, DialogContent } from "@/components/ui";
import type { ConnectionStatus } from "@/core/yjs/multiplayer-provider";
import type { Member } from "@/core/yjs/room/types";
import { getOrCreateUserId } from "@/lib/user-identity";
import {
  useConnectionStatus,
  useLeaveRoom,
  useRoomInfo,
  useRoomMembers,
  useTurnControl,
} from "@/modules";

import { ConnectionIndicator } from "./ConnectionIndicator";

interface RoomInfoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLeave?: () => void;
}

interface MemberActionView extends Member {
  isSubmitted: boolean;
  isTyping: boolean;
}

const CONNECTION_LABEL: Record<ConnectionStatus, string> = {
  disconnected: "未连接",
  connecting: "连接中...",
  connected: "已连接",
  synced: "已同步",
  reconnecting: "重连中...",
  error: "连接错误",
};

function resolveMemberActionStatus(
  member: MemberActionView,
  turnNumber: number,
  isLocked: boolean
): { label: string; className: string } {
  if (turnNumber <= 0) {
    return {
      label: "等待回合",
      className: "text-muted-foreground",
    };
  }

  if (isLocked) {
    return member.isSubmitted
      ? { label: "已锁定", className: "text-amber-400" }
      : { label: "未提交", className: "text-muted-foreground" };
  }

  if (member.isSubmitted) {
    return { label: "已提交", className: "text-emerald-400" };
  }

  if (member.isTyping) {
    return { label: "输入中...", className: "text-cyan-400 animate-pulse" };
  }

  return { label: "待输入", className: "text-muted-foreground" };
}

export function RoomInfoDialog({
  open,
  onOpenChange,
  onLeave,
}: RoomInfoDialogProps) {
  const { mode, currentRoom } = useRoomInfo();
  const members = useRoomMembers();
  const connectionStatus = useConnectionStatus();
  const { leave, isLeaving } = useLeaveRoom();
  const turnControl = useTurnControl(currentRoom?.roomId ?? "");
  const localUserId = getOrCreateUserId();

  const [copied, setCopied] = useState(false);

  const memberActionMap = useMemo(() => {
    return new Map(
      turnControl.playersStatus.map((player) => [
        player.userId,
        {
          isSubmitted: player.isSubmitted,
          isTyping: !!player.isTyping,
        },
      ])
    );
  }, [turnControl.playersStatus]);

  const memberViews = useMemo<MemberActionView[]>(() => {
    return members.map((member) => {
      const action = memberActionMap.get(member.userId);
      return {
        ...member,
        isSubmitted: action?.isSubmitted ?? false,
        isTyping: action?.isTyping ?? false,
      };
    });
  }, [members, memberActionMap]);

  const submittedSummary =
    turnControl.totalPlayers > 0
      ? `${turnControl.submittedCount}/${turnControl.totalPlayers}`
      : `${memberViews.filter((member) => member.isSubmitted).length}/${
          memberViews.length
        }`;

  if (mode === "offline" || !currentRoom) {
    return null;
  }

  const handleCopyRoomCode = async () => {
    try {
      await navigator.clipboard.writeText(currentRoom.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  const handleLeaveRoom = async () => {
    const result = await leave();
    if (!result.success) {
      return;
    }

    onOpenChange(false);
    onLeave?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="房间信息"
        description={currentRoom.name}
        width="md"
        background="starfield"
        footer={
          <div className="flex justify-end">
            <Button
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={handleLeaveRoom}
              disabled={isLeaving}
            >
              <LogOut size={14} className="mr-2" />
              {isLeaving ? "离开中..." : "离开房间"}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="rounded-lg border border-muted/40 bg-muted/20 p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <ConnectionIndicator status={connectionStatus} size="md" />
                <span className="truncate text-sm">
                  {CONNECTION_LABEL[connectionStatus]}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-1 text-sm text-muted-foreground">
                <Users size={14} />
                <span>{members.length} 人</span>
              </div>
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              {turnControl.turnNumber > 0
                ? `回合 ${turnControl.turnNumber} · 已提交 ${submittedSummary}`
                : "当前回合尚未开始"}
            </div>
          </div>

          <div className="rounded-lg border border-muted/40 bg-muted/20 p-3">
            <p className="mb-2 text-xs text-muted-foreground">房间码</p>
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-lg tracking-widest text-primary">
                {currentRoom.code}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-muted-foreground hover:text-primary"
                onClick={handleCopyRoomCode}
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
              </Button>
            </div>
          </div>

          <div className="rounded-lg border border-muted/40 bg-muted/20 p-3">
            <p className="mb-2 text-xs text-muted-foreground">
              成员状态 ({memberViews.length})
            </p>
            <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
              {memberViews.map((member) => {
                const actionStatus = resolveMemberActionStatus(
                  member,
                  turnControl.turnNumber,
                  turnControl.isLocked
                );

                return (
                  <div
                    key={member.userId}
                    className="flex items-center justify-between gap-3 rounded-lg border border-muted/30 bg-muted/20 px-3 py-2"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <div
                        className={`h-2 w-2 rounded-full ${
                          member.status === "online"
                            ? "bg-green-500"
                            : "bg-yellow-500"
                        }`}
                      />
                      <span className="truncate text-sm">
                        {member.displayName}
                        {member.userId === localUserId ? " (你)" : ""}
                      </span>
                      {member.role === "host" && (
                        <Crown size={12} className="shrink-0 text-yellow-500" />
                      )}
                    </div>
                    <span
                      className={`shrink-0 text-xs ${actionStatus.className}`}
                    >
                      {actionStatus.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
