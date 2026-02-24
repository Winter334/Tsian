/**
 * Pipeline 相关实体数据类型
 *
 * 这些类型被 IRNR Pipeline、Rules Engine 和 Repository 共同使用，
 * 放置在 domain 层以便各模块合法引用。
 */

import type { ItemInstance } from "../entities/item";
import type { SkillInstance } from "../entities/skill";
import type { EntityType, TagMetadata } from "./result-frame";

// ─── EntityData ───────────────────────────────────────────

/**
 * 实体数据（扁平化属性）
 *
 * 为规则引擎和 Repository 提供统一的实体数据结构。
 */
export interface EntityData {
  id: string;
  type: EntityType;
  fields: Record<string, number | string | boolean>;
  /** 标签存储（Map<tagId, TagMetadata>） */
  tags: Map<string, TagMetadata>;
}

// ─── EntityAccessor ───────────────────────────────────────

/**
 * 实体访问器接口
 *
 * 为规则引擎和执行服务提供统一的只读实体访问能力。
 */
export interface EntityAccessor {
  /** 读取实体属性值 */
  getValue(
    entityId: string,
    field: string,
  ): number | string | boolean | undefined;

  /** 获取实体类型 */
  getEntityType(entityId: string): EntityType | undefined;

  /** 检查实体是否拥有标签 */
  hasTag(entityId: string, tagId: string): boolean;

  /** 获取实体所有标签（可选） */
  getTags?(entityId: string): string[];

  /** 获取实体所有字段（用于动态属性注入） */
  getAllFields?(
    entityId: string,
  ): Record<string, number | string | boolean> | undefined;

  /** 获取所有实体 ID */
  getAllEntityIds?(): string[];

  /** 获取实体标签及元数据 */
  getTagsWithMetadata?(entityId: string): Map<string, TagMetadata>;

  /** 获取角色的物品实例列表（可选） */
  getItems?(entityId: string): readonly ItemInstance[];
  /** 获取角色的技能实例列表（可选） */
  getSkills?(entityId: string): readonly SkillInstance[];
}

// ─── EntityFinalState ─────────────────────────────────────

/**
 * 实体最终状态快照
 *
 * 在 IRNR 流水线成功后，包含每个实体的最终字段值和标签元数据。
 * 联机模式下用于回写到 Yjs MainDoc.characters。
 */
export interface EntityFinalState {
  /** 实体 ID */
  id: string;
  /** 更新后的字段值 */
  fields: Record<string, number | string | boolean>;
  /** 更新后的标签（已反序列化的 Map） */
  tags: Map<string, TagMetadata>;
}

// ─── CreatedNpcData ───────────────────────────────────────

/**
 * 动态创建的 NPC 数据
 *
 * 由 IRNR Pipeline 在执行 createEntity action 时生成，
 * 包含 NPC 的基本信息，用于在 Repository 中创建完整 Character。
 */
export interface CreatedNpcData {
  /** NPC 实体 ID（与 EntityFinalState.id 对应） */
  id: string;
  /** NPC 名称 */
  name: string;
  /** 背景描述 */
  description?: string;
  /** 性格特征 */
  personality?: string;
  /** 外貌描述 */
  appearance?: string;
  /** 初始属性 */
  attributes: Record<string, number>;
  /** 天赋 ID 列表 */
  talentIds?: string[];
}
