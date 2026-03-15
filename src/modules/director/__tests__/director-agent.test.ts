import type { PipelineBlackboard } from "@/domain/types";
import type { AiExecutionResult, AiExecutor } from "@/lib/ai/executor";
import type { AIConfig } from "@/lib/ai/types";
import type { Preset, VariableContext } from "@/lib/prompt/types";
import type { EntityAliasMap } from "@/lib/rules/schema";
import { useWorldArchiveStore } from "@/modules/world-archive/store";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { WARNING_CODES } from "@/domain/constants/warning-codes";
import { directorAgent } from "../director-agent";
import { resetDirectorRepository } from "../repository";
import { useDirectorStore } from "../store";
import type { PlotOutline } from "../types";

const mockExecute =
  vi.fn<
    (context: {
      preset: Preset;
      variableContext: VariableContext;
      onChunk?: (text: string) => void;
      onComplete?: (text: string) => void;
    }) => Promise<AiExecutionResult>
  >();

vi.mock("@/lib/ai/executor", () => ({
  createAiExecutor: vi.fn(
    (_config: AIConfig): AiExecutor => ({
      execute: mockExecute,
      abort: vi.fn(),
    }),
  ),
}));

const saveOutlineMock = vi.fn();
const saveDirectorLogMock = vi.fn();
const saveForeshadowMock = vi.fn();
const deleteForeshadowMock = vi.fn();
const getAllForeshadowsMock = vi.fn(() => ({}));

vi.mock("../repository", async () => {
  const actual =
    await vi.importActual<typeof import("../repository")>("../repository");

  return {
    ...actual,
    getDirectorRepository: vi.fn(() => ({
      saveOutline: saveOutlineMock,
      saveDirectorLog: saveDirectorLogMock,
      saveForeshadow: saveForeshadowMock,
      deleteForeshadow: deleteForeshadowMock,
      getAllForeshadows: getAllForeshadowsMock,
    })),
  };
});

function createPreset(): Preset {
  return {
    id: "director-test-preset",
    name: "Director Test Preset",
    description: "",
    blocks: [],
    blockOrder: [],
    metadata: {
      version: "1.0.0",
      createdAt: 1,
      updatedAt: 1,
      source: "lyra",
    },
    purpose: "director",
    ioContract: {
      requiredTags: [
        "plot_directives",
        "turn_narrative_intent",
        "narrative_hints",
        "archive_updates",
      ],
      optionalTags: ["outline_updates"],
    },
  };
}

function createAliasMap(): EntityAliasMap {
  return {
    aliases: new Map([
      ["player", "entity-player"],
      ["pc", "entity-player"],
    ]),
    displayNames: new Map([["entity-player", "Player"]]),
  };
}

function createBlackboardFixture(
  overrides: Partial<PipelineBlackboard> = {},
): PipelineBlackboard {
  const preset = createPreset();

  return {
    _trace: [],
    commandId: "cmd-1",
    playerInput: "测试行动",
    aiConfig: {
      provider: "openai",
      apiKey: "test-key",
      model: "test-model",
      temperature: 0.7,
      maxTokens: 1024,
    },
    baseVariableContext: {
      mode: "solo",
      user: { name: "Tester" },
      chatHistory: [],
    },
    worldConfig: {
      title: "Test World",
      dimensions: [],
      attributeSettings: [],
      talentSettings: [],
      inventorySettings: {
        enabled: false,
        currencyName: "金币",
        weightEnabled: false,
        maxWeight: 0,
        categories: [],
      },
      equipmentSettings: {
        enabled: false,
        slots: [],
        slotRules: {
          allowMultipleAccessories: false,
          accessorySlots: 0,
        },
      },
      statusSettings: {
        enabled: false,
        statuses: [],
      },
      relationships: [],
    },
    actorId: "actor-1",
    turnNumber: 7,
    presets: {
      narrative: preset,
      director: preset,
    },
    callbacks: {},
    entityAccessor: {} as PipelineBlackboard["entityAccessor"],
    aliasMap: createAliasMap(),
    archiveSnapshot: {
      active: [],
      nearby: [],
      dormant: [],
    },
    envelope: {
      envelopeVersion: "2.0.0",
      session: {
        mode: "solo",
      },
      turn: {
        number: 7,
        userInput: "测试行动",
      },
      presets: {
        activeByPurpose: {
          narrative: preset.id,
          parser: null,
          summarizer: null,
          director: preset.id,
        },
      },
      history: {
        messages: [],
      },
      directives: {},
    },
    ...overrides,
  } as PipelineBlackboard;
}

function seedArchiveEntities(): void {
  const store = useWorldArchiveStore.getState();
  store.createEntity({
    archetype: "character",
    name: "Player",
    essence: "玩家角色",
    currentState: "站在原地",
    presence: "active",
    introducedAtTurn: 1,
    lastActiveTurn: 1,
    gameEntityId: "entity-player",
    relationships: [],
    tags: [],
  });
}

function createOutline(): PlotOutline {
  return {
    currentArc: {
      id: "arc-1",
      title: "测试主线",
      premise: "测试前提",
      milestones: [
        {
          id: "milestone-1",
          description: "到达北方城镇",
          triggerConditions: "抵达",
          effects: "推进剧情",
          status: "pending",
        },
      ],
      involvedEntityIds: ["entity-player"],
      status: "active",
      deviations: [],
    },
    completedArcs: [],
    plannedArcs: [],
  };
}

describe("directorAgent soft-fail boundaries", () => {
  beforeEach(() => {
    mockExecute.mockReset();
    saveOutlineMock.mockReset();
    saveDirectorLogMock.mockReset();
    saveForeshadowMock.mockReset();
    deleteForeshadowMock.mockReset();
    getAllForeshadowsMock.mockReset();
    getAllForeshadowsMock.mockReturnValue({});
    resetDirectorRepository();
    useWorldArchiveStore.getState()._clear();
    useDirectorStore.getState()._clear();
    seedArchiveEntities();
    useDirectorStore.getState().setOutline(createOutline());
  });

  it("非法 archive_updates 时保留主文本并记录 warning", async () => {
    mockExecute.mockResolvedValue({
      success: true,
      content: `
<plot_directives>
1. 继续推进剧情
</plot_directives>
<turn_narrative_intent>
- 本回合正文必须先让玩家感受到局势继续收紧
- 让场景中出现一个明确但未结算的危险征兆
</turn_narrative_intent>
<narrative_hints>
- 保持紧张氛围
</narrative_hints>
<archive_updates>
[{"op":"update","ref":"未知实体","state":"发生变化"}]
</archive_updates>
<outline_updates>
[]
</outline_updates>`,
    });

    const bb = createBlackboardFixture();

    await expect(directorAgent.execute(bb)).resolves.toBeUndefined();

    expect(bb.plotDirectives).toBe("1. 继续推进剧情");
    expect(bb.turnNarrativeIntent).toBe(
      [
        "- 本回合正文必须先让玩家感受到局势继续收紧",
        "- 让场景中出现一个明确但未结算的危险征兆",
      ].join("\n"),
    );
    expect(bb.narrativeHints).toBe("- 保持紧张氛围");
    expect(bb.archiveUpdates).toEqual([]);
    expect(bb.envelope?.directives?.plotDirectives).toBe("1. 继续推进剧情");
    expect(bb.envelope?.directives?.turnNarrativeIntent).toBe(
      [
        "- 本回合正文必须先让玩家感受到局势继续收紧",
        "- 让场景中出现一个明确但未结算的危险征兆",
      ].join("\n"),
    );
    expect(bb.envelope?.directives?.narrativeHints).toBe("- 保持紧张氛围");
    expect(bb.envelope?.directives?.archiveUpdates).toEqual([]);
    expect(bb.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: WARNING_CODES.DIRECTOR_PARSE_DEGRADED,
          stage: "director",
          message: expect.stringContaining(
            "archive_updates 解析失败，已跳过该段",
          ),
          details: expect.objectContaining({
            section: "archive_updates",
          }),
        }),
      ]),
    );
    expect(useDirectorStore.getState().directorLog).toHaveLength(1);
    expect(saveDirectorLogMock).toHaveBeenCalledTimes(1);
  });

  it("非法 outline_updates 时不中断 director log 且保留主文本", async () => {
    mockExecute.mockResolvedValue({
      success: true,
      content: `
<plot_directives>
1. 让角色观察四周
</plot_directives>
<turn_narrative_intent>
- 正文要明确落笔于角色察觉到周围异样
</turn_narrative_intent>
<narrative_hints>
- 描写压迫感
</narrative_hints>
<archive_updates>
[]
</archive_updates>
<outline_updates>
[{"op":"arc_status","status":"done"}]
</outline_updates>`,
    });

    const bb = createBlackboardFixture();

    await expect(directorAgent.execute(bb)).resolves.toBeUndefined();

    expect(bb.plotDirectives).toBe("1. 让角色观察四周");
    expect(bb.narrativeHints).toBe("- 描写压迫感");
    expect(bb.archiveUpdates).toEqual([]);
    expect(bb.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: WARNING_CODES.DIRECTOR_PARSE_DEGRADED,
          stage: "director",
          message: expect.stringContaining(
            "outline_updates 处理失败，已跳过该段",
          ),
          details: expect.objectContaining({
            section: "outline_updates",
          }),
        }),
      ]),
    );

    const directorLog = useDirectorStore.getState().directorLog;
    expect(directorLog).toHaveLength(1);
    expect(directorLog[0]).toEqual(
      expect.objectContaining({
        plotDirectives: "1. 让角色观察四周",
        turnNarrativeIntent: "- 正文要明确落笔于角色察觉到周围异样",
        narrativeHints: "- 描写压迫感",
        outlineUpdatesSummary: '[{"op":"arc_status","status":"done"}]',
      }),
    );
    expect(saveDirectorLogMock).toHaveBeenCalledTimes(1);
    expect(saveOutlineMock).not.toHaveBeenCalled();
  });
});
