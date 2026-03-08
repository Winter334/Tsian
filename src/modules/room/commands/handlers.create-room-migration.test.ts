import * as Y from "yjs";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_WORLD_CONFIG } from "@/lib/world";
import { worldConfigToYMap } from "@/lib/world/world-config-codec";
import { worldNarrativeToYMap } from "@/lib/world/world-narrative-codec";

const {
  connectMock,
  createMainDocMock,
  emitMock,
  getBaseUrlMock,
  getMainDocMock,
  getSaveSlotsMock,
  getTokenMock,
  getUniqueTagMock,
  getDocMock,
  historyConnectMock,
  historyDocRef,
  loadHistoryDocMock,
  mainDocRef,
  providerConfigRef,
  registerRoomMock,
  rootDocRef,
  saveSlotsRef,
  setBaseUrlMock,
  setConfigMock,
  setLocalUserMock,
  updateSaveRoomConfigMock,
  waitForSyncMock,
} = vi.hoisted(() => ({
  connectMock: vi.fn(),
  createMainDocMock: vi.fn(),
  emitMock: vi.fn(),
  getBaseUrlMock: vi.fn(() => undefined),
  getMainDocMock: vi.fn(),
  getSaveSlotsMock: vi.fn(),
  getTokenMock: vi.fn(),
  getUniqueTagMock: vi.fn(() => "unique-tag"),
  getDocMock: vi.fn(),
  historyConnectMock: vi.fn(),
  historyDocRef: { current: null as Y.Doc | null },
  loadHistoryDocMock: vi.fn(),
  mainDocRef: { current: null as Y.Doc | null },
  providerConfigRef: {
    current: null as {
      roomId: string;
      token: string;
      wsUrl: string;
    } | null,
  },
  registerRoomMock: vi.fn(),
  rootDocRef: { current: null as Y.Doc | null },
  saveSlotsRef: { current: null as Y.Map<Y.Map<unknown>> | null },
  setBaseUrlMock: vi.fn(),
  setConfigMock: vi.fn(),
  setLocalUserMock: vi.fn(),
  updateSaveRoomConfigMock: vi.fn(),
  waitForSyncMock: vi.fn(),
}));

vi.mock("@/config/multiplayer", () => ({
  getMultiplayerConfig: vi.fn(() => ({
    apiUrl: "http://api.test",
    wsUrl: "ws://ws.test",
  })),
}));

vi.mock("@/core", () => ({
  commandBus: {
    dispatch: vi.fn(),
  },
}));

vi.mock("@/core/event-bus", () => ({
  eventBus: {
    emit: emitMock,
    createEvent: vi.fn((type: string, payload: unknown) => ({ type, payload })),
  },
}));

vi.mock("@/core/yjs/subdoc-manager", () => ({
  generateRoomCode: vi.fn(() => "ROOM01"),
}));

vi.mock("@/core/yjs", () => ({
  apiClient: {
    getBaseUrl: getBaseUrlMock,
    setBaseUrl: setBaseUrlMock,
    registerRoom: registerRoomMock,
    getToken: getTokenMock,
  },
  ApiError: class ApiError extends Error {
    status?: number;
  },
  historyDocProvider: {
    setConfig: setConfigMock,
    connect: historyConnectMock,
    waitForSync: waitForSyncMock,
  },
  multiplayerProvider: {
    connect: connectMock,
    disconnect: vi.fn(),
    getConfig: vi.fn(() => providerConfigRef.current),
    getStatus: vi.fn(() => "connected"),
  },
  subdocManager: {
    createMainDoc: createMainDocMock,
    getMainDoc: getMainDocMock,
    leaveRoom: vi.fn(),
    loadHistoryDoc: loadHistoryDocMock,
  },
  turnDocProvider: {},
  yjsManager: {
    getCurrentSaveId: vi.fn(() => null),
    getDoc: getDocMock,
    getSaveSlots: getSaveSlotsMock,
    updateSaveRoomConfig: updateSaveRoomConfigMock,
  },
}));

vi.mock("@/lib/prompt", () => ({
  usePresetStore: {
    getState: vi.fn(() => ({
      getPresetForPurpose: vi.fn(),
    })),
  },
}));

vi.mock("@/lib/user-identity", async () => {
  const actual = await vi.importActual<typeof import("@/lib/user-identity")>(
    "@/lib/user-identity",
  );

  return {
    ...actual,
    getUniqueTag: getUniqueTagMock,
  };
});

vi.mock("../store", () => ({
  useRoomStore: {
    getState: vi.fn(() => ({
      setLocalUser: setLocalUserMock,
    })),
  },
}));

import { createRoomHandler } from "./handlers";

function createHistoryDoc(): Y.Doc {
  const historyDoc = new Y.Doc();
  historyDoc.getMap("conversations");
  historyDoc.getMap("messages");
  historyDoc.getArray("archivedTurns");
  return historyDoc;
}

function createImportedMultiplayerSave(): {
  saveId: string;
  saveSlot: Y.Map<unknown>;
  importedConversationId: string;
} {
  const saveId = "imported-save-1";
  const saveSlot = new Y.Map<unknown>();
  const importedConversationId = "imported-conv-1";
  const now = 1700000000000;

  saveSlot.set("id", saveId);
  saveSlot.set("name", "导入联机存档");
  saveSlot.set("createdAt", now);
  saveSlot.set("updatedAt", now);
  saveSlot.set("type", "multiplayer");
  saveSlot.set("lastRoomId", "old-room");
  saveSlot.set("worldConfig", worldConfigToYMap(DEFAULT_WORLD_CONFIG));
  saveSlot.set("worldNarrative", worldNarrativeToYMap({ version: 1 }));

  const conversationsMap = new Y.Map<unknown>();
  conversationsMap.set(importedConversationId, {
    id: importedConversationId,
    title: "联机房间记录",
    characterIds: [],
    createdAt: now,
    updatedAt: now,
    metadata: {
      type: "multiplayer-room-main",
      roomId: "old-room",
    },
  });
  saveSlot.set("conversations", conversationsMap);

  const messagesMap = new Y.Map<Y.Array<unknown>>();
  const messagesArray = new Y.Array<unknown>();
  messagesArray.push([
    {
      id: "msg-1",
      role: "assistant",
      content: "导入的联机历史",
      conversationId: importedConversationId,
      createdAt: now,
      updatedAt: now,
    },
  ]);
  messagesMap.set(importedConversationId, messagesArray);
  saveSlot.set("messages", messagesMap);

  return { saveId, saveSlot, importedConversationId };
}

describe("createRoomHandler imported multiplayer save migration", () => {
  beforeEach(() => {
    emitMock.mockReset();
    registerRoomMock.mockReset();
    getTokenMock.mockReset();
    connectMock.mockReset();
    setConfigMock.mockReset();
    historyConnectMock.mockReset();
    waitForSyncMock.mockReset();
    setLocalUserMock.mockReset();
    setBaseUrlMock.mockReset();
    getBaseUrlMock.mockReset();
    getBaseUrlMock.mockReturnValue(undefined);
    updateSaveRoomConfigMock.mockReset();

    mainDocRef.current = new Y.Doc();
    historyDocRef.current = createHistoryDoc();
    providerConfigRef.current = null;
    rootDocRef.current = new Y.Doc();
    const rootMap = rootDocRef.current.getMap("root");
    const savesMap = new Y.Map<Y.Map<unknown>>();
    rootMap.set("saves", savesMap);
    saveSlotsRef.current = savesMap;

    createMainDocMock.mockImplementation(
      (
        roomId: string,
        options: { name?: string; hostUserId: string; maxPlayers?: number },
      ) => {
        const mainDoc = mainDocRef.current ?? new Y.Doc();
        mainDocRef.current = mainDoc;
        mainDoc.getMap("metadata").set("name", options.name ?? "房间");
        mainDoc.getMap("metadata").set("hostUserId", options.hostUserId);
        mainDoc.getMap("config");
        mainDoc.getMap("members");
        mainDoc.getMap("characters");
        return { mainDoc, roomId };
      },
    );
    getMainDocMock.mockImplementation(() => mainDocRef.current);
    loadHistoryDocMock.mockImplementation(async () => historyDocRef.current);
    getSaveSlotsMock.mockImplementation(() => saveSlotsRef.current);
    getDocMock.mockImplementation(() => rootDocRef.current);
    registerRoomMock.mockResolvedValue(undefined);
    getTokenMock.mockResolvedValue({
      token: "token-1",
      expiresAt: Date.now() + 60_000,
    });
    connectMock.mockImplementation(
      async (config: { roomId: string; token: string; wsUrl: string }) => {
        providerConfigRef.current = {
          roomId: config.roomId,
          token: config.token,
          wsUrl: config.wsUrl,
        };
      },
    );
    historyConnectMock.mockResolvedValue(undefined);
    waitForSyncMock.mockResolvedValue(undefined);
    updateSaveRoomConfigMock.mockImplementation(
      (
        saveId: string,
        config: {
          lastRoomId?: string;
          roomCode?: string;
          maxPlayers?: number;
          turnDuration?: number;
        },
      ) => {
        const saveSlot = saveSlotsRef.current?.get(saveId);
        if (!saveSlot) {
          return;
        }

        if (config.lastRoomId !== undefined) {
          saveSlot.set("lastRoomId", config.lastRoomId);
        }
        if (config.roomCode !== undefined) {
          saveSlot.set("lastRoomCode", config.roomCode);
        }
        if (config.maxPlayers !== undefined) {
          saveSlot.set("maxPlayers", config.maxPlayers);
        }
        if (config.turnDuration !== undefined) {
          saveSlot.set("turnDuration", config.turnDuration);
        }
      },
    );
  });

  it("续玩导入的联机存档时，按会话 metadata 定位旧主会话并迁移到新房间 key", async () => {
    const { saveId, saveSlot, importedConversationId } =
      createImportedMultiplayerSave();
    saveSlotsRef.current?.set(saveId, saveSlot);

    const result = await createRoomHandler(
      {
        fromSaveId: saveId,
        hostUserId: "host-user",
        hostDisplayName: "房主",
        maxPlayers: 4,
        name: "导入房间",
        turnDuration: 5 * 60 * 1000,
      },
      { commandId: "cmd-import-room" },
    );

    expect(result.success).toBe(true);
    if (!result.success || !result.data) {
      throw new Error("createRoomHandler should succeed");
    }

    const newConversationId = `room:${result.data.roomId}:main`;
    const messagesMap = saveSlot.get("messages") as Y.Map<Y.Array<unknown>>;
    const migratedMessages = messagesMap.get(newConversationId) as
      | Y.Array<unknown>
      | undefined;

    expect(messagesMap.has(importedConversationId)).toBe(false);
    expect(migratedMessages).toBeDefined();

    const storedMessages = (migratedMessages?.toArray() ?? []) as Array<{
      conversationId?: string;
      content?: string;
      id?: string;
    }>;
    expect(storedMessages).toHaveLength(1);
    expect(storedMessages[0]?.id).toBe("msg-1");
    expect(storedMessages[0]?.content).toBe("导入的联机历史");
    expect(storedMessages[0]?.conversationId).toBe(newConversationId);
    expect(saveSlot.get("lastRoomId")).toBe(result.data.roomId);
  });
});
