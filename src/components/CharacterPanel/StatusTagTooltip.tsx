import { useMemo } from "react";

import type { CharacterTag } from "@/hooks/useCharacterTags";
import { cn } from "@/lib/utils";

import { StatusTagBadge } from "./StatusTagBadge";
import { SOURCE_LABEL_MAP, getTimingLabel } from "./status-labels";
import { getTagIcon } from "./tag-icon-map";

import { color, colorAlpha, glow } from "@/styles/tokens";

interface StatusTagTooltipProps {
  tag: CharacterTag;
  className?: string;
}

function getDurationLabel(duration?: number): string {
  if (typeof duration === "number") {
    return `剩余: ${duration} 回合`;
  }
  return "剩余: 永久";
}

export function StatusTagTooltip({ tag, className }: StatusTagTooltipProps) {
  const Icon = useMemo(() => getTagIcon(tag.icon), [tag.icon]);
  const timingLabel = useMemo(() => getTimingLabel(tag.timing), [tag.timing]);
  const durationLabel = useMemo(
    () => getDurationLabel(tag.remainingDuration),
    [tag.remainingDuration],
  );
  const sourceLabel = useMemo(() => SOURCE_LABEL_MAP[tag.source], [tag.source]);

  return (
    <div className={cn("group relative inline-flex", className)}>
      <StatusTagBadge tag={tag} />

      <div
        className={cn(
          "pointer-events-none absolute left-1/2 top-full z-30 mt-2 w-64 -translate-x-1/2",
          "rounded-md p-3 opacity-0 transition-opacity duration-150",
          "group-hover:opacity-100",
        )}
        style={{
          background: colorAlpha("bgElevated", 0.96),
          border: `1px solid ${colorAlpha("primary", 0.25)}`,
          boxShadow: `${glow("primary", "md", 0.2)}, 0 8px 24px ${colorAlpha("bgBase", 0.6)}`,
        }}
      >
        <div className="flex items-center gap-2">
          <Icon
            className="h-4 w-4 shrink-0"
            style={{ color: color("primary") }}
          />
          <span
            className="text-sm font-semibold"
            style={{ color: color("primary") }}
          >
            {tag.displayName}
          </span>
        </div>

        <p
          className="mt-2 text-xs leading-relaxed"
          style={{ color: color("textSecondary") }}
        >
          {tag.effectDescription || "暂无描述"}
        </p>

        <div
          className="my-2 h-px w-full"
          style={{
            background: `linear-gradient(90deg, transparent, ${colorAlpha("primary", 0.4)}, transparent)`,
          }}
        />

        <div
          className="space-y-1 text-xs"
          style={{ color: colorAlpha("textSecondary", 0.9) }}
        >
          <p>{durationLabel}</p>
          <p>触发: {timingLabel}</p>
          <p>来源: {sourceLabel}</p>
          {typeof tag.stacks === "number" && tag.stacks > 1 ? (
            <p>层数: ×{tag.stacks}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
