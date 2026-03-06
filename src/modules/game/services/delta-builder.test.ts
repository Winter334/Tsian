import type { PipelineBlackboard } from "@/domain/types";
import { describe, expect, it } from "vitest";

import {
  buildTurnDeltaChain,
  compareTurnDeltaOrder,
  getTurnDeltaReplayKey,
  hasDeltaTerminalState,
  isDeltaTerminalStatus,
  resolveDeltaBaseTurn,
} from "./delta-builder";

function createBlackboardFixture(): Partial<PipelineBlackboard> {
  return {
    commandId: "room-1:3",
    turnNumber: 3,
    envelope: {
      envelopeVersion: "2.0.0",
      compatibility: {
        legacyTags: true,
        fallbackPolicy: "safe-minimal",
      },
      session: {
        sessionId: "room-1:3",
        mode: "solo",
      },
      turn: {
        number: 3,
        userInput: "行动",
        submittedAt: 123,
      },
      presets: {
        activeByPurpose: {
          narrative: "narrative-preset",
          parser: "parser-preset",
          summarizer: "summarizer-preset",
          director: "director-preset",
        },
      },
      history: {
        messages: [],
      },
    },
    _trace: [
      {
        agentId: "director",
        agentName: "导演AI",
        startedAt: 1,
        completedAt: 2,
        success: true,
        skipped: false,
        producedFields: ["plotDirectives", "narrativeHints"],
      },
      {
        agentId: "parser",
        agentName: "解析AI",
        startedAt: 2,
        completedAt: 3,
        success: true,
        skipped: false,
        producedFields: ["ruleScript"],
      },
      {
        agentId: "engine",
        agentName: "规则引擎",
        startedAt: 3,
        completedAt: 4,
        success: true,
        skipped: false,
        producedFields: ["resultFrame"],
      },
      {
        agentId: "narrator",
        agentName: "叙事AI",
        startedAt: 4,
        completedAt: 5,
        success: true,
        skipped: false,
        producedFields: ["narrativeText"],
      },
      {
        agentId: "post-processor",
        agentName: "后处理器",
        startedAt: 5,
        completedAt: 6,
        success: true,
        skipped: false,
        producedFields: ["cleanNarrative", "miniSummary"],
      },
    ],
    plotDirectives: "directive",
    narrativeHints: "hint",
    archiveUpdates: [{ kind: "archive" }],
    ruleScript: {
      version: 2,
      actions: [],
    },
    resultFrame: {
      version: 1,
      frameId: "frame-1",
      commandId: "room-1:3",
      seed: 1,
      timestamp: 999,
      success: true,
      valueChanges: [],
      diceRolls: [],
      checks: [],
      mechanicSummary: "ok",
    },
    narrativeText: "raw narrative",
    cleanNarrative: "clean narrative",
    miniSummary: "mini summary",
    finalEntityStates: [
      {
        id: "player-1",
        fields: { hp: 10 },
        tags: new Map(),
      },
    ],
  };
}

describe("delta-builder", () => {
  it("sequence 单调递增并以终态结束", () => {
    const deltas = buildTurnDeltaChain(createBlackboardFixture(), "committed");

    expect(deltas.length).toBeGreaterThan(1);
    expect(deltas.every((delta, index) => delta.sequence === index)).toBe(true);
    expect(deltas[deltas.length - 1].commitStatus).toBe("committed");
    expect(hasDeltaTerminalState(deltas)).toBe(true);
  });

  it("baseTurn + sequence 可生成确定性遍历键", () => {
    const deltas = buildTurnDeltaChain(createBlackboardFixture(), "committed");
    const replayKeys = deltas.map((delta) => getTurnDeltaReplayKey(delta));
    const sorted = [...deltas].sort(compareTurnDeltaOrder);

    expect(resolveDeltaBaseTurn(3)).toBe(2);
    expect(new Set(replayKeys).size).toBe(deltas.length);
    expect(sorted.map((delta) => delta.sequence)).toEqual(
      deltas.map((delta) => delta.sequence),
    );
  });

  it("commitStatus 终态判定正确", () => {
    const committed = buildTurnDeltaChain(
      createBlackboardFixture(),
      "committed",
    );
    const discarded = buildTurnDeltaChain(
      createBlackboardFixture(),
      "discarded",
      {
        error: "failed",
      },
    );

    expect(
      isDeltaTerminalStatus(committed[committed.length - 1].commitStatus),
    ).toBe(true);
    expect(
      isDeltaTerminalStatus(discarded[discarded.length - 1].commitStatus),
    ).toBe(true);
    expect(discarded[discarded.length - 1].metadata).toEqual({
      error: "failed",
    });
  });

  it("单机/联机共享同一 Delta 结构约束", () => {
    const solo = buildTurnDeltaChain(createBlackboardFixture(), "committed");
    const multiplayer = buildTurnDeltaChain(
      {
        ...createBlackboardFixture(),
        roomId: "room-1",
      },
      "committed",
    );

    expect(multiplayer.map((delta) => delta.source)).toEqual(
      solo.map((delta) => delta.source),
    );
    expect(multiplayer.map((delta) => delta.commitStatus)).toEqual(
      solo.map((delta) => delta.commitStatus),
    );
  });
});
