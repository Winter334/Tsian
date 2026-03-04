/**
 * room/awareness 协议编解码与状态转换
 */

import type { Member } from "@/core/yjs/room/types";

import {
  ROOM_ACTION_AWARENESS_FIELD,
  ROOM_ACTION_TYPING_TIMEOUT_MS,
} from "./constants";
import type {
  ActionAwarenessState,
  ActionStatus,
  PlayerActionInfo,
} from "./types";

const ACTION_STATUS_SET: ReadonlySet<ActionStatus> = new Set([
  "empty",
  "draft",
  "submitted",
  "locked",
]);

interface EncodeActionAwarenessInput {
  userId: string;
  displayName: string;
  status: ActionStatus;
  isTyping: boolean;
  now?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function toActionStatus(value: unknown): ActionStatus {
  if (
    typeof value === "string" &&
    ACTION_STATUS_SET.has(value as ActionStatus)
  ) {
    return value as ActionStatus;
  }
  return "empty";
}

function isStillTyping(state: ActionAwarenessState, now: number): boolean {
  return (
    state.isTyping &&
    state.lastTypingAt > 0 &&
    now - state.lastTypingAt < ROOM_ACTION_TYPING_TIMEOUT_MS
  );
}

/**
 * 编码本地 Action Awareness 协议状态
 */
export function encodeActionAwarenessState(
  input: EncodeActionAwarenessInput,
): ActionAwarenessState {
  const now = input.now ?? Date.now();

  return {
    id: input.userId,
    name: input.displayName,
    actionStatus: input.status,
    isTyping: input.isTyping,
    lastTypingAt: input.isTyping ? now : 0,
    lastActiveAt: now,
  };
}

/**
 * 从任意数据解码 Action Awareness 状态
 */
export function decodeActionAwarenessState(
  value: unknown,
): ActionAwarenessState | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = typeof value.id === "string" ? value.id : "";
  if (!id) {
    return null;
  }

  return {
    id,
    name: typeof value.name === "string" ? value.name : "",
    actionStatus: toActionStatus(value.actionStatus),
    isTyping: Boolean(value.isTyping),
    lastTypingAt: toNumber(value.lastTypingAt, 0),
    lastActiveAt: toNumber(value.lastActiveAt, 0),
  };
}

/**
 * 从客户端 Awareness 原始 state 解码 action 字段
 */
export function decodeClientActionAwarenessState(
  clientState: unknown,
): ActionAwarenessState | null {
  if (!isRecord(clientState)) {
    return null;
  }

  return decodeActionAwarenessState(clientState[ROOM_ACTION_AWARENESS_FIELD]);
}

/**
 * 转换为 UI 可消费的玩家状态
 */
export function toPlayerActionInfo(
  state: ActionAwarenessState,
  now: number,
): PlayerActionInfo {
  return {
    userId: state.id,
    displayName: state.name,
    status: state.actionStatus,
    isTyping: isStillTyping(state, now),
  };
}

/**
 * 解析所有远端状态并排序
 */
export function parsePlayersActionInfo(
  states: Map<number, unknown>,
  members: readonly Member[],
  now = Date.now(),
): PlayerActionInfo[] {
  const players = Array.from(states.values())
    .map((state) => decodeClientActionAwarenessState(state))
    .filter((state): state is ActionAwarenessState => state !== null)
    .map((state) => toPlayerActionInfo(state, now));

  const memberOrder = new Map(
    members.map((member, index) => [member.userId, index]),
  );
  const resolveOrder = (userId: string): number =>
    memberOrder.get(userId) ?? -1;

  players.sort((a, b) => resolveOrder(a.userId) - resolveOrder(b.userId));

  return players;
}
