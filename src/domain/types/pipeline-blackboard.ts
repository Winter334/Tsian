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
  readonly baseVariableContext: VariableContext;
  readonly entities?: EntityData[];
  readonly worldConfig: WorldConfig;
  readonly actorId: string;
  readonly targetId?: string;
  readonly roomId?: string;
  readonly presets: {
    readonly parser?: Preset;
    readonly narrative: Preset;
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
  narrativeText?: string;
  cleanNarrative?: string;
  miniSummary?: string;
  finalEntityStates?: EntityFinalState[];
}
