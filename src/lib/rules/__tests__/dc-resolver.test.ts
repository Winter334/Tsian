import { describe, expect, it, vi } from "vitest";

import type { CheckAction } from "@/domain/types/rule-script";
import { expandPreset, resolveDC } from "../dc-resolver";

function createBaseAction(overrides: Partial<CheckAction> = {}): CheckAction {
  return {
    type: "check",
    name: "测试检定",
    skill: "athletics",
    onSuccess: [],
    ...overrides,
  };
}

describe("resolveDC", () => {
  it("dcSource=fixed 时返回标准 DC", () => {
    const action = createBaseAction({
      dcSource: "fixed",
      fixedDC: 14,
    });

    const result = resolveDC(action, {});

    expect(result).toEqual({
      type: "standard",
      dc: 14,
    });
  });

  it("dcSource=ai 时解析 ValueExpression", () => {
    const action = createBaseAction({
      dcSource: "ai",
      dc: "10 + str_mod",
    });

    const result = resolveDC(action, {
      actorAttributes: { str_mod: 2 },
    });

    expect(result).toEqual({
      type: "standard",
      dc: 12,
    });
  });

  it("dcSource=formula 时通过公式计算 DC", () => {
    const getEntityAttributes = vi.fn((entityId: string) => {
      if (entityId === "enemy") {
        return {
          ac: 15,
          proficiency: 2,
          wis_mod: 1,
        };
      }
      return undefined;
    });

    const action = createBaseAction({
      dcSource: "formula",
      dcFormula: "8 + target.proficiency + target.wis_mod",
      dcTarget: "enemy",
    });

    const result = resolveDC(action, {
      getEntityAttributes,
    });

    expect(result).toEqual({
      type: "standard",
      dc: 11,
    });
    expect(getEntityAttributes).toHaveBeenCalledWith("enemy");
  });

  it("dcSource=opposed 时返回对抗检定信息", () => {
    const action = createBaseAction({
      dcSource: "opposed",
      opposedEntity: "target",
      opposedSkill: "acrobatics",
    });

    const result = resolveDC(action, {});

    expect(result).toEqual({
      type: "opposed",
      opposedEntityId: "target",
      opposedSkill: "acrobatics",
    });
  });

  it("默认 dcSource（未指定）等同于 ai", () => {
    const action = createBaseAction({
      dc: "12 + bonus",
    });

    const result = resolveDC(action, {
      vars: { bonus: 1 },
    });

    expect(result).toEqual({
      type: "standard",
      dc: 13,
    });
  });
});

describe("expandPreset", () => {
  it("无 preset 时原样返回", () => {
    const action = createBaseAction({
      dcSource: "fixed",
      fixedDC: 10,
    });

    const result = expandPreset(action);

    expect(result).toBe(action);
  });

  it("可展开 DC 预设并填充 skill/dcSource/dcFormula", () => {
    const action = createBaseAction({
      skill: "",
      preset: "will_save",
    });

    const result = expandPreset(action, {
      dcPresets: {
        will_save: {
          label: "意志豁免",
          formula: "8 + target.proficiency + target.wis_mod",
          defaultSkill: "willpower",
        },
      },
    });

    expect(result).toMatchObject({
      skill: "willpower",
      dcSource: "formula",
      dcFormula: "8 + target.proficiency + target.wis_mod",
      preset: undefined,
    });
  });

  it("可展开对抗预设并填充 skill/dcSource/opposedSkill", () => {
    const action = createBaseAction({
      skill: "",
      preset: "grapple",
    });

    const result = expandPreset(action, {
      opposedPresets: {
        grapple: {
          label: "擒抱对抗",
          attackerSkill: "athletics",
          defenderSkill: "acrobatics",
        },
      },
    });

    expect(result).toMatchObject({
      skill: "athletics",
      dcSource: "opposed",
      opposedSkill: "acrobatics",
      preset: undefined,
    });
  });

  it("preset 不存在时保持字段不变且不报错", () => {
    const action = createBaseAction({
      preset: "unknown_preset",
      skill: "investigation",
      dcSource: "fixed",
      fixedDC: 13,
    });

    const result = expandPreset(action, {
      dcPresets: {
        known: {
          label: "已知",
          formula: "target.ac",
        },
      },
    });

    expect(result).toMatchObject({
      type: "check",
      name: "测试检定",
      skill: "investigation",
      dcSource: "fixed",
      fixedDC: 13,
      preset: undefined,
    });
  });
});
