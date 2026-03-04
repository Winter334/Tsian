/**
 * room/awareness 子模块导出
 */

export {
  ROOM_ACTION_AWARENESS_FIELD,
  ROOM_ACTION_TYPING_TIMEOUT_MS,
} from "./constants";

export {
  decodeActionAwarenessState,
  decodeClientActionAwarenessState,
  encodeActionAwarenessState,
  parsePlayersActionInfo,
  toPlayerActionInfo,
} from "./codec";

export {
  readPlayersActionAwareness,
  subscribeActionAwareness,
  updateLocalActionAwareness,
} from "./service";

export type {
  ActionAwarenessState,
  ActionStatus,
  PlayerActionInfo,
} from "./types";
