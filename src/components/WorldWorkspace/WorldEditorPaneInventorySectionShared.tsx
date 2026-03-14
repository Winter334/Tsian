import { WandSparkles } from "lucide-react";
import type { ReactNode } from "react";

import { Card as BaseCard, Button, Panel, Toggle } from "@/components/ui";
import { cn } from "@/lib/utils";
import { color, colorAlpha } from "@/styles/tokens";

const EDITOR_CARD_HOVER_STYLE = {
  scale: 1,
  y: 0,
  borderColor: colorAlpha("primary", 0.52),
} as const;

type WorkspaceEditorCardProps = {
  children: ReactNode;
  className?: string;
  variant?: "default" | "elevated" | "outlined";
};

export function WorldEditorInventoryCard({
  children,
  className,
  variant = "outlined",
}: WorkspaceEditorCardProps) {
  return (
    <BaseCard
      variant={variant}
      whileHover={EDITOR_CARD_HOVER_STYLE}
      className={className}
    >
      {children}
    </BaseCard>
  );
}

export function WorldEditorDimensionMetaBadge({
  label,
  value,
  accent = false,
  mono = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
  mono?: boolean;
}) {
  return (
    <div
      className="inline-flex max-w-full flex-wrap items-center gap-1 rounded-full border px-2.5 py-1 text-[11px]"
      style={{
        borderColor: colorAlpha(
          accent ? "primary" : "border",
          accent ? 0.38 : 0.3,
        ),
        background: colorAlpha(
          accent ? "primary" : "bgCard",
          accent ? 0.12 : 0.32,
        ),
      }}
    >
      <span style={{ color: colorAlpha("textMuted", 0.72) }}>{label}</span>
      <span
        className={cn(
          "max-w-full font-medium wrap-break-word",
          mono && "font-mono break-all",
        )}
        style={{ color: accent ? color("primary") : color("textPrimary") }}
      >
        {value}
      </span>
    </div>
  );
}

export function WorldEditorEmptySectionHint({ message }: { message: string }) {
  return (
    <WorldEditorInventoryCard variant="outlined" className="p-4">
      <p className="text-sm" style={{ color: color("textMuted") }}>
        {message}
      </p>
    </WorldEditorInventoryCard>
  );
}

export function WorldEditorFormSection({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Panel variant="outlined" className="p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3
            className="text-sm font-semibold"
            style={{ color: color("textPrimary") }}
          >
            {title}
          </h3>
          <p
            className="mt-1 text-xs"
            style={{ color: colorAlpha("textMuted", 0.72) }}
          >
            {description}
          </p>
        </div>
        {action}
      </div>
      <div className="mt-4 space-y-4">{children}</div>
    </Panel>
  );
}

export function WorldEditorField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span
        className="text-xs font-medium"
        style={{ color: color("textSecondary") }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

export function WorldEditorToggleSetting({
  title,
  description,
  checked,
  onCheckedChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div
      className="flex items-start justify-between gap-3 rounded-xl border px-4 py-3"
      style={{
        borderColor: colorAlpha("border", 0.3),
        background: colorAlpha("bgCard", 0.22),
      }}
    >
      <div className="min-w-0">
        <p
          className="text-sm font-medium"
          style={{ color: color("textPrimary") }}
        >
          {title}
        </p>
        <p
          className="mt-1 text-xs"
          style={{ color: colorAlpha("textMuted", 0.72) }}
        >
          {description}
        </p>
      </div>
      <Toggle checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

export function WorldEditorSectionRulesEditorButton({
  active,
  title,
  onOpen,
}: {
  active: boolean;
  title: string;
  onOpen: () => void;
}) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onOpen}
      className="gap-1.5"
      title={title}
      style={
        active
          ? {
              color: color("primary"),
              background: colorAlpha("primary", 0.12),
              borderColor: colorAlpha("primary", 0.42),
            }
          : undefined
      }
    >
      <WandSparkles className="h-4 w-4" />
      高级编辑当前分区 JSON
    </Button>
  );
}
