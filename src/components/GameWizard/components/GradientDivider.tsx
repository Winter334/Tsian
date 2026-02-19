import { cn } from "@/lib/utils";
import { colorAlpha } from "@/styles/tokens";

interface GradientDividerProps {
  className?: string;
}

/**
 * 装饰性渐变分隔线
 * 从透明渐变到 primary/secondary 再回到透明
 */
export function GradientDivider({ className }: GradientDividerProps) {
  return (
    <div
      className={cn("h-px w-full", className)}
      style={{
        background: `linear-gradient(90deg,
          transparent,
          ${colorAlpha("primary", 0.3)},
          ${colorAlpha("secondary", 0.3)},
          transparent
        )`,
      }}
    />
  );
}
