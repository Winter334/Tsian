/**
 * Chat Repository - 封装 Yjs 操作的数据访问层
 *
 * 职责：
 * 1. 封装所有 Yjs 文档操作
 * 2. 提供类型安全的读写接口
 * 3. 自动发布领域事件
 * 4. 统一错误处理
 */

import { eventBus } from "@/core/event-bus";
import type { Conversation } from "@/domain/entities/conversation";
import type { Message } from "@/domain/entities/message";
import { ChatEvents } from "@/domain/events/chat";
import * as Y from "yjs";

/**
 * Chat Repository 类
 */
export class ChatRepository {
  constructor(private saveDoc: Y.Map<unknown>) {
    this.ensureStructure();
  }

  // ============ 私有辅助方法 ============

  /**
   * 确保存档文档结构存在
   */
  private ensureStructure(): void {
    if (!this.saveDoc.has("conversations")) {
      this.saveDoc.set("conversations", new Y.Map());
    }
    if (!this.saveDoc.has("messages")) {
      this.saveDoc.set("messages", new Y.Map());
    }
  }

  /**
   * 获取 conversations Map
   */
  private getConversationsMap(): Y.Map<Conversation> {
    return this.saveDoc.get("conversations") as Y.Map<Conversation>;
  }

  /**
   * 获取 messages Map
   */
  private getMessagesMap(): Y.Map<Y.Array<Message>> {
    return this.saveDoc.get("messages") as Y.Map<Y.Array<Message>>;
  }

  // ============ 写操作（Command Handler 调用） ============

  /**
   * 添加会话
   */
  addConversation(conversation: Conversation): void {
    const conversationsMap = this.getConversationsMap();
    conversationsMap.set(conversation.id, conversation);

    // 初始化该会话的消息列表
    const messagesMap = this.getMessagesMap();
    if (!messagesMap.has(conversation.id)) {
      messagesMap.set(conversation.id, new Y.Array<Message>());
    }

    // 发布事件
    eventBus.emit(
      eventBus.createEvent(ChatEvents.CONVERSATION_CREATED, { conversation })
    );
  }

  /**
   * 更新会话
   */
  updateConversation(id: string, updates: Partial<Conversation>): void {
    const conversationsMap = this.getConversationsMap();
    const conversation = conversationsMap.get(id);

    if (!conversation) {
      return;
    }

    const updatedConversation: Conversation = {
      ...conversation,
      ...updates,
      updatedAt: Date.now(),
    };

    conversationsMap.set(id, updatedConversation);

    // 发布事件
    eventBus.emit(
      eventBus.createEvent(ChatEvents.CONVERSATION_UPDATED, {
        conversation: updatedConversation,
      })
    );
  }

  /**
   * 删除会话
   */
  deleteConversation(conversationId: string): void {
    const conversationsMap = this.getConversationsMap();
    const messagesMap = this.getMessagesMap();

    // 删除会话
    conversationsMap.delete(conversationId);

    // 删除该会话的所有消息
    messagesMap.delete(conversationId);

    // 发布事件
    eventBus.emit(
      eventBus.createEvent(ChatEvents.CONVERSATION_DELETED, { conversationId })
    );
  }

  /**
   * 添加消息
   */
  addMessage(conversationId: string, message: Message): void {
    const messagesMap = this.getMessagesMap();
    let messages = messagesMap.get(conversationId);

    // 如果该会话的消息列表不存在，创建一个
    if (!messages) {
      messages = new Y.Array<Message>();
      messagesMap.set(conversationId, messages);
    }

    messages.push([message]);

    // 发布事件
    eventBus.emit(
      eventBus.createEvent(ChatEvents.MESSAGE_CREATED, { message })
    );
  }

  /**
   * 更新消息
   *
   * 注意：Yjs Array 不支持直接修改元素，需要 delete + insert
   */
  updateMessage(
    conversationId: string,
    messageId: string,
    updates: Partial<Message>
  ): void {
    const messagesMap = this.getMessagesMap();
    const messages = messagesMap.get(conversationId);

    if (!messages) {
      return;
    }

    const messageArray = messages.toArray();
    const index = messageArray.findIndex((m) => m.id === messageId);

    if (index === -1) {
      return;
    }

    const currentMessage = messageArray[index];
    const updatedMessage: Message = {
      ...currentMessage,
      ...updates,
      updatedAt: Date.now(),
    };

    // Yjs Array 更新：先删除，再插入
    messages.delete(index, 1);
    messages.insert(index, [updatedMessage]);

    // 发布事件
    eventBus.emit(
      eventBus.createEvent(ChatEvents.MESSAGE_UPDATED, {
        message: updatedMessage,
      })
    );
  }

  /**
   * 删除消息
   */
  deleteMessage(conversationId: string, messageId: string): void {
    const messagesMap = this.getMessagesMap();
    const messages = messagesMap.get(conversationId);

    if (!messages) {
      return;
    }

    const messageArray = messages.toArray();
    const index = messageArray.findIndex((m) => m.id === messageId);

    if (index === -1) {
      return;
    }

    messages.delete(index, 1);

    // 发布事件
    eventBus.emit(
      eventBus.createEvent(ChatEvents.MESSAGE_DELETED, {
        messageId,
        conversationId,
      })
    );
  }

  /**
   * 清空会话的所有消息
   */
  clearMessages(conversationId: string): void {
    const messagesMap = this.getMessagesMap();
    messagesMap.set(conversationId, new Y.Array<Message>());
  }

  // ============ 读操作（任何地方都可调用） ============

  /**
   * 获取单个会话
   */
  getConversation(id: string): Conversation | undefined {
    const conversationsMap = this.getConversationsMap();
    return conversationsMap.get(id);
  }

  /**
   * 获取所有会话
   */
  getAllConversations(): Conversation[] {
    const conversationsMap = this.getConversationsMap();
    return Array.from(conversationsMap.values());
  }

  /**
   * 获取会话的所有消息
   */
  getMessages(conversationId: string): Message[] {
    const messagesMap = this.getMessagesMap();
    const messages = messagesMap.get(conversationId);
    return messages ? messages.toArray() : [];
  }

  /**
   * 获取单条消息
   */
  getMessage(conversationId: string, messageId: string): Message | undefined {
    const messages = this.getMessages(conversationId);
    return messages.find((m) => m.id === messageId);
  }

  /**
   * 获取会话数量
   */
  getConversationCount(): number {
    const conversationsMap = this.getConversationsMap();
    return conversationsMap.size;
  }

  /**
   * 获取会话的消息数量
   */
  getMessageCount(conversationId: string): number {
    return this.getMessages(conversationId).length;
  }
}
