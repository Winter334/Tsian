import { Card, Input, Select } from "@/components/ui";
import type { LevelSystemConfig } from "@/lib/world/types";
import { color, colorAlpha } from "@/styles/tokens";

import {
  DetailsCard,
  EditorField,
  LevelSystemTemplateCard,
  MilestoneGrowthEditor,
  SectionHeader,
  StatusBadge,
  StringNumberRecordEditor,
  TagToggleGroup,
  ThresholdTableEditor,
  ToggleSetting,
  type SelectOption,
} from "./LevelSystemEditorSections";
import { type LevelSystemTemplateId } from "./level-system-templates";

const NUMERIC_LITERAL_REGEX = /^-?\d+(?:\.\d+)?$/;

const GROWTH_MODE_OPTIONS = [
  { value: "auto", label: "自动成长" },
  { value: "allocation", label: "属性点分配" },
  { value: "hybrid", label: "混合模式" },
] as const;

const TRIGGER_MODE_OPTIONS = [
  { value: "narrative", label: "叙事触发" },
  { value: "manual", label: "手动触发" },
] as const;

const THRESHOLD_MODE_OPTIONS = [
  { value: "table", label: "阈值表" },
  { value: "formula", label: "公式" },
] as const;

const PROGRESS_VISIBILITY_OPTIONS = [
  { value: "hidden", label: "隐藏" },
  { value: "summary", label: "摘要" },
  { value: "detailed", label: "详细" },
] as const;

const RESOURCE_RECOVERY_MODE_OPTIONS = [
  { value: "none", label: "不恢复" },
  { value: "full", label: "完全恢复" },
  { value: "delta", label: "按增量恢复" },
  { value: "ratio", label: "按比例映射" },
] as const;

const NARRATIVE_VISIBILITY_OPTIONS = [
  { value: "hidden", label: "隐藏" },
  { value: "summary", label: "摘要" },
  { value: "ceremony", label: "仪式感表现" },
] as const;

type ProgressValue = NonNullable<LevelSystemConfig["progress"]>;
type AutoGrowthValue = NonNullable<LevelSystemConfig["autoGrowth"]>;
type AllocationValue = NonNullable<LevelSystemConfig["allocation"]>;
type RewardsValue = NonNullable<LevelSystemConfig["rewards"]>;
type ResourceRecoveryValue = NonNullable<LevelSystemConfig["resourceRecovery"]>;
type NarrativeValue = NonNullable<LevelSystemConfig["narrative"]>;

export interface LevelSystemProgressSectionValue {
  progressAttributeKey: string;
  thresholdMode: NonNullable<ProgressValue["thresholdMode"]>;
  thresholdTable: NonNullable<ProgressValue["thresholdTable"]>;
  thresholdFormula: ProgressValue["thresholdFormula"];
  carryOverflow: boolean;
  visibility: NonNullable<ProgressValue["visibility"]>;
}

export interface LevelSystemAutoGrowthSectionValue {
  perLevel: NonNullable<AutoGrowthValue["perLevel"]>;
  milestoneGrowth: NonNullable<AutoGrowthValue["milestoneGrowth"]>;
}

export interface LevelSystemAllocationSectionValue {
  pointAttributeKey: string;
  allocatableAttributes: NonNullable<AllocationValue["allocatableAttributes"]>;
  pointsPerLevel: NonNullable<AllocationValue["pointsPerLevel"]>;
  minPerAttribute: AllocationValue["minPerAttribute"];
  maxPerAttribute: AllocationValue["maxPerAttribute"];
  allowDeferredAllocation: boolean;
}

export interface LevelSystemRewardsSectionValue {
  autoApply: boolean;
  perLevel: NonNullable<RewardsValue["perLevel"]>;
  milestones: NonNullable<RewardsValue["milestones"]>;
}

export interface LevelSystemResourceRecoverySectionValue {
  mode: NonNullable<ResourceRecoveryValue["mode"]>;
  resourceKeys: NonNullable<ResourceRecoveryValue["resourceKeys"]>;
}

export interface LevelSystemNarrativeSectionValue {
  allowAiTrigger: boolean;
  requirePlayerConfirmation: boolean;
  emitSystemLog: boolean;
  visibility: NonNullable<NarrativeValue["visibility"]>;
}

interface LevelSystemBasicsSectionProps {
  enabled: boolean;
  growthMode: NonNullable<LevelSystemConfig["growthMode"]>;
  levelAttributeKey: string;
  triggerModes: NonNullable<LevelSystemConfig["triggerModes"]>;
  selectedTemplateId: LevelSystemTemplateId | "";
  templateDescriptionText: string;
  canApplyTemplate: boolean;
  onEnabledChange: (checked: boolean) => void;
  onGrowthModeChange: (
    nextValue: NonNullable<LevelSystemConfig["growthMode"]>,
  ) => void;
  onLevelAttributeKeyChange: (value: string) => void;
  onTriggerModesChange: (
    nextValues: NonNullable<LevelSystemConfig["triggerModes"]>,
  ) => void;
  onSelectTemplate: (value: LevelSystemTemplateId | "") => void;
  onApplyTemplate: () => void;
}

export function LevelSystemBasicsSection({
  enabled,
  growthMode,
  levelAttributeKey,
  triggerModes,
  selectedTemplateId,
  templateDescriptionText,
  canApplyTemplate,
  onEnabledChange,
  onGrowthModeChange,
  onLevelAttributeKeyChange,
  onTriggerModesChange,
  onSelectTemplate,
  onApplyTemplate,
}: LevelSystemBasicsSectionProps) {
  return (
    <Card variant="outlined" className="space-y-4 p-4">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
        <div className="space-y-4">
          <div className="grid gap-3 lg:grid-cols-2">
            <ToggleSetting
              title="启用等级系统"
              description="关闭后，运行时不会按等级系统配置驱动成长、奖励与资源恢复。"
              checked={enabled}
              onCheckedChange={onEnabledChange}
            />
            <EditorField label="成长模式">
              <Select
                value={growthMode}
                onValueChange={(nextValue) =>
                  onGrowthModeChange(
                    nextValue as NonNullable<LevelSystemConfig["growthMode"]>,
                  )
                }
                options={GROWTH_MODE_OPTIONS.map((option) => ({
                  value: option.value,
                  label: option.label,
                }))}
              />
            </EditorField>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <EditorField
              label="等级属性键"
              hint="建议指向已有 primaryAttributes 字段，默认使用 level。"
            >
              <Input
                value={levelAttributeKey}
                onChange={(event) =>
                  onLevelAttributeKeyChange(event.target.value)
                }
                placeholder="level"
              />
            </EditorField>
            <EditorField
              label="触发模式"
              hint="可同时开启叙事与手动触发；成长判定仍由系统命令结算。"
            >
              <TagToggleGroup
                options={TRIGGER_MODE_OPTIONS.map((option) => ({
                  value: option.value,
                  label: option.label,
                }))}
                selectedValues={triggerModes}
                onToggle={(nextValues) =>
                  onTriggerModesChange(
                    nextValues.filter(
                      (
                        item,
                      ): item is NonNullable<
                        LevelSystemConfig["triggerModes"]
                      >[number] => item === "narrative" || item === "manual",
                    ),
                  )
                }
              />
            </EditorField>
          </div>
        </div>

        <LevelSystemTemplateCard
          selectedTemplateId={selectedTemplateId}
          descriptionText={templateDescriptionText}
          canApply={canApplyTemplate}
          onSelectTemplate={onSelectTemplate}
          onApply={onApplyTemplate}
        />
      </div>
    </Card>
  );
}

interface LevelSystemProgressSectionProps {
  value: LevelSystemProgressSectionValue;
  onChange: (updates: Partial<LevelSystemProgressSectionValue>) => void;
}

export function LevelSystemProgressSection({
  value,
  onChange,
}: LevelSystemProgressSectionProps) {
  return (
    <DetailsCard
      title="进度配置"
      description="定义成长进度字段、升级参考阈值与可见性；达到阈值后仍需显式执行升级命令。"
    >
      <div className="grid gap-3 lg:grid-cols-2">
        <EditorField label="进度属性键">
          <Input
            value={value.progressAttributeKey}
            onChange={(event) =>
              onChange({ progressAttributeKey: event.target.value })
            }
            placeholder="level_progress"
          />
        </EditorField>
        <EditorField label="阈值模式">
          <Select
            value={value.thresholdMode}
            onValueChange={(nextValue) =>
              onChange({
                thresholdMode:
                  nextValue as LevelSystemProgressSectionValue["thresholdMode"],
              })
            }
            options={THRESHOLD_MODE_OPTIONS.map((option) => ({
              value: option.value,
              label: option.label,
            }))}
          />
        </EditorField>
      </div>

      {value.thresholdMode === "table" ? (
        <ThresholdTableEditor
          entries={value.thresholdTable}
          onChange={(entries) => onChange({ thresholdTable: entries })}
        />
      ) : (
        <EditorField label="阈值公式">
          <Input
            value={value.thresholdFormula ?? ""}
            onChange={(event) =>
              onChange({ thresholdFormula: event.target.value })
            }
            placeholder="100 + level * 25"
          />
        </EditorField>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        <ToggleSetting
          title="保留溢出进度"
          description="开启后，升级参考值超出阈值的部分会继续保留在进度字段中。"
          checked={value.carryOverflow}
          onCheckedChange={(checked) => onChange({ carryOverflow: checked })}
        />
        <EditorField label="进度展示方式">
          <Select
            value={value.visibility}
            onValueChange={(nextValue) =>
              onChange({
                visibility:
                  nextValue as LevelSystemProgressSectionValue["visibility"],
              })
            }
            options={PROGRESS_VISIBILITY_OPTIONS.map((option) => ({
              value: option.value,
              label: option.label,
            }))}
          />
        </EditorField>
      </div>
    </DetailsCard>
  );
}

interface LevelSystemAutoGrowthSectionProps {
  value: LevelSystemAutoGrowthSectionValue;
  primaryAttributeOptions: SelectOption[];
  onChange: (updates: Partial<LevelSystemAutoGrowthSectionValue>) => void;
}

export function LevelSystemAutoGrowthSection({
  value,
  primaryAttributeOptions,
  onChange,
}: LevelSystemAutoGrowthSectionProps) {
  return (
    <Card variant="outlined" className="space-y-4 p-4">
      <SectionHeader
        title="自动成长"
        description="升级后自动结算的属性变化；支持纯数字与表达式字符串。"
      />

      <StringNumberRecordEditor
        title="每级固定成长"
        description="定义每次升级时稳定追加的属性成长。"
        addLabel="添加成长项"
        emptyMessage="当前没有每级固定成长，可为力量、耐久等属性追加固定或表达式成长。"
        fieldOptions={primaryAttributeOptions}
        value={value.perLevel}
        onChange={(perLevel) => onChange({ perLevel })}
      />

      <MilestoneGrowthEditor
        milestones={value.milestoneGrowth}
        fieldOptions={primaryAttributeOptions}
        onChange={(milestoneGrowth) => onChange({ milestoneGrowth })}
      />
    </Card>
  );
}

interface LevelSystemAllocationSectionProps {
  value: LevelSystemAllocationSectionValue;
  allocatableAttributeOptions: SelectOption[];
  onChange: (updates: Partial<LevelSystemAllocationSectionValue>) => void;
}

export function LevelSystemAllocationSection({
  value,
  allocatableAttributeOptions,
  onChange,
}: LevelSystemAllocationSectionProps) {
  return (
    <Card variant="outlined" className="space-y-4 p-4">
      <SectionHeader
        title="属性点分配"
        description="定义升级后未分配属性点的存储字段、分配目标与单次限制。"
      />

      <div className="grid gap-3 lg:grid-cols-2">
        <EditorField label="未分配点数字段">
          <Input
            value={value.pointAttributeKey}
            onChange={(event) =>
              onChange({ pointAttributeKey: event.target.value })
            }
            placeholder="unspent_attribute_points"
          />
        </EditorField>
        <EditorField
          label="每级发放点数"
          hint="可填写数字，或填写表达式字符串作为后续运行时扩展入口。"
        >
          <Input
            value={String(value.pointsPerLevel)}
            onChange={(event) =>
              onChange({
                pointsPerLevel:
                  parseStringNumberInput(event.target.value) ??
                  event.target.value,
              })
            }
            placeholder="1"
          />
        </EditorField>
      </div>

      <EditorField
        label="可分配属性"
        hint="默认从主要属性中筛选，并自动排除等级字段与未分配点数字段。"
      >
        <TagToggleGroup
          options={allocatableAttributeOptions}
          selectedValues={value.allocatableAttributes}
          onToggle={(nextValues) =>
            onChange({ allocatableAttributes: nextValues })
          }
          emptyMessage="当前没有可分配属性候选，请先检查主要属性配置。"
        />
      </EditorField>

      <div className="grid gap-3 lg:grid-cols-3">
        <EditorField label="单属性最小分配（可选）">
          <Input
            type="number"
            value={value.minPerAttribute ?? ""}
            onChange={(event) =>
              onChange({
                minPerAttribute:
                  event.target.value.trim() === ""
                    ? undefined
                    : Number(event.target.value),
              })
            }
          />
        </EditorField>
        <EditorField label="单属性最大分配（可选）">
          <Input
            type="number"
            value={value.maxPerAttribute ?? ""}
            onChange={(event) =>
              onChange({
                maxPerAttribute:
                  event.target.value.trim() === ""
                    ? undefined
                    : Number(event.target.value),
              })
            }
          />
        </EditorField>
        <ToggleSetting
          title="允许延后分配"
          description="开启后，升级可先记录未分配点数，由玩家稍后处理。"
          checked={value.allowDeferredAllocation}
          onCheckedChange={(checked) =>
            onChange({ allowDeferredAllocation: checked })
          }
        />
      </div>
    </Card>
  );
}

interface LevelSystemResourceRecoverySectionProps {
  value: LevelSystemResourceRecoverySectionValue;
  resourceOptions: SelectOption[];
  onChange: (updates: Partial<LevelSystemResourceRecoverySectionValue>) => void;
}

export function LevelSystemResourceRecoverySection({
  value,
  resourceOptions,
  onChange,
}: LevelSystemResourceRecoverySectionProps) {
  return (
    <Card variant="outlined" className="space-y-4 p-4">
      <SectionHeader
        title="资源恢复"
        description="控制升级时当前资源值的刷新方式；这里只影响 current 值，不定义上限公式。"
      />

      <div className="grid gap-3 lg:grid-cols-2">
        <EditorField label="恢复模式">
          <Select
            value={value.mode}
            onValueChange={(nextValue) =>
              onChange({
                mode: nextValue as LevelSystemResourceRecoverySectionValue["mode"],
              })
            }
            options={RESOURCE_RECOVERY_MODE_OPTIONS.map((option) => ({
              value: option.value,
              label: option.label,
            }))}
          />
        </EditorField>
        <EditorField
          label="受影响资源字段"
          hint="默认从 resource 类衍生属性中推导，可按需缩小范围。"
        >
          <TagToggleGroup
            options={resourceOptions}
            selectedValues={value.resourceKeys}
            onToggle={(nextValues) => onChange({ resourceKeys: nextValues })}
            emptyMessage="当前还没有资源型衍生属性候选。"
          />
        </EditorField>
      </div>
    </Card>
  );
}

interface LevelSystemNarrativeSectionProps {
  value: LevelSystemNarrativeSectionValue;
  onChange: (updates: Partial<LevelSystemNarrativeSectionValue>) => void;
}

export function LevelSystemNarrativeSection({
  value,
  onChange,
}: LevelSystemNarrativeSectionProps) {
  return (
    <Card variant="outlined" className="space-y-4 p-4">
      <SectionHeader
        title="叙事配置"
        description="控制升级是否允许 AI 主动触发、是否需要玩家确认，以及升级表现风格。"
      />

      <div className="grid gap-3 lg:grid-cols-2">
        <ToggleSetting
          title="允许 AI 触发升级"
          description="开启后，叙事系统可在满足世界观条件时建议或触发升级。"
          checked={value.allowAiTrigger}
          onCheckedChange={(checked) => onChange({ allowAiTrigger: checked })}
        />
        <ToggleSetting
          title="需要玩家确认"
          description="开启后，升级动作需要玩家显式确认后再继续结算。"
          checked={value.requirePlayerConfirmation}
          onCheckedChange={(checked) =>
            onChange({ requirePlayerConfirmation: checked })
          }
        />
        <ToggleSetting
          title="写入系统日志"
          description="控制升级是否生成系统日志与显式的成长反馈记录。"
          checked={value.emitSystemLog}
          onCheckedChange={(checked) => onChange({ emitSystemLog: checked })}
        />
        <EditorField label="表现可见性">
          <Select
            value={value.visibility}
            onValueChange={(nextValue) =>
              onChange({
                visibility:
                  nextValue as LevelSystemNarrativeSectionValue["visibility"],
              })
            }
            options={NARRATIVE_VISIBILITY_OPTIONS.map((option) => ({
              value: option.value,
              label: option.label,
            }))}
          />
        </EditorField>
      </div>
    </Card>
  );
}

interface LevelSystemRewardsSectionProps {
  value: LevelSystemRewardsSectionValue;
  onChange: (updates: Partial<LevelSystemRewardsSectionValue>) => void;
}

export function LevelSystemRewardsSection({
  value,
  onChange,
}: LevelSystemRewardsSectionProps) {
  return (
    <Card variant="outlined" className="space-y-4 p-4">
      <SectionHeader
        title="奖励配置"
        description="首版仅结构化维护自动发放开关；复杂奖励包仍通过本分区高级 JSON 兜底。"
      />

      <div className="grid gap-3 lg:grid-cols-2">
        <ToggleSetting
          title="自动发放奖励"
          description="关闭后，升级只记录等级变化与待处理状态，不立即自动结算奖励包。"
          checked={value.autoApply}
          onCheckedChange={(checked) => onChange({ autoApply: checked })}
        />
        <div
          className="rounded-xl border px-4 py-3"
          style={{
            borderColor: colorAlpha("border", 0.3),
            background: colorAlpha("bgCard", 0.22),
          }}
        >
          <p
            className="text-sm font-medium"
            style={{ color: color("textPrimary") }}
          >
            高级奖励包
          </p>
          <p
            className="mt-1 text-xs"
            style={{ color: colorAlpha("textMuted", 0.72) }}
          >
            当前结构化面板不会覆盖 perLevel / milestones
            的奖励包内容，请使用当前分区的高级 JSON 编辑器维护。
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <StatusBadge
              label="每级奖励"
              value={`${value.perLevel.length} 项`}
            />
            <StatusBadge
              label="里程碑"
              value={`${value.milestones.length} 项`}
            />
          </div>
        </div>
      </div>
    </Card>
  );
}

function parseStringNumberInput(value: string): number | string | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  return NUMERIC_LITERAL_REGEX.test(trimmed) ? Number(trimmed) : trimmed;
}
