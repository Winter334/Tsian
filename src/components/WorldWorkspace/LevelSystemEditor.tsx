import type {
  LevelSystemConfig,
  PrimaryAttributeConfig,
} from "@/lib/world/types";
import { useMemo } from "react";
import {
  LevelSystemAllocationSection,
  LevelSystemAutoGrowthSection,
  LevelSystemBasicsSection,
  LevelSystemProgressSection,
  LevelSystemRewardsSection,
  type LevelSystemAllocationSectionValue,
  type LevelSystemAutoGrowthSectionValue,
  type LevelSystemProgressSectionValue,
  type LevelSystemRewardsSectionValue,
} from "./LevelSystemEditorFormSections";
import {
  LevelSystemValidationPanel,
  type SelectOption,
} from "./LevelSystemEditorSections";
import { validateLevelSystemConfig } from "./level-system-validation";

interface LevelSystemEditorProps {
  value: LevelSystemConfig;
  primaryAttributes: PrimaryAttributeConfig[];
  onChange: (partial: Partial<LevelSystemConfig>) => void;
}

export function LevelSystemEditor({
  value,
  primaryAttributes,
  onChange,
}: LevelSystemEditorProps) {
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
      levels: value.progress?.levels ?? [],
      carryOverflow: value.progress?.carryOverflow ?? true,
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
      perLevel: value.rewards?.perLevel ?? [],
      milestones: value.rewards?.milestones ?? [],
    }),
    [value.rewards],
  );

  const primaryAttributeOptions = useMemo<SelectOption[]>(
    () =>
      primaryAttributes.map((attribute) => ({
        value: attribute.key,
        label: `${attribute.label}（${attribute.key}）`,
      })),
    [primaryAttributes],
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

  const resolvedLevelSystem = useMemo<LevelSystemConfig>(
    () => ({
      ...value,
      levelAttributeKey,
      triggerModes,
      growthMode,
      progress,
      autoGrowth,
      allocation,
      rewards,
    }),
    [
      allocation,
      autoGrowth,
      growthMode,
      levelAttributeKey,
      progress,
      rewards,
      triggerModes,
      value,
    ],
  );

  const validationWarnings = useMemo(
    () => validateLevelSystemConfig(resolvedLevelSystem, primaryAttributes),
    [primaryAttributes, resolvedLevelSystem],
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

  const showAutoGrowth = growthMode === "auto" || growthMode === "hybrid";
  const showAllocation = growthMode === "allocation" || growthMode === "hybrid";

  return (
    <>
      <div className="space-y-4">
        <LevelSystemBasicsSection
          growthMode={growthMode}
          levelAttributeKey={levelAttributeKey}
          triggerModes={triggerModes}
          onGrowthModeChange={(nextValue) =>
            onChange({ growthMode: nextValue })
          }
          onLevelAttributeKeyChange={(nextValue) =>
            onChange({ levelAttributeKey: nextValue })
          }
          onTriggerModesChange={(nextValues) =>
            onChange({ triggerModes: nextValues })
          }
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

        <LevelSystemRewardsSection value={rewards} />

        <LevelSystemValidationPanel warnings={validationWarnings} />
      </div>
    </>
  );
}
