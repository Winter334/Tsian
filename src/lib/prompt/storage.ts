/**
 * 预设存储层
 *
 * 职责：
 * - 管理 IndexedDB 数据库（"lyra-presets"）
 * - 管理 localStorage 索引
 * - 提供 CRUD 接口
 */

import { settings } from "@/core/storage";
import type { Preset, PresetPurpose } from "./types";

// ===== 数据库配置 =====

const DB_NAME = "lyra-presets";
const DB_VERSION = 1;
const STORE_NAME = "presets";

// ===== localStorage 键 =====

const STORAGE_KEYS = {
  PRESET_INDEX: "lyra.presets.index",
  ACTIVE_PRESET_BY_PURPOSE: "lyra.presets.activeByPurpose",
} as const;

// ===== 类型定义 =====

/**
 * 预设索引（localStorage 中的轻量级数据）
 */
export interface PresetIndex {
  id: string;
  name: string;
  source: "lyra" | "tavern";
  purpose: PresetPurpose;
  updatedAt: number;
}

/**
 * 预设存储接口
 */
export interface PresetStorage {
  // 初始化数据库
  init(): Promise<void>;

  // 索引管理
  getPresetIndex(): PresetIndex[];
  updatePresetIndex(preset: Preset): void;
  removeFromIndex(id: string): void;

  // 激活预设（按用途）
  getActivePresetByPurpose(): Record<PresetPurpose, string | null>;
  setActivePresetByPurpose(value: Record<PresetPurpose, string | null>): void;
  setActivePresetForPurpose(purpose: PresetPurpose, id: string | null): void;

  // CRUD 操作
  loadPreset(id: string): Promise<Preset | null>;
  savePreset(preset: Preset): Promise<void>;
  deletePreset(id: string): Promise<void>;
  listAllPresets(): Promise<Preset[]>;
}

// ===== 实现 =====

/**
 * 预设存储实现
 */
class PresetStorageImpl implements PresetStorage {
  private dbInstance: IDBDatabase | null = null;

  /**
   * 初始化数据库
   */
  async init(): Promise<void> {
    try {
      this.dbInstance = await this.openDatabase();
    } catch (error) {
      console.error("[PresetStorage] Init error:", error);
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
          store.createIndex("source", "metadata.source", { unique: false });
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
   * 获取预设索引列表
   */
  getPresetIndex(): PresetIndex[] {
    const raw = settings.get<Array<PresetIndex | Record<string, unknown>>>(
      STORAGE_KEYS.PRESET_INDEX,
      [],
    );

    return raw.map((item) => {
      const purposeRaw =
        typeof item === "object" && item && "purpose" in item
          ? (item as { purpose?: unknown }).purpose
          : undefined;

      const purpose: PresetPurpose =
        purposeRaw === "parser" ||
        purposeRaw === "narrative" ||
        purposeRaw === "summarizer" ||
        purposeRaw === "director"
          ? purposeRaw
          : "narrative";

      return {
        id: String((item as { id?: unknown }).id ?? ""),
        name: String((item as { name?: unknown }).name ?? ""),
        source:
          (item as { source?: unknown }).source === "tavern"
            ? "tavern"
            : "lyra",
        purpose,
        updatedAt: Number((item as { updatedAt?: unknown }).updatedAt ?? 0),
      };
    });
  }

  /**
   * 更新预设索引
   */
  updatePresetIndex(preset: Preset): void {
    const index = this.getPresetIndex();
    const existingIndex = index.findIndex((p) => p.id === preset.id);

    const newEntry: PresetIndex = {
      id: preset.id,
      name: preset.name,
      source: preset.metadata.source,
      purpose: preset.purpose ?? "narrative",
      updatedAt: preset.metadata.updatedAt,
    };

    if (existingIndex >= 0) {
      // 更新现有条目
      index[existingIndex] = newEntry;
    } else {
      // 添加新条目
      index.push(newEntry);
    }

    settings.set(STORAGE_KEYS.PRESET_INDEX, index);
  }

  /**
   * 从索引中移除预设
   */
  removeFromIndex(id: string): void {
    const index = this.getPresetIndex();
    const filteredIndex = index.filter((p) => p.id !== id);
    settings.set(STORAGE_KEYS.PRESET_INDEX, filteredIndex);
  }

  // ===== 激活预设管理 =====

  /**
   * 获取当前按用途激活的预设 ID
   */
  getActivePresetByPurpose(): Record<PresetPurpose, string | null> {
    return settings.get<Record<PresetPurpose, string | null>>(
      STORAGE_KEYS.ACTIVE_PRESET_BY_PURPOSE,
      {
        narrative: null,
        parser: null,
        summarizer: null,
        director: null,
      },
    );
  }

  /**
   * 设置按用途激活的预设
   */
  setActivePresetByPurpose(value: Record<PresetPurpose, string | null>): void {
    settings.set(STORAGE_KEYS.ACTIVE_PRESET_BY_PURPOSE, value);
  }

  /**
   * 设置某个用途激活的预设
   */
  setActivePresetForPurpose(purpose: PresetPurpose, id: string | null): void {
    const current = this.getActivePresetByPurpose();
    this.setActivePresetByPurpose({
      ...current,
      [purpose]: id,
    });
  }

  // ===== CRUD 操作 =====

  /**
   * 加载预设
   */
  async loadPreset(id: string): Promise<Preset | null> {
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
      console.error("[PresetStorage] Load error:", error);
      return null;
    }
  }

  /**
   * 保存预设
   */
  async savePreset(preset: Preset): Promise<void> {
    try {
      const db = await this.getDatabase();
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);

      return new Promise((resolve, reject) => {
        const request = store.put(preset);

        request.onsuccess = () => {
          // 同步更新索引
          this.updatePresetIndex(preset);
          resolve();
        };

        request.onerror = () => {
          reject(request.error);
        };
      });
    } catch (error) {
      console.error("[PresetStorage] Save error:", error);
      throw error;
    }
  }

  /**
   * 删除预设
   */
  async deletePreset(id: string): Promise<void> {
    try {
      const db = await this.getDatabase();
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);

      return new Promise((resolve, reject) => {
        const request = store.delete(id);

        request.onsuccess = () => {
          // 同步更新索引
          this.removeFromIndex(id);

          // 如果删除的是任一用途激活预设，清除对应激活状态
          const activeByPurpose = this.getActivePresetByPurpose();
          let changed = false;
          const nextActive = { ...activeByPurpose };

          (["narrative", "parser", "summarizer", "director"] as const).forEach(
            (purpose) => {
              if (nextActive[purpose] === id) {
                nextActive[purpose] = null;
                changed = true;
              }
            },
          );

          if (changed) {
            this.setActivePresetByPurpose(nextActive);
          }

          resolve();
        };

        request.onerror = () => {
          reject(request.error);
        };
      });
    } catch (error) {
      console.error("[PresetStorage] Delete error:", error);
      throw error;
    }
  }

  /**
   * 列出所有预设
   */
  async listAllPresets(): Promise<Preset[]> {
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
      console.error("[PresetStorage] List error:", error);
      return [];
    }
  }
}

// ===== 导出单例 =====

/**
 * 预设存储单例
 */
export const presetStorage: PresetStorage = new PresetStorageImpl();
