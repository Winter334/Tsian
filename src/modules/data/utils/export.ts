/**
 * 导出工具函数
 *
 * 用于从 Yjs 提取数据并导出为 JSON 文件
 */

import { yjsManager } from "@/core/yjs";
import {
  EXPORT_VERSION,
  type ExportData,
  type ExportedSave,
  type ExportType,
  type FullBackupExport,
  type SingleSaveExport,
} from "../types";

/**
 * 下载 JSON 文件
 */
export function downloadAsJson(data: ExportData, filename: string): void {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();

  URL.revokeObjectURL(url);
}

/**
 * 生成导出文件名
 */
export function generateFilename(type: ExportType, saveName?: string): string {
  const date = new Date().toISOString().slice(0, 10);

  if (type === "single_save" && saveName) {
    // 清理文件名中的非法字符
    const cleanName = saveName.replace(/[<>:"/\\|?*]/g, "_");
    return `lyra-save-${cleanName}-${date}.json`;
  }

  return `lyra-backup-${date}.json`;
}

/**
 * 从 Yjs 提取单个存档数据
 *
 * 通过 yjsManager.exportSave 方法提取存档数据
 */
export function extractSaveData(saveId: string): ExportedSave | null {
  const exportData = yjsManager.exportSave(saveId);

  if (!exportData) return null;

  // 转换为 ExportedSave 格式（确保 metadata 默认为空对象）
  return {
    id: exportData.id,
    name: exportData.name,
    createdAt: exportData.createdAt,
    updatedAt: exportData.updatedAt,
    conversations: exportData.conversations.map((conv) => ({
      ...conv,
      metadata: conv.metadata || {},
    })),
    messages: Object.fromEntries(
      Object.entries(exportData.messages).map(([convId, msgs]) => [
        convId,
        msgs.map((msg) => ({
          ...msg,
          metadata: msg.metadata || {},
        })),
      ]),
    ),
    gameState: exportData.gameState,
    worldConfig: exportData.worldConfig,
    // 角色数据（Phase 2 新增）
    characters: exportData.characters,
  };
}

/**
 * 导出单个存档
 */
export function exportSingleSave(saveId: string): SingleSaveExport | null {
  const save = extractSaveData(saveId);

  if (!save) return null;

  return {
    version: EXPORT_VERSION,
    exportedAt: Date.now(),
    type: "single_save",
    save,
  };
}

/**
 * 导出全部存档
 */
export function exportAllSaves(): FullBackupExport {
  const saveInfos = yjsManager.listSaves();
  const saves: ExportedSave[] = [];

  for (const info of saveInfos) {
    const save = extractSaveData(info.id);
    if (save) {
      saves.push(save);
    }
  }

  return {
    version: EXPORT_VERSION,
    exportedAt: Date.now(),
    type: "full_backup",
    saves,
  };
}
