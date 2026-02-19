/**
 * StreamSession — 流式会话辅助类
 *
 * 封装流式消息的 chunk 追加、完成、失败、清理操作，
 * 供 IRNR 路径和直连路径共用，消除重复的 chunk 更新逻辑。
 *
 * 设计原则：
 * - 不拥有业务逻辑决策权，只统一消息状态管理
 * - 幂等清理：ensureCleanup() 可多次调用无副作用
 * - 清理职责：仅负责重置 streamingMessageId 和 loading 状态
 */

import type { DomainEvent } from "@/core/event-bus";
import { ChatEvents } from "@/domain/events/chat";
import type { ChatRepository } from "../repository";

// ── 最小依赖接口（避免耦合具体实现） ──

/** EventBus 最小接口 */
interface EventBusLike {
  emit<T>(event: DomainEvent<T>, options?: { correlationId?: string }): void;
  createEvent<T>(type: string, payload: T): DomainEvent<T>;
}

/** UI Store 最小接口 */
interface UIStoreLike {
  setStreamingMessageId: (id: string | null) => void;
  setLoading: (loading: boolean) => void;
}

// ── StreamSession ──

export interface StreamSessionConfig {
  repository: ChatRepository;
  uiStore: UIStoreLike;
  eventBus: EventBusLike;
  messageId: string;
  conversationId: string;
  correlationId: string;
}

export class StreamSession {
  private cleaned = false;

  constructor(private config: StreamSessionConfig) {}

  /**
   * 追加流式 chunk（IRNR 和直连共用）
   *
   * 从 repository 读取当前消息内容，追加 chunk，
   * 更新消息状态为 "streaming"，并发布 STREAM_CHUNK 事件。
   */
  appendChunk(chunk: string): void {
    const { repository, eventBus, messageId, conversationId, correlationId } =
      this.config;

    const currentMessage = repository.getMessage(conversationId, messageId);
    const currentContent = currentMessage?.content ?? "";

    repository.updateMessage(conversationId, messageId, {
      content: currentContent + chunk,
      status: "streaming",
    });

    eventBus.emit(
      eventBus.createEvent(ChatEvents.STREAM_CHUNK, {
        messageId,
        chunk,
      }),
      { correlationId }
    );
  }

  /**
   * 流式完成
   *
   * 设置消息最终内容和 "complete" 状态，发布 STREAM_END 事件，
   * 然后执行清理。
   */
  complete(finalContent: string, metadata?: Record<string, unknown>): void {
    const { repository, eventBus, messageId, conversationId, correlationId } =
      this.config;

    repository.updateMessage(conversationId, messageId, {
      content: finalContent,
      status: "complete",
      ...(metadata ? { metadata } : {}),
    });

    eventBus.emit(
      eventBus.createEvent(ChatEvents.STREAM_END, {
        messageId,
        finalContent,
      }),
      { correlationId }
    );

    this.cleanup();
  }

  /**
   * 流式失败
   *
   * 设置消息为 "error" 状态，发布 STREAM_ERROR 事件，
   * 然后执行清理。
   */
  fail(error: string): void {
    const { repository, eventBus, messageId, conversationId, correlationId } =
      this.config;

    repository.updateMessage(conversationId, messageId, {
      status: "error",
      error,
    });

    eventBus.emit(
      eventBus.createEvent(ChatEvents.STREAM_ERROR, {
        messageId,
        error,
      }),
      { correlationId }
    );

    this.cleanup();
  }

  /**
   * 幂等清理（用于 finally 块兜底）
   *
   * 可多次调用，仅首次实际执行清理操作。
   */
  ensureCleanup(): void {
    this.cleanup();
  }

  private cleanup(): void {
    if (this.cleaned) return;
    this.cleaned = true;
    this.config.uiStore.setStreamingMessageId(null);
    this.config.uiStore.setLoading(false);
  }
}
