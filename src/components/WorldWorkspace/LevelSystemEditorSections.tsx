import { AlertTriangle, Plus, Trash2 } from "lucide-react";
import { useMemo, type ReactNode } from "react";

import { Button, Card, Input, Select, Toggle } from "@/components/ui";
import type { LevelSystemConfig } from "@/lib/world/types";
import { color, colorAlpha } from "@/styles/tokens";

const NUMERIC_LITERAL_REGEX = /^-?\d+(?:\.\d+)?$/;
const EDITOR_CARD_HOVER_STYLE = {
  scale: 1,
  y: 0,
  borderColor: colorAlpha("primary", 0.52),
} as const;

export type SelectOption = { value: string; label: string };

type StringNumberEntry = { field: string; value: string };
type LevelProgressEntry = NonNullable<
  NonNullable<LevelSystemConfig["progress"]>["levels"]
>[number];
type MilestoneGrowthEntry = NonNullable<
  NonNullable<LevelSystemConfig["autoGrowth"]>["milestoneGrowth"]
>[number];

export function LevelSystemValidationPanel({
  warnings,
}: {
  warnings: string[];
}) {
  if (warnings.length === 0) {
    return null;
  }

  return (
    <Card
      variant="outlined"
      whileHover={EDITOR_CARD_HOVER_STYLE}
      className="space-y-3 p-4"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5" style={{ color: color("warning") }}>
          <AlertTriangle className="h-4 w-4" />
        </span>
        <div>
          <p
            className="text-sm font-semibold"
            style={{ color: color("textPrimary") }}
          >
            配置校验提醒
          </p>
          <p
            className="mt-1 text-xs"
            style={{ color: colorAlpha("textMuted", 0.74) }}
          >
            以下提示不会阻止保存，但建议在发布世界前完成检查，避免升级逻辑在运行时出现偏差。
          </p>
        </div>
      </div>
      <div
        className="rounded-xl border px-4 py-3"
        style={{
          borderColor: colorAlpha("warning", 0.3),
          background: colorAlpha("warning", 0.08),
        }}
      >
        <ul className="list-disc space-y-1.5 pl-5 text-xs">
          {warnings.map((warning, index) => (
            <li
              key={`level-system-warning-${index}`}
              style={{ color: color("warning") }}
            >
              {warning}
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}

export function DetailsCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Card
      variant="outlined"
      whileHover={EDITOR_CARD_HOVER_STYLE}
      className="p-0"
    >
      <details open className="rounded-xl">
        <summary
          className="cursor-pointer list-none px-4 py-4"
          style={{ color: color("textPrimary") }}
        >
          <SectionHeader title={title} description={description} />
        </summary>
        <div
          className="space-y-4 border-t px-4 py-4"
          style={{ borderColor: colorAlpha("border", 0.3) }}
        >
          {children}
        </div>
      </details>
    </Card>
  );
}

export function SectionHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div>
      <p
        className="text-sm font-semibold"
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
  );
}

export function EditorField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
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
      {hint ? <InlineHint>{hint}</InlineHint> : null}
    </label>
  );
}

export function InlineHint({ children }: { children: ReactNode }) {
  return (
    <p className="text-xs" style={{ color: colorAlpha("textMuted", 0.72) }}>
      {children}
    </p>
  );
}

export function ToggleSetting({
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

export function StatusBadge({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px]"
      style={{
        borderColor: colorAlpha("border", 0.3),
        background: colorAlpha("bgCard", 0.24),
      }}
    >
      <span style={{ color: colorAlpha("textMuted", 0.72) }}>{label}</span>
      <span style={{ color: color("textPrimary") }}>{value}</span>
    </span>
  );
}

export function TagToggleGroup({
  options,
  selectedValues,
  onToggle,
  emptyMessage,
}: {
  options: SelectOption[];
  selectedValues: string[];
  onToggle: (nextValues: string[]) => void;
  emptyMessage?: string;
}) {
  if (options.length === 0) {
    return emptyMessage ? <InlineHint>{emptyMessage}</InlineHint> : null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const selected = selectedValues.includes(option.value);
        return (
          <button
            key={option.value}
            type="button"
            className="rounded-full border px-3 py-1.5 text-xs transition-all"
            style={{
              color: selected ? color("primary") : color("textSecondary"),
              background: selected
                ? colorAlpha("primary", 0.12)
                : "transparent",
              borderColor: colorAlpha(
                selected ? "primary" : "border",
                selected ? 0.45 : 0.3,
              ),
            }}
            onClick={() => {
              const nextValues = selected
                ? selectedValues.filter((item) => item !== option.value)
                : [...selectedValues, option.value];
              onToggle(nextValues);
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

interface StringNumberRecordEditorProps {
  title: string;
  description: string;
  addLabel: string;
  emptyMessage: string;
  fieldOptions: SelectOption[];
  value: Record<string, number | string> | undefined;
  onChange: (value: Record<string, number | string> | undefined) => void;
}

export function StringNumberRecordEditor({
  title,
  description,
  addLabel,
  emptyMessage,
  fieldOptions,
  value,
  onChange,
}: StringNumberRecordEditorProps) {
  const entries = useMemo(() => buildStringNumberEntries(value), [value]);
  const mergedFieldOptions = useMemo(
    () =>
      getMergedOptions(
        fieldOptions,
        entries.map((entry) => entry.field),
      ),
    [entries, fieldOptions],
  );

  const commitEntries = (nextEntries: StringNumberEntry[]) => {
    onChange(buildStringNumberRecord(nextEntries));
  };

  return (
    <div
      className="space-y-3 rounded-xl border px-4 py-3"
      style={{
        borderColor: colorAlpha("border", 0.3),
        background: colorAlpha("bgCard", 0.22),
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <SectionHeader title={title} description={description} />
        <Button
          variant="outline"
          size="sm"
          disabled={mergedFieldOptions.length === 0}
          onClick={() =>
            commitEntries([
              ...entries,
              {
                field: mergedFieldOptions[0]?.value ?? "",
                value: "1",
              },
            ])
          }
        >
          <Plus className="mr-1 h-4 w-4" />
          {addLabel}
        </Button>
      </div>

      {entries.length === 0 ? (
        <InlineHint>{emptyMessage}</InlineHint>
      ) : (
        <div className="space-y-3">
          {entries.map((entry, index) => (
            <div
              key={`${entry.field || "field"}-${index}`}
              className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] [&>label]:min-w-0"
            >
              <EditorField label="目标属性">
                <Select
                  value={entry.field}
                  onValueChange={(nextValue) =>
                    commitEntries(
                      entries.map((item, itemIndex) =>
                        itemIndex === index
                          ? { ...item, field: nextValue }
                          : item,
                      ),
                    )
                  }
                  options={[
                    { value: "", label: "选择属性" },
                    ...mergedFieldOptions,
                  ]}
                />
              </EditorField>
              <EditorField label="成长值 / 公式">
                <Input
                  value={entry.value}
                  onChange={(event) =>
                    commitEntries(
                      entries.map((item, itemIndex) =>
                        itemIndex === index
                          ? { ...item, value: event.target.value }
                          : item,
                      ),
                    )
                  }
                  placeholder="1 或 floor(level / 5)"
                />
              </EditorField>
              <div className="flex items-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    commitEntries(
                      entries.filter((_, itemIndex) => itemIndex !== index),
                    )
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function LevelProgressEditor({
  entries,
  onChange,
}: {
  entries: LevelProgressEntry[];
  onChange: (entries: LevelProgressEntry[]) => void;
}) {
  return (
    <div
      className="space-y-3 rounded-xl border px-4 py-3"
      style={{
        borderColor: colorAlpha("border", 0.3),
        background: colorAlpha("bgCard", 0.22),
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <SectionHeader
          title="等级进度"
          description="按等级顺序维护升级数据。每项同时定义等级值、等级名称，以及达到该等级所需的累计进度。"
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            onChange([
              ...entries,
              {
                level:
                  entries.length > 0
                    ? Math.max(...entries.map((entry) => entry.level)) + 1
                    : 1,
                name: "新等级",
                requiredProgress:
                  entries.length > 0
                    ? Math.max(
                        0,
                        entries[entries.length - 1]?.requiredProgress ?? 0,
                      )
                    : 0,
              },
            ])
          }
        >
          <Plus className="mr-1 h-4 w-4" />
          添加等级
        </Button>
      </div>

      {entries.length === 0 ? (
        <InlineHint>
          当前还没有等级进度定义，可先从 1 级开始补充等级名与所需进度。
        </InlineHint>
      ) : (
        <div className="space-y-3">
          {entries.map((entry, index) => (
            <div
              key={`level-progress-${index}`}
              className="grid gap-3 md:grid-cols-[7rem_minmax(0,1.1fr)_minmax(0,1fr)_auto] [&>label]:min-w-0"
            >
              <EditorField label="等级值">
                <Input
                  type="number"
                  value={entry.level}
                  onChange={(event) =>
                    onChange(
                      entries.map((item, itemIndex) =>
                        itemIndex === index
                          ? {
                              ...item,
                              level: Math.max(
                                1,
                                Number(event.target.value) || 1,
                              ),
                            }
                          : item,
                      ),
                    )
                  }
                />
              </EditorField>
              <EditorField label="等级名称">
                <Input
                  value={entry.name}
                  onChange={(event) =>
                    onChange(
                      entries.map((item, itemIndex) =>
                        itemIndex === index
                          ? {
                              ...item,
                              name: event.target.value,
                            }
                          : item,
                      ),
                    )
                  }
                  placeholder="如：见习者 / 筑基 / 青铜"
                />
              </EditorField>
              <EditorField label="达到该等级所需进度">
                <Input
                  type="number"
                  value={entry.requiredProgress}
                  onChange={(event) =>
                    onChange(
                      entries.map((item, itemIndex) =>
                        itemIndex === index
                          ? {
                              ...item,
                              requiredProgress: Math.max(
                                0,
                                Number(event.target.value) || 0,
                              ),
                            }
                          : item,
                      ),
                    )
                  }
                />
              </EditorField>
              <div className="flex items-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    onChange(
                      entries.filter((_, itemIndex) => itemIndex !== index),
                    )
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function MilestoneGrowthEditor({
  milestones,
  fieldOptions,
  onChange,
}: {
  milestones: MilestoneGrowthEntry[];
  fieldOptions: SelectOption[];
  onChange: (entries: MilestoneGrowthEntry[]) => void;
}) {
  return (
    <div
      className="space-y-3 rounded-xl border px-4 py-3"
      style={{
        borderColor: colorAlpha("border", 0.3),
        background: colorAlpha("bgCard", 0.22),
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <SectionHeader
          title="关键等级成长"
          description="为指定等级叠加额外成长，适合里程碑突破、转职或阶段性强化。"
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            onChange([
              ...milestones,
              {
                level: milestones.length + 1,
                attributes: {},
              },
            ])
          }
        >
          <Plus className="mr-1 h-4 w-4" />
          添加里程碑
        </Button>
      </div>

      {milestones.length === 0 ? (
        <InlineHint>
          当前没有关键等级成长，可在需要时为特定等级补充额外奖励。
        </InlineHint>
      ) : (
        <div className="space-y-3">
          {milestones.map((milestone, index) => (
            <Card
              key={`milestone-${index}`}
              variant="outlined"
              className="space-y-4 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <SectionHeader
                  title={`里程碑 ${index + 1}`}
                  description="定义该等级额外获得的属性成长。"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    onChange(
                      milestones.filter((_, itemIndex) => itemIndex !== index),
                    )
                  }
                >
                  <Trash2 className="mr-1 h-4 w-4" />
                  删除里程碑
                </Button>
              </div>

              <EditorField label="触发等级">
                <Input
                  type="number"
                  value={milestone.level}
                  onChange={(event) =>
                    onChange(
                      milestones.map((item, itemIndex) =>
                        itemIndex === index
                          ? {
                              ...item,
                              level: Math.max(
                                1,
                                Number(event.target.value) || 1,
                              ),
                            }
                          : item,
                      ),
                    )
                  }
                />
              </EditorField>

              <StringNumberRecordEditor
                title="额外成长"
                description="支持配置多个属性的额外成长。"
                addLabel="添加属性成长"
                emptyMessage="当前没有额外成长，可继续添加属性项。"
                fieldOptions={fieldOptions}
                value={milestone.attributes}
                onChange={(attributes) =>
                  onChange(
                    milestones.map((item, itemIndex) =>
                      itemIndex === index
                        ? {
                            ...item,
                            attributes: attributes ?? {},
                          }
                        : item,
                    ),
                  )
                }
              />
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function buildStringNumberEntries(
  value: Record<string, number | string> | undefined,
): StringNumberEntry[] {
  return Object.entries(value ?? {}).map(([field, entry]) => ({
    field,
    value: String(entry),
  }));
}

function buildStringNumberRecord(
  entries: StringNumberEntry[],
): Record<string, number | string> | undefined {
  const result: Record<string, number | string> = {};

  for (const entry of entries) {
    const field = entry.field.trim();
    const value = parseStringNumberInput(entry.value);
    if (!field || value === undefined) {
      continue;
    }

    result[field] = value;
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

function parseStringNumberInput(value: string): number | string | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  return NUMERIC_LITERAL_REGEX.test(trimmed) ? Number(trimmed) : trimmed;
}

function getMergedOptions(
  options: SelectOption[],
  currentValues: string[],
): SelectOption[] {
  const result = [...options];
  const knownValues = new Set(options.map((option) => option.value));

  for (const rawValue of currentValues) {
    const value = rawValue.trim();
    if (!value || knownValues.has(value)) {
      continue;
    }

    knownValues.add(value);
    result.push({
      value,
      label: `${value}（待确认字段）`,
    });
  }

  return result;
}
