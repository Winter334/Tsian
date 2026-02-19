import { Edit3 } from "lucide-react";
import { useMemo, useState, type CSSProperties } from "react";

import { Button, ScrollArea } from "@/components/ui";
import { MemoryCommands } from "@/domain/commands";
import type { MegaSummary } from "@/domain/entities/memory";
import { useCommand } from "@/hooks/use-command";
import { useCurrentConversationId } from "@/modules/chat";
import { color, colorAlpha } from "@/styles/tokens";

import { useMemoryStore } from "../store";
import { SummaryEditDialog } from "./SummaryEditDialog";

const contentPreviewStyle: CSSProperties = {
  display: "-webkit-box",
  WebkitLineClamp: 3,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
};

function formatDateTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString("zh-CN", { hour12: false });
}

/**
 * 大总结列表
 */
export function MegaSummaryList() {
  const conversationId = useCurrentConversationId();
  const dispatch = useCommand();
  const [editTarget, setEditTarget] = useState<MegaSummary | null>(null);

  const megaSummaries = useMemoryStore((state) =>
    conversationId ? (state.megaSummaries[conversationId] ?? []) : [],
  );

  const sortedSummaries = useMemo(
    () =>
      [...megaSummaries].sort((first, second) => {
        const rangeDiff = second.messageRange.to - first.messageRange.to;
        if (rangeDiff !== 0) {
          return rangeDiff;
        }
        return second.createdAt - first.createdAt;
      }),
    [megaSummaries],
  );

  const handleSave = (content: string) => {
    if (!conversationId || !editTarget) {
      return;
    }

    void dispatch({
      type: MemoryCommands.UPDATE_MEGA_SUMMARY,
      payload: {
        conversationId,
        summaryId: editTarget.id,
        content: content.trim(),
      },
    });
  };

  return (
    <>
      <ScrollArea className="h-full pr-2">
        {!conversationId ? (
          <div
            className="rounded-md border px-3 py-4 text-sm"
            style={{
              color: color("textMuted"),
              background: colorAlpha("bgCard", 0.35),
              borderColor: colorAlpha("border", 0.45),
            }}
          >
            当前没有激活会话，无法读取大总结。
          </div>
        ) : sortedSummaries.length === 0 ? (
          <div
            className="rounded-md border px-3 py-4 text-sm"
            style={{
              color: color("textMuted"),
              background: colorAlpha("bgCard", 0.35),
              borderColor: colorAlpha("border", 0.45),
            }}
          >
            暂无大总结数据。
          </div>
        ) : (
          <div className="space-y-3">
            {sortedSummaries.map((summary, index) => (
              <article
                key={summary.id}
                className="rounded-lg border p-3"
                style={{
                  background: colorAlpha("bgCard", 0.38),
                  borderColor: colorAlpha("border", 0.52),
                }}
              >
                <header className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className="text-sm font-semibold"
                        style={{ color: color("textPrimary") }}
                      >
                        大总结 #{sortedSummaries.length - index}
                      </span>
                      <span
                        className="rounded-md border px-2 py-0.5 text-[11px]"
                        style={{
                          color: color("primary"),
                          background: colorAlpha("primary", 0.1),
                          borderColor: colorAlpha("primary", 0.3),
                        }}
                      >
                        覆盖 #{summary.messageRange.from} ~ #
                        {summary.messageRange.to}
                      </span>
                    </div>

                    <p
                      className="text-xs"
                      style={{ color: color("textMuted") }}
                    >
                      创建时间：{formatDateTime(summary.createdAt)}
                    </p>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 px-3 text-xs"
                    onClick={() => setEditTarget(summary)}
                  >
                    <Edit3 className="mr-1 h-3.5 w-3.5" />
                    编辑
                  </Button>
                </header>

                <p
                  className="mt-2 text-sm leading-relaxed wrap-break-word"
                  style={{
                    ...contentPreviewStyle,
                    color: color("textSecondary"),
                  }}
                  title={summary.content}
                >
                  {summary.content || "（无内容）"}
                </p>
              </article>
            ))}
          </div>
        )}
      </ScrollArea>

      {editTarget && (
        <SummaryEditDialog
          open={Boolean(editTarget)}
          onOpenChange={(open) => {
            if (!open) {
              setEditTarget(null);
            }
          }}
          title={`编辑大总结 #${editTarget.messageRange.from}~#${editTarget.messageRange.to}`}
          content={editTarget.content}
          onSave={handleSave}
        />
      )}
    </>
  );
}
