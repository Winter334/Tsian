import type { AgentDescriptor } from "@/core/pipeline";
import type { PipelineBlackboard } from "@/domain/types";
import { createAiExecutor } from "@/lib/ai/executor";
import type { AIConfig } from "@/lib/ai/types";
import type { Preset } from "@/lib/prompt/types";
import type { EntityAliasMap } from "@/lib/rules/schema";
import type { MapEntityAccessor } from "@/modules/game/services/entity-accessor";
import { useWorldArchiveStore } from "@/modules/world-archive/store";
import type { ArchiveUpdate } from "@/modules/world-archive/types";

import {
  WARNING_CODES,
  type WarningRecord,
} from "@/domain/constants/warning-codes";
import { buildDirectorContext } from "./context-builder";
import {
  parseArchiveUpdates,
  parseDirectorOutput,
  parseOutlineUpdates,
  type OutlineUpdateInstruction,
} from "./output-parser";
import { getDirectorRepository } from "./repository";
import { useDirectorStore } from "./store";
import type { DirectorLogEntry, Foreshadow, Milestone } from "./types";

interface DirectorBlackboardExtension {
  plotDirectives?: string;
  turnNarrativeIntent?: string;
  narrativeHints?: string;
  archiveUpdates?: ArchiveUpdate[];
  directorAiConfig?: AIConfig;
}

type DirectorBlackboard = PipelineBlackboard & DirectorBlackboardExtension;
type PresetsWithDirector = PipelineBlackboard["presets"] & {
  director?: Preset;
};
type BlackboardWithAliasMap = PipelineBlackboard & {
  aliasMap?: EntityAliasMap;
};
type BlackboardWithEntityAccessor = PipelineBlackboard & {
  entityAccessor?: MapEntityAccessor;
};

function normalizeRef(value: string): string {
  return value.trim().toLowerCase();
}

function resolveMilestoneId(
  milestoneRef: string,
  milestones: Milestone[],
): string | undefined {
  const normalizedRef = normalizeRef(milestoneRef);
  const exact = milestones.find((milestone) => {
    return (
      normalizeRef(milestone.id) === normalizedRef ||
      normalizeRef(milestone.description) === normalizedRef
    );
  });
  if (exact) {
    return exact.id;
  }

  const fuzzy = milestones.find((milestone) => {
    const id = normalizeRef(milestone.id);
    const description = normalizeRef(milestone.description);
    return id.includes(normalizedRef) || description.includes(normalizedRef);
  });

  return fuzzy?.id;
}

function resolveForeshadowId(
  foreshadowRef: string,
  foreshadows: Record<string, Foreshadow>,
): string | undefined {
  const normalizedRef = normalizeRef(foreshadowRef);
  const entries = Object.entries(foreshadows);

  const exact = entries.find(([, foreshadow]) => {
    return (
      normalizeRef(foreshadow.id) === normalizedRef ||
      normalizeRef(foreshadow.description) === normalizedRef
    );
  });
  if (exact) {
    return exact[0];
  }

  const fuzzy = entries.find(([, foreshadow]) => {
    const id = normalizeRef(foreshadow.id);
    const description = normalizeRef(foreshadow.description);
    return id.includes(normalizedRef) || description.includes(normalizedRef);
  });

  return fuzzy?.[0];
}

function applyOutlineInstructions(instructions: OutlineUpdateInstruction[]): {
  outlineChanged: boolean;
  foreshadowChanged: boolean;
} {
  let outlineChanged = false;
  let foreshadowChanged = false;

  for (const instruction of instructions) {
    switch (instruction.type) {
      case "append_arc_deviation": {
        const state = useDirectorStore.getState();
        const outline = state.outline;
        if (!outline) {
          continue;
        }

        const nextDeviations = [
          ...outline.currentArc.deviations,
          instruction.deviation,
        ];

        state.updateCurrentArc({ deviations: nextDeviations });
        outlineChanged = true;
        break;
      }
      case "set_arc_status": {
        const state = useDirectorStore.getState();
        if (!state.outline) {
          continue;
        }

        state.updateCurrentArc({ status: instruction.status });
        outlineChanged = true;
        break;
      }
      case "set_milestone_status": {
        const state = useDirectorStore.getState();
        const outline = state.outline;
        if (!outline) {
          continue;
        }

        const milestoneId = resolveMilestoneId(
          instruction.milestoneRef,
          outline.currentArc.milestones,
        );
        if (!milestoneId) {
          continue;
        }

        const nextMilestones = outline.currentArc.milestones.map(
          (milestone) => {
            if (milestone.id !== milestoneId) {
              return milestone;
            }

            return {
              ...milestone,
              status: instruction.status,
            };
          },
        );

        state.updateCurrentArc({ milestones: nextMilestones });
        outlineChanged = true;
        break;
      }
      case "increment_foreshadow_hint": {
        const state = useDirectorStore.getState();
        const foreshadowId = resolveForeshadowId(
          instruction.foreshadowRef,
          state.foreshadows,
        );
        if (!foreshadowId) {
          continue;
        }

        const existed = state.foreshadows[foreshadowId];
        if (!existed) {
          continue;
        }

        const nextHintCount = Math.max(
          0,
          existed.hintCount + instruction.delta,
        );
        state.updateForeshadow(foreshadowId, {
          hintCount: nextHintCount,
        });
        foreshadowChanged = true;
        break;
      }
      case "set_foreshadow_status": {
        const state = useDirectorStore.getState();
        const foreshadowId = resolveForeshadowId(
          instruction.foreshadowRef,
          state.foreshadows,
        );
        if (!foreshadowId) {
          continue;
        }

        state.updateForeshadow(foreshadowId, {
          status: instruction.status,
        });
        foreshadowChanged = true;
        break;
      }
      case "add_foreshadow": {
        useDirectorStore.getState().addForeshadow(instruction.foreshadow);
        foreshadowChanged = true;
        break;
      }
      case "remove_foreshadow": {
        const state = useDirectorStore.getState();
        const foreshadowId = resolveForeshadowId(
          instruction.foreshadowRef,
          state.foreshadows,
        );
        if (!foreshadowId) {
          continue;
        }

        state.removeForeshadow(foreshadowId);
        foreshadowChanged = true;
        break;
      }
      default:
        break;
    }
  }

  return { outlineChanged, foreshadowChanged };
}

export const directorAgent: AgentDescriptor<PipelineBlackboard> = {
  id: "director",
  name: "导演AI",
  requires: ["playerInput", "entityAccessor", "aliasMap"],
  produces: [
    "plotDirectives",
    "turnNarrativeIntent",
    "narrativeHints",
    "archiveUpdates",
  ] as unknown as (keyof PipelineBlackboard & string)[],
  optional: false,

  async execute(bb) {
    const directorBb = bb as DirectorBlackboard;
    const directorPreset = (bb.presets as PresetsWithDirector).director;

    if (!directorPreset) {
      throw new Error(
        "导演 AI 预设缺失。导演 AI 是必选 Agent，请确保已配置导演预设。",
      );
    }

    const directorContext = buildDirectorContext(bb);
    const executor = createAiExecutor(bb.directorAiConfig ?? bb.aiConfig);

    let responseText = "";
    const result = await executor.execute({
      preset: directorPreset,
      variableContext: directorContext,
      onChunk: (chunk) => {
        responseText += chunk;
      },
      onComplete: (text) => {
        responseText = text;
      },
    });

    if (!result.success) {
      throw new Error(
        `导演 AI 调用失败: ${result.error?.message ?? "未知错误"}`,
      );
    }

    const rawContent = result.content ?? responseText;
    bb._agentRawOutputs ??= {};
    bb._agentRawOutputs.director = rawContent;

    const requiredTags = directorPreset.ioContract?.requiredTags ?? [
      "plot_directives",
      "turn_narrative_intent",
      "narrative_hints",
      "archive_updates",
    ];

    const pushWarning = (
      code: WarningRecord["code"],
      message: string,
      details?: Record<string, unknown>,
    ): void => {
      const warning: WarningRecord = {
        code,
        message,
        stage: "director",
        details,
        timestamp: Date.now(),
      };
      bb.warnings ??= [];
      bb.warnings.push(warning);
      console.warn(`[Director] ${code}:`, message, details);
    };

    let parsed: ReturnType<typeof parseDirectorOutput>;
    try {
      parsed = parseDirectorOutput(rawContent, {
        ioContract: directorPreset.ioContract,
      });
    } catch (error) {
      pushWarning(
        WARNING_CODES.DIRECTOR_PARSE_FAILED,
        error instanceof Error ? error.message : "导演输出解析失败（未知错误）",
        {
          errorName: error instanceof Error ? error.name : "UnknownError",
        },
      );
      throw error;
    }

    if (parsed.degraded) {
      const parseWarnings = parsed.parseWarnings ?? [];
      const missingTags = new Set(parseWarnings);
      const allRequiredMissing =
        requiredTags.length > 0 &&
        requiredTags.every((tag) => missingTags.has(tag)) &&
        parsed.plotDirectives === "" &&
        parsed.turnNarrativeIntent === "" &&
        parsed.narrativeHints === "" &&
        parsed.archiveUpdatesRaw === "";

      const warningCode = allRequiredMissing
        ? WARNING_CODES.DIRECTOR_PARSE_FAILED
        : WARNING_CODES.DIRECTOR_PARSE_DEGRADED;
      const warningMessage = allRequiredMissing
        ? "输出解析失败，所有必填标签均缺失，已回退为空字符串"
        : "输出解析触发降级，已回退缺失标签为空字符串";

      pushWarning(warningCode, warningMessage, { parseWarnings });
    }

    const archiveStore = useWorldArchiveStore.getState();
    const aliasMap = (bb as BlackboardWithAliasMap).aliasMap;

    const entityLookup = (nameOrId: string): string | undefined => {
      const normalized = nameOrId.trim();
      if (!normalized) {
        return undefined;
      }

      const byId = archiveStore.getEntity(normalized);
      if (byId) {
        return byId.id;
      }

      const normalizedLower = normalized.toLowerCase();
      const aliasResolved = aliasMap?.aliases.get(normalizedLower);
      if (aliasResolved) {
        return aliasResolved;
      }

      const allEntities = Object.values(archiveStore.entities);

      const exactByName = allEntities.find(
        (entity) => entity.name === normalized,
      );
      if (exactByName) {
        return exactByName.id;
      }

      const caseInsensitiveByName = allEntities.find((entity) => {
        return entity.name.toLowerCase() === normalizedLower;
      });
      if (caseInsensitiveByName) {
        return caseInsensitiveByName.id;
      }

      const includesByName = allEntities.find((entity) => {
        const lowerName = entity.name.toLowerCase();
        return (
          lowerName.includes(normalizedLower) ||
          normalizedLower.includes(lowerName)
        );
      });

      return includesByName?.id;
    };

    const currentTurn = bb.turnNumber;

    directorBb.plotDirectives = parsed.plotDirectives;
    directorBb.turnNarrativeIntent = parsed.turnNarrativeIntent;
    directorBb.narrativeHints = parsed.narrativeHints;

    let archiveUpdates: ArchiveUpdate[] = [];
    try {
      archiveUpdates = parseArchiveUpdates(
        parsed.archiveUpdatesRaw,
        entityLookup,
        currentTurn,
      );
    } catch (error) {
      pushWarning(
        WARNING_CODES.DIRECTOR_PARSE_DEGRADED,
        error instanceof Error
          ? `archive_updates 解析失败，已跳过该段：${error.message}`
          : "archive_updates 解析失败，已跳过该段（未知错误）",
        {
          section: "archive_updates",
          errorName: error instanceof Error ? error.name : "UnknownError",
        },
      );
    }

    directorBb.archiveUpdates = archiveUpdates;

    // 黑板→Envelope 桥接：当 USE_ENVELOPE_V2 开启时，将 directives 同步写入 envelope
    if (directorBb.envelope) {
      directorBb.envelope = {
        ...directorBb.envelope,
        directives: {
          ...directorBb.envelope.directives,
          plotDirectives: parsed.plotDirectives,
          turnNarrativeIntent: parsed.turnNarrativeIntent,
          narrativeHints: parsed.narrativeHints,
          archiveUpdates,
        },
      };
    }

    const logEntry: DirectorLogEntry = {
      turn: currentTurn,
      timestamp: Date.now(),
      plotDirectives: parsed.plotDirectives,
      turnNarrativeIntent: parsed.turnNarrativeIntent,
      narrativeHints: parsed.narrativeHints,
      archiveUpdatesSummary: parsed.archiveUpdatesRaw,
      outlineUpdatesSummary: parsed.outlineUpdatesRaw,
    };

    let outlineChanged = false;
    let foreshadowChanged = false;
    try {
      const outlineInstructions = parsed.outlineUpdatesRaw
        ? parseOutlineUpdates(parsed.outlineUpdatesRaw, currentTurn)
        : [];

      ({ outlineChanged, foreshadowChanged } =
        applyOutlineInstructions(outlineInstructions));
    } catch (error) {
      pushWarning(
        WARNING_CODES.DIRECTOR_PARSE_DEGRADED,
        error instanceof Error
          ? `outline_updates 处理失败，已跳过该段：${error.message}`
          : "outline_updates 处理失败，已跳过该段（未知错误）",
        {
          section: "outline_updates",
          errorName: error instanceof Error ? error.name : "UnknownError",
        },
      );
    }

    useDirectorStore.getState().appendDirectorLog(logEntry);

    const directorRepo = getDirectorRepository();
    const directorStore = useDirectorStore.getState();

    if (outlineChanged && directorStore.outline) {
      directorRepo.saveOutline(directorStore.outline);
    }

    if (foreshadowChanged) {
      const persistedForeshadows = directorRepo.getAllForeshadows();
      Object.keys(persistedForeshadows).forEach((foreshadowId) => {
        if (!directorStore.foreshadows[foreshadowId]) {
          directorRepo.deleteForeshadow(foreshadowId);
        }
      });

      Object.values(directorStore.foreshadows).forEach((foreshadow) => {
        directorRepo.saveForeshadow(foreshadow);
      });
    }

    directorRepo.saveDirectorLog(directorStore.directorLog);

    if (!(bb as BlackboardWithEntityAccessor).entityAccessor) {
      console.warn(
        "[Director] 当前黑板缺少 entityAccessor，导演上下文未注入 gameState",
      );
    }
  },
};
