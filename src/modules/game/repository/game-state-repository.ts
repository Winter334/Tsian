/**
 * GameStateRepository — 统一的游戏角色状态读写仓库
 *
 * 基于 Y.Map<Y.Map<unknown>> 存储角色数据。
 * 使用工厂函数模式（不走 Service Token），handler 按需创建实例。
 *
 * 单机和联机统一使用同一套 Repository 接口，
 * 区别仅在于传入的 Y.Map 来源不同。
 *
 * @module game/repository/game-state-repository
 */

import type { Character, CharacterStatus } from "@/domain/entities/character";
import type {
  CreatedNpcData,
  EntityData,
  EntityFinalState,
} from "@/domain/types";
import type { TagMetadata } from "@/domain/types/result-frame";
import { serializeTagsForYjs } from "@/domain/types/tag-serialization";
import * as Y from "yjs";

import {
  characterToEntityData,
  characterToYMap,
  entityFieldsToAttributes,
  isCharacterStatus,
  yMapToCharacter,
} from "./entity-codec";

// ─── 外部类型 re-export（保持向后兼容） ─────────────────────
export type { CreatedNpcData, EntityFinalState };

// ─── Repository 接口 ──────────────────────────────────────

/**
 * 游戏状态仓库接口
 *
 * 提供角色数据的统一读写 API。
 * 读取操作返回内存中的 Character 对象；
 * 写入操作将变更同步到 Y.Map 持久层。
 */
export interface GameStateRepository {
  // ── 读取 ──

  /** 获取所有角色 */
  getCharacters(): Character[];

  /** 按 ID 获取单个角色 */
  getCharacter(id: string): Character | undefined;

  /** 获取第一个 player 类型角色 */
  getPlayerCharacter(): Character | undefined;

  /** 获取所有活跃角色（status 为 active 或 off_scene） */
  getActiveCharacters(): Character[];

  // ── 转为 IRNR EntityData ──

  /**
   * 将角色列表转为 IRNR EntityData 数组
   *
   * @param options.includeActor - 如果提供，确保该 ID 的角色一定包含在结果中
   *   （即使其 status 为 archived/dead）
   */
  toEntityDataList(options?: { includeActor?: string }): EntityData[];

  // ── 写入 ──

  /**
   * 从 IRNR 结果批量更新/创建实体
   *
   * - 已有角色：更新 attributes、tags、status
   * - 新角色（存在于 createdNpcs 中）：创建完整 Character 写入 Y.Map
   * - 所有操作包裹在 transactDoc.transact() 中
   */
  upsertFromEntityStates(
    entityStates: EntityFinalState[],
    createdNpcs?: CreatedNpcData[],
  ): void;

  /** 添加标签 */
  addTag(characterId: string, tagId: string, metadata: TagMetadata): void;

  /** 移除标签 */
  removeTag(characterId: string, tagId: string): void;

  /** 更新单个属性字段 */
  updateAttribute(characterId: string, field: string, value: unknown): void;

  /** 更新角色状态 */
  updateCharacterStatus(id: string, status: CharacterStatus): void;

  /** 添加新角色 */
  addCharacter(character: Character): void;
}

// ─── 工厂函数 ─────────────────────────────────────────────

/**
 * 创建 GameStateRepository 实例
 *
 * @param charactersMap - Y.Map<Y.Map<unknown>> 角色存储（key 为角色 ID）
 * @param transactDoc - Y.Doc 实例，用于包裹批量写入事务
 */
export function createGameStateRepository(
  charactersMap: Y.Map<Y.Map<unknown>>,
  transactDoc: Y.Doc,
): GameStateRepository {
  // ── 读取 ──

  function getCharacters(): Character[] {
    const characters: Character[] = [];
    charactersMap.forEach((charMap) => {
      try {
        characters.push(yMapToCharacter(charMap));
      } catch {
        // 跳过无效角色数据
      }
    });
    return characters;
  }

  function getCharacter(id: string): Character | undefined {
    const charMap = charactersMap.get(id);
    if (!charMap) return undefined;
    try {
      return yMapToCharacter(charMap);
    } catch {
      return undefined;
    }
  }

  function getPlayerCharacter(): Character | undefined {
    const characters = getCharacters();
    return characters.find((c) => c.controlType === "player");
  }

  function getActiveCharacters(): Character[] {
    return getCharacters().filter(
      (c) => c.status === "active" || c.status === "off_scene",
    );
  }

  // ── 转为 IRNR EntityData ──

  function toEntityDataList(options?: { includeActor?: string }): EntityData[] {
    const result: EntityData[] = [];
    const includeActor = options?.includeActor;

    charactersMap.forEach((charMap) => {
      try {
        const character = yMapToCharacter(charMap);
        const status = character.status;

        // 过滤掉已归档/死亡的非 actor 角色
        if (
          character.id !== includeActor &&
          (status === "archived" || status === "dead")
        ) {
          return; // forEach 内使用 return 相当于 continue
        }

        result.push(characterToEntityData(character));
      } catch {
        // 跳过无效角色数据
      }
    });

    return result;
  }

  // ── 写入 ──

  function upsertFromEntityStates(
    entityStates: EntityFinalState[],
    createdNpcs?: CreatedNpcData[],
  ): void {
    if (entityStates.length === 0) return;

    transactDoc.transact(() => {
      const now = Date.now();

      for (const entityState of entityStates) {
        // 从 fields 中提取实际属性（过滤掉元信息字段）
        const attributeFields = entityFieldsToAttributes(entityState.fields);

        // 序列化 tags
        const serializedTags = serializeTagsForYjs(entityState.tags);

        // 提取 status
        const statusField = entityState.fields.status;
        const nextStatus = isCharacterStatus(statusField)
          ? statusField
          : undefined;

        const existingCharMap = charactersMap.get(entityState.id);

        if (existingCharMap) {
          // === 更新已有角色 ===
          existingCharMap.set("attributes", attributeFields);
          existingCharMap.set("tags", serializedTags);
          existingCharMap.set("updatedAt", now);

          if (nextStatus !== undefined) {
            existingCharMap.set("status", nextStatus);
          }
        } else {
          // === 创建新 NPC ===
          const npcData = createdNpcs?.find((n) => n.id === entityState.id);
          if (!npcData) continue; // 未知实体，跳过

          const newCharMap = new Y.Map<unknown>();
          newCharMap.set("id", entityState.id);
          newCharMap.set("name", npcData.name || "未命名 NPC");
          newCharMap.set("controlType", "npc");
          newCharMap.set("creatorUniqueTag", "system");
          newCharMap.set("operatorUserId", "ai");
          newCharMap.set("operatorUniqueTag", "system");
          newCharMap.set("status", nextStatus ?? "active");
          newCharMap.set("description", npcData.description || "");
          newCharMap.set("personality", npcData.personality || "");
          newCharMap.set("appearance", npcData.appearance || "");
          newCharMap.set("talentIds", npcData.talentIds || []);
          newCharMap.set("attributes", attributeFields);
          newCharMap.set("tags", serializedTags);
          newCharMap.set("createdAt", now);
          newCharMap.set("updatedAt", now);

          charactersMap.set(entityState.id, newCharMap);
        }
      }
    });
  }

  function addTag(
    characterId: string,
    tagId: string,
    metadata: TagMetadata,
  ): void {
    const charMap = charactersMap.get(characterId);
    if (!charMap) return;

    transactDoc.transact(() => {
      const rawTags = charMap.get("tags");
      const serializedTags: Record<string, unknown> =
        rawTags && typeof rawTags === "object" && !Array.isArray(rawTags)
          ? { ...(rawTags as Record<string, unknown>) }
          : {};

      const tags = new Map<string, TagMetadata>();
      for (const [id, rawMeta] of Object.entries(serializedTags)) {
        if (rawMeta && typeof rawMeta === "object" && !Array.isArray(rawMeta)) {
          tags.set(id, rawMeta as TagMetadata);
        }
      }

      tags.set(tagId, metadata);
      charMap.set("tags", serializeTagsForYjs(tags));
      charMap.set("updatedAt", Date.now());
    });
  }

  function removeTag(characterId: string, tagId: string): void {
    const charMap = charactersMap.get(characterId);
    if (!charMap) return;

    transactDoc.transact(() => {
      const rawTags = charMap.get("tags");
      if (!rawTags || typeof rawTags !== "object" || Array.isArray(rawTags)) {
        return;
      }

      const tags = new Map<string, TagMetadata>();
      for (const [id, rawMeta] of Object.entries(
        rawTags as Record<string, unknown>,
      )) {
        if (rawMeta && typeof rawMeta === "object" && !Array.isArray(rawMeta)) {
          tags.set(id, rawMeta as TagMetadata);
        }
      }

      if (!tags.has(tagId)) return;

      tags.delete(tagId);
      charMap.set("tags", serializeTagsForYjs(tags));
      charMap.set("updatedAt", Date.now());
    });
  }

  function updateAttribute(
    characterId: string,
    field: string,
    value: unknown,
  ): void {
    const charMap = charactersMap.get(characterId);
    if (!charMap) return;

    transactDoc.transact(() => {
      const rawAttributes = charMap.get("attributes");
      const nextAttributes =
        rawAttributes &&
        typeof rawAttributes === "object" &&
        !Array.isArray(rawAttributes)
          ? { ...(rawAttributes as Record<string, unknown>) }
          : {};

      nextAttributes[field] = value;
      charMap.set("attributes", nextAttributes);
      charMap.set("updatedAt", Date.now());
    });
  }

  function updateCharacterStatus(id: string, status: CharacterStatus): void {
    if (!isCharacterStatus(status)) return;

    const charMap = charactersMap.get(id);
    if (!charMap) return;

    transactDoc.transact(() => {
      charMap.set("status", status);
      charMap.set("updatedAt", Date.now());
    });
  }

  function addCharacter(character: Character): void {
    transactDoc.transact(() => {
      const charMap = characterToYMap(character);
      charactersMap.set(character.id, charMap);
    });
  }

  // ── 返回 Repository 接口 ──

  return {
    getCharacters,
    getCharacter,
    getPlayerCharacter,
    getActiveCharacters,
    toEntityDataList,
    upsertFromEntityStates,
    addTag,
    removeTag,
    updateAttribute,
    updateCharacterStatus,
    addCharacter,
  };
}
