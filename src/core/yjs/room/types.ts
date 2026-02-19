/**
 * Yjs 房间相关类型定义
 *
 * 基于 subdocument-architecture.md 设计文档
 * 和 2.3-turn-system-design.md Phase 系统设计
 */

import type { Character } from "@/domain/entities/character";
import type { FlowTemplate, PhaseInstance } from "@/domain/entities/phase";
import type {
  AiAbortReason,
  AiAborted,
  AiError,
  AiErrorType,
  AiStatus,
} from "@/domain/types/ai-status";
import type * as Y from "yjs";

// Re-export AI 状态类型以保持向后兼容
export type { AiAbortReason, AiAborted, AiError, AiErrorType, AiStatus };

// ===== 房间引用 =====

/**
 * 房间引用，存储在 RootDoc.rooms 中
 */
export interface RoomRef {
  /** 房间 ID */
  roomId: string;
  /** MainDoc 的 GUID */
  mainDocGuid: string;
  /** 创建时间 */
  createdAt: number;
  /** 房间码（用于加入） */
  code: string;
}

// ===== 房间元数据 =====

/**
 * 房间状态
 */
export type RoomStatus = "waiting" | "playing" | "paused" | "ended";

/**
 * 房间配置，存储在 MainDoc.metadata 中
 */
export interface RoomMetadata {
  /** 房间 ID */
  id: string;
  /** 房间码 */
  code: string;
  /** 房间名称 */
  name: string;
  /** 房主用户 ID */
  hostUserId: string;
  /** 房间状态 */
  status: RoomStatus;
  /** 最大玩家数 */
  maxPlayers: number;
  /** 回合时长（毫秒） */
  turnDuration: number;
  /** 创建时间 */
  createdAt: number;
  /** 更新时间 */
  updatedAt: number;
}

// ===== 成员 =====

/**
 * 成员角色
 */
export type MemberRole = "host" | "guest";

/**
 * 成员在线状态
 */
export type MemberStatus = "online" | "away" | "offline";

/**
 * 房间成员，存储在 MainDoc.members 中
 */
export interface Member {
  /** 用户 ID */
  userId: string;
  /** 显示名称 */
  displayName: string;
  /** 角色 */
  role: MemberRole;
  /** 加入时间 */
  joinedAt: number;
  /** 最后活跃时间 */
  lastActiveAt: number;
  /** 在线状态 */
  status: MemberStatus;
}

// ===== 回合状态 =====

/**
 * 回合状态枚举
 */
export type TurnStatus = "waiting" | "processing" | "completed" | "timeout";

// ===== AI 处理状态 =====
// 类型定义已迁移至 @/domain/types/ai-status，通过顶部 re-export 保持向后兼容

/**
 * 玩家行动
 */
export interface PlayerAction {
  /** 用户 ID */
  userId: string;
  /** 行动内容 */
  content: string;
  /** 提交时间 */
  submittedAt: number;
  /** 锁定时间（不可修改） */
  lockedAt?: number;
  /** 扩展字段，供未来模块使用 */
  metadata?: Record<string, unknown>;
}

/**
 * IRNR 结算状态
 */
export type ResolveStatus =
  | "idle"
  | "buffered"
  | "committing"
  | "committed"
  | "discarded";

/**
 * 回合数据（存储在 TurnDoc 中）
 */
export interface TurnData {
  /** 回合号 */
  turnNumber: number;
  /** 回合状态 */
  status: TurnStatus;
  /** 截止时间 */
  deadline: number;
  /** 玩家行动（userId -> Action） */
  actions: Map<string, PlayerAction>;
  /** 已准备的玩家 ID 列表 */
  readyPlayers: string[];
  /** AI 响应（流式） */
  aiResponse: string;
}

// ===== 历史归档 =====

/**
 * 压缩后的历史回合，存储在 HistoryDoc 中
 */
export interface ArchivedTurn {
  /** 回合号 */
  turnNumber: number;
  /** 完成时间 */
  completedAt: number;
  /** 压缩的回合数据（JSON + gzip base64） */
  compressedData: string;
}

/**
 * 回合完成时保存的数据
 */
export interface CompletedTurnData {
  /** 回合号 */
  turnNumber: number;
  /** 完成时间 */
  completedAt: number;
  /** 玩家行动（原样保存） */
  actions: Record<string, PlayerAction>;
  /** AI 响应长度（完整内容归档到 messages） */
  aiResponseLength: number;
}

// ===== Yjs 文档结构类型 =====

/**
 * MainDoc config 结构
 *
 * 存储在 MainDoc.getMap("config") 中的字段
 */
export interface MainDocConfig {
  /** 当前回合号（0 = 未开始回合） */
  currentTurnNumber: number;
  /** 当前阶段 ID（对应 preGamePhases 或 TurnDoc.phases 中的某个 PhaseInstance.id） */
  currentPhaseId: string | null;
  /** 当前阶段在回合模板中的索引（仅回合进行中有效） */
  currentPhaseIndex: number;
  /** 历史文档 GUID 引用 */
  historyDocGuid: string;
  /** 使用的流程模板 ID */
  flowTemplateId: string;
}

/**
 * MainDoc 结构（房间主文档）
 */
export interface MainDocStructure {
  /** 房间元数据 */
  metadata: Y.Map<RoomMetadata>;
  /** 成员列表 */
  members: Y.Map<Member>;
  /** 配置（包含回合和阶段状态） */
  config: Y.Map<MainDocConfig>;
  /** 回合文档 GUID 引用 */
  turnDocRefs: Y.Map<string>; // turnNumber -> guid
  /** 预游戏阶段历史（如 lobby） */
  preGamePhases: Y.Array<PhaseInstance>;
  /** 流程模板（可选，使用自定义模板时存储） */
  flowTemplate?: FlowTemplate;
  /**
   * 角色列表（characterId -> Y.Map<属性>）
   *
   * 使用嵌套 Y.Map 存储角色数据，支持增量同步
   * 修改单个属性时只同步变化的部分
   */
  characters: Y.Map<Y.Map<unknown>>;
}

/**
 * Yjs 中存储的角色数据结构。
 *
 * 基于 Character 类型，排除仅在本地使用的字段。
 * 使用 Y.Map 存储以支持增量同步。
 */
export type CharacterYjsData = Omit<
  Character,
  | "controlType"
  | "description"
  | "personality"
  | "appearance"
  | "dimensionSelections"
  | "talentIds"
>;

/**
 * TurnDoc 结构（回合文档）
 */
export interface TurnDocStructure {
  /** 回合号 */
  turnNumber: number;
  /** 回合状态 */
  status: TurnStatus;
  /** 截止时间 */
  deadline: number;
  /** 玩家行动 */
  actions: Y.Map<PlayerAction>;
  /** 已准备的玩家 */
  readyPlayers: Y.Array<string>;
  /** AI 响应（流式） */
  aiResponse: Y.Text;
  /** 该回合的阶段历史 */
  phases: Y.Array<PhaseInstance>;
  /** 当前阶段在 phases 数组中的索引 */
  currentPhaseIndex: number;

  // === IRNR 结算帧（G4 新增） ===

  /** ResultFrame 数据（data: ResultFrame, frameId: string, generatedAt: number） */
  resultFrame: Y.Map<unknown>;
  /** 结算状态 */
  resolveStatus: ResolveStatus;

  // === AI 处理状态（2.4 新增） ===

  /** AI 处理状态 */
  aiStatus: AiStatus;
  /** AI 错误信息（仅 failed 状态有值） */
  aiError?: AiError;
  /** AI 中断信息（仅 aborted 状态有值） */
  aiAborted?: AiAborted;
}

/**
 * HistoryDoc 结构（历史归档文档）
 */
export interface HistoryDocStructure {
  /** 会话列表 */
  conversations: Y.Map<unknown>;
  /** 消息（convId -> messages） */
  messages: Y.Map<Y.Array<unknown>>;
  /** 归档的历史回合 */
  archivedTurns: Y.Array<ArchivedTurn>;
}

// ===== SubdocManager 接口 =====

/**
 * 已加载的 Subdoc 信息
 */
export interface LoadedSubdocInfo {
  /** 文档 GUID */
  guid: string;
  /** 文档类型 */
  type: "main" | "turn" | "history";
  /** 加载时间 */
  loadedAt: number;
  /** 回合号（仅 turn 类型） */
  turnNumber?: number;
}

/**
 * Subdoc 管理器配置
 */
export interface SubdocManagerConfig {
  /** 保留最近 N 个回合文档 */
  keepRecentTurns: number;
  /** 历史文档空闲卸载时间（毫秒） */
  historyIdleTimeout: number;
}

/**
 * 默认 SubdocManager 配置
 */
export const DEFAULT_SUBDOC_CONFIG: SubdocManagerConfig = {
  keepRecentTurns: 5,
  historyIdleTimeout: 5 * 60 * 1000, // 5 分钟
};

// ===== 房间码相关 =====

/**
 * 房间码生成选项
 */
export interface RoomCodeOptions {
  /** 房间码长度 */
  length?: number;
  /** 字符集 */
  charset?: string;
}

/**
 * 默认房间码选项
 */
export const DEFAULT_ROOM_CODE_OPTIONS: Required<RoomCodeOptions> = {
  length: 6,
  charset: "ABCDEFGHJKLMNPQRSTUVWXYZ23456789", // 排除易混淆字符
};
