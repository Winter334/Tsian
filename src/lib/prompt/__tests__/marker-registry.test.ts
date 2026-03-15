/**
 * marker-registry.ts 测试
 *
 * 覆盖：
 * - MARKER_IDS 常量
 * - 查询 API（getMarkerById, findMarkerByIdOrAlias, getAllMarkers）
 * - 各渲染函数的输出格式
 */

import type { ResultFrame, TagMetadata } from "@/domain/types/result-frame";
import { describe, expect, it, vi } from "vitest";
import {
  MARKER_IDS,
  findMarkerByIdOrAlias,
  getAllMarkers,
  getMarkerById,
} from "../marker-registry";
import type { VariableContext } from "../types";

// ─── Mock 外部依赖 ──────────────────────────────────────────

// Mock lorebook collector（避免依赖 store）
vi.mock("@/lib/lorebook", () => ({
  collectWorldInfoContentSync: vi.fn(() => ""),
}));

// ─── 工具：构造最小 VariableContext ─────────────────────────

function createMinimalContext(
  overrides: Partial<VariableContext> = {},
): VariableContext {
  return {
    mode: "solo",
    user: { name: "TestPlayer" },
    chatHistory: [],
    ...overrides,
  };
}

// ─── 测试 ───────────────────────────────────────────────────

describe("MARKER_IDS", () => {
  it("包含 14 个 id", () => {
    expect(MARKER_IDS).toHaveLength(14);
  });

  it("包含所有预期的 id", () => {
    const expected = [
      "chatHistory",
      "characterSheet",
      "characterDescription",
      "narrativeState",
      "resultFrame",
      "operationDefs",
      "worldInfo",
      "worldArchive",
      "scenario",
      "plotDirectives",
      "turnNarrativeIntent",
      "narrativeHints",
      "turnInfo",
      "memorySummary",
    ];
    expect([...MARKER_IDS]).toEqual(expected);
  });
});

describe("getMarkerById", () => {
  it("按 id 找到已注册的 marker", () => {
    const entry = getMarkerById("chatHistory");
    expect(entry).toBeDefined();
    expect(entry!.id).toBe("chatHistory");
    expect(entry!.displayName).toBe("对话历史");
  });

  it("找不到时返回 undefined", () => {
    expect(getMarkerById("nonExistent")).toBeUndefined();
  });

  it.each(MARKER_IDS)("能找到 %s", (id) => {
    expect(getMarkerById(id)).toBeDefined();
  });
});

describe("findMarkerByIdOrAlias", () => {
  it("按 id 查找", () => {
    const entry = findMarkerByIdOrAlias("characterDescription");
    expect(entry).toBeDefined();
    expect(entry!.id).toBe("characterDescription");
  });

  it("按别名 'user' 查找到 characterDescription", () => {
    const entry = findMarkerByIdOrAlias("user");
    expect(entry).toBeDefined();
    expect(entry!.id).toBe("characterDescription");
  });

  it("按旧别名 'userPersona' 兼容到 characterDescription", () => {
    const entry = findMarkerByIdOrAlias("userPersona");
    expect(entry).toBeDefined();
    expect(entry!.id).toBe("characterDescription");
  });

  it("按旧别名 'gameState' 兼容到 characterSheet", () => {
    const entry = findMarkerByIdOrAlias("gameState");
    expect(entry).toBeDefined();
    expect(entry!.id).toBe("characterSheet");
  });

  it("找不到时返回 undefined", () => {
    expect(findMarkerByIdOrAlias("unknown")).toBeUndefined();
  });
});

describe("getAllMarkers", () => {
  it("返回所有注册项", () => {
    const all = getAllMarkers();
    expect(all).toHaveLength(14);
  });

  it("返回的数组包含所有 MARKER_IDS 中的 id", () => {
    const all = getAllMarkers();
    const ids = all.map((e) => e.id);
    for (const id of MARKER_IDS) {
      expect(ids).toContain(id);
    }
  });
});

// ─── 渲染函数测试 ─────────────────────────────────────────

describe("renderCharacterSheet（通过 characterSheet marker 的 render 调用）", () => {
  const marker = getMarkerById("characterSheet")!;

  it("渲染角色数据表标题与基础玩家信息", () => {
    const ctx = createMinimalContext({
      mode: "solo",
      user: { name: "勇者" },
    });
    const result = marker.render(ctx);

    expect(result).toContain("【角色数据表】");
    expect(result).toContain("═══ 玩家角色 ═══");
    expect(result).toContain("[引用ID: player] 勇者");
    expect(result).toContain("属性: （无）");
    expect(result).toContain("资源: （无）");
  });

  it("整合玩家/NPC/效果/背包/技能信息", () => {
    const ctx = createMinimalContext({
      mode: "solo",
      user: {
        name: "勇者",
        character: { name: "勇者" },
      },
      gameState: {
        "player.name": "勇者",
        "player.str": 17,
        "player.hp": 25,
        "player.max_hp": 25,
        "哥布林.name": "哥布林",
        "哥布林.controlType": "npc",
        "哥布林.status": "active",
        "哥布林.level": 3,
        "哥布林.str": 10,
        "哥布林.hp": 18,
        "哥布林.max_hp": 18,
      },
      activeNpcs: [
        {
          id: "goblin-1",
          name: "哥布林",
          status: "active",
          level: 3,
        },
      ],
      entityEffects: {
        哥布林: [
          {
            id: "poison",
            displayName: "中毒",
            effectDescription: "每回合损失生命",
            source: "ai-generated",
            remainingDuration: 2,
            trigger: {
              event: "on_turn_start",
              actions: [],
            },
          },
          {
            id: "bless",
            displayName: "祝福",
            effectDescription: "攻击+2",
            source: "ai-generated",
            remainingDuration: 3,
          },
        ] as TagMetadata[],
      },
      inventoryData: [
        {
          characterId: "player",
          characterName: "勇者",
          items: [
            {
              instanceId: "i1",
              name: "铁剑",
              description: "基础武器",
              category: "武器",
              quantity: 1,
              equipped: true,
            },
          ],
          skills: [
            {
              instanceId: "s1",
              name: "基础剑术",
              description: "基础近战技能",
              category: "combat",
              level: 1,
              maxLevel: 5,
              activeUsable: true,
            },
          ],
        },
      ],
    });

    const result = marker.render(ctx);

    expect(result).toContain("str 17");
    expect(result).toContain("hp 25/25");
    expect(result).toContain("背包: 铁剑x1（武器，已装备）");
    expect(result).toContain("技能: 基础剑术 Lv.1（主动/combat）");
    expect(result).toContain("═══ 在场 NPC ═══");
    expect(result).toContain("[引用ID: 哥布林] 哥布林 Lv.3 - 状态: active");
    expect(result).toContain("当前效果: 中毒（剩余 2 回合）[系统管理]");
    expect(result).toContain("祝福（剩余 3 回合）[AI管理]");
  });
});

describe("renderCharacterDescription（通过 characterDescription marker 的 render 调用）", () => {
  const marker = getMarkerById("characterDescription")!;

  it("渲染玩家叙事信息和 NPC 描写", () => {
    const ctx = createMinimalContext({
      mode: "solo",
      user: {
        name: "流萤白沙",
        character: {
          name: "流萤白沙",
          appearance: "尖耳、纤细身材",
          personality: "正义感强",
          description: "曾效忠于某位领主的骑士",
        },
      },
      entityEffects: {
        player: [
          {
            id: "darkvision",
            displayName: "暗视",
            effectDescription: "能在完全黑暗的环境中视物",
            source: "predefined",
            category: "talent",
          },
        ],
        npc1: [
          {
            id: "poison",
            displayName: "中毒",
            effectDescription: "身上弥漫着紫色毒雾",
            source: "ai-generated",
            remainingDuration: 2,
          },
        ],
      },
      activeNpcs: [
        {
          id: "npc1",
          name: "哥布林",
          level: 3,
          status: "active",
          appearance: "绿色皮肤的小矮人",
          personality: "凶残而狡猾",
          description: "警戒中",
        },
      ],
    });

    const result = marker.render(ctx);

    expect(result).toContain("【玩家角色】");
    expect(result).toContain("流萤白沙");
    expect(result).toContain("外貌: 尖耳、纤细身材");
    expect(result).toContain("性格: 正义感强");
    expect(result).toContain("背景故事: 曾效忠于某位领主的骑士");
    expect(result).toContain("天赋: 暗视（能在完全黑暗的环境中视物）");
    expect(result).toContain("【在场 NPC】");
    expect(result).toContain("1. 哥布林 (Lv.3)");
    expect(result).toContain("当前状态:");
    expect(result).toContain("中毒");
  });

  it("无在场 NPC 时显示（无）", () => {
    const ctx = createMinimalContext({
      user: { name: "勇者" },
      activeNpcs: [],
    });
    const result = marker.render(ctx);
    expect(result).toContain("【在场 NPC】");
    expect(result).toContain("（无）");
  });
});

describe("renderNarrativeState（通过 narrativeState marker 的 render 调用）", () => {
  const marker = getMarkerById("narrativeState")!;

  it("无可用实体资源时返回空字符串", () => {
    const ctx = createMinimalContext();
    expect(marker.render(ctx)).toBe("");
  });

  it("渲染精简资源状态与当前效果", () => {
    const ctx = createMinimalContext({
      gameState: {
        "player.name": "流萤白沙",
        "player.hp": 25,
        "player.max_hp": 25,
        "goblin.name": "哥布林",
        "goblin.hp": 18,
        "goblin.max_hp": 18,
      },
      entityDisplayNames: new Map([
        ["player", "流萤白沙"],
        ["goblin", "哥布林"],
      ]),
      entityEffects: {
        goblin: [
          {
            id: "poison",
            displayName: "中毒",
            effectDescription: "每回合损失生命",
            source: "ai-generated",
            remainingDuration: 2,
          },
        ],
      },
    });

    const result = marker.render(ctx);

    expect(result).toContain("【当前状态速览】");
    expect(result).toContain("流萤白沙:");
    expect(result).toContain("25/25");
    expect(result).toContain("哥布林:");
    expect(result).toContain("18/18");
    expect(result).toContain("中毒（剩余 2 回合）");
  });
});

describe("renderResultFrame（通过 resultFrame marker 的 render 调用）", () => {
  const marker = getMarkerById("resultFrame")!;

  it("无 resultFrame 时返回空字符串", () => {
    const ctx = createMinimalContext();
    expect(marker.render(ctx)).toBe("");
  });

  it("使用 mechanicSummary 作为主体，并补充 structuralChanges", () => {
    const frame: ResultFrame = {
      version: 1,
      frameId: "f1",
      commandId: "c1",
      seed: 42,
      timestamp: Date.now(),
      success: true,
      mechanicSummary:
        "player 发起攻击检定 → 成功（掷骰 15+3=18，难度 12）。goblin.hp 20→12。",
      valueChanges: [
        {
          entityId: "goblin",
          entityType: "character",
          field: "hp",
          oldValue: 20,
          newValue: 12,
          delta: -8,
          reason: "剑击",
        },
      ],
      diceRolls: [],
      checks: [
        {
          name: "近战攻击",
          skill: "attack",
          dcSource: "ai",
          dc: 12,
          roll: 15,
          modifier: 3,
          total: 18,
          success: true,
          margin: 6,
        },
      ],
      structuralChanges: [
        {
          type: "item_added",
          entityId: "item-1",
          targetId: "player",
          details: {
            name: "哥布林匕首",
            quantity: 1,
          },
        },
        {
          type: "skill_learned",
          entityId: "skill-1",
          targetId: "player",
          details: {
            name: "反击姿态",
          },
        },
      ],
    };

    const ctx = createMinimalContext({
      resultFrame: frame,
      entityDisplayNames: new Map([
        ["player", "勇者"],
        ["goblin", "哥布林"],
      ]),
    });

    const result = marker.render(ctx);

    expect(result).toContain("【本轮结算结果】");
    expect(result).toContain("▸ 勇者 发起攻击检定");
    expect(result).toContain("哥布林");
    expect(result).toContain("获得物品: 哥布林匕首");
    expect(result).toContain("习得技能: 反击姿态");
    expect(result).not.toContain("【骰子结果】");
    expect(result).not.toContain("【检定结果】");
    expect(result).not.toContain("【状态变化】");
  });

  it("失败结果包含失败原因", () => {
    const frame: ResultFrame = {
      version: 1,
      frameId: "f2",
      commandId: "c2",
      seed: 42,
      timestamp: Date.now(),
      success: false,
      failureReason: "DC 不足",
      mechanicSummary: "攻击失败",
      valueChanges: [],
      diceRolls: [],
      checks: [],
    };

    const ctx = createMinimalContext({ resultFrame: frame });
    const result = marker.render(ctx);

    expect(result).toContain("▸ 失败原因: DC 不足");
  });

  it("空 mechanicSummary 且无其他内容时返回空字符串", () => {
    const frame: ResultFrame = {
      version: 1,
      frameId: "f3",
      commandId: "c3",
      seed: 42,
      timestamp: Date.now(),
      success: true,
      mechanicSummary: "  ",
      valueChanges: [],
      diceRolls: [],
      checks: [],
    };

    const ctx = createMinimalContext({ resultFrame: frame });
    expect(marker.render(ctx)).toBe("");
  });
});

describe("renderOperationDefs（通过 operationDefs marker 的 render 调用）", () => {
  const marker = getMarkerById("operationDefs")!;

  it("无定义时返回空字符串", () => {
    const ctx = createMinimalContext();
    expect(marker.render(ctx)).toBe("");
  });

  it("空白字符串返回空字符串", () => {
    const ctx = createMinimalContext({ operationDefinitions: "   " });
    expect(marker.render(ctx)).toBe("");
  });

  it("有定义时添加前缀", () => {
    const ctx = createMinimalContext({
      operationDefinitions: "check: 检定操作\nroll: 掷骰操作",
    });
    const result = marker.render(ctx);
    expect(result).toContain("【可用操作定义】");
    expect(result).toContain("check: 检定操作");
  });
});

describe("renderScenario（通过 scenario marker 的 render 调用）", () => {
  const marker = getMarkerById("scenario")!;

  it("无 scenario 时返回空字符串", () => {
    const ctx = createMinimalContext();
    expect(marker.render(ctx)).toBe("");
  });

  it("有 scenario 时返回内容", () => {
    const ctx = createMinimalContext({ scenario: "冒险者进入了黑暗森林" });
    expect(marker.render(ctx)).toBe("冒险者进入了黑暗森林");
  });
});

describe("renderTurnInfo（通过 turnInfo marker 的 render 调用）", () => {
  const marker = getMarkerById("turnInfo")!;

  it("无 turn 时返回空字符串", () => {
    const ctx = createMinimalContext();
    expect(marker.render(ctx)).toBe("");
  });

  it("格式化回合信息", () => {
    const ctx = createMinimalContext({
      turn: {
        number: 3,
        actions: [
          { content: "勇者攻击哥布林", timestamp: 1000 },
          { content: "法师施放火球", timestamp: 1001 },
        ],
      },
    });
    const result = marker.render(ctx);
    expect(result).toContain("--- 第 3 回合 ---");
    expect(result).toContain("勇者攻击哥布林");
    expect(result).toContain("法师施放火球");
  });
});

describe("chatHistory marker 属性", () => {
  const marker = getMarkerById("chatHistory")!;

  it("multiMessage 为 true", () => {
    expect(marker.multiMessage).toBe(true);
  });

  it("renderMessages 已定义", () => {
    expect(marker.renderMessages).toBeDefined();
  });

  it("hasConfig 为 true", () => {
    expect(marker.hasConfig).toBe(true);
  });

  it("过滤系统消息（默认 includeSystemMessages=false）", () => {
    const ctx = createMinimalContext({
      chatHistory: [
        { role: "system", content: "系统提示" },
        { role: "user", content: "用户消息" },
        { role: "assistant", content: "助手回复" },
      ],
    });
    const block = {
      id: "test",
      name: "test",
      content: "",
      role: "user" as const,
      marker: true,
      markerType: "chatHistory" as const,
      markerConfig: {},
      injectionDepth: 0,
      order: 0,
      enabled: true,
    };
    const messages = marker.renderMessages!(ctx, block);
    expect(messages).toHaveLength(2);
    expect(messages.every((m) => m.role !== "system")).toBe(true);
  });

  it("includeSystemMessages=true 时保留系统消息", () => {
    const ctx = createMinimalContext({
      chatHistory: [
        { role: "system", content: "系统提示" },
        { role: "user", content: "用户消息" },
      ],
    });
    const block = {
      id: "test",
      name: "test",
      content: "",
      role: "user" as const,
      marker: true,
      markerType: "chatHistory" as const,
      markerConfig: { includeSystemMessages: true },
      injectionDepth: 0,
      order: 0,
      enabled: true,
    };
    const messages = marker.renderMessages!(ctx, block);
    expect(messages).toHaveLength(2);
  });

  it("maxMessages 限制消息数量", () => {
    const chatHistory = Array.from({ length: 20 }, (_, i) => ({
      role: "user" as const,
      content: `消息${i}`,
    }));
    const ctx = createMinimalContext({ chatHistory });
    const block = {
      id: "test",
      name: "test",
      content: "",
      role: "user" as const,
      marker: true,
      markerType: "chatHistory" as const,
      markerConfig: { maxMessages: 5 },
      injectionDepth: 0,
      order: 0,
      enabled: true,
    };
    const messages = marker.renderMessages!(ctx, block);
    expect(messages).toHaveLength(5);
    // 应取最新的 5 条
    expect(messages[0].content).toBe("消息15");
    expect(messages[4].content).toBe("消息19");
  });
});

describe("memorySummary marker 属性", () => {
  const marker = getMarkerById("memorySummary")!;

  it("multiMessage 为非多消息模式", () => {
    expect(marker.multiMessage).toBeFalsy();
  });

  it("render 已定义", () => {
    expect(marker.render).toBeDefined();
  });

  it("memoryData 缺失时返回空字符串", () => {
    const ctx = createMinimalContext();
    const result = marker.render(ctx);
    expect(result).toBe("");
  });

  it("render 返回三级合并文本（大总结 + 小总结 + 完整正文）", () => {
    const ctx = createMinimalContext({
      memoryData: {
        megaSummaries: [
          { id: "mega-1", content: "远古战争已经结束" },
          { id: "mega-2", content: "王都完成重建" },
        ],
        miniSummaries: [
          { id: "mini-1", content: "队伍进入了北境哨站" },
          { id: "mini-2", content: "守卫长交付了调查委托" },
        ],
        recentNarratives: [
          { id: "msg-1", content: "你推开哨站木门，冷风灌入大厅。" },
          { id: "msg-2", content: "守卫长将地图摊开，指出了遗迹入口。" },
        ],
      },
    });

    const result = marker.render(ctx);

    expect(result).toContain("【剧情回顾】");
    expect(result).toContain("远古战争已经结束");
    expect(result).toContain("王都完成重建");
    expect(result).toContain("【近期事件摘要】");
    expect(result).toContain("队伍进入了北境哨站");
    expect(result).toContain("守卫长交付了调查委托");
    expect(result).toContain("你推开哨站木门，冷风灌入大厅。");
    expect(result).toContain("守卫长将地图摊开，指出了遗迹入口。");
  });

  it("只有大总结时仅输出剧情回顾内容", () => {
    const ctx = createMinimalContext({
      memoryData: {
        megaSummaries: [{ id: "mega-1", content: "旧王朝覆灭" }],
        miniSummaries: [],
        recentNarratives: [],
      },
    });

    const result = marker.render(ctx);

    expect(result).toContain("【剧情回顾】");
    expect(result).toContain("旧王朝覆灭");
    expect(result).not.toContain("【近期事件摘要】");
  });

  it("只有小总结时仅输出近期事件摘要内容", () => {
    const ctx = createMinimalContext({
      memoryData: {
        megaSummaries: [],
        miniSummaries: [{ id: "mini-1", content: "队伍在港口完成补给" }],
        recentNarratives: [],
      },
    });

    const result = marker.render(ctx);

    expect(result).toContain("【近期事件摘要】");
    expect(result).toContain("队伍在港口完成补给");
    expect(result).not.toContain("【剧情回顾】");
  });

  it("只有完整正文时仅输出正文内容", () => {
    const ctx = createMinimalContext({
      memoryData: {
        megaSummaries: [],
        miniSummaries: [],
        recentNarratives: [
          { id: "msg-1", content: "夜色下，篝火映亮了每个人的侧脸。" },
          { id: "msg-2", content: "你听见远处林间传来短促的狼嚎。" },
        ],
      },
    });

    const result = marker.render(ctx);

    expect(result).toContain("夜色下，篝火映亮了每个人的侧脸。");
    expect(result).toContain("你听见远处林间传来短促的狼嚎。");
    expect(result).not.toContain("【剧情回顾】");
    expect(result).not.toContain("【近期事件摘要】");
  });
});
