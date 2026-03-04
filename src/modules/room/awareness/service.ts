/**
 * room/awareness 与 provider 交互封装
 */

import { multiplayerProvider } from "@/core/yjs";
import type { Member } from "@/core/yjs/room/types";
import type { Awareness } from "y-protocols/awareness";

import { encodeActionAwarenessState, parsePlayersActionInfo } from "./codec";
import { ROOM_ACTION_AWARENESS_FIELD } from "./constants";
import type { ActionStatus, PlayerActionInfo } from "./types";

function getAwareness(): Awareness | null {
  return multiplayerProvider.getAwareness();
}

interface UpdateLocalActionAwarenessParams {
  userId: string;
  displayName: string;
  status: ActionStatus;
  isTyping: boolean;
}

/**
 * 写入本地 Action Awareness 状态
 */
export function updateLocalActionAwareness(
  params: UpdateLocalActionAwarenessParams,
): void {
  if (!params.userId) {
    return;
  }

  const awareness = getAwareness();
  if (!awareness) {
    return;
  }

  const state = encodeActionAwarenessState({
    userId: params.userId,
    displayName: params.displayName,
    status: params.status,
    isTyping: params.isTyping,
  });

  awareness.setLocalStateField(ROOM_ACTION_AWARENESS_FIELD, state);
}

/**
 * 读取全部玩家 Action Awareness 状态
 */
export function readPlayersActionAwareness(
  members: readonly Member[],
): PlayerActionInfo[] {
  const awareness = getAwareness();
  if (!awareness) {
    return [];
  }

  return parsePlayersActionInfo(awareness.getStates(), members);
}

/**
 * 订阅 Action Awareness 变化
 */
export function subscribeActionAwareness(
  members: readonly Member[],
  onChange: (players: PlayerActionInfo[]) => void,
): (() => void) | null {
  const awareness = getAwareness();
  if (!awareness) {
    return null;
  }

  const emit = () => {
    onChange(parsePlayersActionInfo(awareness.getStates(), members));
  };

  emit();
  awareness.on("change", emit);

  return () => {
    awareness.off("change", emit);
  };
}
