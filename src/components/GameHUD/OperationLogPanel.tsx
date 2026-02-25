import { ChevronDown, ClipboardList } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { useOperationLogStore } from "@/modules";
import { color, colorAlpha, glow } from "@/styles/tokens";

function formatTimestamp(timestamp: number): string {
  if (!Number.isFinite(timestamp)) {
    return "--:--";
  }

  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return "--:--";
  }

  const now = new Date();
  const isSameDay =
    now.getFullYear() === date.getFullYear() &&
    now.getMonth() === date.getMonth() &&
    now.getDate() === date.getDate();

  const time = date.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (isSameDay) {
    return time;
  }

  const shortDate = date.toLocaleDateString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
  });

  return `${shortDate} ${time}`;
}

function formatMechanicSummary(summary: string): string {
  const normalized = summary.trim();
  return normalized.length > 0 ? normalized : "（无机制摘要）";
}

export function OperationLogPanel() {
  const entries = useOperationLogStore((state) => state.entries);
  const count = entries.length;
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (count === 0) {
      setExpanded(false);
    }
  }, [count]);

  const sortedEntries = useMemo(
    () => [...entries].sort((a, b) => b.timestamp - a.timestamp),
    [entries],
  );

  const canExpand = count > 0;

  return (
    <section
      className="rounded-lg p-3 space-y-3 transition-all duration-200"
      style={{
        background: colorAlpha("bgElevated", 0.45),
        border: `1px solid ${colorAlpha("primary", 0.2)}`,
        boxShadow:
          canExpand && expanded ? glow("primary", "sm", 0.15) : undefined,
      }}
    >
      <button
        type="button"
        onClick={() => {
          if (!canExpand) return;
          setExpanded((value) => !value);
        }}
        aria-expanded={canExpand ? expanded : false}
        aria-label="展开操作日志"
        disabled={!canExpand}
        className="w-full flex items-center justify-between text-left transition-all duration-200 disabled:cursor-default"
      >
        <span className="flex items-center gap-2">
          <span
            className="inline-flex h-6 w-6 items-center justify-center rounded-md transition-all duration-200"
            style={{
              background: colorAlpha("primary", expanded ? 0.24 : 0.12),
              color: color("primary"),
            }}
          >
            <ClipboardList className="w-3.5 h-3.5" />
          </span>

          <span
            className="text-sm font-medium"
            style={{ color: color("textPrimary") }}
          >
            操作日志
          </span>
        </span>

        <span className="inline-flex items-center gap-2">
          {count > 0 ? (
            <span
              className="inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-semibold"
              style={{
                background: colorAlpha("primary", 0.85),
                color: color("textPrimary"),
                boxShadow: glow("primary", "sm", 0.15),
              }}
              aria-label={`操作日志 ${count} 条`}
            >
              {count}
            </span>
          ) : null}

          <ChevronDown
            className={[
              "w-4 h-4 transition-transform duration-200",
              canExpand && expanded ? "rotate-180" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            style={{ color: colorAlpha("textMuted", canExpand ? 0.9 : 0.55) }}
          />
        </span>
      </button>

      {canExpand && expanded ? (
        <div className="space-y-2">
          <div className="max-h-60 space-y-2 overflow-y-auto pr-1">
            {sortedEntries.map((entry) => (
              <article
                key={entry.id}
                className="rounded-md p-2.5 space-y-1.5"
                style={{
                  background: colorAlpha("bgElevated", 0.35),
                  border: `1px solid ${colorAlpha("primary", 0.14)}`,
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <p
                    className="text-xs font-medium leading-relaxed"
                    style={{ color: color("textPrimary") }}
                  >
                    {entry.source}
                  </p>
                  <time
                    className="shrink-0 text-[11px]"
                    style={{ color: colorAlpha("textMuted", 0.86) }}
                  >
                    {formatTimestamp(entry.timestamp)}
                  </time>
                </div>

                <p
                  className="text-xs leading-relaxed whitespace-pre-wrap"
                  style={{ color: colorAlpha("textMuted", 0.9) }}
                >
                  {formatMechanicSummary(entry.resultFrame.mechanicSummary)}
                </p>
              </article>
            ))}
          </div>

          <p
            className="text-[11px] leading-relaxed"
            style={{ color: colorAlpha("primary", 0.8) }}
          >
            ⏳ 将在下次对话中由叙事描写
          </p>
        </div>
      ) : null}
    </section>
  );
}
