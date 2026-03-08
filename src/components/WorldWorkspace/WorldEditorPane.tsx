/**
 * 世界编辑面板
 */

import {
  AlertTriangle,
  CheckCircle2,
  Plus,
  Trash2,
  WandSparkles,
} from "lucide-react";
import { useMemo } from "react";

import {
  Button,
  Card,
  Input,
  Panel,
  ScrollArea,
  Select,
  Textarea,
} from "@/components/ui";
import type {
  CharacterDimension,
  DimensionOption,
  PointBuyRules,
  PrimaryAttributeConfig,
  TalentConfig,
  World,
  WorldNarrativeSeed,
} from "@/lib/world/types";
import { color, colorAlpha } from "@/styles/tokens";

const TALENT_CATEGORY_OPTIONS = [
  { value: "combat", label: "战斗" },
  { value: "magic", label: "魔法" },
  { value: "survival", label: "生存" },
  { value: "social", label: "社交" },
  { value: "misc", label: "其他" },
] as const;

interface WorldEditorPaneProps {
  world: World | null;
  validationMessages: string[];
  rawRulesEditorOpen: boolean;
  rawRulesText: string;
  rawRulesError: string | null;
  onUpdateMeta: (
    updates: Partial<
      Pick<
        World["meta"],
        "name" | "description" | "author" | "version" | "source"
      >
    >,
  ) => void;
  onUpdateNarrative: (updates: Partial<WorldNarrativeSeed>) => void;
  onUpdatePrimaryAttribute: (
    index: number,
    updates: Partial<PrimaryAttributeConfig>,
  ) => void;
  onAddPrimaryAttribute: () => void;
  onRemovePrimaryAttribute: (index: number) => void;
  onUpdatePointBuyRules: (updates: Partial<PointBuyRules>) => void;
  onUpdateDimension: (
    index: number,
    updates: Partial<CharacterDimension>,
  ) => void;
  onAddDimension: () => void;
  onRemoveDimension: (index: number) => void;
  onUpdateDimensionOption: (
    dimensionIndex: number,
    optionIndex: number,
    updates: Partial<DimensionOption>,
  ) => void;
  onAddDimensionOption: (dimensionIndex: number) => void;
  onRemoveDimensionOption: (
    dimensionIndex: number,
    optionIndex: number,
  ) => void;
  onUpdateTalent: (index: number, updates: Partial<TalentConfig>) => void;
  onAddTalent: () => void;
  onRemoveTalent: (index: number) => void;
  onSetRawRulesText: (value: string) => void;
  onApplyRawRulesText: () => void;
}

export function WorldEditorPane({
  world,
  validationMessages,
  rawRulesEditorOpen,
  rawRulesText,
  rawRulesError,
  onUpdateMeta,
  onUpdateNarrative,
  onUpdatePrimaryAttribute,
  onAddPrimaryAttribute,
  onRemovePrimaryAttribute,
  onUpdatePointBuyRules,
  onUpdateDimension,
  onAddDimension,
  onRemoveDimension,
  onUpdateDimensionOption,
  onAddDimensionOption,
  onRemoveDimensionOption,
  onUpdateTalent,
  onAddTalent,
  onRemoveTalent,
  onSetRawRulesText,
  onApplyRawRulesText,
}: WorldEditorPaneProps) {
  const primaryAttributes = world ? world.rules.primaryAttributes : [];
  const dimensions = world ? (world.rules.dimensions ?? []) : [];
  const talents = world ? (world.rules.talents ?? []) : [];

  const allocatableAttributeOptions = useMemo(
    () =>
      (world?.rules.primaryAttributes ?? []).map((attribute) => ({
        value: attribute.key,
        label: `${attribute.label} (${attribute.key})`,
      })),
    [world],
  );

  if (!world) {
    return (
      <div className="flex h-full items-center justify-center text-center">
        <div>
          <WandSparkles
            className="mx-auto mb-4 h-10 w-10"
            style={{ color: colorAlpha("primary", 0.7) }}
          />
          <p className="text-sm" style={{ color: color("textPrimary") }}>
            从左侧选择一个世界开始编辑
          </p>
          <p
            className="mt-1 text-xs"
            style={{ color: colorAlpha("textMuted", 0.7) }}
          >
            工作台只编辑作者态 [`World`](src/lib/world/types.ts:253)
          </p>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full px-4 py-4 sm:px-5">
      <div className="space-y-5">
        <ValidationPanel messages={validationMessages} />

        <FormSection
          title="基础信息"
          description="仅编辑作者态 meta 字段，不接运行时 world 快照。"
        >
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="世界名称">
              <Input
                value={world.meta.name}
                onChange={(event) => onUpdateMeta({ name: event.target.value })}
                placeholder="输入世界名称"
              />
            </Field>
            <Field label="版本">
              <Input
                value={world.meta.version}
                onChange={(event) =>
                  onUpdateMeta({ version: event.target.value })
                }
                placeholder="1.0.0"
              />
            </Field>
            <Field label="作者">
              <Input
                value={world.meta.author ?? ""}
                onChange={(event) =>
                  onUpdateMeta({ author: event.target.value })
                }
                placeholder="作者名"
              />
            </Field>
            <Field label="来源类型">
              <Select
                value={world.meta.source}
                onValueChange={(value) =>
                  onUpdateMeta({ source: value === "lyra" ? "lyra" : "custom" })
                }
                options={[
                  { value: "custom", label: "自定义" },
                  { value: "lyra", label: "内置" },
                ]}
              />
            </Field>
          </div>

          <Field label="世界描述">
            <Textarea
              value={world.meta.description ?? ""}
              onChange={(event) =>
                onUpdateMeta({ description: event.target.value })
              }
              placeholder="概述世界观、规则风格与适用玩法"
              className="min-h-32"
            />
          </Field>

          <div className="grid gap-3 md:grid-cols-2">
            <ReadonlyMeta
              label="创建时间"
              value={formatTimestamp(world.meta.createdAt)}
            />
            <ReadonlyMeta
              label="更新时间"
              value={formatTimestamp(world.meta.updatedAt)}
            />
          </div>
        </FormSection>

        <FormSection
          title="叙事启动"
          description="仅编辑作者态 narrative.script / narrative.opening，不接运行时注入链路。"
        >
          <Field label="剧本（script）">
            <Textarea
              value={world.narrative?.script ?? ""}
              onChange={(event) =>
                onUpdateNarrative({ script: event.target.value })
              }
              placeholder="记录这一轮冒险的剧情方向、核心冲突和作者意图"
              className="min-h-40"
            />
          </Field>
          <Field label="开幕语（opening）">
            <Textarea
              value={world.narrative?.opening ?? ""}
              onChange={(event) =>
                onUpdateNarrative({ opening: event.target.value })
              }
              placeholder="玩家首次进入聊天时看到的首屏文字"
              className="min-h-32"
            />
          </Field>
        </FormSection>

        <FormSection
          title="规则配置 · 主要属性与点数分配"
          description="覆盖角色创建最关键的属性与 point buy 规则。"
          action={
            <Button variant="outline" size="sm" onClick={onAddPrimaryAttribute}>
              <Plus className="mr-1 h-4 w-4" />
              添加属性
            </Button>
          }
        >
          <div className="space-y-3">
            {primaryAttributes.map((attribute, index) => (
              <AttributeCard
                key={`${attribute.key}-${index}`}
                attribute={attribute}
                onChange={(updates) => onUpdatePrimaryAttribute(index, updates)}
                onRemove={() => onRemovePrimaryAttribute(index)}
              />
            ))}
          </div>

          <PointBuyPanel
            value={world.rules.pointBuyRules}
            allocatableOptions={allocatableAttributeOptions}
            onChange={onUpdatePointBuyRules}
          />
        </FormSection>

        <FormSection
          title="规则配置 · 角色创建维度"
          description="控制创建向导中的维度步骤，如种族、背景、阵营。"
          action={
            <Button variant="outline" size="sm" onClick={onAddDimension}>
              <Plus className="mr-1 h-4 w-4" />
              添加维度
            </Button>
          }
        >
          <div className="space-y-4">
            {dimensions.map((dimension, dimensionIndex) => (
              <DimensionCard
                key={`${dimension.id}-${dimensionIndex}`}
                dimension={dimension}
                talentOptions={talents}
                attributeOptions={primaryAttributes}
                onChange={(updates) =>
                  onUpdateDimension(dimensionIndex, updates)
                }
                onRemove={() => onRemoveDimension(dimensionIndex)}
                onAddOption={() => onAddDimensionOption(dimensionIndex)}
                onUpdateOption={(optionIndex, updates) =>
                  onUpdateDimensionOption(dimensionIndex, optionIndex, updates)
                }
                onRemoveOption={(optionIndex) =>
                  onRemoveDimensionOption(dimensionIndex, optionIndex)
                }
              />
            ))}
          </div>
        </FormSection>

        <FormSection
          title="规则配置 · 天赋"
          description="维护角色创建可选天赋，复杂 modifier 继续通过原始规则编辑兜底。"
          action={
            <Button variant="outline" size="sm" onClick={onAddTalent}>
              <Plus className="mr-1 h-4 w-4" />
              添加天赋
            </Button>
          }
        >
          <div className="space-y-3">
            {talents.map((talent, index) => (
              <TalentCardEditor
                key={`${talent.id}-${index}`}
                talent={talent}
                onChange={(updates) => onUpdateTalent(index, updates)}
                onRemove={() => onRemoveTalent(index)}
              />
            ))}
          </div>
        </FormSection>

        {rawRulesEditorOpen && (
          <FormSection
            title="原始规则编辑"
            description="适用于当前版本尚未结构化的复杂规则块。保存前会做基础 schema 校验。"
            action={
              <Button variant="outline" size="sm" onClick={onApplyRawRulesText}>
                应用 JSON
              </Button>
            }
          >
            <Textarea
              value={rawRulesText}
              onChange={(event) => onSetRawRulesText(event.target.value)}
              className="min-h-115 font-mono text-sm"
              spellCheck={false}
            />
            {rawRulesError ? (
              <p className="text-xs" style={{ color: color("error") }}>
                {rawRulesError}
              </p>
            ) : (
              <p
                className="text-xs"
                style={{ color: colorAlpha("textMuted", 0.72) }}
              >
                仅对 [`WorldConfig`](src/lib/world/types.ts:268)
                做基础结构校验；高级规则字段请自行确认。
              </p>
            )}
          </FormSection>
        )}
      </div>
    </ScrollArea>
  );
}

function formatTimestamp(timestamp: number): string {
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return "未记录";
  }

  return new Date(timestamp).toLocaleString("zh-CN", { hour12: false });
}

function ValidationPanel({ messages }: { messages: string[] }) {
  if (messages.length === 0) {
    return (
      <Panel variant="outlined" className="p-3">
        <div className="flex items-start gap-2">
          <CheckCircle2
            className="mt-0.5 h-4 w-4 shrink-0"
            style={{ color: color("success") }}
          />
          <div>
            <p
              className="text-sm font-medium"
              style={{ color: color("textPrimary") }}
            >
              当前结构检查通过
            </p>
            <p
              className="mt-1 text-xs"
              style={{ color: colorAlpha("textMuted", 0.72) }}
            >
              未发现阻塞当前工作包范围的明显配置缺口。
            </p>
          </div>
        </div>
      </Panel>
    );
  }

  return (
    <Panel variant="outlined" className="p-3">
      <div className="flex items-start gap-2">
        <AlertTriangle
          className="mt-0.5 h-4 w-4 shrink-0"
          style={{ color: color("warning") }}
        />
        <div className="min-w-0">
          <p
            className="text-sm font-medium"
            style={{ color: color("textPrimary") }}
          >
            当前草稿存在提示项
          </p>
          <ul
            className="mt-2 list-disc space-y-1 pl-4 text-xs"
            style={{ color: colorAlpha("textMuted", 0.78) }}
          >
            {messages.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </div>
      </div>
    </Panel>
  );
}

function FormSection({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
  children: React.ReactNode;
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

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
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

function ReadonlyMeta({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="rounded-lg border px-3 py-3"
      style={{
        borderColor: colorAlpha("border", 0.35),
        background: colorAlpha("bgCard", 0.32),
      }}
    >
      <p className="text-xs" style={{ color: colorAlpha("textMuted", 0.7) }}>
        {label}
      </p>
      <p className="mt-1 text-sm" style={{ color: color("textPrimary") }}>
        {value}
      </p>
    </div>
  );
}

function AttributeCard({
  attribute,
  onChange,
  onRemove,
}: {
  attribute: PrimaryAttributeConfig;
  onChange: (updates: Partial<PrimaryAttributeConfig>) => void;
  onRemove: () => void;
}) {
  return (
    <Card variant="outlined" className="space-y-3 p-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <Field label="Key">
          <Input
            value={attribute.key}
            onChange={(event) => onChange({ key: event.target.value })}
            placeholder="str"
          />
        </Field>
        <Field label="显示名">
          <Input
            value={attribute.label}
            onChange={(event) => onChange({ label: event.target.value })}
            placeholder="力量"
          />
        </Field>
        <Field label="默认值">
          <Input
            type="number"
            value={String(attribute.defaultValue)}
            onChange={(event) =>
              onChange({ defaultValue: Number(event.target.value) || 0 })
            }
          />
        </Field>
        <Field label="最小值">
          <Input
            type="number"
            value={attribute.min ?? ""}
            onChange={(event) =>
              onChange({
                min:
                  event.target.value.trim() === ""
                    ? undefined
                    : Number(event.target.value),
              })
            }
          />
        </Field>
        <Field label="最大值">
          <Input
            type="number"
            value={attribute.max ?? ""}
            onChange={(event) =>
              onChange({
                max:
                  event.target.value.trim() === ""
                    ? undefined
                    : Number(event.target.value),
              })
            }
          />
        </Field>
      </div>
      <Field label="说明">
        <Textarea
          value={attribute.description ?? ""}
          onChange={(event) => onChange({ description: event.target.value })}
          className="min-h-24"
          placeholder="描述该属性的语义和作用"
        />
      </Field>
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={onRemove}>
          <Trash2 className="mr-1 h-4 w-4" />
          删除属性
        </Button>
      </div>
    </Card>
  );
}

function PointBuyPanel({
  value,
  allocatableOptions,
  onChange,
}: {
  value?: PointBuyRules;
  allocatableOptions: Array<{ value: string; label: string }>;
  onChange: (updates: Partial<PointBuyRules>) => void;
}) {
  const allocatableAttributes = value?.allocatableAttributes ?? [];

  return (
    <Card variant="outlined" className="space-y-4 p-4">
      <h4
        className="text-sm font-semibold"
        style={{ color: color("textPrimary") }}
      >
        点数分配规则
      </h4>
      <div className="grid gap-3 md:grid-cols-3">
        <Field label="额外可分配点数">
          <Input
            type="number"
            value={value?.bonusPoints ?? 10}
            onChange={(event) =>
              onChange({ bonusPoints: Number(event.target.value) || 0 })
            }
          />
        </Field>
        <Field label="单属性最小值">
          <Input
            type="number"
            value={value?.minPerAttribute ?? ""}
            onChange={(event) =>
              onChange({
                minPerAttribute:
                  event.target.value.trim() === ""
                    ? undefined
                    : Number(event.target.value),
              })
            }
          />
        </Field>
        <Field label="单属性最大值">
          <Input
            type="number"
            value={value?.maxPerAttribute ?? ""}
            onChange={(event) =>
              onChange({
                maxPerAttribute:
                  event.target.value.trim() === ""
                    ? undefined
                    : Number(event.target.value),
              })
            }
          />
        </Field>
      </div>

      <div>
        <span
          className="text-xs font-medium"
          style={{ color: color("textSecondary") }}
        >
          可分配属性
        </span>
        <div className="mt-2 flex flex-wrap gap-2">
          {allocatableOptions.map((option) => {
            const selected = allocatableAttributes.includes(option.value);
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
                  const next = selected
                    ? allocatableAttributes.filter(
                        (item) => item !== option.value,
                      )
                    : [...allocatableAttributes, option.value];
                  onChange({ allocatableAttributes: next });
                }}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>
    </Card>
  );
}

function DimensionCard({
  dimension,
  attributeOptions,
  talentOptions,
  onChange,
  onRemove,
  onAddOption,
  onUpdateOption,
  onRemoveOption,
}: {
  dimension: CharacterDimension;
  attributeOptions: PrimaryAttributeConfig[];
  talentOptions: TalentConfig[];
  onChange: (updates: Partial<CharacterDimension>) => void;
  onRemove: () => void;
  onAddOption: () => void;
  onUpdateOption: (
    optionIndex: number,
    updates: Partial<DimensionOption>,
  ) => void;
  onRemoveOption: (optionIndex: number) => void;
}) {
  return (
    <Card variant="outlined" className="space-y-4 p-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Field label="维度 ID">
          <Input
            value={dimension.id}
            onChange={(event) => onChange({ id: event.target.value })}
            placeholder="race"
          />
        </Field>
        <Field label="维度名称">
          <Input
            value={dimension.label}
            onChange={(event) => onChange({ label: event.target.value })}
            placeholder="种族"
          />
        </Field>
        <Field label="排序">
          <Input
            type="number"
            value={dimension.order ?? 0}
            onChange={(event) =>
              onChange({ order: Number(event.target.value) || 0 })
            }
          />
        </Field>
        <div className="flex items-end">
          <label
            className="flex items-center gap-2 text-sm"
            style={{ color: color("textSecondary") }}
          >
            <input
              type="checkbox"
              checked={dimension.required ?? false}
              onChange={(event) => onChange({ required: event.target.checked })}
            />
            必选维度
          </label>
        </div>
      </div>

      <Field label="维度说明">
        <Textarea
          value={dimension.description ?? ""}
          onChange={(event) => onChange({ description: event.target.value })}
          className="min-h-24"
          placeholder="说明该维度在角色创建中的定位"
        />
      </Field>

      <div className="flex items-center justify-between gap-2">
        <div>
          <p
            className="text-sm font-medium"
            style={{ color: color("textPrimary") }}
          >
            维度选项
          </p>
          <p
            className="text-xs"
            style={{ color: colorAlpha("textMuted", 0.72) }}
          >
            每个选项可定义属性修正、赠送天赋和排除天赋
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onAddOption}>
            <Plus className="mr-1 h-4 w-4" />
            添加选项
          </Button>
          <Button variant="outline" size="sm" onClick={onRemove}>
            <Trash2 className="mr-1 h-4 w-4" />
            删除维度
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {dimension.options.map((option, optionIndex) => (
          <DimensionOptionCardEditor
            key={`${option.id}-${optionIndex}`}
            option={option}
            attributeOptions={attributeOptions}
            talentOptions={talentOptions}
            onChange={(updates) => onUpdateOption(optionIndex, updates)}
            onRemove={() => onRemoveOption(optionIndex)}
          />
        ))}
      </div>
    </Card>
  );
}

function DimensionOptionCardEditor({
  option,
  attributeOptions,
  talentOptions,
  onChange,
  onRemove,
}: {
  option: DimensionOption;
  attributeOptions: PrimaryAttributeConfig[];
  talentOptions: TalentConfig[];
  onChange: (updates: Partial<DimensionOption>) => void;
  onRemove: () => void;
}) {
  const attributeModifiers = option.effects?.attributeModifiers ?? {};
  const grantedTalents = option.effects?.grantedTalents ?? [];
  const excludedTalents = option.effects?.excludedTalents ?? [];

  return (
    <Panel variant="outlined" className="p-4">
      <div className="grid gap-3 md:grid-cols-3">
        <Field label="选项 ID">
          <Input
            value={option.id}
            onChange={(event) => onChange({ id: event.target.value })}
            placeholder="human"
          />
        </Field>
        <Field label="选项名称">
          <Input
            value={option.name}
            onChange={(event) => onChange({ name: event.target.value })}
            placeholder="人类"
          />
        </Field>
        <Field label="图标（可选）">
          <Input
            value={option.icon ?? ""}
            onChange={(event) => onChange({ icon: event.target.value })}
            placeholder="sparkles"
          />
        </Field>
      </div>

      <Field label="描述">
        <Textarea
          value={option.description}
          onChange={(event) => onChange({ description: event.target.value })}
          className="min-h-24"
          placeholder="说明这个选项在设定与规则上的差异"
        />
      </Field>

      <div className="grid gap-3 lg:grid-cols-3">
        <Field label="属性修正（JSON）">
          <Textarea
            value={JSON.stringify(attributeModifiers, null, 2)}
            onChange={(event) => {
              try {
                const parsed = JSON.parse(event.target.value) as Record<
                  string,
                  number
                >;
                onChange({
                  effects: {
                    ...(option.effects ?? {}),
                    attributeModifiers: parsed,
                    grantedTalents,
                    excludedTalents,
                  },
                });
              } catch {
                // 输入过程允许暂时不合法
              }
            }}
            className="min-h-28 font-mono text-xs"
            spellCheck={false}
          />
        </Field>

        <TagSelectionField
          label="赠送天赋"
          items={talentOptions.map((item) => ({
            id: item.id,
            name: item.name,
          }))}
          value={grantedTalents}
          onChange={(nextValue) =>
            onChange({
              effects: {
                ...(option.effects ?? {}),
                attributeModifiers,
                grantedTalents: nextValue,
                excludedTalents,
              },
            })
          }
        />

        <TagSelectionField
          label="排除天赋"
          items={talentOptions.map((item) => ({
            id: item.id,
            name: item.name,
          }))}
          value={excludedTalents}
          onChange={(nextValue) =>
            onChange({
              effects: {
                ...(option.effects ?? {}),
                attributeModifiers,
                grantedTalents,
                excludedTalents: nextValue,
              },
            })
          }
        />
      </div>

      <div className="mt-3 flex justify-end">
        <Button variant="outline" size="sm" onClick={onRemove}>
          <Trash2 className="mr-1 h-4 w-4" />
          删除选项
        </Button>
      </div>

      {attributeOptions.length === 0 && (
        <p
          className="mt-3 text-xs"
          style={{ color: colorAlpha("textMuted", 0.72) }}
        >
          当前没有主要属性，属性修正只会在原始规则层生效。
        </p>
      )}
    </Panel>
  );
}

function TalentCardEditor({
  talent,
  onChange,
  onRemove,
}: {
  talent: TalentConfig;
  onChange: (updates: Partial<TalentConfig>) => void;
  onRemove: () => void;
}) {
  return (
    <Card variant="outlined" className="space-y-3 p-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Field label="天赋 ID">
          <Input
            value={talent.id}
            onChange={(event) => onChange({ id: event.target.value })}
            placeholder="sharp_eye"
          />
        </Field>
        <Field label="天赋名称">
          <Input
            value={talent.name}
            onChange={(event) => onChange({ name: event.target.value })}
            placeholder="锐眼"
          />
        </Field>
        <Field label="分类">
          <Select
            value={talent.category ?? "misc"}
            onValueChange={(value) =>
              onChange({ category: value as TalentConfig["category"] })
            }
            options={TALENT_CATEGORY_OPTIONS.map((option) => ({
              value: option.value,
              label: option.label,
            }))}
          />
        </Field>
        <Field label="图标（可选）">
          <Input
            value={talent.icon ?? ""}
            onChange={(event) => onChange({ icon: event.target.value })}
            placeholder="star"
          />
        </Field>
      </div>

      <Field label="描述">
        <Textarea
          value={talent.description}
          onChange={(event) => onChange({ description: event.target.value })}
          className="min-h-24"
          placeholder="描述天赋效果与叙事语义"
        />
      </Field>

      <div className="grid gap-3 lg:grid-cols-2">
        <Field label="前置属性要求（JSON，可选）">
          <Textarea
            value={JSON.stringify(
              talent.prerequisites?.attributes ?? {},
              null,
              2,
            )}
            onChange={(event) => {
              try {
                const parsed = JSON.parse(event.target.value) as Record<
                  string,
                  number
                >;
                onChange({
                  prerequisites:
                    Object.keys(parsed).length > 0
                      ? { attributes: parsed }
                      : undefined,
                });
              } catch {
                // 输入过程中允许暂时无效
              }
            }}
            className="min-h-28 font-mono text-xs"
            spellCheck={false}
          />
        </Field>
        <Field label="互斥天赋（逗号分隔）">
          <Textarea
            value={(talent.exclusiveWith ?? []).join(", ")}
            onChange={(event) =>
              onChange({
                exclusiveWith: event.target.value
                  .split(",")
                  .map((item) => item.trim())
                  .filter(Boolean),
              })
            }
            className="min-h-28"
            placeholder="berserker, darkvision"
          />
        </Field>
      </div>

      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={onRemove}>
          <Trash2 className="mr-1 h-4 w-4" />
          删除天赋
        </Button>
      </div>
    </Card>
  );
}

function TagSelectionField({
  label,
  items,
  value,
  onChange,
}: {
  label: string;
  items: Array<{ id: string; name: string }>;
  value: string[];
  onChange: (nextValue: string[]) => void;
}) {
  return (
    <div>
      <span
        className="text-xs font-medium"
        style={{ color: color("textSecondary") }}
      >
        {label}
      </span>
      <div className="mt-2 flex flex-wrap gap-2">
        {items.map((item) => {
          const selected = value.includes(item.id);
          return (
            <button
              key={item.id}
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
                const nextValue = selected
                  ? value.filter((entry) => entry !== item.id)
                  : [...value, item.id];
                onChange(nextValue);
              }}
            >
              {item.name}
            </button>
          );
        })}
        {items.length === 0 && (
          <p
            className="text-xs"
            style={{ color: colorAlpha("textMuted", 0.72) }}
          >
            先在天赋区创建条目后再绑定。
          </p>
        )}
      </div>
    </div>
  );
}
