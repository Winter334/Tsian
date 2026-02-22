/**
 * IRNR 规则脚本（RuleScript）类型定义
 */

export interface RuleScript {
  version: 1;
  actions: RuleAction[];
}

export type RuleAction =
  | CheckAction
  | DamageAction
  | GainAction
  | LoseAction
  | RollAction
  | AddTagAction
  | RemoveTagAction
  | ModifyTagAction
  | SetValueAction
  | ConditionalAction
  | SequenceAction
  | ModifyDamageAction
  | NpcCreateAction
  | NpcStatusChangeAction
  | NpcActionAction
  | GrantItemAction
  | RemoveItemAction
  | GrantSkillAction
  | RemoveSkillAction;

export type ValueExpression = string | number | boolean;

interface RuleActionBase {
  type: string;
}

export interface CheckAction extends RuleActionBase {
  type: "check";
  checkType: "ability" | "skill" | "save" | "attack" | "contest";
  name: string;
  modifier: ValueExpression;
  dc: ValueExpression;
  target?: string;
  resultVar?: string;
}

export interface DamageAction extends RuleActionBase {
  type: "damage";
  target: string;
  amount: ValueExpression;
  /** 受影响的资源字段（默认值由 WorldConfig 的第一个资源字段决定，兜底 "hp"） */
  field?: string;
  /** 对应的上限字段（默认无上限检查） */
  maxField?: string;
  damageType?: string;
  reason?: string;
}

export interface GainAction extends RuleActionBase {
  type: "gain";
  target: string;
  amount: ValueExpression;
  /** 受影响的资源字段（默认值由 WorldConfig 的第一个资源字段决定，兜底 "hp"） */
  field?: string;
  /** 对应的上限字段（默认从 WorldConfig 资源配对中查找，兜底 "max_{field}"） */
  maxField?: string;
  reason?: string;
}

export interface LoseAction extends RuleActionBase {
  type: "lose";
  target: string;
  amount: ValueExpression;
  /** 受影响的资源字段（默认值由 WorldConfig 的第一个资源字段决定，兜底 "hp"） */
  field?: string;
  reason?: string;
}

export interface RollAction extends RuleActionBase {
  type: "roll";
  expression: string;
  purpose?: string;
  resultVar?: string;
}

export interface AddTagAction extends RuleActionBase {
  type: "addTag";
  target: string;
  tag: string;
  /** 效果的显示名称 */
  displayName?: string;
  /** 效果描述（AI 和系统共用） */
  effectDescription?: string;
  /** 结构化触发（可选，与 TriggerPipeline 联动） */
  trigger?: ConditionTrigger;
  /** 持续回合数 */
  duration?: number;
  reason?: string;
}

export interface RemoveTagAction extends RuleActionBase {
  type: "removeTag";
  target: string;
  tag: string;
  reason?: string;
}

export interface ModifyTagAction extends RuleActionBase {
  type: "modifyTag";
  target: string;
  tag: string;
  operation: "set" | "increment" | "decrement";
  value?: ValueExpression;
  reason?: string;
}

export interface SetValueAction extends RuleActionBase {
  type: "setValue";
  target: string;
  field: string;
  value: ValueExpression;
  reason?: string;
}

export interface ConditionalAction extends RuleActionBase {
  type: "conditional";
  condition: string;
  then: RuleAction[];
  else?: RuleAction[];
}

export interface SequenceAction extends RuleActionBase {
  type: "sequence";
  steps: RuleAction[];
}

// ─── NPC 操作 Action ────────────────────────────────────────

/** NPC 创建操作 - Parser AI 识别到新角色时输出 */
export interface NpcCreateAction extends RuleActionBase {
  type: "npcCreate";
  npc: {
    name: string;
    description?: string;
    personality?: string;
    appearance?: string;
    /** AI 建议的属性值 */
    attributes?: Record<string, number>;
    /** AI 建议的天赋 ID */
    talentIds?: string[];
  };
}

/** NPC 状态变更操作 */
export interface NpcStatusChangeAction extends RuleActionBase {
  type: "npcStatusChange";
  npcId: string;
  /** 目标状态 */
  status: "active" | "off_scene" | "archived";
}

/** NPC 行动操作 - NPC 主动执行动作 */
export interface NpcActionAction extends RuleActionBase {
  type: "npcAction";
  npcId: string;
  /** NPC 的行动意图描述 */
  intention: string;
  /** 需要检定时的参数 */
  requiresCheck?: {
    checkType: "attack" | "skill" | "ability";
    attribute: string;
    dc?: number;
    targetId?: string;
  };
  /** 不需要检定时的直接效果（RuleAction 子序列） */
  directEffects?: RuleAction[];
}

// ─── 装备/背包 Action ────────────────────────────────────────

/** 授予物品 - 向角色背包添加物品 */
export interface GrantItemAction extends RuleActionBase {
  type: "grantItem";
  /** 角色 ID */
  target: string;
  /** 模板 ID（可选，AI 可动态创造） */
  templateId?: string;
  name: string;
  description: string;
  /** 对应 ItemCategory，AI 输入为 string */
  category: string;
  /** 数量，默认 1 */
  quantity?: number;
  /**
   * 目标装备槽位 ID（可选）
   *
   * 运行时将根据 WorldConfig.inventoryRules.equipSlotDefinitions 校验合法性。
   */
  equipSlot?: string;
  reason?: string;
}

/** 移除物品 - 从角色背包移除物品 */
export interface RemoveItemAction extends RuleActionBase {
  type: "removeItem";
  /** 角色 ID */
  target: string;
  /** 物品实例 ID */
  instanceId: string;
  /** 移除数量，默认全部 */
  quantity?: number;
  reason?: string;
}

// ─── 技能操作 Action ────────────────────────────────────────

/** 授予技能 - 角色习得新技能 */
export interface GrantSkillAction extends RuleActionBase {
  type: "grantSkill";
  /** 角色 ID */
  target: string;
  /** 模板 ID（可选） */
  templateId?: string;
  name: string;
  description: string;
  /** 对应 SkillCategory，AI 输入为 string */
  category: string;
  /** 是否可主动使用，默认 false */
  activeUsable?: boolean;
  /** 使用消耗 */
  cost?: { field: string; amount: number };
  reason?: string;
}

/** 移除技能 - 角色遗忘/失去技能 */
export interface RemoveSkillAction extends RuleActionBase {
  type: "removeSkill";
  /** 角色 ID */
  target: string;
  /** 技能实例 ID */
  instanceId: string;
  reason?: string;
}

// ─── on_damage 触发器专用 Action ────────────────────────────

/**
 * 修改伤害 Action（只能在 on_damage 触发器中使用）
 *
 * 通过 multiplier/reduction 修改即将造成的伤害量，
 * 写入 ExecutionContext.damageContext.modifications。
 */
export interface ModifyDamageAction extends RuleActionBase {
  type: "modifyDamage";
  /** 伤害乘数（0.5 = 减半，0 = 免疫，2 = 双倍） */
  multiplier?: ValueExpression;
  /** 固定值减免（3 = 减少 3 点伤害） */
  reduction?: ValueExpression;
  reason?: string;
}

// ─── 条件触发定义 ────────────────────────────────────────────

/**
 * 触发时机
 * - turn_start: 回合开始时（单人：每条消息前；多人：回合开始时所有人统一触发）
 * - on_damage: 拥有者即将受到伤害时（伤害计算前触发，可修改伤害）
 * - passive: 被动标记，不自动触发（AI 参考描述，Phase 2 引擎自动叠加修正）
 */
export type ConditionTiming = "turn_start" | "on_damage" | "passive";

/**
 * 条件触发定义
 *
 * 定义何时、如何自动执行效果。
 * 上下文中 "self" 指拥有该标签的实体。
 */
export interface ConditionTrigger {
  /** 触发时机 */
  timing: ConditionTiming;

  /**
   * 自动执行的 actions
   * 格式与 RuleScript.actions 一致
   */
  actions: RuleAction[];

  /** 被动修正列表（timing=passive 时使用，引擎自动叠加） */
  modifiers?: PassiveModifier[];

  /**
   * on_damage 专用：伤害类型过滤
   * 只有匹配的伤害类型才触发此效果
   * 不设置则对所有伤害类型触发
   */
  damageFilter?: {
    damageTypes: string[];
  };

  /** 是否在每次触发后自动递减 duration */
  autoDecrement?: boolean;
}

// ─── 被动修正定义 ──────────────────────────────────────────

/**
 * 被动修正定义
 *
 * 描述天赋/被动效果对游戏机制的结构化修正。
 * 由引擎在执行 check/damage 时自动扫描并叠加。
 */
export interface PassiveModifier {
  /**
   * 修正作用域
   * - check: 检定修正（叠加到 check 的 modifier 上）
   * - damage_dealt: 造成伤害修正（叠加到 damage 的 amount 上）
   * - damage_taken: 承受伤害修正（类似 on_damage 的 modifyDamage）
   * - stat: 属性修正（直接修改实体属性的有效值）
   */
  scope: "check" | "damage_dealt" | "damage_taken" | "stat";

  /**
   * 过滤条件（可选）
   * - scope=check 时：限定检定类型，如 "attack"、"skill"
   * - scope=damage_dealt/damage_taken 时：限定伤害类型，如 "fire"、"slashing"
   * - scope=stat 时：不使用此字段
   */
  filter?: string;

  /**
   * 修正的目标字段（scope=stat 时必填）
   * 如 "phys_def"、"mag_def"
   */
  field?: string;

  /**
   * 加算修正值（与 check modifier、damage amount 相加）
   * 可以是数字或表达式（如 "level" 表示等级加成）
   */
  value?: ValueExpression;

  /**
   * 乘算修正（scope=damage_taken 时使用，如 0.5 = 减半）
   */
  multiplier?: number;

  /** 修正来源描述（用于 ResultFrame.modifiersApplied） */
  reason: string;
}
