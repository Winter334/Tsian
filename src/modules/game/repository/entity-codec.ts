/**
 * Character ↔ Y.Map 编解码层
 *
 * 唯一的 Character ↔ Y.Map 编解码实现。
 * 同时提供 Character → EntityData 转换（供 IRNR Pipeline 使用）。
 *
 * @module game/repository/entity-codec
 */

import type {
  Character,
  CharacterStatus,
  ControlType,
  UpdateCharacterParams,
} from "@/domain/entities/character";
import type { EntityType } from "@/domain/types";
import { deserializeTagsFromYjs, serializeTagsForYjs } from "@/domain/types";
import type { EntityData } from "@/modules/game/services/entity-accessor";
import * as Y from "yjs";

// ─── 元信息字段常量 ─────────────────────────────────────────

/**
 * 注入到 EntityData.fields 中的元信息字段名。
 * 这些字段不属于 Character.attributes，写回时需过滤。
 */
const META_FIELDS = new Set(["controlType", "status", "name"]);

// ─── Character → Y.Map ────────────────────────────────────

/**
 * 将 Character 编码为 Y.Map<unknown>
 *
 * 将 Character 对象的每个字段逐一设置到 Y.Map 中。
 * 复杂类型（如 tags）会通过 serializeTagsForYjs 序列化。
 */
export function characterToYMap(character: Character): Y.Map<unknown> {
  const charMap = new Y.Map<unknown>();

  // 基础字段
  charMap.set("id", character.id);
  charMap.set("name", character.name);
  charMap.set("controlType", character.controlType);
  charMap.set("status", character.status);

  // Entity 基类字段
  charMap.set("createdAt", character.createdAt);
  charMap.set("updatedAt", character.updatedAt);

  // 身份字段
  charMap.set("creatorUniqueTag", character.creatorUniqueTag);
  charMap.set("operatorUserId", character.operatorUserId);
  charMap.set("operatorUniqueTag", character.operatorUniqueTag);

  // 可选描述字段
  if (character.description !== undefined) {
    charMap.set("description", character.description);
  }
  if (character.personality !== undefined) {
    charMap.set("personality", character.personality);
  }
  if (character.appearance !== undefined) {
    charMap.set("appearance", character.appearance);
  }
  if (character.age !== undefined) {
    charMap.set("age", character.age);
  }
  if (character.gender !== undefined) {
    charMap.set("gender", character.gender);
  }

  // 可选配置字段
  if (character.dimensionSelections !== undefined) {
    charMap.set(
      "dimensionSelections",
      JSON.stringify(character.dimensionSelections),
    );
  }
  if (character.talentIds !== undefined) {
    charMap.set("talentIds", character.talentIds);
  }

  // 属性和标签
  if (character.attributes !== undefined) {
    charMap.set("attributes", character.attributes);
  }
  if (character.tags !== undefined) {
    charMap.set("tags", character.tags);
  }

  return charMap;
}

// ─── Y.Map → Character ────────────────────────────────────

/**
 * 将 Y.Map<unknown> 解码为 Character
 *
 * 从 Y.Map 中提取所有字段并进行类型安全转换。
 * 缺失的必填字段会使用合理的默认值。
 */
export function yMapToCharacter(charMap: Y.Map<unknown>): Character {
  const id = charMap.get("id");
  const name = charMap.get("name");
  const controlType = charMap.get("controlType");
  const status = charMap.get("status");
  const createdAt = charMap.get("createdAt");
  const updatedAt = charMap.get("updatedAt");
  const creatorUniqueTag = charMap.get("creatorUniqueTag");
  const operatorUserId = charMap.get("operatorUserId");
  const operatorUniqueTag = charMap.get("operatorUniqueTag");
  const description = charMap.get("description");
  const personality = charMap.get("personality");
  const appearance = charMap.get("appearance");
  const age = charMap.get("age");
  const gender = charMap.get("gender");
  const dimensionSelectionsRaw = charMap.get("dimensionSelections");
  const talentIds = charMap.get("talentIds");
  const attributes = charMap.get("attributes");
  const tags = charMap.get("tags");

  const now = Date.now();

  const character: Character = {
    id: typeof id === "string" ? id : crypto.randomUUID(),
    name: typeof name === "string" ? name : "未命名",
    controlType: isControlType(controlType) ? controlType : "player",
    status: isCharacterStatus(status) ? status : "active",
    createdAt: typeof createdAt === "number" ? createdAt : now,
    updatedAt: typeof updatedAt === "number" ? updatedAt : now,
    creatorUniqueTag:
      typeof creatorUniqueTag === "string" ? creatorUniqueTag : "",
    operatorUserId: typeof operatorUserId === "string" ? operatorUserId : "",
    operatorUniqueTag:
      typeof operatorUniqueTag === "string" ? operatorUniqueTag : "",
  };

  // 可选字段
  if (typeof description === "string") {
    character.description = description;
  }
  if (typeof personality === "string") {
    character.personality = personality;
  }
  if (typeof appearance === "string") {
    character.appearance = appearance;
  }
  if (typeof age === "number") {
    character.age = age ?? undefined;
  }
  if (typeof gender === "string") {
    character.gender = gender || undefined;
  }
  if (typeof dimensionSelectionsRaw === "string") {
    try {
      const parsed = JSON.parse(dimensionSelectionsRaw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        character.dimensionSelections = parsed as Record<string, string>;
      }
    } catch {
      // 忽略无效的 JSON
    }
  } else if (
    dimensionSelectionsRaw &&
    typeof dimensionSelectionsRaw === "object" &&
    !Array.isArray(dimensionSelectionsRaw)
  ) {
    // 兼容直接存储为对象的情况
    character.dimensionSelections = dimensionSelectionsRaw as Record<
      string,
      string
    >;
  }
  if (Array.isArray(talentIds)) {
    character.talentIds = talentIds.filter(
      (t): t is string => typeof t === "string",
    );
  }
  if (
    attributes &&
    typeof attributes === "object" &&
    !Array.isArray(attributes)
  ) {
    character.attributes = attributes as Record<string, unknown>;
  }
  if (tags && typeof tags === "object" && !Array.isArray(tags)) {
    character.tags = tags as Record<string, unknown>;
  }

  return character;
}

// ─── Character → EntityData ───────────────────────────────

/**
 * 将 Character 转为 IRNR 所需的 EntityData
 *
 * - 自动从 attributes 提取值到 fields（只保留 number | string | boolean）
 * - 自动注入元信息字段到 fields：controlType, status, name, level
 * - 自动调用 deserializeTagsFromYjs() 处理 tags
 */
export function characterToEntityData(character: Character): EntityData {
  const fields: Record<string, number | string | boolean> = {};

  // 1. 从 attributes 提取数值/字符串/布尔字段
  if (character.attributes) {
    for (const [key, value] of Object.entries(character.attributes)) {
      if (
        typeof value === "number" ||
        typeof value === "string" ||
        typeof value === "boolean"
      ) {
        fields[key] = value;
      }
    }
  }

  // 2. 注入元信息字段
  fields.controlType = character.controlType;
  fields.status = character.status;
  fields.name = character.name;

  // level 可能存储在 attributes 中，如果有则已通过上面提取
  // 这里不重复处理

  // 3. 反序列化 tags
  const tags = deserializeTagsFromYjs(
    character.tags as Record<string, unknown> | undefined,
  );

  // 4. 确定 EntityType
  const type: EntityType = "character";

  return {
    id: character.id,
    type,
    fields,
    tags,
  };
}

// ─── EntityData.fields → attributes ───────────────────────

/**
 * 从 EntityData.fields 反向提取 attributes
 *
 * 过滤掉元信息字段（controlType, status, name），
 * 保留实际的角色属性字段。
 */
export function entityFieldsToAttributes(
  fields: Record<string, number | string | boolean>,
): Record<string, unknown> {
  const attributes: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (!META_FIELDS.has(key)) {
      attributes[key] = value;
    }
  }
  return attributes;
}

// ─── 类型守卫 ─────────────────────────────────────────────

function isControlType(value: unknown): value is ControlType {
  return value === "player" || value === "npc" || value === "companion";
}

function isCharacterStatus(value: unknown): value is CharacterStatus {
  return (
    value === "active" ||
    value === "off_scene" ||
    value === "archived" ||
    value === "dead"
  );
}

/**
 * 将更新参数增量应用到角色 Y.Map（逐字段 set，保证 Yjs 增量同步）
 */
export function applyCharacterUpdates(
  charMap: Y.Map<unknown>,
  updates: UpdateCharacterParams,
): void {
  if (updates.name !== undefined) {
    charMap.set("name", updates.name);
  }
  if (updates.status !== undefined) {
    charMap.set("status", updates.status);
  }
  if (updates.description !== undefined) {
    charMap.set("description", updates.description);
  }
  if (updates.personality !== undefined) {
    charMap.set("personality", updates.personality);
  }
  if (updates.appearance !== undefined) {
    charMap.set("appearance", updates.appearance);
  }
  if (updates.age !== undefined) {
    charMap.set("age", updates.age);
  }
  if (updates.gender !== undefined) {
    charMap.set("gender", updates.gender);
  }

  if (updates.attributes !== undefined) {
    const existingAttrs = charMap.get("attributes");
    charMap.set("attributes", {
      ...(existingAttrs &&
      typeof existingAttrs === "object" &&
      !Array.isArray(existingAttrs)
        ? (existingAttrs as Record<string, unknown>)
        : {}),
      ...updates.attributes,
    });
  }

  const extraUpdates = updates as UpdateCharacterParams &
    Partial<
      Pick<
        Character,
        "dimensionSelections" | "talentIds" | "controlType" | "tags"
      >
    >;

  if (extraUpdates.dimensionSelections !== undefined) {
    charMap.set(
      "dimensionSelections",
      JSON.stringify(extraUpdates.dimensionSelections),
    );
  }
  if (extraUpdates.talentIds !== undefined) {
    charMap.set("talentIds", extraUpdates.talentIds);
  }
  if (extraUpdates.controlType !== undefined) {
    charMap.set("controlType", extraUpdates.controlType);
  }
  if (extraUpdates.tags !== undefined) {
    charMap.set("tags", extraUpdates.tags);
  }

  if (updates.operatorUserId !== undefined) {
    charMap.set("operatorUserId", updates.operatorUserId);
  }
  if (updates.operatorUniqueTag !== undefined) {
    charMap.set("operatorUniqueTag", updates.operatorUniqueTag);
  }

  charMap.set("updatedAt", Date.now());
}

// 导出类型守卫供 repository 使用
export { isCharacterStatus, isControlType };

// 重新导出供外部使用
export { serializeTagsForYjs };
