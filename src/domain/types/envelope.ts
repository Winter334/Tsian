import type { Message as AIMessage } from "@/lib/ai/types";
import type { PresetPurpose } from "@/lib/prompt";

/**
 * Prompt v2 Context Envelope（P0 MVP）
 *
 * 仅冻结 Phase 0 所需协议字段，后续阶段可在保持兼容前提下扩展。
 */
export interface ContextEnvelope {
  /** Envelope 协议版本号（建议 semver） */
  envelopeVersion: string;

  /** 兼容声明与降级策略（预留扩展位） */
  compatibility?: {
    legacyTags?: boolean;
    structuredChannel?: boolean;
    fallbackPolicy?: string;
  };

  /** 会话信息（单机/联机统一） */
  session: {
    sessionId?: string;
    mode: "solo" | "multiplayer";
    roomId?: string;
  };

  /** 回合信息 */
  turn: {
    number: number;
    userInput: string;
    submittedAt?: number;
  };

  /** 按用途激活预设快照（保持 activePresetByPurpose 语义） */
  presets: {
    activeByPurpose: Record<PresetPurpose, string | null>;
  };

  /** 历史上下文 */
  history: {
    messages: AIMessage[];
    window?: {
      limit: number;
      total: number;
      startIndex: number;
      endIndex: number;
      truncated: boolean;
    };
  };

  /** 分段记忆快照（与 memorySummary 五字段语义对齐） */
  memory?: {
    config?: {
      recentNarrativeCount: number;
      miniSummaryCount: number;
      megaSummaryMode: "all" | "recent";
      megaSummaryLimit: number;
      compressionThreshold: number;
    };
    segments?: {
      recentNarratives: Array<{ id: string; content: string }>;
      miniSummaries: Array<{ id: string; content: string }>;
      megaSummaries: Array<{ id: string; content: string }>;
    };
  };

  /** 后处理协议冻结字段 */
  postProcess?: {
    builtinRuleIds?: string[];
  };

  /** 导演提示与档案更新等扩展指令 */
  directives?: {
    plotDirectives?: string;
    narrativeHints?: string;
    archiveUpdates?: unknown[];
  };

  /** 标签与结构化通道契约 */
  ioContract?: {
    tags: {
      memorySummary: string;
      choices: string;
    };
  };

  /** 可观测追踪信息 */
  trace?: {
    correlationId?: string;
  };

  /** 预留扩展元数据槽位 */
  metadata?: Record<string, unknown>;
}
