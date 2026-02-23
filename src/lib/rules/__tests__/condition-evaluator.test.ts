import { describe, expect, it, vi } from "vitest";

import { evaluateCondition } from "../condition-evaluator";

describe("evaluateCondition", () => {
  it("简单比较：player.hp < 10", () => {
    const result = evaluateCondition("player.hp < 10", {
      getEntityAttributes: (entityId) =>
        entityId === "player" ? { hp: 8 } : undefined,
    });

    expect(result).toBe(true);
  });

  it("逻辑与：player.hp > 0 && player.mp > 0", () => {
    const result = evaluateCondition("player.hp > 0 && player.mp > 0", {
      getEntityAttributes: (entityId) =>
        entityId === "player" ? { hp: 5, mp: 2 } : undefined,
    });

    expect(result).toBe(true);
  });

  it("逻辑或：player.hp < 10 || flee_check", () => {
    const result = evaluateCondition("player.hp < 10 || flee_check", {
      getEntityAttributes: (entityId) =>
        entityId === "player" ? { hp: 20 } : undefined,
      vars: { flee_check: true },
    });

    expect(result).toBe(true);
  });

  it("逻辑非：!stealth_result", () => {
    const result = evaluateCondition("!stealth_result", {
      vars: { stealth_result: false },
    });

    expect(result).toBe(true);
  });

  it("变量引用（布尔）：atk_result", () => {
    const result = evaluateCondition("atk_result", {
      vars: { atk_result: true },
    });

    expect(result).toBe(true);
  });

  it("hasTag 谓词会正确调用 context.hasTag", () => {
    const hasTag = vi.fn((entityId: string, tag: string) => {
      return entityId === "player" && tag === "poisoned";
    });

    const result = evaluateCondition("hasTag(player, 'poisoned')", {
      hasTag,
    });

    expect(result).toBe(true);
    expect(hasTag).toHaveBeenCalledWith("player", "poisoned");
  });

  it("hasItem 谓词会正确调用 context.hasItem", () => {
    const hasItem = vi.fn((entityId: string, itemName: string) => {
      return entityId === "player" && itemName === "iron_sword";
    });

    const result = evaluateCondition("hasItem(player, 'iron_sword')", {
      hasItem,
    });

    expect(result).toBe(true);
    expect(hasItem).toHaveBeenCalledWith("player", "iron_sword");
  });

  it("复合表达式：player.hp < 10 && hasTag(player, 'cornered')", () => {
    const hasTag = vi.fn((entityId: string, tag: string) => {
      return entityId === "player" && tag === "cornered";
    });

    const result = evaluateCondition(
      "player.hp < 10 && hasTag(player, 'cornered')",
      {
        getEntityAttributes: (entityId) =>
          entityId === "player" ? { hp: 7 } : undefined,
        hasTag,
      },
    );

    expect(result).toBe(true);
    expect(hasTag).toHaveBeenCalledWith("player", "cornered");
  });

  it("超长表达式会抛错", () => {
    const tooLongExpr = "a".repeat(501);

    expect(() => evaluateCondition(tooLongExpr, {})).toThrow(/长度超限/);
  });

  it("空表达式会抛错", () => {
    expect(() => evaluateCondition("", {})).toThrow(/为空/);
  });
});
