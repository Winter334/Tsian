/**
 * 世界书存储层
 *
 * 职责：
 * - 管理 IndexedDB 数据库（"lyra-lorebooks"）
 * - 管理 localStorage 索引和激活状态
 * - 提供 CRUD 接口
 *
 * 与预设存储层（src/lib/prompt/storage.ts）采用相同的架构模式：
 * - IndexedDB 存储完整数据
 * - localStorage 存储轻量级索引，用快速列表展示
 */

import { settings } from "@/core/storage";
import type { Lorebook } from "./types";

// ===== 数据库配置 =====

const DB_NAME = "lyra-lorebooks";
const DB_VERSION = 1;
const STORE_NAME = "lorebooks";

// ===== localStorage 键 =====

const STORAGE_KEYS = {
  /** 世界书索引列表 */
  LOREBOOK_INDEX: "lyra.lorebooks.index",
  /** 当前激活的世界书 ID 列表 */
  ACTIVE_LOREBOOK_IDS: "lyra.lorebooks.active",
} as const;

// ===== 类型定义 =====

/**
 * 世界书索引（localStorage 中的轻量级数据）
 */
export interface LorebookIndex {
  id: string;
  name: string;
  entryCount: number;
  updatedAt: number;
}

/**
 * 世界书存储接口
 */
export interface LorebookStorage {
  // 初始化数据库
  init(): Promise<void>;

  // 索引管理
  getLorebookIndex(): LorebookIndex[];
  updateLorebookIndex(lorebook: Lorebook): void;
  removeFromIndex(id: string): void;

  // 激活状态管理
  getActiveLorebookIds(): string[];
  setActiveLorebookIds(ids: string[]): void;

  // CRUD 操作
  loadLorebook(id: string): Promise<Lorebook | null>;
  saveLorebook(lorebook: Lorebook): Promise<void>;
  deleteLorebook(id: string): Promise<void>;
  listAllLorebooks(): Promise<Lorebook[]>;
}

// ===== 实现 =====

/**
 * 世界书存储实现
 */
class LorebookStorageImpl implements LorebookStorage {
  private dbInstance: IDBDatabase | null = null;

  /**
   * 初始化数据库
   */
  async init(): Promise<void> {
    try {
      this.dbInstance = await this.openDatabase();
    } catch (error) {
      console.error("[LorebookStorage] Init error:", error);
      throw error;
    }
  }

  /**
   * 打开 IndexedDB 数据库
   */
  private async openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // 创建 Object Store
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });

          // 创建索引
          store.createIndex("name", "name", { unique: false });
          store.createIndex("updatedAt", "metadata.updatedAt", {
            unique: false,
          });
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(request.error);
      };

      request.onblocked = () => {
        reject(new Error("Database open blocked"));
      };
    });
  }

  /**
   * 获取数据库实例（惰性初始化）
   */
  private async getDatabase(): Promise<IDBDatabase> {
    if (!this.dbInstance) {
      this.dbInstance = await this.openDatabase();
    }
    return this.dbInstance;
  }

  // ===== 索引管理 =====

  /**
   * 获取世界书索引列表
   */
  getLorebookIndex(): LorebookIndex[] {
    return settings.get<LorebookIndex[]>(STORAGE_KEYS.LOREBOOK_INDEX, []);
  }

  /**
   * 更新世界书索引
   */
  updateLorebookIndex(lorebook: Lorebook): void {
    const index = this.getLorebookIndex();
    const existingIndex = index.findIndex((l) => l.id === lorebook.id);

    const newEntry: LorebookIndex = {
      id: lorebook.id,
      name: lorebook.name,
      entryCount: lorebook.entries.length,
      updatedAt: lorebook.metadata.updatedAt,
    };

    if (existingIndex >= 0) {
      index[existingIndex] = newEntry;
    } else {
      index.push(newEntry);
    }

    settings.set(STORAGE_KEYS.LOREBOOK_INDEX, index);
  }

  /**
   * 从索引中移除世界书
   */
  removeFromIndex(id: string): void {
    const index = this.getLorebookIndex();
    const filteredIndex = index.filter((l) => l.id !== id);
    settings.set(STORAGE_KEYS.LOREBOOK_INDEX, filteredIndex);
  }

  // ===== 激活状态管理 =====

  /**
   * 获取当前激活的世界书 ID 列表
   */
  getActiveLorebookIds(): string[] {
    return settings.get<string[]>(STORAGE_KEYS.ACTIVE_LOREBOOK_IDS, []);
  }

  /**
   * 设置当前激活的世界书 ID 列表
   */
  setActiveLorebookIds(ids: string[]): void {
    settings.set(STORAGE_KEYS.ACTIVE_LOREBOOK_IDS, ids);
  }

  // ===== CRUD 操作 =====

  /**
   * 加载世界书
   */
  async loadLorebook(id: string): Promise<Lorebook | null> {
    try {
      const db = await this.getDatabase();
      const transaction = db.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);

      return new Promise((resolve, reject) => {
        const request = store.get(id);

        request.onsuccess = () => {
          resolve(request.result || null);
        };

        request.onerror = () => {
          reject(request.error);
        };
      });
    } catch (error) {
      console.error("[LorebookStorage] Load error:", error);
      return null;
    }
  }

  /**
   * 保存世界书
   */
  async saveLorebook(lorebook: Lorebook): Promise<void> {
    try {
      const db = await this.getDatabase();
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);

      return new Promise((resolve, reject) => {
        const request = store.put(lorebook);

        request.onsuccess = () => {
          // 同步更新索引
          this.updateLorebookIndex(lorebook);
          resolve();
        };

        request.onerror = () => {
          reject(request.error);
        };
      });
    } catch (error) {
      console.error("[LorebookStorage] Save error:", error);
      throw error;
    }
  }

  /**
   * 删除世界书
   */
  async deleteLorebook(id: string): Promise<void> {
    try {
      const db = await this.getDatabase();
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);

      return new Promise((resolve, reject) => {
        const request = store.delete(id);

        request.onsuccess = () => {
          // 同步更新索引
          this.removeFromIndex(id);

          // 从激活列表中移除
          const activeIds = this.getActiveLorebookIds();
          if (activeIds.includes(id)) {
            this.setActiveLorebookIds(activeIds.filter((aid) => aid !== id));
          }

          resolve();
        };

        request.onerror = () => {
          reject(request.error);
        };
      });
    } catch (error) {
      console.error("[LorebookStorage] Delete error:", error);
      throw error;
    }
  }

  /**
   * 列出所有世界书
   */
  async listAllLorebooks(): Promise<Lorebook[]> {
    try {
      const db = await this.getDatabase();
      const transaction = db.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);

      return new Promise((resolve, reject) => {
        const request = store.getAll();

        request.onsuccess = () => {
          resolve(request.result || []);
        };

        request.onerror = () => {
          reject(request.error);
        };
      });
    } catch (error) {
      console.error("[LorebookStorage] List error:", error);
      return [];
    }
  }
}

// ===== 导出单例 =====

/**
 * 世界书存储单例
 */
export const lorebookStorage: LorebookStorage = new LorebookStorageImpl();
