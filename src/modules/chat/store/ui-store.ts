/**
 * Chat UI Store - 只存储 UI 临时状态
 *
 * 这个 Store 只管理 UI 相关的临时状态，不持久化。
 * 业务数据（conversations, messages）由 Yjs 管理。
 *
 * 职责分离：
 * - Zustand (此 Store): UI 临时状态（刷新丢失无所谓）
 * - Yjs: 业务数据（持久化 + 联机同步）
 */

import { create } from "zustand";

/**
 * Chat UI 状态
 */
interface ChatUIState {
  /** 当前选中的会话 ID */
  currentConversationId: string | null;

  /** 是否正在加载（等待 AI 响应） */
  isLoading: boolean;

  /** 正在流式输出的消息 ID */
  streamingMessageId: string | null;

  /** 输入框内容（可选，用于跨组件共享） */
  inputValue: string;

  // ============ Actions ============

  /** 设置当前会话 */
  setCurrentConversation: (id: string | null) => void;

  /** 设置加载状态 */
  setLoading: (loading: boolean) => void;

  /** 设置流式消息 ID */
  setStreamingMessageId: (id: string | null) => void;

  /** 设置输入框内容 */
  setInputValue: (value: string) => void;

  /** 重置所有状态 */
  reset: () => void;
}

/**
 * 初始状态
 */
const initialState = {
  currentConversationId: null,
  isLoading: false,
  streamingMessageId: null,
  inputValue: "",
};

/**
 * Chat UI Store
 */
export const useChatUIStore = create<ChatUIState>((set) => ({
  ...initialState,

  setCurrentConversation: (id) => set({ currentConversationId: id }),

  setLoading: (loading) => set({ isLoading: loading }),

  setStreamingMessageId: (id) => set({ streamingMessageId: id }),

  setInputValue: (value) => set({ inputValue: value }),

  reset: () => set(initialState),
}));

/**
 * 便捷 Hooks - 获取单个状态
 */
export const useCurrentConversationId = () =>
  useChatUIStore((s) => s.currentConversationId);

export const useIsLoading = () => useChatUIStore((s) => s.isLoading);

export const useStreamingMessageId = () =>
  useChatUIStore((s) => s.streamingMessageId);
