import { motion } from "framer-motion";
import { useMemo } from "react";

import type { CharacterTag } from "@/hooks/useCharacterTags";

import { SOURCE_LABEL_MAP, getTimingLabel } from "./status-labels";
import { getTagIcon } from "./tag-icon-map";

import { color, colorAlpha, glow } from "@/styles/tokens";

interface StatusTagCardProps {
  tag: CharacterTag;
}

const easeOut = [0.0, 0.0, 0.2, 1.0] as const;

const cardVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.25,
      ease: easeOut,
    },
  },
};

function getDurationLabel(duration?: number): string {
  if (typeof duration === "number") {
    return `剩余 ${duration} 回合`;
  }
  return "永久";
}

export function StatusTagCard({ tag }: StatusTagCardProps) {
  const Icon = useMemo(() => getTagIcon(tag.icon), [tag.icon]);
  const timingLabel = useMemo(() => getTimingLabel(tag.timing), [tag.timing]);
  const sourceLabel = useMemo(() => SOURCE_LABEL_MAP[tag.source], [tag.source]);
  const durationLabel = useMemo(
    () => getDurationLabel(tag.remainingDuration),
    [tag.remainingDuration],
  );

  return (
    <motion.article
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      className="rounded-lg p-3 space-y-2.5"
      style={{
        background: colorAlpha("bgElevated", 0.5),
        border: `1px solid ${colorAlpha("primary", 0.15)}`,
        boxShadow: glow("primary", "sm", 0.08),
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex items-center gap-2">
          <Icon
            className="w-5 h-5 shrink-0"
            style={{ color: color("primary") }}
            aria-hidden
          />

          <div className="min-w-0 flex items-center gap-1.5">
            <span
              className="text-sm font-medium truncate"
              style={{ color: color("textPrimary") }}
            >
              {tag.displayName}
            </span>
            {typeof tag.stacks === "number" && tag.stacks > 1 ? (
              <span
                className="text-[10px] leading-none px-1.5 py-1 rounded"
                style={{
                  background: colorAlpha("secondary", 0.16),
                  color: color("secondary"),
                  border: `1px solid ${colorAlpha("secondary", 0.3)}`,
                }}
              >
                ×{tag.stacks}
              </span>
            ) : null}
          </div>
        </div>

        <span
          className="text-xs shrink-0"
          style={{ color: colorAlpha("textMuted", 0.9) }}
        >
          {durationLabel}
        </span>
      </div>

      <div
        className="h-px"
        style={{
          background: colorAlpha("primary", 0.12),
        }}
      />

      <p
        className="text-xs leading-relaxed"
        style={{ color: colorAlpha("textMuted", 0.85) }}
      >
        {tag.effectDescription || "暂无描述"}
      </p>

      <div
        className="h-px"
        style={{
          background: colorAlpha("primary", 0.12),
        }}
      />

      <div
        className="text-xs flex items-center gap-1.5"
        style={{ color: colorAlpha("textSecondary", 0.7) }}
      >
        <span>触发: {timingLabel}</span>
        <span aria-hidden>│</span>
        <span>来源: {sourceLabel}</span>
      </div>
    </motion.article>
  );
}
