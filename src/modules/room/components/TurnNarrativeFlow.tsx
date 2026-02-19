/**
 * TurnNarrativeFlow - 回合制叙事内容流
 *
 * 用于联机模式下展示回合消息，支持：
 * - 回合分隔标记展示
 * - 玩家行动格式化显示
 * - AI 响应流式展示
 * - AI 处理状态显示
 * - Host 控制按钮
 * - 历史消息懒加载
 */

import type { Message } from "@/domain/entities/message";
import { cn } from "@/lib/utils";
import { ChoicesPanel, NarrativeBlock, parseGameContent } from "@/modules/chat";
import { useEffect, useMemo, useRef } from "react";
import { useAiStatus } from "../hooks/useAiStatus";
import { AiHostControls, GuestWaitingMessage } from "./AiHostControls";
import { AiProcessingStatus } from "./AiProcessingStatus";

interface TurnNarrativeFlowProps {
  /** 房间 ID（用于 AI 状态监听） */
  roomId?: string | null;
  /** 消息列表 */
  messages: Message[];
  /** 是否有正在流式输出的消息 */
  isStreaming: boolean;
  /** 选择回调 */
  onSelectChoice?: (choice: string) => void;
  /** 自定义类名 */
  className?: string;
  /** 是否正在加载 */
  loading?: boolean;
  /** 当前回合号 */
  currentTurn?: number;
}

/**
 * 回合分隔标记组件
 */
function TurnSeparator({ content }: { content: string }) {
  return (
    <div className="flex items-center justify-center my-6">
      <div className="flex-1 border-t border-cyan-500/30" />
      <span className="px-4 text-sm text-cyan-400/70 font-mono">{content}</span>
      <div className="flex-1 border-t border-cyan-500/30" />
    </div>
  );
}

/**
 * 玩家行动消息组件
 */
function PlayerActionMessage({
  message,
  playerName,
}: {
  message: Message;
  playerName?: string;
}) {
  // 从 metadata 获取玩家名称
  const name = playerName || (message.metadata?.playerName as string) || "玩家";

  // 从内容中提取实际行动（去掉 [玩家名] 前缀）
  let actionContent = message.content;
  const match = message.content.match(/^\[([^\]]+)\]\s*(.*)$/);
  if (match) {
    actionContent = match[2];
  }

  return (
    <div className="pl-4 border-l-2 border-cyan-500/50 text-cyan-100 mb-2">
      <span className="text-cyan-400 font-semibold">[{name}]</span>{" "}
      {actionContent}
    </div>
  );
}

/**
 * 回合制叙事内容流组件
 */
export function TurnNarrativeFlow({
  roomId,
  messages,
  isStreaming,
  onSelectChoice,
  className,
  loading,
  currentTurn,
}: TurnNarrativeFlowProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // 获取 AI 状态
  const aiStatusInfo = useAiStatus(roomId ?? null, currentTurn ?? 0);

  // 自动滚动到底部
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages, isStreaming]);

  // 解析最后一条 AI 消息的选项
  const lastAssistantMessage = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (
        messages[i].role === "assistant" &&
        messages[i].status !== "error" &&
        !messages[i].metadata?.type // 排除回合系统消息
      ) {
        return messages[i];
      }
    }
    return null;
  }, [messages]);

  const lastMessageChoices = useMemo(() => {
    if (!lastAssistantMessage || isStreaming) {
      return [];
    }
    const parsed = parseGameContent(lastAssistantMessage.content);
    return parsed.choices;
  }, [lastAssistantMessage, isStreaming]);

  /**
   * 渲染单条消息
   */
  const renderMessage = (message: Message) => {
    const messageType = message.metadata?.type as string | undefined;

    // 回合分隔标记
    if (messageType === "turn_separator" || message.role === "system") {
      return <TurnSeparator key={message.id} content={message.content} />;
    }

    // 玩家行动消息
    if (messageType === "player_action" || message.role === "user") {
      const playerName = message.metadata?.playerName as string | undefined;
      return (
        <PlayerActionMessage
          key={message.id}
          message={message}
          playerName={playerName}
        />
      );
    }

    // AI 叙事消息
    if (message.role === "assistant") {
      const isCurrentStreaming = isStreaming && message.status === "streaming";
      const parsed = parseGameContent(message.content);

      return (
        <NarrativeBlock
          key={message.id}
          content={parsed.narrative}
          isStreaming={isCurrentStreaming}
        />
      );
    }

    // 其他消息（兜底）
    return (
      <div key={message.id} className="text-gray-400 text-sm my-2">
        {message.content}
      </div>
    );
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        "flex-1 min-h-0 overflow-y-auto",
        "px-4 py-6",
        "scroll-smooth",
        className,
      )}
    >
      {/* 加载指示器 */}
      {loading && (
        <div className="flex justify-center py-4">
          <div className="animate-pulse text-cyan-400/50">加载中...</div>
        </div>
      )}

      {/* 回合信息 */}
      {currentTurn !== undefined && currentTurn > 0 && (
        <div className="text-center text-xs text-gray-500 mb-4">
          当前回合: {currentTurn}
        </div>
      )}

      {/* 消息列表 */}
      <div className="max-w-3xl mx-auto space-y-4">
        {messages.map(renderMessage)}

        {/* AI 处理状态（processing/retrying/failed/aborted） */}
        {roomId && currentTurn && currentTurn > 0 && (
          <AiProcessingStatus
            roomId={roomId}
            turnNumber={currentTurn}
            status={aiStatusInfo.status}
            error={aiStatusInfo.error}
            aborted={aiStatusInfo.aborted}
            className="mt-4"
          />
        )}

        {/* Host 控制按钮（completed 时显示开始下一回合） */}
        {roomId && currentTurn && currentTurn > 0 && (
          <AiHostControls
            roomId={roomId}
            turnNumber={currentTurn}
            aiStatus={aiStatusInfo.status}
            className="mt-4"
          />
        )}

        {/* Guest 等待消息 */}
        {roomId && currentTurn && currentTurn > 0 && (
          <GuestWaitingMessage
            aiStatus={aiStatusInfo.status}
            abortReason={aiStatusInfo.aborted?.reason}
            className="mt-4"
          />
        )}

        {/* 选项面板（仅在 AI 完成且非流式输出时显示） */}
        {lastMessageChoices.length > 0 &&
          onSelectChoice &&
          aiStatusInfo.status === "completed" && (
            <ChoicesPanel
              choices={lastMessageChoices}
              onSelect={onSelectChoice}
              disabled={isStreaming}
              className="mt-6"
            />
          )}

        {/* 空状态 */}
        {messages.length === 0 && !loading && (
          <div className="text-center text-gray-500 py-12">
            <p>等待游戏开始...</p>
          </div>
        )}
      </div>
    </div>
  );
}
