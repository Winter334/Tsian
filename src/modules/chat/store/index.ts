/**
 * Chat 模块 Store 导出
 *
 * 架构说明：
 * - UI 临时状态：useChatUIStore（内存，刷新丢失无所谓）
 * - 业务数据：通过 hooks/useChatData.ts 订阅 Yjs（持久化 + 联机同步）
 * - 数据操作：通过 ChatRepository（封装 Yjs 操作）
 */

export {
  useChatUIStore,
  useCurrentConversationId,
  useIsLoading,
  useStreamingMessageId,
} from "./ui-store";
