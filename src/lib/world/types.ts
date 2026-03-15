/**
 * 世界配置（WorldConfig）类型定义
 */

import type { ItemCategory, ItemTemplate } from "@/domain/entities/item";
import type { SkillTemplate } from "@/domain/entities/skill";
import type {
  ConditionTrigger,
  PassiveModifier,
} from "@/domain/types/rule-script";

export interface PrimaryAttributeConfig {
  key: string;
  label: string;
  defaultValue: number;
  min?: number;
  max?: number;
  /** 描述文本（tooltip 用） */
  description?: string;
}

export interface DerivedStatConfig {
  key: string;
  label: string;
  /**
   * 计算公式
   * 可引用：基础属性 key、level、其他衍生属性 key
   * 支持：+, -, *, /, floor(), ceil(), min(), max()
   */
  formula: string;
  /** 依赖的属性（用于拓扑排序） */
  dependencies?: string[];
  min?: number;
  max?: number;
  /** 是否在 UI 中显示 */
  showInUI?: boolean;
  /** UI 分类 */
  category?: "resource" | "combat" | "defense" | "misc";
  /**
   * 资源型字段标记
   * true = 仅在创建时通过 formula 初始化，之后成为可变字段（如 hp, mp）
   * false/undefined = 纯衍生属性，base stats 变化时重算（如 str_mod, max_hp）
   */
  isResource?: boolean;
  /** 对于 isResource 字段，其对应的上限字段 key（如 hp 对应 max_hp） */
  maxField?: string;
}

interface DCPreset {
  label: string;
  formula: string;
  defaultSkill?: string;
}

interface OpposedPreset {
  label: string;
  attackerSkill: string;
  defenderSkill: string;
}

interface DCGuideline {
  /** 难度等级参考 */
  scale: Array<{ label: string; dc: number; description: string }>;
}

export interface CheckRuleConfig {
  /** 默认骰子表达式 */
  defaultDice?: string; // "1d20" | "2d6" | "1d100" 等
  criticalSuccessThreshold?: number;
  criticalFailureThreshold?: number;
  allowContest?: boolean;
  /** 预定义的 DC 公式 */
  dcPresets?: Record<string, DCPreset>;
  /** 预定义的对抗检定 */
  opposedPresets?: Record<string, OpposedPreset>;
  /** AI 情境 DC 参考 */
  dcGuideline?: DCGuideline;
}

export interface ConditionConfig {
  id: string;
  name: string;
  description?: string;
  tags?: string[];

  // === Step B: 触发器扩展 ===

  /** 自动触发定义（可选，有 trigger = 系统管理，无 trigger = AI 管理） */
  trigger?: ConditionTrigger;
  /** 持续回合数（到期自动移除，先触发再衰减） */
  duration?: number;
  /** 是否可叠加 */
  stackable?: boolean;
  /** 图标标识（UI 用） */
  icon?: string;
}

export interface TalentConfig {
  /** 天赋 ID（唯一标识，作为 tag ID 使用） */
  id: string;
  /** 显示名称 */
  name: string;
  /** 天赋描述（同时作为 effectDescription 传递给 AI） */
  description: string;
  /** 图标标识（UI 用） */
  icon?: string;
  /** 品质 ID，引用 talentRules.rarities */
  rarity?: string;
  /** 抽取元数据 */
  draw?: {
    /** 抽取权重，默认 1 */
    weight?: number;
    /** 归属的抽取池 ID 列表 */
    poolIds?: string[];
  };

  /**
   * 结构化被动修正（引擎自动执行）
   * 不设置则天赋仅作为语义标签供 AI 参考
   */
  modifiers?: PassiveModifier[];
}

// ═══════════════════════════════════════════════════
// 角色创建维度（Character Creation Dimensions）
// ═══════════════════════════════════════════════════

/**
 * 维度选项的附加效果
 * 统一了原来 Race 的 racialTalents/excludedTalents 和 Background 的 grantedTalents
 */
export interface DimensionOptionEffect {
  /** 属性修正，叠加在点数分配结果之上 */
  attributeModifiers?: Record<string, number>;
  /** 自动获得的天赋 ID 列表（不占选择名额） */
  grantedTalents?: string[];
  /** 排除的天赋 ID 列表（不可选择） */
  excludedTalents?: string[];
}

/**
 * 维度选项（一个具体的可选项）
 * 等价于当前的 RaceConfig / BackgroundConfig
 */
export interface DimensionOption {
  /** 选项 ID（维度内唯一） */
  id: string;
  /** 显示名称 */
  name: string;
  /** 描述文本 */
  description: string;
  /** 图标标识（可选，UI 用） */
  icon?: string;
  /** 机械效果（属性修正、天赋等） */
  effects?: DimensionOptionEffect;
  /**
   * 预填字段模板（可被用户覆盖）
   * key = 角色字段名（appearance / personality / description / 自定义字段）
   * value = 预填文本
   */
  defaults?: Record<string, string>;
}

/**
 * 角色创建维度
 * 定义了一个角色创建步骤的完整配置
 */
export interface CharacterDimension {
  /** 维度 ID（全局唯一，如 "race", "background", "alignment"） */
  id: string;
  /** 维度显示名称（如 "种族", "背景", "阵营"） */
  label: string;
  /** 维度描述/副标题（显示在选择步骤中） */
  description?: string;
  /** 是否必选（false = 可跳过，默认 false） */
  required?: boolean;
  /** 选项列表（空数组 = 该维度不会在向导中显示步骤） */
  options: DimensionOption[];
  /** 在向导中的排序权重（越小越靠前，默认由声明顺序决定） */
  order?: number;
}

/**
 * 点数分配规则
 */
export interface PointBuyRules {
  /** 可分配的属性 key 列表, 排除 level 等 */
  allocatableAttributes: string[];
  /** 额外可分配点数, 默认 10 */
  bonusPoints: number;
  /** 单属性最小值, 默认使用属性自身的 min */
  minPerAttribute?: number;
  /** 单属性最大值, 创建时限制, 默认 20 */
  maxPerAttribute?: number;
}

// ─── 背包规则配置 ──────────────────────────────────

export interface EquipSlotDefinition {
  /** 槽位 ID，如 "main_hand"、"dantian"、"chip_slot" */
  id: string;
  /** 显示名称，如 "主手"、"丹田"、"芯片槽" */
  label: string;
  /** 限制该槽位可装备的物品类别（不设置 = 不限制） */
  allowedCategories?: ItemCategory[];
  /** 该槽位可装备的物品数量（默认 1） */
  maxCount?: number;
}

export interface InventoryRulesConfig {
  /** 默认背包容量，默认 20 */
  defaultCapacity?: number;
  /**
   * 装备槽位定义列表
   *
   * 替代原有的 equipSlots: EquipSlot[] 字段。
   * 每个槽位有独立的 id、label、约束条件。
   * 不设置则表示该世界没有装备系统。
   */
  equipSlotDefinitions?: EquipSlotDefinition[];
}

export type WorldId = string;

export interface WorldMeta {
  name: string;
  description?: string;
  author?: string;
  version: string;
  createdAt: number;
  updatedAt: number;
  source: "lyra" | "custom";
}

export interface WorldNarrativeSeed {
  /**
   * 作者态剧本入口。
   * 创建存档 / 建房时会写入运行时 narrative 快照。
   */
  script?: string;
  /**
   * 作者态开幕语入口。
   * 创建存档 / 建房时会写入运行时 narrative 快照。
   */
  opening?: string;
}

/**
 * 运行时叙事启动快照。
 *
 * 与 WorldConfig 并列存储在 Save / Room 文档中，
 * 用于承载 script / opening 及 opening 的一次性注入状态。
 */
export interface WorldNarrativeRuntimeSnapshot {
  version: 1;
  script?: string;
  opening?: string;
  /**
   * opening 是否已经完成首次注入。
   * 用于保证会话初始化 / 房间开局只执行一次。
   */
  openingInjected?: boolean;
}

export const DEFAULT_WORLD_NARRATIVE_RUNTIME_SNAPSHOT: WorldNarrativeRuntimeSnapshot =
  {
    version: 1,
    openingInjected: false,
  };

export interface World {
  id: WorldId;
  meta: WorldMeta;
  /**
   * 作者态规则真源。
   * 运行时仍通过 worldConfig 快照写入 Save / Room 文档后读取。
   */
  rules: WorldConfig;
  /**
   * 作者态叙事启动真源。
   * 运行时通过独立 narrative 快照写入 Save / Room 文档后读取。
   */
  narrative?: WorldNarrativeSeed;
}

/** 奖励包定义 */
export interface RewardPackage {
  type:
    | "attribute_points"
    | "attribute_bonus"
    | "free_talent_draw"
    | "grant_talent"
    | "skill_pick"
    | "grant_skill"
    | "grant_item";
  /** 属性点数量（type=attribute_points 时） */
  points?: number;
  /** 属性加成（type=attribute_bonus 时） */
  attributes?: Record<string, number | string>;
  /** 天赋抽取次数（type=free_talent_draw 时） */
  drawCount?: number;
  /** 抽取池 ID（type=free_talent_draw 时） */
  poolId?: string;
  /** 每次抽取展示候选数（type=free_talent_draw 时） */
  offersPerDraw?: number;
  /** 保底品质（type=free_talent_draw 时） */
  guaranteedRarity?: string;
  /** 天赋 ID（type=grant_talent 时） */
  talentId?: string;
  /** 技能 ID（type=skill_pick/grant_skill 时） */
  skillId?: string;
  /** 物品 ID（type=grant_item 时） */
  itemId?: string;
  /** 物品数量（type=grant_item 时） */
  quantity?: number;
}

/** 成长模式 */
export type GrowthMode = "auto" | "allocation" | "hybrid";

/** 单个等级的进度定义 */
export interface LevelProgressDefinition {
  /** 等级值 */
  level: number;
  /** 等级名称 */
  name: string;
  /** 达到该等级所需进度 */
  requiredProgress: number;
}

/** 等级系统配置 */
export interface LevelSystemConfig {
  /** 等级属性键名，默认 "level" */
  levelAttributeKey?: string;
  /** 触发模式 */
  triggerModes?: Array<"narrative" | "manual">;

  /** 进度配置 */
  progress?: {
    /** 进度值存储属性键名，默认 "level_progress" */
    progressAttributeKey?: string;
    /** 按等级有序排列的进度真源配置 */
    levels?: LevelProgressDefinition[];
    /** 升级后是否保留溢出进度，默认 true */
    carryOverflow?: boolean;
  };

  /** 成长模式，默认 "auto" */
  growthMode?: GrowthMode;

  /** 自动成长配置 */
  autoGrowth?: {
    /** 每级固定成长 */
    perLevel?: Record<string, number | string>;
    /** 关键等级额外成长 */
    milestoneGrowth?: Array<{
      level: number;
      attributes: Record<string, number | string>;
    }>;
  };

  /** 属性点分配配置 */
  allocation?: {
    /** 未分配属性点的属性键名，默认 "unspent_attribute_points" */
    pointAttributeKey?: string;
    /** 可分配的属性键列表 */
    allocatableAttributes?: string[];
    /** 每级给予的属性点数 */
    pointsPerLevel?: number | string;
    /** 单次单属性最少分配 */
    minPerAttribute?: number;
    /** 单次单属性最多分配 */
    maxPerAttribute?: number;
    /** 是否允许延后分配，默认 true */
    allowDeferredAllocation?: boolean;
  };

  /** 升级奖励 */
  rewards?: {
    /** 每级通用奖励 */
    perLevel?: RewardPackage[];
    /** 里程碑奖励 */
    milestones?: Array<{
      level: number;
      rewards: RewardPackage[];
    }>;
  };
}

export interface WorldConfig {
  version: 1;
  worldId?: string;
  worldName?: string;
  primaryAttributes: PrimaryAttributeConfig[];
  derivedStats: DerivedStatConfig[];
  checkRules: CheckRuleConfig;
  conditions?: ConditionConfig[];

  /** 天赋配置列表 */
  talents?: TalentConfig[];

  /** 天赋选择规则 */
  talentRules?: {
    /** 角色创建时初始抽取次数（默认 2） */
    initialDrawCount?: number;
    /** 每次抽取提供的候选数量（默认 3） */
    initialOffersPerDraw?: number;
    /** 是否允许游戏中获得新天赋（默认 true） */
    allowAcquireDuringGame?: boolean;
    /** 每次手动选择天赋消耗的角色创建属性点数 */
    drawPointCost?: number;
    /** 重复抽取策略，默认 "exclude_owned" */
    duplicatePolicy?: "exclude_owned" | "allow_repeat";
    /** 品质定义 */
    rarities?: Array<{
      id: string;
      label: string;
      weight: number;
      colorToken?: string;
      glowToken?: string;
    }>;
    /** 抽取池定义 */
    pools?: Array<{
      id: string;
      label?: string;
      allowedRarities?: string[];
      includeTalentIds?: string[];
      excludeTalentIds?: string[];
    }>;
    /** 保底规则 */
    pity?: Array<{
      afterMisses: number;
      guaranteeRarity: string;
    }>;
  };

  /** 等级系统配置 */
  levelSystem?: LevelSystemConfig;

  /** 角色创建维度列表，替代原来的 races / backgrounds */
  dimensions?: CharacterDimension[];
  /** 点数分配规则 */
  pointBuyRules?: PointBuyRules;

  /** 物品模板列表 */
  itemTemplates?: ItemTemplate[];
  /** 技能模板列表 */
  skillTemplates?: SkillTemplate[];
  /** 背包规则配置 */
  inventoryRules?: InventoryRulesConfig;
}

const DEFAULT_CULTIVATION_REALMS = [
  "轮海",
  "道宫",
  "四极",
  "化龙",
  "仙台",
  "斩道",
  "圣人",
  "大圣",
  "准帝",
] as const;

const DEFAULT_CULTIVATION_STAGES = [
  "一重天",
  "二重天",
  "三重天",
  "四重天",
  "五重天",
  "六重天",
  "七重天",
  "八重天",
  "九重天",
] as const;

function buildDefaultCultivationProgressLevels(): LevelProgressDefinition[] {
  let requiredProgress = 0;

  return Array.from({ length: 81 }, (_, index) => {
    const level = index + 1;
    const realmIndex = Math.floor(index / 9);
    const stageIndex = index % 9;

    if (index > 0) {
      requiredProgress += 18 + realmIndex * 10 + stageIndex * 4;
    }

    return {
      level,
      name: `${DEFAULT_CULTIVATION_REALMS[realmIndex]}${DEFAULT_CULTIVATION_STAGES[stageIndex]}`,
      requiredProgress,
    };
  });
}

const DEFAULT_CULTIVATION_PROGRESS_LEVELS =
  buildDefaultCultivationProgressLevels();

const DEFAULT_CULTIVATION_MILESTONE_GROWTH: NonNullable<
  NonNullable<LevelSystemConfig["autoGrowth"]>["milestoneGrowth"]
> = [
  { level: 9, attributes: { spr: 1, int: 1 } },
  { level: 18, attributes: { int: 1, vit: 1 } },
  { level: 27, attributes: { str: 1, agi: 1 } },
  { level: 36, attributes: { str: 1, vit: 1 } },
  { level: 45, attributes: { spr: 1, luk: 1 } },
  { level: 54, attributes: { int: 1, agi: 1 } },
  { level: 63, attributes: { vit: 1, luk: 1 } },
  { level: 72, attributes: { str: 1, spr: 1 } },
  {
    level: 81,
    attributes: { str: 1, spr: 1, int: 1, agi: 1, luk: 1, vit: 1 },
  },
];

export const DEFAULT_WORLD_CONFIG: WorldConfig = {
  version: 1,
  worldId: "lyra-zhetian",
  worldName: "遮天",
  primaryAttributes: [
    {
      key: "str",
      label: "体魄",
      defaultValue: 8,
      min: 1,
      max: 100,
      description: "血气、肉身强度与正面搏杀时的根基。",
    },
    {
      key: "spr",
      label: "神识",
      defaultValue: 8,
      min: 1,
      max: 100,
      description: "灵觉、感知与驾驭法器、洞察异动的能力。",
    },
    {
      key: "int",
      label: "道感",
      defaultValue: 8,
      min: 1,
      max: 100,
      description: "参悟经文、亲和大道、凝练灵力的效率。",
    },
    {
      key: "agi",
      label: "身法",
      defaultValue: 8,
      min: 1,
      max: 100,
      description: "腾挪、御空基础与近身交锋时的机动。",
    },
    {
      key: "luk",
      label: "气运",
      defaultValue: 8,
      min: 1,
      max: 100,
      description: "机缘、因果与在乱世中逢凶化吉的可能。",
    },
    {
      key: "vit",
      label: "心性",
      defaultValue: 8,
      min: 1,
      max: 100,
      description: "意志、定力与面对诱惑、恐惧、执念时的稳定。",
    },
    {
      key: "level",
      label: "境界",
      defaultValue: 1,
      min: 1,
      max: 81,
      description: "当前修行层次，按九大境界、每境九小层的 1~81 体系推进。",
    },
  ],
  derivedStats: [
    {
      key: "str_mod",
      label: "体魄修正",
      formula: "floor((str - 10) / 4)",
      dependencies: ["str"],
    },
    {
      key: "spr_mod",
      label: "神识修正",
      formula: "floor((spr - 10) / 4)",
      dependencies: ["spr"],
    },
    {
      key: "int_mod",
      label: "道感修正",
      formula: "floor((int - 10) / 4)",
      dependencies: ["int"],
    },
    {
      key: "agi_mod",
      label: "身法修正",
      formula: "floor((agi - 10) / 4)",
      dependencies: ["agi"],
    },
    {
      key: "luk_mod",
      label: "气运修正",
      formula: "floor((luk - 10) / 4)",
      dependencies: ["luk"],
    },
    {
      key: "vit_mod",
      label: "心性修正",
      formula: "floor((vit - 10) / 4)",
      dependencies: ["vit"],
    },
    {
      key: "max_hp",
      label: "血气上限",
      formula: "30 + str * 2 + vit * 2 + level * 12",
      dependencies: ["str", "vit", "level"],
      min: 1,
      category: "resource",
      showInUI: true,
    },
    {
      key: "hp",
      label: "血气",
      formula: "max_hp",
      dependencies: ["max_hp"],
      isResource: true,
      maxField: "max_hp",
      min: 0,
      category: "resource",
      showInUI: true,
    },
    {
      key: "max_lingli",
      label: "灵力上限",
      formula: "20 + int * 2 + spr * 2 + level * 14",
      dependencies: ["int", "spr", "level"],
      min: 0,
      category: "resource",
      showInUI: true,
    },
    {
      key: "lingli",
      label: "灵力",
      formula: "max_lingli",
      dependencies: ["max_lingli"],
      isResource: true,
      maxField: "max_lingli",
      min: 0,
      category: "resource",
      showInUI: true,
    },
    {
      key: "guard",
      label: "护体",
      formula: "8 + str_mod + vit_mod + floor(level / 3)",
      dependencies: ["str_mod", "vit_mod", "level"],
      category: "defense",
      showInUI: true,
    },
    {
      key: "soul_resist",
      label: "神魂稳固",
      formula: "8 + spr_mod + vit_mod + floor(level / 3)",
      dependencies: ["spr_mod", "vit_mod", "level"],
      category: "defense",
      showInUI: true,
    },
    {
      key: "movement_roll",
      label: "遁速",
      formula: "8 + agi_mod + floor(level / 4) + floor(luk_mod / 2)",
      dependencies: ["agi_mod", "luk_mod", "level"],
      category: "combat",
      showInUI: true,
    },
    {
      key: "insight",
      label: "悟性",
      formula: "8 + spr_mod + int_mod + floor(level / 4)",
      dependencies: ["spr_mod", "int_mod", "level"],
      category: "misc",
      showInUI: true,
    },
  ],
  checkRules: {
    defaultDice: "1d20",
    criticalSuccessThreshold: 20,
    criticalFailureThreshold: 1,
    allowContest: true,
    dcGuideline: {
      scale: [
        {
          label: "易",
          dc: 10,
          description: "凡俗层面的顺手尝试，仍需基本根基。",
        },
        {
          label: "常",
          dc: 14,
          description: "初入修行者的日常考验，需要像样底子。",
        },
        {
          label: "难",
          dc: 18,
          description: "已非寻常修士可稳过，需要术法、胆识或积累。",
        },
        {
          label: "险",
          dc: 22,
          description: "稍有差池便会受创，往往伴随跨层搏命与强敌压制。",
        },
        {
          label: "绝",
          dc: 28,
          description: "多与禁地、天骄、圣兵或高层秘法相关。",
        },
        {
          label: "逆天",
          dc: 34,
          description: "常理之上，往往只有大机缘、大代价或越境爆发可触及。",
        },
        {
          label: "禁忌",
          dc: 40,
          description: "近乎打破位格差距的禁忌挑战，失败代价极高。",
        },
      ],
    },
  },
  conditions: [],
  talents: [
    {
      id: "mountain_survivor",
      name: "山野求生",
      description:
        "你习惯在荒岭古矿与断壁残崖之间寻找活路，面对恶劣环境时更沉得住气。",
      rarity: "common",
      modifiers: [
        {
          scope: "check",
          filter: "skill",
          value: 1,
          reason: "山野求生让你在野外应对时更老练",
        },
      ],
    },
    {
      id: "diligent_cultivator",
      name: "苦修不辍",
      description: "你能在枯燥吐纳与漫长闭关中保持节律，灵力积累更扎实。",
      rarity: "common",
      modifiers: [
        {
          scope: "stat",
          field: "max_lingli",
          value: 6,
          reason: "苦修不辍提升灵力上限",
        },
      ],
    },
    {
      id: "calm_heart",
      name: "静水心",
      description: "心湖平稳，不易被外魔幻象与一时情绪牵引。",
      rarity: "common",
      modifiers: [
        {
          scope: "check",
          filter: "save",
          value: 1,
          reason: "静水心让你更容易稳住心神",
        },
      ],
    },
    {
      id: "swift_steps",
      name: "驭风步",
      description: "你熟悉借势移步的法门，哪怕尚未真正御虹，也已有轻灵之姿。",
      rarity: "common",
      modifiers: [
        {
          scope: "stat",
          field: "agi",
          value: 1,
          reason: "驭风步提升身法根底",
        },
      ],
    },
    {
      id: "star_blessing",
      name: "星辉庇命",
      description: "每逢夜色垂落，你总能从群星与天象中感到一丝若有若无的眷顾。",
      rarity: "common",
    },
    {
      id: "ancient_script",
      name: "古字识文",
      description: "你读得懂部分残篇碑铭与上古符号，不容易在机缘前空手而归。",
      rarity: "common",
    },
    {
      id: "weapon_sense",
      name: "兵锋直觉",
      description:
        "无论是凡兵还是法器，只要落入掌中，你总能迅速找到最顺手的发力方式。",
      rarity: "common",
      modifiers: [
        {
          scope: "check",
          filter: "attack",
          value: 1,
          reason: "兵锋直觉提升攻击判定",
        },
      ],
    },
    {
      id: "herb_affinity",
      name: "草木通灵",
      description: "你熟悉灵药、异草与山川气机，对疗伤与采集一道格外敏锐。",
      rarity: "common",
    },
    {
      id: "unyielding_blood",
      name: "血性坚韧",
      description: "伤势越重，你越能咬住最后一口气，不会轻易被击垮。",
      rarity: "common",
      modifiers: [
        {
          scope: "damage_taken",
          multiplier: 0.95,
          reason: "血性坚韧降低所受伤害",
        },
      ],
    },
    {
      id: "night_traveler",
      name: "夜行无声",
      description: "习惯在夜色与废墟中穿行，步伐更轻，气息更稳。",
      rarity: "common",
    },
    {
      id: "gentle_words",
      name: "言辞温润",
      description: "你擅长在强者、商旅与同道之间缓和气氛，争取多一点余地。",
      rarity: "common",
      modifiers: [
        {
          scope: "check",
          filter: "skill",
          value: 1,
          reason: "言辞温润提升社交与交涉稳定性",
        },
      ],
    },
    {
      id: "ember_seed",
      name: "火种不熄",
      description: "你体内仿佛藏着一点不灭余烬，爆发时更容易激起炽烈之势。",
      rarity: "common",
      modifiers: [
        {
          scope: "damage_dealt",
          filter: "fire",
          value: 2,
          reason: "火种不熄强化火行伤害",
        },
      ],
    },
    {
      id: "spirit_glimpse",
      name: "灵目初开",
      description:
        "你偶尔能瞥见常人难察的气机流动，哪怕还无法完全解释那是什么。",
      rarity: "common",
    },
    {
      id: "battle_calm",
      name: "临阵稳心",
      description: "越是生死一线，你越能迅速压住杂念，不让心绪拖累决断。",
      rarity: "common",
      modifiers: [
        {
          scope: "check",
          filter: "save",
          value: 1,
          reason: "临阵稳心提升危急时刻的定力",
        },
      ],
    },
    {
      id: "jade_bones",
      name: "玉骨匀息",
      description: "你的筋骨协调、呼吸悠长，哪怕没有奇异体质，也比常人更能熬。",
      rarity: "common",
      modifiers: [
        {
          scope: "stat",
          field: "max_hp",
          value: 8,
          reason: "玉骨匀息提升血气上限",
        },
      ],
    },
    {
      id: "dustless_mind",
      name: "尘心不染",
      description: "你对名利得失看得比旁人稍淡，不容易在最初的修行路上迷失。",
      rarity: "common",
    },
    {
      id: "sea_of_bitter",
      name: "苦海初辟",
      description: "你的轮海像是更早一步被叩开，灵力流转时自有一股开阔感。",
      rarity: "uncommon",
      modifiers: [
        {
          scope: "stat",
          field: "max_lingli",
          value: 12,
          reason: "苦海初辟显著提升灵力储量",
        },
      ],
    },
    {
      id: "spring_of_life",
      name: "命泉涌动",
      description: "体内生机比同境修士更旺盛，恢复与耐战能力明显更高。",
      rarity: "uncommon",
      modifiers: [
        {
          scope: "stat",
          field: "max_hp",
          value: 12,
          reason: "命泉涌动强化血气底蕴",
        },
      ],
    },
    {
      id: "divine_sense",
      name: "神识外放",
      description: "你的神识能率先探出一步，在感知、锁定与寻踪上占据优势。",
      rarity: "uncommon",
      modifiers: [
        {
          scope: "check",
          filter: "skill",
          value: 2,
          reason: "神识外放提升感知与术法细节把握",
        },
      ],
    },
    {
      id: "purple_qi",
      name: "紫气东来",
      description: "你偶尔会在关键节点迎来转机，像是天光曾短暂为你停驻。",
      rarity: "uncommon",
    },
    {
      id: "iron_refinement",
      name: "炼骨如铁",
      description: "筋骨经过异常扎实的磨砺，承受冲击与重创时更不容易崩散。",
      rarity: "uncommon",
      modifiers: [
        {
          scope: "damage_taken",
          multiplier: 0.9,
          reason: "炼骨如铁让肉身更能扛伤",
        },
      ],
    },
    {
      id: "mystic_roots",
      name: "玄门慧根",
      description: "你对经文、术理与法门脉络有天然亲近感，悟道比常人更快半分。",
      rarity: "uncommon",
      modifiers: [
        {
          scope: "check",
          filter: "skill",
          value: 2,
          reason: "玄门慧根提升悟道与术法相关判定",
        },
      ],
    },
    {
      id: "fate_thread",
      name: "天机一线",
      description: "每当局势走向死胡同，你总能模糊捕捉到那一丝不该存在的生机。",
      rarity: "uncommon",
      modifiers: [
        {
          scope: "check",
          filter: "save",
          value: 2,
          reason: "天机一线让你在险境中更易觅得生门",
        },
      ],
    },
    {
      id: "artifact_bond",
      name: "道兵契主",
      description: "你与兵器、法器的契合度更高，催动时常能多出一分顺畅与锋芒。",
      rarity: "uncommon",
      modifiers: [
        {
          scope: "damage_dealt",
          filter: "weapon",
          value: 3,
          reason: "道兵契主强化兵器造成的伤害",
        },
      ],
    },
    {
      id: "war_insight",
      name: "百战悟法",
      description: "你很擅长在搏杀中临场修正出手方式，越打越能看清胜负手。",
      rarity: "uncommon",
      modifiers: [
        {
          scope: "check",
          filter: "attack",
          value: 2,
          reason: "百战悟法提升连续交锋中的攻击效率",
        },
      ],
    },
    {
      id: "source_pattern_sense",
      name: "源纹感知",
      description: "你对山川走势、奇石纹理与地脉伏线有超出常人的敏感。",
      rarity: "uncommon",
    },
    {
      id: "unbroken_breath",
      name: "真息绵长",
      description: "你体内真息循环更完整，久战之下灵力衰竭得没那么快。",
      rarity: "uncommon",
      modifiers: [
        {
          scope: "stat",
          field: "max_lingli",
          value: 10,
          reason: "真息绵长提升续战灵力",
        },
      ],
    },
    {
      id: "taiyin_soul",
      name: "太阴灵魄",
      description: "你的神魂气质更偏清冷幽深，出手时往往带着侵入骨髓的寒意。",
      rarity: "rare",
      modifiers: [
        {
          scope: "damage_dealt",
          value: 3,
          reason: "太阴灵魄提升术法伤害强度",
        },
      ],
    },
    {
      id: "solar_bone",
      name: "太阳真骨",
      description: "骨血中像埋着炽热炉火，一旦强攻，往往有焚灼四方的压迫感。",
      rarity: "rare",
      modifiers: [
        {
          scope: "damage_dealt",
          filter: "fire",
          value: 4,
          reason: "太阳真骨强化火行与爆发性伤害",
        },
      ],
    },
    {
      id: "void_steps",
      name: "虚空残痕",
      description: "你对空间挪移有近乎本能的把握，闪避与突进都更难被预判。",
      rarity: "rare",
      modifiers: [
        {
          scope: "stat",
          field: "agi",
          value: 2,
          reason: "虚空残痕提升身法与位移感知",
        },
      ],
    },
    {
      id: "source_master_eye",
      name: "源天灵觉",
      description: "你对源术与地脉的理解天然领先一步，更容易辨别真假机缘。",
      rarity: "rare",
      modifiers: [
        {
          scope: "check",
          filter: "skill",
          value: 3,
          reason: "源天灵觉显著提升洞察与源术判断",
        },
      ],
    },
    {
      id: "true_dragon_pulse",
      name: "真龙气脉",
      description: "你的血气运转如龙，攻守转换间自有一股冲霄之势。",
      rarity: "rare",
      modifiers: [
        {
          scope: "stat",
          field: "max_hp",
          value: 18,
          reason: "真龙气脉极大强化血气根基",
        },
        {
          scope: "damage_dealt",
          value: 2,
          reason: "真龙气脉提升爆发伤害",
        },
      ],
    },
    {
      id: "heavenly_pattern",
      name: "天图映命",
      description:
        "你对天势、命数与因果纹路的感应更直接，常能看见别人看不见的线索。",
      rarity: "rare",
      modifiers: [
        {
          scope: "check",
          filter: "skill",
          value: 3,
          reason: "天图映命强化推演与洞察",
        },
      ],
    },
    {
      id: "dao_heart_clarity",
      name: "道心通明",
      description:
        "你道心稳固且明澈，面对诱惑与分岔时更容易抓住真正适合自己的路。",
      rarity: "rare",
      modifiers: [
        {
          scope: "check",
          filter: "save",
          value: 2,
          reason: "道心通明降低心境失守的风险",
        },
        {
          scope: "stat",
          field: "max_lingli",
          value: 8,
          reason: "道心通明让灵力运转更加顺畅",
        },
      ],
    },
    {
      id: "ancient_sacred_body",
      name: "荒古圣体",
      description: "亿万人中难见的无双体魄，血气如海，肉身天然压胜同辈。",
      rarity: "legendary",
      modifiers: [
        {
          scope: "damage_taken",
          multiplier: 0.8,
          reason: "荒古圣体大幅降低所受伤害",
        },
        {
          scope: "stat",
          field: "max_hp",
          value: 30,
          reason: "荒古圣体拥有惊人的血气上限",
        },
      ],
    },
    {
      id: "innate_dao_embryo",
      name: "先天道胎",
      description: "天生近道，举手投足皆与法理相合，术法运转几近浑然天成。",
      rarity: "legendary",
      modifiers: [
        {
          scope: "stat",
          field: "max_lingli",
          value: 30,
          reason: "先天道胎极大提升灵力底蕴",
        },
        {
          scope: "check",
          filter: "skill",
          value: 3,
          reason: "先天道胎显著提升悟道与术法判定",
        },
      ],
    },
    {
      id: "celestial_eyes",
      name: "元灵仙瞳",
      description: "双瞳近乎通灵，既可辨幻识真，也能在交锋瞬间捕捉破绽。",
      rarity: "legendary",
      modifiers: [
        {
          scope: "check",
          filter: "attack",
          value: 2,
          reason: "元灵仙瞳更容易捕捉敌手破绽",
        },
        {
          scope: "check",
          filter: "skill",
          value: 2,
          reason: "元灵仙瞳提升观察与洞察效果",
        },
      ],
    },
    {
      id: "emperor_star",
      name: "帝星临身",
      description:
        "你像是被乱世推向了争渡之路，逢大势时总能爆发出不合常理的锋芒。",
      rarity: "legendary",
      modifiers: [
        {
          scope: "damage_dealt",
          value: 5,
          reason: "帝星临身强化关键时刻的压制力",
        },
        {
          scope: "check",
          filter: "save",
          value: 2,
          reason: "帝星临身让你在大势压迫下更能稳住自身",
        },
      ],
    },
  ],
  talentRules: {
    initialDrawCount: 3,
    initialOffersPerDraw: 4,
    allowAcquireDuringGame: true,
    drawPointCost: 0,
    duplicatePolicy: "exclude_owned",
    rarities: [
      {
        id: "common",
        label: "凡品",
        weight: 62,
        colorToken: "textMuted",
      },
      {
        id: "uncommon",
        label: "灵品",
        weight: 25,
        colorToken: "secondary",
        glowToken: "secondary",
      },
      {
        id: "rare",
        label: "天品",
        weight: 10,
        colorToken: "warning",
        glowToken: "warning",
      },
      {
        id: "legendary",
        label: "帝品",
        weight: 3,
        colorToken: "error",
        glowToken: "error",
      },
    ],
  },
  levelSystem: {
    levelAttributeKey: "level",
    triggerModes: ["narrative", "manual"],
    growthMode: "auto",
    progress: {
      progressAttributeKey: "level_progress",
      levels: DEFAULT_CULTIVATION_PROGRESS_LEVELS,
      carryOverflow: true,
    },
    autoGrowth: {
      milestoneGrowth: DEFAULT_CULTIVATION_MILESTONE_GROWTH,
    },
    rewards: {},
  },
  pointBuyRules: {
    allocatableAttributes: ["str", "spr", "int", "agi", "luk", "vit"],
    bonusPoints: 24,
    minPerAttribute: 1,
    maxPerAttribute: 30,
  },
  itemTemplates: [],
  skillTemplates: [],
  inventoryRules: {
    defaultCapacity: 24,
    equipSlotDefinitions: [
      { id: "natal_artifact", label: "本命器", allowedCategories: ["weapon"] },
      { id: "robe", label: "法衣", allowedCategories: ["armor"] },
      { id: "talisman", label: "护符", allowedCategories: ["accessory"] },
      {
        id: "relic",
        label: "异宝",
        allowedCategories: ["weapon", "accessory"],
      },
    ],
  },
  dimensions: [
    {
      id: "origin",
      label: "出身",
      description:
        "你的出身决定了最初接触修行世界的方式、看待资源的角度，以及故事开局时最自然的立足点。",
      required: true,
      order: 10,
      options: [
        {
          id: "ancient_clan_branch",
          name: "荒古世家旁支",
          description:
            "见过家族旧辉煌，也明白血脉与资源并不一定会落到自己头上。",
          effects: {
            attributeModifiers: { luk: 1, int: 1 },
            grantedTalents: ["ancient_script"],
          },
          defaults: {
            description:
              "出身于没落的荒古世家旁支，知晓许多旧闻，却始终站在真正核心权力之外。",
          },
        },
        {
          id: "holy_land_outer",
          name: "圣地外门",
          description: "曾在圣地外门抄经听法，眼界不低，却也深知强者秩序森严。",
          effects: {
            attributeModifiers: { spr: 1, int: 1 },
            grantedTalents: ["diligent_cultivator"],
          },
          defaults: {
            description:
              "你曾在圣地外门随众修行，见识过真正的天骄，也因此更清楚自身与高门之间的距离。",
          },
        },
        {
          id: "small_town_rogue",
          name: "小城散修",
          description: "没有大势力庇护，一切资源与功法都要靠自己摸索争取。",
          effects: {
            attributeModifiers: { agi: 1, vit: 1 },
            grantedTalents: ["mountain_survivor"],
          },
          defaults: {
            description:
              "你在边荒小城与古道集市间长大，见惯弱肉强食，因此比许多人更懂得如何活下去。",
          },
        },
        {
          id: "source_mine_remnant",
          name: "源矿遗民",
          description:
            "长期与古矿、奇石和地脉打交道，对危险与机缘都有异样直觉。",
          effects: {
            attributeModifiers: { spr: 1, luk: 1 },
            grantedTalents: ["source_pattern_sense"],
          },
          defaults: {
            description:
              "你曾随族人辗转源矿废墟，在险地与奇石之间求生，知道宝物与灾祸往往只隔一线。",
          },
        },
        {
          id: "imperial_scout_heir",
          name: "皇朝旧军遗孤",
          description:
            "在军伍旧部、边关斥候与皇朝法度的夹缝里长大，对秩序和杀机都不陌生。",
          effects: {
            attributeModifiers: { str: 1, vit: 1 },
            grantedTalents: ["battle_calm"],
          },
          defaults: {
            description:
              "你出身于一支逐渐式微的皇朝旧军后裔，耳濡目染的从不是空谈，而是如何在命令与生死之间活下来。",
          },
        },
        {
          id: "herb_garden_apprentice",
          name: "洞天药圃学徒",
          description:
            "长期侍弄灵药、识辨草木与地气，对疗伤、采集和耐心都有扎实底子。",
          effects: {
            attributeModifiers: { int: 1, spr: 1 },
            grantedTalents: ["herb_affinity"],
          },
          defaults: {
            description:
              "你曾在洞天药圃里做最不起眼的学徒，记得每一株灵草的气味，也记得弱者若不够细心就活不久。",
          },
        },
        {
          id: "frontier_hunter",
          name: "边荒猎户",
          description:
            "常年在边荒山岭与古道废村间追猎求生，对地势、夜路和潜伏格外熟悉。",
          effects: {
            attributeModifiers: { str: 1, agi: 1 },
            grantedTalents: ["night_traveler"],
          },
          defaults: {
            description:
              "你从小跟着猎队穿行在断岭、荒泽与废弃驿道之间，学会的第一门本事不是修法，而是别让自己先死在夜里。",
          },
        },
        {
          id: "market_caravan_heir",
          name: "坊市行脚商后裔",
          description:
            "跟着商旅车队和坊市摊行长大，见多了人心与利益，也习惯为自己争一条退路。",
          effects: {
            attributeModifiers: { agi: 1, luk: 1 },
            grantedTalents: ["gentle_words"],
          },
          defaults: {
            description:
              "你识得货路、暗价和人情冷暖，知道许多机缘最早并不在秘境里，而在一句真假难辨的市井消息中。",
          },
        },
        {
          id: "forbidden_land_survivor",
          name: "禁地幸存者",
          description:
            "曾从险地或禁区外围捡回一条命，此后比谁都清楚机缘背后总藏着代价。",
          effects: {
            attributeModifiers: { vit: 1, luk: 1 },
            grantedTalents: ["calm_heart"],
          },
          defaults: {
            description:
              "你曾在一场近乎必死的灾祸里侥幸活下，往后每逢机缘临门，最先升起的从来不是贪念，而是警惕。",
          },
        },
        {
          id: "ruined_martial_clan",
          name: "破败武馆传人",
          description:
            "祖上传下的不过是残缺拳谱与几件旧兵，但也让你比多数人更早学会发力与应对。",
          effects: {
            attributeModifiers: { str: 1, agi: 1 },
            grantedTalents: ["weapon_sense"],
          },
          defaults: {
            description:
              "你守着一间早已风光不再的武馆或小门庭长大，旧架子和旧兵痕里藏着你最早理解世界的方式。",
          },
        },
        {
          id: "scripture_keeper",
          name: "古教藏经守人",
          description:
            "常年替古教、古寺或残碑洞府抄录经卷，未必得传真法，却练出了读文辨义的耐心。",
          effects: {
            attributeModifiers: { int: 1, vit: 1 },
            grantedTalents: ["mystic_roots"],
          },
          defaults: {
            description:
              "你做过藏经楼与古碑库最不起眼的守人，真正的高深秘法轮不到你，但残章断句早已在心里扎了根。",
          },
        },
      ],
    },
  ],
};

/**
 * 聚合所有维度选择的效果
 * 用于属性分配步骤中显示修正值，以及天赋步骤中处理自动获得/排除
 */
export function aggregateDimensionEffects(
  worldConfig: WorldConfig,
  selections: Record<string, string>,
): {
  attributeModifiers: Record<string, number>;
  grantedTalents: string[];
  excludedTalents: string[];
} {
  const result = {
    attributeModifiers: {} as Record<string, number>,
    grantedTalents: [] as string[],
    excludedTalents: [] as string[],
  };

  for (const dim of worldConfig.dimensions ?? []) {
    const selectedId = selections[dim.id];
    if (!selectedId) continue;

    const option = dim.options.find((o) => o.id === selectedId);
    if (!option?.effects) continue;

    for (const [key, value] of Object.entries(
      option.effects.attributeModifiers ?? {},
    )) {
      result.attributeModifiers[key] =
        (result.attributeModifiers[key] ?? 0) + value;
    }

    result.grantedTalents.push(...(option.effects.grantedTalents ?? []));
    result.excludedTalents.push(...(option.effects.excludedTalents ?? []));
  }

  result.grantedTalents = [...new Set(result.grantedTalents)];
  result.excludedTalents = [...new Set(result.excludedTalents)];

  return result;
}

/**
 * 根据维度选择查找选项详情
 * 返回 { dimensionId, dimensionLabel, option } 的数组
 */
export function resolveDimensionSelections(
  worldConfig: WorldConfig,
  selections: Record<string, string>,
): Array<{
  dimensionId: string;
  dimensionLabel: string;
  option: DimensionOption;
}> {
  const result: Array<{
    dimensionId: string;
    dimensionLabel: string;
    option: DimensionOption;
  }> = [];

  for (const dim of worldConfig.dimensions ?? []) {
    const selectedId = selections[dim.id];
    if (!selectedId) continue;

    const option = dim.options.find((o) => o.id === selectedId);
    if (!option) continue;

    result.push({
      dimensionId: dim.id,
      dimensionLabel: dim.label,
      option,
    });
  }

  return result;
}
