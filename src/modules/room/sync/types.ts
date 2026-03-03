/**
 * RoomSyncBridge 类型定义
 *
 * 定义房间同步所需的快照、差异、元数据等数据结构。
 * 这些类型是纯数据类型，不包含业务逻辑。
 *
 * 基于 room-sync-bridge-proposal.md 设计文档
 */

import type { Member, RoomStatus } from "@/core/yjs/room/types";

/**
 * 房间快照 - 从 Yjs 状态构建的可序列化快照
 *
 * 用于快照差异对比和事件派生
 */
export interface RoomSnapshot {
  /** 房间 ID */
  roomId: string;

  /** 房主用户 ID */
  hostUserId: string;

  /** 房间状态 */
  status: RoomStatus;

  /** 成员列表（按 userId 排序以保证一致性） */
  members: SnapshotMember[];

  /** 最大玩家数 */
  maxPlayers: number;

  /** 回合时长（毫秒） */
  turnDuration: number;

  /** 当前回合号 */
  currentTurnNumber: number;

  /** 当前阶段 ID */
  currentPhaseId: string | null;

  /** 世界档案实体数量 */
  worldArchiveEntityCount: number;

  /** 世界档案版本号（metadata.version，缺省为 0） */
  worldArchiveVersion: number;

  /** 世界档案更新时间戳（metadata.updatedAt，缺省为 0） */
  worldArchiveUpdatedAt: number;

  /** 快照创建时间 */
  updatedAt: number;
}

/**
 * 快照中的成员信息（精简版，用于差异对比）
 */
export interface SnapshotMember {
  /** 用户 ID */
  userId: string;

  /** 显示名称 */
  displayName: string;

  /** 角色 */
  role: Member["role"];

  /** 加入时间 */
  joinedAt: number;

  /** 在线状态 */
  status: Member["status"];
}

/**
 * 世界档案变化摘要（用于快照增量判定）
 */
export interface WorldArchiveSummary {
  entityCount: number;
  version: number;
  updatedAt: number;
}

/**
 * 快照差异结果
 */
export interface SnapshotDiff {
  /** 状态是否变化 */
  statusChanged: boolean;

  /** 状态变化详情 */
  status?: {
    prev: RoomStatus;
    next: RoomStatus;
  };

  /** 回合号是否变化 */
  turnNumberChanged: boolean;

  /** 回合号变化详情 */
  turnNumber?: {
    prev: number;
    next: number;
  };

  /** 阶段 ID 是否变化 */
  phaseIdChanged: boolean;

  /** 阶段 ID 变化详情 */
  phaseId?: {
    prev: string | null;
    next: string | null;
  };

  /** 房主是否变化 */
  hostChanged: boolean;

  /** 房主变化详情 */
  host?: {
    prev: string;
    next: string;
  };

  /** 世界档案是否变化 */
  worldArchiveChanged: boolean;

  /** 世界档案变化详情 */
  worldArchive?: {
    prevCount: number;
    nextCount: number;
    prevVersion: number;
    nextVersion: number;
    prevUpdatedAt: number;
    nextUpdatedAt: number;
  };

  /** 新加入的成员 */
  membersJoined: SnapshotMember[];

  /** 离开的成员 */
  membersLeft: SnapshotMember[];
}

/**
 * 成员操作类型（用于意图型事件）
 */
export type MemberActionType = "join" | "leave" | "kick" | "timeout";

/**
 * 成员事件元数据
 */
export interface MemberActionMeta {
  /** 操作类型 */
  action: MemberActionType;

  /** 操作者 ID（如踢人时的房主 ID） */
  by?: string;

  /** 原因描述 */
  reason?: string;

  /** 操作时间戳 */
  at: number;
}

/**
 * Host 转让类型
 */
export type HostTransferType = "manual" | "auto";

/**
 * Host 转让元数据
 */
export interface HostTransferMeta {
  /** 原房主 ID */
  from: string;

  /** 新房主 ID */
  to: string;

  /** 转让类型 */
  type: HostTransferType;

  /** 转让时间戳 */
  at: number;
}

/**
 * 事件元数据结构（存储在 Yjs MainDoc 中）
 *
 * 用于意图型事件的语义传递
 */
export interface EventMeta {
  /** 成员事件元数据（userId -> MemberActionMeta） */
  memberActions: Map<string, MemberActionMeta>;

  /** Host 转让元数据 */
  hostTransfer?: HostTransferMeta;
}

/**
 * SyncBridge 配置选项
 */
export interface SyncBridgeConfig {
  /** 节流延迟（毫秒），默认 50ms */
  throttleMs: number;

  /** 元数据延迟清理时间（毫秒），默认 5000ms */
  metaCleanupDelayMs: number;

  /** 元数据兜底清理时间（毫秒），默认 60000ms */
  metaStaleTimeoutMs: number;
}

/**
 * 默认 SyncBridge 配置
 */
export const DEFAULT_SYNC_BRIDGE_CONFIG: SyncBridgeConfig = {
  throttleMs: 50,
  metaCleanupDelayMs: 5000,
  metaStaleTimeoutMs: 60000,
};

/**
 * 创建空快照（用于首次同步）
 */
export function createEmptySnapshot(roomId: string): RoomSnapshot {
  return {
    roomId,
    hostUserId: "",
    status: "waiting",
    members: [],
    maxPlayers: 8,
    turnDuration: 5 * 60 * 1000,
    currentTurnNumber: 0,
    currentPhaseId: null,
    worldArchiveEntityCount: 0,
    worldArchiveVersion: 0,
    worldArchiveUpdatedAt: 0,
    updatedAt: Date.now(),
  };
}

/**
 * 从 Member 创建 SnapshotMember
 */
export function toSnapshotMember(member: Member): SnapshotMember {
  return {
    userId: member.userId,
    displayName: member.displayName,
    role: member.role,
    joinedAt: member.joinedAt,
    status: member.status,
  };
}

/**
 * 基于 metadata.version / metadata.updatedAt 构建 worldArchive 摘要。
 */
export function toWorldArchiveSummary(input: {
  entityCount: number;
  version: number;
  updatedAt: number;
}): WorldArchiveSummary {
  return {
    entityCount: input.entityCount,
    version: input.version,
    updatedAt: input.updatedAt,
  };
}
