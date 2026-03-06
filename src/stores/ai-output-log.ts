/**
 * AI 输出日志 Store（会话级，纯内存）
 */

import type { TurnDelta } from "@/domain/types";
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

/** AI 来源 */
export type AiOutputSource =
  | "director"
  | "parser"
  | "narrator"
  | "summarizer"
  | "system";

/** AI 输出日志条目 */
export interface AiOutputEntry {
  /** 唯一 ID */
  id: string;
  /** 回合号 */
  turn: number;
  /** AI 来源 */
  source: AiOutputSource;
  /** 回合内执行序号（从 0 开始，越小越早） */
  sequenceIndex: number;
  /** AI 原始输出（完整文本） */
  rawOutput: string;
  /** Delta 链快照（最小可观测接入） */
  deltas?: TurnDelta[];
  /** 耗时（ms） */
  duration?: number;
  /** 是否成功 */
  success: boolean;
  /** 错误信息（失败时） */
  error?: string;
  /** 时间戳 */
  timestamp: number;
  /** 关联 ID（用于追踪因果链，贯穿同一回合的所有日志） */
  correlationId?: string;
}

interface AiOutputLogState {
  /** 所有日志条目（按时间正序） */
  entries: AiOutputEntry[];

  /** 追加日志 — 自动生成 id，超过上限时淘汰最早的 */
  appendEntry(entry: Omit<AiOutputEntry, "id">): void;

  /** 清空日志 */
  clear(): void;
}

const AI_OUTPUT_LOG_LIMIT = 200;

export const useAiOutputLogStore = create<AiOutputLogState>()(
  immer((set) => ({
    entries: [],

    appendEntry: (entry) => {
      set((state) => {
        state.entries.push({
          ...entry,
          id: crypto.randomUUID(),
        });

        if (state.entries.length > AI_OUTPUT_LOG_LIMIT) {
          state.entries.splice(0, state.entries.length - AI_OUTPUT_LOG_LIMIT);
        }
      });
    },

    clear: () => {
      set((state) => {
        state.entries = [];
      });
    },
  })),
);
