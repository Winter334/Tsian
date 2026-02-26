/**
 * IRNR Pipeline 公共契约类型
 *
 * 定义 Pipeline 服务的输入/输出接口，供跨模块解耦调用。
 * 使用 `import type` 引用跨层类型（纯编译期行为，无运行时耦合）。
 */

import type { AIConfig } from "@/lib/ai/types";
import type { Preset, VariableContext } from "@/lib/prompt/types";
import type { WorldConfig } from "@/lib/world";

import type { CreatedNpcData, EntityData, EntityFinalState } from "./entity";
import type { ResultFrame } from "./result-frame";
import type { RuleScript } from "./rule-script";

// ─── 输入类型 ─────────────────────────────────────────────

/**
 * IRNR Pipeline 输入基础字段
 *
 * SoloIrnrInput 和 MultiplayerIrnrInput 的公共部分。
 */
export interface IrnrPipelineInputBase {
  commandId: string;
  userInput: string;
  /** AI 配置 */
  aiConfig: AIConfig;
  /** narrative 预设（叙事 AI） */
  narrativePreset: Preset;
  /** parser 预设（解析 AI，可选——无预设时 Parser Agent 写入空 ruleScript） */
  parserPreset?: Preset;
  /** 变量上下文基础（pipeline 会注入 gameState / resultFrame） */
  baseVariableContext: VariableContext;
  /** 实体数据（玩家角色等） */
  entities?: EntityData[];
  /** 世界配置（可选，默认使用 DEFAULT_WORLD_CONFIG） */
  worldConfig?: WorldConfig;
  /** actor 实体 ID */
  actorId?: string;
  /** target 实体 ID */
  targetId?: string;
  /** 流式叙事回调 */
  onNarrativeChunk?: (chunk: string) => void;
  /** 叙事完成回调 */
  onNarrativeComplete?: (text: string) => void;
  /** 会话 ID（用于写入回合小总结，可选） */
  conversationId?: string;
  /** assistant 消息 ID（用于关联小总结，可选） */
  messageId?: string;
  /** assistant 消息序号（用于范围计算，可选） */
  messageIndex?: number;
}

/**
 * 单人模式 IRNR Pipeline 输入
 */
export type SoloIrnrInput = IrnrPipelineInputBase;

/**
 * 多人模式 IRNR Pipeline 输入
 */
export interface MultiplayerIrnrInput extends IrnrPipelineInputBase {
  roomId: string;
  turnNumber: number;
}

// ─── 输出类型 ─────────────────────────────────────────────

/**
 * IRNR Pipeline 执行结果
 */
export interface IrnrPipelineResult {
  success: boolean;
  error?: string;
  ruleScript?: RuleScript;
  resultFrame?: ResultFrame;
  narrativeText?: string;
  /**
   * 所有实体的最终状态快照（成功时返回）
   *
   * 联机模式下，调用方应将 fields/tags 回写到 MainDoc.characters，
   * 确保 valueChanges 和 tagChanges 持久化。
   */
  finalEntityStates?: EntityFinalState[];
  /** 本次执行中动态创建的 NPC 列表 */
  createdNpcs?: CreatedNpcData[];
}

// ─── 服务契约 ─────────────────────────────────────────────

/**
 * IRNR Pipeline 服务契约接口
 *
 * 用于 ServiceRegistry Token 的泛型参数，
 * 实现跨模块强类型调用。
 */
export interface IrnrPipelineServiceContract {
  runSolo(input: SoloIrnrInput): Promise<IrnrPipelineResult>;
  runMultiplayer(input: MultiplayerIrnrInput): Promise<IrnrPipelineResult>;
}
