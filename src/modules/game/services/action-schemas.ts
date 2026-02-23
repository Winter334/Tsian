/**
 * Game 模块 Action Schema 声明（RuleScript v2）
 *
 * 为 Game 模块负责的 12 个 AI 可见 RuleAction 提供结构化元数据，
 * 供 Prompt 生成和 AI 输出校验使用。
 *
 * Game 模块负责的 AI 可见指令（12 个）：
 * - 判定: check, roll
 * - 数值: damage, heal, cost, set
 * - 状态: addTag, removeTag, modifyTag
 * - NPC: spawn, despawn
 * - 流程: branch
 *
 * 引擎内部指令（AI 不可见）：
 * - modifyDamage — 仅在 on_damage 触发器 actions 中使用
 *
 * 实体操作（grantItem, removeItem, grantSkill, removeSkill）属于 inventory 模块，
 * 不在此文件中定义。
 */

import type {
  ActionSchema,
  ValidationContext,
  ValidationResult,
} from "@/lib/rules/schema";

// ─── 校验辅助 ──────────────────────────────────────────────

function validateTalentIds(
  talentIds: unknown,
  context: ValidationContext,
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
        }`,
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ─── 判定类 Schema ──────────────────────────────────────────

const checkSchema: ActionSchema = {
  type: "check",
  category: "combat",
  displayName: "检定",
  description:
    "执行一次技能/属性检定，根据成败直接走 onSuccess/onFailure 分支。支持四种 DC 来源：formula（公式计算）、opposed（对抗检定）、fixed（固定值）、ai（AI 情境判定）。可使用 preset 简写引用预定义检定规则。",
  params: [
    {
      name: "name",
      type: "string",
      required: true,
      description: '检定名称（叙事用），如 "挥剑攻击"、"撬锁"、"潜行"',
    },
    {
      name: "skill",
      type: "string",
      required: false,
      description:
        '检定使用的技能/属性 ID（对应 WorldConfig 中的定义），如 "athletics"、"stealth"、"int_mod"。使用 preset 时可省略',
    },
    {
      name: "target",
      type: "entityRef",
      required: false,
      description: "执行检定的实体 ID。省略时默认为当前行动角色",
    },
    {
      name: "modifier",
      type: "value",
      required: false,
      description: "额外检定修正值（加算到掷骰结果上），可为数字或表达式",
    },
    {
      name: "dcSource",
      type: "enum",
      required: false,
      description:
        "DC 来源类型。优先级：formula > opposed > fixed > ai。省略时默认 ai",
      enumValues: ["formula", "opposed", "fixed", "ai"],
    },
    {
      name: "dc",
      type: "value",
      required: false,
      description: "dcSource=ai 时使用：AI 根据情境判定的 DC 值",
    },
    {
      name: "dcTarget",
      type: "entityRef",
      required: false,
      description: "dcSource=formula 时使用：DC 公式中引用属性的目标实体 ID",
    },
    {
      name: "dcFormula",
      type: "string",
      required: false,
      description:
        'dcSource=formula 时使用：DC 计算公式，如 "target.ac"、"8 + target.proficiency + target.wis_mod"',
    },
    {
      name: "opposedEntity",
      type: "entityRef",
      required: false,
      description: "dcSource=opposed 时使用：对抗目标的实体 ID",
    },
    {
      name: "opposedSkill",
      type: "string",
      required: false,
      description:
        'dcSource=opposed 时使用：对抗目标使用的技能/属性 ID，如 "perception"',
    },
    {
      name: "fixedDC",
      type: "number",
      required: false,
      description: "dcSource=fixed 时使用：固定 DC 值",
    },
    {
      name: "onSuccess",
      type: "actions",
      required: true,
      description:
        "检定成功时执行的 action 序列。这是 v2 核心改进，取代了 v1 的 check+conditional 两步模式",
    },
    {
      name: "onFailure",
      type: "actions",
      required: false,
      description: "检定失败时执行的 action 序列。省略表示失败时无特殊效果",
    },
    {
      name: "preset",
      type: "string",
      required: false,
      description:
        "WorldConfig.checkRules 中的预设名。引擎自动展开为 skill/dcSource/dcFormula 或 opposedSkill",
    },
    {
      name: "resultVar",
      type: "string",
      required: false,
      description:
        "存储检定结果的变量名（布尔值）。绝大多数场景不需要（用 onSuccess/onFailure 即可），仅在需要多处引用同一结果时使用",
    },
    {
      name: "reason",
      type: "string",
      required: false,
      description: "检定原因说明（叙事桥梁）",
    },
  ],
  constraints: [
    "必须提供 skill（或使用 preset 自动填充）与 onSuccess",
    "dcSource 选择：攻击目标有 AC → formula；双方对抗 → opposed；固定已知 DC → fixed；情境判断 → ai",
    "dcSource=ai 时提供 dc；dcSource=fixed 时提供 fixedDC；dcSource=formula 时提供 dcFormula+dcTarget；dcSource=opposed 时提供 opposedEntity+opposedSkill",
    "90%+ 的条件分支场景应使用 check.onSuccess/onFailure，而非 check+branch 两步模式",
  ],
  examples: [
    {
      scenario: "近战攻击，成功造成伤害，失败无事发生",
      json: `{ "type": "check", "name": "挥剑攻击", "preset": "melee_attack", "dcTarget": "哥布林", "onSuccess": [{ "type": "damage", "target": "哥布林", "amount": "1d8+str_mod", "damageType": "slashing", "reason": "长剑命中" }] }`,
    },
    {
      scenario: "撬锁检定，成功开锁，失败触发警报",
      json: `{ "type": "check", "name": "撬锁", "skill": "thievery", "dcSource": "ai", "dc": 14, "onSuccess": [{ "type": "set", "target": "door_1", "field": "locked", "value": false, "reason": "成功撬开锁" }], "onFailure": [{ "type": "addTag", "target": "player", "tag": "alarm_triggered", "displayName": "警报触发", "reason": "撬锁失败触发警报" }] }`,
    },
  ],
  validate: (action: Record<string, unknown>): ValidationResult => {
    const hasSkill =
      typeof action.skill === "string" && action.skill.trim().length > 0;
    const hasPreset =
      typeof action.preset === "string" && action.preset.trim().length > 0;

    if (!hasSkill && !hasPreset) {
      return {
        valid: false,
        errors: ["check action 必须至少提供 skill 或 preset 之一"],
      };
    }

    return { valid: true, errors: [] };
  },
};

const rollSchema: ActionSchema = {
  type: "roll",
  category: "combat",
  displayName: "掷骰",
  description:
    "执行一次独立的掷骰或表达式求值，将结果存入变量供后续使用。大部分场景不需要此指令——damage.amount 可直接写骰子表达式。仅在一次掷骰结果需要在多处引用时使用。",
  params: [
    {
      name: "expression",
      type: "string",
      required: true,
      description: '骰子表达式，如 "2d6+3"、"1d20"、"1d4+str_mod"',
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
      description: "存储掷骰结果（数值）的变量名，可在后续 action 中引用",
    },
  ],
  constraints: [
    "如果需要根据掷骰结果做分支判断，务必设置 resultVar，然后在 branch 中引用",
    "大多数伤害场景直接在 damage.amount 写骰子表达式即可，不需要先 roll 再引用",
  ],
  examples: [
    {
      scenario: "掷伤害骰并存储结果，供多个目标共用",
      json: `{ "type": "roll", "expression": "2d6+3", "purpose": "火球术伤害", "resultVar": "fireball_dmg" }`,
    },
  ],
};

// ─── 数值类 Schema ──────────────────────────────────────────

const damageSchema: ActionSchema = {
  type: "damage",
  category: "combat",
  displayName: "造成伤害",
  description:
    "对目标造成战斗伤害。会触发目标身上的 on_damage 防御链（护甲减免、伤害反射等）。与 cost 的区别：damage 触发防御链，cost 不触发。",
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
      description:
        '伤害量。支持数字、骰子表达式、属性引用，如 12、"2d6+str_mod"、"1d8+3"',
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
      description: "对应的上限字段（用于 clamp），不设置则无上限保护",
    },
    {
      name: "damageType",
      type: "string",
      required: false,
      description:
        '伤害类型标记（如 "fire"、"slashing"、"poison"），影响 on_damage 触发器过滤',
    },
    {
      name: "reason",
      type: "string",
      required: false,
      description: "伤害原因（叙事桥梁），用于 mechanicSummary 展示",
    },
  ],
  constraints: [
    "damage 会触发目标身上的 on_damage 触发器（护甲、抗性等），触发器可修改实际伤害量",
    "字段值不会低于 0",
    "战斗伤害用 damage，资源消耗用 cost",
  ],
  examples: [
    {
      scenario: "战士用剑攻击敌人，造成物理伤害",
      json: `{ "type": "damage", "target": "哥布林", "amount": "1d8+str_mod", "damageType": "slashing", "reason": "长剑攻击" }`,
    },
  ],
};

const healSchema: ActionSchema = {
  type: "heal",
  category: "attribute",
  displayName: "恢复资源",
  description:
    "恢复目标的资源值，不超过上限。常用于治疗 HP、回复 MP 等正向效果。",
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
      description: "恢复量。可以是数字或骰子/属性表达式",
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
        '上限字段。默认自动推导 "max_{field}"（如 field=hp → maxField=max_hp）',
    },
    {
      name: "reason",
      type: "string",
      required: false,
      description: "恢复原因（叙事桥梁）",
    },
  ],
  constraints: [
    "恢复后的值不会超过 maxField 对应的上限值",
    '如果不指定 maxField，默认按 "max_{field}" 规则自动推导',
    "amount 必须为正数",
  ],
  examples: [
    {
      scenario: "牧师为玩家治疗",
      json: `{ "type": "heal", "target": "player", "amount": "2d4+2", "field": "hp", "reason": "治疗术" }`,
    },
  ],
};

const costSchema: ActionSchema = {
  type: "cost",
  category: "attribute",
  displayName: "消耗资源",
  description:
    "消耗目标的资源值。与 damage 不同，cost 不触发 on_damage 防御链。适用于施法消耗 MP、饥饿值下降等非战斗场景。",
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
      description: "消耗量（正数）",
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
      description: "消耗原因（叙事桥梁）",
    },
  ],
  constraints: [
    "cost 不触发 on_damage 触发器，纯数值减少",
    "值不会低于 0",
    "战斗伤害请使用 damage，资源消耗请使用 cost",
    "amount 必须为正数",
  ],
  examples: [
    {
      scenario: "玩家施法消耗魔力",
      json: `{ "type": "cost", "target": "player", "amount": 15, "field": "mp", "reason": "施放火球术消耗魔力" }`,
    },
  ],
};

const setSchema: ActionSchema = {
  type: "set",
  category: "attribute",
  displayName: "设置属性值",
  description:
    "直接覆写目标的属性字段值。无上下限保护，慎用。大多数情况应优先使用 damage/heal/cost。",
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
      description: "目标值。可以是数字、表达式或布尔值",
    },
    {
      name: "reason",
      type: "string",
      required: false,
      description: "设置原因（叙事桥梁）",
    },
  ],
  constraints: [
    "set 直接覆盖字段值，不做上下限保护",
    "适用场景：等级提升、重置属性、特殊剧情效果",
    "不要用 set 来造成伤害或恢复资源，应使用 damage/heal/cost",
  ],
  examples: [
    {
      scenario: "角色升级，将等级设为 2",
      json: `{ "type": "set", "target": "player", "field": "level", "value": 2, "reason": "完成主线任务，等级提升" }`,
    },
  ],
};

// ─── 状态类 Schema ──────────────────────────────────────────

const addTagSchema: ActionSchema = {
  type: "addTag",
  category: "status",
  displayName: "添加状态",
  description:
    "为目标添加状态标签（buff/debuff/条件效果）。可配置 trigger 实现持续伤害、被动修正等自动化效果。对于简单叙事标记，只需 tag + displayName 即可。",
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
        "标签 ID。预定义 condition 使用其 ID（系统自动关联触发器）；自定义效果自行命名",
    },
    {
      name: "displayName",
      type: "string",
      required: false,
      description: '效果的显示名称，如 "中毒"、"石化皮肤"',
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
        "结构化触发器，定义自动化效果。不设置时标签为纯叙事标记。预定义 condition 无需重复设置",
      properties: [
        {
          name: "timing",
          type: "enum",
          required: true,
          description:
            "触发时机：turn_start=回合开始自动执行 actions；on_damage=受伤时触发（可用 modifyDamage）；passive=引擎自动叠加 modifiers 修正",
          enumValues: ["turn_start", "on_damage", "passive"],
        },
        {
          name: "actions",
          type: "actions",
          required: false,
          description:
            "触发时执行的 action 序列（timing=turn_start/on_damage 时使用）",
        },
        {
          name: "modifiers",
          type: "object",
          required: false,
          description:
            "被动修正列表（PassiveModifier[]，仅 timing=passive 使用）。应传数组：[{ scope, reason, filter?, field?, value?, multiplier? }]，scope 可选 check/damage_dealt/damage_taken/stat",
        },
        {
          name: "damageFilter",
          type: "object",
          required: false,
          description:
            "on_damage 专用：伤害类型过滤，不设置则对所有伤害类型触发",
          properties: [
            {
              name: "damageTypes",
              type: "object",
              required: true,
              description: '伤害类型数组（string[]），如 ["fire", "slashing"]',
            },
          ],
        },
        {
          name: "autoDecrement",
          type: "boolean",
          required: false,
          description: "是否在每次触发后自动递减 duration，默认 true",
        },
      ],
    },
    {
      name: "duration",
      type: "number",
      required: false,
      description: "持续回合数（正整数）。不设置则为永久效果",
    },
    {
      name: "reason",
      type: "string",
      required: false,
      description: "添加原因（叙事桥梁）",
    },
  ],
  constraints: [
    "简单叙事效果：只需 tag + displayName + effectDescription，不需要 trigger",
    "预定义 condition：直接使用其 ID，系统自动关联触发器，无需重复设置 trigger",
    "trigger.timing=passive 时使用 modifiers（被动修正），不需要 actions",
    "trigger.timing=on_damage 时 actions 中可使用 modifyDamage（引擎内部指令）",
    "duration 为正整数；不设置则为永久效果",
  ],
  examples: [
    {
      scenario: "为敌人施加中毒，每回合受毒素伤害",
      json: `{ "type": "addTag", "target": "哥布林", "tag": "poison", "displayName": "中毒", "effectDescription": "每回合受到毒素伤害", "trigger": { "timing": "turn_start", "actions": [{ "type": "damage", "target": "self", "amount": 3, "damageType": "poison", "reason": "中毒持续伤害" }] }, "duration": 3 }`,
    },
    {
      scenario: "纯叙事标记（无机制效果）",
      json: `{ "type": "addTag", "target": "player", "tag": "wanted", "displayName": "被通缉", "effectDescription": "你的画像贴满了城镇的每一面墙", "reason": "偷窃失败被目击" }`,
    },
  ],
};

const removeTagSchema: ActionSchema = {
  type: "removeTag",
  category: "status",
  displayName: "移除状态",
  description: "移除目标身上的指定状态标签，同时清除关联的所有触发器效果。",
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
      description: "移除原因（叙事桥梁）",
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
  displayName: "修改状态叠层",
  description:
    "修改目标身上已存在标签的叠加层数。用于可叠加效果（如毒素层数）的管理。",
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
      description: "操作值。set=目标层数，increment/decrement=变化量（默认 1）",
    },
    {
      name: "reason",
      type: "string",
      required: false,
      description: "修改原因（叙事桥梁）",
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

// ─── NPC 类 Schema ──────────────────────────────────────────

const spawnSchema: ActionSchema = {
  type: "spawn",
  category: "npc",
  displayName: "创建实体",
  description:
    "在场景中创建新实体（NPC/怪物/召唤物）。识别到叙事中出现新的重要角色时使用。不要为路人创建实体。",
  params: [
    {
      name: "entity",
      type: "object",
      required: true,
      description: "实体数据对象",
      properties: [
        {
          name: "name",
          type: "string",
          required: true,
          description: "实体名称，必须唯一且有意义",
        },
        {
          name: "description",
          type: "string",
          required: false,
          description: "简要描述",
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
    "entity.name 是必填项，不能为空",
    "entity.attributes 中的 key 必须与世界配置的 primaryAttributes 匹配",
    "entity.talentIds 中的每个 ID 必须在世界配置的 talents 中存在",
    "不要为路人创建实体，只为对剧情有影响的角色使用",
  ],
  examples: [
    {
      scenario: "创建一个商人 NPC",
      json: `{ "type": "spawn", "entity": { "name": "老王", "description": "一位经验丰富的武器商人", "personality": "精明但诚实", "attributes": { "str": 8, "int": 14 }, "talentIds": ["bargain_master"] } }`,
    },
  ],
  validate: (
    action: Record<string, unknown>,
    context: ValidationContext,
  ): ValidationResult => {
    const entity = action.entity as Record<string, unknown> | undefined;
    if (!entity) {
      return { valid: false, errors: ["缺少 entity 对象"] };
    }

    const errors: string[] = [];

    // 检查 name
    if (
      !entity.name ||
      typeof entity.name !== "string" ||
      entity.name.trim() === ""
    ) {
      errors.push("entity.name 不能为空");
    }

    // 检查 talentIds
    if (entity.talentIds) {
      const talentResult = validateTalentIds(entity.talentIds, context);
      errors.push(...talentResult.errors);
    }

    // 检查 attributes 的 key 是否合法
    if (entity.attributes && typeof entity.attributes === "object") {
      const validAttrKeys = new Set(
        context.worldConfig.primaryAttributes.map((a) => a.key),
      );
      for (const key of Object.keys(
        entity.attributes as Record<string, unknown>,
      )) {
        if (!validAttrKeys.has(key)) {
          errors.push(
            `属性 key "${key}" 不在世界配置的 primaryAttributes 中。可用 key: ${[
              ...validAttrKeys,
            ].join(", ")}`,
          );
        }
      }
    }

    return { valid: errors.length === 0, errors };
  },
};

const despawnSchema: ActionSchema = {
  type: "despawn",
  category: "npc",
  displayName: "移除实体",
  description:
    "将实体从场景中移除。temporary=暂时离场（可通过 spawn 回归），permanent=永久归档。",
  params: [
    {
      name: "entityId",
      type: "entityRef",
      required: true,
      description: "目标实体 ID",
    },
    {
      name: "mode",
      type: "enum",
      required: true,
      description: "移除模式",
      enumValues: ["temporary", "permanent"],
    },
    {
      name: "reason",
      type: "string",
      required: false,
      description: "移除原因（叙事桥梁）",
    },
  ],
  constraints: [
    "temporary: 暂时离场，可在后续通过 spawn 重新出现",
    "permanent: 永久归档，不再参与当前游戏",
  ],
  examples: [
    {
      scenario: "商人交易结束后暂时离场",
      json: `{ "type": "despawn", "entityId": "老王", "mode": "temporary", "reason": "交易结束离场" }`,
    },
  ],
};

// ─── 流程类 Schema ──────────────────────────────────────────

const branchSchema: ActionSchema = {
  type: "branch",
  category: "flow",
  displayName: "条件分支",
  description:
    "根据条件表达式选择执行不同的 action 序列。这是低频指令——90%+ 的条件分支场景应使用 check.onSuccess/onFailure。branch 仅用于不涉及掷骰判定的条件分支（如检查 HP 阈值、是否拥有标签等）。",
  params: [
    {
      name: "condition",
      type: "string",
      required: true,
      description:
        "条件表达式（ConditionExpression）。支持：属性引用（player.hp < 10）、变量引用（attack_result）、谓词（hasTag(player, 'poisoned')、hasItem(player, 'iron_sword')）、逻辑运算（&& || !）",
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
    "不要用 branch 做检定后分支——应使用 check.onSuccess/onFailure",
    "condition 支持引用 check/roll 存储的 resultVar 变量",
    "condition 支持 hasTag(entity, 'tagId') 和 hasItem(entity, 'itemName') 谓词",
    "嵌套深度不能超过 10 层",
  ],
  examples: [
    {
      scenario: "生命垂危时激发求生本能",
      json: `{ "type": "branch", "condition": "player.hp < 10", "then": [{ "type": "addTag", "target": "player", "tag": "desperate", "displayName": "绝境", "reason": "生命垂危，激发求生本能" }] }`,
    },
  ],
};

// ─── 引擎内部 Schema（AI 不可见） ────────────────────────────

/**
 * modifyDamage — 引擎内部指令
 *
 * 仅在 addTag.trigger.timing="on_damage" 的 actions 中使用，
 * 不暴露给 Parser AI。保留 schema 定义供校验器使用。
 */
export const modifyDamageSchema: ActionSchema = {
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

// ─── 导出 ───────────────────────────────────────────────────

/**
 * Game 模块的全部 AI 可见 Action Schema（12 个）
 *
 * 不包含 modifyDamage（引擎内部）和 inventory 模块的 4 个指令。
 * modifyDamageSchema 单独导出供引擎注册使用。
 */
export const gameActionSchemas: ActionSchema[] = [
  // 判定
  checkSchema,
  rollSchema,
  // 数值
  damageSchema,
  healSchema,
  costSchema,
  setSchema,
  // 状态
  addTagSchema,
  removeTagSchema,
  modifyTagSchema,
  // NPC
  spawnSchema,
  despawnSchema,
  // 流程
  branchSchema,
];
