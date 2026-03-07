import * as Y from "yjs";

import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  currentSaveIdMock,
  dispatchMock,
  emitMock,
  getPresetForPurposeMock,
  getSaveSlotsMock,
  getStateMock,
  getTurnDocMock,
  historyDocRef,
  loadHistoryDocMock,
  mainDocRef,
  turnDocRef,
} = vi.hoisted(() => ({
  currentSaveIdMock: vi.fn(() => null),
  dispatchMock: vi.fn(),
  emitMock: vi.fn(),
  getPresetForPurposeMock: vi.fn(),
  getSaveSlotsMock: vi.fn(() => new Map()),
  getStateMock: vi.fn(),
  getTurnDocMock: vi.fn(),
  historyDocRef: { current: undefined as unknown },
  loadHistoryDocMock: vi.fn(),
  mainDocRef: { current: undefined as unknown },
  turnDocRef: { current: undefined as unknown },
}));

vi.mock("@/core", () => ({
  commandBus: {
    dispatch: dispatchMock,
  },
}));

vi.mock("@/core/event-bus", () => ({
  eventBus: {
    emit: emitMock,
    createEvent: vi.fn((type: string, payload: unknown) => ({ type, payload })),
  },
}));

vi.mock("@/core/yjs", () => ({
  apiClient: {},
  ApiError: class ApiError extends Error {},
  historyDocProvider: {},
  multiplayerProvider: {},
  subdocManager: {
    getMainDoc: vi.fn(() => mainDocRef.current),
    getTurnDoc: getTurnDocMock,
    loadHistoryDoc: loadHistoryDocMock,
  },
  turnDocProvider: {},
  yjsManager: {
    getCurrentSaveId: currentSaveIdMock,
    getSaveSlots: getSaveSlotsMock,
  },
}));

vi.mock("@/core/yjs/subdoc-manager", () => ({
  generateRoomCode: vi.fn(() => "ROOM01"),
}));

vi.mock("@/lib/prompt", () => ({
  usePresetStore: {
    getState: getStateMock,
  },
}));

import type { Member, PlayerAction } from "@/core/yjs/room/types";

import { completeTurnHandler } from "./handlers";

function seedMainDoc(): void {
  const mainDoc = mainDocRef.current as Y.Doc;
  const membersMap = mainDoc.getMap("members") as Y.Map<Member>;
  membersMap.clear();
  membersMap.set("host-user", {
    userId: "host-user",
    displayName: "主持人",
    role: "host",
    joinedAt: 1,
    lastActiveAt: 1,
    status: "online",
  });

  const charactersMap = mainDoc.getMap("characters") as Y.Map<Y.Map<unknown>>;
  charactersMap.clear();
}

function seedTurnDoc(aiResponse: string): void {
  const turnDoc = turnDocRef.current as Y.Doc;
  const actionsMap = turnDoc.getMap("actions") as Y.Map<PlayerAction>;
  actionsMap.clear();
  actionsMap.set("host-user", {
    userId: "host-user",
    content: "推门进入塔楼",
    submittedAt: 100,
  });

  const configMap = turnDoc.getMap("config");
  configMap.clear();

  const aiResponseText = turnDoc.getText("aiResponse");
  aiResponseText.delete(0, aiResponseText.length);
  aiResponseText.insert(0, aiResponse);

  const deltasArray = turnDoc.getArray("deltas");
  deltasArray.delete(0, deltasArray.length);
}

function createHistoryDoc(): Y.Doc {
  const historyDoc = new Y.Doc();
  historyDoc.getMap("messages");
  historyDoc.getArray("archivedTurns");
  return historyDoc;
}

describe("completeTurnHandler miniSummary persistence", () => {
  beforeEach(() => {
    dispatchMock.mockReset();
    emitMock.mockReset();
    mainDocRef.current = new Y.Doc();
    turnDocRef.current = new Y.Doc();
    historyDocRef.current = undefined;

    getPresetForPurposeMock.mockReset();
    getStateMock.mockReset();
    loadHistoryDocMock.mockReset();
    currentSaveIdMock.mockReset();
    currentSaveIdMock.mockReturnValue(null);
    getSaveSlotsMock.mockReset();
    getSaveSlotsMock.mockReturnValue(new Map());
    getTurnDocMock.mockReset();
    getTurnDocMock.mockImplementation(() => turnDocRef.current as Y.Doc);
    loadHistoryDocMock.mockImplementation(
      async () => historyDocRef.current as Y.Doc,
    );

    seedMainDoc();
    getStateMock.mockReturnValue({
      getPresetForPurpose: getPresetForPurposeMock,
    });
    getPresetForPurposeMock.mockResolvedValue(undefined);
  });

  it("多人 completeTurn 仅在权威落盘点写入一次 miniSummary，且消息正文已清洗", async () => {
    const historyDoc = createHistoryDoc();
    historyDocRef.current = historyDoc;
    dispatchMock.mockResolvedValue({
      success: true,
      data: { summaryId: "ms-1" },
    });
    seedTurnDoc("主叙事<memory_summary>会合后进入塔楼</memory_summary>");

    const result = await completeTurnHandler(
      {
        roomId: "room-1",
        turnNumber: 2,
      },
      { commandId: "cmd-1" },
    );

    expect(result).toEqual({ success: true });
    expect(dispatchMock).toHaveBeenCalledTimes(1);

    const dispatchedCommand = dispatchMock.mock.calls[0]?.[0] as {
      payload: {
        conversationId: string;
        roomId: string;
        content: string;
        messageId: string;
        messageIndex: number;
      };
    };
    expect(dispatchedCommand.payload.conversationId).toBe("room:room-1:main");
    expect(dispatchedCommand.payload.roomId).toBe("room-1");
    expect(dispatchedCommand.payload.content).toBe("会合后进入塔楼");
    expect(dispatchedCommand.payload.messageIndex).toBe(2);

    const messagesMap = historyDoc.getMap("messages") as Y.Map<
      Y.Array<unknown>
    >;
    const messagesArray = messagesMap.get(
      "room:room-1:main",
    ) as Y.Array<unknown>;
    const storedMessages = messagesArray.toArray() as Array<{
      id: string;
      role: string;
      content: string;
    }>;
    expect(storedMessages).toHaveLength(3);
    expect(storedMessages[2]?.role).toBe("assistant");
    expect(storedMessages[2]?.content).toBe("主叙事");
    expect(dispatchedCommand.payload.messageId).toBe(storedMessages[2]?.id);
  });

  it("多人 miniSummary 写入失败时保持回合完成与消息持久化成功，仅记录 warning", async () => {
    const historyDoc = createHistoryDoc();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    historyDocRef.current = historyDoc;
    dispatchMock.mockResolvedValue({
      success: false,
      error: "memory unavailable",
    });
    seedTurnDoc("战斗继续<memory_summary>击退守卫并占领门厅</memory_summary>");

    const result = await completeTurnHandler(
      {
        roomId: "room-soft-fail",
        turnNumber: 5,
      },
      { commandId: "cmd-soft-fail" },
    );

    expect(result).toEqual({ success: true });
    expect(dispatchMock).toHaveBeenCalledTimes(1);

    const messagesMap = historyDoc.getMap("messages") as Y.Map<
      Y.Array<unknown>
    >;
    const messagesArray = messagesMap.get("room:room-soft-fail:main") as
      | Y.Array<unknown>
      | undefined;
    expect(messagesArray?.length).toBe(3);
    expect((turnDocRef.current as Y.Doc).getMap("config").get("status")).toBe(
      "completed",
    );
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        "[Room:completeTurn] 写入小总结失败，但已保留消息与回合归档",
      ),
      expect.objectContaining({
        conversationId: "room:room-soft-fail:main",
        roomId: "room-soft-fail",
        turnNumber: 5,
        messageIndex: 2,
      }),
    );

    warnSpy.mockRestore();
  });

  it("无 parser 的多人直连分支仍在 completeTurn 写入一次 miniSummary", async () => {
    const historyDoc = createHistoryDoc();
    historyDocRef.current = historyDoc;
    dispatchMock.mockResolvedValue({
      success: true,
      data: { summaryId: "ms-direct" },
    });
    seedTurnDoc(
      "直连正文<memory_summary>未经过 parser 仍提取成功</memory_summary>",
    );

    const result = await completeTurnHandler(
      {
        roomId: "room-direct",
        turnNumber: 1,
      },
      { commandId: "cmd-direct" },
    );

    expect(result).toEqual({ success: true });
    expect(dispatchMock).toHaveBeenCalledTimes(1);
    expect(dispatchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          conversationId: "room:room-direct:main",
          roomId: "room-direct",
          content: "未经过 parser 仍提取成功",
          messageIndex: 2,
        }),
      }),
    );
  });
});
