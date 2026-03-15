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
  /** 天赋分类（用于 UI 分组和选择） */
  category?: "combat" | "magic" | "survival" | "social" | "misc";
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
    /** 最低等级门槛 */
    minLevel?: number;
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
      minLevel?: number;
    }>;
    /** 抽取池定义 */
    pools?: Array<{
      id: string;
      label?: string;
      allowedCategories?: string[];
      allowedRarities?: string[];
      includeTalentIds?: string[];
      excludeTalentIds?: string[];
      minLevel?: number;
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

export const DEFAULT_WORLD_CONFIG: WorldConfig = {
  version: 1,
  worldId: "lyra-isekai",
  worldName: "此间 异世界",
  primaryAttributes: [
    {
      key: "str",
      label: "力量",
      defaultValue: 10,
      min: 1,
      max: 30,
      description: "物理攻击力与负重能力",
    },
    {
      key: "vit",
      label: "耐久",
      defaultValue: 10,
      min: 1,
      max: 30,
      description: "生命力与物理防御力",
    },
    {
      key: "agi",
      label: "敏捷",
      defaultValue: 10,
      min: 1,
      max: 30,
      description: "速度、回避与先手行动",
    },
    {
      key: "int",
      label: "知力",
      defaultValue: 10,
      min: 1,
      max: 30,
      description: "魔法攻击力与知识水平",
    },
    {
      key: "spr",
      label: "精神",
      defaultValue: 10,
      min: 1,
      max: 30,
      description: "魔力储量与魔法防御力",
    },
    {
      key: "luk",
      label: "幸运",
      defaultValue: 10,
      min: 1,
      max: 30,
      description: "暴击率与意外事件",
    },
    { key: "level", label: "等级", defaultValue: 1, min: 1, max: 99 },
  ],
  derivedStats: [
    // 修正值 ×6（不显示在 UI）
    {
      key: "str_mod",
      label: "力量修正",
      formula: "floor((str - 10) / 2)",
      dependencies: ["str"],
    },
    {
      key: "vit_mod",
      label: "耐久修正",
      formula: "floor((vit - 10) / 2)",
      dependencies: ["vit"],
    },
    {
      key: "agi_mod",
      label: "敏捷修正",
      formula: "floor((agi - 10) / 2)",
      dependencies: ["agi"],
    },
    {
      key: "int_mod",
      label: "知力修正",
      formula: "floor((int - 10) / 2)",
      dependencies: ["int"],
    },
    {
      key: "spr_mod",
      label: "精神修正",
      formula: "floor((spr - 10) / 2)",
      dependencies: ["spr"],
    },
    {
      key: "luk_mod",
      label: "幸运修正",
      formula: "floor((luk - 10) / 2)",
      dependencies: ["luk"],
    },
    // 资源属性 ×4（显示在 UI，isResource 标记）
    {
      key: "max_hp",
      label: "最大HP",
      formula: "5 + (5 + vit_mod) * level",
      dependencies: ["vit_mod", "level"],
      category: "resource",
      showInUI: true,
    },
    {
      key: "hp",
      label: "HP",
      formula: "max_hp",
      dependencies: ["max_hp"],
      isResource: true,
      maxField: "max_hp",
      category: "resource",
      showInUI: true,
    },
    {
      key: "max_mp",
      label: "最大MP",
      formula: "max(0, (3 + spr_mod) * level)",
      dependencies: ["spr_mod", "level"],
      category: "resource",
      showInUI: true,
    },
    {
      key: "mp",
      label: "MP",
      formula: "max_mp",
      dependencies: ["max_mp"],
      isResource: true,
      maxField: "max_mp",
      category: "resource",
      showInUI: true,
    },
    // 防御属性 ×2（显示在 UI）
    {
      key: "phys_def",
      label: "物理防御",
      formula: "10 + vit_mod",
      dependencies: ["vit_mod"],
      category: "defense",
      showInUI: true,
    },
    {
      key: "mag_def",
      label: "魔法防御",
      formula: "10 + spr_mod",
      dependencies: ["spr_mod"],
      category: "defense",
      showInUI: true,
    },
  ],
  checkRules: {
    defaultDice: "2d6",
    criticalSuccessThreshold: 12,
    criticalFailureThreshold: 2,
    allowContest: true,
  },
  conditions: [],
  talents: [
    // ── 纯结构化修正 ──
    {
      id: "tough",
      name: "强韧",
      description: "天生体魄强健，能承受更多伤害",
      category: "survival",
      modifiers: [
        {
          scope: "damage_taken",
          multiplier: 0.9,
          reason: "强韧减伤 10%",
        },
      ],
    },
    {
      id: "sharp_eye",
      name: "锐眼",
      description: "观察力超群，攻击时更加精准",
      category: "combat",
      modifiers: [
        {
          scope: "check",
          filter: "attack",
          value: 1,
          reason: "锐眼命中 +1",
        },
      ],
    },
    {
      id: "iron_will",
      name: "铁壁意志",
      description: "精神坚定如铁，豁免检定更有优势",
      category: "survival",
      modifiers: [
        {
          scope: "check",
          filter: "save",
          value: 2,
          reason: "铁壁意志豁免 +2",
        },
      ],
    },
    // ── 混合型（结构化 + 语义） ──
    {
      id: "fire_affinity",
      name: "火之亲和",
      description:
        "与火元素有天生的亲和力，火焰魔法威力增强，且不会被自己的火焰伤害",
      category: "magic",
      modifiers: [
        {
          scope: "damage_dealt",
          filter: "fire",
          value: 3,
          reason: "火之亲和伤害 +3",
        },
        {
          scope: "damage_taken",
          filter: "fire",
          multiplier: 0.5,
          reason: "火之亲和抗性",
        },
      ],
    },
    {
      id: "silver_tongue",
      name: "巧言",
      description: "天生的话术天才，在社交场景中更容易说服他人",
      category: "social",
      modifiers: [
        {
          scope: "check",
          filter: "skill",
          value: 2,
          reason: "巧言话术 +2",
        },
      ],
    },
    // ── 纯语义标签 ──
    {
      id: "darkvision",
      name: "暗视",
      description: "能在完全黑暗的环境中视物，不受黑暗影响",
      category: "survival",
    },
    {
      id: "berserker",
      name: "狂战士",
      description: "HP 低于 30% 时进入狂暴状态，攻击力大增但无法使用魔法",
      category: "combat",
    },
  ],
  talentRules: {
    initialDrawCount: 2,
    initialOffersPerDraw: 3,
    allowAcquireDuringGame: true,
    duplicatePolicy: "exclude_owned",
  },
  levelSystem: {
    levelAttributeKey: "level",
    triggerModes: ["narrative", "manual"],
    growthMode: "auto",
  },
  pointBuyRules: {
    allocatableAttributes: ["str", "vit", "agi", "int", "spr", "luk"],
    bonusPoints: 10,
    maxPerAttribute: 20,
  },
  itemTemplates: [],
  skillTemplates: [],
  inventoryRules: {
    defaultCapacity: 20,
    equipSlotDefinitions: [
      { id: "main_hand", label: "主手", allowedCategories: ["weapon"] },
      {
        id: "off_hand",
        label: "副手",
        allowedCategories: ["weapon", "armor"],
      },
      { id: "head", label: "头部", allowedCategories: ["armor"] },
      { id: "body", label: "身体", allowedCategories: ["armor"] },
      { id: "legs", label: "腿部", allowedCategories: ["armor"] },
      { id: "feet", label: "脚部", allowedCategories: ["armor"] },
      {
        id: "accessory_1",
        label: "饰品1",
        allowedCategories: ["accessory"],
      },
      {
        id: "accessory_2",
        label: "饰品2",
        allowedCategories: ["accessory"],
      },
    ],
  },
  dimensions: [
    {
      id: "race",
      label: "种族",
      description: "选择你的种族，不同种族有不同的属性修正和天赋",
      required: false,
      order: 10,
      options: [
        {
          id: "human",
          name: "人类",
          description: "最为普遍的种族, 适应力强, 拥有均衡的潜力",
          effects: { attributeModifiers: {} },
        },
        {
          id: "elf",
          name: "精灵",
          description: "长寿的森林民族, 擅长魔法和弓术",
          effects: {
            attributeModifiers: { agi: 2, int: 1, vit: -1 },
            grantedTalents: ["darkvision"],
          },
          defaults: { appearance: "尖耳、纤细身材, 发色多为银白或金色" },
        },
        {
          id: "dwarf",
          name: "矮人",
          description: "山岳中的工匠民族, 体格强健, 善于锻造",
          effects: {
            attributeModifiers: { vit: 2, str: 1, agi: -1 },
          },
          defaults: { appearance: "身材矮壮、蓄着浓密胡须" },
        },
        {
          id: "beastfolk",
          name: "兽人族",
          description: "拥有兽类特征的种族, 感官敏锐, 身体能力出众",
          effects: {
            attributeModifiers: { str: 1, agi: 1, int: -1 },
          },
          defaults: { appearance: "兽耳、尾巴, 瞳孔呈兽类特征" },
        },
      ],
    },
    {
      id: "background",
      label: "背景",
      description: "选择你的背景故事，它会影响你的性格和额外能力",
      required: false,
      order: 20,
      options: [
        {
          id: "adventurer",
          name: "冒险者",
          description: "以接取公会委托为生的冒险者",
          defaults: {
            personality: "好奇心旺盛, 勇于面对未知挑战",
            description:
              "在冒险者公会注册的新人, 怀揣着对未知世界的憧憬踏上旅途",
          },
        },
        {
          id: "knight",
          name: "骑士",
          description: "效忠于某位领主的骑士",
          effects: {
            attributeModifiers: { str: 1 },
          },
          defaults: {
            personality: "正义感强, 重视荣誉和誓言",
            description: "曾效忠于某位领主的骑士, 因故离开故土, 以剑技谋生",
          },
        },
        {
          id: "scholar",
          name: "学者",
          description: "来自学院的魔法研究者",
          effects: {
            attributeModifiers: { int: 1 },
          },
          defaults: {
            personality: "求知欲强, 逻辑思维缜密, 有时会忽略周围人的感受",
            description: "在王立学院研修魔法的学者, 为了实地研究而踏上旅途",
          },
        },
        {
          id: "merchant",
          name: "商人",
          description: "行走各地的旅行商人",
          effects: {
            attributeModifiers: { luk: 1 },
            grantedTalents: ["silver_tongue"],
          },
          defaults: {
            personality: "善于交际, 精于算计, 但骨子里是个好人",
            description:
              "走南闯北的旅行商人, 靠着敏锐的嗅觉和话术在各城镇间贸易",
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
