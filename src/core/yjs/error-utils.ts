/**
 * IndexedDB 错误检测工具函数
 */

export type StorageErrorType =
  | "indexeddb-not-supported"
  | "indexeddb-blocked"
  | "indexeddb-quota-exceeded"
  | "indexeddb-unknown";

/**
 * 检测 IndexedDB 错误类型
 */
export function detectStorageErrorType(error: unknown): StorageErrorType {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    const name = error.name.toLowerCase();

    // 配额超限
    if (
      name === "quotaexceedederror" ||
      message.includes("quota") ||
      message.includes("storage")
    ) {
      return "indexeddb-quota-exceeded";
    }

    // 访问被阻止
    if (
      name === "securityerror" ||
      message.includes("blocked") ||
      message.includes("denied") ||
      message.includes("security")
    ) {
      return "indexeddb-blocked";
    }
  }

  return "indexeddb-unknown";
}

/**
 * 检测 IndexedDB 是否真正可用（不仅仅是 API 存在）
 * 返回 null 表示可用，否则返回错误类型
 */
export async function checkIndexedDBAvailability(): Promise<StorageErrorType | null> {
  // 1. 检查 API 是否存在
  if (typeof indexedDB === "undefined") {
    return "indexeddb-not-supported";
  }

  // 2. 尝试打开一个测试数据库
  try {
    const testDbName = "__lyra_idb_test__";

    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(testDbName, 1);

      request.onerror = () => {
        reject(request.error);
      };

      request.onsuccess = () => {
        // 成功打开，关闭并删除测试数据库
        request.result.close();
        const deleteRequest = indexedDB.deleteDatabase(testDbName);
        deleteRequest.onsuccess = () => resolve();
        deleteRequest.onerror = () => resolve(); // 删除失败也算成功
      };

      request.onblocked = () => {
        reject(new Error("IndexedDB blocked"));
      };
    });

    return null; // 可用
  } catch (error) {
    return detectStorageErrorType(error);
  }
}
