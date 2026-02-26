import { services } from "@/core";
import { INVENTORY_QUERY_SERVICE_TOKEN } from "@/core/services/tokens";
import { subdocManager, yjsManager } from "@/core/yjs";
import type { ResultFrame, RuleScript, TagMetadata } from "@/domain/types";
import type { VariableContext } from "@/lib/prompt/types";
import type { TagChange } from "@/lib/rules";
import type { EntityAliasMap, EntityInfo } from "@/lib/rules/schema";
import { createGameStateRepository } from "@/modules/game/repository";

import { MapEntityAccessor, type EntityData } from "./entity-accessor";

/**
 * 从 AI 响应文本中提取 RuleScript JSON
 *
 * 支持：
 * - ```json ... ``` 代码块
 * - 直接 JSON 对象
 */
export function parseRuleScriptFromResponse(
  response: string,
): RuleScript | null {
  // 尝试从 markdown 代码块提取
  const codeBlockMatch = response.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  const jsonText = codeBlockMatch ? codeBlockMatch[1].trim() : response.trim();

  try {
    const parsed = JSON.parse(jsonText);

    // 验证基本结构
    if (parsed && parsed.version === 2 && Array.isArray(parsed.actions)) {
      return parsed as RuleScript;
    }

    return null;
  } catch {
    return null;
  }
}

export function sanitizeNpcAttributes(
  npcId: string,
  npcName: string,
  attributes: Record<string, unknown>,
): Record<string, number | string | boolean> {
  const fields: Record<string, number | string | boolean> = {};
  const droppedFields: string[] = [];

  for (const [key, value] of Object.entries(attributes)) {
    if (
      typeof value === "number" ||
      typeof value === "string" ||
      typeof value === "boolean"
    ) {
      fields[key] = value;
      continue;
    }

    const valueType =
      value === null ? "null" : Array.isArray(value) ? "array" : typeof value;
    droppedFields.push(`${key}(${valueType})`);
  }

  if (droppedFields.length > 0) {
    console.warn(
      `[IRNR Pipeline] spawn NPC 属性过滤: name=${npcName}, id=${npcId}, dropped=${droppedFields.join(", ")}`,
    );
  }

  return fields;
}

/**
 * 将 ResultFrame 的 valueChanges 写回 EntityAccessor
 *
 * 只处理数值字段变更（不处理 tags.xxx 变更，那些由上层单独处理）
 */
export function applyValueChangesToAccessor(
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
export function applyTagChangesToAccessor(
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
 * 过滤运行时派生的 shadow tags，避免持久化到 Yjs。
 *
 * 当前约定：
 * - category = "talent" / "equipment" 的标签属于运行时注入
 * - 历史兼容：ID 以 "equip:" 开头的标签也视为装备 shadow tag
 */
export function filterTagsForPersistence(
  tags: Map<string, TagMetadata>,
): Map<string, TagMetadata> {
  const filtered = new Map<string, TagMetadata>();

  for (const [tagId, metadata] of tags) {
    if (tagId.startsWith("equip:")) continue;
    if (metadata.category === "talent" || metadata.category === "equipment") {
      continue;
    }
    filtered.set(tagId, metadata);
  }

  return filtered;
}

/**
 * 构建角色 talentIds 映射（entityId -> talentIds）
 *
 * 优先从 Yjs 角色存储读取（单人：currentSave，联机：MainDoc），
 * 并使用 VariableContext 作为兜底来源。
 */
export function buildTalentIdsByEntityId(input: {
  actorId: string;
  roomId?: string;
  baseVariableContext: VariableContext;
}): Map<string, string[]> {
  const result = new Map<string, string[]>();

  const pushCharacters = (
    characters: Array<{ id: string; talentIds?: string[] }>,
  ) => {
    for (const character of characters) {
      if (typeof character.id !== "string" || character.id.length === 0)
        continue;

      const talentIds =
        character.talentIds?.filter(
          (id): id is string => typeof id === "string",
        ) ?? [];

      if (talentIds.length > 0) {
        result.set(character.id, talentIds);
      }
    }
  };

  if (input.roomId) {
    const mainDoc = subdocManager.getMainDoc(input.roomId);
    if (mainDoc) {
      const charactersMap = mainDoc.getMap("characters") as
        | import("yjs").Map<import("yjs").Map<unknown>>
        | undefined;

      if (charactersMap) {
        const repo = createGameStateRepository(charactersMap, mainDoc);
        pushCharacters(repo.getCharacters());
      }
    }
  } else {
    try {
      const currentSave = yjsManager.getCurrentSave();
      const rootDoc = yjsManager.getDoc();
      const charactersMap = currentSave?.get("characters") as
        | import("yjs").Map<import("yjs").Map<unknown>>
        | undefined;

      if (charactersMap) {
        const repo = createGameStateRepository(charactersMap, rootDoc);
        pushCharacters(repo.getCharacters());
      }
    } catch {
      // 在初始化前调用时忽略读取失败
    }
  }

  const actorTalentIds =
    input.baseVariableContext.user.character?.talentIds?.filter(
      (id): id is string => typeof id === "string",
    ) ?? [];

  if (actorTalentIds.length > 0 && !result.has(input.actorId)) {
    result.set(input.actorId, actorTalentIds);
  }

  for (const npc of input.baseVariableContext.activeNpcs ?? []) {
    const npcTalentIds =
      npc.talentIds?.filter((id): id is string => typeof id === "string") ?? [];

    if (npcTalentIds.length > 0 && !result.has(npc.id)) {
      result.set(npc.id, npcTalentIds);
    }
  }

  return result;
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
export function buildGameStateSnapshot(
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
export function buildEntityEffects(
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
 * 从 InventoryQueryService 构建物品/技能数据（供 VariableContext 注入）
 *
 * 遍历所有已知实体，通过 InventoryQueryService 获取对应的物品和技能列表，
 * 组装为简化的数据结构。使用 aliasMap 获取角色显示名称。
 */
export function buildInventoryData(
  accessor: MapEntityAccessor,
  aliasMap?: EntityAliasMap,
): NonNullable<VariableContext["inventoryData"]> {
  const inventoryQuery = services.getRequired(INVENTORY_QUERY_SERVICE_TOKEN);
  const result: NonNullable<VariableContext["inventoryData"]> = [];

  const entityIds = accessor.getAllEntityIds?.() ?? [];
  for (const entityId of entityIds) {
    const items = inventoryQuery.getItems(entityId);
    const skills = inventoryQuery.getSkills(entityId);

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
 * 合并 operation-log / pre / main 三路 ResultFrame。
 *
 * mechanicSummary 规则：
 * - 仅存在 main 时，保持原样（不添加 [行动] 前缀）
 * - 存在操作日志与/或 pre 时，按 [操作日志] → [回合开始] → [行动] 顺序拼接
 */
export function mergeAllResultFrames(
  operationLogFrames: readonly ResultFrame[],
  pre: ResultFrame | undefined,
  main: ResultFrame,
): ResultFrame {
  const logValueChanges = operationLogFrames.flatMap(
    (frame) => frame.valueChanges,
  );
  const logDiceRolls = operationLogFrames.flatMap((frame) => frame.diceRolls);
  const logChecks = operationLogFrames.flatMap((frame) => frame.checks);

  const logMechanicSummary = operationLogFrames
    .map((frame) => frame.mechanicSummary.trim())
    .filter((summary) => summary.length > 0)
    .join(" ");
  const preMechanicSummary = pre?.mechanicSummary.trim();

  const parts: string[] = [];
  if (logMechanicSummary) {
    parts.push(`[操作日志] ${logMechanicSummary}`);
  }
  if (preMechanicSummary) {
    parts.push(`[回合开始] ${preMechanicSummary}`);
  }

  let mechanicSummary = main.mechanicSummary;
  if (parts.length > 0) {
    if (main.mechanicSummary) {
      parts.push(`[行动] ${main.mechanicSummary}`);
    }
    mechanicSummary = parts.join(" ");
  }

  return {
    ...main,
    valueChanges: [
      ...logValueChanges,
      ...(pre?.valueChanges ?? []),
      ...main.valueChanges,
    ],
    diceRolls: [...logDiceRolls, ...(pre?.diceRolls ?? []), ...main.diceRolls],
    checks: [...logChecks, ...(pre?.checks ?? []), ...main.checks],
    mechanicSummary,
  };
}

/**
 * 将 EntityData 转换为 EntityInfo（供 prompt-generator 使用）
 */
export function toEntityInfo(entity: EntityData): EntityInfo {
  return {
    id: entity.id,
    name: entity.fields.name as string | undefined,
    level: entity.fields.level as number | string | undefined,
    status: entity.fields.status as string | undefined,
    controlType: entity.fields.controlType as string | undefined,
  };
}
