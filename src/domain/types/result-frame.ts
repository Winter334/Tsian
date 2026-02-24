/**
 * IRNR 结算结果帧（Resolve 层）类型定义
 */

import type { ConditionTrigger } from "./rule-script";

export type EntityType = "character" | "item" | "environment" | "global";

export type ValuePrimitive = number | string | boolean;

export interface ValueChange {
  readonly entityId: string;
  readonly entityType: EntityType;
  readonly field: string;
  readonly oldValue: ValuePrimitive;
  readonly newValue: ValuePrimitive;
  readonly delta?: number;
  readonly reason?: string;
}

export interface DiceRoll {
  readonly expression: string;
  readonly rolls: readonly number[];
  readonly modifier: number;
  readonly total: number;
  readonly purpose?: string;
}

export interface CheckResult {
  /** 检定名称 */
  readonly name: string;
  /** 使用的技能/属性 */
  readonly skill: string;
  /** 掷骰结果（裸骰值） */
  readonly roll: number;
  /** 修正值 */
  readonly modifier: number;
  /** 最终结果 = roll + modifier */
  readonly total: number;

  /** DC 来源 */
  readonly dcSource: "formula" | "opposed" | "fixed" | "ai";

  /** 目标 DC（formula / fixed / ai） */
  readonly dc?: number;
  /** DC 公式（dcSource=formula 时，用于调试/展示） */
  readonly dcFormulaUsed?: string;

  /** 对方掷骰结果（opposed） */
  readonly opposedRoll?: number;
  /** 对方修正值（opposed） */
  readonly opposedModifier?: number;
  /** 对方最终结果（opposed） */
  readonly opposedTotal?: number;
  /** 对方使用的技能（opposed） */
  readonly opposedSkill?: string;

  /** 是否成功 */
  readonly success: boolean;
  /** 差值（正=成功余量，负=失败差距） */
  readonly margin: number;
}

// 兼容既有引用（后续可统一替换为 CheckResult）
export type Check = CheckResult;

export interface ModifierApplication {
  readonly source: string;
  readonly target: string;
  readonly value: number;
  readonly reason?: string;
}

export interface ResultFrame {
  readonly version: 1;
  readonly frameId: string;
  readonly commandId: string;
  readonly seed: number;
  readonly timestamp: number;
  readonly hash?: string;

  readonly success: boolean;
  readonly failureReason?: string;

  readonly valueChanges: readonly ValueChange[];
  readonly diceRolls: readonly DiceRoll[];
  readonly checks: readonly CheckResult[];
  readonly modifiersApplied?: readonly ModifierApplication[];
  readonly structuralChanges?: readonly StructuralChange[];
  readonly mechanicSummary: string;
}

// ─── 结构化变更记录 ───────────────────────────────────────

/**
 * 结构化变更记录
 *
 * 记录物品/技能等结构性实体的增减，与 ValueChange（数值变更）互补。
 */
export interface StructuralChange {
  readonly type:
    | "item_added"
    | "item_removed"
    | "item_equipped"
    | "item_unequipped"
    | "item_used"
    | "skill_learned"
    | "skill_removed";
  /** 物品/技能实例 ID */
  readonly entityId: string;
  /** 角色 ID */
  readonly targetId: string;
  /** 模板 ID（如有） */
  readonly templateId?: string;
  /** 附加信息 */
  readonly details?: Record<string, string | number | boolean>;
  /** 变更原因 */
  readonly reason?: string;
}

// ─── 标签元数据 ───────────────────────────────────────────

/**
 * 标签元数据
 *
 * 存储效果的完整信息，解决"效果信息断裂"问题。
 * 包含显示名称、效果描述、触发器定义、持续时间等。
 */
export interface TagMetadata {
  /** 标签 ID */
  id: string;
  /** 显示名称 */
  displayName: string;
  /** 效果描述 */
  effectDescription: string;
  /** 结构化触发器（可选） */
  trigger?: ConditionTrigger;
  /** 剩余持续回合数（undefined = 永久） */
  remainingDuration?: number;
  /** 叠加层数 */
  stacks?: number;
  /** 来源：predefined = 世界配置预定义，ai-generated = AI 动态创造 */
  source: "predefined" | "ai-generated";
  /** 添加时的回合号 */
  addedAtTurn?: number;
  /** 标签类别：talent=天赋, condition=状态效果（默认 condition）, equipment=装备效果 */
  category?: "talent" | "condition" | "equipment";
}

// ─── 伤害上下文 ───────────────────────────────────────────

/**
 * 伤害上下文 - on_damage 触发器的工作空间
 *
 * 在 executeDamage 中构建，传递给 on_damage 触发器，
 * 触发器通过 ModifyDamageAction 向 modifications 写入伤害修改。
 */
export interface DamageContext {
  /** 原始伤害量（不可修改） */
  readonly rawAmount: number;
  /** 伤害类型 */
  readonly damageType?: string;
  /** 来源实体 */
  readonly sourceId?: string;
  /** 目标实体 */
  readonly targetId: string;
  /** 受影响的字段 */
  readonly field: string;

  /** 伤害修改列表（触发器写入） */
  modifications: DamageModification[];
}

/**
 * 伤害修改记录
 */
export interface DamageModification {
  /** 来源标签 */
  source: string;
  /** 乘数修改（0.5 = 减半，0 = 免疫，2 = 双倍） */
  multiplier?: number;
  /** 固定值减免（3 = 减少 3 点伤害） */
  reduction?: number;
  /** 描述 */
  reason: string;
}
