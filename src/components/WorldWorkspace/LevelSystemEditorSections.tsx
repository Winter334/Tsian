import { AlertTriangle, Plus, Trash2 } from "lucide-react";
import { useMemo, type ReactNode } from "react";

import { Button, Card, Input, Select, Toggle } from "@/components/ui";
import type { LevelSystemConfig } from "@/lib/world/types";
import { color, colorAlpha } from "@/styles/tokens";
import {
  getGrowthModeLabel,
  getGrowthModeSummary,
  getProgressVisibilityLabel,
  getResourceRecoveryLabel,
  getResourceRecoverySummary,
  getTriggerModeSummary,
  LEVEL_SYSTEM_TEMPLATES,
  type LevelSystemTemplateId,
} from "./level-system-templates";

const NUMERIC_LITERAL_REGEX = /^-?\d+(?:\.\d+)?$/;

export type SelectOption = { value: string; label: string };

type StringNumberEntry = { field: string; value: string };
type ThresholdTableEntry = NonNullable<
  NonNullable<LevelSystemConfig["progress"]>["thresholdTable"]
>[number];
type MilestoneGrowthEntry = NonNullable<
  NonNullable<LevelSystemConfig["autoGrowth"]>["milestoneGrowth"]
>[number];

interface LevelSystemTemplateCardProps {
  selectedTemplateId: LevelSystemTemplateId | "";
  descriptionText: string;
  canApply: boolean;
  onSelectTemplate: (value: LevelSystemTemplateId | "") => void;
  onApply: () => void;
}

export function LevelSystemTemplateCard({
  selectedTemplateId,
  descriptionText,
  canApply,
  onSelectTemplate,
  onApply,
}: LevelSystemTemplateCardProps) {
  return (
    <div
      className="rounded-xl border px-4 py-3"
      style={{
        borderColor: colorAlpha("border", 0.3),
        background: colorAlpha("bgCard", 0.22),
      }}
    >
      <div className="space-y-3">
        <SectionHeader
          title="应用预设模板"
          description="根据世界类型快速覆盖当前等级系统配置；复杂奖励包仍通过高级 JSON 细调。"
        />
        <EditorField label="模板选择">
          <Select
            value={selectedTemplateId}
            onValueChange={(nextValue) =>
              onSelectTemplate(nextValue as LevelSystemTemplateId | "")
            }
            options={[
              { value: "", label: "选择推荐模板" },
              ...LEVEL_SYSTEM_TEMPLATES.map((template) => ({
                value: template.id,
                label: template.name,
              })),
            ]}
          />
        </EditorField>
        <InlineHint>{descriptionText}</InlineHint>
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            disabled={!canApply}
            onClick={onApply}
          >
            应用预设模板
          </Button>
        </div>
      </div>
    </div>
  );
}

export function LevelSystemValidationPanel({
  warnings,
}: {
  warnings: string[];
}) {
  if (warnings.length === 0) {
    return null;
  }

  return (
    <Card variant="outlined" className="space-y-3 p-4">
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

interface LevelSystemPreviewPanelProps {
  growthMode: NonNullable<LevelSystemConfig["growthMode"]>;
  triggerModes: LevelSystemConfig["triggerModes"] | undefined;
  progressAttributeKey: string;
  progressVisibility: NonNullable<
    NonNullable<LevelSystemConfig["progress"]>["visibility"]
  >;
  progressPreviewLabel: string;
  resourceRecoveryMode: NonNullable<
    NonNullable<LevelSystemConfig["resourceRecovery"]>["mode"]
  >;
  resourcePreviewLabel: string;
  showAutoGrowth: boolean;
  autoGrowthPreviewItems: string[];
  showAllocation: boolean;
  allocationPreviewLabel: string;
  narrativePreviewItems: string[];
}

export function LevelSystemPreviewPanel({
  growthMode,
  triggerModes,
  progressAttributeKey,
  progressVisibility,
  progressPreviewLabel,
  resourceRecoveryMode,
  resourcePreviewLabel,
  showAutoGrowth,
  autoGrowthPreviewItems,
  showAllocation,
  allocationPreviewLabel,
  narrativePreviewItems,
}: LevelSystemPreviewPanelProps) {
  return (
    <Card variant="outlined" className="p-0">
      <details open className="rounded-xl">
        <summary
          className="cursor-pointer list-none px-4 py-4"
          style={{ color: color("textPrimary") }}
        >
          <SectionHeader
            title="配置预览"
            description="概览当前触发、成长、资源与叙事表现，便于快速确认该世界的升级体验走向。"
          />
        </summary>
        <div
          className="space-y-4 border-t px-4 py-4"
          style={{ borderColor: colorAlpha("border", 0.3) }}
        >
          <div className="grid gap-3 lg:grid-cols-2">
            <PreviewSection
              title="成长模式"
              description={getGrowthModeSummary(growthMode)}
            >
              <PreviewItem
                label="当前模式"
                value={getGrowthModeLabel(growthMode)}
              />
            </PreviewSection>
            <PreviewSection
              title="触发方式"
              description={getTriggerModeSummary(triggerModes)}
            >
              <PreviewItem
                label="触发组合"
                value={formatTriggerModes(triggerModes)}
              />
            </PreviewSection>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <PreviewSection
              title="进度与阈值"
              description={progressPreviewLabel}
            >
              <PreviewItem label="进度字段" value={progressAttributeKey} />
              <PreviewItem
                label="可见性"
                value={getProgressVisibilityLabel(progressVisibility)}
              />
            </PreviewSection>
            <PreviewSection
              title="资源刷新"
              description={getResourceRecoverySummary(resourceRecoveryMode)}
            >
              <PreviewItem
                label="恢复策略"
                value={getResourceRecoveryLabel(resourceRecoveryMode)}
              />
              <PreviewItem label="影响资源" value={resourcePreviewLabel} />
            </PreviewSection>
          </div>

          <PreviewSection
            title="每级自动成长"
            description={
              showAutoGrowth
                ? "升级时自动追加的基础属性变化预览。"
                : "当前成长模式不包含自动成长。"
            }
          >
            {showAutoGrowth ? (
              autoGrowthPreviewItems.length > 0 ? (
                <PreviewList items={autoGrowthPreviewItems} />
              ) : (
                <InlineHint>当前未配置每级固定成长。</InlineHint>
              )
            ) : (
              <InlineHint>当前模式下不启用自动成长。</InlineHint>
            )}
          </PreviewSection>

          {showAllocation ? (
            <PreviewSection
              title="分配点数规则"
              description="升级后可分配属性点的发放方式、目标范围与额外约束。"
            >
              <PreviewItem label="规则概览" value={allocationPreviewLabel} />
            </PreviewSection>
          ) : null}

          <PreviewSection
            title="叙事配置"
            description="升级如何进入 AI 叙事、确认流程与系统反馈。"
          >
            <PreviewList items={narrativePreviewItems} />
          </PreviewSection>
        </div>
      </details>
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
    <Card variant="outlined" className="p-0">
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

function PreviewSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div
      className="space-y-3 rounded-xl border px-4 py-3"
      style={{
        borderColor: colorAlpha("border", 0.3),
        background: colorAlpha("bgCard", 0.22),
      }}
    >
      <SectionHeader title={title} description={description} />
      {children}
    </div>
  );
}

function PreviewItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-2 text-xs">
      <span style={{ color: colorAlpha("textMuted", 0.76) }}>{label}</span>
      <span
        className="min-w-0 flex-1 text-right wrap-break-word"
        style={{ color: color("textPrimary") }}
      >
        {value}
      </span>
    </div>
  );
}

function PreviewList({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-1.5 pl-4 text-xs">
      {items.map((item, index) => (
        <li
          key={`preview-item-${index}`}
          style={{ color: color("textPrimary") }}
        >
          {item}
        </li>
      ))}
    </ul>
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

export function ThresholdTableEditor({
  entries,
  onChange,
}: {
  entries: ThresholdTableEntry[];
  onChange: (entries: ThresholdTableEntry[]) => void;
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
          title="阈值表"
          description="按等级维护升级参考进度阈值。level 表示目标等级，requiredProgress 表示参考累计进度。"
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            onChange([
              ...entries,
              {
                level: entries.length + 1,
                requiredProgress: 0,
              },
            ])
          }
        >
          <Plus className="mr-1 h-4 w-4" />
          添加阈值
        </Button>
      </div>

      {entries.length === 0 ? (
        <InlineHint>当前还没有阈值表项，可先补充等级与参考进度。</InlineHint>
      ) : (
        <div className="space-y-3">
          {entries.map((entry, index) => (
            <div
              key={`threshold-${index}`}
              className="grid gap-3 md:grid-cols-[8rem_minmax(0,1fr)_auto] [&>label]:min-w-0"
            >
              <EditorField label="等级">
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
              <EditorField label="所需进度">
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

function formatTriggerModes(
  triggerModes: LevelSystemConfig["triggerModes"] | undefined,
): string {
  const labels = (triggerModes ?? []).map((mode) =>
    mode === "narrative" ? "叙事触发" : "手动触发",
  );

  return labels.length > 0 ? labels.join(" / ") : "未启用";
}
