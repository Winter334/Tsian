/**
 * EntityAccessor 实现
 *
 * 为规则引擎提供实体属性的读取接口。
 * 支持两种数据源：
 * - 联机模式：从 MainDoc.characters 读取
 * - 单人模式：基于 WorldConfig 默认值 + 衍生属性计算
 */

import type { EntityData, EntityType, TagMetadata } from "@/domain/types";
import type { EntityAccessor } from "@/lib/rules";
import { computeDerivedStats } from "@/lib/rules/derived-stats";
import type { TalentConfig, WorldConfig } from "@/lib/world";

// ─── 实体数据 ─────────────────────────────────────────────

/** 从 domain 层 re-export，保持向后兼容 */
export type { EntityData };

/**
 * 基于 Map 的 EntityAccessor 实现
 */
export class MapEntityAccessor implements EntityAccessor {
  private entities: Map<string, EntityData>;

  constructor(entities?: Map<string, EntityData>) {
    this.entities = entities ?? new Map();
  }

  getValue(
    entityId: string,
    field: string
  ): number | string | boolean | undefined {
    const entity = this.entities.get(entityId);
    if (!entity) return undefined;
    return entity.fields[field];
  }

  getEntityType(entityId: string): EntityType | undefined {
    return this.entities.get(entityId)?.type;
  }

  hasTag(entityId: string, tagId: string): boolean {
    const entity = this.entities.get(entityId);
    if (!entity) return false;
    return entity.tags.has(tagId);
  }

  getTags(entityId: string): string[] {
    const entity = this.entities.get(entityId);
    if (!entity) return [];
    return Array.from(entity.tags.keys());
  }

  /** 获取实体标签及元数据（trigger 查找用） */
  getTagsWithMetadata(entityId: string): Map<string, TagMetadata> {
    const entity = this.entities.get(entityId);
    if (!entity) return new Map();
    return new Map(entity.tags);
  }

  /** 获取实体所有字段（用于动态属性注入） */
  getAllFields(
    entityId: string
  ): Record<string, number | string | boolean> | undefined {
    const entity = this.entities.get(entityId);
    if (!entity) return undefined;
    return { ...entity.fields };
  }

  /** 获取所有实体 ID */
  getAllEntityIds(): string[] {
    return Array.from(this.entities.keys());
  }

  /**
   * 添加或更新实体
   */
  setEntity(data: EntityData): void {
    this.entities.set(data.id, data);
  }

  /**
   * 检查实体是否存在
   */
  hasEntity(entityId: string): boolean {
    return this.entities.has(entityId);
  }
}

/**
 * 从 WorldConfig 构建默认实体数据
 *
 * 1. 填充基础属性（primaryAttributes）的 defaultValue
 * 2. 应用 overrides 覆盖值
 * 3. 通过 computeDerivedStats 计算所有衍生属性（formula 驱动）
 */
export function buildDefaultEntityFromWorldConfig(
  entityId: string,
  worldConfig: WorldConfig,
  overrides?: Record<string, number | string | boolean>
): EntityData {
  const fields: Record<string, number | string | boolean> = {};

  // 1. 填充基础属性
  for (const attr of worldConfig.primaryAttributes) {
    fields[attr.key] = attr.defaultValue;
  }

  // 2. 应用覆盖值（在衍生属性计算之前，这样覆盖的基础属性会影响衍生计算）
  if (overrides) {
    for (const [key, value] of Object.entries(overrides)) {
      fields[key] = value;
    }
  }

  // 3. 计算衍生属性
  const fullFields = computeDerivedStats(fields, worldConfig.derivedStats);

  // 4. 再次应用覆盖值（覆盖可能包含对衍生属性的显式覆盖，如自定义 hp）
  if (overrides) {
    for (const [key, value] of Object.entries(overrides)) {
      fullFields[key] = value;
    }
  }

  return {
    id: entityId,
    type: "character",
    fields: fullFields,
    tags: new Map(),
  };
}

/**
 * 从联机角色数据构建实体数据
 */
export function buildEntityFromCharacterData(
  characterId: string,
  attributes?: Record<string, unknown>
): EntityData {
  const fields: Record<string, number | string | boolean> = {};

  if (attributes) {
    for (const [key, value] of Object.entries(attributes)) {
      if (
        typeof value === "number" ||
        typeof value === "string" ||
        typeof value === "boolean"
      ) {
        fields[key] = value;
      }
    }
  }

  return {
    id: characterId,
    type: "character",
    fields,
    tags: new Map(),
  };
}

/**
 * 将天赋应用到实体数据
 *
 * 根据天赋 ID 列表，从 WorldConfig.talents 查找配置，
 * 将天赋作为 TagMetadata（category=talent, timing=passive）写入实体的 tags Map。
 *
 * @param entity - 目标实体数据（会被原地修改）
 * @param talentIds - 要应用的天赋 ID 列表
 * @param worldConfig - 世界配置
 */
export function applyTalentsToEntity(
  entity: EntityData,
  talentIds: string[],
  worldConfig: WorldConfig
): void {
  if (!worldConfig.talents) return;

  for (const talentId of talentIds) {
    const talent: TalentConfig | undefined = worldConfig.talents.find(
      (t) => t.id === talentId
    );
    if (!talent) continue;

    const metadata: TagMetadata = {
      id: talent.id,
      displayName: talent.name,
      effectDescription: talent.description,
      trigger:
        talent.modifiers && talent.modifiers.length > 0
          ? {
              timing: "passive" as const,
              actions: [],
              modifiers: talent.modifiers,
            }
          : undefined,
      source: "predefined",
      category: "talent",
    };

    entity.tags.set(talent.id, metadata);
  }
}
