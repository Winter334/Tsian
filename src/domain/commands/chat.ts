/**
 * Chat 模块命令定义
 */

import type { ConversationSettings } from "../entities/conversation";
import type { MessageRole } from "../entities/message";

/**
 * Chat 命令类型常量
 */
export const ChatCommands = {
  // 消息命令
  SEND_MESSAGE: "chat.send_message",
  DELETE_MESSAGE: "chat.delete_message",
  REGENERATE_MESSAGE: "chat.regenerate_message",
  STOP_GENERATION: "chat.stop_generation",

  // 会话命令
  CREATE_CONVERSATION: "chat.create_conversation",
  UPDATE_CONVERSATION: "chat.update_conversation",
  DELETE_CONVERSATION: "chat.delete_conversation",
  SELECT_CONVERSATION: "chat.select_conversation",
  CLEAR_CONVERSATION: "chat.clear_conversation",
} as const;

/**
 * Chat 命令类型
 */
export type ChatCommandType = (typeof ChatCommands)[keyof typeof ChatCommands];

// ============ 命令 Payload 类型 ============

/**
 * 发送消息命令 Payload
 */
export interface SendMessagePayload {
  content: string;
  conversationId: string;
  role?: MessageRole;
}

/**
 * 删除消息命令 Payload
 */
export interface DeleteMessagePayload {
  messageId: string;
  conversationId: string;
}

/**
 * 重新生成消息命令 Payload
 */
export interface RegenerateMessagePayload {
  messageId: string;
  conversationId: string;
}

/**
 * 停止生成命令 Payload
 */
export interface StopGenerationPayload {
  messageId: string;
}

/**
 * 创建会话命令 Payload
 */
export interface CreateConversationPayload {
  title?: string;
  characterIds?: string[];
  systemPrompt?: string;
  settings?: ConversationSettings;
}

/**
 * 更新会话命令 Payload
 */
export interface UpdateConversationPayload {
  conversationId: string;
  title?: string;
  systemPrompt?: string;
  settings?: ConversationSettings;
}

/**
 * 删除会话命令 Payload
 */
export interface DeleteConversationPayload {
  conversationId: string;
}

/**
 * 选择会话命令 Payload
 */
export interface SelectConversationPayload {
  conversationId: string | null;
}

/**
 * 清空会话命令 Payload
 */
export interface ClearConversationPayload {
  conversationId: string;
}

// ============ 命令类型映射 ============

/**
 * Chat 命令 Payload 映射
 */
export interface ChatCommandPayloads {
  [ChatCommands.SEND_MESSAGE]: SendMessagePayload;
  [ChatCommands.DELETE_MESSAGE]: DeleteMessagePayload;
  [ChatCommands.REGENERATE_MESSAGE]: RegenerateMessagePayload;
  [ChatCommands.STOP_GENERATION]: StopGenerationPayload;
  [ChatCommands.CREATE_CONVERSATION]: CreateConversationPayload;
  [ChatCommands.UPDATE_CONVERSATION]: UpdateConversationPayload;
  [ChatCommands.DELETE_CONVERSATION]: DeleteConversationPayload;
  [ChatCommands.SELECT_CONVERSATION]: SelectConversationPayload;
  [ChatCommands.CLEAR_CONVERSATION]: ClearConversationPayload;
}
