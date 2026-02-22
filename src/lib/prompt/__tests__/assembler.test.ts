/**
 * assembler.ts 测试
 *
 * 覆盖：
 * - 按 blockOrder 顺序组装消息
 * - 普通块的变量解析
 * - Marker 块委托给注册表
 * - 跳过未启用的块
 * - 空内容块被过滤
 * - getLastMarkerResult 缓存
 */

import { describe, expect, it, vi } from "vitest";
import { createMessageAssembler } from "../assembler";
import type { Preset, PromptBlock, VariableContext } from "../types";

// ─── Mock 外部依赖 ──────────────────────────────────────────

vi.mock("@/lib/lorebook", () => ({
  collectWorldInfoContentSync: vi.fn(() => ""),
}));

// ─── 工具函数 ─────────────────────────────────────────────

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

function createBlock(overrides: Partial<PromptBlock> = {}): PromptBlock {
  return {
    id: "test-block",
    name: "Test Block",
    content: "Hello World",
    role: "system",
    marker: false,
    injectionDepth: 0,
    order: 0,
    enabled: true,
    ...overrides,
  };
}

function createPreset(blocks: PromptBlock[], blockOrder?: string[]): Preset {
  return {
    id: "test-preset",
    name: "Test Preset",
    blocks,
    blockOrder: blockOrder ?? blocks.map((b) => b.id),
    metadata: {
      version: "1.0.0",
      source: "lyra",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  };
}

// ─── 测试 ───────────────────────────────────────────────────

describe("MessageAssembler", () => {
  describe("assemble", () => {
    it("按 blockOrder 顺序组装消息", () => {
      const assembler = createMessageAssembler();
      const block1 = createBlock({ id: "b1", content: "First", order: 1 });
      const block2 = createBlock({ id: "b2", content: "Second", order: 0 });
      const preset = createPreset([block1, block2], ["b2", "b1"]);
      const ctx = createMinimalContext();

      const messages = assembler.assemble(preset, ctx);

      expect(messages).toHaveLength(2);
      expect(messages[0].content).toBe("Second");
      expect(messages[1].content).toBe("First");
    });

    it("跳过未启用的块", () => {
      const assembler = createMessageAssembler();
      const block1 = createBlock({ id: "b1", content: "Enabled" });
      const block2 = createBlock({
        id: "b2",
        content: "Disabled",
        enabled: false,
      });
      const preset = createPreset([block1, block2]);
      const ctx = createMinimalContext();

      const messages = assembler.assemble(preset, ctx);

      expect(messages).toHaveLength(1);
      expect(messages[0].content).toBe("Enabled");
    });

    it("空内容块被过滤", () => {
      const assembler = createMessageAssembler();
      const block = createBlock({ id: "b1", content: "   " });
      const preset = createPreset([block]);
      const ctx = createMinimalContext();

      const messages = assembler.assemble(preset, ctx);

      expect(messages).toHaveLength(0);
    });

    it("解析普通块中的变量", () => {
      const assembler = createMessageAssembler();
      const block = createBlock({
        id: "b1",
        content: "你好 {{char}}",
      });
      const preset = createPreset([block]);
      const ctx = createMinimalContext({ mode: "solo" });

      const messages = assembler.assemble(preset, ctx);

      expect(messages).toHaveLength(1);
      expect(messages[0].content).toBe("你好 AI 助手");
    });

    it("保留消息的 role", () => {
      const assembler = createMessageAssembler();
      const blocks = [
        createBlock({ id: "b1", content: "System", role: "system" }),
        createBlock({ id: "b2", content: "User", role: "user" }),
        createBlock({ id: "b3", content: "Assistant", role: "assistant" }),
      ];
      const preset = createPreset(blocks);
      const ctx = createMinimalContext();

      const messages = assembler.assemble(preset, ctx);

      expect(messages[0].role).toBe("system");
      expect(messages[1].role).toBe("user");
      expect(messages[2].role).toBe("assistant");
    });

    it("处理 scenario Marker 块", () => {
      const assembler = createMessageAssembler();
      const block = createBlock({
        id: "sc",
        content: "",
        marker: true,
        markerType: "scenario",
        role: "system",
      });
      const preset = createPreset([block]);
      const ctx = createMinimalContext({ scenario: "冒险开始了" });

      const messages = assembler.assemble(preset, ctx);

      expect(messages).toHaveLength(1);
      expect(messages[0].content).toBe("冒险开始了");
      expect(messages[0].role).toBe("system");
    });

    it("chatHistory Marker 块产生多条消息", () => {
      const assembler = createMessageAssembler();
      const block = createBlock({
        id: "ch",
        content: "",
        marker: true,
        markerType: "chatHistory",
        markerConfig: { maxMessages: 50 },
        role: "user",
      });
      const preset = createPreset([block]);
      const ctx = createMinimalContext({
        chatHistory: [
          { role: "user", content: "你好" },
          { role: "assistant", content: "你好！" },
        ],
      });

      const messages = assembler.assemble(preset, ctx);

      expect(messages).toHaveLength(2);
      expect(messages[0].content).toBe("你好");
      expect(messages[1].content).toBe("你好！");
    });

    it("memorySummary Marker 块产生单条合并消息", () => {
      const assembler = createMessageAssembler();
      const block = createBlock({
        id: "ms",
        content: "",
        marker: true,
        markerType: "memorySummary",
        role: "system",
      });
      const preset = createPreset([block]);
      const ctx = createMinimalContext({
        memoryData: {
          megaSummaries: [{ id: "mega-1", content: "王都收复战已经结束" }],
          miniSummaries: [{ id: "mini-1", content: "队伍在城门口重整补给" }],
          recentNarratives: [
            { id: "n-1", content: "你抬头看见晨光穿过残垣。" },
          ],
        },
      });

      const messages = assembler.assemble(preset, ctx);

      expect(messages).toHaveLength(1);
      expect(messages[0]).toEqual({
        role: "system",
        content:
          "【剧情回顾】\n\n王都收复战已经结束\n\n【近期事件摘要】\n\n队伍在城门口重整补给\n\n你抬头看见晨光穿过残垣。",
      });
    });

    it("Marker 内容为空时不生成消息", () => {
      const assembler = createMessageAssembler();
      const block = createBlock({
        id: "sc",
        content: "",
        marker: true,
        markerType: "scenario",
      });
      const preset = createPreset([block]);
      const ctx = createMinimalContext(); // 没有 scenario

      const messages = assembler.assemble(preset, ctx);

      expect(messages).toHaveLength(0);
    });

    it("未知 markerType 时返回空消息", () => {
      const assembler = createMessageAssembler();
      const block = createBlock({
        id: "unknown",
        content: "",
        marker: true,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        markerType: "nonExistent" as any,
      });
      const preset = createPreset([block]);
      const ctx = createMinimalContext();

      const messages = assembler.assemble(preset, ctx);

      expect(messages).toHaveLength(0);
    });

    it("不在 blockOrder 中的块附加到末尾", () => {
      const assembler = createMessageAssembler();
      const block1 = createBlock({ id: "b1", content: "Ordered" });
      const block2 = createBlock({ id: "b2", content: "Unordered" });
      const preset = createPreset([block1, block2], ["b1"]);
      const ctx = createMinimalContext();

      const messages = assembler.assemble(preset, ctx);

      expect(messages).toHaveLength(2);
      expect(messages[0].content).toBe("Ordered");
      expect(messages[1].content).toBe("Unordered");
    });
  });

  describe("getLastMarkerResult", () => {
    it("返回上一次 Marker 块的解析结果", () => {
      const assembler = createMessageAssembler();
      const block = createBlock({
        id: "sc-block",
        content: "",
        marker: true,
        markerType: "scenario",
      });
      const preset = createPreset([block]);
      const ctx = createMinimalContext({ scenario: "冒险开始了" });

      assembler.assemble(preset, ctx);

      const cached = assembler.getLastMarkerResult("sc-block");
      expect(cached).toHaveLength(1);
      expect(cached[0].content).toBe("冒险开始了");
    });

    it("未组装过的块返回空数组", () => {
      const assembler = createMessageAssembler();
      expect(assembler.getLastMarkerResult("nonexistent")).toEqual([]);
    });
  });
});
