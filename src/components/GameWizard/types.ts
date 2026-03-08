/**
 * 游戏开始向导类型定义
 *
 * 采用配置驱动的设计，便于未来扩展（如角色创建向导）
 */

import type { SaveMemberInfo } from "@/core/yjs/types";
import type { WorldConfig, WorldId } from "@/lib/world/types";
import type { ComponentType } from "react";

// ============================================================
// 游戏模式配置（扩展性设计）
// ============================================================

/**
 * 游戏模式配置
 *
 * 扩展指南：添加新模式只需在此对象中添加配置
 */
export const GAME_MODES = {
  solo: {
    label: "单人模式",
    description: "独自探索你的故事",
    icon: "User",
    isMultiplayer: false,
    initialStep: "mode-selection",
  },
  "create-room": {
    label: "创建房间",
    description: "邀请好友一起冒险",
    icon: "Users",
    isMultiplayer: true,
    initialStep: "room-settings",
  },
  "join-room": {
    label: "加入房间",
    description: "输入房间码加入",
    icon: "Link",
    isMultiplayer: true,
    initialStep: "join-room",
  },
  // 未来扩展示例：
  // spectate: {
  //   label: "观战模式",
  //   description: "观看其他玩家的冒险",
  //   icon: "Eye",
  //   isMultiplayer: true,
  //   initialStep: "spectate-room",
  // },
} as const;

/**
 * 游戏模式类型（自动从配置推导）
 */
export type GameMode = keyof typeof GAME_MODES;

/**
 * 获取模式配置
 */
export function getModeConfig(mode: GameMode) {
  return GAME_MODES[mode];
}

// ============================================================
// 步骤数据类型（分层设计，便于扩展）
// ============================================================

/**
 * 房间设置步骤数据
 */
export interface RoomSettingsStepData {
  roomId: string;
  roomCode: string;
  roomName: string;
  maxPlayers: number;
  turnDuration: number;
}

/**
 * 加入房间步骤数据
 */
export interface JoinRoomStepData {
  roomId: string;
  roomCode: string;
}

/**
 * 步骤数据映射（扩展时在此添加新类型）
 *
 * 扩展指南：
 * 1. 定义新的步骤数据接口（如 CharacterCreationStepData）
 * 2. 在此映射中添加对应字段
 */
export interface StepDataMap {
  roomSettings?: RoomSettingsStepData;
  joinRoom?: JoinRoomStepData;
  // 未来扩展：
  // characterCreation?: CharacterCreationStepData;
  // worldSelection?: WorldSelectionStepData;
}

// ============================================================
// 向导上下文（核心 + 步骤数据分离）
// ============================================================

/**
 * 向导上下文 - 存储向导过程中的所有数据
 *
 * 设计原则：
 * - 核心字段：向导引擎需要的基础数据
 * - stepData：各步骤的业务数据，按步骤分类存储
 *
 * 扩展时只需修改 StepDataMap，无需修改此接口
 */
export interface WizardContext {
  // ===== 核心字段 =====
  /** 游戏模式 */
  mode?: GameMode;

  /** 玩家显示名 */
  playerName?: string;

  /** 显式选择的作者态世界 ID */
  worldId?: WorldId;

  /** 世界配置（从活动世界解析而来，只读） */
  worldConfig?: WorldConfig;

  // ===== 步骤数据（分层存储） =====
  /** 各步骤的业务数据 */
  stepData: StepDataMap;

  // ===== 结果字段（向导完成后使用） =====
  /** 存档 ID（单人模式） */
  saveId?: string;

  /** 房间 ID（联机模式） */
  roomId?: string;

  /** 房间码（联机模式） */
  roomCode?: string;

  /** 角色 ID（未来扩展） */
  characterId?: string;

  // ===== 角色描述数据（单机模式） =====
  /** 角色名称 */
  characterName?: string;
  /** 角色描述 */
  characterDescription?: string;
  /** 角色性格 */
  characterPersonality?: string;
  /** 角色外貌 */
  characterAppearance?: string;
  /** 角色年龄 */
  characterAge?: number;
  /** 角色性别 */
  characterGender?: string;
  /** 角色头像 URL（本地预览或远程地址） */
  avatarUrl?: string;
  /** 角色头像文件（仅用于完成向导后保存到 OPFS，不写入存档） */
  portraitFile?: File;

  // ===== Phase 2 角色创建数据 =====
  /** 维度选择（key: 维度 ID, value: 选项 ID） */
  dimensionSelections?: Record<string, string>;
  /** 已选天赋 ID 列表 */
  talentIds?: string[];
  /** 玩家分配的属性点数（不含维度修正） */
  allocatedPoints?: Record<string, number>;
  /** 最终属性值（含维度修正），创建时计算 */
  attributes?: Record<string, number>;

  // ===== 联机续玩字段 =====
  /**
   * 期望的成员列表（从存档读取）
   *
   * 用于联机续玩时的成员到齐检查
   * 当此字段存在时，WaitingLobby 会显示成员对比 UI
   */
  expectedMembers?: SaveMemberInfo[];
}

/**
 * 创建初始上下文
 */
export function createInitialContext(playerName?: string): WizardContext {
  return {
    playerName,
    stepData: {},
  };
}

/**
 * 步骤组件的通用 Props
 */
export interface StepProps {
  context: WizardContext;
  onNext: (updates?: Partial<WizardContext>) => void;
  onBack: () => void;
  onComplete: (result: WizardContext) => void;
  /** 仅同步数据到上下文，不触发步骤切换 */
  onUpdateContext: (updates: Partial<WizardContext>) => void;
  /** 导航方向，用于步骤组件内部动画方向感知 */
  direction: "forward" | "backward";
  /** 步骤有效性变化回调（用于控制 WizardFooter 下一步按钮） */
  onValidationChange?: (isValid: boolean) => void;
}

/**
 * 步骤配置
 */
export interface WizardStepConfig {
  /** 步骤 ID */
  id: string;

  /** 步骤组件 */
  component: ComponentType<StepProps>;

  /** 获取下一步 ID，返回 null 表示完成向导 */
  getNextStep: (context: WizardContext) => string | null;

  /** 获取上一步 ID，返回 null 表示关闭向导 */
  getPrevStep: (context: WizardContext) => string | null;

  /** 是否可跳过此步骤 */
  canSkip?: (context: WizardContext) => boolean;

  /** 进入此步骤前的验证 */
  validate?: (context: WizardContext) => boolean;

  /** 步骤标签（用于进度指示器），为空时不在进度条中显示 */
  label?: string;

  /** 是否隐藏底部操作栏（如 ModeSelection 通过卡片直接前进，不需要 Footer） */
  hideFooter?: boolean;

  /** 下一步按钮的自定义文本 */
  nextLabel?: string;
}

/**
 * 向导结果
 */
export interface WizardResult {
  mode: GameMode;
  saveId?: string;
  worldId?: WorldId;
  roomId?: string;
  roomCode?: string;
  characterId?: string;
  /** 角色名称 */
  characterName?: string;
  /** 角色描述 */
  characterDescription?: string;
  /** 角色性格 */
  characterPersonality?: string;
  /** 角色外貌 */
  characterAppearance?: string;
  /** 角色年龄 */
  characterAge?: number;
  /** 角色性别 */
  characterGender?: string;
  /** 角色头像 URL（本地预览或远程地址） */
  avatarUrl?: string;
  /** 角色头像文件（仅用于完成向导后保存到 OPFS，不写入存档） */
  portraitFile?: File;

  // ===== Phase 2 角色创建数据 =====
  /** 维度选择（key: 维度 ID, value: 选项 ID） */
  dimensionSelections?: Record<string, string>;
  /** 已选天赋 ID 列表 */
  talentIds?: string[];
  /** 最终属性值（含维度修正） */
  attributes?: Record<string, number>;
}

// ============================================================
// 房间配置类型
// ============================================================

/**
 * 房间配置（创建房间时使用）
 */
export interface RoomConfig {
  name: string;
  maxPlayers: number;
  turnDuration: number; // 分钟
}

/**
 * 房间预览信息（加入房间前显示）
 */
export interface RoomPreviewInfo {
  name: string;
  hostName: string;
  memberCount: number;
  maxPlayers: number;
}
