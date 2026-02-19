/**
 * 会话实体定义
 */

import type { Entity } from "../types";

/**
 * 会话实体
 */
export interface Conversation extends Entity {
  /** 会话标题 */
  title: string;
  /** 关联的角色 ID 列表 */
  characterIds: string[];
  /** 系统提示词 */
  systemPrompt?: string;
  /** 会话设置 */
  settings?: ConversationSettings;
  /** 元数据 */
  metadata?: Record<string, unknown>;
}

/**
 * 会话设置
 */
export interface ConversationSettings {
  /** 使用的模型 */
  model?: string;
  /** 温度 */
  temperature?: number;
  /** 最大 token 数 */
  maxTokens?: number;
}

/**
 * 创建会话的参数
 */
export interface CreateConversationParams {
  title?: string;
  characterIds?: string[];
  systemPrompt?: string;
  settings?: ConversationSettings;
}

/**
 * 创建新会话
 */
export function createConversation(
  params: CreateConversationParams = {}
): Conversation {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    title: params.title || "新对话",
    characterIds: params.characterIds || [],
    systemPrompt: params.systemPrompt,
    settings: params.settings,
    createdAt: now,
    updatedAt: now,
  };
}
