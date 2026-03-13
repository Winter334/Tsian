/**
 * 房间相关命令常量
 *
 * 基于 subdocument-architecture.md 设计文档
 */

import type {
  Character,
  CharacterCreationData,
  CharacterStatus,
  UpdateCharacterParams,
} from "@/domain/entities/character";
import type { SpawnItemDef, SpawnSkillDef } from "../types/entity";

/**
 * 房间命令类型
 */
export const RoomCommands = {
  // ===== 房间管理 =====
  /** 创建房间 */
  CREATE_ROOM: "room/create",
  /** 加入房间 */
  JOIN_ROOM: "room/join",
  /** 离开房间 */
  LEAVE_ROOM: "room/leave",
  /** 删除房间 */
  DELETE_ROOM: "room/delete",
  /** 更新房间设置 */
  UPDATE_ROOM_SETTINGS: "room/settings/update",
  /** 查询房间信息（用于加入前预览） */
  QUERY_ROOM: "room/query",

  // ===== 成员管理 =====
  /** 踢出成员 */
  KICK_MEMBER: "room/member/kick",
  /** 转让房主 */
  TRANSFER_HOST: "room/member/transfer-host",
  /** 更新成员状态 */
  UPDATE_MEMBER_STATUS: "room/member/status/update",

  // ===== 回合管理 =====
  /** 开始新回合 */
  START_TURN: "room/turn/start",
  /** 提交行动 */
  SUBMIT_ACTION: "room/turn/submit",
  /** 修改行动 */
  UPDATE_ACTION: "room/turn/action/update",
  /** 撤回行动 */
  WITHDRAW_ACTION: "room/turn/action/withdraw",
  /** 锁定行动 */
  LOCK_ACTION: "room/turn/action/lock",
  /** 完成回合 */
  COMPLETE_TURN: "room/turn/complete",
  /** 强制开始（Host） */
  FORCE_START_TURN: "room/turn/force-start",
  /** 延长回合时间（Host） */
  EXTEND_TURN_DEADLINE: "room/turn/extend",

  // ===== 阶段管理 =====
  /** 进入阶段 */
  ENTER_PHASE: "room/phase/enter",
  /** 完成当前阶段 */
  COMPLETE_PHASE: "room/phase/complete",
  /** 推进到下一阶段 */
  ADVANCE_PHASE: "room/phase/advance",
  /** 开始游戏（从 lobby 进入第一回合） */
  START_GAME: "room/game/start",
  /** 结束游戏 */
  END_GAME: "room/game/end",

  // ===== 角色管理 =====
  /** 创建角色 */
  CREATE_CHARACTER: "room/character/create",
  /** 更新角色 */
  UPDATE_CHARACTER: "room/character/update",
  /** 角色升级 */
  LEVEL_UP: "room/character/level-up" as const,

  // ===== NPC 管理 =====
  /** 创建 NPC（由规则引擎在处理 Parser AI 输出时调用） */
  CREATE_NPC: "room/npc/create",
  /** 更新 NPC 状态（active/off_scene/archived/dead） */
  UPDATE_NPC_STATUS: "room/npc/status/update",
  /** 更新 NPC 信息（描述/性格/外貌等） */
  UPDATE_NPC_INFO: "room/npc/info/update",

  // ===== 历史管理 =====
  /** 加载历史回合 */
  LOAD_HISTORY_TURN: "room/history/load",
  /** 归档当前回合 */
  ARCHIVE_TURN: "room/history/archive",

  // ===== AI 处理（2.4 新增） =====
  /** 处理 AI 回合（Host 调用 AI） */
  PROCESS_AI_TURN: "room/ai/process",
  /** 取消 AI 调用 */
  CANCEL_AI_TURN: "room/ai/cancel",
  /** 重新生成 AI 响应 */
  REGENERATE_AI_TURN: "room/ai/regenerate",
} as const;

/**
 * 房间命令类型
 */
export type RoomCommandType = (typeof RoomCommands)[keyof typeof RoomCommands];

// ===== 命令 Payload 类型 =====

/**
 * 创建房间命令参数
 */
export interface CreateRoomPayload {
  /** 房间名称 */
  name: string;
  /** 房主用户 ID */
  hostUserId: string;
  /** 房主显示名称 */
  hostDisplayName: string;
  /** 最大玩家数（2-8） */
  maxPlayers?: number;
  /** 回合时长（毫秒） */
  turnDuration?: number;
  /** 显式选择的作者态世界 ID（仅新建房间时使用） */
  worldId?: string;
  /** 从存档创建（可选） */
  fromSaveId?: string;
}

/**
 * 加入房间命令参数
 */
export interface JoinRoomPayload {
  /** 房间码 */
  code: string;
  /** 用户 ID */
  userId: string;
  /** 显示名称 */
  displayName: string;
}

/**
 * 离开房间命令参数
 */
export interface LeaveRoomPayload {
  /** 房间 ID */
  roomId: string;
  /** 用户 ID */
  userId: string;
}

/**
 * 删除房间命令参数
 */
export interface DeleteRoomPayload {
  /** 房间 ID */
  roomId: string;
  /** 执行者 userId（必须是 Host） */
  userId: string;
}

/**
 * 更新房间设置命令参数
 */
export interface UpdateRoomSettingsPayload {
  /** 房间 ID */
  roomId: string;
  /** 执行者 userId（必须是 Host） */
  userId: string;
  /** 要更新的设置字段（部分更新） */
  settings: Partial<{
    name: string;
    maxPlayers: number;
    turnDuration: number;
  }>;
}

/**
 * 提交行动命令参数
 */
export interface SubmitActionPayload {
  /** 房间 ID */
  roomId: string;
  /** 回合号 */
  turnNumber: number;
  /** 用户 ID */
  userId: string;
  /** 行动内容 */
  content: string;
  /** 扩展元数据 */
  metadata?: Record<string, unknown>;
}

/**
 * 修改行动命令参数
 */
export interface UpdateActionPayload {
  /** 房间 ID */
  roomId: string;
  /** 回合号 */
  turnNumber: number;
  /** 行动所属的玩家 userId */
  userId: string;
  /** 更新后的行动内容 */
  content: string;
  /** 扩展元数据（可选） */
  metadata?: Record<string, unknown>;
}

/**
 * 撤回行动命令参数
 */
export interface WithdrawActionPayload {
  /** 房间 ID */
  roomId: string;
  /** 回合号 */
  turnNumber: number;
  /** 被撤回行动的所属用户 ID */
  userId: string;
  /** 执行撤回的用户 ID（自己或 Host） */
  operatorId: string;
}

/**
 * 完成回合命令参数
 */
export interface CompleteTurnPayload {
  /** 房间 ID */
  roomId: string;
  /** 回合号 */
  turnNumber: number;
  /** AI 响应（可选：未传时从 TurnDoc 读取） */
  aiResponse?: string;
}

/**
 * 开始新回合命令参数
 */
export interface StartTurnPayload {
  /** 房间 ID */
  roomId: string;
  /** 回合时长（毫秒，可选，使用房间默认值） */
  duration?: number;
}

/**
 * 踢出成员命令参数
 */
export interface KickMemberPayload {
  /** 房间 ID */
  roomId: string;
  /** 执行踢人的用户 userId（必须是 Host） */
  userId: string;
  /** 被踢成员的 userId */
  targetUserId: string;
  /** 踢出原因（可选） */
  reason?: string;
}

/**
 * 转让房主命令参数
 */
export interface TransferHostPayload {
  /** 房间 ID */
  roomId: string;
  /** 当前房主 ID */
  currentHostId: string;
  /** 新房主 ID */
  newHostId: string;
}

/**
 * 查询房间命令参数
 */
export interface QueryRoomPayload {
  /** 房间码 */
  code: string;
}

/**
 * 查询房间结果
 */
export interface QueryRoomResult {
  /** 房间 ID */
  roomId: string;
  /** 房间名称 */
  name: string;
  /** 房主显示名称 */
  hostName: string;
  /** 当前成员数 */
  memberCount: number;
  /** 最大玩家数 */
  maxPlayers: number;
}

// ===== Phase 相关 Payload =====

/**
 * 进入阶段命令参数
 */
export interface EnterPhasePayload {
  /** 房间 ID */
  roomId: string;
  /** 阶段类型 */
  phaseType: string;
  /** 阶段配置覆盖 */
  configOverride?: Record<string, unknown>;
  /** 回合号（0 = 预游戏阶段，>0 = 回合内阶段） */
  turnNumber: number;
}

/**
 * 完成阶段命令参数
 */
export interface CompletePhasePayload {
  /** 房间 ID */
  roomId: string;
  /** 阶段 ID */
  phaseId: string;
  /** 阶段数据（完成时携带的数据） */
  data?: Record<string, unknown>;
}

/**
 * 推进到下一阶段命令参数
 */
export interface AdvancePhasePayload {
  /** 房间 ID */
  roomId: string;
  /** 是否强制推进（跳过检查） */
  force?: boolean;
}

/**
 * 开始游戏命令参数
 */
export interface StartGamePayload {
  /** 房间 ID */
  roomId: string;
  /** 触发者用户 ID（必须是 Host） */
  userId: string;
}

/**
 * 结束游戏命令参数
 */
export interface EndGamePayload {
  /** 房间 ID */
  roomId: string;
  /** 触发者用户 ID（必须是 Host） */
  userId: string;
  /** 结束原因 */
  reason?: string;
}

// ===== AI 处理相关 Payload（2.4 新增） =====

/**
 * 处理 AI 回合命令参数
 */
export interface ProcessAiTurnPayload {
  /** 房间 ID */
  roomId: string;
  /** 回合号 */
  turnNumber: number;
  /** 触发者用户 ID（必须是 Host） */
  userId: string;
}

/**
 * 取消 AI 调用命令参数
 */
export interface CancelAiTurnPayload {
  /** 房间 ID */
  roomId: string;
  /** 回合号 */
  turnNumber: number;
  /** 触发者用户 ID（必须是 Host） */
  userId: string;
  /** 取消原因 */
  reason: "host_cancel" | "regenerate";
}

/**
 * 重新生成 AI 响应命令参数
 */
export interface RegenerateAiTurnPayload {
  /** 房间 ID */
  roomId: string;
  /** 回合号 */
  turnNumber: number;
  /** 触发者用户 ID（必须是 Host） */
  userId: string;
}

// ===== NPC 管理相关 Payload =====

/**
 * NPC 创建命令参数
 */
export interface CreateNpcPayload {
  /** 房间 ID */
  roomId: string;
  /** NPC 名称 */
  name: string;
  /** 角色背景故事 */
  description?: string;
  /** 性格特征 */
  personality?: string;
  /** 外貌描述 */
  appearance?: string;
  /** 年龄 */
  age?: number;
  /** 性别 */
  gender?: string;
  /** 初始属性 */
  attributes?: Record<string, unknown>;
  /** 已选天赋 ID 列表 */
  talentIds?: string[];
  /** 初始物品列表（spawn 时批量授予） */
  initialItems?: SpawnItemDef[];
  /** 初始技能列表（spawn 时批量授予） */
  initialSkills?: SpawnSkillDef[];
}

/**
 * NPC 状态更新命令参数
 */
export interface UpdateNpcStatusPayload {
  /** 房间 ID */
  roomId: string;
  /** 角色 ID */
  characterId: string;
  /** 目标状态 */
  status: CharacterStatus;
}

/**
 * NPC 信息更新命令参数
 */
export interface UpdateNpcInfoPayload {
  /** 房间 ID */
  roomId: string;
  /** 角色 ID */
  characterId: string;
  /** 更新的字段 */
  updates: Partial<
    Pick<
      Character,
      "name" | "description" | "personality" | "appearance" | "talentIds"
    >
  >;
}

// ===== 角色管理相关 Payload =====

/**
 * 创建角色命令参数
 */
export interface CreateCharacterPayload {
  /** 房间 ID */
  roomId: string;
  /** 创建者的 userId */
  userId: string;
  /** 创建者的 uniqueTag */
  uniqueTag: string;
  /** 角色创建数据（引用实体类型，不再手动列字段） */
  characterData: CharacterCreationData;
}

/**
 * 更新角色命令参数
 */
export interface UpdateCharacterPayload {
  /** 房间 ID */
  roomId: string;
  /** 角色 ID */
  characterId: string;
  /** 操作者的 userId */
  userId: string;
  /** 操作者的 uniqueTag */
  uniqueTag: string;
  /** 更新的字段 */
  updates: UpdateCharacterParams;
}

/** 等级提升命令负载 */
export interface LevelUpPayload {
  /** 房间 ID */
  roomId: string;
  /** 角色 ID */
  characterId: string;
  /** 操作者用户 ID */
  userId: string;
  /** 操作者唯一标签 */
  uniqueTag: string;
  /** 升级级数，默认 1 */
  levels?: number;
  /** 升级原因（叙事描述） */
  reason?: string;
}
