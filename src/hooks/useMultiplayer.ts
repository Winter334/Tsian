/**
 * useMultiplayer - 统一联机状态聚合 Hook
 *
 * 聚合联机场景下常用的状态读取 Hooks，提供单一消费入口：
 * - 会话信息（Session）
 * - 房间信息 / 成员
 * - 回合控制 / 行动状态
 * - 当前用户行动
 * - 房间角色
 *
 * 设计原则：
 * - 聚合而非替代：不修改底层 hooks，仅做组合封装
 * - 只读语义：仅返回状态，不暴露写入/命令操作
 * - 单机安全：非联机模式下返回稳定、可预期的默认值
 */

import type { ConnectionStatus, Member } from "@/core/yjs";
import type {
  MyActionState,
  PlayerActionState,
  TurnControlState,
  UseRoomCharactersResult,
  UseTurnActionsReturn,
} from "@/modules";
import {
  useMyAction,
  useRoomCharacters,
  useRoomInfo,
  useRoomMembers,
  useTurnActions,
  useTurnControl,
} from "@/modules";
import { useSessionStore } from "@/stores";

interface EmptyRoomInfo {
  mode: "offline";
  currentRoom: null;
  error: null;
  isLoading: false;
}

const EMPTY_ROOM_INFO: EmptyRoomInfo = {
  mode: "offline",
  currentRoom: null,
  error: null,
  isLoading: false,
};

const EMPTY_MEMBERS: Member[] = [];
const EMPTY_TURN_CONTROL: TurnControlState = {
  turnNumber: 0,
  deadline: 0,
  totalDuration: 0,
  remainingSeconds: 0,
  isTimeout: false,
  isLocked: false,
  playersStatus: [],
  submittedCount: 0,
  totalPlayers: 0,
  allSubmitted: false,
  unsubmittedPlayers: [],
};

const EMPTY_TURN_ACTIONS: Omit<UseTurnActionsReturn, "refresh"> = {
  players: [],
  submittedCount: 0,
  totalPlayers: 0,
  allSubmitted: false,
  isLocked: false,
  lockReason: null,
  loading: false,
};

const EMPTY_MY_ACTION: MyActionState & { loading: false } = {
  isSubmitted: false,
  content: "",
  submittedAt: null,
  isLocked: false,
  lockedAt: null,
  loading: false,
};

const EMPTY_ROOM_CHARACTERS: Omit<UseRoomCharactersResult, "refresh"> = {
  characters: [],
  myCharacter: null,
  hasCharacter: false,
};

export interface UseMultiplayerReturn {
  // ===== 基础状态 =====
  isOnline: boolean;
  isMultiplayer: boolean;
  mode: "offline" | "online";
  roomId: string | null;
  isHost: boolean;
  connectionStatus: ConnectionStatus;
  localUserId: string;

  // ===== 房间信息 =====
  room: ReturnType<typeof useRoomInfo>["currentRoom"];
  roomError: ReturnType<typeof useRoomInfo>["error"];
  roomLoading: boolean;

  // ===== 成员 =====
  members: Member[];
  memberCount: number;

  // ===== 回合控制 =====
  turnNumber: number;
  deadline: number;
  totalDuration: number;
  remainingSeconds: number;
  isTimeout: boolean;
  isLocked: boolean;
  submittedCount: number;
  totalPlayers: number;
  allSubmitted: boolean;
  unsubmittedPlayers: PlayerActionState[];

  // ===== 回合行动 =====
  turnActions: PlayerActionState[];
  turnActionsLoading: boolean;
  turnLockReason: string | null;

  // ===== 当前用户行动 =====
  myActionSubmitted: boolean;
  myActionContent: string;
  myActionSubmittedAt: number | null;
  myActionLocked: boolean;
  myActionLockedAt: number | null;
  myActionLoading: boolean;

  // ===== 房间角色 =====
  roomCharacters: UseRoomCharactersResult["characters"];
  myCharacter: UseRoomCharactersResult["myCharacter"];
  hasCharacter: boolean;
}

/**
 * 统一联机状态聚合 hook
 */
export function useMultiplayer(): UseMultiplayerReturn {
  const mode = useSessionStore((s) => s.mode);
  const saveType = useSessionStore((s) => s.saveType);
  const roomId = useSessionStore((s) => s.roomId);
  const isHost = useSessionStore((s) => s.isHost);
  const connectionStatus = useSessionStore((s) => s.connectionStatus);
  const localUserId = useSessionStore((s) => s.localUserId);

  const isOnline = mode === "online";
  const isMultiplayer = saveType === "multiplayer" || isOnline;

  // 始终调用底层 hooks，保证 Hook 调用顺序稳定
  const roomInfo = useRoomInfo();
  const members = useRoomMembers();
  const turnControl = useTurnControl(roomId ?? "");
  const turnActions = useTurnActions(roomId, turnControl.turnNumber);
  const myAction = useMyAction(roomId, turnControl.turnNumber);
  const roomCharacters = useRoomCharacters();

  // 单机模式安全兜底
  const safeRoomInfo = isMultiplayer ? roomInfo : EMPTY_ROOM_INFO;
  const safeMembers = isMultiplayer ? members : EMPTY_MEMBERS;
  const safeTurnControl = isMultiplayer ? turnControl : EMPTY_TURN_CONTROL;
  const safeTurnActions = isMultiplayer ? turnActions : EMPTY_TURN_ACTIONS;
  const safeMyAction = isMultiplayer ? myAction : EMPTY_MY_ACTION;
  const safeRoomCharacters = isMultiplayer
    ? roomCharacters
    : EMPTY_ROOM_CHARACTERS;

  return {
    // ===== 基础状态 =====
    isOnline,
    isMultiplayer,
    mode,
    roomId,
    isHost,
    connectionStatus,
    localUserId,

    // ===== 房间信息 =====
    room: safeRoomInfo.currentRoom,
    roomError: safeRoomInfo.error,
    roomLoading: safeRoomInfo.isLoading,

    // ===== 成员 =====
    members: safeMembers,
    memberCount: safeMembers.length,

    // ===== 回合控制 =====
    turnNumber: safeTurnControl.turnNumber,
    deadline: safeTurnControl.deadline,
    totalDuration: safeTurnControl.totalDuration,
    remainingSeconds: safeTurnControl.remainingSeconds,
    isTimeout: safeTurnControl.isTimeout,
    isLocked: safeTurnControl.isLocked,
    submittedCount: safeTurnControl.submittedCount,
    totalPlayers: safeTurnControl.totalPlayers,
    allSubmitted: safeTurnControl.allSubmitted,
    unsubmittedPlayers: safeTurnControl.unsubmittedPlayers,

    // ===== 回合行动 =====
    turnActions: safeTurnActions.players,
    turnActionsLoading: safeTurnActions.loading,
    turnLockReason: safeTurnActions.lockReason,

    // ===== 当前用户行动 =====
    myActionSubmitted: safeMyAction.isSubmitted,
    myActionContent: safeMyAction.content,
    myActionSubmittedAt: safeMyAction.submittedAt,
    myActionLocked: safeMyAction.isLocked,
    myActionLockedAt: safeMyAction.lockedAt,
    myActionLoading: safeMyAction.loading,

    // ===== 房间角色 =====
    roomCharacters: safeRoomCharacters.characters,
    myCharacter: safeRoomCharacters.myCharacter,
    hasCharacter: safeRoomCharacters.hasCharacter,
  };
}
