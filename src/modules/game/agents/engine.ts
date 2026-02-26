import type { AgentDescriptor } from "@/core/pipeline";
import type { PipelineBlackboard } from "@/domain/types";
import {
  executeTurnStartTriggers,
  rulesEngine,
  type ExecutionContext,
} from "@/lib/rules";
import type { MapEntityAccessor } from "@/modules/game/services/entity-accessor";
import {
  applyTagChangesToAccessor,
  applyValueChangesToAccessor,
  mergeAllResultFrames,
  sanitizeNpcAttributes,
} from "@/modules/game/services/pipeline-helpers";
import { useOperationLogStore } from "@/modules/game/stores/operation-log-store";

export const engineAgent: AgentDescriptor<PipelineBlackboard> = {
  id: "engine",
  name: "规则引擎",
  requires: ["ruleScript", "entityAccessor", "aliasMap"],
  produces: ["resultFrame", "createdNpcs"],
  execute: async (bb) => {
    const ruleScript = bb.ruleScript;
    if (!ruleScript) {
      throw new Error("Engine Agent 缺少 ruleScript");
    }

    const entityAccessor = bb.entityAccessor as MapEntityAccessor | undefined;
    if (!entityAccessor) {
      throw new Error("Engine Agent 缺少 entityAccessor");
    }

    const aliasMap = bb.aliasMap;
    if (!aliasMap) {
      throw new Error("Engine Agent 缺少 aliasMap");
    }

    const seed = Date.now();

    // 消费操作日志（Phase 4c）
    const operationLogFrames = useOperationLogStore.getState().consumeAll();

    // ── Phase 2a: TriggerPipeline.executeTurnStart（回合前触发） ──

    let preResultFrame: PipelineBlackboard["resultFrame"] = undefined;

    try {
      const triggerResult = executeTurnStartTriggers(
        bb.worldConfig,
        entityAccessor,
        {
          worldConfig: bb.worldConfig,
          seed,
          entities: entityAccessor,
          commandId: bb.commandId,
          aliasMap,
        },
      );

      preResultFrame = triggerResult.resultFrame;

      // B3: 写回 —— 将触发器产生的 valueChanges 应用到 EntityAccessor
      if (triggerResult.resultFrame) {
        applyValueChangesToAccessor(
          entityAccessor,
          triggerResult.resultFrame.valueChanges,
        );
      }

      // C5: 写回 —— 将触发器产生的 tagChanges 应用到 EntityAccessor
      if (triggerResult.tagChanges.length > 0) {
        applyTagChangesToAccessor(entityAccessor, triggerResult.tagChanges);
      }

      // 处理到期标签移除
      for (const expired of triggerResult.expiredTags) {
        const entityData = entityAccessor.getEntityData(expired.entityId);
        if (!entityData) continue;

        entityData.tags.delete(expired.tagId);
        entityAccessor.setEntity({
          id: entityData.id,
          type: entityData.type,
          fields: entityData.fields,
          tags: entityData.tags,
        });
      }

      // 处理 duration 更新
      for (const update of triggerResult.durationUpdates) {
        const entityData = entityAccessor.getEntityData(update.entityId);
        if (!entityData) continue;

        const tagMeta = entityData.tags.get(update.tagId);
        if (!tagMeta) continue;

        entityData.tags.set(update.tagId, {
          ...tagMeta,
          remainingDuration: update.newDuration,
        });

        entityAccessor.setEntity({
          id: entityData.id,
          type: entityData.type,
          fields: entityData.fields,
          tags: entityData.tags,
        });
      }

      // 输出触发器警告
      for (const warning of triggerResult.warnings) {
        console.warn(`[IRNR Pipeline] 触发器警告: ${warning}`);
      }
    } catch (error) {
      // 触发器失败不阻塞主流程
      console.warn(
        `[IRNR Pipeline] TriggerPipeline 执行异常:`,
        error instanceof Error ? error.message : error,
      );
    }

    // ── Phase 2b: Rules Engine（执行 RuleScript） ───────────

    let engineCreatedNpcs: PipelineBlackboard["createdNpcs"];

    try {
      const executionContext: ExecutionContext = {
        worldConfig: bb.worldConfig,
        seed,
        entities: entityAccessor,
        actorId: bb.actorId,
        targetId: bb.targetId,
        commandId: bb.commandId,
        aliasMap,
      };

      const executionResult = rulesEngine.execute(ruleScript, executionContext);

      // 输出运行时逐 action 校验日志
      if (executionResult.validationErrors) {
        for (const err of executionResult.validationErrors) {
          const prefix = err.level === "error" ? "❌" : "⚠️";
          console.warn(
            `[IRNR Pipeline] 校验 ${prefix} [action#${err.actionIndex}${
              err.actionType ? ` ${err.actionType}` : ""
            }]: ${err.message}`,
          );
        }
      }

      if (!executionResult.success) {
        throw new Error(`规则执行失败: ${executionResult.error ?? "未知错误"}`);
      }

      if (!executionResult.resultFrame) {
        throw new Error("规则执行未生成 ResultFrame");
      }

      // C5: 写回 —— 将引擎产生的 tagChanges 应用到 EntityAccessor
      if (executionResult.tagChanges && executionResult.tagChanges.length > 0) {
        applyTagChangesToAccessor(entityAccessor, executionResult.tagChanges);
      }

      // D2 fix: 先注册新 NPC 到 EntityAccessor，再写回 valueChanges
      // 否则同轮中对新 NPC 的 valueChanges 会因实体不存在而被跳过
      if (
        executionResult.createdNpcs &&
        executionResult.createdNpcs.length > 0
      ) {
        for (const npc of executionResult.createdNpcs) {
          // 如果引擎已在 shadow state 中注册了该实体，跳过
          if (entityAccessor.hasEntity(npc.id)) continue;

          const fields = sanitizeNpcAttributes(
            npc.id,
            npc.name,
            npc.attributes,
          );
          entityAccessor.setEntity({
            id: npc.id,
            type: "character",
            fields,
            tags: new Map(),
          });
        }

        // D3 fix: 增量更新别名映射，将新 NPC 加入 aliasMap
        // 使后续 buildGameStateSnapshot / buildEntityEffects / generateMechanicSummary
        // 能正确显示新 NPC 名称而非内部 ID
        for (const npc of executionResult.createdNpcs) {
          const name = npc.name;
          if (name.length === 0) continue;
          // 跳过已有 displayName 的实体（已在别名表中）
          if (aliasMap.displayNames.has(npc.id)) continue;

          const normalizedName = name.toLowerCase();
          const existingId = aliasMap.aliases.get(normalizedName);

          if (!existingId) {
            // 唯一名称：直接映射
            aliasMap.aliases.set(normalizedName, npc.id);
            aliasMap.displayNames.set(npc.id, name);
          } else if (existingId !== npc.id) {
            // 重名：使用 "名称#序号" 消歧（与 buildEntityAliasMap 逻辑一致）
            const existingDisplay = aliasMap.displayNames.get(existingId);
            if (existingDisplay && !existingDisplay.includes("#")) {
              // 现有实体尚未消歧，给它加上 #1
              aliasMap.aliases.set(`${normalizedName}#1`, existingId);
              aliasMap.displayNames.set(existingId, `${existingDisplay}#1`);
            }
            // 找到下一个可用序号
            let index = 2;
            while (aliasMap.aliases.has(`${normalizedName}#${index}`)) {
              index++;
            }
            aliasMap.aliases.set(`${normalizedName}#${index}`, npc.id);
            aliasMap.displayNames.set(npc.id, `${name}#${index}`);
          }
        }
      }

      // 保存引擎创建的 NPC 数据到外层变量
      engineCreatedNpcs = executionResult.createdNpcs;

      // B3: 写回 —— 将引擎产生的 valueChanges 应用到 EntityAccessor
      // 移到 NPC 注册之后，确保新 NPC 的 valueChanges 不被跳过（D2 fix）
      if (executionResult.resultFrame.valueChanges.length > 0) {
        applyValueChangesToAccessor(
          entityAccessor,
          executionResult.resultFrame.valueChanges,
        );
      }

      // B3: 合并 operation-log + pre + main ResultFrame
      const mergedFrame = mergeAllResultFrames(
        operationLogFrames,
        preResultFrame,
        executionResult.resultFrame,
      );

      // 写入黑板
      bb.resultFrame = mergedFrame;
      bb.createdNpcs = engineCreatedNpcs;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      if (
        errorMessage.startsWith("规则执行失败:") ||
        errorMessage === "规则执行未生成 ResultFrame"
      ) {
        throw new Error(errorMessage);
      }

      throw new Error(`规则执行异常: ${errorMessage}`);
    }
  },
};
