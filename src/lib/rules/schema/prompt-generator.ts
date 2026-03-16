/**
 * Prompt Generator — 从 ActionSchema Registry 自动生成操作说明文本
 *
 * 替换原先手写的 buildOperationDefinitions() 函数，
 * 从已注册的 Schema 自动生成结构化的操作说明供 Parser AI 使用。
 */

import type { ItemCategory } from "@/domain/entities/item";
import type { EquipSlotDefinition, WorldConfig } from "@/lib/world/types";

import { actionSchemaRegistry } from "./registry";
import type { ActionCategory, ActionParamSchema, ActionSchema } from "./types";

// ─── 接口定义 ─────────────────────────────────────────────

/**
 * 在场实体的简要信息（用于 prompt 展示）
 *
 * 使用通用接口而非直接依赖 modules/game 的 EntityData，
 * 保持 lib 层不引用 modules 层的架构规范。
 */
export interface EntityInfo {
  id: string;
  name?: string;
  level?: number | string;
  status?: string;
  controlType?: string;
}

export interface PromptGeneratorOptions {
  worldConfig: WorldConfig;
  /** 在场实体列表（用于展示在场 NPC） */
  entities?: EntityInfo[];
  /** 要排除的 action type（如 modifyDamage 不展示给 Parser AI） */
  excludeTypes?: string[];
}

// ─── 分类显示名映射 ────────────────────────────────────────

const CATEGORY_LABELS: Record<ActionCategory, string> = {
  combat: "战斗操作",
  attribute: "属性操作",
  status: "状态标签操作",
  npc: "NPC 操作",
  flow: "流程控制",
  inventory: "物品操作",
  movement: "移动操作",
  skill: "技能操作",
};

/** 分类输出排序 */
const CATEGORY_ORDER: ActionCategory[] = [
  "combat",
  "attribute",
  "status",
  "npc",
  "flow",
  "inventory",
  "movement",
  "skill",
];

// ─── 参数格式化 ──────────────────────────────────────────

function formatParamType(param: ActionParamSchema): string {
  switch (param.type) {
    case "enum":
      return param.enumValues ? param.enumValues.join("/") : "enum";
    case "entityRef":
      return "实体ID";
    case "field":
      return "属性字段";
    case "value":
      return "数值/表达式";
    case "actions":
      return "RuleAction[]";
    case "object":
      return "object";
    default:
      return param.type;
  }
}

function formatParam(param: ActionParamSchema, indent: string = "  "): string {
  const requiredMark = param.required ? "(必需)" : "(可选)";
  const typePart = formatParamType(param);
  const defaultPart =
    param.defaultValue !== undefined ? `, 默认="${param.defaultValue}"` : "";
  let line = `${indent}- ${param.name} ${requiredMark}: ${param.description} [${typePart}${defaultPart}]`;

  // 嵌套 object 属性
  if (
    param.type === "object" &&
    param.properties &&
    param.properties.length > 0
  ) {
    for (const sub of param.properties) {
      line += "\n" + formatParam(sub, indent + "  ");
    }
  }

  return line;
}

// ─── Schema → 文本块 ────────────────────────────────────────

function renderSchema(schema: ActionSchema): string {
  const lines: string[] = [];

  // 标题行：type - displayName
  lines.push(`#### ${schema.type} - ${schema.displayName}`);
  lines.push(schema.description);

  // 参数列表
  if (schema.params.length > 0) {
    lines.push("参数：");
    for (const param of schema.params) {
      lines.push(formatParam(param));
    }
  }

  // 约束条件
  if (schema.constraints && schema.constraints.length > 0) {
    lines.push("注意：");
    for (const c of schema.constraints) {
      lines.push(`  · ${c}`);
    }
  }

  // 示例（最多 1 个）
  if (schema.examples && schema.examples.length > 0) {
    const ex = schema.examples[0];
    lines.push(`示例 - ${ex.scenario}：`);
    lines.push(ex.json);
  }

  return lines.join("\n");
}

// ─── 动态信息区块 ────────────────────────────────────────

function formatAllowedCategories(
  allowedCategories?: readonly ItemCategory[],
): string {
  if (!allowedCategories || allowedCategories.length === 0) {
    return "全部类别";
  }

  return allowedCategories.join("/");
}

function renderEquipSlotDefinition(slot: EquipSlotDefinition): string {
  const label = slot.label.trim() || slot.id;
  const maxCount = slot.maxCount ?? 1;

  return `- ${slot.id}（显示名：${label}，允许类别：${formatAllowedCategories(
    slot.allowedCategories,
  )}，槽位上限：${maxCount}）`;
}

function renderWorldInfo(
  worldConfig: WorldConfig,
  entities?: EntityInfo[],
): string {
  const lines: string[] = [];

  // 主属性列表
  lines.push("### 可用属性字段");
  const attrParts: string[] = [];
  for (const attr of worldConfig.primaryAttributes) {
    attrParts.push(`${attr.key}(${attr.label})`);
  }
  lines.push(attrParts.join(", "));

  // 衍生属性（简要列出 key:label）
  if (worldConfig.derivedStats.length > 0) {
    const derivedParts: string[] = [];
    for (const ds of worldConfig.derivedStats) {
      derivedParts.push(`${ds.key}(${ds.label})`);
    }
    lines.push("衍生属性: " + derivedParts.join(", "));
  }

  lines.push(
    '⚠️ 重要：当使用 scope="stat" 的 modifier 时，field 只能使用上方主属性 + 衍生属性中列出的 key；未在上方列出的 key 不可用。',
  );

  // 装备槽位定义
  const equipSlotDefinitions = worldConfig.inventoryRules?.equipSlotDefinitions;
  if (equipSlotDefinitions && equipSlotDefinitions.length > 0) {
    lines.push("");
    lines.push("### 当前世界装备槽位");
    lines.push("涉及 equipSlot / slot 时，只能使用以下真实槽位 ID：");
    for (const slot of equipSlotDefinitions) {
      lines.push(renderEquipSlotDefinition(slot));
    }
  }

  // 预定义状态
  if (worldConfig.conditions && worldConfig.conditions.length > 0) {
    lines.push("");
    lines.push("### 预定义状态");
    lines.push("使用对应 id 即可，系统会自动关联描述和触发器：");
    for (const cond of worldConfig.conditions) {
      const triggerInfo = cond.trigger
        ? ` [系统管理: ${cond.trigger.timing}]`
        : " [AI 管理]";
      lines.push(
        `- ${cond.id} (${cond.name})${triggerInfo}${
          cond.description ? `: ${cond.description}` : ""
        }`,
      );
    }
  }

  // 在场 NPC 列表
  if (entities && entities.length > 0) {
    const npcEntities = entities.filter(
      (e) =>
        e.controlType === "npc" &&
        e.status !== "archived" &&
        e.status !== "dead",
    );
    if (npcEntities.length > 0) {
      lines.push("");
      lines.push("### 在场 NPC");
      for (const npc of npcEntities) {
        const name = npc.name ?? npc.id;
        const level = npc.level ?? "?";
        const status = npc.status ?? "active";
        lines.push(`- ${npc.id}: ${name} (Lv.${level}, ${status})`);
      }
    }
  }

  return lines.join("\n");
}

// ─── WorldConfig.checkRules 信息区块 ─────────────────────

function renderCheckRuleInfo(worldConfig: WorldConfig): string {
  const lines: string[] = [];
  const checkRules = worldConfig.checkRules;

  if (!checkRules) {
    return "";
  }

  const dcPresets = Object.entries(checkRules.dcPresets ?? {});
  if (dcPresets.length > 0) {
    lines.push("### check.preset 可用值（DC 公式预设）");
    lines.push(
      '使用 preset 时，引擎会自动展开为 skill + dcSource="formula" + dcFormula（可被显式字段覆盖）。',
    );
    for (const [presetName, preset] of dcPresets) {
      const skillPart = preset.defaultSkill
        ? `, defaultSkill=${preset.defaultSkill}`
        : "";
      lines.push(
        `- ${presetName} (${preset.label}): formula=${preset.formula}${skillPart}`,
      );
    }
  }

  const opposedPresets = Object.entries(checkRules.opposedPresets ?? {});
  if (opposedPresets.length > 0) {
    if (lines.length > 0) {
      lines.push("");
    }
    lines.push("### check.preset 可用值（对抗检定预设）");
    lines.push(
      "使用 preset + opposedEntity 时，引擎会自动展开为 skill + dcSource=opposed + opposedSkill。",
    );
    for (const [presetName, preset] of opposedPresets) {
      lines.push(
        `- ${presetName} (${preset.label}): attackerSkill=${preset.attackerSkill}, defenderSkill=${preset.defenderSkill}`,
      );
    }
  }

  const guidelineScale = checkRules.dcGuideline?.scale ?? [];
  if (guidelineScale.length > 0) {
    if (lines.length > 0) {
      lines.push("");
    }
    lines.push("### AI 情境 DC 参考（dcSource=ai）");
    lines.push("| 难度 | DC | 说明 |");
    lines.push("| --- | ---: | --- |");
    for (const item of guidelineScale) {
      lines.push(`| ${item.label} | ${item.dc} | ${item.description} |`);
    }
  }

  return lines.join("\n");
}

// ─── 主函数 ──────────────────────────────────────────────

/**
 * 从 ActionSchema Registry 自动生成操作定义文本
 *
 * 读取所有已注册 Schema，按分类分组输出，附加世界配置中的
 * 属性、天赋、状态等动态信息。
 *
 * @returns 纯文本字符串，供 Parser AI 的 prompt 使用
 */
export function generateOperationDefinitions(
  options: PromptGeneratorOptions,
): string {
  const { worldConfig, entities, excludeTypes = ["modifyDamage"] } = options;

  const excludeSet = new Set(excludeTypes);
  const grouped = actionSchemaRegistry.getSchemasByCategory();
  const sections: string[] = [];

  sections.push("## 可用操作");

  // 按预定义顺序遍历分类
  for (const category of CATEGORY_ORDER) {
    const schemas = grouped.get(category);
    if (!schemas || schemas.length === 0) continue;

    // 过滤排除的 type
    const filtered = schemas.filter((s) => !excludeSet.has(s.type));
    if (filtered.length === 0) continue;

    const label = CATEGORY_LABELS[category] ?? category;
    sections.push(`### ${label}`);

    for (const schema of filtered) {
      sections.push(renderSchema(schema));
      sections.push("---");
    }
  }

  // 动态信息区块
  sections.push(renderWorldInfo(worldConfig, entities));

  // WorldConfig.checkRules 区块（检定预设 + AI DC 参考）
  const checkRuleInfo = renderCheckRuleInfo(worldConfig);
  if (checkRuleInfo.length > 0) {
    sections.push(checkRuleInfo);
  }

  return sections.join("\n\n");
}
