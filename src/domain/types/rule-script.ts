/**
 * IRNR 规则脚本（RuleScript）类型定义
 */

import type { ItemEffect } from "../entities/item";

export interface RuleScript {
  version: 2;
  actions: RuleAction[];
}

export type ValueExpression = string | number | boolean;
export type ConditionExpression = string;

interface RuleActionBase {
  type: string;
}

export type RuleAction =
  | CheckAction
  | RollAction
  | DamageAction
  | HealAction
  | CostAction
  | SetAction
  | AddTagAction
  | RemoveTagAction
  | ModifyTagAction
  | GrantItemAction
  | RemoveItemAction
  | GrantSkillAction
  | RemoveSkillAction
  | SpawnAction
  | DespawnAction
  | BranchAction
  | EquipItemAction
  | UnequipItemAction
  | UseItemAction; // 领域扩展

// 引擎内部（不在 RuleAction 联合类型中暴露给 AI）
export type InternalAction = ModifyDamageAction;

// 触发器内部可用的 action 类型（RuleAction + InternalAction）
export type TriggerAction = RuleAction | InternalAction;

export interface CheckAction extends RuleActionBase {
  type: "check";
  name: string;
  skill: string;
  target?: string;
  modifier?: ValueExpression;

  /** DC 来源类型（默认由执行器按 ai 兜底处理） */
  dcSource?: "formula" | "opposed" | "fixed" | "ai";

  /** dcSource=formula 时使用：DC 计算目标实体 ID */
  dcTarget?: string;
  /** dcSource=formula 时使用：DC 公式 */
  dcFormula?: string;

  /** dcSource=opposed 时使用：对抗目标实体 ID */
  opposedEntity?: string;
  /** dcSource=opposed 时使用：对抗目标技能/属性 ID */
  opposedSkill?: string;

  /** dcSource=fixed 时使用：固定 DC */
  fixedDC?: number;

  /** dcSource=ai 时使用：AI 判定 DC */
  dc?: ValueExpression;

  /** 检定成功时执行的 action 序列 */
  onSuccess: RuleAction[];
  /** 检定失败时执行的 action 序列 */
  onFailure?: RuleAction[];

  /** WorldConfig.checkRules 的预设简写 */
  preset?: string;
  /** 罕见使用：存储检定结果变量 */
  resultVar?: string;
  reason?: string;
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

export interface HealAction extends RuleActionBase {
  type: "heal";
  target: string;
  amount: ValueExpression;
  /** 受影响的资源字段（默认值由 WorldConfig 的第一个资源字段决定，兜底 "hp"） */
  field?: string;
  /** 对应的上限字段（默认从 WorldConfig 资源配对中查找，兜底 "max_{field}"） */
  maxField?: string;
  reason?: string;
}

export interface CostAction extends RuleActionBase {
  type: "cost";
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

export interface SetAction extends RuleActionBase {
  type: "set";
  target: string;
  field: string;
  value: ValueExpression;
  reason?: string;
}

export interface BranchAction extends RuleActionBase {
  type: "branch";
  condition: ConditionExpression;
  then: RuleAction[];
  else?: RuleAction[];
}

// ─── NPC / 实体生命周期 Action ─────────────────────────────

/** 创建实体操作（当前主要用于生成 NPC） */
export interface SpawnAction extends RuleActionBase {
  type: "spawn";
  entity: {
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

/** 移除实体操作（当前主要用于 NPC 离场/移除） */
export interface DespawnAction extends RuleActionBase {
  type: "despawn";
  entityId: string;
  mode: "temporary" | "permanent";
  reason?: string;
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
  category:
    | "weapon"
    | "armor"
    | "accessory"
    | "consumable"
    | "material"
    | "quest"
    | "misc";
  /** 物品效果定义（可选） */
  effects?: ItemEffect[];
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

/** 装备物品（领域扩展指令） */
export interface EquipItemAction extends RuleActionBase {
  type: "equipItem";
  /** 角色 ID */
  target: string;
  /** 物品实例 ID */
  instanceId: string;
  /** 目标槽位 */
  slot?: string;
  reason?: string;
}

/** 卸下装备（领域扩展指令） */
export interface UnequipItemAction extends RuleActionBase {
  type: "unequipItem";
  /** 角色 ID */
  target: string;
  /** 物品实例 ID */
  instanceId: string;
  reason?: string;
}

/** 使用物品（领域扩展指令） */
export interface UseItemAction extends RuleActionBase {
  type: "useItem";
  /** 使用者 ID */
  target: string;
  /** 物品实例 ID */
  instanceId: string;
  /** 使用数量 */
  quantity?: number;
  /** 使用目标 */
  useTarget?: string;
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
  category: "combat" | "magic" | "survival" | "social" | "craft" | "misc";
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
  timing: "turn_start" | "on_damage" | "passive";

  /**
   * 自动执行的 actions（触发器内部可包含 InternalAction，如 modifyDamage）
   * 格式与 RuleScript.actions 基本一致
   */
  actions?: TriggerAction[];

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
  /** 修正作用域 */
  scope: "check" | "damage_dealt" | "damage_taken" | "stat";

  /** 过滤条件（可选） */
  filter?: string;

  /** 修正的目标字段（scope=stat 时通常需要） */
  field?: string;

  /** 加算修正值 */
  value?: ValueExpression;

  /** 乘算修正（scope=damage_taken 时使用，如 0.5 = 减半） */
  multiplier?: number;

  /** 修正来源描述（用于 ResultFrame.modifiersApplied） */
  reason: string;
}
