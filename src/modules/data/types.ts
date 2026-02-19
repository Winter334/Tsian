/**
 * 数据管理模块类型定义
 *
 * 从领域层重新导出类型，保持向后兼容
 */

export {
  EXPORT_VERSION,
  type ExportData,
  type ExportedConversation,
  type ExportedMessage,
  type ExportedSave,
  type ExportType,
  type FullBackupExport,
  type ImportPreview,
  type ImportResult,
  type SingleSaveExport,
} from "@/domain/entities/export-data";
