/**
 * 世界编辑面板
 */

import { AnimatePresence, motion } from "framer-motion";
import { Plus, WandSparkles, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  Card as BaseCard,
  Button,
  Input,
  Panel,
  ScrollArea,
  Textarea,
} from "@/components/ui";
import type { ItemTemplate } from "@/domain/entities/item";
import type { SkillTemplate } from "@/domain/entities/skill";
import { cn } from "@/lib/utils";
import type {
  CharacterDimension,
  ConditionConfig,
  DerivedStatConfig,
  DimensionOption,
  EquipSlotDefinition,
  InventoryRulesConfig,
  LevelSystemConfig,
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
import { LevelSystemEditor } from "./LevelSystemEditor";
import { TalentPoolEditor } from "./TalentPoolEditor";
import { TalentRarityEditor } from "./TalentRarityEditor";
import {
  getTalentCategoryLabel,
  TALENT_CATEGORY_OPTIONS,
} from "./world-workspace-talent-shared";
import { WorldEditorPaneAttributesSection } from "./WorldEditorPaneAttributesSection";
import { WorldEditorPaneCheckRulesSection } from "./WorldEditorPaneCheckRulesSection";
import { WorldEditorPaneConditionsSection } from "./WorldEditorPaneConditionsSection";
import { WorldEditorPaneDerivedStatsSection } from "./WorldEditorPaneDerivedStatsSection";
import { WorldEditorPaneDimensionsSection } from "./WorldEditorPaneDimensionsSection";
import { WorldEditorPaneEquipmentSection } from "./WorldEditorPaneEquipmentSection";
import { WorldEditorPaneItemTemplatesSection } from "./WorldEditorPaneItemTemplatesSection";
import {
  WORLD_EDITOR_SECTIONS,
  type WorldEditorSectionId,
} from "./WorldEditorPaneSections";
import {
  ValidationPanel,
  WorldEditorDesktopSidebar,
  WorldEditorMobileSectionNavigation,
  WorldEditorSectionBanner,
} from "./WorldEditorPaneSidebar";
import { WorldEditorPaneSkillTemplatesSection } from "./WorldEditorPaneSkillTemplatesSection";
import type {
  TalentPityRuleValue,
  TalentRulesValue,
} from "./WorldWorkspaceTalentEditors";
import {
  TalentCardEditor,
  TalentPityRulesEditor,
  TalentRulesCardEditor,
} from "./WorldWorkspaceTalentEditors";

const EMPTY_PRIMARY_ATTRIBUTES: PrimaryAttributeConfig[] = [];
const EMPTY_DERIVED_STATS: DerivedStatConfig[] = [];
const EMPTY_DIMENSIONS: CharacterDimension[] = [];
const EMPTY_TALENTS: TalentConfig[] = [];
const EMPTY_CONDITIONS: ConditionConfig[] = [];
const EMPTY_ITEM_TEMPLATES: ItemTemplate[] = [];
const EMPTY_EQUIP_SLOT_DEFINITIONS: EquipSlotDefinition[] = [];
const EMPTY_SKILL_TEMPLATES: SkillTemplate[] = [];
const EMPTY_TALENT_RARITIES: NonNullable<TalentRulesValue["rarities"]> = [];
const EMPTY_TALENT_POOLS: NonNullable<TalentRulesValue["pools"]> = [];
const EMPTY_TALENT_PITY_RULES: NonNullable<TalentRulesValue["pity"]> = [];

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
type TalentRarityValue = NonNullable<TalentRulesValue["rarities"]>[number];
type TalentPoolValue = NonNullable<TalentRulesValue["pools"]>[number];
type DCPresetConfig = NonNullable<CheckRulesValue["dcPresets"]>[string];
type OpposedPresetConfig = NonNullable<
  CheckRulesValue["opposedPresets"]
>[string];
type DCGuidelineScaleItem = NonNullable<
  NonNullable<CheckRulesValue["dcGuideline"]>["scale"]
>[number];

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
  "level-system": {
    title: "高级模式 · 等级系统配置",
    description:
      "仅展示并回写 levelSystem 子树；基础成长模式、进度、分配与叙事开关已结构化，复杂奖励包继续通过 JSON 兜底。",
    footnote:
      "只影响当前分区对应的规则子树，其余规则分支、基础信息与叙事启动保持不变。",
  },
  inventoryRules: {
    title: "高级模式 · 装备系统规则编辑",
    description:
      "仅展示并回写 inventoryRules 子树；支持直接维护 defaultCapacity 与 equipSlotDefinitions。",
    footnote:
      "只影响当前分区对应的规则子树，其余规则分支、基础信息与叙事启动保持不变。",
  },
  itemTemplates: {
    title: "高级模式 · 物品模板编辑",
    description:
      "仅展示并回写 itemTemplates 子树；基础属性、分类、堆叠与装备槽位已结构化，effects 等复杂内容继续通过 JSON 兜底。",
    footnote:
      "只影响当前分区对应的规则子树，其余规则分支、基础信息与叙事启动保持不变。",
  },
  skillTemplates: {
    title: "高级模式 · 技能模板编辑",
    description:
      "仅展示并回写 skillTemplates 子树；基础属性、主动消耗已结构化，effects / prerequisites / evolvesInto 继续通过 JSON 兜底。",
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
  onAddTalentRarity: () => void;
  onRemoveTalentRarity: (id: string) => void;
  onUpdateTalentRarity: (
    id: string,
    updates: Partial<TalentRarityValue>,
  ) => void;
  onAddTalentPool: () => void;
  onRemoveTalentPool: (id: string) => void;
  onUpdateTalentPool: (id: string, updates: Partial<TalentPoolValue>) => void;
  onAddTalentPityRule: () => void;
  onRemoveTalentPityRule: (index: number) => void;
  onUpdateTalentPityRule: (
    index: number,
    updates: Partial<TalentPityRuleValue>,
  ) => void;
  onUpdateLevelSystem: (partial: Partial<LevelSystemConfig>) => void;
  onUpdateTalent: (index: number, updates: Partial<TalentConfig>) => void;
  onAddTalent: () => void;
  onRemoveTalent: (index: number) => void;
  onAddEquipSlot: () => void;
  onUpdateEquipSlot: (
    index: number,
    updates: Partial<EquipSlotDefinition>,
  ) => void;
  onRemoveEquipSlot: (index: number) => void;
  onUpdateDefaultCapacity: (value: number | undefined) => void;
  onUpdateItemTemplate: (index: number, updates: Partial<ItemTemplate>) => void;
  onAddItemTemplate: () => void;
  onRemoveItemTemplate: (index: number) => void;
  onUpdateSkillTemplate: (
    index: number,
    updates: Partial<SkillTemplate>,
  ) => void;
  onAddSkillTemplate: () => void;
  onRemoveSkillTemplate: (index: number) => void;
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
  onAddTalentRarity,
  onRemoveTalentRarity,
  onUpdateTalentRarity,
  onAddTalentPool,
  onRemoveTalentPool,
  onUpdateTalentPool,
  onAddTalentPityRule,
  onRemoveTalentPityRule,
  onUpdateTalentPityRule,
  onUpdateLevelSystem,
  onUpdateTalent,
  onAddTalent,
  onRemoveTalent,
  onAddEquipSlot,
  onUpdateEquipSlot,
  onRemoveEquipSlot,
  onUpdateDefaultCapacity,
  onUpdateItemTemplate,
  onAddItemTemplate,
  onRemoveItemTemplate,
  onUpdateSkillTemplate,
  onAddSkillTemplate,
  onRemoveSkillTemplate,
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
  const [activeEquipSlotIndex, setActiveEquipSlotIndex] = useState(0);
  const [activeItemTemplateIndex, setActiveItemTemplateIndex] = useState(0);
  const [activeSkillTemplateIndex, setActiveSkillTemplateIndex] = useState(0);
  const attributeDetailRef = useRef<HTMLDivElement>(null);
  const attributeLabelInputRef = useRef<HTMLInputElement>(null);
  const derivedStatDetailRef = useRef<HTMLDivElement>(null);
  const derivedStatLabelInputRef = useRef<HTMLInputElement>(null);
  const conditionDetailRef = useRef<HTMLDivElement>(null);
  const conditionNameInputRef = useRef<HTMLInputElement>(null);
  const talentDetailRef = useRef<HTMLDivElement>(null);
  const talentNameInputRef = useRef<HTMLInputElement>(null);
  const equipSlotDetailRef = useRef<HTMLDivElement>(null);
  const equipSlotIdInputRef = useRef<HTMLInputElement>(null);
  const itemTemplateDetailRef = useRef<HTMLDivElement>(null);
  const itemTemplateNameInputRef = useRef<HTMLInputElement>(null);
  const skillTemplateDetailRef = useRef<HTMLDivElement>(null);
  const skillTemplateNameInputRef = useRef<HTMLInputElement>(null);

  const primaryAttributes =
    world?.rules.primaryAttributes ?? EMPTY_PRIMARY_ATTRIBUTES;
  const derivedStats = world?.rules.derivedStats ?? EMPTY_DERIVED_STATS;
  const checkRules: CheckRulesValue = world?.rules.checkRules ?? {};
  const conditions = world?.rules.conditions ?? EMPTY_CONDITIONS;
  const dimensions = world?.rules.dimensions ?? EMPTY_DIMENSIONS;
  const talents = world?.rules.talents ?? EMPTY_TALENTS;
  const inventoryRules: InventoryRulesConfig | undefined =
    world?.rules.inventoryRules;
  const defaultCapacity = inventoryRules?.defaultCapacity;
  const equipSlotDefinitions =
    inventoryRules?.equipSlotDefinitions ?? EMPTY_EQUIP_SLOT_DEFINITIONS;
  const itemTemplates = world?.rules.itemTemplates ?? EMPTY_ITEM_TEMPLATES;
  const skillTemplates = world?.rules.skillTemplates ?? EMPTY_SKILL_TEMPLATES;
  const talentRules = world?.rules.talentRules;
  const talentRarities = talentRules?.rarities ?? EMPTY_TALENT_RARITIES;
  const talentPools = talentRules?.pools ?? EMPTY_TALENT_POOLS;
  const talentPityRules = talentRules?.pity ?? EMPTY_TALENT_PITY_RULES;
  const levelSystem = world?.rules.levelSystem;
  const talentRarityOptions = useMemo(
    () =>
      talentRarities.map((rarity) => ({
        value: rarity.id,
        label: `${rarity.label}（${rarity.id}）`,
      })),
    [talentRarities],
  );
  const talentPoolItems = useMemo(
    () =>
      talentPools.map((pool) => ({
        id: pool.id,
        name: pool.label?.trim() || pool.id,
      })),
    [talentPools],
  );
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

  useEffect(() => {
    setActiveEquipSlotIndex(0);
  }, [world?.id]);

  useEffect(() => {
    setActiveItemTemplateIndex(0);
  }, [world?.id]);

  useEffect(() => {
    setActiveSkillTemplateIndex(0);
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
  const resolvedActiveEquipSlotIndex =
    equipSlotDefinitions.length === 0
      ? -1
      : Math.min(activeEquipSlotIndex, equipSlotDefinitions.length - 1);
  const activeEquipSlot =
    resolvedActiveEquipSlotIndex >= 0
      ? equipSlotDefinitions[resolvedActiveEquipSlotIndex]
      : null;
  const resolvedActiveItemTemplateIndex =
    itemTemplates.length === 0
      ? -1
      : Math.min(activeItemTemplateIndex, itemTemplates.length - 1);
  const activeItemTemplate =
    resolvedActiveItemTemplateIndex >= 0
      ? itemTemplates[resolvedActiveItemTemplateIndex]
      : null;
  const resolvedActiveSkillTemplateIndex =
    skillTemplates.length === 0
      ? -1
      : Math.min(activeSkillTemplateIndex, skillTemplates.length - 1);
  const activeSkillTemplate =
    resolvedActiveSkillTemplateIndex >= 0
      ? skillTemplates[resolvedActiveSkillTemplateIndex]
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

  useEffect(() => {
    if (equipSlotDefinitions.length === 0) {
      if (activeEquipSlotIndex !== 0) {
        setActiveEquipSlotIndex(0);
      }
      return;
    }

    if (activeEquipSlotIndex > equipSlotDefinitions.length - 1) {
      setActiveEquipSlotIndex(equipSlotDefinitions.length - 1);
    }
  }, [activeEquipSlotIndex, equipSlotDefinitions.length]);

  useEffect(() => {
    if (
      activeSection !== "inventoryRules" ||
      resolvedActiveEquipSlotIndex < 0
    ) {
      return;
    }

    const animationFrameId = window.requestAnimationFrame(() => {
      equipSlotDetailRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "nearest",
      });
      equipSlotIdInputRef.current?.focus({ preventScroll: true });
    });

    return () => window.cancelAnimationFrame(animationFrameId);
  }, [
    activeEquipSlotIndex,
    activeSection,
    equipSlotDefinitions.length,
    resolvedActiveEquipSlotIndex,
  ]);

  useEffect(() => {
    if (itemTemplates.length === 0) {
      if (activeItemTemplateIndex !== 0) {
        setActiveItemTemplateIndex(0);
      }
      return;
    }

    if (activeItemTemplateIndex > itemTemplates.length - 1) {
      setActiveItemTemplateIndex(itemTemplates.length - 1);
    }
  }, [activeItemTemplateIndex, itemTemplates.length]);

  useEffect(() => {
    if (
      activeSection !== "itemTemplates" ||
      resolvedActiveItemTemplateIndex < 0
    ) {
      return;
    }

    const animationFrameId = window.requestAnimationFrame(() => {
      itemTemplateDetailRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "nearest",
      });
      itemTemplateNameInputRef.current?.focus({ preventScroll: true });
    });

    return () => window.cancelAnimationFrame(animationFrameId);
  }, [activeSection, itemTemplates.length, resolvedActiveItemTemplateIndex]);

  useEffect(() => {
    if (skillTemplates.length === 0) {
      if (activeSkillTemplateIndex !== 0) {
        setActiveSkillTemplateIndex(0);
      }
      return;
    }

    if (activeSkillTemplateIndex > skillTemplates.length - 1) {
      setActiveSkillTemplateIndex(skillTemplates.length - 1);
    }
  }, [activeSkillTemplateIndex, skillTemplates.length]);

  useEffect(() => {
    if (
      activeSection !== "skillTemplates" ||
      resolvedActiveSkillTemplateIndex < 0
    ) {
      return;
    }

    const animationFrameId = window.requestAnimationFrame(() => {
      skillTemplateDetailRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "nearest",
      });
      skillTemplateNameInputRef.current?.focus({ preventScroll: true });
    });

    return () => window.cancelAnimationFrame(animationFrameId);
  }, [activeSection, resolvedActiveSkillTemplateIndex, skillTemplates.length]);

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

  const handleAddEquipSlot = () => {
    onAddEquipSlot();
    setActiveEquipSlotIndex(equipSlotDefinitions.length);
  };

  const handleRemoveEquipSlot = (equipSlotIndex: number) => {
    onRemoveEquipSlot(equipSlotIndex);
    setActiveEquipSlotIndex((currentIndex) => {
      if (equipSlotDefinitions.length <= 1) {
        return 0;
      }

      if (currentIndex > equipSlotIndex) {
        return currentIndex - 1;
      }

      if (currentIndex === equipSlotIndex) {
        return Math.min(equipSlotIndex, equipSlotDefinitions.length - 2);
      }

      return currentIndex;
    });
  };

  const handleAddItemTemplate = () => {
    onAddItemTemplate();
    setActiveItemTemplateIndex(itemTemplates.length);
  };

  const handleRemoveItemTemplate = (itemTemplateIndex: number) => {
    onRemoveItemTemplate(itemTemplateIndex);
    setActiveItemTemplateIndex((currentIndex) => {
      if (itemTemplates.length <= 1) {
        return 0;
      }

      if (currentIndex > itemTemplateIndex) {
        return currentIndex - 1;
      }

      if (currentIndex === itemTemplateIndex) {
        return Math.min(itemTemplateIndex, itemTemplates.length - 2);
      }

      return currentIndex;
    });
  };

  const handleAddSkillTemplate = () => {
    onAddSkillTemplate();
    setActiveSkillTemplateIndex(skillTemplates.length);
  };

  const handleRemoveSkillTemplate = (skillTemplateIndex: number) => {
    onRemoveSkillTemplate(skillTemplateIndex);
    setActiveSkillTemplateIndex((currentIndex) => {
      if (skillTemplates.length <= 1) {
        return 0;
      }

      if (currentIndex > skillTemplateIndex) {
        return currentIndex - 1;
      }

      if (currentIndex === skillTemplateIndex) {
        return Math.min(skillTemplateIndex, skillTemplates.length - 2);
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

  let sectionContent: React.ReactNode = null;

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
        <WorldEditorPaneAttributesSection
          primaryAttributes={primaryAttributes}
          pointBuyRules={world.rules.pointBuyRules}
          allocatableAttributeOptions={allocatableAttributeOptions}
          activeAttribute={activeAttribute}
          resolvedActiveAttributeIndex={resolvedActiveAttributeIndex}
          rulesEditorActive={
            rawRulesEditorOpen && rawRulesEditorScope === "attributes"
          }
          rulesEditorTitle={SCOPED_RAW_RULES_EDITOR_META.attributes.description}
          detailRef={attributeDetailRef}
          labelInputRef={attributeLabelInputRef}
          onOpenRulesEditor={() => onOpenRawRulesEditor("attributes")}
          onSetActiveAttributeIndex={setActiveAttributeIndex}
          onAddPrimaryAttribute={handleAddPrimaryAttribute}
          onUpdatePrimaryAttribute={onUpdatePrimaryAttribute}
          onRemovePrimaryAttribute={handleRemovePrimaryAttribute}
          onUpdatePointBuyRules={onUpdatePointBuyRules}
        />
      );
      break;

    case "derivedStats":
      sectionContent = (
        <WorldEditorPaneDerivedStatsSection
          derivedStats={derivedStats}
          statFieldOptions={statFieldOptions}
          activeDerivedStat={activeDerivedStat}
          resolvedActiveDerivedStatIndex={resolvedActiveDerivedStatIndex}
          rulesEditorActive={
            rawRulesEditorOpen && rawRulesEditorScope === "derivedStats"
          }
          rulesEditorTitle={
            SCOPED_RAW_RULES_EDITOR_META.derivedStats.description
          }
          detailRef={derivedStatDetailRef}
          labelInputRef={derivedStatLabelInputRef}
          onOpenRulesEditor={() => onOpenRawRulesEditor("derivedStats")}
          onSetActiveDerivedStatIndex={setActiveDerivedStatIndex}
          onAddDerivedStat={handleAddDerivedStat}
          onUpdateDerivedStat={onUpdateDerivedStat}
          onRemoveDerivedStat={handleRemoveDerivedStat}
        />
      );
      break;

    case "checkRules":
      sectionContent = (
        <WorldEditorPaneCheckRulesSection
          checkRules={checkRules}
          dcPresetEntries={dcPresetEntries}
          opposedPresetEntries={opposedPresetEntries}
          dcGuidelineScale={dcGuidelineScale}
          rulesEditorActive={
            rawRulesEditorOpen && rawRulesEditorScope === "checkRules"
          }
          rulesEditorTitle={SCOPED_RAW_RULES_EDITOR_META.checkRules.description}
          onOpenRulesEditor={() => onOpenRawRulesEditor("checkRules")}
          onUpdateCheckRules={onUpdateCheckRules}
          onAddDcPreset={onAddDcPreset}
          onUpdateDcPreset={onUpdateDcPreset}
          onRemoveDcPreset={onRemoveDcPreset}
          onAddOpposedPreset={onAddOpposedPreset}
          onUpdateOpposedPreset={onUpdateOpposedPreset}
          onRemoveOpposedPreset={onRemoveOpposedPreset}
          onAddDCGuidelineItem={onAddDCGuidelineItem}
          onUpdateDCGuidelineItem={onUpdateDCGuidelineItem}
          onRemoveDCGuidelineItem={onRemoveDCGuidelineItem}
        />
      );
      break;

    case "conditions":
      sectionContent = (
        <WorldEditorPaneConditionsSection
          conditions={conditions}
          statFieldOptions={statFieldOptions}
          activeCondition={activeCondition}
          resolvedActiveConditionIndex={resolvedActiveConditionIndex}
          rulesEditorActive={
            rawRulesEditorOpen && rawRulesEditorScope === "conditions"
          }
          rulesEditorTitle={SCOPED_RAW_RULES_EDITOR_META.conditions.description}
          detailRef={conditionDetailRef}
          nameInputRef={conditionNameInputRef}
          onOpenRulesEditor={() => onOpenRawRulesEditor("conditions")}
          onSetActiveConditionIndex={setActiveConditionIndex}
          onAddCondition={handleAddCondition}
          onUpdateCondition={onUpdateCondition}
          onRemoveCondition={handleRemoveCondition}
        />
      );
      break;

    case "dimensions":
      sectionContent = (
        <WorldEditorPaneDimensionsSection
          dimensions={dimensions}
          primaryAttributes={primaryAttributes}
          talents={talents}
          activeDimension={activeDimension}
          resolvedActiveDimensionIndex={resolvedActiveDimensionIndex}
          rulesEditorActive={
            rawRulesEditorOpen && rawRulesEditorScope === "dimensions"
          }
          rulesEditorTitle={SCOPED_RAW_RULES_EDITOR_META.dimensions.description}
          onOpenRulesEditor={() => onOpenRawRulesEditor("dimensions")}
          onSetActiveDimensionIndex={setActiveDimensionIndex}
          onAddDimension={handleAddDimension}
          onUpdateDimension={onUpdateDimension}
          onRemoveDimension={handleRemoveDimension}
          onAddDimensionOption={onAddDimensionOption}
          onUpdateDimensionOption={onUpdateDimensionOption}
          onRemoveDimensionOption={onRemoveDimensionOption}
        />
      );
      break;

    case "talents":
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

            <TalentRarityEditor
              rarities={talentRarities}
              onAdd={onAddTalentRarity}
              onRemove={onRemoveTalentRarity}
              onUpdate={onUpdateTalentRarity}
            />

            <TalentPoolEditor
              pools={talentPools}
              categoryOptions={TALENT_CATEGORY_OPTIONS.map((option) => ({
                value: option.value,
                label: option.label,
              }))}
              rarityOptions={talentRarityOptions}
              talentOptions={talents}
              onAdd={onAddTalentPool}
              onRemove={onRemoveTalentPool}
              onUpdate={onUpdateTalentPool}
            />

            <TalentPityRulesEditor
              pityRules={talentPityRules}
              rarityOptions={talentRarityOptions}
              onAdd={onAddTalentPityRule}
              onRemove={onRemoveTalentPityRule}
              onUpdate={onUpdateTalentPityRule}
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
                      const categoryLabel = getTalentCategoryLabel(
                        talent.category,
                      );
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
                              value={getTalentCategoryLabel(
                                activeTalent.category,
                              )}
                            />
                          </div>
                        </div>
                      </Panel>

                      <TalentCardEditor
                        talent={activeTalent}
                        rarityOptions={talentRarityOptions}
                        poolItems={talentPoolItems}
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

    case "level-system":
      sectionContent = (
        <FormSection
          title="等级系统"
          description="配置升级触发、进度阈值、自动成长、属性点分配与奖励内容；升级资源恢复统一按上限增量同步，复杂奖励包继续通过高级规则编辑维护。"
          action={
            <div className="flex flex-wrap gap-2">
              <SectionRulesEditorButton
                scope="level-system"
                active={
                  rawRulesEditorOpen && rawRulesEditorScope === "level-system"
                }
                onOpen={onOpenRawRulesEditor}
              />
            </div>
          }
        >
          <LevelSystemEditor
            value={levelSystem ?? {}}
            primaryAttributes={primaryAttributes}
            onChange={onUpdateLevelSystem}
          />
        </FormSection>
      );
      break;

    case "inventoryRules":
      sectionContent = (
        <WorldEditorPaneEquipmentSection
          defaultCapacity={defaultCapacity}
          equipSlotDefinitions={equipSlotDefinitions}
          activeEquipSlot={activeEquipSlot}
          resolvedActiveEquipSlotIndex={resolvedActiveEquipSlotIndex}
          rulesEditorActive={
            rawRulesEditorOpen && rawRulesEditorScope === "inventoryRules"
          }
          rulesEditorTitle={
            SCOPED_RAW_RULES_EDITOR_META.inventoryRules.description
          }
          detailRef={equipSlotDetailRef}
          idInputRef={equipSlotIdInputRef}
          onOpenRulesEditor={() => onOpenRawRulesEditor("inventoryRules")}
          onSetActiveEquipSlotIndex={setActiveEquipSlotIndex}
          onUpdateDefaultCapacity={onUpdateDefaultCapacity}
          onAddEquipSlot={handleAddEquipSlot}
          onUpdateEquipSlot={onUpdateEquipSlot}
          onRemoveEquipSlot={handleRemoveEquipSlot}
        />
      );
      break;

    case "itemTemplates":
      sectionContent = (
        <WorldEditorPaneItemTemplatesSection
          itemTemplates={itemTemplates}
          equipSlotDefinitions={equipSlotDefinitions}
          activeItemTemplate={activeItemTemplate}
          resolvedActiveItemTemplateIndex={resolvedActiveItemTemplateIndex}
          rulesEditorActive={
            rawRulesEditorOpen && rawRulesEditorScope === "itemTemplates"
          }
          rulesEditorTitle={
            SCOPED_RAW_RULES_EDITOR_META.itemTemplates.description
          }
          detailRef={itemTemplateDetailRef}
          nameInputRef={itemTemplateNameInputRef}
          onOpenRulesEditor={() => onOpenRawRulesEditor("itemTemplates")}
          onSetActiveItemTemplateIndex={setActiveItemTemplateIndex}
          onAddItemTemplate={handleAddItemTemplate}
          onUpdateItemTemplate={onUpdateItemTemplate}
          onRemoveItemTemplate={handleRemoveItemTemplate}
        />
      );
      break;

    case "skillTemplates":
      sectionContent = (
        <WorldEditorPaneSkillTemplatesSection
          skillTemplates={skillTemplates}
          activeSkillTemplate={activeSkillTemplate}
          resolvedActiveSkillTemplateIndex={resolvedActiveSkillTemplateIndex}
          rulesEditorActive={
            rawRulesEditorOpen && rawRulesEditorScope === "skillTemplates"
          }
          rulesEditorTitle={
            SCOPED_RAW_RULES_EDITOR_META.skillTemplates.description
          }
          detailRef={skillTemplateDetailRef}
          nameInputRef={skillTemplateNameInputRef}
          onOpenRulesEditor={() => onOpenRawRulesEditor("skillTemplates")}
          onSetActiveSkillTemplateIndex={setActiveSkillTemplateIndex}
          onAddSkillTemplate={handleAddSkillTemplate}
          onUpdateSkillTemplate={onUpdateSkillTemplate}
          onRemoveSkillTemplate={handleRemoveSkillTemplate}
        />
      );
      break;

    default:
      sectionContent = null;
  }

  return (
    <div className="relative flex h-full min-h-0 flex-col lg:flex-row">
      <WorldEditorDesktopSidebar
        world={world}
        activeSection={activeSection}
        activeSectionMeta={activeSectionMeta}
        validationMessages={validationMessages}
        onSelectSection={setActiveSection}
      />

      <ScrollArea
        key={`${world.id}-${activeSection}`}
        className="min-h-0 flex-1"
      >
        <div className="space-y-4 px-3 py-3 sm:space-y-5 sm:px-5 sm:py-4">
          <div className="lg:hidden">
            <WorldEditorMobileSectionNavigation
              activeSection={activeSection}
              onSelectSection={setActiveSection}
            />
          </div>

          <WorldEditorSectionBanner section={activeSectionMeta} />

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

function formatTimestamp(timestamp: number): string {
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return "未记录";
  }

  return new Date(timestamp).toLocaleString("zh-CN", { hour12: false });
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
