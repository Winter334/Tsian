/**
 * 世界编辑面板
 */

import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  Plus,
  Trash2,
  WandSparkles,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  Card as BaseCard,
  Button,
  Input,
  Panel,
  ScrollArea,
  Select,
  Textarea,
  Toggle,
} from "@/components/ui";
import type { PassiveModifier } from "@/domain/types/rule-script";
import { cn } from "@/lib/utils";
import type {
  CharacterDimension,
  ConditionConfig,
  DerivedStatConfig,
  DimensionOption,
  PointBuyRules,
  PrimaryAttributeConfig,
  TalentConfig,
  World,
  WorldNarrativeSeed,
} from "@/lib/world/types";

import { color, colorAlpha } from "@/styles/tokens";
import type {
  WorldRulesEditorScope,
  WorldScopedRulesEditorScope,
} from "./hooks/useWorldWorkspaceState";

const TALENT_CATEGORY_OPTIONS = [
  { value: "combat", label: "战斗" },
  { value: "magic", label: "魔法" },
  { value: "survival", label: "生存" },
  { value: "social", label: "社交" },
  { value: "misc", label: "其他" },
] as const;

const CONDITION_TRIGGER_MODE_OPTIONS = [
  { value: "ai", label: "AI 管理" },
  { value: "turn_start", label: "回合开始自动触发" },
  { value: "on_damage", label: "受伤时触发" },
  { value: "passive", label: "被动触发" },
] as const;

const EMPTY_PRIMARY_ATTRIBUTES: PrimaryAttributeConfig[] = [];
const EMPTY_DERIVED_STATS: DerivedStatConfig[] = [];
const EMPTY_DIMENSIONS: CharacterDimension[] = [];
const EMPTY_TALENTS: TalentConfig[] = [];
const EMPTY_CONDITIONS: ConditionConfig[] = [];
const EMPTY_PASSIVE_MODIFIERS: PassiveModifier[] = [];
const EMPTY_NUMERIC_RECORD: Record<string, number> = {};

const EDITOR_CARD_HOVER_STYLE = {
  scale: 1,
  y: 0,
  borderColor: colorAlpha("primary", 0.52),
} as const;

const MASTER_DETAIL_LIST_PANEL_CLASS =
  "max-h-72 overflow-y-auto p-3 sm:max-h-80 xl:flex xl:h-full xl:min-h-0 xl:max-h-none xl:flex-col xl:overflow-hidden xl:[&>div]:flex xl:[&>div]:min-h-0 xl:[&>div]:flex-1 xl:[&>div]:flex-col";

const MASTER_DETAIL_LIST_CONTENT_CLASS =
  "space-y-2 xl:flex-1 xl:min-h-0 xl:overflow-y-auto";

type WorkspaceEditorCardProps = {
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "elevated" | "outlined";
};

type CheckRulesValue = World["rules"]["checkRules"];
type TalentRulesValue = NonNullable<World["rules"]["talentRules"]>;
type DCPresetConfig = NonNullable<CheckRulesValue["dcPresets"]>[string];
type OpposedPresetConfig = NonNullable<
  CheckRulesValue["opposedPresets"]
>[string];
type DCGuidelineScaleItem = NonNullable<
  NonNullable<CheckRulesValue["dcGuideline"]>["scale"]
>[number];
type ConditionTriggerMode =
  | "ai"
  | NonNullable<ConditionConfig["trigger"]>["timing"];
type NumericFieldEntry = {
  field: string;
  value: number | "";
};
type DimensionCardTabId = "settings" | "options";

type WorldEditorSectionId =
  | "meta"
  | "narrative"
  | "attributes"
  | "derivedStats"
  | "checkRules"
  | "conditions"
  | "dimensions"
  | "talents";

type WorldEditorSectionDefinition = {
  id: WorldEditorSectionId;
  title: string;
  description: string;
};

const WORLD_EDITOR_SECTIONS: WorldEditorSectionDefinition[] = [
  {
    id: "meta",
    title: "基础信息",
    description: "维护作者态世界元信息与说明。",
  },
  {
    id: "narrative",
    title: "叙事启动",
    description: "编辑 script / opening 作者态种子。",
  },
  {
    id: "attributes",
    title: "属性与点数",
    description: "配置主要属性与角色创建点数规则。",
  },
  {
    id: "derivedStats",
    title: "衍生属性",
    description: "配置公式、边界、UI 显示与资源字段。",
  },
  {
    id: "checkRules",
    title: "检定规则",
    description: "配置默认骰、阈值、DC 预设与 AI 难度参考。",
  },
  {
    id: "conditions",
    title: "状态",
    description: "维护状态名称、持续时间与基础触发模式。",
  },
  {
    id: "dimensions",
    title: "角色维度",
    description: "配置种族、背景等创建维度与选项。",
  },
  {
    id: "talents",
    title: "天赋",
    description: "维护可选天赋与基础前置规则。",
  },
];

type RawRulesEditorMeta = {
  title: string;
  description: string;
  footnote: string;
};

const SCOPED_RAW_RULES_EDITOR_META: Record<
  WorldScopedRulesEditorScope,
  RawRulesEditorMeta
> = {
  attributes: {
    title: "高级模式 · 属性与点数规则编辑",
    description:
      "仅展示并回写 primaryAttributes / pointBuyRules 子树；应用时会合并回完整 rules，并继续复用标准化校验路径。",
    footnote:
      "只影响当前分区对应的规则子树，其余规则分支、基础信息与叙事启动保持不变。",
  },
  derivedStats: {
    title: "高级模式 · 衍生属性规则编辑",
    description:
      "仅展示并回写 derivedStats 子树；应用时会合并回完整 rules，并继续复用标准化校验路径。",
    footnote:
      "只影响当前分区对应的规则子树，其余规则分支、基础信息与叙事启动保持不变。",
  },
  checkRules: {
    title: "高级模式 · 检定规则编辑",
    description:
      "仅展示并回写 checkRules 子树；结构化表单未覆盖的复杂字段仍可直接修改 JSON。",
    footnote:
      "只影响当前分区对应的规则子树，其余规则分支、基础信息与叙事启动保持不变。",
  },
  conditions: {
    title: "高级模式 · 状态规则编辑",
    description:
      "仅展示并回写 conditions 子树；基础 passive 属性修正已结构化，复杂 trigger / 非 stat modifiers / actions 继续通过 JSON 兜底。",
    footnote:
      "只影响当前分区对应的规则子树，其余规则分支、基础信息与叙事启动保持不变。",
  },
  dimensions: {
    title: "高级模式 · 角色维度规则编辑",
    description:
      "仅展示并回写 dimensions 子树；不会覆盖其他规则分支，继续复用作者态草稿与标准化逻辑。",
    footnote:
      "只影响当前分区对应的规则子树，其余规则分支、基础信息与叙事启动保持不变。",
  },
  talents: {
    title: "高级模式 · 天赋规则编辑",
    description:
      "仅展示并回写 talents / talentRules 子树；前置属性条件与选择规则已结构化，复杂 modifiers 继续通过 JSON 兜底。",
    footnote:
      "只影响当前分区对应的规则子树，其余规则分支、基础信息与叙事启动保持不变。",
  },
};

function getRawRulesEditorMeta(
  scope: WorldRulesEditorScope,
): RawRulesEditorMeta {
  if (scope === "full") {
    return {
      title: "高级模式 · 全量规则编辑",
      description:
        "用于当前版本尚未结构化的复杂规则块，直接编辑完整 rules JSON，并继续复用作者态草稿与基础 schema 校验。",
      footnote:
        "全量模式直接编辑整份 WorldConfig rules；高级规则字段请自行确认。",
    };
  }

  return SCOPED_RAW_RULES_EDITOR_META[scope];
}

interface WorldEditorPaneProps {
  world: World | null;
  validationMessages: string[];
  rawRulesEditorOpen: boolean;
  rawRulesEditorScope: WorldRulesEditorScope;
  rawRulesText: string;
  rawRulesError: string | null;
  onOpenRawRulesEditor: (scope: WorldRulesEditorScope) => void;
  onCloseRawRulesEditor: () => void;
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
  onUpdateCheckRules: (updates: Partial<CheckRulesValue>) => void;
  onAddDcPreset: () => void;
  onUpdateDcPreset: (
    presetKey: string,
    updates: Partial<DCPresetConfig>,
  ) => void;
  onRemoveDcPreset: (presetKey: string) => void;
  onAddOpposedPreset: () => void;
  onUpdateOpposedPreset: (
    presetKey: string,
    updates: Partial<OpposedPresetConfig>,
  ) => void;
  onRemoveOpposedPreset: (presetKey: string) => void;
  onAddDCGuidelineItem: () => void;
  onUpdateDCGuidelineItem: (
    index: number,
    updates: Partial<DCGuidelineScaleItem>,
  ) => void;
  onRemoveDCGuidelineItem: (index: number) => void;
  onUpdateDerivedStat: (
    index: number,
    updates: Partial<DerivedStatConfig>,
  ) => void;
  onAddDerivedStat: () => void;
  onRemoveDerivedStat: (index: number) => void;
  onUpdateCondition: (index: number, updates: Partial<ConditionConfig>) => void;
  onAddCondition: () => void;
  onRemoveCondition: (index: number) => void;
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
  onUpdateTalentRules: (updates: Partial<TalentRulesValue>) => void;
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
  rawRulesEditorScope,
  rawRulesText,
  rawRulesError,
  onOpenRawRulesEditor,
  onCloseRawRulesEditor,
  onUpdateMeta,
  onUpdateNarrative,
  onUpdatePrimaryAttribute,
  onAddPrimaryAttribute,
  onRemovePrimaryAttribute,
  onUpdatePointBuyRules,
  onUpdateCheckRules,
  onAddDcPreset,
  onUpdateDcPreset,
  onRemoveDcPreset,
  onAddOpposedPreset,
  onUpdateOpposedPreset,
  onRemoveOpposedPreset,
  onAddDCGuidelineItem,
  onUpdateDCGuidelineItem,
  onRemoveDCGuidelineItem,
  onUpdateDerivedStat,
  onAddDerivedStat,
  onRemoveDerivedStat,
  onUpdateCondition,
  onAddCondition,
  onRemoveCondition,
  onUpdateDimension,
  onAddDimension,
  onRemoveDimension,
  onUpdateDimensionOption,
  onAddDimensionOption,
  onRemoveDimensionOption,
  onUpdateTalentRules,
  onUpdateTalent,
  onAddTalent,
  onRemoveTalent,
  onSetRawRulesText,
  onApplyRawRulesText,
}: WorldEditorPaneProps) {
  const [activeSection, setActiveSection] =
    useState<WorldEditorSectionId>("meta");
  const [activeAttributeIndex, setActiveAttributeIndex] = useState(0);
  const [activeDerivedStatIndex, setActiveDerivedStatIndex] = useState(0);
  const [activeConditionIndex, setActiveConditionIndex] = useState(0);
  const [activeTalentIndex, setActiveTalentIndex] = useState(0);
  const [activeDimensionIndex, setActiveDimensionIndex] = useState(0);
  const attributeDetailRef = useRef<HTMLDivElement>(null);
  const attributeLabelInputRef = useRef<HTMLInputElement>(null);
  const derivedStatDetailRef = useRef<HTMLDivElement>(null);
  const derivedStatLabelInputRef = useRef<HTMLInputElement>(null);
  const conditionDetailRef = useRef<HTMLDivElement>(null);
  const conditionNameInputRef = useRef<HTMLInputElement>(null);
  const talentDetailRef = useRef<HTMLDivElement>(null);
  const talentNameInputRef = useRef<HTMLInputElement>(null);

  const primaryAttributes =
    world?.rules.primaryAttributes ?? EMPTY_PRIMARY_ATTRIBUTES;
  const derivedStats = world?.rules.derivedStats ?? EMPTY_DERIVED_STATS;
  const checkRules: CheckRulesValue = world?.rules.checkRules ?? {};
  const conditions = world?.rules.conditions ?? EMPTY_CONDITIONS;
  const dimensions = world?.rules.dimensions ?? EMPTY_DIMENSIONS;
  const talents = world?.rules.talents ?? EMPTY_TALENTS;
  const talentRules = world?.rules.talentRules;
  const statFieldOptions = useMemo(
    () => [
      ...primaryAttributes.map((attribute) => ({
        value: attribute.key,
        label: `${attribute.label}（主要属性）`,
      })),
      ...derivedStats.map((stat) => ({
        value: stat.key,
        label: `${stat.label}（衍生属性）`,
      })),
    ],
    [derivedStats, primaryAttributes],
  );

  useEffect(() => {
    setActiveSection("meta");
  }, [world?.id]);

  useEffect(() => {
    setActiveAttributeIndex(0);
  }, [world?.id]);

  useEffect(() => {
    setActiveDerivedStatIndex(0);
  }, [world?.id]);

  useEffect(() => {
    setActiveConditionIndex(0);
  }, [world?.id]);

  useEffect(() => {
    setActiveTalentIndex(0);
  }, [world?.id]);

  useEffect(() => {
    setActiveDimensionIndex(0);
  }, [world?.id]);

  const allocatableAttributeOptions = useMemo(
    () =>
      (world?.rules.primaryAttributes ?? []).map((attribute) => ({
        value: attribute.key,
        label: `${attribute.label} (${attribute.key})`,
      })),
    [world],
  );

  const activeSectionMeta = useMemo(
    () =>
      WORLD_EDITOR_SECTIONS.find((section) => section.id === activeSection) ??
      WORLD_EDITOR_SECTIONS[0],
    [activeSection],
  );
  const rawRulesEditorMeta = getRawRulesEditorMeta(rawRulesEditorScope);
  const dcPresetEntries = Object.entries(checkRules?.dcPresets ?? {});
  const opposedPresetEntries = Object.entries(checkRules?.opposedPresets ?? {});
  const dcGuidelineScale = checkRules?.dcGuideline?.scale ?? [];
  const resolvedActiveAttributeIndex =
    primaryAttributes.length === 0
      ? -1
      : Math.min(activeAttributeIndex, primaryAttributes.length - 1);
  const activeAttribute =
    resolvedActiveAttributeIndex >= 0
      ? primaryAttributes[resolvedActiveAttributeIndex]
      : null;
  const resolvedActiveDerivedStatIndex =
    derivedStats.length === 0
      ? -1
      : Math.min(activeDerivedStatIndex, derivedStats.length - 1);
  const activeDerivedStat =
    resolvedActiveDerivedStatIndex >= 0
      ? derivedStats[resolvedActiveDerivedStatIndex]
      : null;
  const resolvedActiveConditionIndex =
    conditions.length === 0
      ? -1
      : Math.min(activeConditionIndex, conditions.length - 1);
  const activeCondition =
    resolvedActiveConditionIndex >= 0
      ? conditions[resolvedActiveConditionIndex]
      : null;
  const resolvedActiveTalentIndex =
    talents.length === 0 ? -1 : Math.min(activeTalentIndex, talents.length - 1);
  const activeTalent =
    resolvedActiveTalentIndex >= 0 ? talents[resolvedActiveTalentIndex] : null;
  const resolvedActiveDimensionIndex =
    dimensions.length === 0
      ? -1
      : Math.min(activeDimensionIndex, dimensions.length - 1);
  const activeDimension =
    resolvedActiveDimensionIndex >= 0
      ? dimensions[resolvedActiveDimensionIndex]
      : null;

  useEffect(() => {
    if (primaryAttributes.length === 0) {
      if (activeAttributeIndex !== 0) {
        setActiveAttributeIndex(0);
      }
      return;
    }

    if (activeAttributeIndex > primaryAttributes.length - 1) {
      setActiveAttributeIndex(primaryAttributes.length - 1);
    }
  }, [activeAttributeIndex, primaryAttributes.length]);

  useEffect(() => {
    if (activeSection !== "attributes" || resolvedActiveAttributeIndex < 0) {
      return;
    }

    const animationFrameId = window.requestAnimationFrame(() => {
      attributeDetailRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "nearest",
      });
      attributeLabelInputRef.current?.focus({ preventScroll: true });
    });

    return () => window.cancelAnimationFrame(animationFrameId);
  }, [activeSection, resolvedActiveAttributeIndex, primaryAttributes.length]);

  useEffect(() => {
    if (derivedStats.length === 0) {
      if (activeDerivedStatIndex !== 0) {
        setActiveDerivedStatIndex(0);
      }
      return;
    }

    if (activeDerivedStatIndex > derivedStats.length - 1) {
      setActiveDerivedStatIndex(derivedStats.length - 1);
    }
  }, [activeDerivedStatIndex, derivedStats.length]);

  useEffect(() => {
    if (
      activeSection !== "derivedStats" ||
      resolvedActiveDerivedStatIndex < 0
    ) {
      return;
    }

    const animationFrameId = window.requestAnimationFrame(() => {
      derivedStatDetailRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "nearest",
      });
      derivedStatLabelInputRef.current?.focus({ preventScroll: true });
    });

    return () => window.cancelAnimationFrame(animationFrameId);
  }, [activeSection, derivedStats.length, resolvedActiveDerivedStatIndex]);

  useEffect(() => {
    if (conditions.length === 0) {
      if (activeConditionIndex !== 0) {
        setActiveConditionIndex(0);
      }
      return;
    }

    if (activeConditionIndex > conditions.length - 1) {
      setActiveConditionIndex(conditions.length - 1);
    }
  }, [activeConditionIndex, conditions.length]);

  useEffect(() => {
    if (activeSection !== "conditions" || resolvedActiveConditionIndex < 0) {
      return;
    }

    const animationFrameId = window.requestAnimationFrame(() => {
      conditionDetailRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "nearest",
      });
      conditionNameInputRef.current?.focus({ preventScroll: true });
    });

    return () => window.cancelAnimationFrame(animationFrameId);
  }, [activeSection, conditions.length, resolvedActiveConditionIndex]);

  useEffect(() => {
    if (talents.length === 0) {
      if (activeTalentIndex !== 0) {
        setActiveTalentIndex(0);
      }
      return;
    }

    if (activeTalentIndex > talents.length - 1) {
      setActiveTalentIndex(talents.length - 1);
    }
  }, [activeTalentIndex, talents.length]);

  useEffect(() => {
    if (activeSection !== "talents" || resolvedActiveTalentIndex < 0) {
      return;
    }

    const animationFrameId = window.requestAnimationFrame(() => {
      talentDetailRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "nearest",
      });
      talentNameInputRef.current?.focus({ preventScroll: true });
    });

    return () => window.cancelAnimationFrame(animationFrameId);
  }, [activeSection, resolvedActiveTalentIndex, talents.length]);

  useEffect(() => {
    if (dimensions.length === 0) {
      if (activeDimensionIndex !== 0) {
        setActiveDimensionIndex(0);
      }
      return;
    }

    if (activeDimensionIndex > dimensions.length - 1) {
      setActiveDimensionIndex(dimensions.length - 1);
    }
  }, [activeDimensionIndex, dimensions.length]);

  const handleAddPrimaryAttribute = () => {
    onAddPrimaryAttribute();
    setActiveAttributeIndex(primaryAttributes.length);
  };

  const handleRemovePrimaryAttribute = (attributeIndex: number) => {
    onRemovePrimaryAttribute(attributeIndex);
    setActiveAttributeIndex((currentIndex) => {
      if (primaryAttributes.length <= 1) {
        return 0;
      }

      if (currentIndex > attributeIndex) {
        return currentIndex - 1;
      }

      if (currentIndex === attributeIndex) {
        return Math.min(attributeIndex, primaryAttributes.length - 2);
      }

      return currentIndex;
    });
  };

  const handleAddDerivedStat = () => {
    onAddDerivedStat();
    setActiveDerivedStatIndex(derivedStats.length);
  };

  const handleRemoveDerivedStat = (statIndex: number) => {
    onRemoveDerivedStat(statIndex);
    setActiveDerivedStatIndex((currentIndex) => {
      if (derivedStats.length <= 1) {
        return 0;
      }

      if (currentIndex > statIndex) {
        return currentIndex - 1;
      }

      if (currentIndex === statIndex) {
        return Math.min(statIndex, derivedStats.length - 2);
      }

      return currentIndex;
    });
  };

  const handleAddCondition = () => {
    onAddCondition();
    setActiveConditionIndex(conditions.length);
  };

  const handleRemoveCondition = (conditionIndex: number) => {
    onRemoveCondition(conditionIndex);
    setActiveConditionIndex((currentIndex) => {
      if (conditions.length <= 1) {
        return 0;
      }

      if (currentIndex > conditionIndex) {
        return currentIndex - 1;
      }

      if (currentIndex === conditionIndex) {
        return Math.min(conditionIndex, conditions.length - 2);
      }

      return currentIndex;
    });
  };

  const handleAddTalent = () => {
    onAddTalent();
    setActiveTalentIndex(talents.length);
  };

  const handleRemoveTalent = (talentIndex: number) => {
    onRemoveTalent(talentIndex);
    setActiveTalentIndex((currentIndex) => {
      if (talents.length <= 1) {
        return 0;
      }

      if (currentIndex > talentIndex) {
        return currentIndex - 1;
      }

      if (currentIndex === talentIndex) {
        return Math.min(talentIndex, talents.length - 2);
      }

      return currentIndex;
    });
  };

  const handleAddDimension = () => {
    onAddDimension();
    setActiveDimensionIndex(dimensions.length);
  };

  const handleRemoveDimension = (dimensionIndex: number) => {
    onRemoveDimension(dimensionIndex);
    setActiveDimensionIndex((currentIndex) => {
      if (dimensions.length <= 1) {
        return 0;
      }

      if (currentIndex > dimensionIndex) {
        return currentIndex - 1;
      }

      if (currentIndex === dimensionIndex) {
        return Math.max(dimensionIndex - 1, 0);
      }

      return currentIndex;
    });
  };

  if (!world) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center">
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
            工作台只编辑作者态 World
          </p>
        </div>
      </div>
    );
  }

  let sectionContent: React.ReactNode;

  switch (activeSection) {
    case "meta":
      sectionContent = (
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
      );
      break;

    case "narrative":
      sectionContent = (
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
      );
      break;

    case "attributes":
      sectionContent = (
        <FormSection
          title="属性与点数"
          description="覆盖角色创建最关键的主要属性与 point buy 规则。"
          action={
            <div className="flex flex-wrap gap-2">
              <SectionRulesEditorButton
                scope="attributes"
                active={
                  rawRulesEditorOpen && rawRulesEditorScope === "attributes"
                }
                onOpen={onOpenRawRulesEditor}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleAddPrimaryAttribute}
              >
                <Plus className="mr-1 h-4 w-4" />
                添加属性
              </Button>
            </div>
          }
        >
          {primaryAttributes.length > 0 ? (
            <div className="grid gap-3 xl:h-168 xl:grid-cols-[minmax(260px,320px)_minmax(0,1fr)] 2xl:grid-cols-[minmax(280px,360px)_minmax(0,1fr)]">
              <Panel
                variant="outlined"
                className={MASTER_DETAIL_LIST_PANEL_CLASS}
              >
                <div
                  className={MASTER_DETAIL_LIST_CONTENT_CLASS}
                  role="tablist"
                  aria-label="主要属性切换"
                >
                  {primaryAttributes.map((attribute, index) => {
                    const isActive = resolvedActiveAttributeIndex === index;
                    const attributeTitle =
                      attribute.label.trim() ||
                      attribute.key.trim() ||
                      `未命名属性 ${index + 1}`;
                    const attributeDescription =
                      attribute.description?.trim() ?? "";
                    const rangeText =
                      attribute.min !== undefined || attribute.max !== undefined
                        ? `范围 ${attribute.min ?? "未设"} ~ ${attribute.max ?? "未设"}`
                        : "未设置上下限";

                    return (
                      <button
                        key={`${attribute.key || "attribute"}-${index}`}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        onClick={() => setActiveAttributeIndex(index)}
                        className="w-full rounded-xl border px-3 py-3 text-left transition-all duration-150"
                        style={{
                          borderColor: colorAlpha(
                            isActive ? "primary" : "border",
                            isActive ? 0.42 : 0.28,
                          ),
                          background: colorAlpha(
                            isActive ? "primary" : "bgCard",
                            isActive ? 0.12 : 0.16,
                          ),
                          boxShadow: isActive
                            ? `0 0 18px ${colorAlpha("primary", 0.12)}`
                            : "none",
                        }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p
                              className="wrap-break-word text-sm font-medium leading-5"
                              style={{
                                color: isActive
                                  ? color("primary")
                                  : color("textPrimary"),
                              }}
                              title={attributeTitle}
                            >
                              {attributeTitle}
                            </p>
                            <p
                              className="mt-1 text-[11px]"
                              style={{ color: colorAlpha("textMuted", 0.74) }}
                            >
                              Key：{attribute.key || "未设置"}
                            </p>
                          </div>
                          <span
                            className="shrink-0 rounded-full border px-2 py-0.5 text-[11px]"
                            style={{
                              borderColor: colorAlpha(
                                isActive ? "primary" : "border",
                                isActive ? 0.36 : 0.28,
                              ),
                              color: isActive
                                ? color("primary")
                                : colorAlpha("textMuted", 0.76),
                            }}
                          >
                            {isActive ? "当前" : `#${index + 1}`}
                          </span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <DimensionMetaBadge
                            label="默认"
                            value={String(attribute.defaultValue)}
                            accent
                          />
                          <DimensionMetaBadge label="范围" value={rangeText} />
                        </div>
                        <p
                          className="mt-2 text-[11px] leading-5"
                          style={{
                            color: colorAlpha(
                              "textMuted",
                              isActive ? 0.82 : 0.72,
                            ),
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                          }}
                          title={attributeDescription || "当前属性尚未填写说明"}
                        >
                          {attributeDescription || "当前属性尚未填写说明"}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </Panel>

              {activeAttribute ? (
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    ref={attributeDetailRef}
                    key={`attribute-${resolvedActiveAttributeIndex}`}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.14 }}
                    className="space-y-3 xl:h-full xl:min-h-0 xl:overflow-y-auto xl:pr-1"
                  >
                    <Panel variant="outlined" className="p-3 sm:p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 flex-1">
                          <p
                            className="text-xs font-medium uppercase tracking-[0.2em]"
                            style={{ color: colorAlpha("primary", 0.82) }}
                          >
                            当前详情
                          </p>
                          <h5
                            className="mt-2 wrap-break-word text-sm font-semibold leading-6"
                            style={{ color: color("textPrimary") }}
                            title={
                              activeAttribute.label.trim() ||
                              activeAttribute.key.trim() ||
                              `未命名属性 ${resolvedActiveAttributeIndex + 1}`
                            }
                          >
                            {activeAttribute.label.trim() ||
                              activeAttribute.key.trim() ||
                              `未命名属性 ${resolvedActiveAttributeIndex + 1}`}
                          </h5>
                          <p
                            className="mt-2 text-xs leading-5"
                            style={{ color: colorAlpha("textMuted", 0.74) }}
                          >
                            {activeAttribute.description?.trim() ||
                              "当前属性尚未填写说明，可直接在下方详情中补充。"}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <DimensionMetaBadge
                            label="Key"
                            value={activeAttribute.key || "未设置"}
                            mono
                          />
                          <DimensionMetaBadge
                            label="默认"
                            value={String(activeAttribute.defaultValue)}
                            accent
                          />
                        </div>
                      </div>
                    </Panel>

                    <AttributeCard
                      attribute={activeAttribute}
                      labelInputRef={attributeLabelInputRef}
                      onChange={(updates) =>
                        onUpdatePrimaryAttribute(
                          resolvedActiveAttributeIndex,
                          updates,
                        )
                      }
                      onRemove={() =>
                        handleRemovePrimaryAttribute(
                          resolvedActiveAttributeIndex,
                        )
                      }
                    />
                  </motion.div>
                </AnimatePresence>
              ) : null}
            </div>
          ) : (
            <EmptySectionHint message="当前还没有主要属性，可先添加基础属性，再配置点数分配规则。" />
          )}

          <PointBuyPanel
            value={world.rules.pointBuyRules}
            allocatableOptions={allocatableAttributeOptions}
            onChange={onUpdatePointBuyRules}
          />
        </FormSection>
      );
      break;

    case "derivedStats":
      sectionContent = (
        <FormSection
          title="衍生属性"
          description="面向作者态编辑公式、边界、显示开关与资源字段，不改运行时消费边界。"
          action={
            <div className="flex flex-wrap gap-2">
              <SectionRulesEditorButton
                scope="derivedStats"
                active={
                  rawRulesEditorOpen && rawRulesEditorScope === "derivedStats"
                }
                onOpen={onOpenRawRulesEditor}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleAddDerivedStat}
              >
                <Plus className="mr-1 h-4 w-4" />
                添加衍生属性
              </Button>
            </div>
          }
        >
          {derivedStats.length > 0 ? (
            <div className="grid gap-3 xl:h-168 xl:grid-cols-[minmax(260px,320px)_minmax(0,1fr)] 2xl:grid-cols-[minmax(280px,360px)_minmax(0,1fr)]">
              <Panel
                variant="outlined"
                className={MASTER_DETAIL_LIST_PANEL_CLASS}
              >
                <div
                  className={MASTER_DETAIL_LIST_CONTENT_CLASS}
                  role="tablist"
                  aria-label="衍生属性切换"
                >
                  {derivedStats.map((stat, index) => {
                    const isActive = resolvedActiveDerivedStatIndex === index;
                    const statTitle =
                      stat.label.trim() ||
                      stat.key.trim() ||
                      `未命名衍生属性 ${index + 1}`;
                    const categoryText = stat.category ?? "未分类";
                    const maxFieldText = stat.maxField?.trim() || "未绑定";

                    return (
                      <button
                        key={`${stat.key || "derived-stat"}-${index}`}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        onClick={() => setActiveDerivedStatIndex(index)}
                        className="w-full rounded-xl border px-3 py-3 text-left transition-all duration-150"
                        style={{
                          borderColor: colorAlpha(
                            isActive ? "primary" : "border",
                            isActive ? 0.42 : 0.28,
                          ),
                          background: colorAlpha(
                            isActive ? "primary" : "bgCard",
                            isActive ? 0.12 : 0.16,
                          ),
                          boxShadow: isActive
                            ? `0 0 18px ${colorAlpha("primary", 0.12)}`
                            : "none",
                        }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p
                              className="wrap-break-word text-sm font-medium leading-5"
                              style={{
                                color: isActive
                                  ? color("primary")
                                  : color("textPrimary"),
                              }}
                              title={statTitle}
                            >
                              {statTitle}
                            </p>
                            <p
                              className="mt-1 text-[11px]"
                              style={{ color: colorAlpha("textMuted", 0.74) }}
                            >
                              Key：{stat.key || "未设置"}
                            </p>
                          </div>
                          <span
                            className="shrink-0 rounded-full border px-2 py-0.5 text-[11px]"
                            style={{
                              borderColor: colorAlpha(
                                isActive ? "primary" : "border",
                                isActive ? 0.36 : 0.28,
                              ),
                              color: isActive
                                ? color("primary")
                                : colorAlpha("textMuted", 0.76),
                            }}
                          >
                            {isActive ? "当前" : `#${index + 1}`}
                          </span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <DimensionMetaBadge
                            label="分类"
                            value={categoryText}
                          />
                          <DimensionMetaBadge
                            label="资源"
                            value={stat.isResource ? "是" : "否"}
                            accent={stat.isResource ?? false}
                          />
                          <DimensionMetaBadge
                            label="上限字段"
                            value={maxFieldText}
                          />
                        </div>
                        <p
                          className="mt-2 text-[11px] leading-5"
                          style={{
                            color: colorAlpha(
                              "textMuted",
                              isActive ? 0.82 : 0.72,
                            ),
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                          }}
                          title={stat.formula || "当前衍生属性尚未填写公式"}
                        >
                          {stat.formula || "当前衍生属性尚未填写公式"}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </Panel>

              {activeDerivedStat ? (
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    ref={derivedStatDetailRef}
                    key={`derived-stat-${resolvedActiveDerivedStatIndex}`}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.14 }}
                    className="space-y-3 xl:h-full xl:min-h-0 xl:overflow-y-auto xl:pr-1"
                  >
                    <Panel variant="outlined" className="p-3 sm:p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 flex-1">
                          <p
                            className="text-xs font-medium uppercase tracking-[0.2em]"
                            style={{ color: colorAlpha("primary", 0.82) }}
                          >
                            当前详情
                          </p>
                          <h5
                            className="mt-2 wrap-break-word text-sm font-semibold leading-6"
                            style={{ color: color("textPrimary") }}
                            title={
                              activeDerivedStat.label.trim() ||
                              activeDerivedStat.key.trim() ||
                              `未命名衍生属性 ${resolvedActiveDerivedStatIndex + 1}`
                            }
                          >
                            {activeDerivedStat.label.trim() ||
                              activeDerivedStat.key.trim() ||
                              `未命名衍生属性 ${resolvedActiveDerivedStatIndex + 1}`}
                          </h5>
                          <p
                            className="mt-2 text-xs leading-5"
                            style={{ color: colorAlpha("textMuted", 0.74) }}
                          >
                            {activeDerivedStat.formula ||
                              "当前衍生属性尚未填写公式，可直接在下方详情中补充。"}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <DimensionMetaBadge
                            label="Key"
                            value={activeDerivedStat.key || "未设置"}
                            mono
                          />
                          <DimensionMetaBadge
                            label="资源"
                            value={activeDerivedStat.isResource ? "是" : "否"}
                            accent={activeDerivedStat.isResource ?? false}
                          />
                        </div>
                      </div>
                    </Panel>

                    <DerivedStatCardEditor
                      stat={activeDerivedStat}
                      statFieldOptions={statFieldOptions}
                      labelInputRef={derivedStatLabelInputRef}
                      onChange={(updates) =>
                        onUpdateDerivedStat(
                          resolvedActiveDerivedStatIndex,
                          updates,
                        )
                      }
                      onRemove={() =>
                        handleRemoveDerivedStat(resolvedActiveDerivedStatIndex)
                      }
                    />
                  </motion.div>
                </AnimatePresence>
              ) : null}
            </div>
          ) : (
            <EmptySectionHint message="当前还没有衍生属性。可先补充资源字段、修正值或防御类公式。" />
          )}
        </FormSection>
      );
      break;

    case "checkRules":
      sectionContent = (
        <FormSection
          title="检定规则"
          description="面向普通作者配置默认骰、暴击阈值、DC 预设与 AI 情境难度参考，复杂规则继续由高级 JSON 兜底。"
          action={
            <div className="flex flex-wrap gap-2">
              <SectionRulesEditorButton
                scope="checkRules"
                active={
                  rawRulesEditorOpen && rawRulesEditorScope === "checkRules"
                }
                onOpen={onOpenRawRulesEditor}
              />
            </div>
          }
        >
          <CheckRulesBasePanel
            checkRules={checkRules}
            onChange={onUpdateCheckRules}
          />

          <PresetListCard
            title="DC 公式预设"
            description="用于给常见检定提供默认难度公式与推荐技能。可参考 preset 的语义用途，但表单保持面向作者表达。"
            emptyMessage="当前还没有 DC 公式预设，AI 只能依赖显式 dcFormula 或 AI 难度参考。"
            onAdd={onAddDcPreset}
            addLabel="添加 DC 预设"
          >
            {dcPresetEntries.map(([presetKey, preset], index) => (
              <DCPresetCardEditor
                key={presetKey}
                presetKey={presetKey}
                preset={preset}
                index={index}
                onChange={(updates) => onUpdateDcPreset(presetKey, updates)}
                onRemove={() => onRemoveDcPreset(presetKey)}
              />
            ))}
          </PresetListCard>

          <PresetListCard
            title="对抗检定预设"
            description="用于 preset + opposedEntity 场景，提前说明攻方/守方默认使用的技能字段。"
            emptyMessage="当前还没有对抗检定预设，AI 需逐次显式填写 opposedSkill 等字段。"
            onAdd={onAddOpposedPreset}
            addLabel="添加对抗预设"
          >
            {opposedPresetEntries.map(([presetKey, preset], index) => (
              <OpposedPresetCardEditor
                key={presetKey}
                presetKey={presetKey}
                preset={preset}
                index={index}
                onChange={(updates) =>
                  onUpdateOpposedPreset(presetKey, updates)
                }
                onRemove={() => onRemoveOpposedPreset(presetKey)}
              />
            ))}
          </PresetListCard>

          <PresetListCard
            title="AI 情境 DC 参考"
            description="供 AI 在 dcSource=ai 场景下理解难度分级。这里表达的是作者想让 AI 参考的难度刻度，而不是 prompt 文本本身。"
            emptyMessage="当前还没有 AI 难度刻度，AI 会缺少世界专属的 DC 参考表。"
            onAdd={onAddDCGuidelineItem}
            addLabel="添加难度刻度"
          >
            {dcGuidelineScale.map((item, index) => (
              <DCGuidelineScaleCardEditor
                key={`${item.label}-${item.dc}-${index}`}
                item={item}
                index={index}
                onChange={(updates) => onUpdateDCGuidelineItem(index, updates)}
                onRemove={() => onRemoveDCGuidelineItem(index)}
              />
            ))}
          </PresetListCard>
        </FormSection>
      );
      break;

    case "conditions":
      sectionContent = (
        <FormSection
          title="状态"
          description="当前阶段只结构化基础层：显示名、说明、持续时间、基础触发模式、基础分类与是否可叠加；低风险 passive 属性修正已可结构化编辑，其余复杂 actions / modifiers / 脚本继续走 JSON 兜底。"
          action={
            <div className="flex flex-wrap gap-2">
              <SectionRulesEditorButton
                scope="conditions"
                active={
                  rawRulesEditorOpen && rawRulesEditorScope === "conditions"
                }
                onOpen={onOpenRawRulesEditor}
              />
              <Button variant="outline" size="sm" onClick={handleAddCondition}>
                <Plus className="mr-1 h-4 w-4" />
                添加状态
              </Button>
            </div>
          }
        >
          {conditions.length > 0 ? (
            <div className="grid gap-3 xl:h-168 xl:grid-cols-[minmax(260px,320px)_minmax(0,1fr)] 2xl:grid-cols-[minmax(280px,360px)_minmax(0,1fr)]">
              <Panel
                variant="outlined"
                className={MASTER_DETAIL_LIST_PANEL_CLASS}
              >
                <div
                  className={MASTER_DETAIL_LIST_CONTENT_CLASS}
                  role="tablist"
                  aria-label="状态切换"
                >
                  {conditions.map((condition, index) => {
                    const isActive = resolvedActiveConditionIndex === index;
                    const conditionTitle =
                      condition.name.trim() ||
                      condition.id.trim() ||
                      `未命名状态 ${index + 1}`;
                    const triggerLabel = CONDITION_TRIGGER_MODE_OPTIONS.find(
                      (option) =>
                        option.value === getConditionTriggerMode(condition),
                    )?.label;
                    const tagSummary =
                      condition.tags && condition.tags.length > 0
                        ? condition.tags.join(" / ")
                        : "未设置分类标签";

                    return (
                      <button
                        key={`${condition.id || "condition"}-${index}`}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        onClick={() => setActiveConditionIndex(index)}
                        className="w-full rounded-xl border px-3 py-3 text-left transition-all duration-150"
                        style={{
                          borderColor: colorAlpha(
                            isActive ? "primary" : "border",
                            isActive ? 0.42 : 0.28,
                          ),
                          background: colorAlpha(
                            isActive ? "primary" : "bgCard",
                            isActive ? 0.12 : 0.16,
                          ),
                          boxShadow: isActive
                            ? `0 0 18px ${colorAlpha("primary", 0.12)}`
                            : "none",
                        }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p
                              className="wrap-break-word text-sm font-medium leading-5"
                              style={{
                                color: isActive
                                  ? color("primary")
                                  : color("textPrimary"),
                              }}
                              title={conditionTitle}
                            >
                              {conditionTitle}
                            </p>
                            <p
                              className="mt-1 text-[11px]"
                              style={{ color: colorAlpha("textMuted", 0.74) }}
                            >
                              ID：{condition.id || "未设置"}
                            </p>
                          </div>
                          <span
                            className="shrink-0 rounded-full border px-2 py-0.5 text-[11px]"
                            style={{
                              borderColor: colorAlpha(
                                isActive ? "primary" : "border",
                                isActive ? 0.36 : 0.28,
                              ),
                              color: isActive
                                ? color("primary")
                                : colorAlpha("textMuted", 0.76),
                            }}
                          >
                            {isActive ? "当前" : `#${index + 1}`}
                          </span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <DimensionMetaBadge
                            label="触发"
                            value={triggerLabel ?? "AI 管理"}
                            accent={getConditionTriggerMode(condition) !== "ai"}
                          />
                          <DimensionMetaBadge
                            label="持续"
                            value={
                              condition.duration !== undefined
                                ? `${condition.duration} 回合`
                                : "未设置"
                            }
                          />
                          <DimensionMetaBadge
                            label="叠加"
                            value={condition.stackable ? "允许" : "关闭"}
                          />
                        </div>
                        <p
                          className="mt-2 text-[11px] leading-5"
                          style={{
                            color: colorAlpha(
                              "textMuted",
                              isActive ? 0.82 : 0.72,
                            ),
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                          }}
                          title={tagSummary}
                        >
                          {tagSummary}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </Panel>

              {activeCondition ? (
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    ref={conditionDetailRef}
                    key={`condition-${resolvedActiveConditionIndex}`}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.14 }}
                    className="space-y-3 xl:h-full xl:min-h-0 xl:overflow-y-auto xl:pr-1"
                  >
                    <Panel variant="outlined" className="p-3 sm:p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 flex-1">
                          <p
                            className="text-xs font-medium uppercase tracking-[0.2em]"
                            style={{ color: colorAlpha("primary", 0.82) }}
                          >
                            当前详情
                          </p>
                          <h5
                            className="mt-2 wrap-break-word text-sm font-semibold leading-6"
                            style={{ color: color("textPrimary") }}
                            title={
                              activeCondition.name.trim() ||
                              activeCondition.id.trim() ||
                              `未命名状态 ${resolvedActiveConditionIndex + 1}`
                            }
                          >
                            {activeCondition.name.trim() ||
                              activeCondition.id.trim() ||
                              `未命名状态 ${resolvedActiveConditionIndex + 1}`}
                          </h5>
                          <p
                            className="mt-2 text-xs leading-5"
                            style={{ color: colorAlpha("textMuted", 0.74) }}
                          >
                            {activeCondition.description?.trim() ||
                              "当前状态尚未填写说明，可直接在下方详情中补充。"}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <DimensionMetaBadge
                            label="ID"
                            value={activeCondition.id || "未设置"}
                            mono
                          />
                          <DimensionMetaBadge
                            label="触发"
                            value={
                              CONDITION_TRIGGER_MODE_OPTIONS.find(
                                (option) =>
                                  option.value ===
                                  getConditionTriggerMode(activeCondition),
                              )?.label ?? "AI 管理"
                            }
                            accent={
                              getConditionTriggerMode(activeCondition) !== "ai"
                            }
                          />
                        </div>
                      </div>
                    </Panel>

                    <ConditionCardEditor
                      condition={activeCondition}
                      statFieldOptions={statFieldOptions}
                      nameInputRef={conditionNameInputRef}
                      onChange={(updates) =>
                        onUpdateCondition(resolvedActiveConditionIndex, updates)
                      }
                      onRemove={() =>
                        handleRemoveCondition(resolvedActiveConditionIndex)
                      }
                    />
                  </motion.div>
                </AnimatePresence>
              ) : null}
            </div>
          ) : (
            <EmptySectionHint message="当前还没有预定义状态；若保持为空，AI 添加标签时将缺少作者态命名、持续时间与基础触发参考。" />
          )}
        </FormSection>
      );
      break;

    case "dimensions":
      sectionContent = (
        <FormSection
          title="角色维度"
          description="控制创建向导中的维度步骤，如种族、背景、阵营。"
          action={
            <div className="flex flex-wrap gap-2">
              <SectionRulesEditorButton
                scope="dimensions"
                active={
                  rawRulesEditorOpen && rawRulesEditorScope === "dimensions"
                }
                onOpen={onOpenRawRulesEditor}
              />
              <Button variant="outline" size="sm" onClick={handleAddDimension}>
                <Plus className="mr-1 h-4 w-4" />
                添加维度
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            {dimensions.length > 0 ? (
              <>
                <div
                  className="rounded-xl border px-3 py-3"
                  style={{
                    borderColor: colorAlpha("border", 0.3),
                    background: colorAlpha("bgCard", 0.2),
                  }}
                >
                  <div
                    className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3"
                    role="tablist"
                    aria-label="角色维度切换"
                  >
                    {dimensions.map((dimension, dimensionIndex) => {
                      const isActive =
                        resolvedActiveDimensionIndex === dimensionIndex;
                      const dimensionTitle =
                        dimension.label.trim() ||
                        dimension.id.trim() ||
                        `未命名维度 ${dimensionIndex + 1}`;
                      const descriptionText =
                        dimension.description?.trim() ?? "";
                      const optionPreviewItems = dimension.options
                        .map((option) => option.name.trim() || option.id.trim())
                        .filter(Boolean);
                      const optionPreview =
                        optionPreviewItems.length > 0
                          ? optionPreviewItems.slice(0, 2).join(" / ")
                          : "尚未添加维度选项";

                      return (
                        <button
                          key={`${dimension.id}-${dimensionIndex}`}
                          type="button"
                          role="tab"
                          aria-selected={isActive}
                          onClick={() =>
                            setActiveDimensionIndex(dimensionIndex)
                          }
                          className="rounded-xl border px-3 py-3 text-left transition-colors duration-150"
                          style={{
                            borderColor: colorAlpha(
                              isActive ? "primary" : "border",
                              isActive ? 0.42 : 0.28,
                            ),
                            background: colorAlpha(
                              isActive ? "primary" : "bgCard",
                              isActive ? 0.14 : 0.12,
                            ),
                          }}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="min-w-0 flex-1">
                              <span
                                className="block text-sm font-medium leading-5"
                                style={{
                                  color: isActive
                                    ? color("primary")
                                    : color("textPrimary"),
                                  display: "-webkit-box",
                                  WebkitLineClamp: 2,
                                  WebkitBoxOrient: "vertical",
                                  overflow: "hidden",
                                }}
                                title={dimensionTitle}
                              >
                                {dimensionTitle}
                              </span>
                            </span>
                            <span
                              className="shrink-0 rounded-full border px-2 py-0.5 text-[11px]"
                              style={{
                                borderColor: colorAlpha(
                                  isActive ? "primary" : "border",
                                  isActive ? 0.38 : 0.24,
                                ),
                                color: isActive
                                  ? color("primary")
                                  : colorAlpha("textMuted", 0.78),
                              }}
                            >
                              {dimension.options.length} 项
                            </span>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            <span
                              className="rounded-full border px-2 py-0.5 text-[11px]"
                              style={{
                                borderColor: colorAlpha(
                                  dimension.required === false
                                    ? "border"
                                    : "primary",
                                  dimension.required === false ? 0.24 : 0.34,
                                ),
                                color:
                                  dimension.required === false
                                    ? colorAlpha("textMuted", 0.8)
                                    : color("primary"),
                              }}
                            >
                              {dimension.required === false ? "可跳过" : "必选"}
                            </span>
                            <span
                              className="rounded-full border px-2 py-0.5 text-[11px]"
                              style={{
                                borderColor: colorAlpha("border", 0.24),
                                color: colorAlpha("textMuted", 0.8),
                              }}
                            >
                              排序 {dimension.order ?? 0}
                            </span>
                          </div>
                          <p
                            className="mt-2 text-[11px] leading-5"
                            style={{
                              color: colorAlpha(
                                "textMuted",
                                isActive ? 0.8 : 0.72,
                              ),
                              display: "-webkit-box",
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: "vertical",
                              overflow: "hidden",
                            }}
                            title={
                              descriptionText || `选项预览：${optionPreview}`
                            }
                          >
                            {descriptionText || `选项预览：${optionPreview}`}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {activeDimension ? (
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                      key={`${activeDimension.id}-${resolvedActiveDimensionIndex}`}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.16 }}
                    >
                      <DimensionCard
                        dimension={activeDimension}
                        talentOptions={talents}
                        attributeOptions={primaryAttributes}
                        onChange={(updates) =>
                          onUpdateDimension(
                            resolvedActiveDimensionIndex,
                            updates,
                          )
                        }
                        onRemove={() =>
                          handleRemoveDimension(resolvedActiveDimensionIndex)
                        }
                        onAddOption={() =>
                          onAddDimensionOption(resolvedActiveDimensionIndex)
                        }
                        onUpdateOption={(optionIndex, updates) =>
                          onUpdateDimensionOption(
                            resolvedActiveDimensionIndex,
                            optionIndex,
                            updates,
                          )
                        }
                        onRemoveOption={(optionIndex) =>
                          onRemoveDimensionOption(
                            resolvedActiveDimensionIndex,
                            optionIndex,
                          )
                        }
                      />
                    </motion.div>
                  </AnimatePresence>
                ) : null}
              </>
            ) : (
              <EmptySectionHint message="当前还没有角色维度。添加后，创建流程才能展示种族、背景等选择分区。" />
            )}
          </div>
        </FormSection>
      );
      break;

    case "talents":
    default:
      sectionContent = (
        <FormSection
          title="天赋"
          description="维护角色创建可选天赋、前置属性条件与基础选择规则；复杂 modifier 继续通过高级规则编辑兜底。"
          action={
            <div className="flex flex-wrap gap-2">
              <SectionRulesEditorButton
                scope="talents"
                active={rawRulesEditorOpen && rawRulesEditorScope === "talents"}
                onOpen={onOpenRawRulesEditor}
              />
              <Button variant="outline" size="sm" onClick={handleAddTalent}>
                <Plus className="mr-1 h-4 w-4" />
                添加天赋
              </Button>
            </div>
          }
        >
          <div className="space-y-3">
            <TalentRulesCardEditor
              talentRules={talentRules}
              onChange={onUpdateTalentRules}
            />

            {talents.length > 0 ? (
              <div className="grid gap-3 xl:h-168 xl:grid-cols-[minmax(260px,320px)_minmax(0,1fr)] 2xl:grid-cols-[minmax(280px,360px)_minmax(0,1fr)]">
                <Panel
                  variant="outlined"
                  className={MASTER_DETAIL_LIST_PANEL_CLASS}
                >
                  <div
                    className={MASTER_DETAIL_LIST_CONTENT_CLASS}
                    role="tablist"
                    aria-label="天赋切换"
                  >
                    {talents.map((talent, index) => {
                      const isActive = resolvedActiveTalentIndex === index;
                      const talentTitle =
                        talent.name.trim() ||
                        talent.id.trim() ||
                        `未命名天赋 ${index + 1}`;
                      const categoryLabel = TALENT_CATEGORY_OPTIONS.find(
                        (option) =>
                          option.value === (talent.category ?? "misc"),
                      )?.label;
                      const prerequisiteCount = Object.keys(
                        talent.prerequisites?.attributes ?? {},
                      ).length;
                      const exclusiveCount = talent.exclusiveWith?.length ?? 0;

                      return (
                        <button
                          key={`${talent.id || "talent"}-${index}`}
                          type="button"
                          role="tab"
                          aria-selected={isActive}
                          onClick={() => setActiveTalentIndex(index)}
                          className="w-full rounded-xl border px-3 py-3 text-left transition-all duration-150"
                          style={{
                            borderColor: colorAlpha(
                              isActive ? "primary" : "border",
                              isActive ? 0.42 : 0.28,
                            ),
                            background: colorAlpha(
                              isActive ? "primary" : "bgCard",
                              isActive ? 0.12 : 0.16,
                            ),
                            boxShadow: isActive
                              ? `0 0 18px ${colorAlpha("primary", 0.12)}`
                              : "none",
                          }}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p
                                className="wrap-break-word text-sm font-medium leading-5"
                                style={{
                                  color: isActive
                                    ? color("primary")
                                    : color("textPrimary"),
                                }}
                                title={talentTitle}
                              >
                                {talentTitle}
                              </p>
                              <p
                                className="mt-1 text-[11px]"
                                style={{ color: colorAlpha("textMuted", 0.74) }}
                              >
                                ID：{talent.id || "未设置"}
                              </p>
                            </div>
                            <span
                              className="shrink-0 rounded-full border px-2 py-0.5 text-[11px]"
                              style={{
                                borderColor: colorAlpha(
                                  isActive ? "primary" : "border",
                                  isActive ? 0.36 : 0.28,
                                ),
                                color: isActive
                                  ? color("primary")
                                  : colorAlpha("textMuted", 0.76),
                              }}
                            >
                              {isActive ? "当前" : `#${index + 1}`}
                            </span>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <DimensionMetaBadge
                              label="分类"
                              value={categoryLabel ?? "其他"}
                            />
                            <DimensionMetaBadge
                              label="前置属性"
                              value={String(prerequisiteCount)}
                              accent={prerequisiteCount > 0}
                            />
                            <DimensionMetaBadge
                              label="互斥"
                              value={String(exclusiveCount)}
                              accent={exclusiveCount > 0}
                            />
                          </div>
                          <p
                            className="mt-2 text-[11px] leading-5"
                            style={{
                              color: colorAlpha(
                                "textMuted",
                                isActive ? 0.82 : 0.72,
                              ),
                              display: "-webkit-box",
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: "vertical",
                              overflow: "hidden",
                            }}
                            title={talent.description || "当前天赋尚未填写描述"}
                          >
                            {talent.description || "当前天赋尚未填写描述"}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </Panel>

                {activeTalent ? (
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                      ref={talentDetailRef}
                      key={`talent-${resolvedActiveTalentIndex}`}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.14 }}
                      className="space-y-3 xl:h-full xl:min-h-0 xl:overflow-y-auto xl:pr-1"
                    >
                      <Panel variant="outlined" className="p-3 sm:p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0 flex-1">
                            <p
                              className="text-xs font-medium uppercase tracking-[0.2em]"
                              style={{ color: colorAlpha("primary", 0.82) }}
                            >
                              当前详情
                            </p>
                            <h5
                              className="mt-2 wrap-break-word text-sm font-semibold leading-6"
                              style={{ color: color("textPrimary") }}
                              title={
                                activeTalent.name.trim() ||
                                activeTalent.id.trim() ||
                                `未命名天赋 ${resolvedActiveTalentIndex + 1}`
                              }
                            >
                              {activeTalent.name.trim() ||
                                activeTalent.id.trim() ||
                                `未命名天赋 ${resolvedActiveTalentIndex + 1}`}
                            </h5>
                            <p
                              className="mt-2 text-xs leading-5"
                              style={{ color: colorAlpha("textMuted", 0.74) }}
                            >
                              {activeTalent.description ||
                                "当前天赋尚未填写描述，可直接在下方详情中补充。"}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <DimensionMetaBadge
                              label="ID"
                              value={activeTalent.id || "未设置"}
                              mono
                            />
                            <DimensionMetaBadge
                              label="分类"
                              value={
                                TALENT_CATEGORY_OPTIONS.find(
                                  (option) =>
                                    option.value ===
                                    (activeTalent.category ?? "misc"),
                                )?.label ?? "其他"
                              }
                            />
                          </div>
                        </div>
                      </Panel>

                      <TalentCardEditor
                        talent={activeTalent}
                        attributeOptions={primaryAttributes}
                        nameInputRef={talentNameInputRef}
                        onChange={(updates) =>
                          onUpdateTalent(resolvedActiveTalentIndex, updates)
                        }
                        onRemove={() =>
                          handleRemoveTalent(resolvedActiveTalentIndex)
                        }
                      />
                    </motion.div>
                  </AnimatePresence>
                ) : null}
              </div>
            ) : (
              <EmptySectionHint message="当前世界还没有可选天赋；若继续为空，角色创建流程会跳过天赋步骤。" />
            )}
          </div>
        </FormSection>
      );
      break;
  }

  return (
    <div className="relative flex h-full min-h-0 flex-col lg:flex-row">
      <div
        className="hidden border-b lg:flex lg:h-full lg:min-h-0 lg:w-76 lg:shrink-0 lg:flex-col lg:border-b-0 lg:border-r lg:overflow-hidden"
        style={{ borderColor: colorAlpha("primary", 0.14) }}
      >
        <div className="space-y-4 px-4 py-4 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col">
          <EditorOverviewPanel
            world={world}
            activeSection={activeSectionMeta}
          />

          <SectionNavigation
            world={world}
            activeSection={activeSection}
            onSelectSection={setActiveSection}
          />
        </div>
      </div>

      <ScrollArea
        key={`${world.id}-${activeSection}`}
        className="min-h-0 flex-1"
      >
        <div className="space-y-4 px-3 py-3 sm:space-y-5 sm:px-5 sm:py-4">
          <div className="lg:hidden">
            <MobileSectionNavigation
              activeSection={activeSection}
              onSelectSection={setActiveSection}
            />
          </div>

          <div className="hidden lg:block">
            <ValidationPanel messages={validationMessages} />
          </div>

          <Panel variant="outlined" className="hidden p-4 sm:p-5 lg:block">
            <div>
              <div>
                <p
                  className="text-xs font-medium uppercase tracking-[0.24em]"
                  style={{ color: colorAlpha("primary", 0.82) }}
                >
                  当前分区
                </p>
                <h2
                  className="mt-2 text-base font-semibold"
                  style={{ color: color("textPrimary") }}
                >
                  {activeSectionMeta.title}
                </h2>
                <p
                  className="mt-1 text-xs"
                  style={{ color: colorAlpha("textMuted", 0.76) }}
                >
                  {activeSectionMeta.description}
                </p>
              </div>
            </div>
          </Panel>

          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={activeSection}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.16 }}
            >
              {sectionContent}
            </motion.div>
          </AnimatePresence>

          <div className="lg:hidden">
            <ValidationPanel messages={validationMessages} />
          </div>
        </div>
      </ScrollArea>

      <AnimatePresence>
        {rawRulesEditorOpen ? (
          <RawRulesEditorOverlay
            title={rawRulesEditorMeta.title}
            description={rawRulesEditorMeta.description}
            footnote={rawRulesEditorMeta.footnote}
            value={rawRulesText}
            error={rawRulesError}
            onChange={onSetRawRulesText}
            onApply={onApplyRawRulesText}
            onClose={onCloseRawRulesEditor}
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function getSectionSummary(
  sectionId: WorldEditorSectionId,
  world: World,
): string {
  switch (sectionId) {
    case "meta":
      return world.meta.author
        ? `v${world.meta.version} · ${world.meta.author}`
        : `v${world.meta.version} · 待补作者信息`;

    case "narrative": {
      const configuredCount = [
        world.narrative?.script,
        world.narrative?.opening,
      ].filter((item) => Boolean(item && item.trim().length > 0)).length;

      if (configuredCount === 2) {
        return "剧本与开幕语已配置";
      }

      if (configuredCount === 1) {
        return "已配置 1 项叙事启动内容";
      }

      return "尚未填写叙事启动";
    }

    case "attributes": {
      const allocatableCount =
        world.rules.pointBuyRules?.allocatableAttributes?.length ?? 0;
      return `${world.rules.primaryAttributes.length} 个属性 · ${allocatableCount} 个可分配字段`;
    }

    case "derivedStats": {
      const resourceCount = world.rules.derivedStats.filter(
        (item) => item.isResource,
      ).length;
      return resourceCount > 0
        ? `${world.rules.derivedStats.length} 个衍生属性 · ${resourceCount} 个资源字段`
        : `${world.rules.derivedStats.length} 个衍生属性`;
    }

    case "checkRules": {
      const dcPresetCount = Object.keys(
        world.rules.checkRules.dcPresets ?? {},
      ).length;
      const opposedPresetCount = Object.keys(
        world.rules.checkRules.opposedPresets ?? {},
      ).length;
      return `${world.rules.checkRules.defaultDice ?? "1d20"} · ${dcPresetCount} 个 DC 预设 · ${opposedPresetCount} 个对抗预设`;
    }

    case "conditions": {
      const triggerCount = (world.rules.conditions ?? []).filter(
        (item) => item.trigger,
      ).length;
      return `${world.rules.conditions?.length ?? 0} 个状态 · ${triggerCount} 个系统触发`;
    }

    case "dimensions": {
      const dimensionCount = world.rules.dimensions?.length ?? 0;
      const emptyOptionCount = (world.rules.dimensions ?? []).filter(
        (item) => item.options.length === 0,
      ).length;

      if (dimensionCount === 0) {
        return "尚未配置角色维度";
      }

      return emptyOptionCount > 0
        ? `${dimensionCount} 个维度 · ${emptyOptionCount} 个待补选项`
        : `${dimensionCount} 个维度 · 选项已配置`;
    }

    case "talents":
    default: {
      const talentCount = world.rules.talents?.length ?? 0;
      return talentCount > 0
        ? `${talentCount} 个天赋可供角色创建选择`
        : "当前没有可选天赋";
    }
  }
}

function formatTimestamp(timestamp: number): string {
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return "未记录";
  }

  return new Date(timestamp).toLocaleString("zh-CN", { hour12: false });
}

function EditorOverviewPanel({
  world,
  activeSection,
}: {
  world: World;
  activeSection: WorldEditorSectionDefinition;
}) {
  const dimensionCount = world.rules.dimensions?.length ?? 0;
  const talentCount = world.rules.talents?.length ?? 0;
  const attributeCount = world.rules.primaryAttributes.length;
  const derivedCount = world.rules.derivedStats.length;
  const conditionCount = world.rules.conditions?.length ?? 0;
  const dcPresetCount = Object.keys(
    world.rules.checkRules.dcPresets ?? {},
  ).length;

  return (
    <Panel variant="outlined" className="p-4">
      <p
        className="text-xs font-medium uppercase tracking-[0.24em]"
        style={{ color: colorAlpha("primary", 0.82) }}
      >
        当前世界
      </p>
      <h2
        className="mt-2 truncate text-base font-semibold"
        style={{ color: color("textPrimary") }}
      >
        {world.meta.name}
      </h2>
      <p
        className="mt-1 text-xs"
        style={{ color: colorAlpha("textMuted", 0.76) }}
      >
        当前分区：{activeSection.title}
      </p>

      <div className="mt-4 grid grid-cols-2 gap-2 xl:grid-cols-3">
        <SummaryMetric label="属性" value={String(attributeCount)} />
        <SummaryMetric label="衍生" value={String(derivedCount)} />
        <SummaryMetric label="检定预设" value={String(dcPresetCount)} />
        <SummaryMetric label="状态" value={String(conditionCount)} />
        <SummaryMetric label="维度" value={String(dimensionCount)} />
        <SummaryMetric label="天赋" value={String(talentCount)} />
      </div>
    </Panel>
  );
}

function SectionNavigation({
  world,
  activeSection,
  onSelectSection,
}: {
  world: World;
  activeSection: WorldEditorSectionId;
  onSelectSection: (section: WorldEditorSectionId) => void;
}) {
  return (
    <Panel
      variant="outlined"
      className="lg:flex lg:min-h-0 lg:flex-1 lg:flex-col lg:[&>div]:flex lg:[&>div]:min-h-0 lg:[&>div]:flex-1 lg:[&>div]:flex-col"
    >
      <div className="p-3 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col">
        <div>
          <h3
            className="text-sm font-semibold"
            style={{ color: color("textPrimary") }}
          >
            编辑分区
          </h3>
          <p
            className="mt-1 text-xs"
            style={{ color: colorAlpha("textMuted", 0.74) }}
          >
            一次只展开当前目标分区，避免在超长表单中来回滚动。
          </p>
        </div>

        <ScrollArea className="mt-4 pb-1 lg:min-h-0 lg:flex-1 lg:overflow-x-hidden lg:pr-1">
          <div className="flex gap-2 lg:flex-col">
            {WORLD_EDITOR_SECTIONS.map((section) => {
              const selected = section.id === activeSection;
              return (
                <button
                  key={section.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onSelectSection(section.id)}
                  className={cn(
                    "min-w-60 rounded-xl border px-4 py-3 text-left transition-all lg:min-w-0",
                  )}
                  style={{
                    color: selected
                      ? color("textPrimary")
                      : color("textSecondary"),
                    background: selected
                      ? colorAlpha("primary", 0.12)
                      : colorAlpha("bgCard", 0.24),
                    borderColor: colorAlpha(
                      selected ? "primary" : "border",
                      selected ? 0.42 : 0.28,
                    ),
                    boxShadow: selected
                      ? `0 0 18px ${colorAlpha("primary", 0.14)}`
                      : "none",
                  }}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{section.title}</p>
                    <p
                      className="mt-1 text-xs"
                      style={{
                        color: colorAlpha("textMuted", selected ? 0.84 : 0.7),
                      }}
                    >
                      {section.description}
                    </p>
                  </div>
                  <p
                    className="mt-3 text-xs"
                    style={{
                      color: colorAlpha("textMuted", selected ? 0.84 : 0.72),
                    }}
                  >
                    {getSectionSummary(section.id, world)}
                  </p>
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </div>
    </Panel>
  );
}

function MobileSectionNavigation({
  activeSection,
  onSelectSection,
}: {
  activeSection: WorldEditorSectionId;
  onSelectSection: (section: WorldEditorSectionId) => void;
}) {
  return (
    <div
      className="overflow-x-auto pb-1"
      role="tablist"
      aria-label="编辑分区快速切换"
    >
      <div className="flex min-w-max gap-2">
        {WORLD_EDITOR_SECTIONS.map((section) => {
          const selected = section.id === activeSection;
          return (
            <button
              key={section.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => onSelectSection(section.id)}
              className="shrink-0 rounded-full border px-3 py-2 text-xs font-medium whitespace-nowrap transition-all"
              style={{
                color: selected ? color("primary") : color("textSecondary"),
                background: selected
                  ? colorAlpha("primary", 0.12)
                  : colorAlpha("bgCard", 0.24),
                borderColor: colorAlpha(
                  selected ? "primary" : "border",
                  selected ? 0.42 : 0.28,
                ),
                boxShadow: selected
                  ? `0 0 16px ${colorAlpha("primary", 0.12)}`
                  : "none",
              }}
              title={section.description}
            >
              {section.title}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SummaryMetric({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="rounded-lg border px-3 py-2"
      style={{
        borderColor: colorAlpha("border", 0.28),
        background: colorAlpha("bgCard", 0.28),
      }}
    >
      <p
        className="text-[11px]"
        style={{ color: colorAlpha("textMuted", 0.7) }}
      >
        {label}
      </p>
      <p
        className="mt-1 text-sm font-medium"
        style={{ color: color("textPrimary") }}
      >
        {value}
      </p>
    </div>
  );
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
            {messages.map((message, index) => (
              <li
                key={
                  message
                    ? `${message}-${index}`
                    : `validation-message-${index}`
                }
              >
                {message}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Panel>
  );
}

function RawRulesEditorOverlay({
  title,
  description,
  footnote,
  value,
  error,
  onChange,
  onApply,
  onClose,
}: {
  title: string;
  description: string;
  footnote: string;
  value: string;
  error: string | null;
  onChange: (value: string) => void;
  onApply: () => void;
  onClose: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-20 p-3 sm:p-4 lg:p-5"
    >
      <div
        className="absolute inset-0"
        style={{ background: colorAlpha("bgBase", 0.72) }}
        onClick={onClose}
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.98, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: 12 }}
        className="relative z-10 flex h-full min-h-0 flex-col rounded-2xl border"
        style={{
          background: colorAlpha("bgElevated", 0.96),
          borderColor: colorAlpha("primary", 0.28),
          boxShadow: `0 0 28px ${colorAlpha("bgBase", 0.28)}`,
        }}
      >
        <div
          className="flex flex-wrap items-start justify-between gap-3 border-b px-4 py-4 sm:px-5"
          style={{ borderColor: colorAlpha("primary", 0.16) }}
        >
          <div className="min-w-0">
            <h3
              className="text-base font-semibold"
              style={{ color: color("textPrimary") }}
            >
              {title}
            </h3>
            <p
              className="mt-1 text-xs"
              style={{ color: colorAlpha("textMuted", 0.76) }}
            >
              {description}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button variant="outline" size="sm" onClick={onApply}>
              应用 JSON
            </Button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-2 transition-all"
              style={{ color: color("textMuted") }}
              aria-label="关闭原始规则编辑"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 px-4 py-4 sm:px-5">
          <Textarea
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className="h-full min-h-105 font-mono text-sm"
            spellCheck={false}
          />
        </div>

        <div
          className="border-t px-4 py-3 sm:px-5"
          style={{ borderColor: colorAlpha("primary", 0.12) }}
        >
          {error ? (
            <p className="text-xs" style={{ color: color("error") }}>
              {error}
            </p>
          ) : (
            <p
              className="text-xs"
              style={{ color: colorAlpha("textMuted", 0.72) }}
            >
              {footnote}
            </p>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

function SectionRulesEditorButton({
  scope,
  active,
  onOpen,
}: {
  scope: WorldScopedRulesEditorScope;
  active: boolean;
  onOpen: (scope: WorldScopedRulesEditorScope) => void;
}) {
  const meta = SCOPED_RAW_RULES_EDITOR_META[scope];

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => onOpen(scope)}
      className="gap-1.5"
      title={meta.description}
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

function Card({
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

function DimensionMetaBadge({
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

function EmptySectionHint({ message }: { message: string }) {
  return (
    <Card variant="outlined" className="p-4">
      <p className="text-sm" style={{ color: color("textMuted") }}>
        {message}
      </p>
    </Card>
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
  labelInputRef,
  onChange,
  onRemove,
}: {
  attribute: PrimaryAttributeConfig;
  labelInputRef?: React.RefObject<HTMLInputElement | null>;
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
            ref={labelInputRef}
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

const DERIVED_STAT_CATEGORY_OPTIONS = [
  { value: "", label: "未分类" },
  { value: "resource", label: "资源" },
  { value: "combat", label: "战斗" },
  { value: "defense", label: "防御" },
  { value: "misc", label: "其他" },
] as const;

function DerivedStatCardEditor({
  stat,
  statFieldOptions,
  labelInputRef,
  onChange,
  onRemove,
}: {
  stat: DerivedStatConfig;
  statFieldOptions: Array<{ value: string; label: string }>;
  labelInputRef?: React.RefObject<HTMLInputElement | null>;
  onChange: (updates: Partial<DerivedStatConfig>) => void;
  onRemove: () => void;
}) {
  const isResource = stat.isResource ?? false;
  const availableMaxFieldOptions = statFieldOptions.filter(
    (option) => option.value !== stat.key,
  );

  return (
    <Card variant="outlined" className="space-y-4 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p
            className="text-sm font-semibold"
            style={{ color: color("textPrimary") }}
          >
            {stat.label || "未命名衍生属性"}
          </p>
          <p
            className="mt-1 text-xs"
            style={{ color: colorAlpha("textMuted", 0.72) }}
          >
            公式可引用主要属性、level 与其他衍生属性；当前 key：{stat.key}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onRemove}>
          <Trash2 className="mr-1 h-4 w-4" />
          删除衍生属性
        </Button>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Field label="显示名">
          <Input
            ref={labelInputRef}
            value={stat.label}
            onChange={(event) => onChange({ label: event.target.value })}
            placeholder="生命值"
          />
        </Field>
        <Field label="公式">
          <Input
            value={stat.formula}
            onChange={(event) => onChange({ formula: event.target.value })}
            placeholder="max_hp"
          />
        </Field>
      </div>

      <p className="text-xs" style={{ color: colorAlpha("textMuted", 0.72) }}>
        描述语义当前由显示名承载；若需要更复杂说明，可继续使用当前分区 JSON
        高级编辑。
      </p>

      <div className="grid gap-3 md:grid-cols-3">
        <Field label="最小值（可选）">
          <Input
            type="number"
            value={stat.min ?? ""}
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
        <Field label="最大值（可选）">
          <Input
            type="number"
            value={stat.max ?? ""}
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
        <Field label="展示分组（可选）">
          <Select
            value={stat.category ?? ""}
            onValueChange={(value) =>
              onChange({
                category:
                  value === ""
                    ? undefined
                    : (value as DerivedStatConfig["category"]),
              })
            }
            options={DERIVED_STAT_CATEGORY_OPTIONS.map((option) => ({
              value: option.value,
              label: option.label,
            }))}
          />
        </Field>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <ToggleSetting
          title="在 UI 中显示"
          description="控制该字段是否作为可见属性参与作者态/角色面板展示。"
          checked={stat.showInUI ?? false}
          onCheckedChange={(checked) => onChange({ showInUI: checked })}
        />
        <ToggleSetting
          title="作为资源字段"
          description="启用后，该字段按资源 current 语义工作，可绑定上限字段。"
          checked={isResource}
          onCheckedChange={(checked) =>
            onChange({
              isResource: checked,
              ...(checked ? {} : { maxField: undefined }),
            })
          }
        />
      </div>

      <Field label="上限字段（仅资源字段需要）">
        <Select
          value={isResource ? (stat.maxField ?? "") : ""}
          onValueChange={(value) =>
            onChange({ maxField: value === "" ? undefined : value })
          }
          disabled={!isResource}
          options={[
            {
              value: "",
              label: isResource ? "选择上限字段" : "先开启资源字段",
            },
            ...availableMaxFieldOptions,
          ]}
        />
      </Field>

      <details
        className="rounded-xl border px-4 py-3"
        style={{
          borderColor: colorAlpha("border", 0.3),
          background: colorAlpha("bgCard", 0.22),
        }}
      >
        <summary
          className="cursor-pointer text-sm font-medium"
          style={{ color: color("textPrimary") }}
        >
          高级字段
        </summary>
        <div className="mt-3 space-y-3">
          <Field label="内部 Key">
            <Input
              value={stat.key}
              onChange={(event) => onChange({ key: event.target.value })}
              placeholder="hp"
            />
          </Field>
          <p
            className="text-xs"
            style={{ color: colorAlpha("textMuted", 0.72) }}
          >
            key / id
            主要用于公式引用与运行时接线，系统会自动补齐默认值；普通作者无需频繁手工维护。
          </p>
        </div>
      </details>
    </Card>
  );
}

function CheckRulesBasePanel({
  checkRules,
  onChange,
}: {
  checkRules: CheckRulesValue;
  onChange: (updates: Partial<CheckRulesValue>) => void;
}) {
  return (
    <Card variant="outlined" className="space-y-4 p-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Field label="默认骰子表达式">
          <Input
            value={checkRules.defaultDice ?? ""}
            onChange={(event) => onChange({ defaultDice: event.target.value })}
            placeholder="1d20 / 2d6 / 1d100"
          />
        </Field>
        <Field label="暴击阈值（可选）">
          <Input
            type="number"
            value={checkRules.criticalSuccessThreshold ?? ""}
            onChange={(event) =>
              onChange({
                criticalSuccessThreshold:
                  event.target.value.trim() === ""
                    ? undefined
                    : Number(event.target.value),
              })
            }
          />
        </Field>
        <Field label="大失败阈值（可选）">
          <Input
            type="number"
            value={checkRules.criticalFailureThreshold ?? ""}
            onChange={(event) =>
              onChange({
                criticalFailureThreshold:
                  event.target.value.trim() === ""
                    ? undefined
                    : Number(event.target.value),
              })
            }
          />
        </Field>
        <ToggleSetting
          title="允许对抗检定"
          description="控制作者态是否开放 contested / opposed 场景的基础规则入口。"
          checked={checkRules.allowContest ?? false}
          onCheckedChange={(checked) => onChange({ allowContest: checked })}
        />
      </div>

      <p className="text-xs" style={{ color: colorAlpha("textMuted", 0.72) }}>
        DC 预设用于复用常见公式；对抗预设用于声明攻防双方技能；AI 难度刻度用于让
        dcSource=ai 更贴合该世界的难度感受。
      </p>
    </Card>
  );
}

function PresetListCard({
  title,
  description,
  emptyMessage,
  onAdd,
  addLabel,
  children,
}: {
  title: string;
  description: string;
  emptyMessage: string;
  onAdd: () => void;
  addLabel: string;
  children: React.ReactNode;
}) {
  const hasChildren = Array.isArray(children)
    ? children.length > 0
    : Boolean(children);

  return (
    <Card variant="outlined" className="space-y-4 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4
            className="text-sm font-semibold"
            style={{ color: color("textPrimary") }}
          >
            {title}
          </h4>
          <p
            className="mt-1 text-xs"
            style={{ color: colorAlpha("textMuted", 0.72) }}
          >
            {description}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onAdd}>
          <Plus className="mr-1 h-4 w-4" />
          {addLabel}
        </Button>
      </div>

      {hasChildren ? children : <EmptySectionHint message={emptyMessage} />}
    </Card>
  );
}

function PresetKeyBadge({ presetKey }: { presetKey: string }) {
  return (
    <p className="text-xs" style={{ color: colorAlpha("textMuted", 0.72) }}>
      preset key：{presetKey}
    </p>
  );
}

function DCPresetCardEditor({
  presetKey,
  preset,
  index,
  onChange,
  onRemove,
}: {
  presetKey: string;
  preset: DCPresetConfig;
  index: number;
  onChange: (updates: Partial<DCPresetConfig>) => void;
  onRemove: () => void;
}) {
  return (
    <Panel variant="outlined" className="space-y-4 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p
            className="text-sm font-semibold"
            style={{ color: color("textPrimary") }}
          >
            {preset.label || `DC 预设 ${index + 1}`}
          </p>
          <PresetKeyBadge presetKey={presetKey} />
        </div>
        <Button variant="outline" size="sm" onClick={onRemove}>
          <Trash2 className="mr-1 h-4 w-4" />
          删除预设
        </Button>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <Field label="显示名">
          <Input
            value={preset.label}
            onChange={(event) => onChange({ label: event.target.value })}
            placeholder="攀爬 / 洞察 / 搜索"
          />
        </Field>
        <Field label="DC 公式">
          <Input
            value={preset.formula}
            onChange={(event) => onChange({ formula: event.target.value })}
            placeholder="10 + level"
          />
        </Field>
        <Field label="默认技能（可选）">
          <Input
            value={preset.defaultSkill ?? ""}
            onChange={(event) =>
              onChange({
                defaultSkill:
                  event.target.value.trim() === ""
                    ? undefined
                    : event.target.value,
              })
            }
            placeholder="perception"
          />
        </Field>
      </div>
    </Panel>
  );
}

function OpposedPresetCardEditor({
  presetKey,
  preset,
  index,
  onChange,
  onRemove,
}: {
  presetKey: string;
  preset: OpposedPresetConfig;
  index: number;
  onChange: (updates: Partial<OpposedPresetConfig>) => void;
  onRemove: () => void;
}) {
  return (
    <Panel variant="outlined" className="space-y-4 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p
            className="text-sm font-semibold"
            style={{ color: color("textPrimary") }}
          >
            {preset.label || `对抗预设 ${index + 1}`}
          </p>
          <PresetKeyBadge presetKey={presetKey} />
        </div>
        <Button variant="outline" size="sm" onClick={onRemove}>
          <Trash2 className="mr-1 h-4 w-4" />
          删除预设
        </Button>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <Field label="显示名">
          <Input
            value={preset.label}
            onChange={(event) => onChange({ label: event.target.value })}
            placeholder="擒抱 / 拔河 / 魅惑对抗"
          />
        </Field>
        <Field label="攻方技能">
          <Input
            value={preset.attackerSkill}
            onChange={(event) =>
              onChange({ attackerSkill: event.target.value })
            }
            placeholder="attack"
          />
        </Field>
        <Field label="守方技能">
          <Input
            value={preset.defenderSkill}
            onChange={(event) =>
              onChange({ defenderSkill: event.target.value })
            }
            placeholder="defense"
          />
        </Field>
      </div>
    </Panel>
  );
}

function DCGuidelineScaleCardEditor({
  item,
  index,
  onChange,
  onRemove,
}: {
  item: DCGuidelineScaleItem;
  index: number;
  onChange: (updates: Partial<DCGuidelineScaleItem>) => void;
  onRemove: () => void;
}) {
  return (
    <Panel variant="outlined" className="space-y-4 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p
          className="text-sm font-semibold"
          style={{ color: color("textPrimary") }}
        >
          难度刻度 {index + 1}
        </p>
        <Button variant="outline" size="sm" onClick={onRemove}>
          <Trash2 className="mr-1 h-4 w-4" />
          删除刻度
        </Button>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <Field label="难度名称">
          <Input
            value={item.label}
            onChange={(event) => onChange({ label: event.target.value })}
            placeholder="困难"
          />
        </Field>
        <Field label="DC 数值">
          <Input
            type="number"
            value={item.dc}
            onChange={(event) =>
              onChange({ dc: Number(event.target.value) || 0 })
            }
          />
        </Field>
        <Field label="说明">
          <Input
            value={item.description}
            onChange={(event) => onChange({ description: event.target.value })}
            placeholder="受过训练的角色可稳定完成"
          />
        </Field>
      </div>
    </Panel>
  );
}

function getConditionTriggerMode(
  condition: ConditionConfig,
): ConditionTriggerMode {
  return condition.trigger?.timing ?? "ai";
}

function buildConditionTriggerUpdate(
  condition: ConditionConfig,
  mode: ConditionTriggerMode,
): Partial<ConditionConfig> {
  if (mode === "ai") {
    return { trigger: undefined };
  }

  const currentTrigger = condition.trigger;
  return {
    trigger: {
      ...(currentTrigger ?? {}),
      timing: mode,
      ...(mode === "on_damage" ? {} : { damageFilter: undefined }),
    },
  };
}

function buildNumericFieldEntries(
  record?: Record<string, number>,
): NumericFieldEntry[] {
  return Object.entries(record ?? {}).map(([field, value]) => ({
    field,
    value,
  }));
}

function buildNumericFieldRecord(
  entries: NumericFieldEntry[],
): Record<string, number> | undefined {
  const result: Record<string, number> = {};

  for (const entry of entries) {
    const field = entry.field.trim();
    if (
      !field ||
      typeof entry.value !== "number" ||
      !Number.isFinite(entry.value)
    ) {
      continue;
    }

    result[field] = entry.value;
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

function getMergedNumericFieldOptions(
  fieldOptions: Array<{ value: string; label: string }>,
  entries: NumericFieldEntry[],
): Array<{ value: string; label: string }> {
  const result = [...fieldOptions];
  const knownValues = new Set(fieldOptions.map((item) => item.value));

  for (const entry of entries) {
    const field = entry.field.trim();
    if (!field || knownValues.has(field)) {
      continue;
    }

    knownValues.add(field);
    result.push({
      value: field,
      label: `${field}（待确认字段）`,
    });
  }

  return result;
}

function isStructuredPassiveStatModifier(
  modifier: PassiveModifier,
): modifier is PassiveModifier & {
  scope: "stat";
  field: string;
  value: number;
} {
  return (
    modifier.scope === "stat" &&
    typeof modifier.field === "string" &&
    modifier.field.trim().length > 0 &&
    typeof modifier.value === "number" &&
    Number.isFinite(modifier.value)
  );
}

function buildPassiveStatModifiers(
  entries: NumericFieldEntry[],
  conditionName: string,
): PassiveModifier[] {
  const readableConditionName = conditionName.trim() || "未命名状态";

  return Object.entries(buildNumericFieldRecord(entries) ?? {}).map(
    ([field, value]) => ({
      scope: "stat",
      field,
      value,
      reason: `状态「${readableConditionName}」属性修正`,
    }),
  );
}

function ConditionCardEditor({
  condition,
  statFieldOptions,
  nameInputRef,
  onChange,
  onRemove,
}: {
  condition: ConditionConfig;
  statFieldOptions: Array<{ value: string; label: string }>;
  nameInputRef?: React.RefObject<HTMLInputElement | null>;
  onChange: (updates: Partial<ConditionConfig>) => void;
  onRemove: () => void;
}) {
  const triggerMode = getConditionTriggerMode(condition);
  const tagsText = (condition.tags ?? []).join(", ");
  const damageFilterText =
    condition.trigger?.timing === "on_damage"
      ? (condition.trigger.damageFilter?.damageTypes ?? []).join(", ")
      : "";
  const passiveModifiers =
    condition.trigger?.modifiers ?? EMPTY_PASSIVE_MODIFIERS;
  const structuredPassiveStatModifiers = useMemo(
    () => passiveModifiers.filter(isStructuredPassiveStatModifier),
    [passiveModifiers],
  );
  const advancedPassiveModifiers = useMemo(
    () =>
      passiveModifiers.filter(
        (modifier) => !isStructuredPassiveStatModifier(modifier),
      ),
    [passiveModifiers],
  );
  const passiveStatEntries = useMemo(
    () =>
      structuredPassiveStatModifiers.map((modifier) => ({
        field: modifier.field,
        value: modifier.value,
      })),
    [structuredPassiveStatModifiers],
  );

  return (
    <Card variant="outlined" className="space-y-4 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p
            className="text-sm font-semibold"
            style={{ color: color("textPrimary") }}
          >
            {condition.name || "未命名状态"}
          </p>
          <p
            className="mt-1 text-xs"
            style={{ color: colorAlpha("textMuted", 0.72) }}
          >
            状态 ID：{condition.id}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onRemove}>
          <Trash2 className="mr-1 h-4 w-4" />
          删除状态
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
        <Field label="显示名">
          <Input
            ref={nameInputRef}
            value={condition.name}
            onChange={(event) => onChange({ name: event.target.value })}
            placeholder="中毒"
          />
        </Field>
        <Field label="图标（可选）">
          <Input
            value={condition.icon ?? ""}
            onChange={(event) => onChange({ icon: event.target.value })}
            placeholder="skull"
          />
        </Field>
        <Field label="基础分类标签（逗号分隔）">
          <Input
            value={tagsText}
            onChange={(event) =>
              onChange({
                tags: event.target.value
                  .split(",")
                  .map((item) => item.trim())
                  .filter(Boolean),
              })
            }
            placeholder="debuff, poison"
          />
        </Field>
      </div>

      <Field label="说明">
        <Textarea
          value={condition.description ?? ""}
          onChange={(event) => onChange({ description: event.target.value })}
          className="min-h-24"
          placeholder="描述该状态对角色体验与玩法的影响"
        />
      </Field>

      <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
        <Field label="基础触发模式">
          <Select
            value={triggerMode}
            onValueChange={(value) =>
              onChange(
                buildConditionTriggerUpdate(
                  condition,
                  value as ConditionTriggerMode,
                ),
              )
            }
            options={CONDITION_TRIGGER_MODE_OPTIONS.map((option) => ({
              value: option.value,
              label: option.label,
            }))}
          />
        </Field>
        <Field label="持续回合（可选）">
          <Input
            type="number"
            value={condition.duration ?? ""}
            onChange={(event) =>
              onChange({
                duration:
                  event.target.value.trim() === ""
                    ? undefined
                    : Number(event.target.value),
              })
            }
            placeholder="3"
          />
        </Field>
        <ToggleSetting
          title="是否可叠加"
          description="决定同一状态被重复添加时是否允许保留叠层语义。"
          checked={condition.stackable ?? false}
          onCheckedChange={(checked) => onChange({ stackable: checked })}
        />
        <ToggleSetting
          title="触发后自动递减持续时间"
          description="适用于系统管理触发器；关闭后，该状态不会在触发时自动消耗剩余回合。"
          checked={
            triggerMode !== "ai" && condition.trigger?.autoDecrement !== false
          }
          onCheckedChange={(checked) =>
            onChange({
              trigger:
                triggerMode === "ai"
                  ? undefined
                  : {
                      ...(condition.trigger ?? { timing: triggerMode }),
                      timing: triggerMode,
                      autoDecrement: checked,
                    },
            })
          }
        />
      </div>

      <p className="text-xs" style={{ color: colorAlpha("textMuted", 0.72) }}>
        当前模型没有单独的“隐藏/显示”字段；只要列在这里，就会作为预定义状态参与作者态与运行时引用。
        内部 ID 由系统维护，无需普通作者手工管理。
      </p>

      {triggerMode === "passive" ? (
        <div className="space-y-3">
          <NumericFieldListEditor
            title="被动属性修正"
            description="只结构化最稳定的属性值加算（scope=stat）；系统会自动生成内部 reason 并清理空条目。"
            fieldLabel="目标字段"
            valueLabel="修正值"
            addLabel="添加修正"
            emptyMessage={
              statFieldOptions.length === 0
                ? "先配置主要属性或衍生属性后，再为状态添加被动修正。"
                : "当前没有被动属性修正；更复杂的检定/伤害修正仍建议使用高级 JSON。"
            }
            fieldOptions={statFieldOptions}
            entries={passiveStatEntries}
            onChange={(entries) => {
              const structuredModifiers = buildPassiveStatModifiers(
                entries,
                condition.name,
              );
              const nextModifiers = [
                ...advancedPassiveModifiers,
                ...structuredModifiers,
              ];
              onChange({
                trigger: {
                  ...(condition.trigger ?? { timing: "passive" }),
                  timing: "passive",
                  modifiers:
                    nextModifiers.length > 0 ? nextModifiers : undefined,
                },
              });
            }}
          />

          {advancedPassiveModifiers.length > 0 ? (
            <p
              className="text-xs"
              style={{ color: colorAlpha("textMuted", 0.72) }}
            >
              当前还有 {advancedPassiveModifiers.length}
              条复杂被动修正保留在高级 JSON 中，结构化面板不会覆盖它们。
            </p>
          ) : null}
        </div>
      ) : null}

      {triggerMode === "on_damage" ? (
        <Field label="伤害类型过滤（逗号分隔，可选）">
          <Input
            value={damageFilterText}
            onChange={(event) =>
              onChange({
                trigger: {
                  ...(condition.trigger ?? { timing: "on_damage" }),
                  timing: "on_damage",
                  ...(event.target.value.trim().length > 0
                    ? {
                        damageFilter: {
                          damageTypes: event.target.value
                            .split(",")
                            .map((item) => item.trim())
                            .filter(Boolean),
                        },
                      }
                    : { damageFilter: undefined }),
                },
              })
            }
            placeholder="fire, poison"
          />
        </Field>
      ) : null}

      <details
        className="rounded-xl border px-4 py-3"
        style={{
          borderColor: colorAlpha("border", 0.3),
          background: colorAlpha("bgCard", 0.22),
        }}
      >
        <summary
          className="cursor-pointer text-sm font-medium"
          style={{ color: color("textPrimary") }}
        >
          高级 JSON 仍可继续补充的内容
        </summary>
        <div
          className="mt-3 space-y-2 text-xs"
          style={{ color: colorAlpha("textMuted", 0.72) }}
        >
          <p>• turn_start / on_damage 的具体 actions</p>
          <p>• check / damage_* / 表达式型 passive modifiers</p>
          <p>• 更复杂的 damageFilter 与规则脚本细节</p>
        </div>
      </details>
    </Card>
  );
}

function ToggleSetting({
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

function NumericFieldListEditor({
  title,
  description,
  fieldLabel,
  valueLabel,
  addLabel,
  emptyMessage,
  fieldOptions,
  entries,
  onChange,
}: {
  title: string;
  description: string;
  fieldLabel: string;
  valueLabel: string;
  addLabel: string;
  emptyMessage: string;
  fieldOptions: Array<{ value: string; label: string }>;
  entries: NumericFieldEntry[];
  onChange: (entries: NumericFieldEntry[]) => void;
}) {
  const mergedFieldOptions = useMemo(
    () => getMergedNumericFieldOptions(fieldOptions, entries),
    [entries, fieldOptions],
  );
  const canAddEntry = mergedFieldOptions.length > 0;

  return (
    <div
      className="rounded-xl border px-4 py-3"
      style={{
        borderColor: colorAlpha("border", 0.3),
        background: colorAlpha("bgCard", 0.22),
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
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
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            onChange([
              ...entries,
              {
                field: mergedFieldOptions[0]?.value ?? "",
                value: 0,
              },
            ])
          }
          disabled={!canAddEntry}
        >
          <Plus className="mr-1 h-4 w-4" />
          {addLabel}
        </Button>
      </div>

      {entries.length === 0 ? (
        <p
          className="mt-3 text-xs"
          style={{ color: colorAlpha("textMuted", 0.72) }}
        >
          {emptyMessage}
        </p>
      ) : (
        <div className="mt-3 space-y-3">
          {entries.map((entry, index) => (
            <div
              key={`${entry.field || "field"}-${index}`}
              className="grid gap-3 md:grid-cols-[minmax(0,1fr)_9rem_auto] [&>label]:min-w-0"
            >
              <Field label={fieldLabel}>
                <Select
                  value={entry.field}
                  onValueChange={(value) =>
                    onChange(
                      entries.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, field: value } : item,
                      ),
                    )
                  }
                  options={[
                    { value: "", label: `选择${fieldLabel}` },
                    ...mergedFieldOptions,
                  ]}
                />
              </Field>
              <Field label={valueLabel}>
                <Input
                  type="number"
                  value={entry.value}
                  onChange={(event) =>
                    onChange(
                      entries.map((item, itemIndex) =>
                        itemIndex === index
                          ? {
                              ...item,
                              value:
                                event.target.value.trim() === ""
                                  ? ""
                                  : Number(event.target.value),
                            }
                          : item,
                      ),
                    )
                  }
                />
              </Field>
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
                  <Trash2 className="mr-1 h-4 w-4" />
                  删除
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
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
  const [activeTab, setActiveTab] = useState<DimensionCardTabId>("settings");
  const [activeOptionIndex, setActiveOptionIndex] = useState(0);
  const isRequired = dimension.required ?? false;
  const dimensionTitle =
    dimension.label.trim() || dimension.id.trim() || "未命名维度";
  const descriptionText = dimension.description?.trim() ?? "";
  const optionPreviewItems = dimension.options
    .map((option) => option.name.trim() || option.id.trim())
    .filter(Boolean);
  const optionPreview =
    optionPreviewItems.length > 0
      ? optionPreviewItems.slice(0, 3).join(" / ")
      : "尚未添加维度选项";
  const collapsedPreview =
    optionPreviewItems.length > 3
      ? `${optionPreview} 等 ${optionPreviewItems.length} 项`
      : optionPreview;
  const resolvedActiveOptionIndex =
    dimension.options.length === 0
      ? -1
      : Math.min(activeOptionIndex, dimension.options.length - 1);
  const activeOption =
    resolvedActiveOptionIndex >= 0
      ? dimension.options[resolvedActiveOptionIndex]
      : null;
  const activeOptionTitle =
    activeOption?.name.trim() ||
    activeOption?.id.trim() ||
    (activeOption
      ? `未命名选项 ${resolvedActiveOptionIndex + 1}`
      : "未选择选项");
  const tabItems: Array<{
    id: DimensionCardTabId;
    label: string;
    description: string;
  }> = [
    {
      id: "settings",
      label: "基础设置",
      description: "编辑名称、排序与说明",
    },
    {
      id: "options",
      label: "维度选项",
      description:
        dimension.options.length > 0
          ? `${dimension.options.length} 项待编辑`
          : "添加并维护选项",
    },
  ];
  const optionDetailRef = useRef<HTMLDivElement>(null);
  const optionNameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (dimension.options.length === 0) {
      if (activeOptionIndex !== 0) {
        setActiveOptionIndex(0);
      }
      return;
    }

    if (activeOptionIndex > dimension.options.length - 1) {
      setActiveOptionIndex(dimension.options.length - 1);
    }
  }, [activeOptionIndex, dimension.options.length]);

  useEffect(() => {
    if (activeTab !== "options" || resolvedActiveOptionIndex < 0) {
      return;
    }

    const animationFrameId = window.requestAnimationFrame(() => {
      optionDetailRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "nearest",
      });
      optionNameInputRef.current?.focus({ preventScroll: true });
    });

    return () => window.cancelAnimationFrame(animationFrameId);
  }, [activeTab, resolvedActiveOptionIndex, dimension.options.length]);

  const handleAddOption = () => {
    setActiveTab("options");
    onAddOption();
    setActiveOptionIndex(dimension.options.length);
  };

  const handleRemoveOption = (optionIndex: number) => {
    onRemoveOption(optionIndex);
    setActiveOptionIndex((currentIndex) => {
      if (dimension.options.length <= 1) {
        return 0;
      }

      if (currentIndex > optionIndex) {
        return currentIndex - 1;
      }

      if (currentIndex === optionIndex) {
        return Math.min(optionIndex, dimension.options.length - 2);
      }

      return currentIndex;
    });
  };

  let tabContent: React.ReactNode;

  switch (activeTab) {
    case "options":
      tabContent = (
        <div className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p
                className="text-sm font-medium"
                style={{ color: color("textPrimary") }}
              >
                维度选项
              </p>
              <p
                className="mt-1 text-xs"
                style={{ color: colorAlpha("textMuted", 0.72) }}
              >
                先从摘要列表定位要编辑的选项，再维护该项的描述、属性修正与天赋影响。
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <DimensionMetaBadge
                label="当前"
                value={`${dimension.options.length} 项`}
                accent={dimension.options.length > 0}
              />
              {activeOption ? (
                <DimensionMetaBadge
                  label="正在编辑"
                  value={activeOptionTitle}
                  accent
                />
              ) : null}
            </div>
          </div>

          {dimension.options.length > 0 ? (
            <div className="grid gap-3 xl:h-168 xl:grid-cols-[minmax(260px,320px)_minmax(0,1fr)] 2xl:grid-cols-[minmax(280px,360px)_minmax(0,1fr)]">
              <Panel
                variant="outlined"
                className={MASTER_DETAIL_LIST_PANEL_CLASS}
              >
                <div className={MASTER_DETAIL_LIST_CONTENT_CLASS}>
                  {dimension.options.map((option, optionIndex) => {
                    const isActive = resolvedActiveOptionIndex === optionIndex;
                    const optionTitle =
                      option.name.trim() ||
                      option.id.trim() ||
                      `未命名选项 ${optionIndex + 1}`;
                    const optionDescription = option.description?.trim() ?? "";
                    const attributeModifierCount = Object.values(
                      option.effects?.attributeModifiers ??
                        EMPTY_NUMERIC_RECORD,
                    ).filter((value) => value !== 0).length;
                    const grantedTalentCount =
                      option.effects?.grantedTalents?.length ?? 0;
                    const excludedTalentCount =
                      option.effects?.excludedTalents?.length ?? 0;

                    return (
                      <button
                        key={`${option.id}-${optionIndex}`}
                        type="button"
                        onClick={() => setActiveOptionIndex(optionIndex)}
                        className="w-full rounded-xl border px-3 py-3 text-left transition-all duration-150"
                        style={{
                          borderColor: colorAlpha(
                            isActive ? "primary" : "border",
                            isActive ? 0.42 : 0.28,
                          ),
                          background: colorAlpha(
                            isActive ? "primary" : "bgCard",
                            isActive ? 0.12 : 0.16,
                          ),
                          boxShadow: isActive
                            ? `0 0 18px ${colorAlpha("primary", 0.12)}`
                            : "none",
                        }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p
                              className="wrap-break-word text-sm font-medium leading-5"
                              style={{
                                color: isActive
                                  ? color("primary")
                                  : color("textPrimary"),
                                display: "-webkit-box",
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: "vertical",
                                overflow: "hidden",
                              }}
                              title={optionTitle}
                            >
                              {optionTitle}
                            </p>
                            <p
                              className="mt-1 text-[11px]"
                              style={{ color: colorAlpha("textMuted", 0.74) }}
                            >
                              ID：{option.id || "未设置"}
                            </p>
                          </div>
                          <span
                            className="shrink-0 rounded-full border px-2 py-0.5 text-[11px]"
                            style={{
                              borderColor: colorAlpha(
                                isActive ? "primary" : "border",
                                isActive ? 0.36 : 0.28,
                              ),
                              color: isActive
                                ? color("primary")
                                : colorAlpha("textMuted", 0.76),
                            }}
                          >
                            {isActive ? "当前" : `#${optionIndex + 1}`}
                          </span>
                        </div>
                        <p
                          className="mt-2 text-[11px] leading-5"
                          style={{
                            color: colorAlpha(
                              "textMuted",
                              isActive ? 0.82 : 0.72,
                            ),
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                          }}
                          title={optionDescription || "当前选项尚未填写描述"}
                        >
                          {optionDescription || "当前选项尚未填写描述"}
                        </p>
                        <p
                          className="mt-2 text-[11px]"
                          style={{ color: colorAlpha("textMuted", 0.74) }}
                        >
                          属性修正 {attributeModifierCount} · 赠送天赋{" "}
                          {grantedTalentCount}· 排除天赋 {excludedTalentCount}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </Panel>

              {activeOption ? (
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    ref={optionDetailRef}
                    key={`${activeOption.id}-${resolvedActiveOptionIndex}`}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.14 }}
                    className="space-y-3 xl:h-full xl:min-h-0 xl:overflow-y-auto xl:pr-1"
                  >
                    <Panel variant="outlined" className="p-3 sm:p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 flex-1">
                          <p
                            className="text-xs font-medium uppercase tracking-[0.2em]"
                            style={{ color: colorAlpha("primary", 0.82) }}
                          >
                            当前详情
                          </p>
                          <h5
                            className="mt-2 wrap-break-word text-sm font-semibold leading-6"
                            style={{ color: color("textPrimary") }}
                            title={activeOptionTitle}
                          >
                            {activeOptionTitle}
                          </h5>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <DimensionMetaBadge
                              label="序号"
                              value={String(resolvedActiveOptionIndex + 1)}
                            />
                          </div>
                          <p
                            className="mt-2 text-xs leading-5"
                            style={{ color: colorAlpha("textMuted", 0.74) }}
                          >
                            {activeOption.description?.trim() ||
                              "当前选项尚未填写说明，可直接在下方详情中补充。"}
                          </p>
                        </div>
                      </div>
                    </Panel>

                    <DimensionOptionCardEditor
                      option={activeOption}
                      attributeOptions={attributeOptions}
                      talentOptions={talentOptions}
                      nameInputRef={optionNameInputRef}
                      onChange={(updates) =>
                        onUpdateOption(resolvedActiveOptionIndex, updates)
                      }
                      onRemove={() =>
                        handleRemoveOption(resolvedActiveOptionIndex)
                      }
                    />
                  </motion.div>
                </AnimatePresence>
              ) : null}
            </div>
          ) : (
            <EmptySectionHint message="当前还没有维度选项。切换到该分区后添加选项，可继续配置描述、属性修正与天赋影响。" />
          )}
        </div>
      );
      break;

    case "settings":
    default:
      tabContent = (
        <div className="space-y-3">
          <p
            className="text-xs"
            style={{ color: colorAlpha("textMuted", 0.72) }}
          >
            编辑创建流程中的标题、标识、排序与说明文案。
          </p>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(120px,0.6fr)_minmax(0,1fr)] [&>label]:min-w-0 [&>div]:min-w-0">
            <Field label="维度名称">
              <Input
                value={dimension.label}
                onChange={(event) => onChange({ label: event.target.value })}
                placeholder="种族"
              />
            </Field>
            <Field label="维度 ID">
              <Input
                value={dimension.id}
                onChange={(event) => onChange({ id: event.target.value })}
                placeholder="race"
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
            <div
              className="rounded-xl border px-4 py-3"
              style={{
                borderColor: colorAlpha("border", 0.3),
                background: colorAlpha("bgCard", 0.22),
              }}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p
                    className="text-sm font-medium"
                    style={{ color: color("textPrimary") }}
                  >
                    必选维度
                  </p>
                  <p
                    className="mt-1 text-xs"
                    style={{ color: colorAlpha("textMuted", 0.72) }}
                  >
                    关闭后，角色创建流程允许跳过该维度。
                  </p>
                </div>
                <Toggle
                  checked={isRequired}
                  onCheckedChange={(checked) => onChange({ required: checked })}
                />
              </div>
            </div>
          </div>

          <Field label="维度说明">
            <Textarea
              value={dimension.description ?? ""}
              onChange={(event) =>
                onChange({ description: event.target.value })
              }
              className="min-h-20"
              placeholder="说明该维度在角色创建中的定位"
            />
          </Field>
        </div>
      );
      break;
  }

  return (
    <Card variant="outlined" className="space-y-4 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <h4
              className="min-w-0 wrap-break-word text-base font-semibold leading-6"
              style={{ color: color("textPrimary") }}
              title={dimensionTitle}
            >
              {dimensionTitle}
            </h4>
            <div className="flex flex-wrap gap-2">
              <DimensionMetaBadge
                label="流程"
                value={isRequired ? "必选" : "可跳过"}
                accent={isRequired}
              />
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <DimensionMetaBadge
              label="ID"
              value={dimension.id || "未设置"}
              mono
            />
            <DimensionMetaBadge
              label="排序"
              value={String(dimension.order ?? 0)}
            />
            <DimensionMetaBadge
              label="选项"
              value={String(dimension.options.length)}
              accent={dimension.options.length > 0}
            />
          </div>
          <p
            className="mt-3 text-xs leading-6"
            style={{
              color: colorAlpha("textMuted", 0.72),
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
            title={
              descriptionText ||
              "当前尚未填写维度说明，可在基础设置中补充该维度在角色创建中的定位。"
            }
          >
            {descriptionText ||
              "当前尚未填写维度说明，可在基础设置中补充该维度在角色创建中的定位。"}
          </p>
          <p
            className="mt-2 text-xs"
            style={{ color: colorAlpha("textMuted", 0.72) }}
          >
            当前仅渲染这个维度的详情；选项预览：{collapsedPreview}
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap lg:shrink-0 lg:justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={handleAddOption}
            className="w-full justify-center sm:w-auto"
          >
            <Plus className="mr-1 h-4 w-4" />
            添加选项
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onRemove}
            className="w-full justify-center sm:w-auto"
          >
            <Trash2 className="mr-1 h-4 w-4" />
            删除维度
          </Button>
        </div>
      </div>

      <div
        className="rounded-xl border px-3 py-3"
        style={{
          borderColor: colorAlpha("border", 0.3),
          background: colorAlpha("bgCard", 0.22),
        }}
      >
        <div className="grid gap-2 sm:grid-cols-2" role="tablist">
          {tabItems.map((tab) => {
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab.id)}
                className="rounded-lg border px-3 py-2 text-left transition-colors duration-150"
                style={{
                  borderColor: colorAlpha(
                    isActive ? "primary" : "border",
                    isActive ? 0.38 : 0.28,
                  ),
                  background: colorAlpha(
                    isActive ? "primary" : "bgCard",
                    isActive ? 0.14 : 0.12,
                  ),
                }}
              >
                <span
                  className="block text-sm font-medium"
                  style={{
                    color: isActive ? color("primary") : color("textPrimary"),
                  }}
                >
                  {tab.label}
                </span>
                <span
                  className="mt-1 block text-[11px] leading-5"
                  style={{ color: colorAlpha("textMuted", 0.72) }}
                >
                  {tab.description}
                </span>
              </button>
            );
          })}
        </div>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={activeTab}
            role="tabpanel"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.14 }}
            className="mt-3"
          >
            {tabContent}
          </motion.div>
        </AnimatePresence>
      </div>
    </Card>
  );
}

function DimensionOptionCardEditor({
  option,
  attributeOptions,
  talentOptions,
  nameInputRef,
  onChange,
  onRemove,
}: {
  option: DimensionOption;
  attributeOptions: PrimaryAttributeConfig[];
  talentOptions: TalentConfig[];
  nameInputRef?: React.RefObject<HTMLInputElement | null>;
  onChange: (updates: Partial<DimensionOption>) => void;
  onRemove: () => void;
}) {
  const attributeModifiers =
    option.effects?.attributeModifiers ?? EMPTY_NUMERIC_RECORD;
  const grantedTalents = option.effects?.grantedTalents ?? [];
  const excludedTalents = option.effects?.excludedTalents ?? [];
  const attributeModifierEntries = useMemo(
    () => buildNumericFieldEntries(attributeModifiers),
    [attributeModifiers],
  );

  return (
    <Panel variant="outlined" className="space-y-4 p-4">
      <div className="grid gap-3 md:grid-cols-3 [&>label]:min-w-0">
        <Field label="选项 ID">
          <Input
            value={option.id}
            onChange={(event) => onChange({ id: event.target.value })}
            placeholder="human"
          />
        </Field>
        <Field label="选项名称">
          <Input
            ref={nameInputRef}
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

      <div className="space-y-3">
        <NumericFieldListEditor
          title="属性修正"
          description="普通作者可直接选择目标属性并填写修正值；系统会自动清理空条目并维持内部绑定。"
          fieldLabel="目标属性"
          valueLabel="修正值"
          addLabel="添加修正"
          emptyMessage={
            attributeOptions.length === 0
              ? "先在属性分区配置主要属性后，再为维度选项添加修正。"
              : "当前没有属性修正；留空表示该选项不额外改变初始属性。"
          }
          fieldOptions={attributeOptions.map((item) => ({
            value: item.key,
            label: `${item.label}（${item.key}）`,
          }))}
          entries={attributeModifierEntries}
          onChange={(entries) =>
            onChange({
              effects: {
                ...(option.effects ?? {}),
                attributeModifiers: buildNumericFieldRecord(entries),
                grantedTalents,
                excludedTalents,
              },
            })
          }
        />

        <div className="grid gap-3 lg:grid-cols-2 [&>div]:min-w-0">
          <div
            className="rounded-xl border px-4 py-3"
            style={{
              borderColor: colorAlpha("border", 0.3),
              background: colorAlpha("bgCard", 0.22),
            }}
          >
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
          </div>

          <div
            className="rounded-xl border px-4 py-3"
            style={{
              borderColor: colorAlpha("border", 0.3),
              background: colorAlpha("bgCard", 0.22),
            }}
          >
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
        </div>
      </div>

      <div className="mt-3 flex justify-end">
        <Button variant="outline" size="sm" onClick={onRemove}>
          <Trash2 className="mr-1 h-4 w-4" />
          删除选项
        </Button>
      </div>
    </Panel>
  );
}

function TalentRulesCardEditor({
  talentRules,
  onChange,
}: {
  talentRules?: TalentRulesValue;
  onChange: (updates: Partial<TalentRulesValue>) => void;
}) {
  return (
    <Card variant="outlined" className="space-y-4 p-4">
      <div>
        <h4
          className="text-sm font-semibold"
          style={{ color: color("textPrimary") }}
        >
          天赋选择规则
        </h4>
        <p
          className="mt-1 text-xs"
          style={{ color: colorAlpha("textMuted", 0.72) }}
        >
          这里控制角色创建阶段的基础选择数量与运行中是否允许继续获得新天赋；更复杂限制仍通过高级
          JSON 兜底。
        </p>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Field label="角色创建可选数量（留空=默认 2）">
          <Input
            type="number"
            value={talentRules?.initialCount ?? ""}
            onChange={(event) =>
              onChange({
                initialCount:
                  event.target.value.trim() === ""
                    ? undefined
                    : Number(event.target.value),
              })
            }
            placeholder="2"
          />
        </Field>
        <ToggleSetting
          title="允许游戏中获得新天赋"
          description="关闭后，普通流程不应再让角色在运行中继续新增天赋。"
          checked={talentRules?.allowAcquireDuringGame ?? true}
          onCheckedChange={(checked) =>
            onChange({ allowAcquireDuringGame: checked })
          }
        />
      </div>
    </Card>
  );
}

function TalentCardEditor({
  talent,
  attributeOptions,
  nameInputRef,
  onChange,
  onRemove,
}: {
  talent: TalentConfig;
  attributeOptions: PrimaryAttributeConfig[];
  nameInputRef?: React.RefObject<HTMLInputElement | null>;
  onChange: (updates: Partial<TalentConfig>) => void;
  onRemove: () => void;
}) {
  const prerequisiteEntries = buildNumericFieldEntries(
    talent.prerequisites?.attributes,
  );

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
            ref={nameInputRef}
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
        <NumericFieldListEditor
          title="前置属性要求"
          description="普通作者可直接增删属性门槛；系统会自动清理空条目。"
          fieldLabel="目标属性"
          valueLabel="最低值"
          addLabel="添加前置条件"
          emptyMessage={
            attributeOptions.length === 0
              ? "先在属性分区配置主要属性后，再为天赋添加前置条件。"
              : "当前没有前置属性要求；留空表示任何角色都可选择。"
          }
          fieldOptions={attributeOptions.map((item) => ({
            value: item.key,
            label: `${item.label}（${item.key}）`,
          }))}
          entries={prerequisiteEntries}
          onChange={(entries) => {
            const nextAttributes = buildNumericFieldRecord(entries);
            onChange({
              prerequisites: nextAttributes
                ? { attributes: nextAttributes }
                : undefined,
            });
          }}
        />

        <div
          className="rounded-xl border px-4 py-3"
          style={{
            borderColor: colorAlpha("border", 0.3),
            background: colorAlpha("bgCard", 0.22),
          }}
        >
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
          <p
            className="mt-2 text-xs"
            style={{ color: colorAlpha("textMuted", 0.72) }}
          >
            互斥关系当前仍保留文本输入；若需要更复杂的条件与
            modifier，请继续使用高级 JSON。
          </p>
        </div>
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
