/**
 * Save 模块命令定义
 *
 * 存档槽位管理命令，与 Chat 模块的会话管理分离
 */

import type { CharacterCreationData } from "@/domain/entities/character";

/**
 * Save 命令类型常量
 */
export const SaveCommands = {
  // 存档槽位命令
  CREATE_SAVE: "save.create_save",
  LOAD_SAVE: "save.load_save",
  DELETE_SAVE: "save.delete_save",
  RENAME_SAVE: "save.rename_save",
} as const;

/**
 * Save 命令类型
 */
export type SaveCommandType = (typeof SaveCommands)[keyof typeof SaveCommands];

// ============ 命令 Payload 类型 ============

/**
 * 创建存档命令 Payload
 */
export interface CreateSavePayload {
  name: string;
  /** 显式选择的作者态世界 ID */
  worldId: string;
  /** 单机模式：初始角色数据（存档创建时一并写入） */
  initialCharacter?: CharacterCreationData;
}

/**
 * 加载存档命令 Payload
 */
export interface LoadSavePayload {
  saveId: string;
}

/**
 * 删除存档命令 Payload
 */
export interface DeleteSavePayload {
  saveId: string;
}

/**
 * 重命名存档命令 Payload
 */
export interface RenameSavePayload {
  saveId: string;
  name: string;
}

// ============ 命令类型映射 ============

/**
 * Save 命令 Payload 映射
 */
export interface SaveCommandPayloads {
  [SaveCommands.CREATE_SAVE]: CreateSavePayload;
  [SaveCommands.LOAD_SAVE]: LoadSavePayload;
  [SaveCommands.DELETE_SAVE]: DeleteSavePayload;
  [SaveCommands.RENAME_SAVE]: RenameSavePayload;
}
