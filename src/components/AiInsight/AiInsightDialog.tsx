import { useMemo, useState } from "react";

import { AiOutputCard } from "@/components/AiInsight/AiOutputCard";
import { Button, Dialog, DialogContent, ScrollArea } from "@/components/ui";
import {
  useAiOutputLogStore,
  type AiOutputEntry,
  type AiOutputSource,
} from "@/stores/ai-output-log";
import { color, colorAlpha, glow } from "@/styles/tokens";

interface AiInsightDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type AiInsightTabKey = "all" | AiOutputSource;

interface FilterTab {
  key: AiInsightTabKey;
  label: string;
}

const FILTER_TABS: FilterTab[] = [
  { key: "all", label: "全部" },
  { key: "director", label: "导演" },
  { key: "parser", label: "解析" },
  { key: "narrator", label: "叙事" },
  { key: "summarizer", label: "总结" },
  { key: "system", label: "Delta" },
];

export function AiInsightDialog({ open, onOpenChange }: AiInsightDialogProps) {
  const entries = useAiOutputLogStore((state) => state.entries);
  const [activeTab, setActiveTab] = useState<AiInsightTabKey>("all");

  const filteredEntries = useMemo(() => {
    if (activeTab === "all") {
      return entries;
    }

    return entries.filter((entry) => entry.source === activeTab);
  }, [activeTab, entries]);

  const groupedByTurn = useMemo(() => {
    const groups = new Map<number, AiOutputEntry[]>();

    for (const entry of filteredEntries) {
      const turnGroup = groups.get(entry.turn);
      if (turnGroup) {
        turnGroup.push(entry);
      } else {
        groups.set(entry.turn, [entry]);
      }
    }

    return Array.from(groups.entries())
      .sort((a, b) => b[0] - a[0])
      .map(([turn, turnEntries]) => ({
        turn,
        entries: [...turnEntries].sort((a, b) => {
          if (a.sequenceIndex !== b.sequenceIndex) {
            return a.sequenceIndex - b.sequenceIndex;
          }

          return a.timestamp - b.timestamp;
        }),
      }));
  }, [filteredEntries]);

  const maxTurn = useMemo(() => {
    if (groupedByTurn.length === 0) {
      return null;
    }

    return groupedByTurn[0].turn;
  }, [groupedByTurn]);

  const clearLogs = () => {
    useAiOutputLogStore.getState().clear();
  };

  const hasEntries = groupedByTurn.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="AI 洞察"
        width={760}
        animateLifecycle
        className="max-h-[82vh]"
      >
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {FILTER_TABS.map((tab) => {
              const isActive = activeTab === tab.key;

              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
                  style={{
                    color: isActive
                      ? color("primary")
                      : colorAlpha("textSecondary", 0.82),
                    background: isActive
                      ? colorAlpha("primary", 0.16)
                      : colorAlpha("bgElevated", 0.3),
                    border: `1px solid ${
                      isActive
                        ? colorAlpha("primary", 0.45)
                        : colorAlpha("border", 0.3)
                    }`,
                    boxShadow: isActive ? glow("primary", "sm", 0.12) : "none",
                  }}
                  aria-pressed={isActive}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {hasEntries ? (
            <ScrollArea maxHeight="56vh" className="pr-1">
              <div className="space-y-2.5">
                {groupedByTurn.map((turnGroup) =>
                  turnGroup.entries.map((entry) => (
                    <AiOutputCard
                      key={entry.id}
                      entry={entry}
                      defaultExpanded={turnGroup.turn === maxTurn}
                    />
                  )),
                )}
              </div>
            </ScrollArea>
          ) : (
            <div
              className="h-56 flex items-center justify-center text-sm"
              style={{ color: color("textMuted") }}
            >
              暂无 AI 输出日志
            </div>
          )}

          <div className="pt-1 flex justify-end">
            <Button variant="ghost" size="sm" onClick={clearLogs}>
              清空日志
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
