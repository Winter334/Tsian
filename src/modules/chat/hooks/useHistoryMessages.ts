/**
 * 历史消息懒加载 Hook
 *
 * 用于联机模式下分页加载历史消息
 */

import {
  subdocManager,
  type HistoryMessageItem,
  type PaginatedResult,
} from "@/core/yjs";
import { useCallback, useEffect, useState } from "react";

/**
 * 历史消息加载状态
 */
export interface UseHistoryMessagesState {
  /** 当前已加载的消息 */
  messages: HistoryMessageItem[];
  /** 是否正在加载 */
  loading: boolean;
  /** 是否正在加载更多 */
  loadingMore: boolean;
  /** 是否还有更多消息 */
  hasMore: boolean;
  /** 错误信息 */
  error: Error | null;
  /** 消息总数 */
  total: number;
}

/**
 * 历史消息加载操作
 */
export interface UseHistoryMessagesActions {
  /** 加载更多消息 */
  loadMore: () => Promise<void>;
  /** 刷新（重新加载） */
  refresh: () => Promise<void>;
}

/**
 * 历史消息懒加载 Hook 返回值
 */
export type UseHistoryMessagesResult = UseHistoryMessagesState &
  UseHistoryMessagesActions;

/**
 * 历史消息懒加载 Hook 选项
 */
export interface UseHistoryMessagesOptions {
  /** 每页数量 */
  pageSize?: number;
  /** 是否自动加载首页 */
  autoLoad?: boolean;
}

/**
 * 历史消息懒加载 Hook
 *
 * 用于联机模式下分页加载 HistoryDoc 中的历史消息
 *
 * @param roomId 房间 ID
 * @param conversationId 会话 ID
 * @param options 配置选项
 *
 * @example
 * ```tsx
 * const { messages, loading, hasMore, loadMore } = useHistoryMessages(
 *   roomId,
 *   conversationId,
 *   { pageSize: 20 }
 * )
 *
 * // 滚动到顶部时加载更多
 * const handleScroll = (e) => {
 *   if (e.target.scrollTop === 0 && hasMore && !loading) {
 *     loadMore()
 *   }
 * }
 * ```
 */
export function useHistoryMessages(
  roomId: string | null,
  conversationId: string | null,
  options: UseHistoryMessagesOptions = {}
): UseHistoryMessagesResult {
  const { pageSize = 20, autoLoad = true } = options;

  // 状态
  const [messages, setMessages] = useState<HistoryMessageItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [total, setTotal] = useState(0);
  const [cursor, setCursor] = useState<number | null>(null);

  /**
   * 加载首页
   */
  const loadInitial = useCallback(async () => {
    if (!roomId || !conversationId) {
      setMessages([]);
      setHasMore(false);
      setTotal(0);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result: PaginatedResult<HistoryMessageItem> =
        await subdocManager.getHistoryMessages(roomId, conversationId, {
          limit: pageSize,
        });

      // 首页消息需要反转（因为分页是倒序的，但显示需要正序）
      setMessages(result.items.reverse());
      setHasMore(result.hasMore);
      setTotal(result.total);
      setCursor(result.nextCursor);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [roomId, conversationId, pageSize]);

  /**
   * 加载更多（历史消息）
   */
  const loadMore = useCallback(async () => {
    if (!roomId || !conversationId || !hasMore || loading || loadingMore) {
      return;
    }

    setLoadingMore(true);
    setError(null);

    try {
      const result = await subdocManager.getHistoryMessages(
        roomId,
        conversationId,
        { limit: pageSize, cursor: cursor ?? undefined }
      );

      // 将新加载的消息（反转后）添加到列表前面
      setMessages((prev) => [...result.items.reverse(), ...prev]);
      setHasMore(result.hasMore);
      setCursor(result.nextCursor);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoadingMore(false);
    }
  }, [roomId, conversationId, hasMore, loading, loadingMore, pageSize, cursor]);

  /**
   * 刷新（重新加载首页）
   */
  const refresh = useCallback(async () => {
    setCursor(null);
    await loadInitial();
  }, [loadInitial]);

  // 自动加载首页
  useEffect(() => {
    if (autoLoad) {
      loadInitial();
    }
  }, [autoLoad, loadInitial]);

  // 当 roomId 或 conversationId 变化时重置状态
  useEffect(() => {
    setMessages([]);
    setHasMore(true);
    setTotal(0);
    setCursor(null);
    setError(null);
  }, [roomId, conversationId]);

  return {
    messages,
    loading,
    loadingMore,
    hasMore,
    error,
    total,
    loadMore,
    refresh,
  };
}

/**
 * 归档回合懒加载 Hook
 *
 * @param roomId 房间 ID
 * @param options 配置选项
 */
export function useArchivedTurns(
  roomId: string | null,
  options: { pageSize?: number; autoLoad?: boolean } = {}
) {
  const { pageSize = 10, autoLoad = true } = options;

  const [turns, setTurns] = useState<
    Array<{ turnNumber: number; completedAt: number; compressedData: string }>
  >([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [total, setTotal] = useState(0);
  const [cursor, setCursor] = useState<number | null>(null);

  const loadInitial = useCallback(async () => {
    if (!roomId) {
      setTurns([]);
      setHasMore(false);
      setTotal(0);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await subdocManager.getArchivedTurns(roomId, {
        limit: pageSize,
      });
      setTurns(result.items.reverse());
      setHasMore(result.hasMore);
      setTotal(result.total);
      setCursor(result.nextCursor);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [roomId, pageSize]);

  const loadMore = useCallback(async () => {
    if (!roomId || !hasMore || loading || loadingMore) {
      return;
    }

    setLoadingMore(true);
    setError(null);

    try {
      const result = await subdocManager.getArchivedTurns(roomId, {
        limit: pageSize,
        cursor: cursor ?? undefined,
      });
      setTurns((prev) => [...result.items.reverse(), ...prev]);
      setHasMore(result.hasMore);
      setCursor(result.nextCursor);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoadingMore(false);
    }
  }, [roomId, hasMore, loading, loadingMore, pageSize, cursor]);

  const refresh = useCallback(async () => {
    setCursor(null);
    await loadInitial();
  }, [loadInitial]);

  useEffect(() => {
    if (autoLoad) {
      loadInitial();
    }
  }, [autoLoad, loadInitial]);

  useEffect(() => {
    setTurns([]);
    setHasMore(true);
    setTotal(0);
    setCursor(null);
    setError(null);
  }, [roomId]);

  return {
    turns,
    loading,
    loadingMore,
    hasMore,
    error,
    total,
    loadMore,
    refresh,
  };
}
