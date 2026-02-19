/**
 * 触发器解析工具函数
 *
 * 为 TriggerPipeline 和 engine.ts 的 on_damage 集成提供共享的触发器解析逻辑。
 * 单独抽出以避免 engine.ts ↔ trigger-pipeline.ts 的循环依赖。
 *
 * 依赖关系：
 *   trigger-utils.ts ← engine.ts （on_damage 集成 + 被动修正收集）
 *   trigger-utils.ts ← trigger-pipeline.ts （turn_start 触发）
 *   engine.ts ← trigger-pipeline.ts （使用 BasicRulesEngine 执行触发器 actions）
 */

import type { TagMetadata } from "@/domain/types";
import type {
  ConditionTrigger,
  PassiveModifier,
} from "@/domain/types/rule-script";
import type { WorldConfig } from "@/lib/world";
import type { EntityAccessor } from "./engine";

// ─── 触发器安全限制 ───────────────────────────────────────

export const TRIGGER_LIMITS = {
  /** 单个触发器最大 action 数 */
  maxTriggerActions: 10,
  /** 单回合最大触发器执行数（联机多人时实体和标签都更多，需留足余量） */
  maxTriggersPerTurn: 200,
} as const;

// ─── 触发器解析 ───────────────────────────────────────────

/**
 * 解析标签的触发器定义
 *
 * 优先使用标签自身的 trigger（AI 内联定义），
 * 回退到 WorldConfig.conditions 中的预定义触发器。
 */
export function resolveTrigger(
  tagMeta: TagMetadata,
  worldConfig: WorldConfig
): ConditionTrigger | undefined {
  // 优先：运行时 trigger（AI 内联或之前设置的）
  if (tagMeta.trigger) return tagMeta.trigger;

  // 回退：WorldConfig 预定义 condition
  const condition = worldConfig.conditions?.find((c) => c.id === tagMeta.id);
  if (condition?.trigger) return condition.trigger;

  // 回退：WorldConfig 预定义 talent（将 modifiers 包装为 passive trigger）
  const talent = worldConfig.talents?.find((t) => t.id === tagMeta.id);
  if (talent?.modifiers && talent.modifiers.length > 0) {
    return {
      timing: "passive",
      actions: [],
      modifiers: talent.modifiers,
    };
  }

  return undefined;
}

// ─── 被动修正收集 ─────────────────────────────────────────

/**
 * 收集实体的所有被动修正
 *
 * 扫描实体的所有标签，提取 timing=passive 且有 modifiers 的触发器。
 * 同时检查 WorldConfig.talents 中的预定义天赋（通过 resolveTrigger 已涵盖 WorldConfig.conditions，
 * 但天赋存储在 WorldConfig.talents 中，需要额外处理）。
 *
 * 注意：天赋在写入实体时已经将 modifiers 包装到 trigger 中，
 * 所以这里只需扫描实体标签的 trigger.modifiers 即可。
 *
 * @param entityId - 实体 ID
 * @param entities - 实体访问器
 * @param worldConfig - 世界配置
 * @returns 被动修正列表
 */
export function collectPassiveModifiers(
  entityId: string,
  entities: EntityAccessor,
  worldConfig: WorldConfig
): PassiveModifier[] {
  const tagsMap = entities.getTagsWithMetadata?.(entityId);
  if (!tagsMap || tagsMap.size === 0) return [];

  const modifiers: PassiveModifier[] = [];

  for (const [, tagMeta] of tagsMap) {
    const trigger = resolveTrigger(tagMeta, worldConfig);
    if (!trigger || trigger.timing !== "passive") continue;
    if (!trigger.modifiers || trigger.modifiers.length === 0) continue;

    modifiers.push(...trigger.modifiers);
  }

  return modifiers;
}

// ─── on_damage 触发器查找 ─────────────────────────────────

/**
 * 扫描目标实体的 on_damage 触发器
 *
 * 在 executeDamage 内部调用，返回匹配的触发器列表。
 * on_damage 触发器的执行在 engine.ts 内部完成，
 * 因为需要共享 InternalExecutionState 来修改伤害上下文。
 *
 * @param targetId - 伤害目标实体 ID
 * @param damageType - 伤害类型（用于 damageFilter 过滤）
 * @param entities - 实体访问器
 * @param worldConfig - 世界配置
 * @returns 匹配的触发器及其来源标签
 */
export function findOnDamageTriggers(
  targetId: string,
  damageType: string | undefined,
  entities: EntityAccessor,
  worldConfig: WorldConfig
): Array<{
  tagId: string;
  tagMeta: TagMetadata;
  trigger: NonNullable<TagMetadata["trigger"]>;
}> {
  const tagsMap = entities.getTagsWithMetadata?.(targetId);
  if (!tagsMap || tagsMap.size === 0) return [];

  const matched: Array<{
    tagId: string;
    tagMeta: TagMetadata;
    trigger: NonNullable<TagMetadata["trigger"]>;
  }> = [];

  for (const [tagId, tagMeta] of tagsMap) {
    const trigger = resolveTrigger(tagMeta, worldConfig);
    if (!trigger || trigger.timing !== "on_damage") continue;

    // damageFilter 过滤
    if (trigger.damageFilter && damageType) {
      if (!trigger.damageFilter.damageTypes.includes(damageType)) continue;
    } else if (trigger.damageFilter && !damageType) {
      // 有 filter 但伤害无类型，不匹配
      continue;
    }

    // 安全限制
    if (trigger.actions.length > TRIGGER_LIMITS.maxTriggerActions) {
      console.warn(
        `[TriggerPipeline] on_damage 触发器 "${tagMeta.displayName}" (${tagId}) 包含 ${trigger.actions.length} 个 action（上限 ${TRIGGER_LIMITS.maxTriggerActions}），已跳过`
      );
      continue;
    }

    matched.push({ tagId, tagMeta, trigger });
  }

  return matched;
}
