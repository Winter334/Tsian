import { describe, expect, it } from "vitest";

import {
  DirectorOutputParseError,
  parseArchiveUpdates,
  parseDirectorOutput,
  parseOutlineUpdates,
  repairJson,
} from "../output-parser";

describe("parseDirectorOutput", () => {
  it("可提取 XML 标签内容", () => {
    const raw = `
<plot_directives>
1. 测试剧情指导
</plot_directives>
<narrative_hints>
- 测试叙事提示
</narrative_hints>
<archive_updates>
[]
</archive_updates>
<outline_updates>
[]
</outline_updates>`;

    const result = parseDirectorOutput(raw);

    expect(result.plotDirectives).toBe("1. 测试剧情指导");
    expect(result.narrativeHints).toBe("- 测试叙事提示");
    expect(result.archiveUpdatesRaw).toBe("[]");
    expect(result.outlineUpdatesRaw).toBe("[]");
    expect(result.degraded).toBeUndefined();
  });
});

describe("parseArchiveUpdates", () => {
  const entityMap = new Map<string, string>([
    ["pc", "entity-player"],
    ["player", "entity-player"],
    ["老班恩", "entity-bane"],
    ["npc_bane", "entity-bane"],
    ["npc_guard_01", "entity-guard-01"],
  ]);

  const entityLookup = (nameOrId: string): string | undefined => {
    return (
      entityMap.get(nameOrId.trim().toLowerCase()) ?? entityMap.get(nameOrId)
    );
  };

  it("可解析标准 JSON 数组为 ArchiveUpdate[]", () => {
    const raw = JSON.stringify([
      {
        op: "create",
        type: "character",
        name: "老班恩",
        id: "NPC_Bane",
        essence: "旅店老板",
        state: "初次登场",
        tags: ["inn", "npc"],
      },
      { op: "update", ref: "PC", state: "身份待定" },
      { op: "essence", ref: "老班恩", essence: "表面胆小，实为情报贩子" },
      { op: "presence", ref: "npc_guard_01", presence: "dormant" },
      {
        op: "relate",
        ref: "PC",
        target: "老班恩",
        relType: "acquaintance",
        relDesc: "旅店偶遇",
      },
    ]);

    const result = parseArchiveUpdates(raw, entityLookup, 3);

    expect(result).toEqual([
      {
        type: "create_entity",
        archetype: "character",
        name: "老班恩",
        essence: "旅店老板",
        initialState: "初次登场",
        gameEntityId: "NPC_Bane",
        tags: ["inn", "npc"],
      },
      {
        type: "update_state",
        entityId: "entity-player",
        newState: "身份待定",
      },
      {
        type: "update_essence",
        entityId: "entity-bane",
        newEssence: "表面胆小，实为情报贩子",
      },
      {
        type: "update_presence",
        entityId: "entity-guard-01",
        newPresence: "dormant",
      },
      {
        type: "add_relationship",
        entityId: "entity-player",
        relationship: {
          targetEntityId: "entity-bane",
          type: "acquaintance",
          description: "旅店偶遇",
        },
      },
    ]);
  });

  it("可自动修复单引号与尾逗号后完成解析", () => {
    const raw = `
[
  {'op':'update','ref':'PC','state':'身份待定'},
  {'op':'presence','ref':'npc_guard_01','presence':'nearby'},
]
`;

    const result = parseArchiveUpdates(raw, entityLookup, 5);

    expect(result).toEqual([
      {
        type: "update_state",
        entityId: "entity-player",
        newState: "身份待定",
      },
      {
        type: "update_presence",
        entityId: "entity-guard-01",
        newPresence: "nearby",
      },
    ]);
  });

  it("create 操作未提供 essence 时回退到 state", () => {
    const raw = JSON.stringify([
      {
        op: "create",
        type: "character",
        name: "新角色",
        state: "初次登场",
      },
    ]);

    const result = parseArchiveUpdates(raw, entityLookup, 1);

    expect(result).toEqual([
      {
        type: "create_entity",
        archetype: "character",
        name: "新角色",
        essence: "初次登场",
        initialState: "初次登场",
        gameEntityId: undefined,
        tags: undefined,
      },
    ]);
  });

  it("支持同批次 create 后通过 gameEntityId 建立关系", () => {
    const raw = JSON.stringify([
      {
        op: "create",
        type: "character",
        name: "老汉斯",
        id: "NPC_Hans",
        essence: "旅店老板",
        state: "在柜台后擦拭酒杯",
      },
      {
        op: "relate",
        ref: "NPC_Hans",
        target: "PC",
        relType: "observer",
        relDesc: "观察这个陌生的面孔",
      },
    ]);

    const result = parseArchiveUpdates(raw, entityLookup, 1);

    expect(result).toEqual([
      {
        type: "create_entity",
        archetype: "character",
        name: "老汉斯",
        essence: "旅店老板",
        initialState: "在柜台后擦拭酒杯",
        gameEntityId: "NPC_Hans",
        tags: undefined,
      },
      {
        type: "add_relationship",
        entityId: "NPC_Hans",
        relationship: {
          targetEntityId: "entity-player",
          type: "observer",
          description: "观察这个陌生的面孔",
        },
      },
    ]);
  });

  it("支持 create.presence 生成附加的 presence 更新", () => {
    const raw = JSON.stringify([
      {
        op: "create",
        type: "character",
        name: "疤面巴克",
        id: "NPC_Buck",
        essence: "收债人",
        state: "正闯入酒馆",
        presence: "dormant",
      },
    ]);

    const result = parseArchiveUpdates(raw, entityLookup, 1);

    expect(result).toEqual([
      {
        type: "create_entity",
        archetype: "character",
        name: "疤面巴克",
        essence: "收债人",
        initialState: "正闯入酒馆",
        gameEntityId: "NPC_Buck",
        tags: undefined,
      },
      {
        type: "update_presence",
        entityId: "NPC_Buck",
        newPresence: "dormant",
      },
    ]);
  });

  it("空数组返回空结果", () => {
    expect(parseArchiveUpdates("[]", entityLookup, 1)).toEqual([]);
    expect(parseArchiveUpdates("   ", entityLookup, 1)).toEqual([]);
  });

  it("无法匹配 ref 时抛出 DirectorOutputParseError", () => {
    const raw = JSON.stringify([
      { op: "update", ref: "未知实体", state: "变化" },
    ]);

    expect(() => parseArchiveUpdates(raw, entityLookup, 1)).toThrow(
      DirectorOutputParseError,
    );
    expect(() => parseArchiveUpdates(raw, entityLookup, 1)).toThrow(
      /无法匹配实体引用: 未知实体/,
    );
  });

  it("无效 type 时抛出 DirectorOutputParseError", () => {
    const raw = JSON.stringify([
      { op: "create", type: "unknown", name: "测试", state: "初登场" },
    ]);

    expect(() => parseArchiveUpdates(raw, entityLookup, 1)).toThrow(
      /type 值无效: "unknown"/,
    );
  });

  it("无效 presence 时抛出 DirectorOutputParseError", () => {
    const raw = JSON.stringify([
      { op: "presence", ref: "PC", presence: "sleeping" },
    ]);

    expect(() => parseArchiveUpdates(raw, entityLookup, 1)).toThrow(
      /presence 值无效: "sleeping"/,
    );
  });
});

describe("parseOutlineUpdates", () => {
  it("可解析标准 JSON 数组为 OutlineUpdateInstruction[]", () => {
    const raw = JSON.stringify([
      { op: "arc_deviation", desc: "玩家使用伪造通行证" },
      { op: "arc_status", status: "completed" },
      { op: "milestone", ref: "到达北方城镇", status: "triggered" },
      { op: "foreshadow_hint", ref: "莉娜的秘密", delta: 1 },
      { op: "foreshadow_status", ref: "莉娜的秘密", status: "revealed" },
      {
        op: "add_foreshadow",
        desc: "神秘商人的身份",
        trigger: "玩家调查商队",
        reveal: "商人是间谍",
      },
      { op: "remove_foreshadow", ref: "已废弃的伏笔" },
    ]);

    const result = parseOutlineUpdates(raw, 8);

    expect(result).toEqual([
      {
        type: "append_arc_deviation",
        deviation: "玩家使用伪造通行证",
      },
      {
        type: "set_arc_status",
        status: "completed",
      },
      {
        type: "set_milestone_status",
        milestoneRef: "到达北方城镇",
        status: "triggered",
      },
      {
        type: "increment_foreshadow_hint",
        foreshadowRef: "莉娜的秘密",
        delta: 1,
      },
      {
        type: "set_foreshadow_status",
        foreshadowRef: "莉娜的秘密",
        status: "revealed",
      },
      {
        type: "add_foreshadow",
        foreshadow: {
          description: "神秘商人的身份",
          plantedAtTurn: 8,
          triggerCondition: "玩家调查商队",
          revealEffect: "商人是间谍",
          status: "planted",
          hintCount: 0,
          relatedEntityIds: [],
        },
      },
      {
        type: "remove_foreshadow",
        foreshadowRef: "已废弃的伏笔",
      },
    ]);
  });

  it("可自动修复单引号与尾逗号后完成解析", () => {
    const raw = `
[
  {'op':'arc_deviation','desc':'玩家偏离主线'},
  {'op':'foreshadow_hint','ref':'旧伤疤','delta':2},
]
`;

    const result = parseOutlineUpdates(raw, 4);

    expect(result).toEqual([
      {
        type: "append_arc_deviation",
        deviation: "玩家偏离主线",
      },
      {
        type: "increment_foreshadow_hint",
        foreshadowRef: "旧伤疤",
        delta: 2,
      },
    ]);
  });

  it("add_foreshadow 缺少 trigger/reveal 时使用默认值", () => {
    const raw = JSON.stringify([{ op: "add_foreshadow", desc: "黑市密道" }]);

    const result = parseOutlineUpdates(raw, 12);

    expect(result).toEqual([
      {
        type: "add_foreshadow",
        foreshadow: {
          description: "黑市密道",
          plantedAtTurn: 12,
          triggerCondition: "待导演后续细化",
          revealEffect: "待导演后续细化",
          status: "planted",
          hintCount: 0,
          relatedEntityIds: [],
        },
      },
    ]);
  });

  it("空数组返回空结果", () => {
    expect(parseOutlineUpdates("[]", 1)).toEqual([]);
    expect(parseOutlineUpdates("   ", 1)).toEqual([]);
  });

  it("无效状态时抛出 DirectorOutputParseError", () => {
    const raw = JSON.stringify([{ op: "arc_status", status: "done" }]);

    expect(() => parseOutlineUpdates(raw, 1)).toThrow(DirectorOutputParseError);
    expect(() => parseOutlineUpdates(raw, 1)).toThrow(
      /arc_status 值无效: "done"/,
    );
  });

  it("delta 非数字时抛出 DirectorOutputParseError", () => {
    const raw = JSON.stringify([
      { op: "foreshadow_hint", ref: "伤痕", delta: "1" },
    ]);

    expect(() => parseOutlineUpdates(raw, 1)).toThrow(/delta 必须是有效数字/);
  });
});

describe("repairJson", () => {
  it("可移除 markdown code fence、单引号和尾逗号", () => {
    const raw = "```json\n[{'op':'update','ref':'PC','state':'测试'},]\n```";

    expect(repairJson(raw)).toBe('[{"op":"update","ref":"PC","state":"测试"}]');
  });

  it("无法修复的非法 JSON 由上层解析函数抛错", () => {
    const raw = "[{op: update}]";

    expect(() => parseOutlineUpdates(raw, 1)).toThrow(DirectorOutputParseError);
  });
});
