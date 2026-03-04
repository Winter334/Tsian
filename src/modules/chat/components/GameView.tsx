/**
 * GameView - 游戏主界面容器
 * 整合叙事流、选项面板、输入框
 *
 * 支持两种模式：
 * - 单人模式：使用 NarrativeFlow + PlayerInput + useChatUIStore
 * - 联机模式：使用 TurnNarrativeFlow + ActionInput + useRoomStore
 *
 * 数据来源：
 * - 单人模式 UI 状态：useChatUIStore
 * - 单人模式业务数据：useMessages hook (订阅 Yjs)
 * - 联机模式：useTurnMessages + ActionInput (Awareness 集成)
 */

import { ChatCommands } from "@/domain/commands/chat";
import { useCommand } from "@/hooks/use-command";
import { cn } from "@/lib/utils";
// 通过模块顶层入口导入，符合架构规范
import {
  ActionInput,
  TurnNarrativeFlow,
  TurnTimeoutController,
  useTurnControl,
  useTurnMessages,
} from "@/modules";
import { selectIsOnline, useSessionStore } from "@/stores";
import { useCallback } from "react";
import { useMessages } from "../hooks";
import { useChatUIStore } from "../store";
import { fillPlayerInput } from "../utils/playerInputHelper";
import { NarrativeFlow } from "./NarrativeFlow";
import { PlayerInput } from "./PlayerInput";

interface GameViewProps {
  className?: string;
}

interface OnlineGameViewContentProps {
  roomId: string;
  className?: string;
  onSelectChoice: (choice: string) => void;
}

function OnlineGameViewContent({
  roomId,
  className,
  onSelectChoice,
}: OnlineGameViewContentProps) {
  const turnMessagesResult = useTurnMessages(roomId);
  const turnControl = useTurnControl(roomId);
  const shouldLockInput = turnControl.allSubmitted || turnControl.isLocked;

  return (
    <div className={cn("flex flex-col h-full relative", className)}>
      {/* 背景层 */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "rgba(10, 20, 32, 0.6)",
        }}
      />

      {/* 网格背景 */}
      <div
        className="absolute inset-0 opacity-[0.08] pointer-events-none"
        style={{
          backgroundImage: `
              linear-gradient(rgba(0, 229, 204, 0.6) 1px, transparent 1px),
              linear-gradient(90deg, rgba(0, 229, 204, 0.6) 1px, transparent 1px)
            `,
          backgroundSize: "60px 60px",
        }}
      />

      {/* 回合制叙事区（联机模式专用） */}
      <TurnNarrativeFlow
        roomId={roomId}
        messages={turnMessagesResult.messages}
        isStreaming={turnMessagesResult.isStreaming}
        onSelectChoice={onSelectChoice}
        loading={turnMessagesResult.loading}
        currentTurn={turnMessagesResult.currentTurn}
        className="flex-1 min-h-0 relative z-10"
      />

      {/* 超时控制器（负责 TimeoutDialog 生命周期） */}
      <TurnTimeoutController roomId={roomId} />

      {/* 联机模式行动输入区 */}
      <ActionInput
        roomId={roomId}
        turnNumber={turnMessagesResult.currentTurn}
        isLocked={shouldLockInput}
        className="shrink-0 relative z-10"
      />
    </div>
  );
}

export function GameView({ className }: GameViewProps) {
  const dispatch = useCommand();

  // 检查是否为联机模式（roomId 单一来源：SessionStore）
  const sessionRoomId = useSessionStore((s) => s.roomId);
  const isOnlineMode = useSessionStore(selectIsOnline);

  // UI 状态（从 Zustand）- 单人模式使用
  const currentConversationId = useChatUIStore((s) => s.currentConversationId);
  const streamingMessageId = useChatUIStore((s) => s.streamingMessageId);
  const isLoading = useChatUIStore((s) => s.isLoading);

  // 业务数据（从 Yjs）- 单人模式使用
  const soloMessages = useMessages(isOnlineMode ? null : currentConversationId);

  // 发送消息 - 单人模式
  const handleSendMessage = useCallback(
    (content: string) => {
      if (!currentConversationId) return;

      dispatch({
        type: ChatCommands.SEND_MESSAGE,
        payload: {
          content,
          conversationId: currentConversationId,
          role: "user",
        },
      });
    },
    [currentConversationId, dispatch],
  );

  // 选择选项（填入输入框）
  const handleSelectChoice = useCallback((choice: string) => {
    fillPlayerInput(choice);
  }, []);

  // ===== 联机模式 =====
  if (isOnlineMode) {
    if (!sessionRoomId) {
      return (
        <div
          className={cn(
            "flex-1 flex items-center justify-center",
            "terminal-text text-lg",
            className,
          )}
        >
          <p className="opacity-60">正在连接房间...</p>
        </div>
      );
    }

    return (
      <OnlineGameViewContent
        roomId={sessionRoomId}
        className={className}
        onSelectChoice={handleSelectChoice}
      />
    );
  }

  // ===== 单人模式 =====

  // 无会话时显示提示
  if (!currentConversationId) {
    return (
      <div
        className={cn(
          "flex-1 flex items-center justify-center",
          "terminal-text text-lg",
          className,
        )}
      >
        <p className="opacity-60">请选择或创建一个会话</p>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col h-full relative", className)}>
      {/* 背景层 - 提升亮度 */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "rgba(10, 20, 32, 0.6)",
        }}
      />

      {/* 叙事内容区 - 增强网格背景 */}
      <div
        className="absolute inset-0 opacity-[0.08] pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(0, 229, 204, 0.6) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0, 229, 204, 0.6) 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
        }}
      />

      {/* 叙事内容区 */}
      <NarrativeFlow
        messages={soloMessages}
        streamingMessageId={streamingMessageId}
        onSelectChoice={handleSelectChoice}
        className="flex-1 min-h-0 relative z-10"
      />

      {/* 玩家输入区 */}
      <PlayerInput
        onSubmit={handleSendMessage}
        disabled={isLoading}
        placeholder="输入你的行动，或选择上方选项..."
        className="shrink-0 relative z-10"
      />
    </div>
  );
}
