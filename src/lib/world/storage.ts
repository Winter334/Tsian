/**
 * 作者态世界存储层
 *
 * 职责：
 * - 管理 IndexedDB 数据库（"lyra-worlds"）
 * - 管理 localStorage 索引和活动世界选择
 * - 提供作者态世界的 CRUD 接口
 */

import { settings } from "@/core/storage";

import type { World, WorldId } from "./types";

const DB_NAME = "lyra-worlds";
const DB_VERSION = 1;
const STORE_NAME = "worlds";

const STORAGE_KEYS = {
  WORLD_INDEX: "lyra.worlds.index",
  ACTIVE_WORLD_ID: "lyra.worlds.active",
} as const;

export interface WorldIndex {
  id: WorldId;
  name: string;
  source: World["meta"]["source"];
  updatedAt: number;
}

export interface WorldStorage {
  init(): Promise<void>;

  getWorldIndex(): WorldIndex[];
  updateWorldIndex(world: World): void;
  removeFromIndex(id: WorldId): void;

  getActiveWorldId(): WorldId | null;
  setActiveWorldId(id: WorldId | null): void;

  loadWorld(id: WorldId): Promise<World | null>;
  saveWorld(world: World): Promise<void>;
  deleteWorld(id: WorldId): Promise<void>;
  listAllWorlds(): Promise<World[]>;
}

class WorldStorageImpl implements WorldStorage {
  private dbInstance: IDBDatabase | null = null;

  async init(): Promise<void> {
    try {
      this.dbInstance = await this.openDatabase();
    } catch (error) {
      console.error("[WorldStorage] Init error:", error);
      throw error;
    }
  }

  private async openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
          store.createIndex("name", "meta.name", { unique: false });
          store.createIndex("source", "meta.source", { unique: false });
          store.createIndex("updatedAt", "meta.updatedAt", { unique: false });
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

  private async getDatabase(): Promise<IDBDatabase> {
    if (!this.dbInstance) {
      this.dbInstance = await this.openDatabase();
    }
    return this.dbInstance;
  }

  getWorldIndex(): WorldIndex[] {
    const raw = settings.get<Array<WorldIndex | Record<string, unknown>>>(
      STORAGE_KEYS.WORLD_INDEX,
      [],
    );

    return raw.map((item) => ({
      id: String((item as { id?: unknown }).id ?? ""),
      name: String((item as { name?: unknown }).name ?? ""),
      source:
        (item as { source?: unknown }).source === "custom" ? "custom" : "lyra",
      updatedAt: Number((item as { updatedAt?: unknown }).updatedAt ?? 0),
    }));
  }

  updateWorldIndex(world: World): void {
    const index = this.getWorldIndex();
    const existingIndex = index.findIndex((item) => item.id === world.id);

    const newEntry: WorldIndex = {
      id: world.id,
      name: world.meta.name,
      source: world.meta.source,
      updatedAt: world.meta.updatedAt,
    };

    if (existingIndex >= 0) {
      index[existingIndex] = newEntry;
    } else {
      index.push(newEntry);
    }

    settings.set(STORAGE_KEYS.WORLD_INDEX, index);
  }

  removeFromIndex(id: WorldId): void {
    const index = this.getWorldIndex();
    const filtered = index.filter((item) => item.id !== id);
    settings.set(STORAGE_KEYS.WORLD_INDEX, filtered);
  }

  getActiveWorldId(): WorldId | null {
    const raw = settings.get<string | null>(STORAGE_KEYS.ACTIVE_WORLD_ID, null);
    return typeof raw === "string" && raw.length > 0 ? raw : null;
  }

  setActiveWorldId(id: WorldId | null): void {
    settings.set(STORAGE_KEYS.ACTIVE_WORLD_ID, id);
  }

  async loadWorld(id: WorldId): Promise<World | null> {
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
      console.error("[WorldStorage] Load error:", error);
      return null;
    }
  }

  async saveWorld(world: World): Promise<void> {
    try {
      const db = await this.getDatabase();
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);

      return new Promise((resolve, reject) => {
        const request = store.put(world);

        request.onsuccess = () => {
          this.updateWorldIndex(world);
          resolve();
        };

        request.onerror = () => {
          reject(request.error);
        };
      });
    } catch (error) {
      console.error("[WorldStorage] Save error:", error);
      throw error;
    }
  }

  async deleteWorld(id: WorldId): Promise<void> {
    try {
      const db = await this.getDatabase();
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);

      return new Promise((resolve, reject) => {
        const request = store.delete(id);

        request.onsuccess = () => {
          this.removeFromIndex(id);
          resolve();
        };

        request.onerror = () => {
          reject(request.error);
        };
      });
    } catch (error) {
      console.error("[WorldStorage] Delete error:", error);
      throw error;
    }
  }

  async listAllWorlds(): Promise<World[]> {
    try {
      const db = await this.getDatabase();
      const transaction = db.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);

      return new Promise((resolve, reject) => {
        const request = store.getAll();

        request.onsuccess = () => {
          resolve((request.result as World[]) || []);
        };

        request.onerror = () => {
          reject(request.error);
        };
      });
    } catch (error) {
      console.error("[WorldStorage] List error:", error);
      return [];
    }
  }
}

export const worldStorage: WorldStorage = new WorldStorageImpl();
