/**
 * 事件订阅 Hook
 */

import { eventBus, type DomainEvent, type EventHandler } from "@/core";
import { useEffect, useRef } from "react";

/**
 * 订阅事件的 Hook
 *
 * @param eventType 事件类型
 * @param handler 事件处理函数
 *
 * @example
 * ```tsx
 * useEvent(ChatEvents.MESSAGE_CREATED, (event) => {
 *   console.log('New message:', event.payload.message);
 * });
 * ```
 */
export function useEvent<T>(eventType: string, handler: EventHandler<T>): void {
  // 使用 ref 保存最新的 handler，避免重复订阅
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const wrappedHandler = (event: DomainEvent<T>) => {
      handlerRef.current(event);
    };

    const unsubscribe = eventBus.on<T>(eventType, wrappedHandler);
    return unsubscribe;
  }, [eventType]);
}
