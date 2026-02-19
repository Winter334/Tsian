/**
 * 存储层抽象
 *
 * 存储方案：
 * - localStorage: 用户设置、API Key（小数据）
 * - IndexedDB (y-indexeddb): Yjs 文档、游戏状态
 * - OPFS: 图片、大文件
 */

// ============ localStorage 封装 ============

export const settings = {
  get<T>(key: string, defaultValue: T): T {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : defaultValue;
    } catch {
      return defaultValue;
    }
  },

  set<T>(key: string, value: T): void {
    localStorage.setItem(key, JSON.stringify(value));
  },

  remove(key: string): void {
    localStorage.removeItem(key);
  },
};

// ============ OPFS 封装 ============

/**
 * OPFS 文件操作（用于大文件存储）
 */
export const opfs = {
  /**
   * 检查 OPFS 是否可用
   */
  isSupported(): boolean {
    return "storage" in navigator && "getDirectory" in navigator.storage;
  },

  /**
   * 获取根目录
   */
  async getRoot(): Promise<FileSystemDirectoryHandle | null> {
    if (!this.isSupported()) return null;
    return navigator.storage.getDirectory();
  },

  /**
   * 写入文件
   */
  async writeFile(
    path: string,
    data: Blob | ArrayBuffer | string
  ): Promise<boolean> {
    try {
      const root = await this.getRoot();
      if (!root) return false;

      const fileHandle = await root.getFileHandle(path, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(data);
      await writable.close();
      return true;
    } catch (error) {
      console.error("[OPFS] Write error:", error);
      return false;
    }
  },

  /**
   * 读取文件
   */
  async readFile(path: string): Promise<File | null> {
    try {
      const root = await this.getRoot();
      if (!root) return null;

      const fileHandle = await root.getFileHandle(path);
      return fileHandle.getFile();
    } catch {
      return null;
    }
  },

  /**
   * 删除文件
   */
  async deleteFile(path: string): Promise<boolean> {
    try {
      const root = await this.getRoot();
      if (!root) return false;

      await root.removeEntry(path);
      return true;
    } catch {
      return false;
    }
  },
};

// ============ 存储配额检测 ============

export async function checkStorageQuota(): Promise<{
  usage: number;
  quota: number;
  percentUsed: number;
} | null> {
  if (!navigator.storage?.estimate) return null;

  try {
    const estimate = await navigator.storage.estimate();
    const usage = estimate.usage ?? 0;
    const quota = estimate.quota ?? 0;
    return {
      usage,
      quota,
      percentUsed: quota > 0 ? (usage / quota) * 100 : 0,
    };
  } catch {
    return null;
  }
}
