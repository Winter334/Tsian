/**
 * Inventory 模块 Action Schema 声明
 *
 * 为 grantItem / removeItem / grantSkill / removeSkill
 * 四个 RuleAction 提供结构化元数据，供 Prompt 生成和 AI 输出校验使用。
 */

import type { ActionSchema } from "@/lib/rules/schema";

// ─── Schema 定义 ────────────────────────────────────────────

const grantItemSchema: ActionSchema = {
  type: "grantItem",
  category: "inventory",
  displayName: "授予物品",
  description:
    "向目标角色的背包添加物品。可引用预设模板，也可由 AI 动态创造全新物品。",
  params: [
    {
      name: "target",
      type: "entityRef",
      required: true,
      description: "目标角色 ID",
    },
    {
      name: "templateId",
      type: "string",
      required: false,
      description:
        "物品模板 ID。如果引用预设模板，填入模板 ID，引擎会自动补全模板中的属性",
    },
    {
      name: "name",
      type: "string",
      required: true,
      description: '物品名称，如 "治疗药水"、"铁剑"',
    },
    {
      name: "description",
      type: "string",
      required: true,
      description: "物品描述，说明物品的外观、用途或来源",
    },
    {
      name: "category",
      type: "enum",
      required: true,
      description: "物品类别",
      enumValues: [
        "weapon",
        "armor",
        "accessory",
        "consumable",
        "material",
        "quest",
        "misc",
      ],
    },
    {
      name: "quantity",
      type: "number",
      required: false,
      description: "数量，默认为 1",
      defaultValue: 1,
    },
    {
      name: "equipSlot",
      type: "string",
      required: false,
      description:
        "装备槽位 ID（动态值）。合法取值来自 WorldConfig.inventoryRules.equipSlotDefinitions[*].id",
    },
    {
      name: "reason",
      type: "string",
      required: false,
      description: "获得原因，用于叙事展示",
    },
  ],
  constraints: [
    "quantity 必须 >= 1",
    "如果提供了 templateId，引擎会优先使用模板中的数据，name/description/category 仍需填写作为回退",
    "没有 templateId 时，AI 动态创造的物品会被标记为 ai-generated",
    "category 必须是枚举值之一，不能自定义",
    "equipSlot（若提供）必须来自 WorldConfig.inventoryRules.equipSlotDefinitions 且与 category 约束匹配",
  ],
  examples: [
    {
      scenario: "AI 给角色发放治疗药水",
      json: `{ "type": "grantItem", "target": "player", "name": "治疗药水", "description": "散发着淡淡草药香气的红色药剂，饮用后可恢复少量生命", "category": "consumable", "quantity": 2, "reason": "击败哥布林后搜刮战利品" }`,
    },
    {
      scenario: "使用预设模板发放武器",
      json: `{ "type": "grantItem", "target": "player", "templateId": "iron_sword", "name": "铁剑", "description": "一把普通的铁制长剑", "category": "weapon", "reason": "商人赠送的武器" }`,
    },
  ],
};

const removeItemSchema: ActionSchema = {
  type: "removeItem",
  category: "inventory",
  displayName: "移除物品",
  description:
    "从目标角色的背包中移除指定物品实例。可指定移除数量，默认移除全部。",
  params: [
    {
      name: "target",
      type: "entityRef",
      required: true,
      description: "目标角色 ID",
    },
    {
      name: "instanceId",
      type: "string",
      required: true,
      description: "物品实例 ID，必须是角色背包中已存在的物品",
    },
    {
      name: "quantity",
      type: "number",
      required: false,
      description: "移除数量。不指定时移除该实例的全部数量",
    },
    {
      name: "reason",
      type: "string",
      required: false,
      description: "移除原因，用于叙事展示",
    },
  ],
  constraints: [
    "instanceId 必须是目标角色背包中已存在的物品实例 ID",
    "quantity 不能超过该物品实例的当前数量",
    "不指定 quantity 时，整个物品实例会被完全移除",
  ],
  examples: [
    {
      scenario: "角色使用消耗品后移除",
      json: `{ "type": "removeItem", "target": "player", "instanceId": "item_abc123", "quantity": 1, "reason": "饮用治疗药水" }`,
    },
  ],
};

const grantSkillSchema: ActionSchema = {
  type: "grantSkill",
  category: "skill",
  displayName: "授予技能",
  description:
    "让目标角色习得一个新技能。可引用预设模板，也可由 AI 动态创造全新技能。",
  params: [
    {
      name: "target",
      type: "entityRef",
      required: true,
      description: "目标角色 ID",
    },
    {
      name: "templateId",
      type: "string",
      required: false,
      description:
        "技能模板 ID。如果引用预设模板，填入模板 ID，引擎会自动补全模板中的属性",
    },
    {
      name: "name",
      type: "string",
      required: true,
      description: '技能名称，如 "火球术"、"潜行"',
    },
    {
      name: "description",
      type: "string",
      required: true,
      description: "技能描述，说明技能的效果和使用方式",
    },
    {
      name: "category",
      type: "enum",
      required: true,
      description: "技能类别",
      enumValues: ["combat", "magic", "survival", "social", "craft", "misc"],
    },
    {
      name: "activeUsable",
      type: "boolean",
      required: false,
      description:
        "是否可主动使用。true 表示角色可主动释放，false 表示被动技能",
      defaultValue: false,
    },
    {
      name: "cost",
      type: "object",
      required: false,
      description: "主动技能的使用消耗。仅当 activeUsable 为 true 时有意义",
      properties: [
        {
          name: "field",
          type: "field",
          required: true,
          description: '消耗的资源字段名，如 "mp"、"stamina"',
        },
        {
          name: "amount",
          type: "number",
          required: true,
          description: "消耗量",
        },
      ],
    },
    {
      name: "reason",
      type: "string",
      required: false,
      description: "习得原因，用于叙事展示",
    },
  ],
  constraints: [
    "同名技能不应重复习得，引擎会检查角色是否已拥有同名技能",
    "如果提供了 templateId，引擎会优先使用模板中的数据，name/description/category 仍需填写作为回退",
    "没有 templateId 时，AI 动态创造的技能会被标记为 ai-generated",
    "category 必须是枚举值之一，不能自定义",
    "cost 仅在 activeUsable 为 true 时有效",
  ],
  examples: [
    {
      scenario: "角色通过训练学会火球术",
      json: `{ "type": "grantSkill", "target": "player", "name": "火球术", "description": "凝聚火焰元素投掷出一团火球，对目标造成火焰伤害", "category": "magic", "activeUsable": true, "cost": { "field": "mp", "amount": 15 }, "reason": "在法师学院完成火系课程" }`,
    },
    {
      scenario: "使用预设模板授予被动技能",
      json: `{ "type": "grantSkill", "target": "player", "templateId": "stealth_basic", "name": "基础潜行", "description": "降低被敌人发现的概率", "category": "survival", "reason": "盗贼导师传授" }`,
    },
  ],
};

const removeSkillSchema: ActionSchema = {
  type: "removeSkill",
  category: "skill",
  displayName: "移除技能",
  description: "让目标角色遗忘或失去指定技能。",
  params: [
    {
      name: "target",
      type: "entityRef",
      required: true,
      description: "目标角色 ID",
    },
    {
      name: "instanceId",
      type: "string",
      required: true,
      description: "技能实例 ID，必须是角色已习得的技能",
    },
    {
      name: "reason",
      type: "string",
      required: false,
      description: "失去技能的原因，用于叙事展示",
    },
  ],
  constraints: [
    "instanceId 必须是目标角色已习得的技能实例 ID",
    "移除后技能将从角色的技能列表中完全消失",
  ],
  examples: [
    {
      scenario: "诅咒导致角色遗忘技能",
      json: `{ "type": "removeSkill", "target": "player", "instanceId": "skill_xyz789", "reason": "黑暗诅咒侵蚀了火系魔法的记忆" }`,
    },
  ],
};

// ─── 导出 ───────────────────────────────────────────────────

/**
 * Inventory 模块的全部 Action Schema
 */
export const inventoryActionSchemas: ActionSchema[] = [
  grantItemSchema,
  removeItemSchema,
  grantSkillSchema,
  removeSkillSchema,
];
