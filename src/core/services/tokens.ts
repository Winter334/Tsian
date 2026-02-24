/**
 * 跨模块服务 Token
 *
 * 用于模块间通过 ServiceRegistry 解耦调用。
 */

import type { Character } from "@/domain/entities/character";
import type { ItemInstance } from "@/domain/entities/item";
import type { SkillInstance } from "@/domain/entities/skill";
import type {
  DirectAction,
  DirectActionResult,
  EntityAccessor,
  IrnrPipelineServiceContract,
  TagMetadata,
} from "@/domain/types";
import { createServiceToken } from "./index";

export type { IrnrPipelineServiceContract };

/**
 * Direct Action 轻量管线服务契约
 */
export interface DirectActionServiceContract {
  execute(action: DirectAction): Promise<DirectActionResult>;
}

/**
 * Game 模块注册的 IRNR Pipeline Service token
 */
export const IRNR_PIPELINE_SERVICE_TOKEN =
  createServiceToken<IrnrPipelineServiceContract>(
    "lyra.game.irnr-pipeline-service",
  );

/**
 * 游戏状态服务契约
 *
 * 供 inventory 等模块通过 service token 访问，
 * 避免直接导入 game 模块内部实现。
 */
export interface GameStateServiceContract {
  /** 获取角色信息 */
  getCharacter(characterId: string): Character | undefined;
  /** 获取所有角色 */
  getCharacters(): Character[];
  /** 更新角色属性（写入 Yjs） */
  updateAttribute(
    characterId: string,
    field: string,
    value: number | string | boolean,
  ): void;
  /** 添加 Tag（写入 Yjs） */
  addTag(characterId: string, tagId: string, metadata: TagMetadata): void;
  /** 移除 Tag（写入 Yjs） */
  removeTag(characterId: string, tagId: string): void;
  /** 构建用于引擎执行的 EntityAccessor（包含天赋和装备 shadow tags） */
  buildEntityAccessor(): EntityAccessor;
}

/**
 * Game 模块注册的 Direct Action Service token
 */
export const DIRECT_ACTION_SERVICE_TOKEN =
  createServiceToken<DirectActionServiceContract>(
    "lyra.game.direct-action-service",
  );

/**
 * Game 模块注册的 Game State Service token
 */
export const GAME_STATE_SERVICE_TOKEN =
  createServiceToken<GameStateServiceContract>("lyra.game.game-state-service");

/**
 * 物品查询服务 —— 提供物品和技能的只读查询能力
 *
 * 供 game 模块等通过 service token 访问，
 * 避免直接导入 inventory 模块的内部 store。
 */
export interface InventoryQueryServiceContract {
  /** 获取角色的物品列表 */
  getItems(characterId: string): ItemInstance[];
  /** 获取角色的技能列表 */
  getSkills(characterId: string): SkillInstance[];
  /** 获取角色已装备的物品 */
  getEquippedItems(characterId: string): ItemInstance[];
}

export const INVENTORY_QUERY_SERVICE_TOKEN =
  createServiceToken<InventoryQueryServiceContract>(
    "lyra.inventory.query-service",
  );
