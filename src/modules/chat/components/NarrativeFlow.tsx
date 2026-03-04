/**
 * NarrativeFlow - 叙事内容流容器
 * 显示消息历史列表
 */

import { useToast } from "@/components/ui";
import { ChatCommands } from "@/domain/commands/chat";
import { CheckpointCommands } from "@/domain/commands/checkpoint";
import type { Message } from "@/domain/entities/message";
import { useCommand } from "@/hooks";
import { usePresetStore } from "@/lib/prompt/store";
import { cn } from "@/lib/utils";
import {
  findCheckpointByMessageId,
  findPreviousCheckpoint,
  useCheckpoints,
} from "@/modules/checkpoint";
import { useRoomStore } from "@/modules/room";
import { selectIsOnline, useSessionStore } from "@/stores";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  parseGameContent,
  type ParsedContent,
} from "../utils/parseGameContent";
import { ChoicesPanel } from "./ChoicesPanel";
import { NarrativeBlock } from "./NarrativeBlock";
import { RestoreConfirmDialog } from "./RestoreConfirmDialog";
import { UserMessageBlock } from "./UserMessageBlock";

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

type ConfirmDialogState =
  | {
      type: "revert";
      checkpointId: string;
      checkpointLabel?: string;
    }
  | {
      type: "regenerate";
      checkpointId: string;
      checkpointLabel?: string;
      userMessage: string;
    };

export function NarrativeFlow({
  messages,
  streamingMessageId,
  onSelectChoice,
  className,
}: NarrativeFlowProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const presetRules = usePresetStore((s) => s.activePreset?.postProcessRules);

  const dispatch = useCommand();
  const checkpoints = useCheckpoints();
  const { warning, error: toastError } = useToast();
  const isOnline = useSessionStore(selectIsOnline);
  const isHost = useRoomStore((s) => s.currentRoom?.isHost ?? false);

  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(
    null,
  );

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
      parsed: parseGameContent(message.content, presetRules),
    }));
  }, [messages, presetRules]);

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

  const canUseCheckpointActions = useMemo(() => {
    if (!isOnline) {
      return true;
    }
    return isHost;
  }, [isHost, isOnline]);

  const handleRevertToCheckpoint = useCallback(
    (messageId: string) => {
      if (!canUseCheckpointActions) {
        warning("仅房主可执行此操作", "联机模式下仅房主可以回溯或重新生成。");
        return;
      }

      const checkpoint = findCheckpointByMessageId(checkpoints, messageId);
      if (!checkpoint) {
        warning("未找到对应的检查点", "请确认该回复是否已生成检查点。");
        return;
      }

      setConfirmDialog({
        type: "revert",
        checkpointId: checkpoint.id,
        checkpointLabel: checkpoint.label,
      });
    },
    [canUseCheckpointActions, checkpoints, warning],
  );

  const handleRegenerate = useCallback(
    (messageId: string) => {
      if (!canUseCheckpointActions) {
        warning("仅房主可执行此操作", "联机模式下仅房主可以回溯或重新生成。");
        return;
      }

      const prevCheckpoint = findPreviousCheckpoint(checkpoints, messageId);
      if (!prevCheckpoint) {
        warning("无法重新生成", "这是第一条回复，无法找到上一个检查点。");
        return;
      }

      const aiMessageIndex = messages.findIndex(
        (message) => message.id === messageId,
      );
      if (aiMessageIndex <= 0) {
        warning("无法重新生成", "未找到对应的用户输入消息。");
        return;
      }

      let userMessage = "";
      for (let index = aiMessageIndex - 1; index >= 0; index -= 1) {
        if (messages[index].role === "user") {
          userMessage = messages[index].content;
          break;
        }
      }

      if (!userMessage.trim()) {
        warning("无法重新生成", "未找到对应的用户输入消息。");
        return;
      }

      setConfirmDialog({
        type: "regenerate",
        checkpointId: prevCheckpoint.id,
        checkpointLabel: prevCheckpoint.label,
        userMessage,
      });
    },
    [canUseCheckpointActions, checkpoints, messages, warning],
  );

  const handleConfirmDialogOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setConfirmDialog(null);
    }
  }, []);

  const handleConfirmAction = useCallback(async () => {
    if (!confirmDialog) {
      return;
    }

    if (confirmDialog.type === "revert") {
      const result = await dispatch({
        type: CheckpointCommands.RESTORE_CHECKPOINT,
        payload: { checkpointId: confirmDialog.checkpointId },
      });

      if (!result.success) {
        toastError("回溯失败", result.error ?? "无法回溯到该检查点");
        return;
      }

      setConfirmDialog(null);
      return;
    }

    const conversationId = messages[0]?.conversationId;
    if (!conversationId) {
      toastError("重新生成失败", "未找到当前会话 ID");
      return;
    }

    const result = await dispatch({
      type: ChatCommands.REGENERATE_FROM_CHECKPOINT,
      payload: {
        checkpointId: confirmDialog.checkpointId,
        userMessage: confirmDialog.userMessage,
        conversationId,
      },
    });

    if (!result.success) {
      toastError("重新生成失败", result.error ?? "无法从检查点重新生成");
      return;
    }

    setConfirmDialog(null);
  }, [confirmDialog, dispatch, messages, toastError]);

  return (
    <>
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
        <div className="w-full space-y-4">
          {parsedMessages.map((message) => {
            const isStreaming = message.id === streamingMessageId;

            // 玩家消息样式
            if (message.role === "user") {
              return (
                <UserMessageBlock
                  key={message.id}
                  message={message}
                  isStreaming={Boolean(streamingMessageId)}
                />
              );
            }

            // AI 叙事消息（使用缓存的解析结果）
            return (
              <NarrativeBlock
                key={message.id}
                content={message.parsed.narrative}
                isStreaming={isStreaming}
                messageId={message.id}
                conversationId={message.conversationId}
                onRevertToCheckpoint={handleRevertToCheckpoint}
                onRegenerate={handleRegenerate}
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

      {confirmDialog && (
        <RestoreConfirmDialog
          open
          onOpenChange={handleConfirmDialogOpenChange}
          onConfirm={() => {
            void handleConfirmAction();
          }}
          type={confirmDialog.type}
          checkpointLabel={confirmDialog.checkpointLabel}
        />
      )}
    </>
  );
}
