/**
 * Memory 联机同步
 *
 * 职责：
 * - 监听 HistoryDoc 中 memoryRoot 的变化
 * - 将变化同步到本地 MemoryStore
 * - 镜像 memory 数据到本地 SaveSlot（Guest 持久化）
 *
 * 架构说明：这是同步桥接层（架构特例），允许直接更新 Store
 */

import * as Y from "yjs";

import { subdocManager, yjsManager } from "@/core/yjs";
import { MemoryRepository } from "./repository";
import { useMemoryStore } from "./store";

/** 同步清理函数列表 */
let cleanupFunctions: Array<() => void> = [];

/** 当前同步的 roomId */
let syncedRoomId: string | null = null;

type MemoryGroupName = "miniSummaries" | "megaSummaries" | "manualMemories";

const MEMORY_GROUPS: MemoryGroupName[] = [
  "miniSummaries",
  "megaSummaries",
  "manualMemories",
];

/**
 * 设置联机 Memory 同步
 *
 * 在加入/创建房间后调用。
 * 监听 HistoryDoc 的 memoryRoot 变化，同步到 Store。
 */
export async function setupMemorySync(roomId: string): Promise<void> {
  // 如果已经在同步，先清理
  if (syncedRoomId) {
    teardownMemorySync();
  }

  syncedRoomId = roomId;

  try {
    const historyDoc = await subdocManager.loadHistoryDoc(roomId);
    const memoryRootMap = historyDoc.getMap("memoryRoot") as Y.Map<unknown>;

    // 初次同步
    syncMemoryToStore(memoryRootMap, roomId);
    mirrorMemoryToSaveSlot(memoryRootMap);

    // 监听变化
    const observer = () => {
      syncMemoryToStore(memoryRootMap, roomId);
      mirrorMemoryToSaveSlot(memoryRootMap);
    };

    memoryRootMap.observeDeep(observer);
    cleanupFunctions.push(() => memoryRootMap.unobserveDeep(observer));

    console.log(`[MemorySync] Setup complete for room ${roomId}`);
  } catch (error) {
    syncedRoomId = null;
    console.warn(
      "[MemorySync] Failed to setup memory sync:",
      error instanceof Error ? error.message : error,
    );
  }
}

/**
 * 清理联机 Memory 同步
 */
export function teardownMemorySync(): void {
  for (const cleanup of cleanupFunctions) {
    try {
      cleanup();
    } catch {
      // 忽略清理错误
    }
  }

  cleanupFunctions = [];
  syncedRoomId = null;
  console.log("[MemorySync] Teardown complete");
}

/**
 * 从 HistoryDoc memoryRoot 同步到 MemoryStore
 */
function syncMemoryToStore(
  memoryRootMap: Y.Map<unknown>,
  roomId: string,
): void {
  const store = useMemoryStore.getState();
  const conversationId = `room:${roomId}:main`;

  // 通过 Repository 读取当前内存数据
  const repository = new MemoryRepository(memoryRootMap);

  // 同步到 Store
  store.syncFromRepository(conversationId, repository);
}

/**
 * 镜像 memory 数据到本地 SaveSlot
 *
 * Guest 端需要将联机 memory 数据镜像到本地存档，
 * 以便联机结束后仍可以查看历史记忆。
 */
function mirrorMemoryToSaveSlot(memoryRootMap: Y.Map<unknown>): void {
  try {
    const saveSlot = yjsManager.getCurrentSave();
    if (!saveSlot) {
      return;
    }

    const rootDoc = yjsManager.getDoc();

    rootDoc.transact(() => {
      let targetMemory = saveSlot.get("memory") as Y.Map<unknown> | undefined;
      if (!targetMemory) {
        targetMemory = new Y.Map<unknown>();
        saveSlot.set("memory", targetMemory);
      }

      for (const groupName of MEMORY_GROUPS) {
        mirrorGroupedMap(memoryRootMap, targetMemory, groupName);
      }

      saveSlot.set("updatedAt", Date.now());
    });
  } catch (error) {
    console.warn(
      "[MemorySync] Failed to mirror memory to SaveSlot:",
      error instanceof Error ? error.message : error,
    );
  }
}

/**
 * 镜像一个分组 Map 的内容
 */
function mirrorGroupedMap(
  sourceMemory: Y.Map<unknown>,
  targetMemory: Y.Map<unknown>,
  groupName: MemoryGroupName,
): void {
  const sourceGroup = sourceMemory.get(groupName) as
    | Y.Map<Y.Array<unknown>>
    | undefined;

  if (!sourceGroup) {
    targetMemory.delete(groupName);
    return;
  }

  let targetGroup = targetMemory.get(groupName) as
    | Y.Map<Y.Array<unknown>>
    | undefined;

  if (!targetGroup) {
    targetGroup = new Y.Map<Y.Array<unknown>>();
    targetMemory.set(groupName, targetGroup);
  }

  const sourceConversationIds = new Set<string>();

  // 同步 source 中存在的会话
  sourceGroup.forEach((sourceArray, conversationId) => {
    if (!(sourceArray instanceof Y.Array)) {
      return;
    }

    sourceConversationIds.add(conversationId);
    const items = sourceArray.toArray();

    let targetArray = targetGroup!.get(conversationId);
    if (!targetArray) {
      targetArray = new Y.Array<unknown>();
      targetGroup!.set(conversationId, targetArray);
    }

    if (targetArray.length > 0) {
      targetArray.delete(0, targetArray.length);
    }

    if (items.length > 0) {
      targetArray.push(items);
    }
  });

  // 删除 target 中已不存在的会话
  const staleConversationIds: string[] = [];
  targetGroup.forEach((_value, conversationId) => {
    if (!sourceConversationIds.has(conversationId)) {
      staleConversationIds.push(conversationId);
    }
  });

  for (const conversationId of staleConversationIds) {
    targetGroup.delete(conversationId);
  }
}

/**
 * 获取当前同步的 roomId
 */
export function getSyncedRoomId(): string | null {
  return syncedRoomId;
}
