import { useMemo } from "react";

import type { CharacterTag } from "@/hooks/useCharacterTags";
import { cn } from "@/lib/utils";

import { getTagIcon } from "./tag-icon-map";

import { color, colorAlpha, glow } from "@/styles/tokens";

interface StatusTagBadgeProps {
  tag: CharacterTag;
  className?: string;
}

function toCompactName(name: string): string {
  return Array.from(name).slice(0, 4).join("");
}

function toDurationText(duration: number): string {
  return `(${duration})`;
}

export function StatusTagBadge({ tag, className }: StatusTagBadgeProps) {
  const Icon = useMemo(() => getTagIcon(tag.icon), [tag.icon]);
  const compactName = useMemo(
    () => toCompactName(tag.displayName),
    [tag.displayName],
  );

  return (
    <div
      className={cn(
        "inline-flex h-6 items-center gap-1 rounded-md px-1.5 text-xs",
        "transition-all duration-150 cursor-pointer select-none",
        className,
      )}
      style={{
        background: colorAlpha("bgElevated", 0.5),
        border: `1px solid ${colorAlpha("primary", 0.2)}`,
        color: color("primary"),
        boxShadow: glow("primary", "sm", 0.1),
      }}
      title={tag.displayName}
    >
      <span className="inline-flex h-3 w-3 items-center justify-center shrink-0">
        <Icon className="h-3 w-3" />
      </span>

      <span className="max-w-10 truncate text-xs leading-none">
        {compactName}
      </span>

      {typeof tag.stacks === "number" && tag.stacks > 1 ? (
        <span
          className="shrink-0 text-[10px] leading-none"
          style={{ color: colorAlpha("primary", 0.9) }}
        >
          ×{tag.stacks}
        </span>
      ) : null}

      {typeof tag.remainingDuration === "number" ? (
        <span
          className="inline-flex min-w-4 items-center justify-center rounded px-1 text-[10px] font-semibold leading-none shrink-0"
          style={{
            background: colorAlpha("primary", 0.16),
            border: `1px solid ${colorAlpha("primary", 0.28)}`,
            color: color("primary"),
          }}
        >
          {toDurationText(tag.remainingDuration)}
        </span>
      ) : null}
    </div>
  );
}
