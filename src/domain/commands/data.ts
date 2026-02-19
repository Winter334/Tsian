/**
 * 数据管理命令定义
 *
 * 用于导出/导入功能的命令
 */

import type { ExportData } from "@/domain/entities/export-data";

/**
 * 数据管理命令类型
 */
export const DataCommands = {
  /** 导出单个存档 */
  EXPORT_SAVE: "data.export_save",
  /** 导出全部数据 */
  EXPORT_ALL: "data.export_all",
  /** 导入数据 */
  IMPORT_DATA: "data.import_data",
} as const;

export type DataCommandType = (typeof DataCommands)[keyof typeof DataCommands];

/**
 * 导出单个存档命令 Payload
 */
export interface ExportSavePayload {
  saveId: string;
}

/**
 * 导出全部数据命令 Payload
 */
export type ExportAllPayload = Record<string, never>;

/**
 * 导入数据命令 Payload
 */
export interface ImportDataPayload {
  data: ExportData;
}
