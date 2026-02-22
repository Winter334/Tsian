/**
 * NarrativeBlock - 叙事段落组件
 * 渲染单条 AI 叙事消息，支持流式打字效果
 * 增强风格：终端文本 + 发光边框指示器
 */

import { motion } from "framer-motion";
import { BookmarkPlus, Pencil, RefreshCw, Undo2 } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { ContextMenu, type ContextMenuItem } from "@/components/ui";
import { MarkdownRenderer } from "@/components/ui/markdown";
import { ChatCommands } from "@/domain/commands/chat";
import { useCommand } from "@/hooks";
import { cn } from "@/lib/utils";
import { ManualMemoryDialog } from "@/modules/memory";
import { animation, colorAlpha, glow, gradients } from "@/styles/tokens";

import { InlineEditor } from "./InlineEditor";

interface NarrativeBlockProps {
  content: string;
  isStreaming?: boolean;
  className?: string;
  messageId?: string;
  conversationId?: string;
  onRevertToCheckpoint?: (messageId: string) => void;
  onRegenerate?: (messageId: string) => void;
}

/**
 * 打字光标组件
 * 增强发光效果
 */
function TypingCursor() {
  return (
    <motion.span
      className="inline-block w-3 h-6 ml-1 align-middle rounded-sm"
      style={{
        background: gradients.primary(),
        boxShadow: `${glow("primary", "md", 0.8)}, ${glow(
          "secondary",
          "lg",
          0.5,
        )}`,
      }}
      animate={{
        opacity: [1, 0.3, 1],
        scaleY: [1, 0.85, 1],
      }}
      transition={{
        duration: 0.8,
        repeat: Infinity,
        ease: "easeInOut",
      }}
    />
  );
}

function getMessageIdFromContext(
  data: Record<string, unknown> | undefined,
): string | undefined {
  const value = data?.messageId;
  return typeof value === "string" ? value : undefined;
}

export function NarrativeBlock({
  content,
  isStreaming = false,
  className,
  messageId,
  conversationId,
  onRevertToCheckpoint,
  onRegenerate,
}: NarrativeBlockProps) {
  const dispatch = useCommand();

  const [manualDialogOpen, setManualDialogOpen] = useState(false);
  const [selectedText, setSelectedText] = useState("");
  const [selectedSourceMessageId, setSelectedSourceMessageId] = useState<
    string | undefined
  >(messageId);
  const [isEditing, setIsEditing] = useState(false);

  const contextData = useMemo<Record<string, unknown> | undefined>(
    () => (messageId ? { messageId } : undefined),
    [messageId],
  );

  const contextMenuItems = useMemo<ContextMenuItem[]>(() => {
    const canEdit =
      !isStreaming && !isEditing && !!messageId && !!conversationId;
    const canRevert =
      !isStreaming &&
      !isEditing &&
      !!messageId &&
      typeof onRevertToCheckpoint === "function";
    const canRegenerate =
      !isStreaming &&
      !isEditing &&
      !!messageId &&
      typeof onRegenerate === "function";

    return [
      {
        id: "save-as-memory",
        label: "保存为记忆",
        icon: <BookmarkPlus className="h-4 w-4" />,
        requiresSelection: true,
        onAction: (context) => {
          const nextSelectedText = context.selectedText.trim();
          if (!nextSelectedText) {
            return;
          }

          setSelectedText(nextSelectedText);
          setSelectedSourceMessageId(
            getMessageIdFromContext(context.data) ?? messageId,
          );
          setManualDialogOpen(true);
        },
      },
      {
        id: "edit-message",
        label: "编辑消息",
        icon: <Pencil className="h-4 w-4" />,
        disabled: !canEdit,
        onAction: () => {
          setIsEditing(true);
        },
      },
      {
        id: "revert-to-checkpoint",
        label: "回溯到此",
        icon: <Undo2 className="h-4 w-4" />,
        disabled: !canRevert,
        onAction: () => {
          if (messageId) {
            onRevertToCheckpoint?.(messageId);
          }
        },
      },
      {
        id: "regenerate",
        label: "重新生成",
        icon: <RefreshCw className="h-4 w-4" />,
        disabled: !canRegenerate,
        onAction: () => {
          if (messageId) {
            onRegenerate?.(messageId);
          }
        },
      },
    ];
  }, [
    conversationId,
    isEditing,
    isStreaming,
    messageId,
    onRegenerate,
    onRevertToCheckpoint,
  ]);

  const handleDialogOpenChange = useCallback(
    (open: boolean) => {
      setManualDialogOpen(open);
      if (!open) {
        setSelectedText("");
        setSelectedSourceMessageId(messageId);
      }
    },
    [messageId],
  );

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
  }, []);

  const handleSaveEdit = useCallback(
    async (nextContent: string) => {
      if (!messageId || !conversationId) {
        return;
      }

      const result = await dispatch({
        type: ChatCommands.EDIT_MESSAGE,
        payload: {
          messageId,
          conversationId,
          content: nextContent,
        },
      });

      if (result.success) {
        setIsEditing(false);
      }
    },
    [conversationId, dispatch, messageId],
  );

  return (
    <>
      <ContextMenu items={contextMenuItems} contextData={contextData}>
        <motion.div
          className={cn(
            // 基础样式 - 增大间距
            "relative rounded-lg px-5 py-6",
            // 终端文本风格
            "terminal-text text-base",
            className,
          )}
          style={{
            background: colorAlpha("bgCard", 0.4), // 添加半透明背景
            border: `1px solid ${colorAlpha("primary", 0.2)}`,
          }}
          initial={isStreaming ? { opacity: 0.8 } : false}
          animate={{ opacity: 1 }}
          transition={{ duration: animation.duration.instant }}
        >
          {/* 流式输出时的发光边框效果 - 增强宽度和发光 */}
          {isStreaming && !isEditing && (
            <motion.div
              className="absolute -left-1 top-0 bottom-0 w-1 rounded-full"
              style={{
                background: gradients.primary(),
                boxShadow: `${glow("primary", "md", 0.8)}, ${glow(
                  "secondary",
                  "lg",
                  0.6,
                )}`,
              }}
              animate={{
                opacity: [0.6, 1, 0.6],
                boxShadow: [
                  `${glow("primary", "md", 0.8)}, ${glow("secondary", "lg", 0.6)}`,
                  `${glow("primary", "lg", 1)}, ${glow("secondary", "xl", 0.8)}`,
                  `${glow("primary", "md", 0.8)}, ${glow("secondary", "lg", 0.6)}`,
                ],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          )}

          {/* 内容区域 - 提升亮度 */}
          <div
            className="relative"
            style={{
              textShadow: `0 0 8px ${colorAlpha("primary", 0.4)}`,
              color: colorAlpha("textPrimary", 0.95), // 提升文字亮度
            }}
          >
            {isEditing ? (
              <InlineEditor
                initialContent={content}
                onSave={(nextContent) => {
                  void handleSaveEdit(nextContent);
                }}
                onCancel={handleCancelEdit}
              />
            ) : (
              <MarkdownRenderer
                content={content}
                className="prose prose-invert prose-cyan max-w-none"
              />
            )}
          </div>

          {/* 流式输出时的打字光标 */}
          {isStreaming && !isEditing && <TypingCursor />}
        </motion.div>
      </ContextMenu>

      <ManualMemoryDialog
        open={manualDialogOpen}
        onOpenChange={handleDialogOpenChange}
        sourceContent={selectedText}
        sourceMessageId={selectedSourceMessageId}
      />
    </>
  );
}
