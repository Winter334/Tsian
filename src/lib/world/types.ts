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

  /**
   * 结构化被动修正（引擎自动执行）
   * 不设置则天赋仅作为语义标签供 AI 参考
   */
  modifiers?: PassiveModifier[];

  /**
   * 前置条件（可选，用于 UI 过滤）
   */
  prerequisites?: {
    attributes?: Record<string, number>;
  };

  /**
   * 与其他天赋互斥的 ID 列表
   */
  exclusiveWith?: string[];
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
    /** 角色创建时可选天赋数量（默认 2） */
    initialCount?: number;
    /** 是否允许游戏中获得新天赋（默认 true） */
    allowAcquireDuringGame?: boolean;
  };

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
  conditions: [
    // === 系统管理（turn_start）×5 ===
    {
      id: "poison",
      name: "毒",
      description: "毒素侵蚀，每回合受到毒素伤害",
      duration: 5,
      trigger: {
        timing: "turn_start",
        actions: [
          {
            type: "damage",
            target: "self",
            amount: "1d4",
            reason: "毒素伤害",
          },
        ],
        autoDecrement: true,
      },
    },
    {
      id: "burning",
      name: "炎上",
      description: "身体燃烧，每回合受到火焰伤害",
      duration: 3,
      trigger: {
        timing: "turn_start",
        actions: [
          {
            type: "damage",
            target: "self",
            amount: 3,
            damageType: "fire",
            reason: "炎上伤害",
          },
        ],
        autoDecrement: true,
      },
    },
    {
      id: "bleeding",
      name: "出血",
      description: "伤口流血，每回合流失生命",
      duration: 3,
      trigger: {
        timing: "turn_start",
        actions: [
          {
            type: "damage",
            target: "self",
            amount: 2,
            reason: "出血伤害",
          },
        ],
        autoDecrement: true,
      },
    },
    {
      id: "regen",
      name: "再生",
      description: "生命力持续恢复",
      duration: 5,
      trigger: {
        timing: "turn_start",
        actions: [
          {
            type: "heal",
            target: "self",
            amount: "1d4",
            field: "hp",
            reason: "再生恢复",
          },
        ],
        autoDecrement: true,
      },
    },
    {
      id: "mp_regen",
      name: "魔力回复",
      description: "魔力持续恢复",
      duration: 3,
      trigger: {
        timing: "turn_start",
        actions: [
          {
            type: "heal",
            target: "self",
            amount: "1d4",
            field: "mp",
            maxField: "max_mp",
            reason: "魔力回复",
          },
        ],
        autoDecrement: true,
      },
    },
    // === AI 管理（被动）×5 ===
    {
      id: "paralysis",
      name: "麻痺",
      description: "身体僵硬无法行动，判定受 -4 减值",
    },
    {
      id: "blind",
      name: "暗闇",
      description: "无法视物，攻击和感知判定受 -3 减值",
    },
    {
      id: "silence",
      name: "沈黙",
      description: "无法发声，不能施放需要咏唱的魔法",
    },
    {
      id: "sleep",
      name: "睡眠",
      description: "陷入沉睡无法行动，受到伤害时立即解除",
    },
    {
      id: "confusion",
      name: "混乱",
      description: "分不清敌我，行动目标随机化",
    },
    // === on_damage 触发 ×2 ===
    {
      id: "barrier",
      name: "障壁",
      description: "魔法护盾吸收部分伤害",
      duration: 3,
      trigger: {
        timing: "on_damage",
        actions: [{ type: "modifyDamage", reduction: 3, reason: "障壁减伤" }],
        autoDecrement: true,
      },
    },
    {
      id: "fire_resist",
      name: "火耐性",
      description: "对火属性攻击产生抗性",
      trigger: {
        timing: "on_damage",
        damageFilter: { damageTypes: ["fire"] },
        actions: [{ type: "modifyDamage", multiplier: 0.5, reason: "火耐性" }],
      },
    },
  ],
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
    initialCount: 2,
    allowAcquireDuringGame: true,
  },
  pointBuyRules: {
    allocatableAttributes: ["str", "vit", "agi", "int", "spr", "luk"],
    bonusPoints: 10,
    maxPerAttribute: 20,
  },
  itemTemplates: [
    {
      id: "default_healing_potion",
      name: "治疗药水",
      description: "散发着淡淡草药香气的红色药水，饮用后可恢复少量生命值",
      category: "consumable",
      stackable: true,
      maxStack: 10,
      consumable: true,
      effects: [
        {
          type: "modifier",
          description: "恢复少量 HP",
          onUse: [{ type: "heal", target: "self", amount: 10, field: "hp" }],
        },
      ],
    },
    {
      id: "default_iron_sword",
      name: "铁剑",
      description: "工匠打造的标准铁制长剑，坚固耐用，适合近战作战",
      category: "weapon",
      equipSlot: "main_hand",
      effects: [
        {
          type: "modifier",
          description: "攻击力 +2",
          modifiers: [
            { scope: "stat", field: "str", value: 2, reason: "铁剑" },
          ],
        },
      ],
    },
  ],
  skillTemplates: [
    {
      id: "default_fireball",
      name: "火球术",
      description: "凝聚魔力释放出灼热的火球，对目标造成火属性伤害",
      category: "magic",
      maxLevel: 5,
      activeUsable: true,
      cost: { field: "mp", amount: 5 },
      effects: [
        {
          level: 1,
          description: "释放小型火球，造成基础火焰伤害",
        },
        {
          level: 3,
          description: "火球范围扩大，可波及附近敌人",
        },
        {
          level: 5,
          description: "释放巨型火球，造成大范围毁灭性伤害",
        },
      ],
    },
    {
      id: "default_toughness",
      name: "坚韧体魄",
      description: "通过长期锻炼获得的被动能力，永久提升身体的抗打击能力",
      category: "combat",
      maxLevel: 3,
      activeUsable: false,
      effects: [
        {
          level: 1,
          description: "受到的物理伤害略微降低",
          modifiers: [
            {
              scope: "damage_taken",
              multiplier: 0.95,
              reason: "坚韧体魄 Lv1 减伤 5%",
            },
          ],
        },
        {
          level: 3,
          description: "受到的物理伤害显著降低",
          modifiers: [
            {
              scope: "damage_taken",
              multiplier: 0.85,
              reason: "坚韧体魄 Lv3 减伤 15%",
            },
          ],
        },
      ],
    },
  ],
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
