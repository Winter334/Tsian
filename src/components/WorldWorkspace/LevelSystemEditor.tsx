import { useMemo, useState } from "react";

import { ConfirmDialog } from "@/components/ui";
import type {
  DerivedStatConfig,
  LevelSystemConfig,
  PrimaryAttributeConfig,
} from "@/lib/world/types";
import {
  LevelSystemAllocationSection,
  LevelSystemAutoGrowthSection,
  LevelSystemBasicsSection,
  LevelSystemNarrativeSection,
  LevelSystemProgressSection,
  LevelSystemResourceRecoverySection,
  LevelSystemRewardsSection,
  type LevelSystemAllocationSectionValue,
  type LevelSystemAutoGrowthSectionValue,
  type LevelSystemNarrativeSectionValue,
  type LevelSystemProgressSectionValue,
  type LevelSystemResourceRecoverySectionValue,
  type LevelSystemRewardsSectionValue,
} from "./LevelSystemEditorFormSections";
import {
  LevelSystemPreviewPanel,
  LevelSystemValidationPanel,
  type SelectOption,
} from "./LevelSystemEditorSections";
import {
  buildAppliedLevelSystemTemplate,
  getNarrativeVisibilityLabel,
  LEVEL_SYSTEM_TEMPLATES,
  validateLevelSystemConfig,
  type LevelSystemTemplateId,
} from "./level-system-templates";

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
  const progress = useMemo<LevelSystemProgressSectionValue>(
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
  const autoGrowth = useMemo<LevelSystemAutoGrowthSectionValue>(
    () => ({
      perLevel: value.autoGrowth?.perLevel ?? {},
      milestoneGrowth: value.autoGrowth?.milestoneGrowth ?? [],
    }),
    [value.autoGrowth],
  );
  const allocation = useMemo<LevelSystemAllocationSectionValue>(
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
  const rewards = useMemo<LevelSystemRewardsSectionValue>(
    () => ({
      autoApply: value.rewards?.autoApply ?? true,
      perLevel: value.rewards?.perLevel ?? [],
      milestones: value.rewards?.milestones ?? [],
    }),
    [value.rewards],
  );
  const resourceRecovery = useMemo<LevelSystemResourceRecoverySectionValue>(
    () => ({
      mode: value.resourceRecovery?.mode ?? "delta",
      resourceKeys: value.resourceRecovery?.resourceKeys ?? [],
    }),
    [value.resourceRecovery],
  );
  const narrative = useMemo<LevelSystemNarrativeSectionValue>(
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

  const updateProgress = (
    updates: Partial<LevelSystemProgressSectionValue>,
  ) => {
    onChange({
      progress: {
        ...progress,
        ...updates,
      },
    });
  };

  const updateAutoGrowth = (
    updates: Partial<LevelSystemAutoGrowthSectionValue>,
  ) => {
    onChange({
      autoGrowth: {
        ...autoGrowth,
        ...updates,
      },
    });
  };

  const updateAllocation = (
    updates: Partial<LevelSystemAllocationSectionValue>,
  ) => {
    onChange({
      allocation: {
        ...allocation,
        ...updates,
      },
    });
  };

  const updateRewards = (updates: Partial<LevelSystemRewardsSectionValue>) => {
    onChange({
      rewards: {
        ...rewards,
        ...updates,
      },
    });
  };

  const updateResourceRecovery = (
    updates: Partial<LevelSystemResourceRecoverySectionValue>,
  ) => {
    onChange({
      resourceRecovery: {
        ...resourceRecovery,
        ...updates,
      },
    });
  };

  const updateNarrative = (
    updates: Partial<LevelSystemNarrativeSectionValue>,
  ) => {
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
        <LevelSystemBasicsSection
          enabled={enabled}
          growthMode={growthMode}
          levelAttributeKey={levelAttributeKey}
          triggerModes={triggerModes}
          selectedTemplateId={selectedTemplateId}
          templateDescriptionText={
            selectedTemplate?.description ??
            "选择模板后，可通过确认对话框将基础、进度、成长、资源与叙事配置快速覆盖到当前世界。"
          }
          canApplyTemplate={selectedTemplate !== null}
          onEnabledChange={(checked) => onChange({ enabled: checked })}
          onGrowthModeChange={(nextValue) =>
            onChange({ growthMode: nextValue })
          }
          onLevelAttributeKeyChange={(nextValue) =>
            onChange({ levelAttributeKey: nextValue })
          }
          onTriggerModesChange={(nextValues) =>
            onChange({ triggerModes: nextValues })
          }
          onSelectTemplate={setSelectedTemplateId}
          onApplyTemplate={handleRequestApplyTemplate}
        />

        <LevelSystemProgressSection
          value={progress}
          onChange={updateProgress}
        />

        {showAutoGrowth ? (
          <LevelSystemAutoGrowthSection
            value={autoGrowth}
            primaryAttributeOptions={primaryAttributeOptions}
            onChange={updateAutoGrowth}
          />
        ) : null}

        {showAllocation ? (
          <LevelSystemAllocationSection
            value={allocation}
            allocatableAttributeOptions={allocatableAttributeOptions}
            onChange={updateAllocation}
          />
        ) : null}

        <LevelSystemResourceRecoverySection
          value={resourceRecovery}
          resourceOptions={resourceOptions}
          onChange={updateResourceRecovery}
        />

        <LevelSystemNarrativeSection
          value={narrative}
          onChange={updateNarrative}
        />

        <LevelSystemRewardsSection value={rewards} onChange={updateRewards} />

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
  allocation: LevelSystemAllocationSectionValue,
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

function buildNarrativePreviewItems(
  narrative: LevelSystemNarrativeSectionValue,
): string[] {
  return [
    `AI 触发：${(narrative.allowAiTrigger ?? true) ? "允许" : "关闭"}`,
    `玩家确认：${(narrative.requirePlayerConfirmation ?? false) ? "需要" : "不需要"}`,
    `系统日志：${(narrative.emitSystemLog ?? true) ? "写入" : "不写入"}`,
    `表现可见性：${getNarrativeVisibilityLabel(narrative.visibility)}`,
  ];
}

function buildProgressPreview(
  progress: LevelSystemProgressSectionValue,
): string {
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
