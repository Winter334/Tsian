import type { ResultFrame } from "@/domain/types/result-frame";
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

export interface OperationLogEntry {
  /** 唯一标识 */
  id: string;
  /** 操作来源描述（如 "使用 火焰瓶"） */
  source: string;
  /** 引擎产生的 ResultFrame */
  resultFrame: ResultFrame;
  /** 操作时间戳 */
  timestamp: number;
}

export interface OperationLogState {
  /** 日志条目列表 */
  entries: OperationLogEntry[];

  /** 添加条目 */
  addEntry(entry: Omit<OperationLogEntry, "id">): void;

  /** 消费并清空所有条目（IRNR 启动时调用），返回 ResultFrame 列表 */
  consumeAll(): ResultFrame[];

  /** 清空 */
  clear(): void;
}

function createOperationLogEntryId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return `oplog-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export const useOperationLogStore = create<OperationLogState>()(
  immer((set, get) => ({
    entries: [],

    addEntry(entry) {
      const nextEntry: OperationLogEntry = {
        ...entry,
        id: createOperationLogEntryId(),
      };
      set({ entries: [...get().entries, nextEntry] });
    },

    consumeAll() {
      const resultFrames = get().entries.map((entry) => entry.resultFrame);
      set({ entries: [] });
      return resultFrames;
    },

    clear() {
      set({ entries: [] });
    },
  })),
);
