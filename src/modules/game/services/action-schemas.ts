/**
 * Game 模块 Action Schema 声明
 *
 * 为 IRNR 引擎的 15 个 RuleAction 提供结构化元数据，
 * 供 Prompt 生成和 AI 输出校验使用。
 */

import type {
  ActionSchema,
  ValidationContext,
  ValidationResult,
} from "@/lib/rules/schema";

// ─── 校验辅助 ──────────────────────────────────────────────

function validateTalentIds(
  talentIds: unknown,
  context: ValidationContext
): ValidationResult {
  if (!Array.isArray(talentIds)) {
    return { valid: true, errors: [] };
  }

  const errors: string[] = [];
  const availableTalents = context.worldConfig.talents ?? [];
  const validIds = new Set(availableTalents.map((t) => t.id));

  for (const id of talentIds) {
    if (typeof id === "string" && !validIds.has(id)) {
      errors.push(
        `天赋 ID "${id}" 不存在于世界配置中。可用天赋: ${
          [...validIds].join(", ") || "(无)"
        }`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ─── Schema 定义 ────────────────────────────────────────────

const checkSchema: ActionSchema = {
  type: "check",
  category: "combat",
  displayName: "检定",
  description:
    "执行一次能力检定（技能/属性/豁免/攻击/对抗），根据 DC 判定成败并存储结果。",
  params: [
    {
      name: "checkType",
      type: "enum",
      required: true,
      description: "检定类型",
      enumValues: ["ability", "skill", "save", "attack", "contest"],
    },
    {
      name: "name",
      type: "string",
      required: true,
      description: '检定名称，如 "力量检定" 或 "潜行"',
    },
    {
      name: "modifier",
      type: "value",
      required: true,
      description: '检定修正值。可以是数字（如 3）或属性表达式（如 "str_mod"）',
    },
    {
      name: "dc",
      type: "value",
      required: true,
      description:
        '难度等级。可以是数字（如 15）或表达式（如 "10 + target.agi_mod"）',
    },
    {
      name: "target",
      type: "entityRef",
      required: false,
      description: "受检实体 ID。省略时默认为当前行动角色",
    },
    {
      name: "resultVar",
      type: "string",
      required: false,
      description:
        "存储检定结果的变量名。后续可在 conditional 中通过此变量判断成败",
    },
  ],
  constraints: [
    "modifier 和 dc 支持属性表达式，引擎会自动从实体属性中解析",
    "resultVar 存储的值为布尔类型（true=成功，false=失败），用于 conditional 判断",
  ],
  examples: [
    {
      scenario: "玩家尝试撬锁，需要敏捷检定",
      json: `{ "type": "check", "checkType": "skill", "name": "撬锁", "modifier": "agi_mod", "dc": 14, "resultVar": "lockpick_result" }`,
    },
  ],
};

const damageSchema: ActionSchema = {
  type: "damage",
  category: "combat",
  displayName: "造成伤害",
  description:
    "对目标造成伤害，减少指定资源字段的值。支持伤害类型标记和触发器联动。",
  params: [
    {
      name: "target",
      type: "entityRef",
      required: true,
      description: "受伤实体 ID",
    },
    {
      name: "amount",
      type: "value",
      required: true,
      description: '伤害量。可以是数字或表达式（如 "2d6 + str_mod"）',
    },
    {
      name: "field",
      type: "field",
      required: false,
      description: "受影响的资源字段",
      defaultValue: "hp",
    },
    {
      name: "maxField",
      type: "field",
      required: false,
      description: "对应的上限字段，不设置则无下限/上限保护",
    },
    {
      name: "damageType",
      type: "string",
      required: false,
      description:
        '伤害类型标记（如 "fire"、"slashing"），影响 on_damage 触发器过滤',
    },
    {
      name: "reason",
      type: "string",
      required: false,
      description: "伤害原因说明，用于 mechanicSummary 展示",
    },
  ],
  constraints: [
    "damage 会触发目标身上的 on_damage 触发器，触发器可修改实际伤害量",
    "字段值不会低于 0",
    'amount 支持骰子表达式（如 "2d6+3"）和属性表达式（如 "str_mod"）',
  ],
  examples: [
    {
      scenario: "战士用剑攻击敌人，造成物理伤害",
      json: `{ "type": "damage", "target": "哥布林", "amount": "1d8+str_mod", "damageType": "slashing", "reason": "长剑攻击" }`,
    },
  ],
};

const gainSchema: ActionSchema = {
  type: "gain",
  category: "attribute",
  displayName: "恢复/增加",
  description:
    "恢复或增加目标的资源值，不超过上限字段的值。常用于治疗、回蓝等正向效果。",
  params: [
    {
      name: "target",
      type: "entityRef",
      required: true,
      description: "目标实体 ID",
    },
    {
      name: "amount",
      type: "value",
      required: true,
      description: "增加量。可以是数字或表达式",
    },
    {
      name: "field",
      type: "field",
      required: false,
      description: "受影响的资源字段",
      defaultValue: "hp",
    },
    {
      name: "maxField",
      type: "field",
      required: false,
      description:
        '上限字段。默认为 "max_{field}" 自动推导（如 field=hp → maxField=max_hp）',
    },
    {
      name: "reason",
      type: "string",
      required: false,
      description: "原因说明",
    },
  ],
  constraints: [
    "增加后的值不会超过 maxField 对应的上限值",
    '如果不指定 maxField，默认按 "max_{field}" 规则自动推导',
    "amount 必须为正数",
  ],
  examples: [
    {
      scenario: "牧师为玩家治疗",
      json: `{ "type": "gain", "target": "player", "amount": "2d4+2", "field": "hp", "reason": "治疗术" }`,
    },
  ],
};

const loseSchema: ActionSchema = {
  type: "lose",
  category: "attribute",
  displayName: "消耗/减少",
  description:
    "消耗或减少目标的资源值。与 damage 不同，lose 不会触发 on_damage 触发器，适用于消耗 MP、饥饿值下降等非战斗场景。",
  params: [
    {
      name: "target",
      type: "entityRef",
      required: true,
      description: "目标实体 ID",
    },
    {
      name: "amount",
      type: "value",
      required: true,
      description: "减少量",
    },
    {
      name: "field",
      type: "field",
      required: false,
      description: "受影响的资源字段",
      defaultValue: "hp",
    },
    {
      name: "reason",
      type: "string",
      required: false,
      description: "原因说明",
    },
  ],
  constraints: [
    "lose 不会触发 on_damage 触发器，纯数值减少",
    "值不会低于 0",
    "战斗伤害请使用 damage，资源消耗请使用 lose",
    "amount 必须为正数",
  ],
  examples: [
    {
      scenario: "玩家施法消耗魔力",
      json: `{ "type": "lose", "target": "player", "amount": 15, "field": "mp", "reason": "施放火球术消耗魔力" }`,
    },
  ],
};

const rollSchema: ActionSchema = {
  type: "roll",
  category: "combat",
  displayName: "掷骰",
  description: "执行一次独立的掷骰操作，将结果存入变量供后续使用。",
  params: [
    {
      name: "expression",
      type: "string",
      required: true,
      description: '骰子表达式，如 "2d6+3"、"1d20"、"3d8-2"',
    },
    {
      name: "purpose",
      type: "string",
      required: false,
      description: "掷骰用途说明，显示在 mechanicSummary 中",
    },
    {
      name: "resultVar",
      type: "string",
      required: false,
      description: "存储掷骰结果（数值）的变量名",
    },
  ],
  constraints: [
    "如果需要根据掷骰结果做分支判断，务必设置 resultVar，然后在 conditional 中引用",
  ],
  examples: [
    {
      scenario: "掷伤害骰并存储结果",
      json: `{ "type": "roll", "expression": "2d6+3", "purpose": "火球术伤害", "resultVar": "fireball_dmg" }`,
    },
  ],
};

const addTagSchema: ActionSchema = {
  type: "addTag",
  category: "status",
  displayName: "添加标签",
  description:
    "为目标添加状态标签（buff/debuff/条件效果）。可配置触发器实现自动化效果。",
  params: [
    {
      name: "target",
      type: "entityRef",
      required: true,
      description: "目标实体 ID",
    },
    {
      name: "tag",
      type: "string",
      required: true,
      description:
        "标签 ID。如果是世界配置中预定义的 condition，使用其 ID；否则自定义命名",
    },
    {
      name: "displayName",
      type: "string",
      required: false,
      description: '效果的显示名称，如 "灼烧"',
    },
    {
      name: "effectDescription",
      type: "string",
      required: false,
      description: "效果描述，AI 和系统共用",
    },
    {
      name: "trigger",
      type: "object",
      required: false,
      description:
        "结构化触发器，定义自动效果。包含 timing、actions、modifiers 等",
      properties: [
        {
          name: "timing",
          type: "enum",
          required: true,
          description: "触发时机",
          enumValues: ["turn_start", "on_damage", "passive"],
        },
        {
          name: "actions",
          type: "actions",
          required: true,
          description: "触发时执行的 action 序列",
        },
      ],
    },
    {
      name: "duration",
      type: "number",
      required: false,
      description: "持续回合数。不设置则为永久效果",
    },
    {
      name: "reason",
      type: "string",
      required: false,
      description: "添加原因",
    },
  ],
  constraints: [
    "对于简单的叙事性效果，只需 tag + displayName + effectDescription，不需要 trigger",
    "trigger.timing=passive 时，效果由引擎自动叠加修正，不需要设置 actions",
    "如果世界配置中已预定义了该 condition，直接使用其 ID 即可，无需重复设置 trigger",
    "duration 为正整数，表示回合数；不设置则为永久效果",
  ],
  examples: [
    {
      scenario: "为敌人施加中毒状态，每回合受伤",
      json: `{ "type": "addTag", "target": "哥布林", "tag": "poison", "displayName": "中毒", "effectDescription": "每回合开始时受到毒素伤害", "trigger": { "timing": "turn_start", "actions": [{ "type": "damage", "target": "self", "amount": 3, "damageType": "poison", "reason": "中毒持续伤害" }] }, "duration": 3 }`,
    },
  ],
};

const removeTagSchema: ActionSchema = {
  type: "removeTag",
  category: "status",
  displayName: "移除标签",
  description: "移除目标身上的指定状态标签。",
  params: [
    {
      name: "target",
      type: "entityRef",
      required: true,
      description: "目标实体 ID",
    },
    {
      name: "tag",
      type: "string",
      required: true,
      description: "要移除的标签 ID",
    },
    {
      name: "reason",
      type: "string",
      required: false,
      description: "移除原因",
    },
  ],
  constraints: [
    "tag 必须是目标当前拥有的标签 ID，否则操作无效",
    "移除标签会同时清除该标签关联的所有触发器效果",
  ],
  examples: [
    {
      scenario: "治愈术解除玩家的中毒状态",
      json: `{ "type": "removeTag", "target": "player", "tag": "poison", "reason": "治愈术净化毒素" }`,
    },
  ],
};

const modifyTagSchema: ActionSchema = {
  type: "modifyTag",
  category: "status",
  displayName: "修改标签",
  description:
    "修改目标身上已存在标签的叠加层数。可用于 set/increment/decrement 操作。",
  params: [
    {
      name: "target",
      type: "entityRef",
      required: true,
      description: "目标实体 ID",
    },
    {
      name: "tag",
      type: "string",
      required: true,
      description: "要修改的标签 ID",
    },
    {
      name: "operation",
      type: "enum",
      required: true,
      description: "操作类型",
      enumValues: ["set", "increment", "decrement"],
    },
    {
      name: "value",
      type: "value",
      required: false,
      description: "操作值。set 时为目标值，increment/decrement 时为变化量",
    },
    {
      name: "reason",
      type: "string",
      required: false,
      description: "修改原因",
    },
  ],
  constraints: [
    "目标必须已经拥有该标签，否则操作无效",
    "常用于可叠加效果（如毒素叠层）的层数管理",
    "set 操作的 value 为目标层数；increment/decrement 的 value 默认为 1",
  ],
  examples: [
    {
      scenario: "毒蛇再次命中，增加中毒层数",
      json: `{ "type": "modifyTag", "target": "player", "tag": "poison", "operation": "increment", "value": 1, "reason": "毒蛇咬伤叠加毒素" }`,
    },
  ],
};

const setValueSchema: ActionSchema = {
  type: "setValue",
  category: "attribute",
  displayName: "设置属性值",
  description:
    "直接设置目标的某个属性字段为指定值。这是一个强力操作，请谨慎使用。",
  params: [
    {
      name: "target",
      type: "entityRef",
      required: true,
      description: "目标实体 ID",
    },
    {
      name: "field",
      type: "field",
      required: true,
      description: '要设置的属性字段名（如 "hp"、"level"）',
    },
    {
      name: "value",
      type: "value",
      required: true,
      description: "目标值。可以是数字或表达式",
    },
    {
      name: "reason",
      type: "string",
      required: false,
      description: "设置原因",
    },
  ],
  constraints: [
    "setValue 直接覆盖字段值，不做上下限保护。大多数情况下应优先使用 gain/lose/damage",
    "适用场景：等级提升、重置属性、特殊剧情效果",
    "不要用 setValue 来造成伤害或恢复资源，应使用 damage/gain/lose",
  ],
  examples: [
    {
      scenario: "角色升级，将等级设为 2",
      json: `{ "type": "setValue", "target": "player_1", "field": "level", "value": 2, "reason": "完成主线任务，等级提升" }`,
    },
  ],
};

const conditionalSchema: ActionSchema = {
  type: "conditional",
  category: "flow",
  displayName: "条件分支",
  description:
    "根据条件表达式选择执行不同的 action 序列。常与 check 的 resultVar 配合使用，实现「检定成功→效果A，失败→效果B」的分支逻辑。",
  params: [
    {
      name: "condition",
      type: "string",
      required: true,
      description:
        "条件表达式。可引用 resultVar 变量、实体属性。返回 truthy 值时执行 then 分支",
    },
    {
      name: "then",
      type: "actions",
      required: true,
      description: "条件为真时执行的 action 序列",
    },
    {
      name: "else",
      type: "actions",
      required: false,
      description: "条件为假时执行的 action 序列",
    },
  ],
  constraints: [
    "condition 支持引用之前 check/roll 存储的 resultVar 变量",
    "嵌套深度不能超过 10 层",
  ],
  examples: [
    {
      scenario: "根据检定结果决定是否命中",
      json: `{ "type": "conditional", "condition": "attack_result", "then": [{ "type": "damage", "target": "enemy_1", "amount": "2d6+str_mod" }], "else": [{ "type": "roll", "expression": "0", "purpose": "攻击未命中" }] }`,
    },
  ],
};

const sequenceSchema: ActionSchema = {
  type: "sequence",
  category: "flow",
  displayName: "顺序执行",
  description:
    "按顺序执行一组 action。用于将多个操作组织为一个逻辑单元，常在 conditional 分支或 addTag 触发器中使用。",
  params: [
    {
      name: "steps",
      type: "actions",
      required: true,
      description: "按顺序执行的 action 列表",
    },
  ],
  constraints: [
    "通常不需要在顶层使用 sequence，因为 RuleScript.actions 本身就是顺序执行的",
    "主要用途：在 conditional 的 then/else 中组织多步操作，或在 trigger.actions 中使用",
    "steps 数组不能为空，至少包含一个 action",
  ],
  examples: [
    {
      scenario: "在条件分支中组合多步效果：先掷骰再造成伤害",
      json: `{ "type": "sequence", "steps": [{ "type": "roll", "expression": "2d6", "purpose": "火焰伤害", "resultVar": "fire_dmg" }, { "type": "damage", "target": "哥布林", "amount": "fire_dmg", "damageType": "fire", "reason": "火球术爆炸" }] }`,
    },
  ],
};

const modifyDamageSchema: ActionSchema = {
  type: "modifyDamage",
  category: "combat",
  displayName: "修改伤害",
  description:
    "修改即将造成的伤害量。只能在 on_damage 触发器的 actions 中使用，不应由 Parser AI 直接输出。",
  params: [
    {
      name: "multiplier",
      type: "value",
      required: false,
      description: "伤害乘数。0.5=减半，0=免疫，2=双倍",
    },
    {
      name: "reduction",
      type: "value",
      required: false,
      description: "固定伤害减免值。3=减少 3 点伤害",
    },
    {
      name: "reason",
      type: "string",
      required: false,
      description: "修改原因",
    },
  ],
  constraints: [
    '⚠️ 仅用于 addTag 中 trigger.timing="on_damage" 的 actions 内',
    "Parser AI 不应在 RuleScript 顶层直接使用此 action",
    "multiplier 和 reduction 至少提供一个",
    "先乘后减：最终伤害 = 原始伤害 × multiplier - reduction",
  ],
};

const npcCreateSchema: ActionSchema = {
  type: "npcCreate",
  category: "npc",
  displayName: "创建 NPC",
  description:
    "在场景中创建一个新的 NPC 角色。Parser AI 识别到叙事中出现新角色时使用此操作。",
  params: [
    {
      name: "npc",
      type: "object",
      required: true,
      description: "NPC 数据对象",
      properties: [
        {
          name: "name",
          type: "string",
          required: true,
          description: "NPC 名称，必须唯一且有意义",
        },
        {
          name: "description",
          type: "string",
          required: false,
          description: "NPC 简要描述",
        },
        {
          name: "personality",
          type: "string",
          required: false,
          description: "性格特征描述",
        },
        {
          name: "appearance",
          type: "string",
          required: false,
          description: "外貌描述",
        },
        {
          name: "attributes",
          type: "object",
          required: false,
          description:
            "属性值对象。key 必须是世界配置中定义的属性 key（如 str, agi, int）",
        },
        {
          name: "talentIds",
          type: "talentRef",
          required: false,
          description: "天赋 ID 列表。必须是世界配置 talents 中已定义的 ID",
        },
      ],
    },
  ],
  constraints: [
    "npc.name 是必填项，不能为空",
    "npc.attributes 中的 key 必须与世界配置的 primaryAttributes 匹配",
    "npc.talentIds 中的每个 ID 必须在世界配置的 talents 中存在",
    "不要为路人创建 NPC，只为对剧情有影响的角色使用",
  ],
  examples: [
    {
      scenario: "创建一个商人 NPC",
      json: `{ "type": "npcCreate", "npc": { "name": "老王", "description": "一位经验丰富的武器商人", "personality": "精明但诚实", "attributes": { "str": 8, "int": 14 }, "talentIds": ["bargain_master"] } }`,
    },
  ],
  validate: (
    action: Record<string, unknown>,
    context: ValidationContext
  ): ValidationResult => {
    const npc = action.npc as Record<string, unknown> | undefined;
    if (!npc) {
      return { valid: false, errors: ["缺少 npc 对象"] };
    }

    const errors: string[] = [];

    // 检查 name
    if (!npc.name || typeof npc.name !== "string" || npc.name.trim() === "") {
      errors.push("npc.name 不能为空");
    }

    // 检查 talentIds
    if (npc.talentIds) {
      const talentResult = validateTalentIds(npc.talentIds, context);
      errors.push(...talentResult.errors);
    }

    // 检查 attributes 的 key 是否合法
    if (npc.attributes && typeof npc.attributes === "object") {
      const validAttrKeys = new Set(
        context.worldConfig.primaryAttributes.map((a) => a.key)
      );
      for (const key of Object.keys(
        npc.attributes as Record<string, unknown>
      )) {
        if (!validAttrKeys.has(key)) {
          errors.push(
            `属性 key "${key}" 不在世界配置的 primaryAttributes 中。可用 key: ${[
              ...validAttrKeys,
            ].join(", ")}`
          );
        }
      }
    }

    return { valid: errors.length === 0, errors };
  },
};

const npcStatusChangeSchema: ActionSchema = {
  type: "npcStatusChange",
  category: "npc",
  displayName: "NPC 状态变更",
  description: "变更 NPC 的场景状态。用于让 NPC 离场、重新出现或归档。",
  params: [
    {
      name: "npcId",
      type: "entityRef",
      required: true,
      description: "NPC 的实体 ID",
    },
    {
      name: "status",
      type: "enum",
      required: true,
      description: "目标状态",
      enumValues: ["active", "off_scene", "archived"],
    },
  ],
  constraints: [
    "active: NPC 在当前场景中活跃",
    "off_scene: NPC 暂时离场，仍可在后续剧情中重新出现",
    "archived: NPC 永久退出，不再参与游戏",
    "只有已存在的 NPC 才能变更状态，不要对未创建的 NPC 使用",
  ],
  examples: [
    {
      scenario: "商人交易结束后离开场景",
      json: `{ "type": "npcStatusChange", "npcId": "老王", "status": "off_scene" }`,
    },
  ],
};

const npcActionSchema: ActionSchema = {
  type: "npcAction",
  category: "npc",
  displayName: "NPC 行动",
  description: "让 NPC 执行一个主动行动。可包含检定需求和直接效果。",
  params: [
    {
      name: "npcId",
      type: "entityRef",
      required: true,
      description: "执行行动的 NPC 实体 ID",
    },
    {
      name: "intention",
      type: "string",
      required: true,
      description: 'NPC 的行动意图描述，如 "向玩家发起攻击" 或 "尝试逃跑"',
    },
    {
      name: "requiresCheck",
      type: "object",
      required: false,
      description: "如果行动需要检定，提供检定参数",
      properties: [
        {
          name: "checkType",
          type: "enum",
          required: true,
          description: "检定类型",
          enumValues: ["attack", "skill", "ability"],
        },
        {
          name: "attribute",
          type: "string",
          required: true,
          description: '用于检定的属性名（如 "str"、"agi"）',
        },
        {
          name: "dc",
          type: "number",
          required: false,
          description: "难度等级",
        },
        {
          name: "targetId",
          type: "entityRef",
          required: false,
          description: "检定目标实体 ID",
        },
      ],
    },
    {
      name: "directEffects",
      type: "actions",
      required: false,
      description: "不需要检定时的直接效果，作为 RuleAction 子序列",
    },
  ],
  constraints: [
    "requiresCheck 和 directEffects 通常二选一：有检定则由引擎决定结果，无检定则直接执行效果",
    "intention 是必填的文字描述，用于叙事展示",
    "npcId 必须是场景中已存在且 active 的 NPC",
  ],
  examples: [
    {
      scenario: "强盗尝试攻击玩家",
      json: `{ "type": "npcAction", "npcId": "强盗头目", "intention": "挥刀砍向冒险者", "requiresCheck": { "checkType": "attack", "attribute": "str", "dc": 13, "targetId": "player" } }`,
    },
  ],
};

// ─── 导出 ───────────────────────────────────────────────────

/**
 * Game 模块的全部 Action Schema
 */
export const gameActionSchemas: ActionSchema[] = [
  checkSchema,
  damageSchema,
  gainSchema,
  loseSchema,
  rollSchema,
  addTagSchema,
  removeTagSchema,
  modifyTagSchema,
  setValueSchema,
  conditionalSchema,
  sequenceSchema,
  modifyDamageSchema,
  npcCreateSchema,
  npcStatusChangeSchema,
  npcActionSchema,
];
