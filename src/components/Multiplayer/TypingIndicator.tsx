import { useMemo } from "react";

import { cn } from "@/lib/utils";
import { colorAlpha } from "@/styles/tokens";

interface TypingIndicatorProps {
  /** 正在输入的玩家名（已过滤本地用户） */
  names: string[];
  /** 自定义样式 */
  className?: string;
}

function buildTypingText(names: string[]): string {
  if (names.length === 0) {
    return "";
  }

  if (names.length === 1) {
    return `${names[0]} 正在输入`;
  }

  if (names.length <= 3) {
    return `${names[0]}、${names[1]} 正在输入`;
  }

  return `${names[0]}、${names[1]} 等 ${names.length} 人正在输入`;
}

export function TypingIndicator({ names, className }: TypingIndicatorProps) {
  const text = useMemo(() => buildTypingText(names), [names]);

  if (!text) {
    return null;
  }

  return (
    <div
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 text-xs animate-fade-in",
        className
      )}
      style={{
        color: colorAlpha("primary", 0.85),
      }}
      aria-live="polite"
    >
      <span className="truncate">{text}</span>
      <span className="inline-flex gap-0.5" aria-hidden="true">
        <span
          className="w-1.5 h-1.5 rounded-full animate-typing-dot-1"
          style={{ background: colorAlpha("primary", 0.7) }}
        />
        <span
          className="w-1.5 h-1.5 rounded-full animate-typing-dot-2"
          style={{ background: colorAlpha("primary", 0.7) }}
        />
        <span
          className="w-1.5 h-1.5 rounded-full animate-typing-dot-3"
          style={{ background: colorAlpha("primary", 0.7) }}
        />
      </span>
    </div>
  );
}
