/**
 * 导入工具函数
 *
 * 用于读取 JSON 文件并导入到 Yjs
 */

import { yjsManager } from "@/core/yjs";
import type {
  ExportData,
  ExportedSave,
  ImportPreview,
  ImportResult,
} from "../types";
import { validateExportData } from "./validation";

/**
 * 读取 JSON 文件
 */
export async function readJsonFile(file: File): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        resolve(json);
      } catch {
        reject(new Error("无效的 JSON 文件"));
      }
    };

    reader.onerror = () => reject(new Error("文件读取失败"));
    reader.readAsText(file);
  });
}

/**
 * 解析并验证导入文件
 */
export async function parseImportFile(
  file: File
): Promise<{ data: ExportData } | { error: string }> {
  try {
    const rawData = await readJsonFile(file);
    const validation = validateExportData(rawData);

    if (!validation.valid || !validation.data) {
      return { error: validation.error || "数据验证失败" };
    }

    return { data: validation.data };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "文件解析失败",
    };
  }
}

/**
 * 生成导入预览信息
 */
export function generateImportPreview(data: ExportData): ImportPreview {
  const saves = data.type === "single_save" ? [data.save] : data.saves;

  return {
    type: data.type,
    exportedAt: data.exportedAt,
    saveCount: saves.length,
    saves: saves.map((save) => {
      // 计算消息总数
      let messageCount = 0;
      for (const messages of Object.values(save.messages)) {
        messageCount += messages.length;
      }

      return {
        name: save.name,
        conversationCount: save.conversations.length,
        messageCount,
        updatedAt: save.updatedAt,
      };
    }),
  };
}

/**
 * 将 ExportedSave 转换为 yjsManager.importSave 所需的格式
 */
function convertToImportSaveData(save: ExportedSave) {
  return {
    name: save.name,
    originalId: save.id,
    conversations: save.conversations,
    messages: save.messages,
    gameState: save.gameState,
    // 角色数据（Phase 2 新增）
    characters: save.characters,
  };
}

/**
 * 执行数据导入
 *
 * 通过 yjsManager.importSave 方法导入存档数据
 */
export function importData(data: ExportData): ImportResult {
  try {
    const saves = data.type === "single_save" ? [data.save] : data.saves;
    const saveIdMap: Record<string, string> = {};

    for (const save of saves) {
      // 通过 yjsManager 导入存档
      const importData = convertToImportSaveData(save);
      const newSaveId = yjsManager.importSave(importData);
      saveIdMap[save.id] = newSaveId;
    }

    return {
      success: true,
      saveIdMap,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "导入失败",
    };
  }
}
