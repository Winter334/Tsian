import type { BlackboardBase } from "@/core/pipeline";
import type { AIConfig } from "@/lib/ai/types";
import type { Preset, VariableContext } from "@/lib/prompt/types";
import type { EntityAliasMap } from "@/lib/rules/schema";
import type { WorldConfig } from "@/lib/world";

import type {
  CreatedNpcData,
  EntityAccessor,
  EntityData,
  EntityFinalState,
} from "./entity";
import type { PipelineArchiveSnapshot } from "./pipeline-contract";
import type { ResultFrame } from "./result-frame";
import type { RuleScript } from "./rule-script";

/**
 * IRNR 管线黑板（业务层具体实现）
 *
 * - 输入层字段使用 readonly，防止 Agent 意外篡改请求入参
 * - 产出层字段由各 Agent 按阶段写入
 */
export interface PipelineBlackboard extends BlackboardBase {
  // ─── 输入层（只读） ───────────────────────────────────────────

  readonly commandId: string;
  readonly playerInput: string;
  readonly aiConfig: AIConfig;
  readonly directorAiConfig?: AIConfig;
  readonly baseVariableContext: VariableContext;
  readonly entities?: EntityData[];
  readonly worldConfig: WorldConfig;
  readonly actorId: string;
  readonly targetId?: string;
  readonly roomId?: string;
  readonly turnNumber: number;
  readonly archiveSnapshot?: PipelineArchiveSnapshot;
  readonly presets: {
    readonly parser?: Preset;
    readonly narrative: Preset;
    readonly director?: Preset;
  };
  readonly callbacks: {
    readonly onNarrativeChunk?: (chunk: string) => void;
    readonly onNarrativeComplete?: (text: string) => void;
  };
  readonly messageLocation?: {
    readonly conversationId: string;
    readonly messageId: string;
    readonly messageIndex: number;
  };

  // ─── 产出层（Agent 写入） ─────────────────────────────────────

  entityAccessor?: EntityAccessor;
  aliasMap?: EntityAliasMap;
  ruleScript?: RuleScript;
  resultFrame?: ResultFrame;
  createdNpcs?: CreatedNpcData[];

  /** 剧情指导（导演 AI → Parser AI） */
  plotDirectives?: string;
  /** 叙事提示（导演 AI → Narrator AI） */
  narrativeHints?: string;
  /** 世界档案更新指令（实际类型为 ArchiveUpdate[]，此处避免 domain 依赖 modules） */
  archiveUpdates?: unknown[];
  /** 各 Agent 的原始 AI 响应（用于 AI 洞察面板） */
  _agentRawOutputs?: Record<string, string>;

  narrativeText?: string;
  cleanNarrative?: string;
  miniSummary?: string;
  finalEntityStates?: EntityFinalState[];
}
