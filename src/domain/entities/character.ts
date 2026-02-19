/**
 * 角色实体定义
 *
 * 角色是游戏中的可操作单位，由玩家创建和控制
 * 支持跨设备匹配和多人协作
 */

import type { Entity } from "../types";

/**
 * 角色状态
 *
 * - active: 活跃状态，可以参与游戏
 * - off_scene: 离场状态，暂时不在场景中
 * - archived: 归档状态，不再参与但保留记录
 * - dead: 死亡状态，无法继续参与
 */
export type CharacterStatus = "active" | "off_scene" | "archived" | "dead";

/**
 * 角色控制类型
 * - player:    玩家角色 PC
 * - npc:       AI 控制的 NPC
 * - companion: 玩家同伴, AI 辅助控制
 */
export type ControlType = "player" | "npc" | "companion";

/**
 * 角色实体
 */
export interface Character extends Entity {
  /** 角色名称 */
  name: string;

  // ── 控制类型 ──
  /** 角色控制类型（默认 'player'） */
  controlType: ControlType;

  // ── 角色描述 ──
  /** 角色背景故事 */
  description?: string;
  /** 性格特征 */
  personality?: string;
  /** 外貌描述 */
  appearance?: string;

  /**
   * 创建者的 uniqueTag
   * 用于标识角色的原始创建者
   */
  creatorUniqueTag: string;

  /**
   * 当前操作者的 userId
   * 用于同设备匹配
   */
  operatorUserId: string;

  /**
   * 当前操作者的 uniqueTag
   * 用于跨设备匹配
   */
  operatorUniqueTag: string;

  /** 角色状态 */
  status: CharacterStatus;

  /**
   * 角色属性（可扩展）
   * 用于存储游戏特定的角色属性
   */
  attributes?: Record<string, unknown>;

  /** 维度选择（key: 维度 ID, value: 选项 ID） */
  dimensionSelections?: Record<string, string>;
  /** 已选天赋 ID 列表 */
  talentIds?: string[];

  /**
   * 标签元数据（序列化形式）
   *
   * 在 Yjs 中以 Record<string, unknown> 存储（而非 Map），
   * 加载时通过 deserializeTagsFromYjs() 恢复为 Map<string, TagMetadata>。
   * 用于持久化角色身上的效果/状态标签。
   */
  tags?: Record<string, unknown>;
}

/**
 * 创建角色的参数
 */
export interface CreateCharacterParams {
  /** 角色名称 */
  name: string;
  /** 角色控制类型（默认 'player'） */
  controlType?: ControlType;
  /** 角色背景故事 */
  description?: string;
  /** 性格特征 */
  personality?: string;
  /** 外貌描述 */
  appearance?: string;
  /** 创建者的 uniqueTag */
  creatorUniqueTag: string;
  /** 操作者的 userId */
  operatorUserId: string;
  /** 操作者的 uniqueTag */
  operatorUniqueTag: string;
  /** 初始状态（默认 active） */
  status?: CharacterStatus;
  /** 初始属性 */
  attributes?: Record<string, unknown>;
  /** 维度选择（key: 维度 ID, value: 选项 ID） */
  dimensionSelections?: Record<string, string>;
  /** 已选天赋 ID 列表 */
  talentIds?: string[];
}

/**
 * 更新角色的参数
 */
export interface UpdateCharacterParams {
  /** 角色名称 */
  name?: string;
  /** 角色背景故事 */
  description?: string;
  /** 性格特征 */
  personality?: string;
  /** 外貌描述 */
  appearance?: string;
  /** 角色状态 */
  status?: CharacterStatus;
  /** 操作者的 userId（转移控制权时使用） */
  operatorUserId?: string;
  /** 操作者的 uniqueTag（转移控制权时使用） */
  operatorUniqueTag?: string;
  /** 角色属性 */
  attributes?: Record<string, unknown>;
}

/**
 * 创建新角色
 */
export function createCharacter(params: CreateCharacterParams): Character {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    name: params.name,
    controlType: params.controlType ?? "player",
    description: params.description,
    personality: params.personality,
    appearance: params.appearance,
    creatorUniqueTag: params.creatorUniqueTag,
    operatorUserId: params.operatorUserId,
    operatorUniqueTag: params.operatorUniqueTag,
    status: params.status ?? "active",
    attributes: params.attributes,
    dimensionSelections: params.dimensionSelections,
    talentIds: params.talentIds,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * 检查用户是否可以操作角色
 *
 * 匹配规则：
 * 1. 优先按 userId 匹配（同设备）
 * 2. 其次按 uniqueTag 匹配（跨设备）
 *
 * @param character 角色
 * @param userId 当前用户的 userId
 * @param uniqueTag 当前用户的 uniqueTag
 */
export function canOperateCharacter(
  character: Character,
  userId: string,
  uniqueTag: string
): boolean {
  // 优先按 userId 匹配
  if (character.operatorUserId === userId) {
    return true;
  }
  // 其次按 uniqueTag 匹配
  if (character.operatorUniqueTag === uniqueTag) {
    return true;
  }
  return false;
}

/**
 * 检查用户是否是角色的创建者
 */
export function isCharacterCreator(
  character: Character,
  uniqueTag: string
): boolean {
  return character.creatorUniqueTag === uniqueTag;
}
