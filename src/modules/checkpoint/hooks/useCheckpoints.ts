/**
 * Checkpoint 数据 Hooks - 订阅当前存档中的检查点列表
 *
 * 这些 Hooks 直接监听 Yjs 中 saveDoc.checkpoints 的变化，
 * 为 UI 提供响应式读取能力。
 */

import { useEffect, useState } from "react";
import * as Y from "yjs";

import { yjsManager } from "@/core/yjs";
import type { Checkpoint } from "@/domain/entities";
import { useCurrentSaveId } from "@/hooks/useCurrentSaveId";

/**
 * 获取 saveDoc 上的 checkpoints 数组
 */
function getCheckpointsArray(saveDoc: Y.Map<unknown>): Y.Array<unknown> | null {
  const checkpoints = saveDoc.get("checkpoints");
  return checkpoints instanceof Y.Array ? checkpoints : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toCheckpoint(value: unknown): Checkpoint | null {
  if (!isRecord(value)) return null;
  if (typeof value.id !== "string") return null;
  if (typeof value.label !== "string") return null;
  if (typeof value.createdAt !== "number") return null;
  if (value.source !== "auto" && value.source !== "manual") return null;

  return value as unknown as Checkpoint;
}

function getSortedCheckpoints(
  checkpointsArray: Y.Array<unknown> | null,
): Checkpoint[] {
  if (!checkpointsArray) return [];

  const checkpoints: Checkpoint[] = [];
  for (const value of checkpointsArray.toArray()) {
    const checkpoint = toCheckpoint(value);
    if (checkpoint) {
      checkpoints.push(checkpoint);
    }
  }

  checkpoints.sort((a, b) => b.createdAt - a.createdAt);
  return checkpoints;
}

/**
 * 返回当前存档的所有检查点（按 createdAt 降序）
 */
export function useCheckpoints(): Checkpoint[] {
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const currentSaveId = useCurrentSaveId();

  useEffect(() => {
    const saveDoc = yjsManager.getCurrentSave();
    if (!saveDoc) {
      setCheckpoints([]);
      return;
    }

    let checkpointsArray = getCheckpointsArray(saveDoc);

    const syncCheckpoints = () => {
      setCheckpoints(getSortedCheckpoints(checkpointsArray));
    };

    const handleCheckpointsChange = () => {
      syncCheckpoints();
    };

    const handleSaveDocChange = (event: Y.YMapEvent<unknown>) => {
      if (!event.keysChanged.has("checkpoints")) {
        return;
      }

      if (checkpointsArray) {
        checkpointsArray.unobserve(handleCheckpointsChange);
      }

      checkpointsArray = getCheckpointsArray(saveDoc);

      if (checkpointsArray) {
        checkpointsArray.observe(handleCheckpointsChange);
      }

      syncCheckpoints();
    };

    saveDoc.observe(handleSaveDocChange);

    if (checkpointsArray) {
      checkpointsArray.observe(handleCheckpointsChange);
    }

    syncCheckpoints();

    return () => {
      saveDoc.unobserve(handleSaveDocChange);

      if (checkpointsArray) {
        checkpointsArray.unobserve(handleCheckpointsChange);
      }
    };
  }, [currentSaveId]);

  return checkpoints;
}

/**
 * 返回当前存档检查点数量
 */
export function useCheckpointCount(): number {
  return useCheckpoints().length;
}
