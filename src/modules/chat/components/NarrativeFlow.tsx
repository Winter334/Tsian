/**
 * NarrativeFlow - 叙事内容流容器
 * 显示消息历史列表
 */

import type { Message } from "@/domain/entities/message";
import { cn } from "@/lib/utils";
import { useEffect, useMemo, useRef } from "react";
import {
  parseGameContent,
  type ParsedContent,
} from "../utils/parseGameContent";
import { ChoicesPanel } from "./ChoicesPanel";
import { NarrativeBlock } from "./NarrativeBlock";

interface NarrativeFlowProps {
  messages: Message[];
  streamingMessageId: string | null;
  onSelectChoice: (choice: string) => void;
  className?: string;
}

/**
 * 带解析结果的消息类型
 */
interface ParsedMessage extends Message {
  parsed: ParsedContent;
}

export function NarrativeFlow({
  messages,
  streamingMessageId,
  onSelectChoice,
  className,
}: NarrativeFlowProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // 自动滚动到底部
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages, streamingMessageId]);

  // 🔧 性能优化：缓存所有消息的解析结果，避免每次渲染都重新解析
  const parsedMessages = useMemo<ParsedMessage[]>(() => {
    return messages.map((message) => ({
      ...message,
      parsed: parseGameContent(message.content),
    }));
  }, [messages]);

  // 解析最后一条消息的选项
  const lastAssistantMessage = useMemo(() => {
    for (let i = parsedMessages.length - 1; i >= 0; i--) {
      if (
        parsedMessages[i].role === "assistant" &&
        parsedMessages[i].status !== "error"
      ) {
        return parsedMessages[i];
      }
    }
    return null;
  }, [parsedMessages]);

  const lastMessageChoices = useMemo(() => {
    if (!lastAssistantMessage || streamingMessageId) {
      return [];
    }
    return lastAssistantMessage.parsed.choices;
  }, [lastAssistantMessage, streamingMessageId]);

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
      {/* 消息列表 */}
      <div className="max-w-3xl mx-auto space-y-4">
        {parsedMessages.map((message) => {
          const isStreaming = message.id === streamingMessageId;

          // 玩家消息样式
          if (message.role === "user") {
            return (
              <div
                key={message.id}
                className="pl-4 border-l-2 border-cyan-500/50 text-cyan-100"
              >
                {message.content}
              </div>
            );
          }

          // AI 叙事消息（使用缓存的解析结果）
          return (
            <NarrativeBlock
              key={message.id}
              content={message.parsed.narrative}
              isStreaming={isStreaming}
              messageId={message.id}
            />
          );
        })}

        {/* 选项面板（仅在非流式输出时显示） */}
        {lastMessageChoices.length > 0 && (
          <ChoicesPanel
            choices={lastMessageChoices}
            onSelect={onSelectChoice}
            disabled={!!streamingMessageId}
            className="mt-6"
          />
        )}
      </div>
    </div>
  );
}
