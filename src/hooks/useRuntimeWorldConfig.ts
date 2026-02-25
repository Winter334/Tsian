import { useMemo } from "react";

import { getRuntimeWorldConfig } from "@/lib/world/resolve-config";
import type { WorldConfig } from "@/lib/world/types";
import { useCurrentSaveId } from "@/modules";

/**
 * 读取运行时 WorldConfig（来自当前存档快照）
 *
 * 当切换存档时会自动重新获取。
 */
export function useRuntimeWorldConfig(): WorldConfig {
  const currentSaveId = useCurrentSaveId();
  return useMemo(() => {
    void currentSaveId;
    return getRuntimeWorldConfig();
  }, [currentSaveId]);
}
