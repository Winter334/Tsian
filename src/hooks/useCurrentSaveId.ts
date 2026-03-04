import { useSyncExternalStore } from "react";

import { yjsManager } from "@/core/yjs";

/**
 * 订阅当前存档 ID
 *
 * 基于 useSyncExternalStore，避免轮询与事件漏订阅问题。
 */
export function useCurrentSaveId(): string | null {
  return useSyncExternalStore(
    (onStoreChange) => yjsManager.subscribeSaveId(onStoreChange),
    () => yjsManager.getCurrentSaveId(),
    () => null,
  );
}
