/**
 * Yjs 初始化逻辑
 */

import {
  checkIndexedDBAvailability,
  detectStorageErrorType,
  type StorageErrorType,
} from "./error-utils";
import { yjsManager } from "./manager";

/**
 * 初始化结果
 */
export interface YjsInitResult {
  success: boolean;
  errorType?: StorageErrorType;
}

/**
 * 检查 IndexedDB 是否可用（简单检查，用于快速判断）
 */
export function isIndexedDBSupported(): boolean {
  try {
    return typeof indexedDB !== "undefined";
  } catch {
    return false;
  }
}

/**
 * 初始化 Yjs
 * 应在应用启动时调用
 * @returns 初始化结果，包含成功状态和可能的错误类型
 */
export async function initYjs(): Promise<YjsInitResult> {
  // 1. 深度检查 IndexedDB 可用性
  const availabilityError = await checkIndexedDBAvailability();
  if (availabilityError) {
    return { success: false, errorType: availabilityError };
  }

  try {
    // 2. 初始化 YjsManager
    await yjsManager.init({
      docName: "lyra-game",
      autoInit: true,
    });

    return { success: true };
  } catch (error) {
    const errorType = detectStorageErrorType(error);
    return { success: false, errorType };
  }
}

/**
 * 显示 IndexedDB 不支持的错误对话框（降级方案，用于 React 未加载时）
 * @deprecated 优先使用 StorageErrorDialog 组件
 */
export function showIndexedDBError(errorType?: StorageErrorType): void {
  const messages: Record<StorageErrorType, string> = {
    "indexeddb-not-supported":
      "浏览器不支持 IndexedDB\n\n" +
      "你的浏览器不支持 IndexedDB，无法保存游戏进度。\n" +
      "请使用 Chrome 89+ / Firefox 111+ / Safari 15.2+ 等现代浏览器。",
    "indexeddb-blocked":
      "存储访问被阻止\n\n" +
      "浏览器阻止了对本地存储的访问。\n" +
      "请检查浏览器设置，确保允许网站使用本地存储。",
    "indexeddb-quota-exceeded":
      "存储空间不足\n\n" +
      "本地存储空间已满，无法保存更多数据。\n" +
      "请清理浏览器缓存或删除不需要的存档。",
    "indexeddb-unknown":
      "存储初始化失败\n\n" +
      "初始化本地存储时发生未知错误。\n" +
      "请刷新页面重试。",
  };

  alert(messages[errorType || "indexeddb-unknown"]);
}
