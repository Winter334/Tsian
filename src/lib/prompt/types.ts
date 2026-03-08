/**
 * 提示词系统类型定义
 */

import type { ManualMemory } from "@/domain/entities/memory";
import type { ResultFrame, TagMetadata } from "@/domain/types";
import type { AdvancedSettings } from "@/lib/ai";
import type { Message as AIMessage } from "@/lib/ai/types";
import type { PostProcessRule } from "@/lib/post-process/types";
import type { WorldConfig } from "@/lib/world/types";
import type { MARKER_IDS } from "./marker-registry";

/**
 * Marker 类型（从注册表 MARKER_IDS 派生）
 */
export type MarkerType = (typeof MARKER_IDS)[number];

/**
 * 预设用途
 */
export type PresetPurpose = "narrative" | "parser" | "summarizer" | "director";

/**
 * 游戏状态快照（IRNR）
 */
export type GameStateSnapshot = Readonly<Record<string, unknown>>;

/**
 * 提示词块
 */
export interface PromptBlock {
  /** 唯一标识符 */
  id: string;

  /** 显示名称 */
  name: string;

  /** 提示词内容（支持变量模板） */
  content: string;

  /** 消息角色 */
  role: "system" | "user" | "assistant";

  /** 是否为占位标记 */
  marker: boolean;

  /** Marker 类型（当 marker=true 时有效） */
  markerType?: MarkerType;

  /** Marker 配置（当 marker=true 时有效） */
  markerConfig?: {
    /** 对话历史最大条数（chatHistory 用） */
    maxMessages?: number;
    /** 是否包含系统消息（chatHistory 用） */
    includeSystemMessages?: boolean;

    /** 最近 N 回合发送完整 AI 正文（memorySummary 用） */
    recentNarrativeCount?: number;
    /** 小总结发送数量（memorySummary 用） */
    miniSummaryCount?: number;
    /** 大总结发送策略（memorySummary 用） */
    megaSummaryMode?: "all" | "recent";
    /** 大总结最多发送数量（memorySummary 用） */
    megaSummaryLimit?: number;
    /** 压缩触发阈值（memorySummary 用） */
    compressionThreshold?: number;
  };

  /** 注入深度（V1 固定为 0，保留用于 V2 扩展和酒馆预设导入） */
  injectionDepth: number;

  /** 同深度排序优先级 */
  order: number;

  /** 是否启用 */
  enabled: boolean;
}

/**
 * 预设
 */
export interface Preset {
  /** 预设 ID */
  id: string;

  /** 预设名称 */
  name: string;

  /** 预设描述 */
  description?: string;

  /** 提示词块列表 */
  blocks: PromptBlock[];

  /** 提示词顺序（block id 数组） */
  blockOrder: string[];

  /** 关联的 AI Profile ID */
  aiProfileId?: string;

  /** AI 参数覆盖（可选） */
  aiSettings?: Partial<AdvancedSettings>;

  /** 后处理规则列表（可选，未定义时使用内置规则） */
  postProcessRules?: PostProcessRule[];

  /** 元数据 */
  metadata: {
    version: string;
    author?: string;
    createdAt: number;
    updatedAt: number;
    source: "lyra" | "tavern";
  };

  /** 预设用途（默认 narrative） */
  purpose?: PresetPurpose;

  /** 预留：目标 AI 角色类型 */
  targetRole?: "narrator" | "combat" | "npc" | "general";

  /** 预设的输入/输出标签契约声明 */
  ioContract?: {
    /** 输出中必须包含的标签名 */
    requiredTags?: string[];
    /** 输出中可选的标签名 */
    optionalTags?: string[];
  };
}

/**
 * 角色信息
 */
export interface CharacterInfo {
  name: string;
  /** 角色背景故事 */
  description?: string;
  /** 性格特征 */
  personality?: string;
  /** 外貌描述 */
  appearance?: string;
  /** 维度选择（key: 维度 ID, value: 选项 ID），引用 WorldConfig.dimensions */
  dimensionSelections?: Record<string, string>;
  /** 已选天赋 ID 列表 */
  talentIds?: string[];
  /** 角色属性值 */
  attributes?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * 玩家信息
 */
export interface PlayerInfo {
  name: string;
  character?: CharacterInfo;
}

/**
 * 玩家行动（联机模式）
 */
export interface PlayerAction {
  content: string;
  timestamp: number;
  [key: string]: unknown;
}

/**
 * 回合信息（联机模式）
 */
export interface TurnInfo {
  number: number;
  actions: PlayerAction[];
}

/**
 * 世界档案注入上下文（避免跨层依赖 modules）
 */
export interface ArchiveEntityForContext {
  id: string;
  name: string;
  archetype: string;
  essence: string;
  currentState: string;
  relationships: Array<{
    targetEntityId: string;
    type: string;
    description: string;
  }>;
  tags: string[];
}

export interface VariableContext {
  /** 模式 */
  mode: "solo" | "multiplayer";

  /** 当前用户信息 */
  user: PlayerInfo;

  /** 所有玩家信息（联机模式） */
  players?: PlayerInfo[];

  /** 回合信息（联机模式） */
  turn?: TurnInfo;

  /** 对话历史 */
  chatHistory: AIMessage[];

  /** 用户当前回合的输入内容（单人模式为聊天框内容，联机模式为所有玩家行动合并） */
  userInput?: string;

  /** 世界信息 */
  worldInfo?: string;

  /** 剧情梗概 */
  scenario?: string;

  /** IRNR：当前游戏状态快照 */
  gameState?: GameStateSnapshot;

  /** IRNR：规则结算结果帧 */
  resultFrame?: ResultFrame;

  /** IRNR：可用操作定义（供解析模型使用） */
  operationDefinitions?: string;

  /** IRNR：实体效果元数据（按 entityId 分组的标签元数据列表） */
  entityEffects?: Readonly<Record<string, TagMetadata[]>>;

  /** IRNR：实体 UUID → 语义别名映射（用于 ResultFrame 等渲染时替换 UUID） */
  entityDisplayNames?: Map<string, string>;

  /** 世界配置（运行时注入，用于 marker-registry 渲染属性/天赋名称） */
  worldConfig?: WorldConfig;

  /** 在场的 NPC 角色列表（controlType === 'npc' 且 status === 'active'） */
  activeNpcs?: Array<{
    id: string;
    name: string;
    description?: string;
    personality?: string;
    appearance?: string;
    age?: number;
    gender?: string;
    attributes?: Record<string, unknown>;
    talentIds?: string[];
    tags?: Record<string, unknown>;
    status: string;
    level?: number;
  }>;

  /** 角色物品/技能数据（按角色分组，供 gameState marker 渲染） */
  inventoryData?: Array<{
    characterId: string;
    characterName: string;
    items: Array<{
      instanceId: string;
      name: string;
      description: string;
      category: string;
      quantity: number;
      equipped: boolean;
    }>;
    skills: Array<{
      instanceId: string;
      name: string;
      description: string;
      category: string;
      level: number;
      maxLevel: number;
      activeUsable: boolean;
    }>;
  }>;

  /** 分段记忆数据（由 memorySummary marker 渲染） */
  memoryData?: {
    /** 最近 N 回合的完整 AI 正文（按时间从旧到新排序） */
    recentNarratives: Array<{ id: string; content: string }>;
    /** 应注入的小总结列表 */
    miniSummaries: Array<{ id: string; content: string }>;
    /** 应注入的大总结列表 */
    megaSummaries: Array<{ id: string; content: string }>;
  };

  /** 手动记忆列表（供 {{memory:xxx}} 变量渲染） */
  manualMemories?: ManualMemory[];

  /** 世界档案数据（由 worldArchive Marker 渲染） */
  archiveData?: {
    active: ArchiveEntityForContext[];
    nearby: ArchiveEntityForContext[];
  };

  /** 导演 AI 的剧情指导（注入 Parser AI） */
  plotDirectives?: string;

  /** 导演 AI 的叙事提示（注入 Narrator AI） */
  narrativeHints?: string;

  /** 自定义变量（可通过 {{key}} 在提示词中显式引用） */
  customVariables?: Record<string, string>;
}

/**
 * 变量解析结果
 */
export interface ResolveResult {
  /** 解析后的内容 */
  content: string;

  /** 警告信息（如变量不存在、解析失败等） */
  warnings: Array<{
    variable: string;
    reason: string;
    line?: number;
  }>;
}

/**
 * 变量解析器接口
 */
export interface VariableResolver {
  /** 解析变量模板 */
  resolve(template: string, context: VariableContext): ResolveResult;

  /** 注册自定义变量 */
  registerVariable(
    name: string,
    resolver: (ctx: VariableContext) => string,
  ): void;

  /** 注册变量函数（如 {{roll:d20}}） */
  registerFunction(
    name: string,
    handler: (args: string[], ctx: VariableContext) => string,
  ): void;
}

/**
 * 消息组装器接口
 */
export interface MessageAssembler {
  /**
   * 根据预设和变量上下文组装消息
   */
  assemble(preset: Preset, context: VariableContext): AIMessage[];

  /**
   * 获取指定 Marker 块上一次组装时的解析结果
   *
   * 在每次 assemble() 执行时自动缓存每个 Marker 块的解析结果，
   * 供预设编辑器等场景查阅"上一次填充内容"。
   * 如果该块从未被组装过，返回空数组。
   */
  getLastMarkerResult(blockId: string): AIMessage[];
}
