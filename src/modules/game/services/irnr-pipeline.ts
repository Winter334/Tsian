/**
 * IRNR 流水线服务
 *
 * 实现 Intent → Resolve → Narrate → Render 流水线：
 * 1. Parser AI：解析用户输入，生成 RuleScript
 * 2. Rules Engine：执行 RuleScript，生成 ResultFrame
 * 3. DelayedCommit：缓存 ResultFrame
 * 4. Narrative AI：基于 ResultFrame 生成叙事文本
 * 5. Commit 或 Discard
 *
 * 对外提供 runSolo / runMultiplayer 两个入口。
 */

import { commandBus } from "@/core";
import { MemoryCommands } from "@/domain/commands";
import type {
  CreatedNpcData,
  EntityFinalState,
  IrnrPipelineResult,
  IrnrPipelineServiceContract,
  MultiplayerIrnrInput,
  ResultFrame,
  RuleScript,
  SoloIrnrInput,
  TagMetadata,
} from "@/domain/types";
import { createAiExecutor, type AiExecutor } from "@/lib/ai/executor";
import type { AIConfig } from "@/lib/ai/types";
import { processNarrativeOutput } from "@/lib/memory/post-processor";
import type { Preset, VariableContext } from "@/lib/prompt/types";
import {
  executeTurnStartTriggers,
  rulesEngine,
  type ExecutionContext,
  type TagChange,
  type TriggerPipelineResult,
} from "@/lib/rules";
import {
  EntityInfo,
  generateOperationDefinitions,
  type EntityAliasMap,
} from "@/lib/rules/schema";
import type { WorldConfig } from "@/lib/world";
import { DEFAULT_WORLD_CONFIG } from "@/lib/world";
import { useInventoryStore } from "@/modules/inventory/store";
import {
  createDelayedCommitManager,
  type DelayedCommitManager,
} from "./delayed-commit";
import {
  buildDefaultEntityFromWorldConfig,
  MapEntityAccessor,
  type EntityData,
} from "./entity-accessor";
import { buildEntityAliasMap } from "./entity-alias";

// ─── 输入/输出类型（从 domain 层 re-export，保持向后兼容） ───

export type {
  EntityFinalState,
  IrnrPipelineResult,
  IrnrPipelineServiceContract,
  MultiplayerIrnrInput,
  SoloIrnrInput,
};

// ─── RuleScript 解析 ──────────────────────────────────────

/**
 * 从 AI 响应文本中提取 RuleScript JSON
 *
 * 支持：
 * - ```json ... ``` 代码块
 * - 直接 JSON 对象
 */
function parseRuleScriptFromResponse(response: string): RuleScript | null {
  // 尝试从 markdown 代码块提取
  const codeBlockMatch = response.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  const jsonText = codeBlockMatch ? codeBlockMatch[1].trim() : response.trim();

  try {
    const parsed = JSON.parse(jsonText);

    // 验证基本结构
    if (parsed && parsed.version === 1 && Array.isArray(parsed.actions)) {
      return parsed as RuleScript;
    }

    return null;
  } catch {
    return null;
  }
}

// ─── Pipeline 核心实现 ────────────────────────────────────

/**
 * 执行 IRNR 流水线核心逻辑
 *
 * 单人和联机共用此核心，差异在调用方传入的上下文。
 */
async function executePipeline(input: {
  commandId: string;
  aiConfig: AIConfig;
  parserPreset: Preset;
  narrativePreset: Preset;
  baseVariableContext: VariableContext;
  entities?: EntityData[];
  worldConfig?: WorldConfig;
  actorId?: string;
  targetId?: string;
  onNarrativeChunk?: (chunk: string) => void;
  onNarrativeComplete?: (text: string) => void;
  conversationId?: string;
  messageId?: string;
  messageIndex?: number;
}): Promise<IrnrPipelineResult> {
  const worldConfig = input.worldConfig ?? DEFAULT_WORLD_CONFIG;
  const commitManager: DelayedCommitManager = createDelayedCommitManager();

  // ── Phase 0: 构建 EntityAccessor ────────────────────────
  // 提前构建，以便 Parser 上下文中注入 gameState 和 entityEffects

  const entityAccessor = new MapEntityAccessor();

  if (input.entities && input.entities.length > 0) {
    for (const entity of input.entities) {
      entityAccessor.setEntity(entity);
    }
  }

  const actorId = input.actorId ?? "player";
  if (!entityAccessor.hasEntity(actorId)) {
    entityAccessor.setEntity(
      buildDefaultEntityFromWorldConfig(actorId, worldConfig),
    );
  }

  // ── Phase 0b: 构建 EntityAliasMap ────────────────────────
  // 将所有实体数据转换为别名映射，供校验和引擎使用

  const allEntities: EntityData[] = [];
  for (const entityId of entityAccessor.getAllEntityIds()) {
    const fields = entityAccessor.getAllFields(entityId);
    const tags = entityAccessor.getTagsWithMetadata(entityId);
    if (fields) {
      allEntities.push({
        id: entityId,
        type: entityAccessor.getEntityType(entityId) ?? "character",
        fields,
        tags,
      });
    }
  }
  const aliasMap = buildEntityAliasMap(actorId, allEntities);

  // ── Phase 1: Parser AI（生成 RuleScript） ──────────────

  let ruleScript: RuleScript;
  let parserExecutor: AiExecutor;

  try {
    parserExecutor = createAiExecutor(input.aiConfig);

    // 为 parser 构建上下文（注入 gameState + entityEffects + operationDefinitions + inventoryData）
    const inventoryData = buildInventoryData(entityAccessor, aliasMap);
    const parserContext: VariableContext = {
      ...input.baseVariableContext,
      worldConfig,
      gameState:
        input.baseVariableContext.gameState ??
        buildGameStateSnapshot(entityAccessor, aliasMap),
      entityEffects: buildEntityEffects(entityAccessor, aliasMap),
      operationDefinitions: generateOperationDefinitions({
        worldConfig,
        entities: input.entities?.map(toEntityInfo),
      }),
      inventoryData,
    };

    // 调用 parser AI（非流式，获取完整响应）
    let parserResponse = "";
    const parserResult = await parserExecutor.execute({
      preset: input.parserPreset,
      variableContext: parserContext,
      onChunk: (chunk) => {
        parserResponse += chunk;
      },
      onComplete: (text) => {
        parserResponse = text;
      },
    });

    if (!parserResult.success) {
      return {
        success: false,
        error: `解析 AI 调用失败: ${parserResult.error?.message ?? "未知错误"}`,
      };
    }

    const parserRawContent = parserResult.content ?? parserResponse;
    console.info("[IRNR Pipeline] Parser AI 返回内容:", parserRawContent);

    const parsed = parseRuleScriptFromResponse(parserRawContent);
    if (!parsed) {
      return {
        success: false,
        error: "解析 AI 未返回有效的 RuleScript（JSON 解析失败或格式不符）",
      };
    }

    ruleScript = parsed;
  } catch (error) {
    return {
      success: false,
      error: `解析阶段异常: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }

  // ── Phase 1b: Validation Pipeline（执行时逐 action 校验） ──
  // 校验逻辑已下沉到 RulesEngine：
  // 每个 action 在执行前校验，校验时可感知本回合已创建实体，
  // 解决“先校验后执行”导致的新实体引用时序问题。

  const seed = Date.now();

  // ── Phase 2a: TriggerPipeline.executeTurnStart（回合前触发） ──

  let preResultFrame: ResultFrame | undefined;
  let triggerResult: TriggerPipelineResult | undefined;

  try {
    triggerResult = executeTurnStartTriggers(worldConfig, entityAccessor, {
      worldConfig,
      seed,
      entities: entityAccessor,
      commandId: input.commandId,
      aliasMap,
    });

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
      const entity = entityAccessor.getAllFields?.(expired.entityId);
      if (entity) {
        // 从实体标签中移除到期标签
        const tagsMap = entityAccessor.getTagsWithMetadata?.(expired.entityId);
        if (tagsMap) {
          tagsMap.delete(expired.tagId);
          // 需要重新设置实体（MapEntityAccessor 返回的是副本）
          // 通过 setEntity 更新
          const entityData = {
            id: expired.entityId,
            type:
              entityAccessor.getEntityType(expired.entityId) ??
              ("character" as const),
            fields: entityAccessor.getAllFields?.(expired.entityId) ?? {},
            tags: tagsMap,
          };
          entityAccessor.setEntity(entityData);
        }
      }
    }

    // 处理 duration 更新
    for (const update of triggerResult.durationUpdates) {
      const tagsMap = entityAccessor.getTagsWithMetadata?.(update.entityId);
      if (tagsMap) {
        const tagMeta = tagsMap.get(update.tagId);
        if (tagMeta) {
          const updatedMeta = {
            ...tagMeta,
            remainingDuration: update.newDuration,
          };
          tagsMap.set(update.tagId, updatedMeta);
          const entityData = {
            id: update.entityId,
            type:
              entityAccessor.getEntityType(update.entityId) ??
              ("character" as const),
            fields: entityAccessor.getAllFields?.(update.entityId) ?? {},
            tags: tagsMap,
          };
          entityAccessor.setEntity(entityData);
        }
      }
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

  let resultFrame: ResultFrame;
  let engineCreatedNpcs: CreatedNpcData[] | undefined;

  try {
    const executionContext: ExecutionContext = {
      worldConfig,
      seed,
      entities: entityAccessor,
      actorId,
      targetId: input.targetId,
      commandId: input.commandId,
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
      return {
        success: false,
        error: `规则执行失败: ${executionResult.error ?? "未知错误"}`,
        ruleScript,
      };
    }

    if (!executionResult.resultFrame) {
      return {
        success: false,
        error: "规则执行未生成 ResultFrame",
        ruleScript,
      };
    }

    // C5: 写回 —— 将引擎产生的 tagChanges 应用到 EntityAccessor
    if (executionResult.tagChanges && executionResult.tagChanges.length > 0) {
      applyTagChangesToAccessor(entityAccessor, executionResult.tagChanges);
    }

    // D2 fix: 先注册新 NPC 到 EntityAccessor，再写回 valueChanges
    // 否则同轮中对新 NPC 的 valueChanges 会因实体不存在而被跳过
    if (executionResult.createdNpcs && executionResult.createdNpcs.length > 0) {
      for (const npc of executionResult.createdNpcs) {
        // 如果引擎已在 shadow state 中注册了该实体，跳过
        if (entityAccessor.hasEntity(npc.id)) continue;

        const fields: Record<string, number | string | boolean> = {
          ...npc.attributes,
        };
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

    // B3: 合并 pre + main ResultFrame
    resultFrame = mergeResultFrames(
      preResultFrame,
      executionResult.resultFrame,
    );
  } catch (error) {
    return {
      success: false,
      error: `规则执行异常: ${
        error instanceof Error ? error.message : String(error)
      }`,
      ruleScript,
    };
  }

  // ── Phase 3: Buffer（延迟提交） ────────────────────────

  const buffered = commitManager.buffer(resultFrame);
  if (!buffered) {
    return {
      success: false,
      error: "DelayedCommit buffer 失败",
      ruleScript,
      resultFrame,
    };
  }

  // ── Phase 4: Narrative AI（生成叙事文本） ──────────────

  let narrativeText = "";

  try {
    const narrativeExecutor = createAiExecutor(input.aiConfig);

    // 为 narrative 构建上下文（注入 resultFrame + 最新 gameState + entityEffects + inventoryData）
    const narrativeInventoryData = buildInventoryData(entityAccessor, aliasMap);
    const narrativeContext: VariableContext = {
      ...input.baseVariableContext,
      worldConfig,
      resultFrame,
      gameState: buildGameStateSnapshot(entityAccessor, aliasMap),
      entityEffects: buildEntityEffects(entityAccessor, aliasMap),
      entityDisplayNames: aliasMap.displayNames,
      inventoryData: narrativeInventoryData,
    };

    const narrativeResult = await narrativeExecutor.execute({
      preset: input.narrativePreset,
      variableContext: narrativeContext,
      onChunk: (chunk) => {
        narrativeText += chunk;
        input.onNarrativeChunk?.(chunk);
      },
      onComplete: (text) => {
        narrativeText = text;
      },
    });

    if (!narrativeResult.success) {
      // 叙事失败 → discard
      commitManager.discard();
      return {
        success: false,
        error: `叙事 AI 调用失败: ${
          narrativeResult.error?.message ?? "未知错误"
        }`,
        ruleScript,
        resultFrame,
      };
    }

    // ── Phase 4.5: Narrative 后处理（提取小总结） ──────────
    try {
      const postProcessed = processNarrativeOutput(narrativeText);
      narrativeText = postProcessed.narrative;

      if (postProcessed.miniSummary) {
        const { conversationId, messageId, messageIndex } = input;

        if (
          conversationId &&
          messageId &&
          typeof messageIndex === "number" &&
          Number.isFinite(messageIndex)
        ) {
          const dispatchResult = await commandBus.dispatch({
            type: MemoryCommands.ADD_MINI_SUMMARY,
            payload: {
              conversationId,
              messageId,
              messageIndex,
              content: postProcessed.miniSummary,
            },
          });

          if (!dispatchResult.success) {
            console.warn(
              `[IRNR Pipeline] 写入小总结失败: ${
                dispatchResult.error ?? "未知错误"
              }`,
            );
          }
        } else {
          console.warn(
            "[IRNR Pipeline] 检测到 memory_summary，但缺少会话上下文，跳过写入。",
          );
        }
      }
    } catch (error) {
      console.warn(
        "[IRNR Pipeline] Narrative 后处理失败，已跳过小总结提取:",
        error instanceof Error ? error.message : error,
      );
    }

    input.onNarrativeComplete?.(narrativeText);
  } catch (error) {
    // 叙事异常 → discard
    commitManager.discard();
    return {
      success: false,
      error: `叙事阶段异常: ${
        error instanceof Error ? error.message : String(error)
      }`,
      ruleScript,
      resultFrame,
    };
  }

  // ── Phase 5: Commit ────────────────────────────────────

  commitManager.commit();

  // ── 收集最终实体状态（供调用方回写到 Yjs） ─────────
  const finalEntityStates: EntityFinalState[] = [];
  for (const entityId of entityAccessor.getAllEntityIds()) {
    const fields = entityAccessor.getAllFields(entityId);
    const tags = entityAccessor.getTagsWithMetadata(entityId);
    if (fields) {
      finalEntityStates.push({ id: entityId, fields, tags });
    }
  }

  return {
    success: true,
    ruleScript,
    resultFrame,
    narrativeText,
    finalEntityStates,
    createdNpcs:
      engineCreatedNpcs && engineCreatedNpcs.length > 0
        ? engineCreatedNpcs
        : undefined,
  };
}

// ─── B3 + C5: 辅助函数 ────────────────────────────────────

/**
 * 将 ResultFrame 的 valueChanges 写回 EntityAccessor
 *
 * 只处理数值字段变更（不处理 tags.xxx 变更，那些由上层单独处理）
 */
function applyValueChangesToAccessor(
  accessor: MapEntityAccessor,
  valueChanges: readonly import("@/domain/types").ValueChange[],
): void {
  for (const change of valueChanges) {
    // 跳过标签变更（已由上层单独处理）
    if (change.field.startsWith("tags.")) continue;

    // 读取当前实体
    const fields = accessor.getAllFields?.(change.entityId);
    if (!fields) continue;

    // 写入新值
    if (
      typeof change.newValue === "number" ||
      typeof change.newValue === "string" ||
      typeof change.newValue === "boolean"
    ) {
      fields[change.field] = change.newValue;

      // 重新设置实体（更新 fields）
      const tagsMap =
        accessor.getTagsWithMetadata?.(change.entityId) ?? new Map();
      accessor.setEntity({
        id: change.entityId,
        type: accessor.getEntityType(change.entityId) ?? "character",
        fields,
        tags: tagsMap,
      });
    }
  }
}

/**
 * 将 tagChanges 写回 EntityAccessor
 *
 * C5: 将引擎/触发器执行产生的标签元数据变更应用到实体数据。
 * 解决"效果信息断裂"问题——addTag 携带的 displayName、effectDescription、trigger 等
 * 信息会被持久化到实体的 tags Map 中。
 */
function applyTagChangesToAccessor(
  accessor: MapEntityAccessor,
  tagChanges: TagChange[],
): void {
  // 按实体分组处理，减少 setEntity 调用次数
  const changesByEntity = new Map<string, TagChange[]>();
  for (const change of tagChanges) {
    const list = changesByEntity.get(change.entityId) ?? [];
    list.push(change);
    changesByEntity.set(change.entityId, list);
  }

  for (const [entityId, changes] of changesByEntity) {
    const tagsMap = accessor.getTagsWithMetadata?.(entityId) ?? new Map();
    const fields = accessor.getAllFields?.(entityId) ?? {};

    for (const change of changes) {
      if (change.action === "add" && change.metadata) {
        tagsMap.set(change.tagId, change.metadata);
      } else if (change.action === "remove") {
        tagsMap.delete(change.tagId);
      }
    }

    accessor.setEntity({
      id: entityId,
      type: accessor.getEntityType(entityId) ?? "character",
      fields,
      tags: tagsMap,
    });
  }
}

/**
 * 从 EntityAccessor 构建游戏状态快照
 *
 * C3: 将所有实体的属性字段（不含效果）序列化为扁平 key-value 格式。
 * 效果信息通过 buildEntityEffects 单独提供。
 *
 * 当提供 aliasMap 时，使用语义别名（如 "player"、NPC 名称）作为 key 前缀，
 * 使 AI 看到更友好的标识符而非内部 UUID。
 */
function buildGameStateSnapshot(
  accessor: MapEntityAccessor,
  aliasMap?: EntityAliasMap,
): Readonly<Record<string, unknown>> {
  const state: Record<string, unknown> = {};

  const entityIds = accessor.getAllEntityIds?.() ?? [];
  for (const entityId of entityIds) {
    const fields = accessor.getAllFields?.(entityId);
    if (fields) {
      const displayName = aliasMap?.displayNames.get(entityId) ?? entityId;
      for (const [key, value] of Object.entries(fields)) {
        state[`${displayName}.${key}`] = value;
      }
    }
  }

  return state;
}

/**
 * 从 EntityAccessor 构建实体效果元数据
 *
 * C3/C5: 提取所有实体的标签元数据，供 assembler 分块渲染。
 *
 * 当提供 aliasMap 时，使用语义别名作为 key，
 * 与 buildGameStateSnapshot 保持一致。
 */
function buildEntityEffects(
  accessor: MapEntityAccessor,
  aliasMap?: EntityAliasMap,
): Record<string, TagMetadata[]> {
  const effects: Record<string, TagMetadata[]> = {};

  const entityIds = accessor.getAllEntityIds?.() ?? [];
  for (const entityId of entityIds) {
    const tagsMap = accessor.getTagsWithMetadata?.(entityId);
    if (tagsMap && tagsMap.size > 0) {
      const displayName = aliasMap?.displayNames.get(entityId) ?? entityId;
      effects[displayName] = Array.from(tagsMap.values());
    }
  }

  return effects;
}

/**
 * 从 InventoryStore 构建物品/技能数据（供 VariableContext 注入）
 *
 * 遍历所有已知实体，从 useInventoryStore 获取对应的物品和技能列表，
 * 组装为简化的数据结构。使用 aliasMap 获取角色显示名称。
 */
function buildInventoryData(
  accessor: MapEntityAccessor,
  aliasMap?: EntityAliasMap,
): NonNullable<VariableContext["inventoryData"]> {
  const inventoryState = useInventoryStore.getState();
  const result: NonNullable<VariableContext["inventoryData"]> = [];

  const entityIds = accessor.getAllEntityIds?.() ?? [];
  for (const entityId of entityIds) {
    const items = inventoryState.items[entityId] ?? [];
    const skills = inventoryState.skills[entityId] ?? [];

    // 跳过没有任何物品/技能的角色
    if (items.length === 0 && skills.length === 0) continue;

    const displayName =
      aliasMap?.displayNames.get(entityId) ??
      (accessor.getAllFields?.(entityId)?.name as string | undefined) ??
      entityId;

    result.push({
      characterId: entityId,
      characterName: displayName,
      items: items.map((item) => ({
        instanceId: item.instanceId,
        name: item.name,
        description: item.description,
        category: item.category,
        quantity: item.quantity,
        equipped: item.equipped,
      })),
      skills: skills.map((skill) => ({
        instanceId: skill.instanceId,
        name: skill.name,
        description: skill.description,
        category: skill.category,
        level: skill.level,
        maxLevel: skill.maxLevel,
        activeUsable: skill.activeUsable,
      })),
    });
  }

  return result;
}

/**
 * 合并 pre-ResultFrame 和 main-ResultFrame
 *
 * 如果 pre 为空，直接返回 main。
 * 否则将 pre 的结果合并到 main 的前面。
 */
function mergeResultFrames(
  pre: ResultFrame | undefined,
  main: ResultFrame,
): ResultFrame {
  if (!pre) return main;

  return {
    ...main,
    valueChanges: [...pre.valueChanges, ...main.valueChanges],
    diceRolls: [...pre.diceRolls, ...main.diceRolls],
    checks: [...pre.checks, ...main.checks],
    mechanicSummary: pre.mechanicSummary
      ? `[回合开始] ${pre.mechanicSummary} [行动] ${main.mechanicSummary}`
      : main.mechanicSummary,
  };
}

/**
 * 将 EntityData 转换为 EntityInfo（供 prompt-generator 使用）
 */
function toEntityInfo(entity: EntityData): EntityInfo {
  return {
    id: entity.id,
    name: entity.fields.name as string | undefined,
    level: entity.fields.level as number | string | undefined,
    status: entity.fields.status as string | undefined,
    controlType: entity.fields.controlType as string | undefined,
  };
}

// ─── 服务实现 ─────────────────────────────────────────────

class IrnrPipelineServiceImpl implements IrnrPipelineServiceContract {
  async runSolo(input: SoloIrnrInput): Promise<IrnrPipelineResult> {
    return executePipeline({
      commandId: input.commandId,
      aiConfig: input.aiConfig,
      parserPreset: input.parserPreset,
      narrativePreset: input.narrativePreset,
      baseVariableContext: input.baseVariableContext,
      entities: input.entities,
      worldConfig: input.worldConfig,
      actorId: input.actorId,
      targetId: input.targetId,
      onNarrativeChunk: input.onNarrativeChunk,
      onNarrativeComplete: input.onNarrativeComplete,
      conversationId: input.conversationId,
      messageId: input.messageId,
      messageIndex: input.messageIndex,
    });
  }

  async runMultiplayer(
    input: MultiplayerIrnrInput,
  ): Promise<IrnrPipelineResult> {
    return executePipeline({
      commandId: input.commandId,
      aiConfig: input.aiConfig,
      parserPreset: input.parserPreset,
      narrativePreset: input.narrativePreset,
      baseVariableContext: input.baseVariableContext,
      entities: input.entities,
      worldConfig: input.worldConfig,
      actorId: input.actorId,
      targetId: input.targetId,
      onNarrativeChunk: input.onNarrativeChunk,
      onNarrativeComplete: input.onNarrativeComplete,
      conversationId: input.conversationId,
      messageId: input.messageId,
      messageIndex: input.messageIndex,
    });
  }
}

export const irnrPipelineService: IrnrPipelineServiceContract =
  new IrnrPipelineServiceImpl();
