import { describe, expect, it, vi } from "vitest";

import {
  evaluateDCFormula,
  resolveValueExpression,
} from "../formula-evaluator";

describe("resolveValueExpression", () => {
  it("数字字面量直接返回", () => {
    expect(resolveValueExpression(42, {})).toBe(42);
  });

  it("布尔值会转换为数字", () => {
    expect(resolveValueExpression(true, {})).toBe(1);
    expect(resolveValueExpression(false, {})).toBe(0);
  });

  it("可解析简单属性引用（actorAttributes）", () => {
    const result = resolveValueExpression("str_mod", {
      actorAttributes: { str_mod: 3 },
    });

    expect(result).toBe(3);
  });

  it("可解析实体属性引用（getEntityAttributes）", () => {
    const getEntityAttributes = vi.fn((entityId: string) => {
      if (entityId === "player") {
        return { hp: 18 };
      }
      return undefined;
    });

    const result = resolveValueExpression("player.hp", {
      getEntityAttributes,
    });

    expect(result).toBe(18);
    expect(getEntityAttributes).toHaveBeenCalledWith("player");
  });

  it("可解析骰子表达式并返回范围内的值", () => {
    const result = resolveValueExpression("2d6", {});

    expect(result).toBeGreaterThanOrEqual(2);
    expect(result).toBeLessThanOrEqual(12);
  });

  it("可解析混合表达式", () => {
    const result = resolveValueExpression("2 + str_mod", {
      actorAttributes: { str_mod: 4 },
    });

    expect(result).toBe(6);
  });

  it("可解析变量引用", () => {
    const result = resolveValueExpression("fire_dmg", {
      vars: { fire_dmg: 7 },
    });

    expect(result).toBe(7);
  });

  it.each(["", "2 + @"])("空字符串或无效表达式会抛错：%s", (expr) => {
    expect(() => resolveValueExpression(expr, {})).toThrow();
  });

  it("超长表达式（>500）会抛错", () => {
    const tooLongExpr = "1".repeat(501);

    expect(() => resolveValueExpression(tooLongExpr, {})).toThrow(/长度超限/);
  });
});

describe("evaluateDCFormula", () => {
  it("可解析简单属性引用（target.ac）", () => {
    const result = evaluateDCFormula("target.ac", { ac: 15 });

    expect(result).toBe(15);
  });

  it("可解析算术公式", () => {
    const result = evaluateDCFormula(
      "8 + target.proficiency + target.wis_mod",
      {
        proficiency: 2,
        wis_mod: 3,
      },
    );

    expect(result).toBe(13);
  });

  it("纯属性名简写等价于 target.xxx", () => {
    const result = evaluateDCFormula("ac", { ac: 17 });

    expect(result).toBe(17);
  });

  it("无效属性引用会抛错", () => {
    expect(() => evaluateDCFormula("target.missing", { ac: 10 })).toThrow(
      /不存在的 target 属性/,
    );
  });
});
