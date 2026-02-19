/**
 * Save 命令处理器
 *
 * 存档槽位管理的命令处理器
 * 负责创建、加载、删除、重命名存档槽位
 */

import { eventBus } from "@/core";
import type {
  Command,
  CommandContext,
  CommandHandler,
  CommandResult,
} from "@/core/command-bus";
import { yjsManager } from "@/core/yjs";
import type {
  CreateSavePayload,
  DeleteSavePayload,
  LoadSavePayload,
  RenameSavePayload,
} from "@/domain/commands/save";
import { SaveCommands } from "@/domain/commands/save";
import { createCharacter } from "@/domain/entities/character";
import { SaveEvents } from "@/domain/events/save";
import { getOrCreateUserId, getUniqueTag } from "@/lib/user-identity";
import { characterToYMap } from "@/modules/game/repository";
import * as Y from "yjs";

/**
 * 创建存档处理器
 *
 * 创建新的存档槽位并自动加载
 * 通过事件通知其他模块（如 Chat）进行初始化
 */
const createSaveHandler: CommandHandler<CreateSavePayload, string> = async (
  command: Command<CreateSavePayload>,
  context: CommandContext
): Promise<CommandResult<string>> => {
  const { name, initialCharacter } = command.payload;

  try {
    // 1. 获取之前的存档 ID
    const previousSaveId = yjsManager.getCurrentSaveId();

    // 2. 创建存档槽位（默认为 solo 类型）
    const saveId = yjsManager.createSave({ name });

    // 3. 加载新创建的存档
    yjsManager.loadSave(saveId);

    // 4. 写入初始角色数据（单机模式）
    if (initialCharacter) {
      const save = yjsManager.getCurrentSave();
      if (save) {
        const userId = getOrCreateUserId();
        const uniqueTag = getUniqueTag() || "solo-player";

        const character = createCharacter({
          name: initialCharacter.name,
          controlType: "player",
          description: initialCharacter.description,
          personality: initialCharacter.personality,
          appearance: initialCharacter.appearance,
          creatorUniqueTag: uniqueTag,
          operatorUserId: userId,
          operatorUniqueTag: uniqueTag,
          // Phase 2 角色创建字段
          dimensionSelections: initialCharacter.dimensionSelections,
          talentIds: initialCharacter.talentIds,
          attributes: initialCharacter.attributes,
        });

        // 写入 characters Map（统一使用 Y.Map<Y.Map<unknown>>）
        const existingMap = save.get("characters") as
          | Y.Map<Y.Map<unknown>>
          | undefined;
        const charMap = characterToYMap(character);
        if (existingMap) {
          existingMap.set(character.id, charMap);
        } else {
          const newMap = new Y.Map<Y.Map<unknown>>();
          newMap.set(character.id, charMap);
          save.set("characters", newMap);
        }
      }
    }

    // 5. 发布 SAVE_CREATED 事件（Chat 模块监听此事件进行初始化）
    eventBus.emit(
      eventBus.createEvent(SaveEvents.SAVE_CREATED, { saveId, name }),
      { correlationId: context.commandId }
    );

    // 6. 发布 SAVE_LOADED 事件（Room 模块监听此事件重置房间状态）
    // 新创建的存档默认是 solo 类型
    eventBus.emit(
      eventBus.createEvent(SaveEvents.SAVE_LOADED, {
        saveId,
        previousSaveId,
        saveType: "solo",
      }),
      { correlationId: context.commandId }
    );

    return { success: true, data: saveId };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create save",
    };
  }
};

/**
 * 加载存档处理器
 *
 * 切换到指定的存档槽位
 * 通过事件通知其他模块（如 Chat）进行状态切换
 */
const loadSaveHandler: CommandHandler<LoadSavePayload, void> = async (
  command: Command<LoadSavePayload>,
  context: CommandContext
): Promise<CommandResult<void>> => {
  const { saveId } = command.payload;

  try {
    // 1. 获取之前的存档 ID
    const previousSaveId = yjsManager.getCurrentSaveId();

    // 2. 获取存档类型（在加载前获取，因为加载后可能会改变当前存档）
    const saveType = yjsManager.getSaveType(saveId);

    // 3. 加载存档
    yjsManager.loadSave(saveId);

    // 4. 发布事件（Chat 模块监听此事件进行状态重置，Room 模块监听此事件重置房间状态）
    eventBus.emit(
      eventBus.createEvent(SaveEvents.SAVE_LOADED, {
        saveId,
        previousSaveId,
        saveType,
      }),
      { correlationId: context.commandId }
    );

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to load save",
    };
  }
};

/**
 * 删除存档处理器
 *
 * 删除指定的存档槽位
 * 通过事件通知其他模块（如 Chat）进行清理
 */
const deleteSaveHandler: CommandHandler<DeleteSavePayload, void> = async (
  command: Command<DeleteSavePayload>,
  context: CommandContext
): Promise<CommandResult<void>> => {
  const { saveId } = command.payload;

  try {
    // 1. 在删除前获取必要信息
    const currentSaveId = yjsManager.getCurrentSaveId();
    const isCurrentSave = currentSaveId === saveId;
    const saves = yjsManager.listSaves();
    const saveInfo = saves.find((s) => s.id === saveId);
    const saveName = saveInfo?.name || "未命名存档";

    // 2. 删除存档
    yjsManager.deleteSave(saveId);

    // 3. 发布事件（Chat 模块监听此事件进行清理）
    eventBus.emit(
      eventBus.createEvent(SaveEvents.SAVE_DELETED, {
        saveId,
        saveName,
        isCurrentSave,
      }),
      { correlationId: context.commandId }
    );

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete save",
    };
  }
};

/**
 * 重命名存档处理器
 */
const renameSaveHandler: CommandHandler<RenameSavePayload, void> = async (
  command: Command<RenameSavePayload>,
  context: CommandContext
): Promise<CommandResult<void>> => {
  const { saveId, name } = command.payload;

  try {
    // 1. 获取旧名称（用于事件）
    const saves = yjsManager.listSaves();
    const saveInfo = saves.find((s) => s.id === saveId);
    const oldName = saveInfo?.name || "未命名存档";

    // 2. 通过 yjsManager 重命名存档
    yjsManager.renameSave(saveId, name);

    // 3. 发布事件
    eventBus.emit(
      eventBus.createEvent(SaveEvents.SAVE_RENAMED, {
        saveId,
        oldName,
        newName: name,
      }),
      { correlationId: context.commandId }
    );

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to rename save",
    };
  }
};

/**
 * 创建所有命令处理器
 */
export function createSaveCommandHandlers(): Record<
  string,
  CommandHandler<unknown, unknown>
> {
  return {
    [SaveCommands.CREATE_SAVE]: createSaveHandler as CommandHandler<
      unknown,
      unknown
    >,
    [SaveCommands.LOAD_SAVE]: loadSaveHandler as CommandHandler<
      unknown,
      unknown
    >,
    [SaveCommands.DELETE_SAVE]: deleteSaveHandler as CommandHandler<
      unknown,
      unknown
    >,
    [SaveCommands.RENAME_SAVE]: renameSaveHandler as CommandHandler<
      unknown,
      unknown
    >,
  };
}
