/**
 * 技能实体定义
 *
 * 技能是角色可以习得和使用的能力。
 * 支持预设模板定义、AI 动态生成和等级成长。
 */

import type { PassiveModifier } from "../types/rule-script";

// ─── 技能类别 ──────────────────────────────────────

export type SkillCategory =
  | "combat"
  | "magic"
  | "survival"
  | "social"
  | "craft"
  | "misc";

// ─── 资源消耗 ──────────────────────────────────────

export interface ResourceCost {
  /** 引用 DerivedStatConfig.key，如 "mp" */
  field: string;
  amount: number;
}

// ─── 技能效果（按等级分层）────────────────────────

export interface SkillEffect {
  level: number;
  description: string;
  modifiers?: PassiveModifier[];
  costOverride?: ResourceCost;
}

// ─── 技能前置条件 ──────────────────────────────────

export interface SkillPrerequisites {
  attributes?: Record<string, number>;
  skillIds?: string[];
  level?: number;
}

// ─── 技能模板（预设作者定义）──────────────────────

export interface SkillTemplate {
  id: string;
  name: string;
  description: string;
  category: SkillCategory;
  maxLevel?: number;
  activeUsable?: boolean;
  cost?: ResourceCost;
  effects?: SkillEffect[];
  prerequisites?: SkillPrerequisites;
  evolvesInto?: { templateId: string; name: string; condition?: string };
}

// ─── 技能实例（运行时）────────────────────────────

export interface SkillInstance {
  instanceId: string;
  templateId: string;
  name: string;
  description: string;
  category: SkillCategory;
  level: number;
  maxLevel: number;
  activeUsable: boolean;
  cost?: ResourceCost;
  source: "predefined" | "ai-generated";
  acquiredAt: number;
  evolvedFrom?: string;
}

// ─── 创建参数 ──────────────────────────────────────

export interface CreateSkillInstanceParams {
  templateId: string;
  name: string;
  description: string;
  category: SkillCategory;
  level?: number;
  maxLevel?: number;
  activeUsable?: boolean;
  cost?: ResourceCost;
  source: "predefined" | "ai-generated";
  evolvedFrom?: string;
}

// ─── 工厂函数 ──────────────────────────────────────

/**
 * 创建技能实例
 */
export function createSkillInstance(
  params: CreateSkillInstanceParams,
): SkillInstance {
  return {
    instanceId: crypto.randomUUID(),
    templateId: params.templateId,
    name: params.name,
    description: params.description,
    category: params.category,
    level: params.level ?? 1,
    maxLevel: params.maxLevel ?? 1,
    activeUsable: params.activeUsable ?? false,
    cost: params.cost,
    source: params.source,
    acquiredAt: Date.now(),
    evolvedFrom: params.evolvedFrom,
  };
}
