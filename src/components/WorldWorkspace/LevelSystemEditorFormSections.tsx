import { Card, Input, Select } from "@/components/ui";
import type { LevelSystemConfig } from "@/lib/world/types";
import { color, colorAlpha } from "@/styles/tokens";

import {
  DetailsCard,
  EditorField,
  LevelProgressEditor,
  MilestoneGrowthEditor,
  SectionHeader,
  StatusBadge,
  StringNumberRecordEditor,
  TagToggleGroup,
  ToggleSetting,
  type SelectOption,
} from "./LevelSystemEditorSections";

const NUMERIC_LITERAL_REGEX = /^-?\d+(?:\.\d+)?$/;
const EDITOR_CARD_HOVER_STYLE = {
  scale: 1,
  y: 0,
  borderColor: colorAlpha("primary", 0.52),
} as const;

const GROWTH_MODE_OPTIONS = [
  { value: "auto", label: "自动成长" },
  { value: "allocation", label: "属性点分配" },
  { value: "hybrid", label: "混合模式" },
] as const;

const TRIGGER_MODE_OPTIONS = [
  { value: "narrative", label: "叙事触发" },
  { value: "manual", label: "手动触发" },
] as const;

type ProgressValue = NonNullable<LevelSystemConfig["progress"]>;
type AutoGrowthValue = NonNullable<LevelSystemConfig["autoGrowth"]>;
type AllocationValue = NonNullable<LevelSystemConfig["allocation"]>;
type RewardsValue = NonNullable<LevelSystemConfig["rewards"]>;

export interface LevelSystemProgressSectionValue {
  progressAttributeKey: string;
  levels: NonNullable<ProgressValue["levels"]>;
  carryOverflow: boolean;
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
  perLevel: NonNullable<RewardsValue["perLevel"]>;
  milestones: NonNullable<RewardsValue["milestones"]>;
}

interface LevelSystemBasicsSectionProps {
  growthMode: NonNullable<LevelSystemConfig["growthMode"]>;
  levelAttributeKey: string;
  triggerModes: NonNullable<LevelSystemConfig["triggerModes"]>;
  onGrowthModeChange: (
    nextValue: NonNullable<LevelSystemConfig["growthMode"]>,
  ) => void;
  onLevelAttributeKeyChange: (value: string) => void;
  onTriggerModesChange: (
    nextValues: NonNullable<LevelSystemConfig["triggerModes"]>,
  ) => void;
}

export function LevelSystemBasicsSection({
  growthMode,
  levelAttributeKey,
  triggerModes,
  onGrowthModeChange,
  onLevelAttributeKeyChange,
  onTriggerModesChange,
}: LevelSystemBasicsSectionProps) {
  return (
    <Card
      variant="outlined"
      whileHover={EDITOR_CARD_HOVER_STYLE}
      className="space-y-4 p-4"
    >
      <div className="space-y-4">
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
      description="定义成长进度字段与每个等级的名称/门槛。达到目标等级所需进度后，仍需显式执行升级命令。"
    >
      <EditorField
        label="进度属性键"
        hint="运行时会读取该字段的累计进度，并根据下一级定义计算升级门槛。"
      >
        <Input
          value={value.progressAttributeKey}
          onChange={(event) =>
            onChange({ progressAttributeKey: event.target.value })
          }
          placeholder="level_progress"
        />
      </EditorField>

      <LevelProgressEditor
        entries={value.levels}
        onChange={(entries) => onChange({ levels: entries })}
      />

      <ToggleSetting
        title="保留溢出进度"
        description="开启后，升级超过下一级门槛的部分会继续保留在进度字段中。"
        checked={value.carryOverflow}
        onCheckedChange={(checked) => onChange({ carryOverflow: checked })}
      />
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
    <Card
      variant="outlined"
      whileHover={EDITOR_CARD_HOVER_STYLE}
      className="space-y-4 p-4"
    >
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
    <Card
      variant="outlined"
      whileHover={EDITOR_CARD_HOVER_STYLE}
      className="space-y-4 p-4"
    >
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

interface LevelSystemRewardsSectionProps {
  value: LevelSystemRewardsSectionValue;
}

export function LevelSystemRewardsSection({
  value,
}: LevelSystemRewardsSectionProps) {
  return (
    <Card
      variant="outlined"
      whileHover={EDITOR_CARD_HOVER_STYLE}
      className="space-y-4 p-4"
    >
      <SectionHeader
        title="奖励配置"
        description="升级奖励始终自动结算；复杂奖励包继续通过本分区高级 JSON 维护。"
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
          <StatusBadge label="每级奖励" value={`${value.perLevel.length} 项`} />
          <StatusBadge label="里程碑" value={`${value.milestones.length} 项`} />
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
