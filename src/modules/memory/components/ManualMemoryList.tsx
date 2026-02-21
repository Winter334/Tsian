import { Edit3, Plus, Trash2 } from "lucide-react";
import { useMemo, useState, type CSSProperties } from "react";

import { Button, ScrollArea, useToast } from "@/components/ui";
import { MemoryCommands } from "@/domain/commands";
import type { ManualMemory } from "@/domain/entities/memory";
import { useCommand } from "@/hooks/use-command";
import { useCurrentConversationId } from "@/modules/chat";
import { color, colorAlpha } from "@/styles/tokens";

import { useMemoryStore } from "../store";
import { ManualMemoryDialog } from "./ManualMemoryDialog";

const summaryPreviewStyle: CSSProperties = {
  display: "-webkit-box",
  WebkitLineClamp: 3,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
};

const sourcePreviewStyle: CSSProperties = {
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
};

const EMPTY_MANUAL_MEMORIES: ManualMemory[] = [];

function formatDateTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString("zh-CN", { hour12: false });
}

function getMemoryTitle(memory: ManualMemory, index: number): string {
  const firstLine = memory.summary
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .find(Boolean);

  if (firstLine) {
    return firstLine.length > 24 ? `${firstLine.slice(0, 24)}…` : firstLine;
  }

  return `手动记忆 #${index + 1}`;
}

/**
 * 手动记忆列表
 */
export function ManualMemoryList() {
  const conversationId = useCurrentConversationId();
  const dispatch = useCommand();
  const toast = useToast();

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ManualMemory | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const manualMemories = useMemoryStore((state) =>
    conversationId
      ? (state.manualMemories[conversationId] ?? EMPTY_MANUAL_MEMORIES)
      : EMPTY_MANUAL_MEMORIES,
  );

  const sortedMemories = useMemo(
    () =>
      [...manualMemories].sort((first, second) => {
        const updatedDiff = second.updatedAt - first.updatedAt;
        if (updatedDiff !== 0) {
          return updatedDiff;
        }
        return second.createdAt - first.createdAt;
      }),
    [manualMemories],
  );

  const handleDelete = async (memoryId: string) => {
    if (!conversationId) {
      return;
    }

    setDeletingId(memoryId);
    try {
      const result = await dispatch({
        type: MemoryCommands.DELETE_MANUAL_MEMORY,
        payload: {
          conversationId,
          id: memoryId,
        },
      });

      if (!result.success) {
        toast.error("删除记忆失败", result.error ?? "未知错误");
        return;
      }

      toast.success("记忆已删除");
      if (editTarget?.id === memoryId) {
        setEditTarget(null);
      }
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <>
      <div className="flex h-full min-h-0 flex-col">
        <ScrollArea className="min-h-0 flex-1 pr-2">
          {!conversationId ? (
            <div
              className="rounded-md border px-3 py-4 text-sm"
              style={{
                color: color("textMuted"),
                background: colorAlpha("bgCard", 0.35),
                borderColor: colorAlpha("border", 0.45),
              }}
            >
              当前没有激活会话，无法读取手动记忆。
            </div>
          ) : sortedMemories.length === 0 ? (
            <div
              className="rounded-md border px-3 py-4 text-sm"
              style={{
                color: color("textMuted"),
                background: colorAlpha("bgCard", 0.35),
                borderColor: colorAlpha("border", 0.45),
              }}
            >
              暂无手动记忆，点击下方按钮可以添加一条新的记忆。
            </div>
          ) : (
            <div className="space-y-3">
              {sortedMemories.map((memory, index) => (
                <article
                  key={memory.id}
                  className="rounded-lg border p-3"
                  style={{
                    background: colorAlpha("bgCard", 0.38),
                    borderColor: colorAlpha("border", 0.52),
                  }}
                >
                  <header className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <h3
                        className="truncate text-sm font-semibold"
                        style={{ color: color("textPrimary") }}
                        title={memory.summary}
                      >
                        {getMemoryTitle(memory, index)}
                      </h3>
                      <p
                        className="text-xs"
                        style={{ color: color("textMuted") }}
                      >
                        更新时间：{formatDateTime(memory.updatedAt)}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 px-3 text-xs"
                        onClick={() => setEditTarget(memory)}
                      >
                        <Edit3 className="mr-1 h-3.5 w-3.5" />
                        编辑
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 px-3 text-xs"
                        disabled={deletingId === memory.id}
                        onClick={() => {
                          void handleDelete(memory.id);
                        }}
                      >
                        <Trash2 className="mr-1 h-3.5 w-3.5" />
                        {deletingId === memory.id ? "删除中..." : "删除"}
                      </Button>
                    </div>
                  </header>

                  <section className="mt-2 space-y-2">
                    <div>
                      <p
                        className="text-sm leading-relaxed wrap-break-word"
                        style={{
                          ...summaryPreviewStyle,
                          color: color("textSecondary"),
                        }}
                        title={memory.summary}
                      >
                        {memory.summary || "（无摘要）"}
                      </p>
                    </div>

                    <div>
                      <p
                        className="text-xs leading-relaxed wrap-break-word"
                        style={{
                          ...sourcePreviewStyle,
                          color: colorAlpha("textSecondary", 0.75),
                        }}
                        title={memory.sourceContent}
                      >
                        原文：{memory.sourceContent || "（无原文）"}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-1">
                      {memory.tags.length > 0 ? (
                        memory.tags.map((tag) => (
                          <span
                            key={`${memory.id}-${tag}`}
                            className="rounded-md border px-2 py-0.5 text-[11px]"
                            style={{
                              color: color("primary"),
                              background: colorAlpha("primary", 0.1),
                              borderColor: colorAlpha("primary", 0.3),
                            }}
                          >
                            {tag}
                          </span>
                        ))
                      ) : (
                        <span
                          className="rounded-md border px-2 py-0.5 text-[11px]"
                          style={{
                            color: color("textMuted"),
                            background: colorAlpha("bgElevated", 0.5),
                            borderColor: colorAlpha("borderMuted", 0.8),
                          }}
                        >
                          无标签
                        </span>
                      )}
                    </div>
                  </section>
                </article>
              ))}
            </div>
          )}
        </ScrollArea>

        <div
          className="mt-3 border-t pt-3"
          style={{ borderColor: colorAlpha("primary", 0.2) }}
        >
          <Button
            type="button"
            variant="outline"
            className="h-9 px-4 text-sm"
            onClick={() => setCreateOpen(true)}
            disabled={!conversationId}
          >
            <Plus className="mr-1 h-4 w-4" />
            添加手动记忆
          </Button>
        </div>
      </div>

      <ManualMemoryDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        sourceContent=""
      />

      {editTarget && (
        <ManualMemoryDialog
          open={Boolean(editTarget)}
          onOpenChange={(open) => {
            if (!open) {
              setEditTarget(null);
            }
          }}
          editMemory={editTarget}
        />
      )}
    </>
  );
}
