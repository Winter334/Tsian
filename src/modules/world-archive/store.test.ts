import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./presence-sync", () => ({
  syncCharacterStatus: vi.fn(() => true),
}));

import { useWorldArchiveStore } from "./store";
import type { ArchiveUpdate } from "./types";

describe("useWorldArchiveStore.applyArchiveUpdates", () => {
  beforeEach(() => {
    useWorldArchiveStore.getState()._clear();
  });

  it("支持同批次 create_entity 后通过 gameEntityId 建立关系", () => {
    const updates: ArchiveUpdate[] = [
      {
        type: "create_entity",
        archetype: "character",
        name: "PC",
        essence: "玩家角色",
        initialState: "在灰马酒馆醒神",
        gameEntityId: "PC",
      },
      {
        type: "create_entity",
        archetype: "character",
        name: "老汉斯",
        essence: "旅店老板",
        initialState: "在柜台后擦拭酒杯",
        gameEntityId: "NPC_Hans",
      },
      {
        type: "add_relationship",
        entityId: "NPC_Hans",
        relationship: {
          targetEntityId: "PC",
          type: "observer",
          description: "观察这个陌生的面孔",
        },
      },
    ];

    useWorldArchiveStore.getState().applyArchiveUpdates(updates, 1);

    const createdHans = useWorldArchiveStore
      .getState()
      .getEntityByGameId("NPC_Hans");
    expect(createdHans).toBeDefined();
    expect(createdHans?.relationships).toHaveLength(1);
    expect(createdHans?.relationships[0].type).toBe("observer");

    const player = useWorldArchiveStore.getState().getEntityByGameId("PC");
    expect(player).toBeDefined();
    expect(createdHans?.relationships[0].targetEntityId).toBe(player?.id);
  });

  it("支持同批次 create_entity 后通过 gameEntityId 更新 presence", () => {
    const updates: ArchiveUpdate[] = [
      {
        type: "create_entity",
        archetype: "character",
        name: "疤面巴克",
        essence: "收债人",
        initialState: "正闯入酒馆",
        gameEntityId: "NPC_Buck",
      },
      {
        type: "update_presence",
        entityId: "NPC_Buck",
        newPresence: "dormant",
      },
    ];

    useWorldArchiveStore.getState().applyArchiveUpdates(updates, 2);

    const createdBuck = useWorldArchiveStore
      .getState()
      .getEntityByGameId("NPC_Buck");
    expect(createdBuck).toBeDefined();
    expect(createdBuck?.presence).toBe("dormant");
  });
});
