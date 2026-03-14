/**
 * 房间相关事件常量
 *
 * 基于 subdocument-architecture.md 设计文档
 */

/**
 * 房间事件类型
 */
export const RoomEvents = {
  // ===== 房间生命周期 =====
  /** 房间已创建 */
  ROOM_CREATED: "room.created",
  /** 房间已删除 */
  ROOM_DELETED: "room.deleted",
  /** 房间设置已更新 */
  ROOM_SETTINGS_UPDATED: "room.settings.updated",
  /** 房间状态已变更 */
  ROOM_STATUS_CHANGED: "room.status.changed",

  // ===== 成员事件 =====
  /** 成员加入房间 */
  MEMBER_JOINED: "room.member.joined",
  /** 成员离开房间 */
  MEMBER_LEFT: "room.member.left",
  /** 成员被踢出 */
  MEMBER_KICKED: "room.member.kicked",
  /** 成员状态更新 */
  MEMBER_STATUS_UPDATED: "room.member.status.updated",
  /** 房主已转让 */
  HOST_TRANSFERRED: "room.host.transferred",

  // ===== 回合事件 =====
  /** 回合已开始 */
  TURN_STARTED: "room.turn.started",
  /** 行动已提交 */
  ACTION_SUBMITTED: "room.turn.action.submitted",
  /** 行动已更新 */
  ACTION_UPDATED: "room.turn.action.updated",
  /** 行动已撤回 */
  ACTION_WITHDRAWN: "room.turn.action.withdrawn",
  /** 行动已锁定 */
  ACTION_LOCKED: "room.turn.action.locked",
  /** 回合已完成 */
  TURN_COMPLETED: "room.turn.completed",
  /** 回合超时 */
  TURN_TIMEOUT: "room.turn.timeout",
  /** 回合截止时间已延长 */
  TURN_DEADLINE_EXTENDED: "room.turn.deadline.extended",

  // ===== 阶段事件 =====
  /** 阶段已进入 */
  PHASE_ENTERED: "room.phase.entered",
  /** 阶段已完成 */
  PHASE_COMPLETED: "room.phase.completed",
  /** 阶段已推进 */
  PHASE_ADVANCED: "room.phase.advanced",
  /** 游戏已开始 */
  GAME_STARTED: "room.game.started",
  /** 游戏已结束 */
  GAME_ENDED: "room.game.ended",

  // ===== 角色事件 =====
  /** 角色已创建 */
  CHARACTER_CREATED: "room.character.created",
  /** 角色已更新 */
  CHARACTER_UPDATED: "room.character.updated",
  /** 角色已升级 */
  CHARACTER_LEVELED_UP: "room.character.leveled_up" as const,
  /** 运行时天赋抽取已领取 */
  TALENT_DRAW_CLAIMED: "room.character.talent_draw_claimed" as const,
  /** 升级属性点已分配 */
  LEVEL_POINTS_ALLOCATED: "room.character.level_points_allocated" as const,

  // ===== NPC 事件 =====
  /** NPC 已创建 */
  NPC_CREATED: "room.npc.created",
  /** NPC 状态变化（进场/离场/归档/死亡） */
  NPC_STATUS_CHANGED: "room.npc.status.changed",
  /** NPC 信息更新 */
  NPC_INFO_UPDATED: "room.npc.info.updated",

  // ===== AI 响应事件 =====
  /** AI 响应开始 */
  AI_RESPONSE_STARTED: "room.ai.started",
  /** AI 响应进行中（流式） */
  AI_RESPONSE_CHUNK: "room.ai.chunk",
  /** AI 响应完成 */
  AI_RESPONSE_COMPLETED: "room.ai.completed",
  /** AI 响应失败 */
  AI_RESPONSE_FAILED: "room.ai.failed",
  /** AI 正在重试 */
  AI_RESPONSE_RETRYING: "room.ai.retrying",
  /** AI 调用已取消 */
  AI_RESPONSE_CANCELLED: "room.ai.cancelled",

  // ===== 历史事件 =====
  /** 历史回合已加载 */
  HISTORY_TURN_LOADED: "room.history.turn.loaded",
  /** 回合已归档 */
  TURN_ARCHIVED: "room.history.turn.archived",

  // ===== 连接事件 =====
  /** 连接到房间 */
  CONNECTED: "room.connected",
  /** 断开连接 */
  DISCONNECTED: "room.disconnected",
  /** 重新连接中 */
  RECONNECTING: "room.reconnecting",
  /** 重新连接成功 */
  RECONNECTED: "room.reconnected",
} as const;

/**
 * 房间事件类型
 */
export type RoomEventType = (typeof RoomEvents)[keyof typeof RoomEvents];

// ===== 事件 Payload 类型 =====

/**
 * 房间已创建事件
 */
export interface RoomCreatedEvent {
  roomId: string;
  code: string;
  name: string;
  hostUserId: string;
  hostDisplayName: string;
  maxPlayers: number;
  turnDuration: number;
  createdAt: number;
}

/**
 * 成员加入事件
 */
export interface MemberJoinedEvent {
  roomId: string;
  userId: string;
  displayName: string;
  role: "host" | "guest";
  joinedAt: number;
}

/**
 * 成员离开事件
 */
export interface MemberLeftEvent {
  roomId: string;
  userId: string;
  reason: "leave" | "kick" | "disconnect";
  leftAt: number;
}

/**
 * 回合开始事件
 */
export interface TurnStartedEvent {
  roomId: string;
  turnNumber: number;
  deadline: number;
  startedAt: number;
}

/**
 * 行动提交事件
 */
export interface ActionSubmittedEvent {
  roomId: string;
  turnNumber: number;
  userId: string;
  submittedAt: number;
  /** 当前已提交的玩家数 */
  submittedCount: number;
  /** 总玩家数 */
  totalPlayers: number;
}

/**
 * 行动撤回事件
 */
export interface ActionWithdrawnEvent {
  roomId: string;
  turnNumber: number;
  /** 被撤回行动的所属用户 */
  userId: string;
  /** 执行撤回的人（自己或 Host） */
  operatorId: string;
  withdrawnAt: number;
  /** 撤回后当前已提交的玩家数 */
  submittedCount: number;
  /** 总玩家数 */
  totalPlayers: number;
}

/**
 * 回合完成事件
 */
export interface TurnCompletedEvent {
  roomId: string;
  turnNumber: number;
  aiResponse: string;
  completedAt: number;
}

/**
 * AI 响应块事件（流式）
 */
export interface AIResponseChunkEvent {
  roomId: string;
  turnNumber: number;
  chunk: string;
  /** 累计响应长度 */
  totalLength: number;
}

/**
 * 房主转让事件
 */
export interface HostTransferredEvent {
  roomId: string;
  previousHostId: string;
  newHostId: string;
  transferredAt: number;
  reason: "manual" | "disconnect" | "leave";
}

/**
 * 连接状态事件
 */
export interface ConnectionEvent {
  roomId: string;
  userId: string;
  timestamp: number;
}

// ===== Phase 事件 Payload =====

/**
 * 阶段进入事件
 */
export interface PhaseEnteredEvent {
  roomId: string;
  /** 阶段 ID */
  phaseId: string;
  /** 阶段类型 */
  phaseType: string;
  /** 回合号（0 = 预游戏，>0 = 回合内） */
  turnNumber: number;
  /** 阶段配置 */
  config: Record<string, unknown>;
  /** 进入时间 */
  enteredAt: number;
}

/**
 * 阶段完成事件
 */
export interface PhaseCompletedEvent {
  roomId: string;
  /** 阶段 ID */
  phaseId: string;
  /** 阶段类型 */
  phaseType: string;
  /** 回合号 */
  turnNumber: number;
  /** 阶段数据 */
  data: Record<string, unknown>;
  /** 完成时间 */
  completedAt: number;
}

/**
 * 阶段推进事件
 */
export interface PhaseAdvancedEvent {
  roomId: string;
  /** 前一阶段 ID */
  previousPhaseId: string;
  /** 前一阶段类型 */
  previousPhaseType: string;
  /** 新阶段 ID */
  nextPhaseId: string;
  /** 新阶段类型 */
  nextPhaseType: string;
  /** 回合号 */
  turnNumber: number;
  /** 是否进入新回合 */
  isNewTurn: boolean;
  /** 推进时间 */
  advancedAt: number;
}

/**
 * 游戏开始事件
 */
export interface GameStartedEvent {
  roomId: string;
  /** 触发者 */
  userId: string;
  /** 第一回合号（通常为 1） */
  firstTurnNumber: number;
  /** 开始时间 */
  startedAt: number;
}

/**
 * 游戏结束事件
 */
export interface GameEndedEvent {
  roomId: string;
  /** 触发者 */
  userId: string;
  /** 结束原因 */
  reason: string;
  /** 最终回合号 */
  finalTurnNumber: number;
  /** 结束时间 */
  endedAt: number;
}

// ===== AI 处理事件 Payload（2.4 新增） =====

import type { AiAbortReason, AiErrorType } from "../types/ai-status";

/**
 * AI 响应开始事件
 */
export interface AIResponseStartedEvent {
  roomId: string;
  turnNumber: number;
  startedAt: number;
}

/**
 * AI 正在重试事件
 */
export interface AIResponseRetryingEvent {
  roomId: string;
  turnNumber: number;
  /** 当前重试次数 */
  attempt: number;
  /** 最大重试次数 */
  maxAttempts: number;
  /** 错误信息 */
  errorMessage: string;
  /** 下次重试时间 */
  retryAt: number;
}

/**
 * AI 响应完成事件
 */
export interface AIResponseCompletedEvent {
  roomId: string;
  turnNumber: number;
  /** 响应长度 */
  responseLength: number;
  completedAt: number;
}

/**
 * AI 响应失败事件
 */
export interface AIResponseFailedEvent {
  roomId: string;
  turnNumber: number;
  /** 错误类型 */
  errorType: AiErrorType;
  /** 错误消息 */
  errorMessage: string;
  /** 重试次数 */
  retryCount: number;
  failedAt: number;
}

/**
 * AI 调用取消事件
 */
export interface AIResponseCancelledEvent {
  roomId: string;
  turnNumber: number;
  /** 取消原因 */
  reason: AiAbortReason;
  /** 取消者 */
  userId: string;
  cancelledAt: number;
}

// ===== NPC 事件 Payload =====

/**
 * NPC 创建事件
 */
export interface NpcCreatedEvent {
  /** 房间 ID */
  roomId: string;
  /** 角色 ID */
  characterId: string;
  /** NPC 名称 */
  name: string;
  /** 角色背景故事 */
  description?: string;
  /** 性格特征 */
  personality?: string;
  /** 外貌描述 */
  appearance?: string;
  /** 初始属性 */
  attributes?: Record<string, number>;
  /** 已选天赋 ID 列表 */
  talentIds?: string[];
  /** 创建时间 */
  createdAt: number;
}

/**
 * NPC 状态变化事件
 */
export interface NpcStatusChangedEvent {
  /** 房间 ID */
  roomId: string;
  /** 角色 ID */
  characterId: string;
  /** 之前的状态 */
  previousStatus: CharacterStatus;
  /** 新状态 */
  newStatus: CharacterStatus;
  /** 变更时间 */
  changedAt: number;
}

/**
 * NPC 信息更新事件
 */
export interface NpcInfoUpdatedEvent {
  /** 房间 ID */
  roomId: string;
  /** 角色 ID */
  characterId: string;
  /** 更新的字段 */
  updates: Partial<{
    /** NPC 名称 */
    name: string;
    /** 角色背景故事 */
    description: string;
    /** 性格特征 */
    personality: string;
    /** 外貌描述 */
    appearance: string;
    /** 已选天赋 ID 列表 */
    talentIds: string[];
  }>;
  /** 更新时间 */
  updatedAt: number;
}

// ===== 角色事件 Payload =====

import type {
  Character,
  CharacterStatus,
  UpdateCharacterParams,
} from "@/domain/entities/character";

/**
 * 角色创建事件
 */
export interface CharacterCreatedEvent {
  /** 房间 ID */
  roomId: string;
  /** 完整的角色数据快照 */
  character: Character;
}

/**
 * 角色更新事件
 */
export interface CharacterUpdatedEvent {
  /** 房间 ID */
  roomId: string;
  /** 角色 ID */
  characterId: string;
  /** 操作者的 userId */
  operatorUserId: string;
  /** 操作者的 uniqueTag */
  operatorUniqueTag: string;
  /** 更新的字段 */
  updates: UpdateCharacterParams;
  /** 更新时间 */
  updatedAt: number;
}

/** 角色等级提升事件负载 */
export interface CharacterLeveledUpEvent {
  /** 房间 ID */
  roomId: string;
  /** 角色 ID */
  characterId: string;
  /** 操作者用户 ID */
  operatorUserId: string;
  /** 操作者唯一标签 */
  operatorUniqueTag: string;
  /** 升级前等级 */
  previousLevel: number;
  /** 升级后等级 */
  newLevel: number;
  /** 自动成长应用的属性变更摘要 */
  appliedGrowth: Record<string, number>;
  /** 资源恢复摘要 */
  resourceRecovery: Record<string, number>;
  /** 升级后的溢出进度值 */
  progressOverflow?: number;
  /** 进度不足时的参考标记（不会阻止升级） */
  progressInsufficient?: boolean;
  /** 本次发放的奖励摘要 */
  appliedRewards?: Array<{
    type: string;
    detail: Record<string, unknown>;
  }>;
  /** 本次发放的未分配属性点总数 */
  pointsAwarded?: number;
  /** 升级原因 */
  reason?: string;
  /** 时间戳 */
  updatedAt: number;
}

/** 运行时天赋抽取领取事件负载 */
export interface TalentDrawClaimedEvent {
  /** 房间 ID */
  roomId: string;
  /** 角色 ID */
  characterId: string;
  /** 操作者用户 ID */
  operatorUserId: string;
  /** 操作者唯一标签 */
  operatorUniqueTag: string;
  /** 待领取抽取奖励 ID */
  pendingDrawId: string;
  /** 玩家确认选择的天赋 ID */
  selectedTalentId: string;
  /** 抽取池 ID */
  poolId?: string;
  /** 每次抽取展示的候选数量 */
  offersPerDraw?: number;
  /** 保底品质 */
  guaranteedRarity?: string;
  /** 来源描述 */
  source?: string;
  /** 时间戳 */
  updatedAt: number;
}

/** 等级属性点分配事件负载 */
export interface LevelPointsAllocatedEvent {
  /** 房间 ID */
  roomId: string;
  /** 角色 ID */
  characterId: string;
  /** 操作者用户 ID */
  userId: string;
  /** 本次分配详情 */
  allocation: Record<string, number>;
  /** 本次消耗总点数 */
  pointsSpent: number;
  /** 剩余未分配点数 */
  pointsRemaining: number;
  /** 时间戳 */
  updatedAt: number;
}
