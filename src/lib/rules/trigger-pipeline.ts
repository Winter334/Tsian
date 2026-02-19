/**
 * TriggerPipeline - 条件标签自动触发管理器
 *
 * 职责：
 * 1. turn_start：回合开始时扫描所有实体的标签，执行 turn_start 触发器
 * 2. Duration 衰减：触发后自动递减 remainingDuration，到期移除标签
 * 3. 生成 pre-ResultFrame，供 IRNR Pipeline 合并到主流程
 *
 * 设计决策：
 * - 先触发再衰减（"持续 N 回合"正好触发 N 次）
 * - Phase 1 不支持级联触发
 * - 多人模式回合开始时统一触发所有实体
 * - 按标签添加顺序执行
 *
 * on_damage 触发在 engine.ts 的 executeDamage 内部处理，
 * 因为它需要共享 InternalExecutionState 来修改伤害。
 * 查找 on_damage 触发器使用 trigger-utils.ts 的 findOnDamageTriggers。
 */

import type {
  Check,
  DiceRoll,
  ResultFrame,
  RuleScript,
  ValueChange,
} from "@/domain/types";
import type { WorldConfig } from "@/lib/world";
import type { EntityAccessor, ExecutionContext, TagChange } from "./engine";
import { BasicRulesEngine } from "./engine";
import { buildResultFrame } from "./result-builder";
import { generateMechanicSummary } from "./summary";
import { resolveTrigger, TRIGGER_LIMITS } from "./trigger-utils";

// ─── TriggerPipeline 结果类型 ─────────────────────────────

export interface TriggerPipelineResult {
  /** 触发器是否成功执行（部分失败不影响整体） */
  success: boolean;
  /** 触发器产生的 ResultFrame（可能为空） */
  resultFrame?: ResultFrame;
  /** 机制摘要 */
  mechanicSummary: string;
  /** 需要从实体移除的标签（到期） */
  expiredTags: Array<{ entityId: string; tagId: string; tagName: string }>;
  /** 需要更新的标签 duration */
  durationUpdates: Array<{
    entityId: string;
    tagId: string;
    newDuration: number;
  }>;
  /** 触发器执行过程中产生的标签变更（供上层写回） */
  tagChanges: TagChange[];
  /** 执行过程中的警告/错误信息 */
  warnings: string[];
}

// ─── TriggerPipeline 实现 ─────────────────────────────────

/**
 * 执行 turn_start 触发 + duration 衰减
 *
 * 流程：
 * 1. 遍历所有实体的标签
 * 2. 对 timing=turn_start 的触发器执行其 actions
 * 3. 对所有有 remainingDuration 的标签进行衰减
 * 4. remainingDuration=0 的标签标记为到期
 *
 * @param worldConfig - 世界配置（用于解析预定义触发器）
 * @param entities - 实体访问器
 * @param baseContext - 基础执行上下文（seed、commandId 等）
 * @returns 触发结果（含需要写回的变更）
 */
export function executeTurnStartTriggers(
  worldConfig: WorldConfig,
  entities: EntityAccessor,
  baseContext: Omit<ExecutionContext, "actorId" | "targetId">
): TriggerPipelineResult {
  const engine = new BasicRulesEngine();
  const allDiceRolls: DiceRoll[] = [];
  const allChecks: Check[] = [];
  const allValueChanges: ValueChange[] = [];
  const allTagChanges: TagChange[] = [];
  const expiredTags: TriggerPipelineResult["expiredTags"] = [];
  const durationUpdates: TriggerPipelineResult["durationUpdates"] = [];
  const warnings: string[] = [];

  let triggerCount = 0;

  // 获取所有实体 ID
  const entityIds = entities.getAllEntityIds?.() ?? [];

  for (const entityId of entityIds) {
    // 获取实体的所有标签及元数据
    const tagsMap = entities.getTagsWithMetadata?.(entityId);
    if (!tagsMap || tagsMap.size === 0) continue;

    // 按添加顺序遍历（Map 保持插入顺序）
    for (const [tagId, tagMeta] of tagsMap) {
      const trigger = resolveTrigger(tagMeta, worldConfig);

      // ── turn_start 触发 ─────────────────────────────

      if (trigger && trigger.timing === "turn_start") {
        // 安全限制：单回合触发器执行数
        triggerCount++;
        if (triggerCount > TRIGGER_LIMITS.maxTriggersPerTurn) {
          warnings.push(
            `触发器执行超限：已执行 ${triggerCount} 个触发器（上限 ${TRIGGER_LIMITS.maxTriggersPerTurn}），跳过剩余触发器`
          );
          break;
        }

        // 安全限制：单个触发器 action 数
        if (trigger.actions.length > TRIGGER_LIMITS.maxTriggerActions) {
          warnings.push(
            `标签 "${tagMeta.displayName}" (${tagId}) 的触发器包含 ${trigger.actions.length} 个 action（上限 ${TRIGGER_LIMITS.maxTriggerActions}），已跳过`
          );
          // 不 continue，仍需处理 duration 衰减
        } else {
          // 构建触发器的 RuleScript
          const triggerScript: RuleScript = {
            version: 1,
            actions: trigger.actions,
          };

          // 执行触发器（actorId = 拥有标签的实体）
          const triggerContext: ExecutionContext = {
            ...baseContext,
            actorId: entityId,
            // turn_start 触发器中 "self" 指拥有标签的实体，没有 target
            targetId: undefined,
          };

          try {
            const result = engine.execute(triggerScript, triggerContext);

            if (result.success && result.resultFrame) {
              // 合并结果
              allDiceRolls.push(...result.resultFrame.diceRolls);
              allChecks.push(...result.resultFrame.checks);
              allValueChanges.push(...result.resultFrame.valueChanges);
              // C5: 合并标签变更
              allTagChanges.push(...result.tagChanges);
            } else if (!result.success) {
              warnings.push(
                `标签 "${tagMeta.displayName}" (${tagId}) 触发器执行失败: ${
                  result.error ?? "未知错误"
                }`
              );
            }
          } catch (error) {
            warnings.push(
              `标签 "${tagMeta.displayName}" (${tagId}) 触发器执行异常: ${
                error instanceof Error ? error.message : String(error)
              }`
            );
          }
        }
      }

      // ── Duration 衰减（先触发再衰减） ────────────────

      // 对所有有 trigger 且有 remainingDuration 的标签进行衰减
      if (
        trigger &&
        trigger.autoDecrement !== false &&
        tagMeta.remainingDuration !== undefined
      ) {
        const newDuration = tagMeta.remainingDuration - 1;

        if (newDuration <= 0) {
          // 到期移除
          expiredTags.push({
            entityId,
            tagId,
            tagName: tagMeta.displayName,
          });

          // 记录移除事件
          allValueChanges.push({
            entityId,
            entityType: entities.getEntityType(entityId) ?? "character",
            field: `tags.${tagId}`,
            oldValue: true,
            newValue: false,
            reason: `${tagMeta.displayName} 效果到期`,
          });
        } else {
          // 衰减
          durationUpdates.push({
            entityId,
            tagId,
            newDuration,
          });
        }
      }
    }

    // 如果已超限，跳出外层实体循环
    if (triggerCount > TRIGGER_LIMITS.maxTriggersPerTurn) break;
  }

  // 构建合并的 ResultFrame
  const hasResults =
    allDiceRolls.length > 0 ||
    allChecks.length > 0 ||
    allValueChanges.length > 0;

  const mechanicSummary = hasResults
    ? generateMechanicSummary(
        {
          checks: allChecks,
          diceRolls: allDiceRolls,
          valueChanges: allValueChanges,
        },
        baseContext.aliasMap?.displayNames
      )
    : "";

  const resultFrame = hasResults
    ? buildResultFrame({
        frameId: crypto.randomUUID(),
        commandId: baseContext.commandId,
        seed: baseContext.seed,
        success: true,
        mechanicSummary,
        valueChanges: allValueChanges,
        diceRolls: allDiceRolls,
        checks: allChecks,
      })
    : undefined;

  return {
    success: true,
    resultFrame,
    mechanicSummary,
    expiredTags,
    durationUpdates,
    tagChanges: allTagChanges,
    warnings,
  };
}
