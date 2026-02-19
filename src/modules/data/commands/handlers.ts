/**
 * 数据管理命令处理器
 *
 * 处理导出/导入相关的命令
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
  ExportAllPayload,
  ExportSavePayload,
  ImportDataPayload,
} from "@/domain/commands/data";
import { DataCommands } from "@/domain/commands/data";
import { DataEvents } from "@/domain/events/data";
import {
  downloadAsJson,
  exportAllSaves,
  exportSingleSave,
  generateFilename,
} from "../utils/export";
import { importData } from "../utils/import";

/**
 * 导出单个存档处理器
 */
const exportSaveHandler: CommandHandler<ExportSavePayload, void> = async (
  command: Command<ExportSavePayload>,
  context: CommandContext
): Promise<CommandResult<void>> => {
  const { saveId } = command.payload;

  try {
    // 获取存档信息
    const saves = yjsManager.listSaves();
    const saveInfo = saves.find((s) => s.id === saveId);

    if (!saveInfo) {
      return { success: false, error: `存档不存在: ${saveId}` };
    }

    // 导出存档
    const exportData = exportSingleSave(saveId);

    if (!exportData) {
      return { success: false, error: "导出存档失败" };
    }

    // 生成文件名并下载
    const filename = generateFilename("single_save", saveInfo.name);
    downloadAsJson(exportData, filename);

    // 发布事件
    eventBus.emit(
      eventBus.createEvent(DataEvents.SAVE_EXPORTED, {
        saveId,
        saveName: saveInfo.name,
        filename,
      }),
      { correlationId: context.commandId }
    );

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "导出失败",
    };
  }
};

/**
 * 导出全部数据处理器
 */
const exportAllHandler: CommandHandler<ExportAllPayload, void> = async (
  _command: Command<ExportAllPayload>,
  context: CommandContext
): Promise<CommandResult<void>> => {
  try {
    // 导出全部存档
    const exportData = exportAllSaves();

    // 生成文件名并下载
    const filename = generateFilename("full_backup");
    downloadAsJson(exportData, filename);

    // 发布事件
    eventBus.emit(
      eventBus.createEvent(DataEvents.ALL_EXPORTED, {
        saveCount: exportData.saves.length,
        filename,
      }),
      { correlationId: context.commandId }
    );

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "导出失败",
    };
  }
};

/**
 * 导入数据处理器
 */
const importDataHandler: CommandHandler<
  ImportDataPayload,
  Record<string, string>
> = async (
  command: Command<ImportDataPayload>,
  context: CommandContext
): Promise<CommandResult<Record<string, string>>> => {
  const { data } = command.payload;

  try {
    // 执行导入
    const result = importData(data);

    if (!result.success || !result.saveIdMap) {
      // 发布失败事件
      eventBus.emit(
        eventBus.createEvent(DataEvents.IMPORT_FAILED, {
          error: result.error || "导入失败",
        }),
        { correlationId: context.commandId }
      );

      return {
        success: false,
        error: result.error || "导入失败",
      };
    }

    // 发布成功事件
    eventBus.emit(
      eventBus.createEvent(DataEvents.DATA_IMPORTED, {
        saveIdMap: result.saveIdMap,
        saveCount: Object.keys(result.saveIdMap).length,
      }),
      { correlationId: context.commandId }
    );

    return { success: true, data: result.saveIdMap };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "导入失败";

    // 发布失败事件
    eventBus.emit(
      eventBus.createEvent(DataEvents.IMPORT_FAILED, {
        error: errorMessage,
      }),
      { correlationId: context.commandId }
    );

    return {
      success: false,
      error: errorMessage,
    };
  }
};

/**
 * 创建所有命令处理器
 */
export function createDataCommandHandlers(): Record<
  string,
  CommandHandler<unknown, unknown>
> {
  return {
    [DataCommands.EXPORT_SAVE]: exportSaveHandler as CommandHandler<
      unknown,
      unknown
    >,
    [DataCommands.EXPORT_ALL]: exportAllHandler as CommandHandler<
      unknown,
      unknown
    >,
    [DataCommands.IMPORT_DATA]: importDataHandler as CommandHandler<
      unknown,
      unknown
    >,
  };
}
