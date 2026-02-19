/**
 * 事件派生函数
 *
 * 根据快照差异派生领域事件。这是一组纯函数，不修改任何状态。
 *
 * ⚠️ 架构说明：
 * - 所有函数都是纯函数（给定相同输入，输出相同结果）
 * - 不依赖外部状态，不产生副作用
 * - 符合 lib/ 层工具函数的定位，但放在模块内以保持内聚性
 *
 * 基于 room-sync-bridge-proposal.md 设计文档
 */

import type { DomainEvent } from "@/core/event-bus/types";
import { RoomEvents } from "@/domain/events/room";
import type {
  HostTransferMeta,
  MemberActionMeta,
  RoomSnapshot,
  SnapshotDiff,
  SnapshotMember,
} from "./types";

/**
 * 生成事件 ID
 */
function generateEventId(): string {
  return crypto.randomUUID();
}

/**
 * 派生事件结果
 */
export interface DeriveEventsResult {
  /** 派生的事件列表 */
  events: DomainEvent[];

  /** 快照差异详情 */
  diff: SnapshotDiff;
}

/**
 * 事件元数据消费器接口
 *
 * 用于从 Yjs 消费意图型事件的元数据。
 * 方法采用 consume-once 语义：读取后自动清理过期数据。
 */
export interface EventMetaReader {
  /** 消费成员事件元数据（读取后自动清理过期数据） */
  consumeMemberActionMeta(userId: string): MemberActionMeta | null;

  /** 消费 Host 转让元数据（读取后自动清理过期数据） */
  consumeHostTransferMeta(): HostTransferMeta | null;
}

/**
 * 计算两个快照之间的差异
 */
export function computeSnapshotDiff(
  prev: RoomSnapshot,
  next: RoomSnapshot
): SnapshotDiff {
  // 计算成员变化
  const prevMemberIds = new Set(prev.members.map((m) => m.userId));
  const nextMemberIds = new Set(next.members.map((m) => m.userId));

  const membersJoined: SnapshotMember[] = next.members.filter(
    (m) => !prevMemberIds.has(m.userId)
  );

  const membersLeft: SnapshotMember[] = prev.members.filter(
    (m) => !nextMemberIds.has(m.userId)
  );

  return {
    statusChanged: prev.status !== next.status,
    status:
      prev.status !== next.status
        ? { prev: prev.status, next: next.status }
        : undefined,

    turnNumberChanged: prev.currentTurnNumber !== next.currentTurnNumber,
    turnNumber:
      prev.currentTurnNumber !== next.currentTurnNumber
        ? { prev: prev.currentTurnNumber, next: next.currentTurnNumber }
        : undefined,

    phaseIdChanged: prev.currentPhaseId !== next.currentPhaseId,
    phaseId:
      prev.currentPhaseId !== next.currentPhaseId
        ? { prev: prev.currentPhaseId, next: next.currentPhaseId }
        : undefined,

    hostChanged: prev.hostUserId !== next.hostUserId,
    host:
      prev.hostUserId !== next.hostUserId
        ? { prev: prev.hostUserId, next: next.hostUserId }
        : undefined,

    membersJoined,
    membersLeft,
  };
}

/**
 * 从快照差异派生房间事件
 *
 * 这是一个纯函数，根据快照差异和可选的元数据读取器生成事件列表
 *
 * @param prev 上一次的快照
 * @param next 当前的快照
 * @param metaReader 可选的元数据读取器（用于意图型事件）
 * @returns 派生的事件列表和差异详情
 */
export function deriveRoomEvents(
  prev: RoomSnapshot,
  next: RoomSnapshot,
  metaReader?: EventMetaReader
): DeriveEventsResult {
  const events: DomainEvent[] = [];
  const diff = computeSnapshotDiff(prev, next);
  const now = Date.now();

  // ===== 状态型事件 =====

  // 1. 游戏开始事件：status: waiting → playing
  if (
    diff.statusChanged &&
    diff.status?.prev === "waiting" &&
    diff.status?.next === "playing"
  ) {
    events.push({
      id: generateEventId(),
      type: RoomEvents.GAME_STARTED,
      payload: {
        roomId: next.roomId,
        userId: next.hostUserId,
        firstTurnNumber: next.currentTurnNumber,
        startedAt: now,
      },
      timestamp: now,
    });
  }

  // 2. 游戏结束事件：status: playing → ended
  if (
    diff.statusChanged &&
    diff.status?.prev === "playing" &&
    diff.status?.next === "ended"
  ) {
    events.push({
      id: generateEventId(),
      type: RoomEvents.GAME_ENDED,
      payload: {
        roomId: next.roomId,
        userId: next.hostUserId,
        reason: "normal",
        finalTurnNumber: prev.currentTurnNumber,
        endedAt: now,
      },
      timestamp: now,
    });
  }

  // 3. 回合开始事件：currentTurnNumber 增加
  if (
    diff.turnNumberChanged &&
    diff.turnNumber &&
    diff.turnNumber.next > diff.turnNumber.prev
  ) {
    events.push({
      id: generateEventId(),
      type: RoomEvents.TURN_STARTED,
      payload: {
        roomId: next.roomId,
        turnNumber: diff.turnNumber.next,
        deadline: now + next.turnDuration,
        startedAt: now,
      },
      timestamp: now,
    });
  }

  // 4. 成员加入事件
  for (const member of diff.membersJoined) {
    events.push({
      id: generateEventId(),
      type: RoomEvents.MEMBER_JOINED,
      payload: {
        roomId: next.roomId,
        userId: member.userId,
        displayName: member.displayName,
        role: member.role,
        joinedAt: member.joinedAt,
      },
      timestamp: now,
    });
  }

  // ===== 意图型事件（需要元数据）=====

  // 5. 成员离开事件（根据元数据派生具体类型）
  for (const member of diff.membersLeft) {
    const meta = metaReader?.consumeMemberActionMeta(member.userId);

    if (meta?.action === "kick") {
      // 被踢出
      events.push({
        id: generateEventId(),
        type: RoomEvents.MEMBER_KICKED,
        payload: {
          roomId: next.roomId,
          userId: member.userId,
          kickedBy: meta.by || next.hostUserId,
          reason: meta.reason || "kicked by host",
          kickedAt: now,
        },
        timestamp: now,
      });
    } else if (meta?.action === "timeout") {
      // 超时
      events.push({
        id: generateEventId(),
        type: RoomEvents.MEMBER_LEFT,
        payload: {
          roomId: next.roomId,
          userId: member.userId,
          reason: "disconnect",
          leftAt: now,
        },
        timestamp: now,
      });
    } else {
      // 降级：无元数据时派生通用 MEMBER_LEFT 事件
      events.push({
        id: generateEventId(),
        type: RoomEvents.MEMBER_LEFT,
        payload: {
          roomId: next.roomId,
          userId: member.userId,
          reason: meta?.action === "leave" ? "leave" : "disconnect",
          leftAt: now,
        },
        timestamp: now,
      });
    }
  }

  // 6. 房主转让事件
  if (diff.hostChanged && diff.host) {
    const meta = metaReader?.consumeHostTransferMeta();

    events.push({
      id: generateEventId(),
      type: RoomEvents.HOST_TRANSFERRED,
      payload: {
        roomId: next.roomId,
        previousHostId: diff.host.prev,
        newHostId: diff.host.next,
        transferredAt: now,
        reason: meta?.type === "manual" ? "manual" : "disconnect",
      },
      timestamp: now,
    });
  }

  // 7. 阶段变化事件
  if (diff.phaseIdChanged && diff.phaseId?.next) {
    events.push({
      id: generateEventId(),
      type: RoomEvents.PHASE_ENTERED,
      payload: {
        roomId: next.roomId,
        phaseId: diff.phaseId.next,
        phaseType: "unknown", // TODO: 从阶段数据获取类型
        turnNumber: next.currentTurnNumber,
        config: {},
        enteredAt: now,
      },
      timestamp: now,
    });
  }

  return { events, diff };
}

/**
 * 检查快照是否有实质性变化
 *
 * 用于优化：如果没有变化则跳过事件派生
 */
export function hasSnapshotChanged(
  prev: RoomSnapshot,
  next: RoomSnapshot
): boolean {
  // 快速检查：比较关键字段
  if (prev.status !== next.status) return true;
  if (prev.hostUserId !== next.hostUserId) return true;
  if (prev.currentTurnNumber !== next.currentTurnNumber) return true;
  if (prev.currentPhaseId !== next.currentPhaseId) return true;
  if (prev.members.length !== next.members.length) return true;

  // 详细检查：比较成员列表
  const prevMemberIds = new Set(prev.members.map((m) => m.userId));
  for (const member of next.members) {
    if (!prevMemberIds.has(member.userId)) return true;
  }

  return false;
}
