import { useMemo, useState } from "react";

import { Card, ConfirmDialog, Input, Select } from "@/components/ui";
import type {
  DerivedStatConfig,
  LevelSystemConfig,
  PrimaryAttributeConfig,
} from "@/lib/world/types";
import { color, colorAlpha } from "@/styles/tokens";
import {
  DetailsCard,
  EditorField,
  LevelSystemPreviewPanel,
  LevelSystemTemplateCard,
  LevelSystemValidationPanel,
  MilestoneGrowthEditor,
  SectionHeader,
  StatusBadge,
  StringNumberRecordEditor,
  TagToggleGroup,
  ThresholdTableEditor,
  ToggleSetting,
  type SelectOption,
} from "./LevelSystemEditorSections";
import {
  buildAppliedLevelSystemTemplate,
  getNarrativeVisibilityLabel,
  LEVEL_SYSTEM_TEMPLATES,
  validateLevelSystemConfig,
  type LevelSystemTemplateId,
} from "./level-system-templates";

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
type ProgressConfig = {
  progressAttributeKey: string;
  thresholdMode: NonNullable<ProgressValue["thresholdMode"]>;
  thresholdTable: NonNullable<ProgressValue["thresholdTable"]>;
  thresholdFormula: ProgressValue["thresholdFormula"];
  carryOverflow: boolean;
  visibility: NonNullable<ProgressValue["visibility"]>;
};
type AutoGrowthValue = NonNullable<LevelSystemConfig["autoGrowth"]>;
type AutoGrowthConfig = {
  perLevel: NonNullable<AutoGrowthValue["perLevel"]>;
  milestoneGrowth: NonNullable<AutoGrowthValue["milestoneGrowth"]>;
};
type AllocationValue = NonNullable<LevelSystemConfig["allocation"]>;
type AllocationConfig = {
  pointAttributeKey: string;
  allocatableAttributes: NonNullable<AllocationValue["allocatableAttributes"]>;
  pointsPerLevel: NonNullable<AllocationValue["pointsPerLevel"]>;
  minPerAttribute: AllocationValue["minPerAttribute"];
  maxPerAttribute: AllocationValue["maxPerAttribute"];
  allowDeferredAllocation: boolean;
};
type RewardsValue = NonNullable<LevelSystemConfig["rewards"]>;
type RewardsConfig = {
  autoApply: boolean;
  perLevel: NonNullable<RewardsValue["perLevel"]>;
  milestones: NonNullable<RewardsValue["milestones"]>;
};
type ResourceRecoveryValue = NonNullable<LevelSystemConfig["resourceRecovery"]>;
type ResourceRecoveryConfig = {
  mode: NonNullable<ResourceRecoveryValue["mode"]>;
  resourceKeys: NonNullable<ResourceRecoveryValue["resourceKeys"]>;
};
type NarrativeValue = NonNullable<LevelSystemConfig["narrative"]>;
type NarrativeConfig = {
  allowAiTrigger: boolean;
  requirePlayerConfirmation: boolean;
  emitSystemLog: boolean;
  visibility: NonNullable<NarrativeValue["visibility"]>;
};

interface LevelSystemEditorProps {
  value: LevelSystemConfig;
  primaryAttributes: PrimaryAttributeConfig[];
  derivedStats: DerivedStatConfig[];
  onChange: (partial: Partial<LevelSystemConfig>) => void;
}

export function LevelSystemEditor({
  value,
  primaryAttributes,
  derivedStats,
  onChange,
}: LevelSystemEditorProps) {
  const [selectedTemplateId, setSelectedTemplateId] = useState<
    LevelSystemTemplateId | ""
  >("");
  const [pendingTemplateId, setPendingTemplateId] =
    useState<LevelSystemTemplateId | null>(null);

  const enabled = value.enabled ?? false;
  const levelAttributeKey = value.levelAttributeKey ?? "level";
  const triggerModes = useMemo(
    () => value.triggerModes ?? [],
    [value.triggerModes],
  );
  const growthMode = value.growthMode ?? "auto";
  const progress = useMemo<ProgressConfig>(
    () => ({
      progressAttributeKey:
        value.progress?.progressAttributeKey ?? "level_progress",
      thresholdMode: value.progress?.thresholdMode ?? "table",
      thresholdTable: value.progress?.thresholdTable ?? [],
      thresholdFormula: value.progress?.thresholdFormula,
      carryOverflow: value.progress?.carryOverflow ?? true,
      visibility: value.progress?.visibility ?? "summary",
    }),
    [value.progress],
  );
  const autoGrowth = useMemo<AutoGrowthConfig>(
    () => ({
      perLevel: value.autoGrowth?.perLevel ?? {},
      milestoneGrowth: value.autoGrowth?.milestoneGrowth ?? [],
    }),
    [value.autoGrowth],
  );
  const allocation = useMemo<AllocationConfig>(
    () => ({
      pointAttributeKey:
        value.allocation?.pointAttributeKey ?? "unspent_attribute_points",
      allocatableAttributes: value.allocation?.allocatableAttributes ?? [],
      pointsPerLevel: value.allocation?.pointsPerLevel ?? 1,
      minPerAttribute: value.allocation?.minPerAttribute,
      maxPerAttribute: value.allocation?.maxPerAttribute,
      allowDeferredAllocation:
        value.allocation?.allowDeferredAllocation ?? true,
    }),
    [value.allocation],
  );
  const rewards = useMemo<RewardsConfig>(
    () => ({
      autoApply: value.rewards?.autoApply ?? true,
      perLevel: value.rewards?.perLevel ?? [],
      milestones: value.rewards?.milestones ?? [],
    }),
    [value.rewards],
  );
  const resourceRecovery = useMemo<ResourceRecoveryConfig>(
    () => ({
      mode: value.resourceRecovery?.mode ?? "delta",
      resourceKeys: value.resourceRecovery?.resourceKeys ?? [],
    }),
    [value.resourceRecovery],
  );
  const narrative = useMemo<NarrativeConfig>(
    () => ({
      allowAiTrigger: value.narrative?.allowAiTrigger ?? true,
      requirePlayerConfirmation:
        value.narrative?.requirePlayerConfirmation ?? false,
      emitSystemLog: value.narrative?.emitSystemLog ?? true,
      visibility: value.narrative?.visibility ?? "summary",
    }),
    [value.narrative],
  );

  const primaryAttributeOptions = useMemo<SelectOption[]>(
    () =>
      primaryAttributes.map((attribute) => ({
        value: attribute.key,
        label: `${attribute.label}（${attribute.key}）`,
      })),
    [primaryAttributes],
  );

  const primaryAttributeLabelMap = useMemo(
    () =>
      new Map(
        primaryAttributes.map((attribute) => [attribute.key, attribute.label]),
      ),
    [primaryAttributes],
  );

  const derivedStatLabelMap = useMemo(
    () => new Map(derivedStats.map((stat) => [stat.key, stat.label])),
    [derivedStats],
  );

  const allocatableAttributeOptions = useMemo<SelectOption[]>(
    () =>
      primaryAttributes
        .filter(
          (attribute) =>
            attribute.key !== levelAttributeKey &&
            attribute.key !== allocation.pointAttributeKey,
        )
        .map((attribute) => ({
          value: attribute.key,
          label: `${attribute.label}（${attribute.key}）`,
        })),
    [allocation.pointAttributeKey, levelAttributeKey, primaryAttributes],
  );

  const resourceOptions = useMemo<SelectOption[]>(
    () =>
      derivedStats
        .filter((stat) => stat.isResource || stat.category === "resource")
        .map((stat) => ({
          value: stat.key,
          label: `${stat.label}（${stat.key}）`,
        })),
    [derivedStats],
  );

  const selectedTemplate = useMemo(
    () =>
      selectedTemplateId
        ? (LEVEL_SYSTEM_TEMPLATES.find(
            (template) => template.id === selectedTemplateId,
          ) ?? null)
        : null,
    [selectedTemplateId],
  );

  const pendingTemplate = useMemo(
    () =>
      pendingTemplateId
        ? (LEVEL_SYSTEM_TEMPLATES.find(
            (template) => template.id === pendingTemplateId,
          ) ?? null)
        : null,
    [pendingTemplateId],
  );

  const resolvedLevelSystem = useMemo<LevelSystemConfig>(
    () => ({
      ...value,
      enabled,
      levelAttributeKey,
      triggerModes,
      growthMode,
      progress,
      autoGrowth,
      allocation,
      rewards,
      resourceRecovery,
      narrative,
    }),
    [
      allocation,
      autoGrowth,
      enabled,
      growthMode,
      levelAttributeKey,
      narrative,
      progress,
      resourceRecovery,
      rewards,
      triggerModes,
      value,
    ],
  );

  const validationWarnings = useMemo(
    () =>
      validateLevelSystemConfig(
        resolvedLevelSystem,
        primaryAttributes,
        derivedStats,
      ),
    [derivedStats, primaryAttributes, resolvedLevelSystem],
  );

  const autoGrowthPreviewItems = useMemo(
    () =>
      buildRecordPreviewEntries(autoGrowth.perLevel, primaryAttributeLabelMap),
    [autoGrowth.perLevel, primaryAttributeLabelMap],
  );

  const allocationPreviewLabel = useMemo(
    () => buildAllocationPreview(allocation, primaryAttributeLabelMap),
    [allocation, primaryAttributeLabelMap],
  );

  const resourcePreviewLabel = useMemo(
    () =>
      buildKeyListPreview(resourceRecovery.resourceKeys, derivedStatLabelMap),
    [derivedStatLabelMap, resourceRecovery.resourceKeys],
  );

  const narrativePreviewItems = useMemo(
    () => buildNarrativePreviewItems(narrative),
    [narrative],
  );

  const progressPreviewLabel = useMemo(
    () => buildProgressPreview(progress),
    [progress],
  );

  const updateProgress = (updates: Partial<ProgressConfig>) => {
    onChange({
      progress: {
        ...progress,
        ...updates,
      },
    });
  };

  const updateAutoGrowth = (updates: Partial<AutoGrowthConfig>) => {
    onChange({
      autoGrowth: {
        ...autoGrowth,
        ...updates,
      },
    });
  };

  const updateAllocation = (updates: Partial<AllocationConfig>) => {
    onChange({
      allocation: {
        ...allocation,
        ...updates,
      },
    });
  };

  const updateResourceRecovery = (updates: Partial<ResourceRecoveryConfig>) => {
    onChange({
      resourceRecovery: {
        ...resourceRecovery,
        ...updates,
      },
    });
  };

  const updateNarrative = (updates: Partial<NarrativeConfig>) => {
    onChange({
      narrative: {
        ...narrative,
        ...updates,
      },
    });
  };

  const showAutoGrowth = growthMode === "auto" || growthMode === "hybrid";
  const showAllocation = growthMode === "allocation" || growthMode === "hybrid";

  const handleRequestApplyTemplate = () => {
    if (!selectedTemplate) {
      return;
    }
    setPendingTemplateId(selectedTemplate.id);
  };

  const handleConfirmApplyTemplate = () => {
    if (!pendingTemplate) {
      return;
    }

    onChange(
      buildAppliedLevelSystemTemplate(pendingTemplate, {
        primaryAttributes,
        derivedStats,
        currentLevelAttributeKey: levelAttributeKey,
      }),
    );
  };

  return (
    <>
      <div className="space-y-4">
        <Card variant="outlined" className="space-y-4 p-4">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
            <div className="space-y-4">
              <div className="grid gap-3 lg:grid-cols-2">
                <ToggleSetting
                  title="启用等级系统"
                  description="关闭后，运行时不会按等级系统配置驱动成长、奖励与资源恢复。"
                  checked={enabled}
                  onCheckedChange={(checked) => onChange({ enabled: checked })}
                />
                <EditorField label="成长模式">
                  <Select
                    value={growthMode}
                    onValueChange={(nextValue) =>
                      onChange({
                        growthMode:
                          nextValue as LevelSystemConfig["growthMode"],
                      })
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
                      onChange({ levelAttributeKey: event.target.value })
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
                      onChange({
                        triggerModes: nextValues.filter(
                          (
                            item,
                          ): item is NonNullable<
                            LevelSystemConfig["triggerModes"]
                          >[number] =>
                            item === "narrative" || item === "manual",
                        ),
                      })
                    }
                  />
                </EditorField>
              </div>
            </div>

            <LevelSystemTemplateCard
              selectedTemplateId={selectedTemplateId}
              descriptionText={
                selectedTemplate?.description ??
                "选择模板后，可通过确认对话框将基础、进度、成长、资源与叙事配置快速覆盖到当前世界。"
              }
              canApply={selectedTemplate !== null}
              onSelectTemplate={setSelectedTemplateId}
              onApply={handleRequestApplyTemplate}
            />
          </div>
        </Card>

        <DetailsCard
          title="进度配置"
          description="定义成长进度字段、升级参考阈值与可见性；达到阈值后仍需显式执行升级命令。"
        >
          <div className="grid gap-3 lg:grid-cols-2">
            <EditorField label="进度属性键">
              <Input
                value={progress.progressAttributeKey}
                onChange={(event) =>
                  updateProgress({ progressAttributeKey: event.target.value })
                }
                placeholder="level_progress"
              />
            </EditorField>
            <EditorField label="阈值模式">
              <Select
                value={progress.thresholdMode}
                onValueChange={(nextValue) =>
                  updateProgress({
                    thresholdMode: nextValue as ProgressConfig["thresholdMode"],
                  })
                }
                options={THRESHOLD_MODE_OPTIONS.map((option) => ({
                  value: option.value,
                  label: option.label,
                }))}
              />
            </EditorField>
          </div>

          {progress.thresholdMode === "table" ? (
            <ThresholdTableEditor
              entries={progress.thresholdTable}
              onChange={(entries) =>
                updateProgress({ thresholdTable: entries })
              }
            />
          ) : (
            <EditorField label="阈值公式">
              <Input
                value={progress.thresholdFormula ?? ""}
                onChange={(event) =>
                  updateProgress({ thresholdFormula: event.target.value })
                }
                placeholder="100 + level * 25"
              />
            </EditorField>
          )}

          <div className="grid gap-3 lg:grid-cols-2">
            <ToggleSetting
              title="保留溢出进度"
              description="开启后，升级参考值超出阈值的部分会继续保留在进度字段中。"
              checked={progress.carryOverflow}
              onCheckedChange={(checked) =>
                updateProgress({ carryOverflow: checked })
              }
            />
            <EditorField label="进度展示方式">
              <Select
                value={progress.visibility}
                onValueChange={(nextValue) =>
                  updateProgress({
                    visibility: nextValue as ProgressConfig["visibility"],
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

        {showAutoGrowth ? (
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
              value={autoGrowth.perLevel}
              onChange={(perLevel) => updateAutoGrowth({ perLevel })}
            />

            <MilestoneGrowthEditor
              milestones={autoGrowth.milestoneGrowth}
              fieldOptions={primaryAttributeOptions}
              onChange={(milestones) =>
                updateAutoGrowth({ milestoneGrowth: milestones })
              }
            />
          </Card>
        ) : null}

        {showAllocation ? (
          <Card variant="outlined" className="space-y-4 p-4">
            <SectionHeader
              title="属性点分配"
              description="定义升级后未分配属性点的存储字段、分配目标与单次限制。"
            />

            <div className="grid gap-3 lg:grid-cols-2">
              <EditorField label="未分配点数字段">
                <Input
                  value={allocation.pointAttributeKey}
                  onChange={(event) =>
                    updateAllocation({ pointAttributeKey: event.target.value })
                  }
                  placeholder="unspent_attribute_points"
                />
              </EditorField>
              <EditorField
                label="每级发放点数"
                hint="可填写数字，或填写表达式字符串作为后续运行时扩展入口。"
              >
                <Input
                  value={String(allocation.pointsPerLevel)}
                  onChange={(event) =>
                    updateAllocation({
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
                selectedValues={allocation.allocatableAttributes}
                onToggle={(nextValues) =>
                  updateAllocation({ allocatableAttributes: nextValues })
                }
                emptyMessage="当前没有可分配属性候选，请先检查主要属性配置。"
              />
            </EditorField>

            <div className="grid gap-3 lg:grid-cols-3">
              <EditorField label="单属性最小分配（可选）">
                <Input
                  type="number"
                  value={allocation.minPerAttribute ?? ""}
                  onChange={(event) =>
                    updateAllocation({
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
                  value={allocation.maxPerAttribute ?? ""}
                  onChange={(event) =>
                    updateAllocation({
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
                checked={allocation.allowDeferredAllocation}
                onCheckedChange={(checked) =>
                  updateAllocation({ allowDeferredAllocation: checked })
                }
              />
            </div>
          </Card>
        ) : null}

        <Card variant="outlined" className="space-y-4 p-4">
          <SectionHeader
            title="资源恢复"
            description="控制升级时当前资源值的刷新方式；这里只影响 current 值，不定义上限公式。"
          />

          <div className="grid gap-3 lg:grid-cols-2">
            <EditorField label="恢复模式">
              <Select
                value={resourceRecovery.mode}
                onValueChange={(nextValue) =>
                  updateResourceRecovery({
                    mode: nextValue as ResourceRecoveryConfig["mode"],
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
                selectedValues={resourceRecovery.resourceKeys}
                onToggle={(nextValues) =>
                  updateResourceRecovery({ resourceKeys: nextValues })
                }
                emptyMessage="当前还没有资源型衍生属性候选。"
              />
            </EditorField>
          </div>
        </Card>

        <Card variant="outlined" className="space-y-4 p-4">
          <SectionHeader
            title="叙事配置"
            description="控制升级是否允许 AI 主动触发、是否需要玩家确认，以及升级表现风格。"
          />

          <div className="grid gap-3 lg:grid-cols-2">
            <ToggleSetting
              title="允许 AI 触发升级"
              description="开启后，叙事系统可在满足世界观条件时建议或触发升级。"
              checked={narrative.allowAiTrigger}
              onCheckedChange={(checked) =>
                updateNarrative({ allowAiTrigger: checked })
              }
            />
            <ToggleSetting
              title="需要玩家确认"
              description="开启后，升级动作需要玩家显式确认后再继续结算。"
              checked={narrative.requirePlayerConfirmation}
              onCheckedChange={(checked) =>
                updateNarrative({ requirePlayerConfirmation: checked })
              }
            />
            <ToggleSetting
              title="写入系统日志"
              description="控制升级是否生成系统日志与显式的成长反馈记录。"
              checked={narrative.emitSystemLog}
              onCheckedChange={(checked) =>
                updateNarrative({ emitSystemLog: checked })
              }
            />
            <EditorField label="表现可见性">
              <Select
                value={narrative.visibility}
                onValueChange={(nextValue) =>
                  updateNarrative({
                    visibility: nextValue as NarrativeConfig["visibility"],
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

        <Card variant="outlined" className="space-y-4 p-4">
          <SectionHeader
            title="奖励配置"
            description="首版仅结构化维护自动发放开关；复杂奖励包仍通过本分区高级 JSON 兜底。"
          />

          <div className="grid gap-3 lg:grid-cols-2">
            <ToggleSetting
              title="自动发放奖励"
              description="关闭后，升级只记录等级变化与待处理状态，不立即自动结算奖励包。"
              checked={rewards.autoApply}
              onCheckedChange={(checked) =>
                onChange({
                  rewards: {
                    ...rewards,
                    autoApply: checked,
                  },
                })
              }
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
                  value={`${rewards.perLevel.length} 项`}
                />
                <StatusBadge
                  label="里程碑"
                  value={`${rewards.milestones.length} 项`}
                />
              </div>
            </div>
          </div>
        </Card>

        <LevelSystemValidationPanel warnings={validationWarnings} />

        <LevelSystemPreviewPanel
          growthMode={growthMode}
          triggerModes={triggerModes}
          progressAttributeKey={progress.progressAttributeKey}
          progressVisibility={progress.visibility}
          progressPreviewLabel={progressPreviewLabel}
          resourceRecoveryMode={resourceRecovery.mode}
          resourcePreviewLabel={resourcePreviewLabel}
          showAutoGrowth={showAutoGrowth}
          autoGrowthPreviewItems={autoGrowthPreviewItems}
          showAllocation={showAllocation}
          allocationPreviewLabel={allocationPreviewLabel}
          narrativePreviewItems={narrativePreviewItems}
        />
      </div>

      <ConfirmDialog
        open={pendingTemplate !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingTemplateId(null);
          }
        }}
        title="确认应用等级系统模板"
        description={
          pendingTemplate
            ? `将使用「${pendingTemplate.name}」覆盖当前等级系统中的基础、进度、成长、资源与叙事配置；复杂奖励包仍保留为当前高级 JSON 维护方式。`
            : ""
        }
        confirmText="应用模板"
        cancelText="取消"
        onConfirm={handleConfirmApplyTemplate}
        onCancel={() => setPendingTemplateId(null)}
      />
    </>
  );
}

function parseStringNumberInput(value: string): number | string | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  return NUMERIC_LITERAL_REGEX.test(trimmed) ? Number(trimmed) : trimmed;
}

function buildRecordPreviewEntries(
  value: Record<string, number | string> | undefined,
  labelMap: Map<string, string>,
): string[] {
  return Object.entries(value ?? {}).map(
    ([field, entry]) =>
      `${formatFieldLabel(field, labelMap)}：${formatGrowthValue(entry)}`,
  );
}

function buildAllocationPreview(
  allocation: AllocationConfig,
  labelMap: Map<string, string>,
): string {
  const parts = [
    `每级 ${formatStringNumberValue(allocation.pointsPerLevel ?? 1)} 点`,
  ];

  parts.push(
    `可分配到 ${buildKeyListPreview(allocation.allocatableAttributes, labelMap)}`,
  );
  parts.push(
    (allocation.allowDeferredAllocation ?? true)
      ? "允许延后分配"
      : "升级时需立即分配",
  );

  if (
    allocation.minPerAttribute !== undefined ||
    allocation.maxPerAttribute !== undefined
  ) {
    const minLabel =
      allocation.minPerAttribute === undefined
        ? "无限制"
        : String(allocation.minPerAttribute);
    const maxLabel =
      allocation.maxPerAttribute === undefined
        ? "无限制"
        : String(allocation.maxPerAttribute);
    parts.push(`单属性范围 ${minLabel} ~ ${maxLabel}`);
  }

  return parts.join("；");
}

function buildKeyListPreview(
  keys: string[] | undefined,
  labelMap: Map<string, string>,
): string {
  if (!keys || keys.length === 0) {
    return "未指定";
  }

  return keys.map((key) => formatFieldLabel(key, labelMap)).join("、");
}

function buildNarrativePreviewItems(narrative: NarrativeConfig): string[] {
  return [
    `AI 触发：${(narrative.allowAiTrigger ?? true) ? "允许" : "关闭"}`,
    `玩家确认：${(narrative.requirePlayerConfirmation ?? false) ? "需要" : "不需要"}`,
    `系统日志：${(narrative.emitSystemLog ?? true) ? "写入" : "不写入"}`,
    `表现可见性：${getNarrativeVisibilityLabel(narrative.visibility)}`,
  ];
}

function buildProgressPreview(progress: ProgressConfig): string {
  const thresholdLabel =
    (progress.thresholdMode ?? "table") === "formula"
      ? `公式：${progress.thresholdFormula?.trim() || "未填写"}`
      : `阈值表 ${progress.thresholdTable?.length ?? 0} 条`;

  return `${thresholdLabel}；${(progress.carryOverflow ?? true) ? "保留溢出进度" : "不保留溢出进度"}`;
}

function formatFieldLabel(key: string, labelMap: Map<string, string>): string {
  const label = labelMap.get(key);
  return label ? `${label}（${key}）` : key;
}

function formatGrowthValue(value: number | string): string {
  if (typeof value === "number") {
    return value > 0 ? `+${value}` : String(value);
  }

  return value;
}

function formatStringNumberValue(value: number | string): string {
  return typeof value === "number" ? String(value) : value;
}
