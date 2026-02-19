/**
 * useAiStatus Hook
 *
 * 监听 TurnDoc 中的 AI 处理状态
 * 包括 aiStatus、aiError、aiAborted 字段
 *
 * @module room/hooks/useAiStatus
 */

import { subdocManager } from "@/core/yjs";
import type { AiAborted, AiError, AiStatus } from "@/core/yjs/room/types";
import { useCallback, useSyncExternalStore } from "react";
import type * as Y from "yjs";
import { useTurnDocStatus } from "./useTurnDocStatus";

/**
 * AI 状态信息
 */
export interface AiStatusInfo {
  /** AI 处理状态 */
  status: AiStatus;
  /** 错误信息（仅 failed 状态有值） */
  error: AiError | null;
  /** 中断信息（仅 aborted 状态有值） */
  aborted: AiAborted | null;
  /** 是否正在处理中 */
  isProcessing: boolean;
  /** 是否正在重试 */
  isRetrying: boolean;
  /** 是否已完成 */
  isCompleted: boolean;
  /** 是否失败 */
  isFailed: boolean;
  /** 是否已中断 */
  isAborted: boolean;
}

/**
 * 从 TurnDoc 读取 AI 状态
 */
function readAiStatusFromDoc(turnDoc: Y.Doc | null): AiStatusInfo {
  if (!turnDoc) {
    return {
      status: "idle",
      error: null,
      aborted: null,
      isProcessing: false,
      isRetrying: false,
      isCompleted: false,
      isFailed: false,
      isAborted: false,
    };
  }

  const configMap = turnDoc.getMap("config");
  const status = (configMap.get("aiStatus") as AiStatus) || "idle";
  const error = (configMap.get("aiError") as AiError) || null;
  const aborted = (configMap.get("aiAborted") as AiAborted) || null;

  return {
    status,
    error,
    aborted,
    isProcessing: status === "processing",
    isRetrying: status === "retrying",
    isCompleted: status === "completed",
    isFailed: status === "failed",
    isAborted: status === "aborted",
  };
}

/**
 * 序列化 AI 状态用于比较
 */
function serializeAiStatus(info: AiStatusInfo): string {
  return JSON.stringify({
    status: info.status,
    error: info.error,
    aborted: info.aborted,
  });
}

/**
 * useAiStatus Hook
 *
 * 监听指定回合的 AI 处理状态变化
 *
 * @param roomId - 房间 ID
 * @param turnNumber - 回合号
 * @returns AI 状态信息
 */
export function useAiStatus(
  roomId: string | null,
  turnNumber: number
): AiStatusInfo {
  // 监听 TurnDoc 同步状态
  const turnDocStatus = useTurnDocStatus(roomId, turnNumber);

  // 订阅函数 - 仅在 TurnDoc 同步后设置观察器
  const subscribe = useCallback(
    (callback: () => void) => {
      if (!roomId || turnNumber <= 0) {
        return () => {};
      }

      // 只在 TurnDoc 同步后设置观察器
      if (turnDocStatus !== "synced") {
        return () => {};
      }

      const turnDoc = subdocManager.getTurnDoc(roomId, turnNumber);
      if (!turnDoc) {
        return () => {};
      }

      const configMap = turnDoc.getMap("config");

      // 观察 config Map 变化
      const observer = () => {
        callback();
      };

      configMap.observe(observer);

      return () => {
        configMap.unobserve(observer);
      };
    },
    [roomId, turnNumber, turnDocStatus] // 添加 turnDocStatus 依赖
  );

  // 获取快照 - 添加 turnDocStatus 依赖确保在同步后重新计算
  const getSnapshot = useCallback(() => {
    if (!roomId || turnNumber <= 0 || turnDocStatus !== "synced") {
      return serializeAiStatus(readAiStatusFromDoc(null));
    }

    const turnDoc = subdocManager.getTurnDoc(roomId, turnNumber);
    return serializeAiStatus(readAiStatusFromDoc(turnDoc));
  }, [roomId, turnNumber, turnDocStatus]); // 添加 turnDocStatus 依赖

  // 服务端快照
  const getServerSnapshot = useCallback(
    () => serializeAiStatus(readAiStatusFromDoc(null)),
    []
  );

  // 使用 useSyncExternalStore 订阅
  const serialized = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );

  // 解析并返回完整状态
  const parsed = JSON.parse(serialized) as {
    status: AiStatus;
    error: AiError | null;
    aborted: AiAborted | null;
  };

  return {
    status: parsed.status,
    error: parsed.error,
    aborted: parsed.aborted,
    isProcessing: parsed.status === "processing",
    isRetrying: parsed.status === "retrying",
    isCompleted: parsed.status === "completed",
    isFailed: parsed.status === "failed",
    isAborted: parsed.status === "aborted",
  };
}

/**
 * useAiStatusWithDoc Hook
 *
 * 直接从 TurnDoc 实例监听 AI 状态
 *
 * @param turnDoc - TurnDoc 实例
 * @returns AI 状态信息
 */
export function useAiStatusWithDoc(turnDoc: Y.Doc | null): AiStatusInfo {
  // 订阅函数
  const subscribe = useCallback(
    (callback: () => void) => {
      if (!turnDoc) {
        return () => {};
      }

      const configMap = turnDoc.getMap("config");

      const observer = () => {
        callback();
      };

      configMap.observe(observer);

      return () => {
        configMap.unobserve(observer);
      };
    },
    [turnDoc]
  );

  // 获取快照
  const getSnapshot = useCallback(() => {
    return serializeAiStatus(readAiStatusFromDoc(turnDoc));
  }, [turnDoc]);

  // 服务端快照
  const getServerSnapshot = useCallback(
    () => serializeAiStatus(readAiStatusFromDoc(null)),
    []
  );

  const serialized = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );

  const parsed = JSON.parse(serialized) as {
    status: AiStatus;
    error: AiError | null;
    aborted: AiAborted | null;
  };

  return {
    status: parsed.status,
    error: parsed.error,
    aborted: parsed.aborted,
    isProcessing: parsed.status === "processing",
    isRetrying: parsed.status === "retrying",
    isCompleted: parsed.status === "completed",
    isFailed: parsed.status === "failed",
    isAborted: parsed.status === "aborted",
  };
}
