/**
 * 角色描述面板组件
 *
 * 将外貌/性格/背景故事分区清晰展示。
 * 三者都为空时显示统一空态文案。
 */

import { BookOpen, Eye, Heart, ScrollText } from "lucide-react";

import { color, colorAlpha } from "@/styles/tokens";

// ── 类型 ──

interface CharacterDescriptionPanelProps {
  appearance?: string;
  personality?: string;
  description?: string;
}

// ── 子组件：描述区块 ──

function DescriptionBlock({
  icon,
  title,
  content,
}: {
  icon: React.ReactNode;
  title: string;
  content: string;
}) {
  return (
    <div
      className="rounded-lg px-3 py-2.5"
      style={{
        background: colorAlpha("primary", 0.03),
        border: `1px solid ${colorAlpha("primary", 0.08)}`,
      }}
    >
      <div className="flex items-center gap-1.5 mb-1.5">
        <span style={{ color: color("primary") }}>{icon}</span>
        <span
          className="text-xs font-semibold uppercase tracking-wide"
          style={{ color: color("primary") }}
        >
          {title}
        </span>
      </div>
      <p
        className="text-sm leading-relaxed whitespace-pre-wrap"
        style={{ color: color("textSecondary") }}
      >
        {content}
      </p>
    </div>
  );
}

// ── 主组件 ──

export function CharacterDescriptionPanel({
  appearance,
  personality,
  description,
}: CharacterDescriptionPanelProps) {
  const hasAny = Boolean(appearance || personality || description);

  if (!hasAny) {
    return (
      <div className="flex flex-col items-center justify-center py-8">
        <BookOpen
          className="w-8 h-8 mb-2"
          style={{ color: colorAlpha("textMuted", 0.3) }}
        />
        <p className="text-sm" style={{ color: color("textMuted") }}>
          暂无角色描述
        </p>
        <p
          className="text-xs mt-1"
          style={{ color: colorAlpha("textMuted", 0.5) }}
        >
          外貌、性格和背景故事将在此处展示
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* 标题 */}
      <div
        className="flex items-center gap-2 mb-2"
        style={{
          borderBottom: `1px solid ${colorAlpha("primary", 0.15)}`,
          paddingBottom: "0.5rem",
        }}
      >
        <span style={{ color: color("primary") }}>
          <BookOpen className="w-4 h-4" />
        </span>
        <h3
          className="text-sm font-semibold uppercase tracking-wider"
          style={{ color: color("primary") }}
        >
          描述
        </h3>
      </div>

      {/* 外貌 */}
      {appearance && (
        <DescriptionBlock
          icon={<Eye className="w-3.5 h-3.5" />}
          title="外貌"
          content={appearance}
        />
      )}

      {/* 性格 */}
      {personality && (
        <DescriptionBlock
          icon={<Heart className="w-3.5 h-3.5" />}
          title="性格"
          content={personality}
        />
      )}

      {/* 背景故事 */}
      {description && (
        <DescriptionBlock
          icon={<ScrollText className="w-3.5 h-3.5" />}
          title="背景故事"
          content={description}
        />
      )}
    </div>
  );
}
