/**
 * useAiResponse Hook
 *
 * 使用 useSyncExternalStore 监听 TurnDoc 中的 AI 响应 (Y.Text)
 * 实现实时流式响应同步
 *
 * @module room/hooks/useAiResponse
 */

import { subdocManager } from "@/core/yjs";
import { useCallback, useSyncExternalStore } from "react";
import type * as Y from "yjs";

/**
 * useAiResponse Hook
 *
 * 监听指定回合的 AI 响应内容变化
 * 使用 useSyncExternalStore 实现高效订阅
 *
 * @param roomId - 房间 ID
 * @param turnNumber - 回合号
 * @returns AI 响应文本内容
 */
export function useAiResponse(
  roomId: string | null,
  turnNumber: number
): string {
  // 订阅函数：监听 Y.Text 变化
  const subscribe = useCallback(
    (callback: () => void) => {
      if (!roomId || turnNumber <= 0) {
        return () => {};
      }

      const turnDoc = subdocManager.getTurnDoc(roomId, turnNumber);
      if (!turnDoc) {
        return () => {};
      }

      const yText = turnDoc.getText("aiResponse");

      // 观察 Y.Text 变化
      const observer = () => {
        callback();
      };

      yText.observe(observer);

      return () => {
        yText.unobserve(observer);
      };
    },
    [roomId, turnNumber]
  );

  // 获取快照
  const getSnapshot = useCallback(() => {
    if (!roomId || turnNumber <= 0) {
      return "";
    }

    const turnDoc = subdocManager.getTurnDoc(roomId, turnNumber);
    if (!turnDoc) {
      return "";
    }

    const yText = turnDoc.getText("aiResponse");
    return yText.toString();
  }, [roomId, turnNumber]);

  // 服务端快照（SSR 兼容）
  const getServerSnapshot = useCallback(() => "", []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * useAiResponseWithDoc Hook
 *
 * 直接从 TurnDoc 实例监听 AI 响应
 * 适用于已有 TurnDoc 引用的场景
 *
 * @param turnDoc - TurnDoc 实例
 * @returns AI 响应文本内容
 */
export function useAiResponseWithDoc(turnDoc: Y.Doc | null): string {
  // 订阅函数
  const subscribe = useCallback(
    (callback: () => void) => {
      if (!turnDoc) {
        return () => {};
      }

      const yText = turnDoc.getText("aiResponse");

      const observer = () => {
        callback();
      };

      yText.observe(observer);

      return () => {
        yText.unobserve(observer);
      };
    },
    [turnDoc]
  );

  // 获取快照
  const getSnapshot = useCallback(() => {
    if (!turnDoc) {
      return "";
    }

    const yText = turnDoc.getText("aiResponse");
    return yText.toString();
  }, [turnDoc]);

  // 服务端快照
  const getServerSnapshot = useCallback(() => "", []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
