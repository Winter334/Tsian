/**
 * ActionStatusIndicator - 玩家行动状态指示器
 *
 * 显示房间内所有玩家的行动状态：
 * - ✅ 已提交
 * - ✏️ 输入中...
 * - ⏳ 未开始
 * - ❌ 离线
 * - 🔒 已锁定
 *
 * 遵循架构规范：只读显示数据
 */

import { subdocManager } from "@/core/yjs";
import { cn } from "@/lib/utils";
import { borders, color, colorAlpha } from "@/styles/tokens";
import { Check, Edit3, Loader2, Lock, Wifi, WifiOff } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ActionStatus } from "../hooks/useActionAwareness";
import {
  useTurnActions,
  type PlayerActionState,
} from "../hooks/useTurnActions";
import { useRoomStore } from "../store";

// ===== 类型定义 =====

interface ActionStatusIndicatorProps {
  /** 自定义样式类 */
  className?: string;
  /** 是否显示详细信息 */
  showDetails?: boolean;
  /** 是否紧凑模式 */
  compact?: boolean;
}

interface PlayerStatusRowProps {
  player: PlayerActionState & { isOnline: boolean; isLocalUser: boolean };
  showDetails?: boolean;
}

// ===== 辅助函数 =====

/**
 * 获取状态图标
 */
function StatusIcon({
  status,
  isTyping,
  isOnline,
}: {
  status: ActionStatus;
  isTyping: boolean;
  isOnline: boolean;
}) {
  if (!isOnline) {
    return <WifiOff className="w-4 h-4" style={{ color: color("error") }} />;
  }

  if (status === "locked") {
    return <Lock className="w-4 h-4" style={{ color: color("warning") }} />;
  }

  if (status === "submitted") {
    return <Check className="w-4 h-4" style={{ color: color("success") }} />;
  }

  if (isTyping) {
    return (
      <Edit3
        className="w-4 h-4 animate-pulse"
        style={{ color: color("primary") }}
      />
    );
  }

  // draft 或 empty
  return <Loader2 className="w-4 h-4" style={{ color: color("textMuted") }} />;
}

/**
 * 获取状态文本
 */
function getStatusText(
  status: ActionStatus,
  isTyping: boolean,
  isOnline: boolean
): string {
  if (!isOnline) return "离线";
  if (status === "locked") return "已锁定";
  if (status === "submitted") return "已提交";
  if (isTyping) return "输入中...";
  if (status === "draft") return "编辑中";
  return "未开始";
}

/**
 * 获取状态颜色
 */
function getStatusColor(
  status: ActionStatus,
  isTyping: boolean,
  isOnline: boolean
): string {
  if (!isOnline) return color("error");
  if (status === "locked") return color("warning");
  if (status === "submitted") return color("success");
  if (isTyping) return color("primary");
  return color("textMuted");
}

// ===== 子组件 =====

function PlayerStatusRow({ player, showDetails }: PlayerStatusRowProps) {
  // 从 PlayerActionState 转换为 ActionStatus
  const status: ActionStatus = player.isLocked
    ? "locked"
    : player.isSubmitted
    ? "submitted"
    : player.content
    ? "draft"
    : "empty";
  const isTyping = player.isTyping ?? false;
  const statusText = getStatusText(status, isTyping, player.isOnline);
  const statusColor = getStatusColor(status, isTyping, player.isOnline);

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-lg",
        "transition-colors duration-200"
      )}
      style={{
        background: colorAlpha("bgCard", 0.3),
        boxShadow: player.isLocalUser
          ? `inset 0 0 0 1px ${colorAlpha("primary", 0.5)}`
          : "none",
      }}
    >
      {/* 状态图标 */}
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center"
        style={{
          background: colorAlpha("bgCard", 0.5),
          border: `2px solid ${statusColor}`,
        }}
      >
        <StatusIcon
          status={status}
          isTyping={isTyping}
          isOnline={player.isOnline}
        />
      </div>

      {/* 玩家名称 */}
      <div className="flex-1 min-w-0">
        <div
          className="font-medium truncate"
          style={{ color: color("textPrimary") }}
        >
          {player.displayName}
          {player.isLocalUser && (
            <span
              className="ml-2 text-xs"
              style={{ color: color("textMuted") }}
            >
              (你)
            </span>
          )}
        </div>
        {showDetails && (
          <div className="text-xs" style={{ color: statusColor }}>
            {statusText}
          </div>
        )}
      </div>

      {/* 在线状态指示 */}
      {player.isOnline ? (
        <Wifi
          className="w-4 h-4"
          style={{ color: colorAlpha("success", 0.6) }}
        />
      ) : (
        <WifiOff
          className="w-4 h-4"
          style={{ color: colorAlpha("error", 0.6) }}
        />
      )}
    </div>
  );
}

// ===== 主组件 =====

export function ActionStatusIndicator({
  className,
  showDetails = true,
  compact = false,
}: ActionStatusIndicatorProps) {
  const members = useRoomStore((s) => s.members);
  const localUser = useRoomStore((s) => s.localUser);
  const currentRoom = useRoomStore((s) => s.currentRoom);

  // 从 MainDoc 获取当前回合号
  const [currentTurnNumber, setCurrentTurnNumber] = useState(0);

  useEffect(() => {
    const roomId = currentRoom?.roomId;
    if (!roomId) {
      setCurrentTurnNumber(0);
      return;
    }

    const mainDoc = subdocManager.getMainDoc(roomId);
    if (!mainDoc) {
      setCurrentTurnNumber(0);
      return;
    }

    const configMap = mainDoc.getMap("config");

    const updateTurnNumber = () => {
      const turnNumber = (configMap.get("currentTurnNumber") as number) || 0;
      setCurrentTurnNumber(turnNumber);
    };

    updateTurnNumber();
    configMap.observe(updateTurnNumber);

    return () => {
      configMap.unobserve(updateTurnNumber);
    };
  }, [currentRoom?.roomId]);

  // ⚠️ 关键修复：从 TurnDoc 读取行动状态，而不是 Awareness
  const { players, submittedCount, totalPlayers } = useTurnActions(
    currentRoom?.roomId ?? "",
    currentTurnNumber
  );

  // 🔧 性能优化：先构建 Map，将 O(n*m) 降为 O(n+m)
  const playersMap = useMemo(() => {
    return new Map(players.map((p) => [p.userId, p]));
  }, [players]);

  // 合并成员和行动状态
  const playersList = useMemo(() => {
    return members.map((member) => {
      const actionInfo = playersMap.get(member.userId);
      return {
        userId: member.userId,
        displayName: actionInfo?.displayName || member.displayName,
        isSubmitted: actionInfo?.isSubmitted ?? false,
        content: actionInfo?.content ?? "",
        submittedAt: actionInfo?.submittedAt ?? null,
        isLocked: actionInfo?.isLocked ?? false,
        isTyping: actionInfo?.isTyping ?? false,
        isOnline: member.status === "online",
        isLocalUser: member.userId === localUser.userId,
      };
    });
  }, [members, playersMap, localUser.userId]);

  // 紧凑模式：只显示进度条
  if (compact) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        {/* 进度文本 */}
        <span
          className="text-sm font-medium"
          style={{ color: color("textSecondary") }}
        >
          {submittedCount}/{totalPlayers}
        </span>

        {/* 进度条 */}
        <div
          className="flex-1 h-2 rounded-full overflow-hidden"
          style={{ background: colorAlpha("bgCard", 0.5) }}
        >
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${
                totalPlayers > 0 ? (submittedCount / totalPlayers) * 100 : 0
              }%`,
              background:
                submittedCount === totalPlayers
                  ? color("success")
                  : color("primary"),
            }}
          />
        </div>

        {/* 状态指示点 */}
        <div className="flex gap-1">
          {playersList.map((player) => {
            const status: ActionStatus = player.isLocked
              ? "locked"
              : player.isSubmitted
              ? "submitted"
              : player.content
              ? "draft"
              : "empty";
            return (
              <div
                key={player.userId}
                className="w-2 h-2 rounded-full"
                style={{
                  background: getStatusColor(
                    status,
                    player.isTyping,
                    player.isOnline
                  ),
                }}
                title={`${player.displayName}: ${getStatusText(
                  status,
                  player.isTyping,
                  player.isOnline
                )}`}
              />
            );
          })}
        </div>
      </div>
    );
  }

  // 完整模式：显示玩家列表
  return (
    <div
      className={cn("rounded-lg p-3", className)}
      style={{
        background: colorAlpha("bgCard", 0.3),
        border: `1px solid ${colorAlpha("primary", 0.2)}`,
        borderRadius: borders.radius.lg,
      }}
    >
      {/* 标题栏 */}
      <div className="flex items-center justify-between mb-3">
        <h3
          className="text-sm font-semibold"
          style={{ color: color("textPrimary") }}
        >
          玩家状态
        </h3>
        <span
          className="text-xs px-2 py-1 rounded-full"
          style={{
            background:
              submittedCount === totalPlayers
                ? colorAlpha("success", 0.2)
                : colorAlpha("primary", 0.2),
            color:
              submittedCount === totalPlayers
                ? color("success")
                : color("primary"),
          }}
        >
          {submittedCount}/{totalPlayers} 已提交
        </span>
      </div>

      {/* 玩家列表 */}
      <div className="space-y-2">
        {playersList.map((player) => (
          <PlayerStatusRow
            key={player.userId}
            player={player}
            showDetails={showDetails}
          />
        ))}
      </div>

      {/* 全员提交提示 */}
      {submittedCount === totalPlayers && totalPlayers > 0 && (
        <div
          className="mt-3 text-center text-sm py-2 rounded-lg"
          style={{
            background: colorAlpha("success", 0.1),
            color: color("success"),
          }}
        >
          ✨ 全员已提交，准备进入下一阶段
        </div>
      )}
    </div>
  );
}
