/**
 * 数据管理事件定义
 *
 * 用于导出/导入功能的事件
 */

/**
 * 数据管理事件类型
 */
export const DataEvents = {
  /** 存档导出完成 */
  SAVE_EXPORTED: "data.save_exported",
  /** 全部数据导出完成 */
  ALL_EXPORTED: "data.all_exported",
  /** 数据导入完成 */
  DATA_IMPORTED: "data.data_imported",
  /** 导入失败 */
  IMPORT_FAILED: "data.import_failed",
} as const;

export type DataEventType = (typeof DataEvents)[keyof typeof DataEvents];

/**
 * 存档导出完成事件 Payload
 */
export interface SaveExportedPayload {
  saveId: string;
  saveName: string;
  filename: string;
}

/**
 * 全部数据导出完成事件 Payload
 */
export interface AllExportedPayload {
  saveCount: number;
  filename: string;
}

/**
 * 数据导入完成事件 Payload
 */
export interface DataImportedPayload {
  /** 导入的存档 ID 映射（原 ID -> 新 ID） */
  saveIdMap: Record<string, string>;
  /** 导入的存档数量 */
  saveCount: number;
}

/**
 * 导入失败事件 Payload
 */
export interface ImportFailedPayload {
  error: string;
}
