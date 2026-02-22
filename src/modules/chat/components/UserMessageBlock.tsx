import { Pencil } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { ContextMenu, type ContextMenuItem } from "@/components/ui";
import { ChatCommands } from "@/domain/commands/chat";
import type { Message } from "@/domain/entities/message";
import { useCommand } from "@/hooks";
import { cn } from "@/lib/utils";
import { colorAlpha } from "@/styles/tokens";

import { InlineEditor } from "./InlineEditor";

interface UserMessageBlockProps {
  message: Message;
  isStreaming: boolean;
}

export function UserMessageBlock({
  message,
  isStreaming,
}: UserMessageBlockProps) {
  const dispatch = useCommand();
  const [isEditing, setIsEditing] = useState(false);

  const contextData = useMemo<Record<string, unknown>>(
    () => ({ messageId: message.id }),
    [message.id],
  );

  const contextMenuItems = useMemo<ContextMenuItem[]>(
    () => [
      {
        id: "edit-message",
        label: "编辑消息",
        icon: <Pencil className="h-4 w-4" />,
        disabled: isStreaming,
        onAction: () => {
          setIsEditing(true);
        },
      },
    ],
    [isStreaming],
  );

  const handleSave = useCallback(
    async (nextContent: string) => {
      const result = await dispatch({
        type: ChatCommands.EDIT_MESSAGE,
        payload: {
          messageId: message.id,
          conversationId: message.conversationId,
          content: nextContent,
        },
      });

      if (result.success) {
        setIsEditing(false);
      }
    },
    [dispatch, message.conversationId, message.id],
  );

  const handleCancel = useCallback(() => {
    setIsEditing(false);
  }, []);

  return (
    <ContextMenu items={contextMenuItems} contextData={contextData}>
      {isEditing ? (
        <InlineEditor
          initialContent={message.content}
          onSave={(nextContent) => {
            void handleSave(nextContent);
          }}
          onCancel={handleCancel}
        />
      ) : (
        <div
          className={cn("pl-4 border-l-2")}
          style={{
            borderLeftColor: colorAlpha("primary", 0.5),
            color: colorAlpha("textPrimary", 0.9),
          }}
        >
          {message.content}
        </div>
      )}
    </ContextMenu>
  );
}
