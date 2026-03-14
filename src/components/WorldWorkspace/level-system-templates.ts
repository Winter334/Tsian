import type {
  DerivedStatConfig,
  LevelSystemConfig,
  PrimaryAttributeConfig,
} from "@/lib/world/types";

type ProgressConfig = NonNullable<LevelSystemConfig["progress"]>;
type AutoGrowthConfig = NonNullable<LevelSystemConfig["autoGrowth"]>;
type AllocationConfig = NonNullable<LevelSystemConfig["allocation"]>;
type RewardsConfig = NonNullable<LevelSystemConfig["rewards"]>;
type ResourceRecoveryConfig = NonNullable<
  LevelSystemConfig["resourceRecovery"]
>;
type NarrativeConfig = NonNullable<LevelSystemConfig["narrative"]>;

type ThresholdTable = NonNullable<ProgressConfig["thresholdTable"]>;

const NUMERIC_LITERAL_REGEX = /^-?\d+(?:\.\d+)?$/;

export type LevelSystemTemplateId =
  | "narrative-ai-rp"
  | "jrpg-growth"
  | "build-crpg"
  | "loot-grind"
  | "cultivation-breakthrough";

export interface LevelSystemTemplateDefinition {
  id: LevelSystemTemplateId;
  name: string;
  description: string;
  config: Partial<LevelSystemConfig>;
}

export interface ApplyLevelSystemTemplateContext {
  primaryAttributes: PrimaryAttributeConfig[];
  derivedStats: DerivedStatConfig[];
  currentLevelAttributeKey?: string;
}

const DEFAULT_THRESHOLD_TABLE: ThresholdTable = [
  { level: 2, requiredProgress: 100 },
  { level: 3, requiredProgress: 250 },
  { level: 4, requiredProgress: 450 },
  { level: 5, requiredProgress: 700 },
];

export const LEVEL_SYSTEM_TEMPLATES: LevelSystemTemplateDefinition[] = [
  {
    id: "narrative-ai-rp",
    name: "纯叙事 AI RP",
    description:
      "适合以剧情推进为主的世界：叙事/手动双触发、自动成长、增量恢复，并强化升级仪式感。",
    config: {
      enabled: true,
      triggerModes: ["narrative", "manual"],
      growthMode: "auto",
      progress: {
        progressAttributeKey: "level_progress",
        thresholdMode: "table",
        thresholdTable: DEFAULT_THRESHOLD_TABLE,
        carryOverflow: true,
        visibility: "summary",
      },
      autoGrowth: {
        perLevel: {},
        milestoneGrowth: [],
      },
      allocation: {
        pointAttributeKey: "unspent_attribute_points",
        allocatableAttributes: [],
        pointsPerLevel: 1,
        allowDeferredAllocation: true,
      },
      rewards: {
        autoApply: true,
        perLevel: [],
        milestones: [],
      },
      resourceRecovery: {
        mode: "delta",
        resourceKeys: [],
      },
      narrative: {
        allowAiTrigger: true,
        requirePlayerConfirmation: true,
        emitSystemLog: true,
        visibility: "ceremony",
      },
    },
  },
  {
    id: "jrpg-growth",
    name: "日式成长 RPG",
    description:
      "适合带成长条与里程碑奖励的经典 RPG：叙事/手动双触发、自动成长、进度详细可见。",
    config: {
      enabled: true,
      triggerModes: ["narrative", "manual"],
      growthMode: "auto",
      progress: {
        progressAttributeKey: "level_progress",
        thresholdMode: "table",
        thresholdTable: DEFAULT_THRESHOLD_TABLE,
        carryOverflow: true,
        visibility: "detailed",
      },
      autoGrowth: {
        perLevel: {},
        milestoneGrowth: [],
      },
      allocation: {
        pointAttributeKey: "unspent_attribute_points",
        allocatableAttributes: [],
        pointsPerLevel: 1,
        allowDeferredAllocation: true,
      },
      rewards: {
        autoApply: true,
        perLevel: [],
        milestones: [],
      },
      resourceRecovery: {
        mode: "delta",
        resourceKeys: [],
      },
      narrative: {
        allowAiTrigger: true,
        requirePlayerConfirmation: false,
        emitSystemLog: true,
        visibility: "summary",
      },
    },
  },
  {
    id: "build-crpg",
    name: "构筑型 CRPG",
    description:
      "适合强调 build 与点数决策的世界：自动成长 + 属性点混合制，资源刷新更克制。",
    config: {
      enabled: true,
      triggerModes: ["narrative", "manual"],
      growthMode: "hybrid",
      progress: {
        progressAttributeKey: "level_progress",
        thresholdMode: "table",
        thresholdTable: DEFAULT_THRESHOLD_TABLE,
        carryOverflow: true,
        visibility: "detailed",
      },
      autoGrowth: {
        perLevel: {},
        milestoneGrowth: [],
      },
      allocation: {
        pointAttributeKey: "unspent_attribute_points",
        allocatableAttributes: [],
        pointsPerLevel: 2,
        allowDeferredAllocation: true,
      },
      rewards: {
        autoApply: true,
        perLevel: [],
        milestones: [],
      },
      resourceRecovery: {
        mode: "none",
        resourceKeys: [],
      },
      narrative: {
        allowAiTrigger: true,
        requirePlayerConfirmation: true,
        emitSystemLog: true,
        visibility: "summary",
      },
    },
  },
  {
    id: "loot-grind",
    name: "爽游刷宝世界",
    description:
      "适合高频成长和战利品循环：手动触发、自动成长、升级时完全恢复资源。",
    config: {
      enabled: true,
      triggerModes: ["manual"],
      growthMode: "auto",
      progress: {
        progressAttributeKey: "level_progress",
        thresholdMode: "table",
        thresholdTable: DEFAULT_THRESHOLD_TABLE,
        carryOverflow: true,
        visibility: "summary",
      },
      autoGrowth: {
        perLevel: {},
        milestoneGrowth: [],
      },
      allocation: {
        pointAttributeKey: "unspent_attribute_points",
        allocatableAttributes: [],
        pointsPerLevel: 1,
        allowDeferredAllocation: true,
      },
      rewards: {
        autoApply: true,
        perLevel: [],
        milestones: [],
      },
      resourceRecovery: {
        mode: "full",
        resourceKeys: [],
      },
      narrative: {
        allowAiTrigger: false,
        requirePlayerConfirmation: false,
        emitSystemLog: true,
        visibility: "summary",
      },
    },
  },
  {
    id: "cultivation-breakthrough",
    name: "修仙突破世界",
    description:
      "适合境界突破与阶段性质变：叙事/手动双触发、混合成长、升级后完全恢复资源。",
    config: {
      enabled: true,
      triggerModes: ["narrative", "manual"],
      growthMode: "hybrid",
      progress: {
        progressAttributeKey: "level_progress",
        thresholdMode: "table",
        thresholdTable: DEFAULT_THRESHOLD_TABLE,
        carryOverflow: true,
        visibility: "summary",
      },
      autoGrowth: {
        perLevel: {},
        milestoneGrowth: [],
      },
      allocation: {
        pointAttributeKey: "unspent_attribute_points",
        allocatableAttributes: [],
        pointsPerLevel: 1,
        allowDeferredAllocation: true,
      },
      rewards: {
        autoApply: true,
        perLevel: [],
        milestones: [],
      },
      resourceRecovery: {
        mode: "full",
        resourceKeys: [],
      },
      narrative: {
        allowAiTrigger: true,
        requirePlayerConfirmation: true,
        emitSystemLog: true,
        visibility: "ceremony",
      },
    },
  },
];

export function buildAppliedLevelSystemTemplate(
  template: LevelSystemTemplateDefinition,
  context: ApplyLevelSystemTemplateContext,
): Partial<LevelSystemConfig> {
  const levelAttributeKey = resolveLevelAttributeKey(
    context.primaryAttributes,
    template.config.levelAttributeKey ?? context.currentLevelAttributeKey,
  );
  const growthMode = template.config.growthMode ?? "auto";
  const progress = buildProgressConfig(template.config.progress);
  const autoGrowth = buildAutoGrowthConfig(template.config.autoGrowth);
  const allocation = buildAllocationConfig(
    template.config.allocation,
    context.primaryAttributes,
    levelAttributeKey,
  );
  const rewards = buildRewardsConfig(template.config.rewards);
  const resourceRecovery = buildResourceRecoveryConfig(
    template.config.resourceRecovery,
    context.derivedStats,
  );
  const narrative = buildNarrativeConfig(template.config.narrative);

  return {
    enabled: template.config.enabled ?? true,
    levelAttributeKey,
    triggerModes: template.config.triggerModes ?? ["narrative", "manual"],
    growthMode,
    progress,
    autoGrowth,
    allocation,
    rewards,
    resourceRecovery,
    narrative,
  };
}

export function validateLevelSystemConfig(
  config: LevelSystemConfig,
  primaryAttributes: PrimaryAttributeConfig[],
  derivedStats: DerivedStatConfig[],
): string[] {
  const warnings: string[] = [];
  const primaryAttributeKeys = new Set(
    primaryAttributes.map((item) => item.key),
  );
  const derivedStatKeys = new Set(derivedStats.map((item) => item.key));
  const levelAttributeKey = config.levelAttributeKey ?? "level";
  const growthMode = config.growthMode ?? "auto";
  const allocation = config.allocation;
  const progress = config.progress;
  const resourceRecovery = config.resourceRecovery;
  const autoGrowth = config.autoGrowth;

  if (!primaryAttributeKeys.has(levelAttributeKey)) {
    warnings.push(
      `等级属性键「${levelAttributeKey}」未出现在主要属性列表中，升级时可能无法正确写入等级。`,
    );
  }

  if (growthMode === "allocation" || growthMode === "hybrid") {
    const allocatableAttributes = allocation?.allocatableAttributes ?? [];
    if (allocatableAttributes.length === 0) {
      warnings.push("当前成长模式需要至少配置一个可分配属性。");
    }

    if (!hasPositivePointsPerLevel(allocation?.pointsPerLevel)) {
      warnings.push("当前成长模式需要将每级发放点数设置为大于 0。");
    }
  }

  if (
    (progress?.thresholdMode ?? "table") === "table" &&
    (progress?.thresholdTable?.length ?? 0) === 0
  ) {
    warnings.push("阈值模式为“阈值表”时，至少需要配置一条等级阈值。");
  }

  for (const resourceKey of resourceRecovery?.resourceKeys ?? []) {
    if (!derivedStatKeys.has(resourceKey)) {
      warnings.push(`资源恢复字段「${resourceKey}」未出现在衍生属性列表中。`);
    }
  }

  for (const attributeKey of allocation?.allocatableAttributes ?? []) {
    if (!primaryAttributeKeys.has(attributeKey)) {
      warnings.push(`可分配属性「${attributeKey}」未出现在主要属性列表中。`);
    }
  }

  for (const attributeKey of Object.keys(autoGrowth?.perLevel ?? {})) {
    if (!primaryAttributeKeys.has(attributeKey)) {
      warnings.push(`自动成长属性「${attributeKey}」未出现在主要属性列表中。`);
    }
  }

  return warnings;
}

export function getGrowthModeLabel(
  mode: LevelSystemConfig["growthMode"] | undefined,
): string {
  switch (mode ?? "auto") {
    case "allocation":
      return "纯点数分配";
    case "hybrid":
      return "混合制";
    case "auto":
    default:
      return "自动成长";
  }
}

export function getGrowthModeSummary(
  mode: LevelSystemConfig["growthMode"] | undefined,
): string {
  switch (mode ?? "auto") {
    case "allocation":
      return "升级主要发放可分配属性点，由玩家手动决定成长方向。";
    case "hybrid":
      return "升级会先结算自动成长，再补充可分配属性点或里程碑选择。";
    case "auto":
    default:
      return "升级后按规则自动结算成长，不需要额外分配点数。";
  }
}

export function getTriggerModeSummary(
  triggerModes: LevelSystemConfig["triggerModes"] | undefined,
): string {
  const resolvedModes = triggerModes ?? [];

  if (resolvedModes.length === 0) {
    return "尚未启用触发方式。";
  }

  if (resolvedModes.includes("narrative") && resolvedModes.includes("manual")) {
    return "支持叙事裁定与手动升级双轨触发。";
  }

  if (resolvedModes.includes("narrative")) {
    return "仅允许叙事/剧情驱动触发升级。";
  }

  return "仅允许玩家或主持人手动触发升级。";
}

export function getResourceRecoveryLabel(
  mode: ResourceRecoveryConfig["mode"] | undefined,
): string {
  switch (mode ?? "delta") {
    case "none":
      return "不恢复";
    case "full":
      return "完全恢复";
    case "ratio":
      return "按比例映射";
    case "delta":
    default:
      return "按增量恢复";
  }
}

export function getResourceRecoverySummary(
  mode: ResourceRecoveryConfig["mode"] | undefined,
): string {
  switch (mode ?? "delta") {
    case "none":
      return "升级仅改变属性与奖励，不额外刷新当前资源值。";
    case "full":
      return "升级时将受影响资源直接恢复到满值，适合高频成长或突破体验。";
    case "ratio":
      return "升级后按原有资源百分比映射到新上限，兼顾连续性与公平性。";
    case "delta":
    default:
      return "升级按新增上限补足资源，既有反馈又能避免通用满血漏洞。";
  }
}

export function getNarrativeVisibilityLabel(
  visibility: NarrativeConfig["visibility"] | undefined,
): string {
  switch (visibility ?? "summary") {
    case "hidden":
      return "隐藏";
    case "ceremony":
      return "仪式感表现";
    case "summary":
    default:
      return "摘要";
  }
}

export function getProgressVisibilityLabel(
  visibility: ProgressConfig["visibility"] | undefined,
): string {
  switch (visibility ?? "summary") {
    case "hidden":
      return "隐藏";
    case "detailed":
      return "详细";
    case "summary":
    default:
      return "摘要";
  }
}

function buildProgressConfig(
  progress: LevelSystemConfig["progress"],
): ProgressConfig {
  return {
    progressAttributeKey: progress?.progressAttributeKey ?? "level_progress",
    thresholdMode: progress?.thresholdMode ?? "table",
    thresholdTable:
      progress?.thresholdMode === "formula"
        ? []
        : cloneThresholdTable(
            progress?.thresholdTable ?? DEFAULT_THRESHOLD_TABLE,
          ),
    thresholdFormula: progress?.thresholdFormula,
    carryOverflow: progress?.carryOverflow ?? true,
    visibility: progress?.visibility ?? "summary",
  };
}

function buildAutoGrowthConfig(
  autoGrowth: LevelSystemConfig["autoGrowth"],
): AutoGrowthConfig {
  return {
    perLevel: { ...(autoGrowth?.perLevel ?? {}) },
    milestoneGrowth: [...(autoGrowth?.milestoneGrowth ?? [])],
  };
}

function buildAllocationConfig(
  allocation: LevelSystemConfig["allocation"],
  primaryAttributes: PrimaryAttributeConfig[],
  levelAttributeKey: string,
): AllocationConfig {
  const pointAttributeKey =
    allocation?.pointAttributeKey ?? "unspent_attribute_points";

  return {
    pointAttributeKey,
    allocatableAttributes: allocation?.allocatableAttributes?.length
      ? [...allocation.allocatableAttributes]
      : buildDefaultAllocatableAttributes(
          primaryAttributes,
          levelAttributeKey,
          pointAttributeKey,
        ),
    pointsPerLevel: allocation?.pointsPerLevel ?? 1,
    minPerAttribute: allocation?.minPerAttribute,
    maxPerAttribute: allocation?.maxPerAttribute,
    allowDeferredAllocation: allocation?.allowDeferredAllocation ?? true,
  };
}

function buildRewardsConfig(
  rewards: LevelSystemConfig["rewards"],
): RewardsConfig {
  return {
    autoApply: rewards?.autoApply ?? true,
    perLevel: [...(rewards?.perLevel ?? [])],
    milestones: [...(rewards?.milestones ?? [])],
  };
}

function buildResourceRecoveryConfig(
  resourceRecovery: LevelSystemConfig["resourceRecovery"],
  derivedStats: DerivedStatConfig[],
): ResourceRecoveryConfig {
  return {
    mode: resourceRecovery?.mode ?? "delta",
    resourceKeys: resourceRecovery?.resourceKeys?.length
      ? [...resourceRecovery.resourceKeys]
      : buildDefaultResourceKeys(derivedStats),
  };
}

function buildNarrativeConfig(
  narrative: LevelSystemConfig["narrative"],
): NarrativeConfig {
  return {
    allowAiTrigger: narrative?.allowAiTrigger ?? true,
    requirePlayerConfirmation: narrative?.requirePlayerConfirmation ?? false,
    emitSystemLog: narrative?.emitSystemLog ?? true,
    visibility: narrative?.visibility ?? "summary",
  };
}

function resolveLevelAttributeKey(
  primaryAttributes: PrimaryAttributeConfig[],
  preferredKey: string | undefined,
): string {
  const keys = primaryAttributes.map((item) => item.key);

  if (preferredKey && keys.includes(preferredKey)) {
    return preferredKey;
  }

  if (keys.includes("level")) {
    return "level";
  }

  return keys[0] ?? "level";
}

function buildDefaultAllocatableAttributes(
  primaryAttributes: PrimaryAttributeConfig[],
  levelAttributeKey: string,
  pointAttributeKey: string,
): string[] {
  return primaryAttributes
    .map((item) => item.key)
    .filter((key) => key !== levelAttributeKey && key !== pointAttributeKey);
}

function buildDefaultResourceKeys(derivedStats: DerivedStatConfig[]): string[] {
  return derivedStats
    .filter((stat) => stat.isResource || stat.category === "resource")
    .map((stat) => stat.key);
}

function cloneThresholdTable(entries: ThresholdTable): ThresholdTable {
  return entries.map((entry) => ({
    level: entry.level,
    requiredProgress: entry.requiredProgress,
  }));
}

function hasPositivePointsPerLevel(
  value: AllocationConfig["pointsPerLevel"] | undefined,
): boolean {
  if (typeof value === "number") {
    return value > 0;
  }

  if (typeof value !== "string") {
    return false;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }

  if (!NUMERIC_LITERAL_REGEX.test(trimmed)) {
    return true;
  }

  return Number(trimmed) > 0;
}
