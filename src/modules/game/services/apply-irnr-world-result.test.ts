import type {
  CreatedNpcData,
  EntityFinalState,
  StructuralChange,
} from "@/domain/types";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { applyStructuralChangesMock } = vi.hoisted(() => ({
  applyStructuralChangesMock: vi.fn(),
}));

vi.mock("./structural-change-consumer", () => ({
  applyStructuralChanges: applyStructuralChangesMock,
}));

import { WorldArchiveCommands } from "@/domain/commands/world-archive";

import { applyIrnrWorldResult } from "./apply-irnr-world-result";

type WorldResultCommandBus = Parameters<
  typeof applyIrnrWorldResult
>[0]["commandBus"];

function createCommandBus(dispatch = vi.fn(async () => ({ success: true }))): {
  commandBus: WorldResultCommandBus;
  dispatch: typeof dispatch;
} {
  const commandBus: WorldResultCommandBus = {
    dispatch,
    createCommand: <C>(type: string, payload: C) => ({ type, payload }),
  };

  return {
    commandBus,
    dispatch,
  };
}

function createFinalEntityState(id: string): EntityFinalState {
  return {
    id,
    fields: { hp: 10 },
    tags: new Map(),
  };
}

function createStructuralChange(): StructuralChange {
  return {
    type: "item_added",
    entityId: "item-1",
    targetId: "player-1",
    templateId: "template-1",
    details: { name: "Potion", quantity: 1 },
    reason: "loot",
  };
}

function createNpc(): CreatedNpcData {
  return {
    id: "npc-1",
    name: "测试 NPC",
    attributes: {},
  };
}

describe("applyIrnrWorldResult", () => {
  beforeEach(() => {
    applyStructuralChangesMock.mockReset();
    applyStructuralChangesMock.mockResolvedValue(undefined);
  });

  it("按 entity upsert → structural changes → world archive sync 顺序执行", async () => {
    const calls: string[] = [];
    const finalEntityStates = [createFinalEntityState("player-1")];
    const createdNpcs = [createNpc()];
    const archiveUpdates = [{ type: "update" }];
    const structuralChanges = [createStructuralChange()];

    const repository = {
      upsertFromEntityStates: vi.fn(() => {
        calls.push("upsert");
      }),
    };

    applyStructuralChangesMock.mockImplementationOnce(async () => {
      calls.push("structural");
    });

    const { commandBus, dispatch } = createCommandBus(
      vi.fn(async () => {
        calls.push("archive");
        return { success: true };
      }),
    );

    await applyIrnrWorldResult({
      currentTurn: 7,
      repository,
      result: {
        finalEntityStates,
        createdNpcs,
        archiveUpdates,
        structuralChanges,
      },
      commandBus,
      correlationId: "cmd-1",
    });

    expect(calls).toEqual(["upsert", "structural", "archive"]);
    expect(repository.upsertFromEntityStates).toHaveBeenCalledWith(
      finalEntityStates,
      createdNpcs,
    );
    expect(applyStructuralChangesMock).toHaveBeenCalledWith(
      structuralChanges,
      commandBus,
    );
    expect(dispatch).toHaveBeenCalledWith(
      {
        type: WorldArchiveCommands.SYNC_PIPELINE_CHANGES,
        payload: {
          currentTurn: 7,
          createdNpcs,
          archiveUpdates,
        },
      },
      { correlationId: "cmd-1" },
    );
  });

  it("没有 repository 时不回写实体，但仍保留后续公共段顺序", async () => {
    const calls: string[] = [];
    const structuralChanges = [createStructuralChange()];
    const archiveUpdates = [{ type: "update" }];

    applyStructuralChangesMock.mockImplementationOnce(async () => {
      calls.push("structural");
    });

    const { commandBus } = createCommandBus(
      vi.fn(async () => {
        calls.push("archive");
        return { success: true };
      }),
    );

    await applyIrnrWorldResult({
      currentTurn: 3,
      repository: null,
      result: {
        finalEntityStates: [createFinalEntityState("player-1")],
        structuralChanges,
        archiveUpdates,
      },
      commandBus,
    });

    expect(calls).toEqual(["structural", "archive"]);
  });

  it("没有档案变更时不分发 world archive 聚合命令", async () => {
    const repository = {
      upsertFromEntityStates: vi.fn(),
    };
    const { commandBus, dispatch } = createCommandBus();

    await applyIrnrWorldResult({
      currentTurn: 1,
      repository,
      result: {
        finalEntityStates: [createFinalEntityState("player-1")],
        structuralChanges: [],
      },
      commandBus,
      correlationId: "cmd-2",
    });

    expect(repository.upsertFromEntityStates).toHaveBeenCalledTimes(1);
    expect(applyStructuralChangesMock).toHaveBeenCalledWith([], commandBus);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("world archive 同步失败时仅记录 warning，不中断公共段", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const repository = {
      upsertFromEntityStates: vi.fn(),
    };
    const createdNpcs = [createNpc()];
    const { commandBus } = createCommandBus(
      vi.fn(async () => ({ success: false, error: "boom" })),
    );

    await expect(
      applyIrnrWorldResult({
        currentTurn: 9,
        repository,
        result: {
          finalEntityStates: [createFinalEntityState("player-1")],
          createdNpcs,
        },
        commandBus,
      }),
    ).resolves.toBeUndefined();

    expect(warnSpy).toHaveBeenCalledWith(
      "[WorldArchive] 命令链路同步失败：boom",
    );

    warnSpy.mockRestore();
  });
});
