/**
 * ResultFrame 统一读取接口
 *
 * 根据模式（单人/联机）从不同存储位置读取 ResultFrame：
 * - 联机：TurnDoc.resultFrame Map
 * - 单人：Message.metadata.resultFrame
 */

import {
  subdocManager,
  updateResolveStatus,
  writeResultFrameToTurnDoc,
} from "@/core/yjs";
import type { ResultFrame } from "@/domain/types";

/**
 * 游戏上下文（用于定位 ResultFrame）
 */
export interface GameContext {
  mode: "solo" | "multiplayer";
  /** 联机模式必填 */
  roomId?: string;
  /** 联机模式必填 */
  turnNumber?: number;
  /** 单人模式：从消息 metadata 读取 */
  messageMetadata?: Record<string, unknown>;
}

/**
 * 从联机 TurnDoc 读取 ResultFrame
 */
function readFromTurnDoc(
  roomId: string,
  turnNumber: number
): ResultFrame | null {
  const turnDoc = subdocManager.getTurnDoc(roomId, turnNumber);
  if (!turnDoc) return null;

  const resultFrameMap = turnDoc.getMap("resultFrame");
  const data = resultFrameMap.get("data");
  if (!data) return null;

  return data as ResultFrame;
}

/**
 * 从消息 metadata 读取 ResultFrame
 */
function readFromMessageMetadata(
  metadata?: Record<string, unknown>
): ResultFrame | null {
  if (!metadata) return null;
  const frame = metadata["resultFrame"];
  if (!frame) return null;
  return frame as ResultFrame;
}

/**
 * 统一读取 ResultFrame
 */
export function getResultFrame(context: GameContext): ResultFrame | null {
  if (context.mode === "multiplayer") {
    if (!context.roomId || context.turnNumber === undefined) {
      return null;
    }
    return readFromTurnDoc(context.roomId, context.turnNumber);
  } else {
    return readFromMessageMetadata(context.messageMetadata);
  }
}

export { updateResolveStatus, writeResultFrameToTurnDoc };
