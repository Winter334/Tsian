/**
 * 消息实体定义
 */

import type { Entity } from "../types";

/**
 * 消息角色
 */
export type MessageRole = "user" | "assistant" | "system";

/**
 * 消息状态
 */
export type MessageStatus = "pending" | "streaming" | "complete" | "error";

/**
 * 消息实体
 */
export interface Message extends Entity {
  /** 消息角色 */
  role: MessageRole;
  /** 消息内容 */
  content: string;
  /** 消息状态 */
  status: MessageStatus;
  /** 所属会话 ID */
  conversationId: string;
  /** 关联的角色 ID（用于多角色对话） */
  characterId?: string;
  /** 错误信息（status 为 error 时） */
  error?: string;
  /** 元数据（可扩展） */
  metadata?: Record<string, unknown>;
}

/**
 * 创建消息的参数
 */
export interface CreateMessageParams {
  role: MessageRole;
  content: string;
  conversationId: string;
  characterId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * 创建新消息
 */
export function createMessage(params: CreateMessageParams): Message {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    role: params.role,
    content: params.content,
    status: params.role === "assistant" ? "pending" : "complete",
    conversationId: params.conversationId,
    characterId: params.characterId,
    metadata: params.metadata,
    createdAt: now,
    updatedAt: now,
  };
}
