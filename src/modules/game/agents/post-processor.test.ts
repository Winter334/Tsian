import type { PipelineBlackboard } from "@/domain/types";
import type { Preset } from "@/lib/prompt/types";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { dispatchMock } = vi.hoisted(() => ({
  dispatchMock: vi.fn(),
}));

vi.mock("@/core", () => ({
  commandBus: {
    dispatch: dispatchMock,
  },
}));

import { WARNING_CODES } from "@/domain/constants/warning-codes";
import { postProcessorAgent } from "./post-processor";

function createPreset(): Preset {
  return {
    id: "narrative-test-preset",
    name: "Narrative Test Preset",
    description: "",
    blocks: [],
    blockOrder: [],
    metadata: {
      version: "1.0.0",
      createdAt: 1,
      updatedAt: 1,
      source: "lyra",
    },
    purpose: "narrative",
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
    },
    callbacks: {},
    ...overrides,
  } as PipelineBlackboard;
}

describe("postProcessorAgent miniSummary persistence", () => {
  beforeEach(() => {
    dispatchMock.mockReset();
  });

  it("单机路径仅写入一次 miniSummary，写入失败为软失败", async () => {
    dispatchMock.mockResolvedValue({
      success: false,
      error: "memory repo unavailable",
    });

    const bb = createBlackboardFixture({
      narrativeText:
        "保留正文<memory_summary>本轮抵达钟塔并发现暗门</memory_summary>",
      messageLocation: {
        conversationId: "solo-conv",
        messageId: "assistant-1",
        messageIndex: 3,
      },
    });

    await expect(postProcessorAgent.execute(bb)).resolves.toBeUndefined();

    expect(bb.cleanNarrative).toBe("保留正文");
    expect(bb.miniSummary).toBe("本轮抵达钟塔并发现暗门");
    expect(dispatchMock).toHaveBeenCalledTimes(1);
    expect(dispatchMock).toHaveBeenCalledWith({
      type: expect.any(String),
      payload: {
        conversationId: "solo-conv",
        messageId: "assistant-1",
        messageIndex: 3,
        content: "本轮抵达钟塔并发现暗门",
      },
    });
    expect(bb.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: WARNING_CODES.POSTPROCESS_MINI_SUMMARY_WRITE_FAILED,
          stage: "postprocess",
          message: expect.stringContaining("写入小总结失败"),
          details: expect.objectContaining({
            conversationId: "solo-conv",
            messageId: "assistant-1",
            messageIndex: 3,
            error: "memory repo unavailable",
          }),
        }),
      ]),
    );
  });

  it("多人 IRNR 缺少消息定位上下文时使用 deferred 语义，不报 skipped warning 且不写入", async () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const bb = createBlackboardFixture({
      roomId: "room-1",
      narrativeText:
        "联机正文<memory_summary>玩家会合后前往塔楼</memory_summary>",
    });

    await expect(postProcessorAgent.execute(bb)).resolves.toBeUndefined();

    expect(bb.cleanNarrative).toBe("联机正文");
    expect(bb.miniSummary).toBe("玩家会合后前往塔楼");
    expect(dispatchMock).not.toHaveBeenCalled();
    expect(bb.warnings ?? []).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: WARNING_CODES.POSTPROCESS_MINI_SUMMARY_SKIPPED,
        }),
      ]),
    );
    expect(infoSpy).toHaveBeenCalledWith(
      "[IRNR Pipeline] 检测到 memory_summary，当前联机流程缺少消息定位上下文，已延后到 completeTurn 阶段写入。",
    );
    expect(warnSpy).not.toHaveBeenCalledWith(
      "[IRNR Pipeline] 检测到 memory_summary，但缺少会话上下文，跳过写入。",
    );

    infoSpy.mockRestore();
    warnSpy.mockRestore();
  });
});
