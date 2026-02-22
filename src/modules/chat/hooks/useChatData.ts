/**
 * Chat 数据 Hooks - 订阅 Yjs 数据变化
 *
 * 这些 Hooks 直接订阅 Yjs 文档的变化，实现响应式数据更新。
 * UI 组件通过这些 Hooks 获取业务数据，无需通过 Zustand Store。
 *
 * 注意：这些 Hooks 会响应存档切换，当存档变化时自动重新订阅
 */

import { eventBus } from "@/core/event-bus";
import { yjsManager } from "@/core/yjs";
import type { Conversation } from "@/domain/entities/conversation";
import type { Message } from "@/domain/entities/message";
import { SaveEvents } from "@/domain/events/save";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import type * as Y from "yjs";

/**
 * 订阅当前存档 ID 变化
 * 使用 EventBus 监听存档切换事件，实现即时响应
 */
interface CurrentSaveStateInternal {
  saveId: string | null;
  revision: number;
}

function useCurrentSaveIdInternal(): CurrentSaveStateInternal {
  const [currentSaveState, setCurrentSaveState] =
    useState<CurrentSaveStateInternal>(() => ({
      saveId: yjsManager.getCurrentSaveId(),
      revision: 0,
    }));

  useEffect(() => {
    // 统一的存档变化处理器
    const syncSaveState = () => {
      const nextSaveId = yjsManager.getCurrentSaveId();
      setCurrentSaveState((prev) => ({
        saveId: nextSaveId,
        revision: prev.revision + 1,
      }));
    };

    // 订阅所有存档相关事件
    const unsubscribes = [
      eventBus.on(SaveEvents.SAVE_LOADED, syncSaveState),
      eventBus.on(SaveEvents.SAVE_CREATED, syncSaveState),
      eventBus.on(SaveEvents.SAVE_DELETED, syncSaveState),
    ];

    // 初始同步
    syncSaveState();

    return () => unsubscribes.forEach((unsub) => unsub());
  }, []);

  return currentSaveState;
}

/**
 * 订阅会话列表
 *
 * @returns 当前存档的所有会话列表
 */
export function useConversations(): Conversation[] {
  const [conversations, setConversations] = useState<Conversation[]>([]);

  // 监听存档切换
  const { saveId: currentSaveId, revision: currentSaveRevision } =
    useCurrentSaveIdInternal();

  useEffect(() => {
    const saveDoc = yjsManager.getCurrentSave();
    if (!saveDoc) {
      setConversations([]);
      return;
    }

    const conversationsMap = saveDoc.get(
      "conversations",
    ) as Y.Map<Conversation>;
    if (!conversationsMap) {
      setConversations([]);
      return;
    }

    // 更新状态的函数
    const updateConversations = () => {
      const list = Array.from(conversationsMap.values());
      // 按更新时间倒序排序
      list.sort((a, b) => b.updatedAt - a.updatedAt);
      setConversations(list);
    };

    // 订阅变化
    conversationsMap.observe(updateConversations);

    // 初始加载
    updateConversations();

    // 清理订阅
    return () => {
      conversationsMap.unobserve(updateConversations);
    };
  }, [currentSaveId, currentSaveRevision]); // 当存档切换/回溯时重新订阅

  return conversations;
}

/**
 * 订阅特定会话的消息列表
 *
 * @param conversationId - 会话 ID，为 null 时返回空数组
 * @returns 该会话的消息列表
 */
export function useMessages(conversationId: string | null): Message[] {
  const [messages, setMessages] = useState<Message[]>([]);

  // 监听存档切换
  const { saveId: currentSaveId, revision: currentSaveRevision } =
    useCurrentSaveIdInternal();

  useEffect(() => {
    // 清空消息，等待正确的 conversationId
    if (!conversationId) {
      setMessages([]);
      return;
    }

    const saveDoc = yjsManager.getCurrentSave();
    if (!saveDoc) {
      setMessages([]);
      return;
    }

    // 验证 conversationId 是否属于当前存档
    const conversationsMap = saveDoc.get(
      "conversations",
    ) as Y.Map<Conversation>;
    if (!conversationsMap || !conversationsMap.has(conversationId)) {
      // conversationId 不属于当前存档，清空消息
      // 这种情况发生在存档切换时，旧的 conversationId 还没有更新
      setMessages([]);
      return;
    }

    const messagesMap = saveDoc.get("messages") as Y.Map<Y.Array<Message>>;
    if (!messagesMap) {
      setMessages([]);
      return;
    }

    // 更新状态的函数（每次都重新获取最新的 Y.Array 引用）
    const updateMessages = () => {
      const latestMessagesArray = messagesMap.get(conversationId);
      setMessages(latestMessagesArray ? latestMessagesArray.toArray() : []);
    };

    // 订阅变化（包含 map key 替换和数组内部变化）
    messagesMap.observeDeep(updateMessages);

    // 初始加载
    updateMessages();

    // 清理订阅
    return () => {
      messagesMap.unobserveDeep(updateMessages);
    };
  }, [conversationId, currentSaveId, currentSaveRevision]); // 当存档切换/回溯时重新订阅

  return messages;
}

/**
 * 订阅单个会话
 *
 * @param conversationId - 会话 ID
 * @returns 会话对象，不存在时返回 undefined
 */
export function useConversation(
  conversationId: string | null,
): Conversation | undefined {
  const [conversation, setConversation] = useState<Conversation | undefined>(
    undefined,
  );

  // 监听存档切换
  const { saveId: currentSaveId, revision: currentSaveRevision } =
    useCurrentSaveIdInternal();

  useEffect(() => {
    if (!conversationId) {
      setConversation(undefined);
      return;
    }

    const saveDoc = yjsManager.getCurrentSave();
    if (!saveDoc) {
      setConversation(undefined);
      return;
    }

    const conversationsMap = saveDoc.get(
      "conversations",
    ) as Y.Map<Conversation>;
    if (!conversationsMap) {
      setConversation(undefined);
      return;
    }

    // 更新状态的函数
    const updateConversation = () => {
      setConversation(conversationsMap.get(conversationId));
    };

    // 订阅变化
    conversationsMap.observe(updateConversation);

    // 初始加载
    updateConversation();

    // 清理订阅
    return () => {
      conversationsMap.unobserve(updateConversation);
    };
  }, [conversationId, currentSaveId, currentSaveRevision]); // 当存档切换/回溯时重新订阅

  return conversation;
}

/**
 * 使用 useSyncExternalStore 订阅会话列表（更高效的实现）
 *
 * 这个版本使用 React 18 的 useSyncExternalStore，
 * 可以更好地与 React 的并发特性配合。
 *
 * 注意：currentSaveId/currentSaveRevision 在依赖数组中是故意的，用于在存档切换/回溯时重新创建函数
 */
export function useConversationsSync(): Conversation[] {
  // 监听存档切换，用于触发重新订阅
  const { saveId: currentSaveId, revision: currentSaveRevision } =
    useCurrentSaveIdInternal();

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const saveDoc = yjsManager.getCurrentSave();
      if (!saveDoc) return () => {};

      const conversationsMap = saveDoc.get(
        "conversations",
      ) as Y.Map<Conversation>;
      if (!conversationsMap) return () => {};

      conversationsMap.observe(onStoreChange);
      return () => conversationsMap.unobserve(onStoreChange);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- currentSaveId/currentSaveRevision 用于触发重新订阅
    [currentSaveId, currentSaveRevision],
  );

  const getSnapshot = useCallback(() => {
    const saveDoc = yjsManager.getCurrentSave();
    if (!saveDoc) return [];

    const conversationsMap = saveDoc.get(
      "conversations",
    ) as Y.Map<Conversation>;
    if (!conversationsMap) return [];

    const list = Array.from(conversationsMap.values());
    list.sort((a, b) => b.updatedAt - a.updatedAt);
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- currentSaveId/currentSaveRevision 用于触发重新获取
  }, [currentSaveId, currentSaveRevision]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/**
 * 使用 useSyncExternalStore 订阅消息列表（更高效的实现）
 *
 * 注意：currentSaveId/currentSaveRevision 在依赖数组中是故意的，用于在存档切换/回溯时重新创建函数
 */
export function useMessagesSync(conversationId: string | null): Message[] {
  // 监听存档切换，用于触发重新订阅
  const { saveId: currentSaveId, revision: currentSaveRevision } =
    useCurrentSaveIdInternal();

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      if (!conversationId) return () => {};

      const saveDoc = yjsManager.getCurrentSave();
      if (!saveDoc) return () => {};

      const messagesMap = saveDoc.get("messages") as Y.Map<Y.Array<Message>>;
      if (!messagesMap) return () => {};

      messagesMap.observeDeep(onStoreChange);
      return () => messagesMap.unobserveDeep(onStoreChange);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- currentSaveId/currentSaveRevision 用于触发重新订阅
    [conversationId, currentSaveId, currentSaveRevision],
  );

  const getSnapshot = useCallback(() => {
    if (!conversationId) return [];

    const saveDoc = yjsManager.getCurrentSave();
    if (!saveDoc) return [];

    const messagesMap = saveDoc.get("messages") as Y.Map<Y.Array<Message>>;
    if (!messagesMap) return [];

    const messagesArray = messagesMap.get(conversationId);
    if (!messagesArray) return [];

    return messagesArray.toArray();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- currentSaveId/currentSaveRevision 用于触发重新获取
  }, [conversationId, currentSaveId, currentSaveRevision]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/**
 * 检查 Yjs 是否已初始化并有当前存档
 */
export function useYjsReady(): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const checkReady = () => {
      const isReady =
        yjsManager.isInitialized() && yjsManager.getCurrentSave() !== null;
      setReady(isReady);
    };

    // 初始检查
    checkReady();

    // 定期检查（用于等待初始化完成）
    const interval = setInterval(checkReady, 100);

    return () => clearInterval(interval);
  }, []);

  return ready;
}
