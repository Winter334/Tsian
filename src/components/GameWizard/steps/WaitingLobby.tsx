/**
 * 步骤3: 等待大厅
 *
 * 显示房间成员，等待房主开始游戏
 *
 * Guest 通过监听 GAME_STARTED 事件自动进入游戏
 *
 * 联机续玩时支持成员到齐检查：
 * - 显示期望成员与当前在线成员的对比
 * - Host 只有在全员到齐时才能开始游戏
 *
 * 角色创建：
 * - 每个玩家需要在开始游戏前创建角色
 * - 开始游戏时检查所有成员是否都有角色
 */

import { Button } from "@/components/ui/button";
import type { Member } from "@/core/yjs/room/types";
import type { SaveMemberInfo } from "@/core/yjs/types";
import { RoomCommands } from "@/domain/commands/room";
import type { Character } from "@/domain/entities/character";
import { canOperateCharacter } from "@/domain/entities/character";
import { RoomEvents } from "@/domain/events/room";
import { useCommand, useEvent } from "@/hooks";
import { getOrCreateUserId } from "@/lib/user-identity";
// 通过模块顶层入口导入，符合架构规范
import {
  useConnectionStatus,
  useLeaveRoom,
  useRoomCharacters,
  useRoomInfo,
  useRoomMembers,
} from "@/modules";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  Crown,
  Loader2,
  UserCheck,
  UserPlus,
  UserX,
  X,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { SimpleForm } from "../components/CharacterCreation";
import type { StepProps } from "../types";

// 连接状态指示器
function ConnectionIndicator({
  status,
}: {
  status:
    | "disconnected"
    | "connecting"
    | "connected"
    | "synced"
    | "reconnecting"
    | "error";
}) {
  const config: Record<string, { color: string; animate: boolean }> = {
    disconnected: { color: "bg-gray-400", animate: false },
    connecting: { color: "bg-yellow-400", animate: true },
    connected: { color: "bg-blue-400", animate: false },
    synced: { color: "bg-green-400", animate: false },
    reconnecting: { color: "bg-yellow-400", animate: true },
    error: { color: "bg-red-400", animate: false },
  };

  const { color, animate } = config[status] || config.disconnected;

  return (
    <div
      className={`w-2 h-2 rounded-full ${color} ${
        animate ? "animate-pulse" : ""
      }`}
    />
  );
}

// 成员列表项（带角色信息）
function MemberItem({
  member,
  isLocal,
  isHost,
  character,
  onKick,
}: {
  member: Member;
  isLocal: boolean;
  isHost: boolean;
  character?: Character;
  onKick?: (userId: string) => void;
}) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
      <div className="flex items-center gap-3">
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

        {/* 名称和角色信息 */}
        <div className="flex flex-col">
          <span className={isLocal ? "font-medium" : ""}>
            {member.displayName}
            {isLocal && " (你)"}
          </span>
          {character ? (
            <span className="text-xs text-green-500 flex items-center gap-1">
              <UserPlus size={10} />
              角色: {character.name}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">未创建角色</span>
          )}
        </div>

        {/* 房主标签 */}
        {member.role === "host" && (
          <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded flex items-center gap-1">
            <Crown size={10} />
            房主
          </span>
        )}
      </div>

      {/* 踢出按钮（仅房主可见） */}
      {isHost && member.role !== "host" && onKick && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
          onClick={() => onKick(member.userId)}
        >
          <X size={16} />
        </Button>
      )}
    </div>
  );
}

// ===== 成员到齐检查相关类型和组件 =====

/**
 * 成员匹配结果
 */
interface MemberMatchResult {
  /** 期望的成员（来自存档） */
  expected: SaveMemberInfo;
  /** 匹配到的在线成员（如果有） */
  matched: Member | null;
  /** 是否已到齐 */
  isPresent: boolean;
}

/**
 * 检查成员是否匹配
 * 使用 displayName 进行匹配（因为 userId 可能变化）
 */
function matchMembers(
  expectedMembers: SaveMemberInfo[],
  onlineMembers: Member[],
): MemberMatchResult[] {
  return expectedMembers.map((expected) => {
    // 按 displayName 匹配（忽略大小写）
    const matched = onlineMembers.find(
      (m) => m.displayName.toLowerCase() === expected.displayName.toLowerCase(),
    );
    return {
      expected,
      matched: matched ?? null,
      isPresent: !!matched,
    };
  });
}

/**
 * 期望成员列表项组件
 */
function ExpectedMemberItem({ result }: { result: MemberMatchResult }) {
  const { expected, isPresent } = result;

  return (
    <div
      className={`flex items-center justify-between p-3 rounded-lg ${
        isPresent
          ? "bg-green-500/10 border border-green-500/30"
          : "bg-muted/30 border border-dashed border-muted"
      }`}
    >
      <div className="flex items-center gap-3">
        {/* 到齐状态图标 */}
        {isPresent ? (
          <UserCheck size={16} className="text-green-500" />
        ) : (
          <UserX size={16} className="text-muted-foreground" />
        )}

        {/* 头像 */}
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center ${
            isPresent ? "bg-green-500/20" : "bg-muted/50"
          }`}
        >
          <span className="text-sm font-medium">
            {expected.displayName[0].toUpperCase()}
          </span>
        </div>

        {/* 名称 */}
        <span
          className={isPresent ? "text-foreground" : "text-muted-foreground"}
        >
          {expected.displayName}
        </span>

        {/* 角色标签 */}
        {expected.role === "host" && (
          <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded flex items-center gap-1">
            <Crown size={10} />
            房主
          </span>
        )}
      </div>

      {/* 状态标签 */}
      <span
        className={`text-xs px-2 py-1 rounded ${
          isPresent
            ? "bg-green-500/20 text-green-500"
            : "bg-muted text-muted-foreground"
        }`}
      >
        {isPresent ? "已到齐" : "等待中"}
      </span>
    </div>
  );
}

export function WaitingLobby({ context, onBack, onComplete }: StepProps) {
  const { currentRoom } = useRoomInfo();
  const members = useRoomMembers();
  const { characters, myCharacter, hasCharacter } = useRoomCharacters();
  const connectionStatus = useConnectionStatus();
  const { leave, isLeaving } = useLeaveRoom();
  const [copied, setCopied] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const dispatch = useCommand();

  const localUserId = getOrCreateUserId();
  const isHost = currentRoom?.isHost ?? false;

  // 获取期望的成员列表（联机续玩时从 context 传入）
  const expectedMembers = context.expectedMembers;
  const isResumingMultiplayer = !!expectedMembers && expectedMembers.length > 0;

  // 计算成员匹配结果
  const memberMatchResults = useMemo(() => {
    if (!isResumingMultiplayer) return [];
    return matchMembers(expectedMembers, members);
  }, [isResumingMultiplayer, expectedMembers, members]);

  // 计算是否全员到齐
  const allMembersPresent = useMemo(() => {
    if (!isResumingMultiplayer) return true; // 非续玩模式不需要检查
    return memberMatchResults.every((r) => r.isPresent);
  }, [isResumingMultiplayer, memberMatchResults]);

  // 到齐人数统计
  const presentCount = memberMatchResults.filter((r) => r.isPresent).length;
  const totalExpected = expectedMembers?.length ?? 0;

  // 获取成员对应的角色
  const getMemberCharacter = useCallback(
    (member: Member): Character | undefined => {
      return characters.find((char) =>
        canOperateCharacter(char, member.userId, ""),
      );
    },
    [characters],
  );

  // 检查所有成员是否都有角色
  const allMembersHaveCharacters = useMemo(() => {
    return members.every((member) => getMemberCharacter(member) !== undefined);
  }, [members, getMemberCharacter]);

  // 缺少角色的成员列表
  const membersWithoutCharacters = useMemo(() => {
    return members.filter((member) => getMemberCharacter(member) === undefined);
  }, [members, getMemberCharacter]);

  // Guest 监听 GAME_STARTED 事件，自动进入游戏
  const handleGameStarted = useCallback(
    (event: { payload: { roomId: string } }) => {
      // 确认是当前房间的事件
      if (currentRoom && event.payload.roomId === currentRoom.roomId) {
        onComplete({
          ...context,
          roomId: currentRoom.roomId,
          roomCode: currentRoom.code,
        });
      }
    },
    [context, currentRoom, onComplete],
  );

  // 订阅 GAME_STARTED 事件
  useEvent(RoomEvents.GAME_STARTED, handleGameStarted);

  if (!currentRoom) {
    return (
      <div className="p-8 text-center">
        <Loader2 size={32} className="animate-spin mx-auto mb-4" />
        <p className="text-muted-foreground">正在连接房间...</p>
      </div>
    );
  }

  const handleCopyCode = async () => {
    await navigator.clipboard.writeText(currentRoom.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLeave = async () => {
    await leave();
    onBack();
  };

  const handleStart = async () => {
    if (!currentRoom || isStarting) return;

    setIsStarting(true);
    setStartError(null);

    try {
      // 发送 START_GAME 命令，通知所有成员游戏开始
      const result = await dispatch({
        type: RoomCommands.START_GAME,
        payload: {
          roomId: currentRoom.roomId,
          userId: localUserId,
        },
      });

      if (result.success) {
        // 完成向导，进入游戏
        onComplete({
          ...context,
          roomId: currentRoom.roomId,
          roomCode: currentRoom.code,
        });
      } else {
        setStartError(result.error || "开始游戏失败");
        setIsStarting(false);
      }
    } catch (error) {
      setStartError(error instanceof Error ? error.message : "开始游戏失败");
      setIsStarting(false);
    }
  };

  // 检查是否可以开始游戏
  // 联机续玩时需要全员到齐，普通联机只需要 >= 2 人
  // 所有成员都需要有角色
  const canStart =
    isHost &&
    members.length >= 2 &&
    allMembersHaveCharacters &&
    (isResumingMultiplayer ? allMembersPresent : true);

  return (
    <div className="p-8">
      {/* 房间信息 + 房间码 */}
      <div className="text-center mb-8">
        <p className="text-xs text-muted-foreground mb-1">房间名称</p>
        <p className="text-lg font-semibold mb-3">{currentRoom.name}</p>
        <p className="text-sm text-muted-foreground mb-2">分享房间码给好友</p>
        <div className="flex items-center justify-center gap-3">
          <span className="text-4xl font-mono tracking-widest text-primary">
            {currentRoom.code}
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleCopyCode}
            className="text-muted-foreground hover:text-primary"
          >
            {copied ? <Check size={20} /> : <Copy size={20} />}
          </Button>
        </div>
      </div>

      {/* 连接状态 */}
      <div className="flex items-center justify-center gap-2 mb-6">
        <ConnectionIndicator status={connectionStatus} />
        <span className="text-sm text-muted-foreground">
          {connectionStatus === "synced" || connectionStatus === "connected"
            ? "已连接"
            : connectionStatus === "reconnecting"
              ? "重连中..."
              : connectionStatus === "error"
                ? "连接错误"
                : "连接中..."}
        </span>
      </div>

      {/* 成员列表 */}
      <div className="mb-8">
        {isResumingMultiplayer ? (
          // 联机续玩模式：显示成员到齐检查
          <>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-muted-foreground">成员到齐检查</p>
              <div className="flex items-center gap-2">
                {allMembersPresent ? (
                  <span className="text-xs text-green-500 flex items-center gap-1">
                    <CheckCircle2 size={14} />
                    全员到齐
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    {presentCount}/{totalExpected} 人已到齐
                  </span>
                )}
              </div>
            </div>
            <div className="space-y-2">
              {memberMatchResults.map((result, index) => (
                <ExpectedMemberItem key={index} result={result} />
              ))}
            </div>

            {/* 新加入的成员（不在期望列表中） */}
            {members.filter(
              (m) =>
                !expectedMembers.some(
                  (e) =>
                    e.displayName.toLowerCase() === m.displayName.toLowerCase(),
                ),
            ).length > 0 && (
              <div className="mt-4 pt-4 border-t border-muted">
                <p className="text-sm text-muted-foreground mb-3">
                  新加入的成员
                </p>
                <div className="space-y-2">
                  {members
                    .filter(
                      (m) =>
                        !expectedMembers.some(
                          (e) =>
                            e.displayName.toLowerCase() ===
                            m.displayName.toLowerCase(),
                        ),
                    )
                    .map((member) => (
                      <MemberItem
                        key={member.userId}
                        member={member}
                        isLocal={member.userId === localUserId}
                        isHost={isHost}
                      />
                    ))}
                </div>
              </div>
            )}
          </>
        ) : (
          // 普通联机模式：显示成员列表
          <>
            <p className="text-sm text-muted-foreground mb-3">
              成员 ({members.length}/{currentRoom.maxPlayers || 8})
            </p>
            <div className="space-y-2">
              {members.map((member) => (
                <MemberItem
                  key={member.userId}
                  member={member}
                  isLocal={member.userId === localUserId}
                  isHost={isHost}
                  character={getMemberCharacter(member)}
                />
              ))}

              {/* 空位 */}
              {Array.from({
                length: (currentRoom.maxPlayers || 8) - members.length,
              }).map((_, i) => (
                <div
                  key={`empty-${i}`}
                  className="flex items-center gap-3 p-3 rounded-lg border border-dashed border-muted"
                >
                  <div className="w-8 h-8 rounded-full bg-muted/50" />
                  <span className="text-muted-foreground">等待加入...</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* 角色创建区域 */}
      <div className="mb-8">
        <SimpleForm
          roomId={currentRoom.roomId}
          hasCharacter={hasCharacter}
          currentCharacterId={myCharacter?.id}
          currentCharacterName={myCharacter?.name}
          disabled={isStarting}
        />
      </div>

      {/* 操作按钮 */}
      <div className="flex justify-between">
        <Button variant="ghost" onClick={handleLeave} disabled={isLeaving}>
          <ArrowLeft size={16} className="mr-2" />
          {isLeaving ? "离开中..." : isHost ? "解散房间" : "离开房间"}
        </Button>

        {isHost ? (
          <Button onClick={handleStart} disabled={!canStart || isStarting}>
            {isStarting ? (
              <>
                <Loader2 size={16} className="mr-2 animate-spin" />
                开始中...
              </>
            ) : (
              <>
                开始游戏
                <ArrowRight size={16} className="ml-2" />
              </>
            )}
          </Button>
        ) : (
          <div className="text-sm text-muted-foreground flex items-center">
            <Loader2 size={16} className="mr-2 animate-spin" />
            等待房主开始...
          </div>
        )}
      </div>

      {/* 提示 */}
      {isHost && !canStart && (
        <p className="text-sm text-muted-foreground text-center mt-4">
          {isResumingMultiplayer && !allMembersPresent
            ? "等待所有成员到齐后才能开始"
            : !allMembersHaveCharacters
              ? `等待所有成员创建角色（${membersWithoutCharacters
                  .map((m) => m.displayName)
                  .join("、")}）`
              : "至少需要 2 人才能开始"}
        </p>
      )}

      {/* 错误提示 */}
      {startError && (
        <p className="text-sm text-red-500 text-center mt-4">{startError}</p>
      )}
    </div>
  );
}
