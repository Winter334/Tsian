/**
 * Memory Repository - 封装记忆系统的 Yjs 操作
 *
 * 职责：
 * 1. 封装记忆相关的 Yjs 文档读写
 * 2. 提供类型安全的数据访问接口
 * 3. 管理按 conversationId 分组的记忆数据
 */

import { yjsManager } from "@/core/yjs";
import type {
  ManualMemory,
  MegaSummary,
  MiniSummary,
} from "@/domain/entities/memory";
import * as Y from "yjs";

/**
 * 添加小总结参数
 */
export interface AddMiniSummaryData {
  messageId: string;
  messageIndex: number;
  content: string;
}

/**
 * 添加手动记忆参数
 */
export interface AddManualMemoryData {
  sourceContent: string;
  summary: string;
  tags: string[];
  sourceMessageId?: string;
}

/**
 * Memory Repository 类
 */
export class MemoryRepository {
  private memoryMap: Y.Map<unknown>;

  constructor(private saveDoc: Y.Map<unknown>) {
    this.memoryMap = this.ensureStructure();
  }

  // ============ 私有辅助方法 ============

  /**
   * 确保存档中的 memory 结构存在
   *
   * 结构：
   * memory:
   *   - miniSummaries: Y.Map<Y.Array<MiniSummary>>
   *   - megaSummaries: Y.Map<Y.Array<MegaSummary>>
   *   - manualMemories: Y.Map<Y.Array<ManualMemory>>
   */
  private ensureStructure(): Y.Map<unknown> {
    let memoryMap = this.saveDoc.get("memory") as Y.Map<unknown> | undefined;
    if (!memoryMap) {
      memoryMap = new Y.Map<unknown>();
      this.saveDoc.set("memory", memoryMap);
    }

    if (!memoryMap.has("miniSummaries")) {
      memoryMap.set("miniSummaries", new Y.Map<Y.Array<MiniSummary>>());
    }
    if (!memoryMap.has("megaSummaries")) {
      memoryMap.set("megaSummaries", new Y.Map<Y.Array<MegaSummary>>());
    }
    if (!memoryMap.has("manualMemories")) {
      memoryMap.set("manualMemories", new Y.Map<Y.Array<ManualMemory>>());
    }

    return memoryMap;
  }

  /**
   * 获取 miniSummaries 分组 Map（按 conversationId）
   */
  private getMiniSummariesMap(): Y.Map<Y.Array<MiniSummary>> {
    return this.memoryMap.get("miniSummaries") as Y.Map<Y.Array<MiniSummary>>;
  }

  /**
   * 获取 megaSummaries 分组 Map（按 conversationId）
   */
  private getMegaSummariesMap(): Y.Map<Y.Array<MegaSummary>> {
    return this.memoryMap.get("megaSummaries") as Y.Map<Y.Array<MegaSummary>>;
  }

  /**
   * 获取 manualMemories 分组 Map（按 conversationId）
   */
  private getManualMemoriesMap(): Y.Map<Y.Array<ManualMemory>> {
    return this.memoryMap.get("manualMemories") as Y.Map<Y.Array<ManualMemory>>;
  }

  /**
   * 获取或创建会话的 Y.Array
   */
  private getOrCreateConversationArray<T>(
    groupedMap: Y.Map<Y.Array<T>>,
    conversationId: string,
  ): Y.Array<T> {
    let list = groupedMap.get(conversationId);
    if (!list) {
      list = new Y.Array<T>();
      groupedMap.set(conversationId, list);
    }
    return list;
  }

  // ============ 小总结 CRUD ============

  /**
   * 添加小总结
   */
  addMiniSummary(
    conversationId: string,
    data: AddMiniSummaryData,
  ): MiniSummary {
    const summary: MiniSummary = {
      id: crypto.randomUUID(),
      messageId: data.messageId,
      messageIndex: data.messageIndex,
      createdAt: Date.now(),
      content: data.content,
      compressed: false,
    };

    const groupedMap = this.getMiniSummariesMap();
    const list = this.getOrCreateConversationArray(groupedMap, conversationId);
    list.push([summary]);

    return summary;
  }

  /**
   * 获取会话小总结列表
   */
  getMiniSummaries(conversationId: string): MiniSummary[] {
    const groupedMap = this.getMiniSummariesMap();
    const list = groupedMap.get(conversationId);
    return list ? list.toArray() : [];
  }

  /**
   * 更新小总结内容
   */
  updateMiniSummary(
    conversationId: string,
    summaryId: string,
    content: string,
  ): void {
    const groupedMap = this.getMiniSummariesMap();
    const list = groupedMap.get(conversationId);
    if (!list) {
      return;
    }

    const summaries = list.toArray();
    const targetIndex = summaries.findIndex(
      (summary) => summary.id === summaryId,
    );
    if (targetIndex === -1) {
      return;
    }

    const current = summaries[targetIndex];
    const updated: MiniSummary = {
      ...current,
      content,
    };

    list.delete(targetIndex, 1);
    list.insert(targetIndex, [updated]);
  }

  /**
   * 获取未压缩的小总结列表
   */
  getUncompressedMiniSummaries(conversationId: string): MiniSummary[] {
    return this.getMiniSummaries(conversationId).filter((summary) => {
      return !summary.compressed;
    });
  }

  /**
   * 标记小总结为已压缩
   */
  markAsCompressed(
    conversationId: string,
    ids: string[],
    megaSummaryId: string,
  ): void {
    if (ids.length === 0) {
      return;
    }

    const groupedMap = this.getMiniSummariesMap();
    const list = groupedMap.get(conversationId);
    if (!list) {
      return;
    }

    const idSet = new Set(ids);

    const runUpdate = () => {
      const summaries = list.toArray();
      for (let index = 0; index < summaries.length; index++) {
        const current = summaries[index];
        if (!idSet.has(current.id) || current.compressed) {
          continue;
        }

        const updated: MiniSummary = {
          ...current,
          compressed: true,
          megaSummaryId,
        };

        list.delete(index, 1);
        list.insert(index, [updated]);
      }
    };

    const doc = list.doc;
    if (doc) {
      doc.transact(runUpdate);
    } else {
      runUpdate();
    }
  }

  // ============ 大总结 CRUD ============

  /**
   * 添加大总结
   */
  addMegaSummary(conversationId: string, summary: MegaSummary): void {
    const groupedMap = this.getMegaSummariesMap();
    const list = this.getOrCreateConversationArray(groupedMap, conversationId);
    list.push([summary]);
  }

  /**
   * 获取会话大总结列表
   */
  getMegaSummaries(conversationId: string): MegaSummary[] {
    const groupedMap = this.getMegaSummariesMap();
    const list = groupedMap.get(conversationId);
    return list ? list.toArray() : [];
  }

  /**
   * 更新大总结内容
   */
  updateMegaSummary(
    conversationId: string,
    summaryId: string,
    content: string,
  ): void {
    const groupedMap = this.getMegaSummariesMap();
    const list = groupedMap.get(conversationId);
    if (!list) {
      return;
    }

    const summaries = list.toArray();
    const targetIndex = summaries.findIndex(
      (summary) => summary.id === summaryId,
    );
    if (targetIndex === -1) {
      return;
    }

    const current = summaries[targetIndex];
    const updated: MegaSummary = {
      ...current,
      content,
    };

    list.delete(targetIndex, 1);
    list.insert(targetIndex, [updated]);
  }

  // ============ 手动记忆 CRUD ============

  /**
   * 添加手动记忆
   */
  addManualMemory(
    conversationId: string,
    data: AddManualMemoryData,
  ): ManualMemory {
    const now = Date.now();
    const memory: ManualMemory = {
      id: crypto.randomUUID(),
      sourceContent: data.sourceContent,
      summary: data.summary,
      tags: [...data.tags],
      createdAt: now,
      updatedAt: now,
      sourceMessageId: data.sourceMessageId,
    };

    const groupedMap = this.getManualMemoriesMap();
    const list = this.getOrCreateConversationArray(groupedMap, conversationId);
    list.push([memory]);

    return memory;
  }

  /**
   * 更新手动记忆
   */
  updateManualMemory(
    conversationId: string,
    id: string,
    updates: Partial<ManualMemory>,
  ): void {
    const groupedMap = this.getManualMemoriesMap();
    const list = groupedMap.get(conversationId);
    if (!list) {
      return;
    }

    const memories = list.toArray();
    const targetIndex = memories.findIndex((memory) => memory.id === id);
    if (targetIndex === -1) {
      return;
    }

    const current = memories[targetIndex];
    const updated: ManualMemory = {
      ...current,
      ...updates,
      id: current.id,
      createdAt: current.createdAt,
      updatedAt: Date.now(),
      tags: updates.tags ? [...updates.tags] : current.tags,
    };

    list.delete(targetIndex, 1);
    list.insert(targetIndex, [updated]);
  }

  /**
   * 删除手动记忆
   */
  deleteManualMemory(conversationId: string, id: string): void {
    const groupedMap = this.getManualMemoriesMap();
    const list = groupedMap.get(conversationId);
    if (!list) {
      return;
    }

    const memories = list.toArray();
    const targetIndex = memories.findIndex((memory) => memory.id === id);
    if (targetIndex === -1) {
      return;
    }

    list.delete(targetIndex, 1);
  }

  /**
   * 获取会话手动记忆列表
   */
  getManualMemories(conversationId: string): ManualMemory[] {
    const groupedMap = this.getManualMemoriesMap();
    const list = groupedMap.get(conversationId);
    return list ? list.toArray() : [];
  }

  /**
   * 按标签过滤手动记忆
   */
  getManualMemoriesByTag(conversationId: string, tag: string): ManualMemory[] {
    return this.getManualMemories(conversationId).filter((memory) => {
      return memory.tags.includes(tag);
    });
  }

  /**
   * 获取当前存档中存在记忆数据的会话 ID 列表
   */
  getConversationIds(): string[] {
    const ids = new Set<string>();

    this.getMiniSummariesMap().forEach((_value, key) => ids.add(key));
    this.getMegaSummariesMap().forEach((_value, key) => ids.add(key));
    this.getManualMemoriesMap().forEach((_value, key) => ids.add(key));

    return Array.from(ids);
  }
}

/**
 * 当前 Repository 实例缓存
 */
let currentRepository: MemoryRepository | null = null;
let currentSaveId: string | null = null;

/**
 * 获取 MemoryRepository 实例
 *
 * 如果当前存档已切换，会自动创建新实例
 *
 * @throws {Error} 如果没有加载存档
 */
export function getMemoryRepository(): MemoryRepository {
  const saveId = yjsManager.getCurrentSaveId();

  if (!saveId) {
    throw new Error(
      "[MemoryRepository] No save loaded. Please load a save first.",
    );
  }

  const saveDoc = yjsManager.getCurrentSave();

  if (!saveDoc) {
    throw new Error("[MemoryRepository] Failed to get save document.");
  }

  // 如果存档切换了，重新创建 Repository
  if (saveId !== currentSaveId || !currentRepository) {
    currentRepository = new MemoryRepository(saveDoc);
    currentSaveId = saveId;
  }

  return currentRepository;
}

/**
 * 重置 Repository 实例
 */
export function resetMemoryRepository(): void {
  currentRepository = null;
  currentSaveId = null;
}

/**
 * 检查是否有 Repository 实例
 */
export function hasMemoryRepository(): boolean {
  return currentRepository !== null;
}

/** 联机 Repository 实例缓存（按 roomId） */
const multiplayerRepositories = new Map<string, MemoryRepository>();

/**
 * 获取联机模式的 MemoryRepository 实例
 *
 * 从 HistoryDoc 的根 Map 获取/创建 memory 子结构。
 * HistoryDoc 必须已加载（由 subdocManager.loadHistoryDoc 完成）。
 *
 * @param historyDoc 已加载的 HistoryDoc
 * @param roomId 房间 ID（用于缓存管理）
 * @returns MemoryRepository 实例
 */
export function getMultiplayerMemoryRepository(
  historyDoc: Y.Doc,
  roomId: string,
): MemoryRepository {
  const cached = multiplayerRepositories.get(roomId);
  if (cached) {
    return cached;
  }

  // HistoryDoc 本身是 Y.Doc，其顶层就可以作为 Y.Map 使用
  // 但 MemoryRepository 构造函数接受 Y.Map<unknown>
  // 需要在 HistoryDoc 上获取或创建一个 "memoryRoot" Map
  const docMap = historyDoc.getMap("memoryRoot") as Y.Map<unknown>;

  const repo = new MemoryRepository(docMap);
  multiplayerRepositories.set(roomId, repo);
  return repo;
}

/**
 * 重置指定房间的联机 Repository 实例
 */
export function resetMultiplayerMemoryRepository(roomId: string): void {
  multiplayerRepositories.delete(roomId);
}

/**
 * 重置所有联机 Repository 实例
 */
export function resetAllMultiplayerMemoryRepositories(): void {
  multiplayerRepositories.clear();
}

/**
 * 检查指定房间是否有联机 Repository 实例
 */
export function hasMultiplayerMemoryRepository(roomId: string): boolean {
  return multiplayerRepositories.has(roomId);
}
