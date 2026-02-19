/**
 * Phase（阶段）实体定义
 *
 * 回合系统的核心：定义房间生命周期中的各个阶段
 *
 * 基于 2.3-turn-system-design.md 设计文档
 */

import type { Entity } from "../types";

// ===== 阶段类型 =====

/**
 * 内置阶段类型
 */
export const PhaseTypes = {
  /** 等待大厅 - 游戏开始前的等待阶段 */
  LOBBY: "lobby",
  /** 行动输入 - 玩家提交行动的阶段 */
  ACTION_INPUT: "action_input",
  /** AI 处理 - Host 调用 AI 生成响应的阶段 */
  AI_PROCESSING: "ai_processing",
  /** 叙事展示 - 展示 AI 响应的阶段 */
  NARRATIVE: "narrative",
  /** 游戏结束 - 游戏终止阶段 */
  ENDED: "ended",
} as const;

export type PhaseType = (typeof PhaseTypes)[keyof typeof PhaseTypes];

// ===== 阶段配置类型 =====

/**
 * Lobby 阶段配置
 */
export interface LobbyConfig {
  /** 最少玩家数（达到后可开始游戏） */
  minPlayers: number;
}

/**
 * ActionInput 阶段配置
 */
export interface ActionInputConfig {
  /** 截止时间（毫秒时间戳） */
  deadline: number;
  /** 允许编辑已提交的行动 */
  allowEdit: boolean;
  /** 允许撤回行动 */
  allowWithdraw: boolean;
  /** 全员提交后自动进入下一阶段 */
  autoAdvanceOnAllSubmit: boolean;
  /** 全员提交后的缓冲时间（毫秒） */
  bufferTime: number;
}

/**
 * AIProcessing 阶段配置
 */
export interface AIProcessingConfig {
  /** AI 调用超时时间（毫秒） */
  timeout: number;
}

/**
 * Narrative 阶段配置
 */
export interface NarrativeConfig {
  /** 内容来源（aiResponse = 当前回合的 AI 响应） */
  contentSource: "aiResponse" | "custom";
  /** 需要 Host 确认才能进入下一阶段 */
  requireHostConfirm: boolean;
}

/**
 * Ended 阶段配置（无需配置）
 */
export type EndedConfig = Record<string, never>;

/**
 * 阶段配置联合类型
 */
export type PhaseConfig =
  | LobbyConfig
  | ActionInputConfig
  | AIProcessingConfig
  | NarrativeConfig
  | EndedConfig;

// ===== 阶段定义 =====

/**
 * 阶段定义（模板中的静态定义）
 */
export interface PhaseDefinition {
  /** 阶段类型 */
  type: PhaseType;
  /** 显示标签 */
  label: string;
  /** 描述 */
  description?: string;
  /** 默认配置 */
  defaultConfig?: Partial<PhaseConfig>;
}

/**
 * 阶段实例（运行时状态）
 */
export interface PhaseInstance extends Entity {
  /** 阶段类型 */
  type: PhaseType;
  /** 运行时配置（合并默认配置和实例配置） */
  config: PhaseConfig;
  /** 阶段数据（运行时产生的数据） */
  data: Record<string, unknown>;
  /** 进入时间 */
  enteredAt: number;
  /** 完成时间（未完成时为 undefined） */
  completedAt?: number;
}

// ===== 流程模板 =====

/**
 * 流程模板中的阶段引用
 */
export interface PhaseTemplateItem {
  /** 阶段类型 */
  type: PhaseType;
  /** 覆盖默认配置 */
  config?: Partial<PhaseConfig>;
}

/**
 * 流程模板
 *
 * 定义房间的完整生命周期：
 * 1. preGamePhases: 游戏开始前的阶段（如 lobby）
 * 2. turnTemplate: 每回合循环的阶段（如 action → ai → narrative）
 * 3. postGamePhases: 游戏结束后的阶段（如 ended）
 */
export interface FlowTemplate {
  /** 模板 ID */
  id: string;
  /** 模板名称 */
  name: string;
  /** 描述 */
  description?: string;
  /** 预游戏阶段 */
  preGamePhases: PhaseTemplateItem[];
  /** 回合模板（每回合循环执行） */
  turnTemplate: PhaseTemplateItem[];
  /** 游戏结束阶段 */
  postGamePhases: PhaseTemplateItem[];
}

// ===== 内置阶段定义 =====

/**
 * 内置阶段定义
 */
export const BUILT_IN_PHASES: Record<PhaseType, PhaseDefinition> = {
  [PhaseTypes.LOBBY]: {
    type: PhaseTypes.LOBBY,
    label: "等待大厅",
    description: "等待玩家加入，房主可开始游戏",
    defaultConfig: {
      minPlayers: 1,
    } as LobbyConfig,
  },
  [PhaseTypes.ACTION_INPUT]: {
    type: PhaseTypes.ACTION_INPUT,
    label: "行动输入",
    description: "玩家提交本回合的行动",
    defaultConfig: {
      deadline: 0, // 由运行时计算
      allowEdit: true,
      allowWithdraw: true,
      autoAdvanceOnAllSubmit: true,
      bufferTime: 5000, // 5秒缓冲
    } as ActionInputConfig,
  },
  [PhaseTypes.AI_PROCESSING]: {
    type: PhaseTypes.AI_PROCESSING,
    label: "AI 处理",
    description: "Host 调用 AI 生成响应",
    defaultConfig: {
      timeout: 60000, // 60秒超时
    } as AIProcessingConfig,
  },
  [PhaseTypes.NARRATIVE]: {
    type: PhaseTypes.NARRATIVE,
    label: "叙事展示",
    description: "展示 AI 生成的叙事内容",
    defaultConfig: {
      contentSource: "aiResponse",
      requireHostConfirm: false,
    } as NarrativeConfig,
  },
  [PhaseTypes.ENDED]: {
    type: PhaseTypes.ENDED,
    label: "游戏结束",
    description: "游戏已结束",
    defaultConfig: {},
  },
};

// ===== 默认流程模板 =====

/**
 * 默认 TRPG 流程模板
 *
 * 流程：lobby → (action_input → ai_processing → narrative) × N → ended
 */
export const DEFAULT_FLOW_TEMPLATE: FlowTemplate = {
  id: "default-trpg",
  name: "标准 TRPG 流程",
  description: "等待大厅 → 回合循环（行动输入 → AI 处理 → 叙事展示）→ 游戏结束",
  preGamePhases: [{ type: PhaseTypes.LOBBY }],
  turnTemplate: [
    { type: PhaseTypes.ACTION_INPUT },
    { type: PhaseTypes.AI_PROCESSING },
    { type: PhaseTypes.NARRATIVE },
  ],
  postGamePhases: [{ type: PhaseTypes.ENDED }],
};

// ===== 工厂函数 =====

/**
 * 创建阶段实例
 */
export function createPhaseInstance(
  type: PhaseType,
  configOverride?: Partial<PhaseConfig>
): PhaseInstance {
  const definition = BUILT_IN_PHASES[type];
  const now = Date.now();

  return {
    id: crypto.randomUUID(),
    type,
    config: {
      ...definition.defaultConfig,
      ...configOverride,
    } as PhaseConfig,
    data: {},
    enteredAt: now,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * 从模板项创建阶段实例
 */
export function createPhaseFromTemplate(
  templateItem: PhaseTemplateItem
): PhaseInstance {
  return createPhaseInstance(templateItem.type, templateItem.config);
}

/**
 * 获取流程模板中的下一阶段类型
 *
 * @param template 流程模板
 * @param currentPhaseType 当前阶段类型
 * @param currentTurnNumber 当前回合号（0 = 预游戏阶段）
 * @param currentPhaseIndexInTurn 当前阶段在回合模板中的索引
 * @returns 下一阶段信息，或 null 表示流程结束
 */
export function getNextPhaseInfo(
  template: FlowTemplate,
  currentPhaseType: PhaseType,
  currentTurnNumber: number,
  currentPhaseIndexInTurn: number
): {
  nextPhase: PhaseTemplateItem;
  nextTurnNumber: number;
  nextPhaseIndex: number;
  isNewTurn: boolean;
} | null {
  // 预游戏阶段
  if (currentTurnNumber === 0) {
    const preGameIndex = template.preGamePhases.findIndex(
      (p) => p.type === currentPhaseType
    );

    // 预游戏阶段内的下一个
    if (preGameIndex >= 0 && preGameIndex < template.preGamePhases.length - 1) {
      return {
        nextPhase: template.preGamePhases[preGameIndex + 1],
        nextTurnNumber: 0,
        nextPhaseIndex: preGameIndex + 1,
        isNewTurn: false,
      };
    }

    // 预游戏阶段结束，进入第一回合
    if (template.turnTemplate.length > 0) {
      return {
        nextPhase: template.turnTemplate[0],
        nextTurnNumber: 1,
        nextPhaseIndex: 0,
        isNewTurn: true,
      };
    }

    // 没有回合模板，直接进入结束阶段
    if (template.postGamePhases.length > 0) {
      return {
        nextPhase: template.postGamePhases[0],
        nextTurnNumber: -1, // -1 表示结束阶段
        nextPhaseIndex: 0,
        isNewTurn: false,
      };
    }

    return null;
  }

  // 结束阶段
  if (currentTurnNumber < 0) {
    const postGameIndex = template.postGamePhases.findIndex(
      (p) => p.type === currentPhaseType
    );

    if (
      postGameIndex >= 0 &&
      postGameIndex < template.postGamePhases.length - 1
    ) {
      return {
        nextPhase: template.postGamePhases[postGameIndex + 1],
        nextTurnNumber: -1,
        nextPhaseIndex: postGameIndex + 1,
        isNewTurn: false,
      };
    }

    // 流程完全结束
    return null;
  }

  // 回合内的阶段
  if (currentPhaseIndexInTurn < template.turnTemplate.length - 1) {
    return {
      nextPhase: template.turnTemplate[currentPhaseIndexInTurn + 1],
      nextTurnNumber: currentTurnNumber,
      nextPhaseIndex: currentPhaseIndexInTurn + 1,
      isNewTurn: false,
    };
  }

  // 当前回合结束，进入下一回合
  return {
    nextPhase: template.turnTemplate[0],
    nextTurnNumber: currentTurnNumber + 1,
    nextPhaseIndex: 0,
    isNewTurn: true,
  };
}

/**
 * 检查阶段是否已完成
 */
export function isPhaseCompleted(phase: PhaseInstance): boolean {
  return phase.completedAt !== undefined;
}

/**
 * 标记阶段为已完成
 */
export function completePhase(phase: PhaseInstance): PhaseInstance {
  return {
    ...phase,
    completedAt: Date.now(),
    updatedAt: Date.now(),
  };
}
