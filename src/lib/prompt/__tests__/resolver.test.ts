/**
 * resolver.ts 测试
 *
 * 覆盖：
 * - 内置变量解析（char, user, scenario, turn, date 等）
 * - Marker 注册表集成（{{user}} 别名 → characterDescription.render()）
 * - 自定义变量注册
 * - 自定义函数注册
 * - 宏表达式保留
 */

import { describe, expect, it, vi } from "vitest";
import { createVariableResolver } from "../resolver";
import type { VariableContext } from "../types";

// ─── Mock 外部依赖 ──────────────────────────────────────────

vi.mock("@/lib/lorebook", () => ({
  collectWorldInfoContentSync: vi.fn(() => ""),
}));

vi.mock("../macros", () => ({
  macroParser: {
    parse: (template: string, _ctx: unknown) => ({
      content: template,
      warnings: [],
    }),
  },
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

// ─── 测试 ───────────────────────────────────────────────────

describe("VariableResolver", () => {
  describe("内置变量", () => {
    it("{{char}} 单机模式返回 'AI 助手'", () => {
      const resolver = createVariableResolver();
      const ctx = createMinimalContext({ mode: "solo" });
      const result = resolver.resolve("角色: {{char}}", ctx);
      expect(result.content).toBe("角色: AI 助手");
    });

    it("{{char}} 联机模式返回 '游戏主持人（GM）'", () => {
      const resolver = createVariableResolver();
      const ctx = createMinimalContext({ mode: "multiplayer" });
      const result = resolver.resolve("角色: {{char}}", ctx);
      expect(result.content).toBe("角色: 游戏主持人（GM）");
    });

    it("{{turn}} 有 turn 时返回回合号", () => {
      const resolver = createVariableResolver();
      const ctx = createMinimalContext({
        turn: { number: 5, actions: [] },
      });
      const result = resolver.resolve("回合: {{turn}}", ctx);
      expect(result.content).toBe("回合: 5");
    });

    it("{{turn}} 无 turn 时返回空字符串", () => {
      const resolver = createVariableResolver();
      const ctx = createMinimalContext();
      const result = resolver.resolve("回合: {{turn}}", ctx);
      expect(result.content).toBe("回合: ");
    });

    it("{{date}} 返回当前日期（中文格式）", () => {
      const resolver = createVariableResolver();
      const ctx = createMinimalContext();
      const result = resolver.resolve("{{date}}", ctx);
      // 应该是类似 "2024/1/15" 的格式
      expect(result.content).toMatch(/\d{4}\/\d{1,2}\/\d{1,2}/);
    });

    it("{{time}} 返回当前时间", () => {
      const resolver = createVariableResolver();
      const ctx = createMinimalContext();
      const result = resolver.resolve("{{time}}", ctx);
      expect(result.content).toMatch(/\d{1,2}:\d{2}:\d{2}/);
    });

    it("{{personality}} 返回空字符串", () => {
      const resolver = createVariableResolver();
      const ctx = createMinimalContext();
      const result = resolver.resolve("性格: {{personality}}", ctx);
      expect(result.content).toBe("性格: ");
    });

    it("{{group}} 联机模式返回玩家列表", () => {
      const resolver = createVariableResolver();
      const ctx = createMinimalContext({
        mode: "multiplayer",
        players: [{ name: "Alice" }, { name: "Bob" }],
      });
      const result = resolver.resolve("组: {{group}}", ctx);
      expect(result.content).toBe("组: Alice、Bob");
    });

    it("{{group}} 单机模式返回空字符串", () => {
      const resolver = createVariableResolver();
      const ctx = createMinimalContext({ mode: "solo" });
      const result = resolver.resolve("组: {{group}}", ctx);
      expect(result.content).toBe("组: ");
    });
  });

  describe("Marker 注册表集成", () => {
    it("{{user}} 别名解析为 characterDescription 的 render 输出", () => {
      const resolver = createVariableResolver();
      const ctx = createMinimalContext({
        mode: "solo",
        user: { name: "勇者" },
      });
      const result = resolver.resolve("{{user}}", ctx);
      expect(result.content).toContain("勇者");
    });

    it("{{userPersona}} 旧别名仍可解析（兼容）", () => {
      const resolver = createVariableResolver();
      const ctx = createMinimalContext({
        mode: "solo",
        user: { name: "勇者" },
      });
      const result = resolver.resolve("{{userPersona}}", ctx);
      expect(result.content).toContain("勇者");
    });

    it("{{scenario}} 通过注册表解析", () => {
      const resolver = createVariableResolver();
      const ctx = createMinimalContext({ scenario: "黑暗森林" });
      const result = resolver.resolve("场景: {{scenario}}", ctx);
      expect(result.content).toBe("场景: 黑暗森林");
    });

    it("{{gameState}} 旧别名映射到 characterSheet", () => {
      const resolver = createVariableResolver();
      const ctx = createMinimalContext({
        gameState: { round: 1 },
      });
      const result = resolver.resolve("{{gameState}}", ctx);
      expect(result.content).toContain("【角色数据表】");
    });

    it("{{chatHistory}} 是多消息 Marker，变量模式下不渲染", () => {
      // chatHistory 有 multiMessage=true，所以在变量模式下应跳过
      const resolver = createVariableResolver();
      const ctx = createMinimalContext({
        chatHistory: [{ role: "user", content: "hello" }],
      });
      const result = resolver.resolve("{{chatHistory}}", ctx);
      // multiMessage marker 不被变量解析器处理，保留原样
      expect(result.content).toBe("{{chatHistory}}");
    });

    it("{{memorySummary}} 是多消息 Marker，变量模式下不渲染", () => {
      const resolver = createVariableResolver();
      const ctx = createMinimalContext({
        memoryData: {
          megaSummaries: [{ id: "mega-1", content: "远古封印崩解" }],
          miniSummaries: [{ id: "mini-1", content: "队伍抵达祭坛外围" }],
          recentNarratives: [
            { id: "n-1", content: "你看见地面浮现银色纹路。" },
          ],
        },
      });
      const result = resolver.resolve("{{memorySummary}}", ctx);
      expect(result.content).toBe("{{memorySummary}}");
    });
  });

  describe("自定义变量", () => {
    it("注册并解析自定义变量", () => {
      const resolver = createVariableResolver();
      resolver.registerVariable("myVar", () => "自定义值");
      const ctx = createMinimalContext();
      const result = resolver.resolve("值: {{myVar}}", ctx);
      expect(result.content).toBe("值: 自定义值");
    });

    it("自定义变量异常时保留原样并记录警告", () => {
      const resolver = createVariableResolver();
      resolver.registerVariable("badVar", () => {
        throw new Error("解析失败");
      });
      const ctx = createMinimalContext();
      const result = resolver.resolve("值: {{badVar}}", ctx);
      expect(result.content).toBe("值: {{badVar}}");
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].reason).toContain("解析失败");
    });
  });

  describe("自定义函数", () => {
    it("注册并解析自定义函数", () => {
      const resolver = createVariableResolver();
      resolver.registerFunction(
        "upper",
        (args) => args[0]?.toUpperCase() ?? "",
      );
      const ctx = createMinimalContext();
      const result = resolver.resolve("{{upper:hello}}", ctx);
      expect(result.content).toBe("HELLO");
    });

    it("自定义函数异常时保留原样并记录警告", () => {
      const resolver = createVariableResolver();
      resolver.registerFunction("fail", () => {
        throw new Error("函数错误");
      });
      const ctx = createMinimalContext();
      const result = resolver.resolve("{{fail:x}}", ctx);
      expect(result.content).toBe("{{fail:x}}");
      expect(result.warnings).toHaveLength(1);
    });
  });

  describe("未知变量", () => {
    it("未知变量保留原样", () => {
      const resolver = createVariableResolver();
      const ctx = createMinimalContext();
      const result = resolver.resolve("{{unknown}}", ctx);
      expect(result.content).toBe("{{unknown}}");
    });

    it("双冒号表达式保留原样（宏语法）", () => {
      const resolver = createVariableResolver();
      const ctx = createMinimalContext();
      const result = resolver.resolve("{{getvar::name}}", ctx);
      expect(result.content).toBe("{{getvar::name}}");
    });
  });

  describe("混合解析", () => {
    it("同时解析多个变量", () => {
      const resolver = createVariableResolver();
      const ctx = createMinimalContext({
        mode: "solo",
        scenario: "暗黑森林",
      });
      const result = resolver.resolve(
        "角色: {{char}}, 场景: {{scenario}}",
        ctx,
      );
      expect(result.content).toBe("角色: AI 助手, 场景: 暗黑森林");
    });
  });
});
