/**
 * Chat 模块事件定义
 */

import type { Conversation } from "../entities/conversation";
import type { Message } from "../entities/message";

/**
 * Chat 事件类型常量
 */
export const ChatEvents = {
  // 消息事件
  MESSAGE_CREATED: "chat.message.created",
  MESSAGE_UPDATED: "chat.message.updated",
  MESSAGE_DELETED: "chat.message.deleted",

  // 流式响应事件
  STREAM_START: "chat.stream.start",
  STREAM_CHUNK: "chat.stream.chunk",
  STREAM_END: "chat.stream.end",
  STREAM_ERROR: "chat.stream.error",

  // 会话事件
  CONVERSATION_CREATED: "chat.conversation.created",
  CONVERSATION_UPDATED: "chat.conversation.updated",
  CONVERSATION_DELETED: "chat.conversation.deleted",
  CONVERSATION_SELECTED: "chat.conversation.selected",
} as const;

/**
 * Chat 事件类型
 */
export type ChatEventType = (typeof ChatEvents)[keyof typeof ChatEvents];

// ============ 事件 Payload 类型 ============

/**
 * 消息创建事件 Payload
 */
export interface MessageCreatedPayload {
  message: Message;
}

/**
 * 消息更新事件 Payload
 */
export interface MessageUpdatedPayload {
  message: Message;
}

/**
 * 消息删除事件 Payload
 */
export interface MessageDeletedPayload {
  messageId: string;
  conversationId: string;
}

/**
 * 流开始事件 Payload
 */
export interface StreamStartPayload {
  messageId: string;
  conversationId: string;
}

/**
 * 流块事件 Payload
 */
export interface StreamChunkPayload {
  messageId: string;
  chunk: string;
}

/**
 * 流结束事件 Payload
 */
export interface StreamEndPayload {
  messageId: string;
  finalContent: string;
}

/**
 * 流错误事件 Payload
 */
export interface StreamErrorPayload {
  messageId: string;
  error: string;
}

/**
 * 会话创建事件 Payload
 */
export interface ConversationCreatedPayload {
  conversation: Conversation;
}

/**
 * 会话更新事件 Payload
 */
export interface ConversationUpdatedPayload {
  conversation: Conversation;
}

/**
 * 会话删除事件 Payload
 */
export interface ConversationDeletedPayload {
  conversationId: string;
}

/**
 * 会话选中事件 Payload
 */
export interface ConversationSelectedPayload {
  conversationId: string | null;
}

// ============ 事件类型映射 ============

/**
 * Chat 事件 Payload 映射
 */
export interface ChatEventPayloads {
  [ChatEvents.MESSAGE_CREATED]: MessageCreatedPayload;
  [ChatEvents.MESSAGE_UPDATED]: MessageUpdatedPayload;
  [ChatEvents.MESSAGE_DELETED]: MessageDeletedPayload;
  [ChatEvents.STREAM_START]: StreamStartPayload;
  [ChatEvents.STREAM_CHUNK]: StreamChunkPayload;
  [ChatEvents.STREAM_END]: StreamEndPayload;
  [ChatEvents.STREAM_ERROR]: StreamErrorPayload;
  [ChatEvents.CONVERSATION_CREATED]: ConversationCreatedPayload;
  [ChatEvents.CONVERSATION_UPDATED]: ConversationUpdatedPayload;
  [ChatEvents.CONVERSATION_DELETED]: ConversationDeletedPayload;
  [ChatEvents.CONVERSATION_SELECTED]: ConversationSelectedPayload;
}
