import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useMemo, useState, type KeyboardEvent, type MouseEvent } from "react";

import type { AiOutputEntry, AiOutputSource } from "@/stores/ai-output-log";
import { animation, borders, color, colorAlpha, glow } from "@/styles/tokens";

import { AiOutputContent } from "./AiOutputContent";

interface AiOutputCardProps {
  entry: AiOutputEntry;
  defaultExpanded?: boolean;
}

function formatDeltaSummary(entry: AiOutputEntry): string | null {
  const deltas = entry.deltas;
  if (!deltas || deltas.length === 0) {
    return null;
  }

  const terminal = deltas[deltas.length - 1];
  return `Δ ${deltas.length} | base ${deltas[0].baseTurn} | ${terminal.commitStatus}`;
}

interface SourceVisual {
  label: string;
  background: string;
  textColor: string;
}

const SOURCE_VISUAL: Record<AiOutputSource, SourceVisual> = {
  director: {
    label: "导演 AI",
    background: colorAlpha("warning", 0.15),
    textColor: color("warning"),
  },
  parser: {
    label: "解析 AI",
    background: colorAlpha("primary", 0.15),
    textColor: color("primary"),
  },
  narrator: {
    label: "叙事 AI",
    background: colorAlpha("success", 0.15),
    textColor: color("success"),
  },
  summarizer: {
    label: "总结 AI",
    background: colorAlpha("secondary", 0.15),
    textColor: color("secondary"),
  },
  system: {
    label: "Delta 协议",
    background: colorAlpha("primary", 0.12),
    textColor: color("primary"),
  },
};

function formatDuration(duration?: number): string | null {
  if (typeof duration !== "number" || Number.isNaN(duration) || duration < 0) {
    return null;
  }

  return `${(duration / 1000).toFixed(1)}s`;
}

export function AiOutputCard({
  entry,
  defaultExpanded = false,
}: AiOutputCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const sourceVisual = SOURCE_VISUAL[entry.source];
  const durationText = formatDuration(entry.duration);
  const deltaSummary = formatDeltaSummary(entry);
  const collapsedPreview = useMemo(() => {
    const normalized = entry.rawOutput.replace(/\r\n/g, "\n").trim();
    if (!normalized) {
      return "（无输出内容）";
    }

    const lines = normalized.split("\n");
    const previewLines = lines.slice(0, 3);
    const hasMore = lines.length > 3;
    const previewText = previewLines.join("\n");
    return hasMore ? `${previewText}\n…` : previewText;
  }, [entry.rawOutput]);
  const correlationId = entry.correlationId?.trim();
  const correlationText = correlationId
    ? `cid:${correlationId.slice(0, 8)}`
    : null;

  const toggleExpanded = () => {
    setExpanded((value) => !value);
  };

  const handleHeaderKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    toggleExpanded();
  };

  const handleCopyCorrelationId = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (!correlationId || !navigator.clipboard?.writeText) {
      return;
    }

    void navigator.clipboard.writeText(correlationId).catch(() => undefined);
  };

  return (
    <div
      className="rounded-md border overflow-hidden"
      style={{
        borderRadius: borders.radius.md,
        borderColor: entry.success
          ? colorAlpha("border", 0.3)
          : colorAlpha("error", 0.5),
        background: colorAlpha("bgElevated", 0.4),
        boxShadow:
          expanded && !entry.success ? glow("error", "sm", 0.22) : undefined,
      }}
    >
      <div
        role="button"
        tabIndex={0}
        className="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors cursor-pointer"
        onClick={toggleExpanded}
        onKeyDown={handleHeaderKeyDown}
        aria-expanded={expanded}
        aria-label={`切换 AI 输出详情：回合 ${entry.turn}`}
        style={{
          background: expanded
            ? colorAlpha("bgElevated", 0.45)
            : colorAlpha("bgElevated", 0.25),
        }}
      >
        <div className="min-w-0 flex items-center gap-2 flex-wrap">
          <span
            className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium"
            style={{
              background: colorAlpha("textMuted", 0.16),
              color: colorAlpha("textSecondary", 0.95),
            }}
          >
            {`回合 #${entry.turn}`}
          </span>

          <span
            className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium"
            style={{
              background: sourceVisual.background,
              color: sourceVisual.textColor,
            }}
          >
            {sourceVisual.label}
          </span>

          {durationText ? (
            <span
              className="text-xs"
              style={{ color: colorAlpha("textMuted", 0.9) }}
            >
              {durationText}
            </span>
          ) : null}

          {correlationText ? (
            <button
              type="button"
              className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium font-mono transition-colors"
              onClick={handleCopyCorrelationId}
              onKeyDown={(event) => event.stopPropagation()}
              aria-label={`复制 correlationId：${correlationId}`}
              title={`点击复制完整 correlationId：${correlationId}`}
              style={{
                background: colorAlpha("textMuted", 0.12),
                color: colorAlpha("textMuted", 0.95),
                border: `1px solid ${colorAlpha("border", 0.24)}`,
              }}
            >
              {correlationText}
            </button>
          ) : null}

          {deltaSummary ? (
            <span
              className="text-xs"
              style={{ color: colorAlpha("textMuted", 0.9) }}
              title="Delta 链摘要"
            >
              {deltaSummary}
            </span>
          ) : null}

          <span
            className="text-xs"
            style={{ color: entry.success ? color("success") : color("error") }}
            aria-label={entry.success ? "执行成功" : "执行失败"}
            title={entry.success ? "执行成功" : "执行失败"}
          >
            {entry.success ? "✅" : "❌"}
          </span>
        </div>

        <span
          className="shrink-0"
          style={{ color: colorAlpha("textSecondary", 0.85) }}
        >
          {expanded ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </span>
      </div>

      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: animation.duration.fast, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 pt-1 space-y-2.5">
              {!entry.success && entry.error ? (
                <div
                  className="rounded px-2.5 py-2 text-xs"
                  style={{
                    borderRadius: borders.radius.sm,
                    color: color("error"),
                    background: colorAlpha("error", 0.12),
                    border: `1px solid ${colorAlpha("error", 0.35)}`,
                  }}
                >
                  {entry.error}
                </div>
              ) : null}

              <AiOutputContent content={entry.rawOutput} />
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="preview"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: animation.duration.fast, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 pt-1">
              <pre
                className="rounded px-2.5 py-2 text-xs whitespace-pre-wrap wrap-break-word overflow-hidden"
                style={{
                  borderRadius: borders.radius.sm,
                  color: colorAlpha("textSecondary", 0.95),
                  background: colorAlpha("bgBase", 0.42),
                  border: `1px solid ${colorAlpha("border", 0.25)}`,
                }}
              >
                {collapsedPreview}
              </pre>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
