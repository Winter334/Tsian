/**
 * TurnDoc 中 ResultFrame / resolveStatus 的统一访问器
 *
 * 用于在不同模块间复用同一写入入口，避免写入逻辑分叉。
 */

import type { ResolveStatus } from "./room/types";
import { subdocManager } from "./subdoc-manager";

export interface WritableResultFrame {
  frameId: string;
  timestamp: number;
}

export function writeResultFrameToTurnDoc<T extends WritableResultFrame>(
  roomId: string,
  turnNumber: number,
  frame: T
): boolean {
  const turnDoc = subdocManager.getTurnDoc(roomId, turnNumber);
  if (!turnDoc) return false;

  turnDoc.transact(() => {
    const resultFrameMap = turnDoc.getMap("resultFrame");
    resultFrameMap.set("data", frame);
    resultFrameMap.set("frameId", frame.frameId);
    resultFrameMap.set("generatedAt", frame.timestamp);

    const configMap = turnDoc.getMap("config");
    configMap.set("resolveStatus", "committed");
  });

  return true;
}

export function updateResolveStatus(
  roomId: string,
  turnNumber: number,
  status: ResolveStatus
): boolean {
  const turnDoc = subdocManager.getTurnDoc(roomId, turnNumber);
  if (!turnDoc) return false;

  const configMap = turnDoc.getMap("config");
  configMap.set("resolveStatus", status);
  return true;
}
