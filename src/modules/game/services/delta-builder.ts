/**
 * Prompt v2 Phase 5 Delta Builder
 *
 * 只读消费 PipelineBlackboard，基于统一 IRNR 黑板与执行 trace
 * 生成同构的回合 Delta 链，不反向改写任何阶段产物。
 */

import type {
  DeltaCommitStatus,
  DeltaPatch,
  DeltaSource,
  DeltaTerminalCommitStatus,
  PipelineBlackboard,
  TurnDelta,
} from "@/domain/types";

const DEFAULT_DELTA_VERSION = "1.0.0";
const DEFAULT_ENVELOPE_VERSION = "2.0.0";

const TRACE_DELTA_SOURCE_MAP = {
  director: "director",
  parser: "parser",
  engine: "engine",
  narrator: "narrator",
  "post-processor": "postprocess",
  summarizer: "summarizer",
} as const satisfies Record<string, DeltaSource>;

type TraceDeltaAgentId = keyof typeof TRACE_DELTA_SOURCE_MAP;

function isTraceDeltaAgentId(agentId: string): agentId is TraceDeltaAgentId {
  return agentId in TRACE_DELTA_SOURCE_MAP;
}

export function resolveDeltaBaseTurn(turn: number): number {
  if (!Number.isFinite(turn) || turn <= 0) {
    return 0;
  }

  return Math.max(0, Math.floor(turn) - 1);
}

export function isDeltaTerminalStatus(
  status: DeltaCommitStatus,
): status is DeltaTerminalCommitStatus {
  return status === "committed" || status === "discarded";
}

export function hasDeltaTerminalState(deltas: readonly TurnDelta[]): boolean {
  const lastDelta = deltas[deltas.length - 1];
  return lastDelta ? isDeltaTerminalStatus(lastDelta.commitStatus) : false;
}

export function getTurnDeltaReplayKey(
  delta: Pick<TurnDelta, "baseTurn" | "sequence">,
): string {
  return `${delta.baseTurn}:${delta.sequence}`;
}

export function compareTurnDeltaOrder(
  left: Pick<TurnDelta, "baseTurn" | "sequence">,
  right: Pick<TurnDelta, "baseTurn" | "sequence">,
): number {
  if (left.baseTurn !== right.baseTurn) {
    return left.baseTurn - right.baseTurn;
  }

  return left.sequence - right.sequence;
}

function buildDirectorPatches(bb: Partial<PipelineBlackboard>): DeltaPatch[] {
  const patches: DeltaPatch[] = [];
  const hasDirectives =
    typeof bb.plotDirectives === "string" ||
    typeof bb.narrativeHints === "string";

  if (hasDirectives) {
    patches.push({
      op: "directives.replace",
      path: "/directives",
      value: {
        plotDirectives: bb.plotDirectives ?? "",
        narrativeHints: bb.narrativeHints ?? "",
      },
    });
  }

  if (Array.isArray(bb.archiveUpdates) && bb.archiveUpdates.length > 0) {
    patches.push({
      op: "archive.apply",
      path: "/archive/updates",
      value: bb.archiveUpdates,
    });
  }

  return patches;
}

function buildParserPatches(bb: Partial<PipelineBlackboard>): DeltaPatch[] {
  if (!bb.ruleScript) {
    return [];
  }

  return [
    {
      op: "rulescript.replace",
      path: "/ruleScript",
      value: bb.ruleScript,
    },
  ];
}

function buildEnginePatches(bb: Partial<PipelineBlackboard>): DeltaPatch[] {
  if (!bb.resultFrame) {
    return [];
  }

  const patches: DeltaPatch[] = [
    {
      op: "resultFrame.replace",
      path: "/resultFrame",
      value: bb.resultFrame,
    },
  ];

  const valueChanges = bb.resultFrame.valueChanges ?? [];
  const structuralChanges = bb.resultFrame.structuralChanges ?? [];
  if (valueChanges.length > 0 || structuralChanges.length > 0) {
    patches.push({
      op: "entities.patch",
      path: "/entities/runtime",
      value: {
        valueChanges,
        structuralChanges,
      },
    });
  }

  return patches;
}

function buildNarratorPatches(bb: Partial<PipelineBlackboard>): DeltaPatch[] {
  if (typeof bb.narrativeText !== "string") {
    return [];
  }

  return [
    {
      op: "narrative.replace",
      path: "/narrative",
      value: {
        raw: bb.narrativeText,
      },
    },
  ];
}

function buildPostProcessPatches(
  bb: Partial<PipelineBlackboard>,
): DeltaPatch[] {
  const patches: DeltaPatch[] = [];
  const warnings = bb.warnings ?? [];
  const hasPostProcessOutput =
    typeof bb.cleanNarrative === "string" ||
    typeof bb.miniSummary === "string" ||
    warnings.length > 0;

  if (hasPostProcessOutput) {
    patches.push({
      op: "postprocess.extracted",
      path: "/postprocess",
      value: {
        cleanNarrative: bb.cleanNarrative,
        miniSummary: bb.miniSummary,
        warnings,
      },
    });
  }

  if (typeof bb.miniSummary === "string" && bb.miniSummary.length > 0) {
    patches.push({
      op: "memory.appendMini",
      path: "/memory/miniSummary",
      value: {
        content: bb.miniSummary,
      },
    });
  }

  return patches;
}

function buildSummarizerPatches(
  _bb: Partial<PipelineBlackboard>,
): DeltaPatch[] {
  return [];
}

function buildSourcePatches(
  source: DeltaSource,
  bb: Partial<PipelineBlackboard>,
): DeltaPatch[] {
  switch (source) {
    case "director":
      return buildDirectorPatches(bb);
    case "parser":
      return buildParserPatches(bb);
    case "engine":
      return buildEnginePatches(bb);
    case "narrator":
      return buildNarratorPatches(bb);
    case "postprocess":
      return buildPostProcessPatches(bb);
    case "summarizer":
      return buildSummarizerPatches(bb);
    case "system":
      return [];
    default:
      return [];
  }
}

function buildTerminalPatches(
  bb: Partial<PipelineBlackboard>,
  terminalStatus: DeltaTerminalCommitStatus,
): DeltaPatch[] {
  if (terminalStatus !== "committed") {
    return [];
  }

  const patches: DeltaPatch[] = [];

  if (Array.isArray(bb.finalEntityStates) && bb.finalEntityStates.length > 0) {
    patches.push({
      op: "entities.patch",
      path: "/entities/finalState",
      value: {
        finalEntityStates: bb.finalEntityStates,
      },
    });
  }

  return patches;
}

function createTurnDelta(input: {
  turn: number;
  baseTurn: number;
  sequence: number;
  envelopeVersion: string;
  source: DeltaSource;
  commitStatus: DeltaCommitStatus;
  patches: DeltaPatch[];
  metadata?: Record<string, unknown>;
}): TurnDelta {
  return {
    deltaVersion: DEFAULT_DELTA_VERSION,
    envelopeVersion: input.envelopeVersion,
    turn: input.turn,
    baseTurn: input.baseTurn,
    sequence: input.sequence,
    source: input.source,
    commitStatus: input.commitStatus,
    patches: input.patches,
    ...(input.metadata ? { metadata: input.metadata } : {}),
  };
}

export function buildTurnDeltaChain(
  bb: Partial<PipelineBlackboard>,
  terminalStatus: DeltaTerminalCommitStatus,
  options?: {
    error?: string;
  },
): TurnDelta[] {
  const turn = bb.turnNumber ?? 0;
  const baseTurn = resolveDeltaBaseTurn(turn);
  const envelopeVersion =
    bb.envelope?.envelopeVersion ?? DEFAULT_ENVELOPE_VERSION;
  const deltas: TurnDelta[] = [];
  const emittedSources = new Set<DeltaSource>();
  let sequence = 0;

  for (const traceEntry of bb._trace ?? []) {
    if (!traceEntry.success || traceEntry.skipped) {
      continue;
    }

    if (!isTraceDeltaAgentId(traceEntry.agentId)) {
      continue;
    }

    const source = TRACE_DELTA_SOURCE_MAP[traceEntry.agentId];
    if (emittedSources.has(source)) {
      continue;
    }

    const patches = buildSourcePatches(source, bb);
    if (patches.length === 0) {
      continue;
    }

    deltas.push(
      createTurnDelta({
        turn,
        baseTurn,
        sequence,
        envelopeVersion,
        source,
        commitStatus: "buffered",
        patches,
      }),
    );
    emittedSources.add(source);
    sequence += 1;
  }

  deltas.push(
    createTurnDelta({
      turn,
      baseTurn,
      sequence,
      envelopeVersion,
      source: "system",
      commitStatus: terminalStatus,
      patches: buildTerminalPatches(bb, terminalStatus),
      metadata: options?.error ? { error: options.error } : undefined,
    }),
  );

  return deltas;
}
