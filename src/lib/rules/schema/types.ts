/**
 * Action Schema 类型定义
 *
 * 用于描述 RuleAction 的结构化元数据，供 Prompt 生成和校验使用。
 */

import type { WorldConfig } from "@/lib/world/types";

// ─── 分类与参数类型 ─────────────────────────────────────────

/**
 * Action 分类，用于按功能分组展示
 */
export type ActionCategory =
  | "combat"
  | "attribute"
  | "status"
  | "npc"
  | "flow"
  | "inventory"
  | "movement"
  | "skill";

/**
 * 参数类型标识
 * - entityRef: 实体引用（角色 ID、NPC ID 等）
 * - field: 属性字段名（hp, mp, str 等）
 * - value: ValueExpression（数字、字符串表达式、布尔值）
 * - string / number / boolean: 基础类型
 * - enum: 枚举值，需配合 enumValues
 * - talentRef: 天赋 ID 引用
 * - actions: RuleAction[] 子序列
 * - object: 嵌套对象，需配合 properties
 */
export type ActionParamType =
  | "entityRef"
  | "field"
  | "value"
  | "string"
  | "number"
  | "boolean"
  | "enum"
  | "talentRef"
  | "actions"
  | "object";

// ─── 参数定义 ───────────────────────────────────────────────

/**
 * 单个参数的 Schema 定义
 */
export interface ActionParamSchema {
  /** 参数名（对应 JSON 中的 key） */
  name: string;
  /** 参数类型 */
  type: ActionParamType;
  /** 是否必填 */
  required: boolean;
  /** 参数描述（面向 AI） */
  description: string;
  /** enum 类型时的可选值列表 */
  enumValues?: readonly string[];
  /** 默认值 */
  defaultValue?: string | number | boolean;
  /** object 类型时的子属性定义 */
  properties?: readonly ActionParamSchema[];
}

// ─── 示例 ───────────────────────────────────────────────────

/**
 * Action 使用示例
 */
export interface ActionExample {
  /** 使用场景描述 */
  scenario: string;
  /** 示例 JSON（字符串形式，便于直接嵌入 Prompt） */
  json: string;
}

// ─── 校验 ───────────────────────────────────────────────────

/**
 * 校验上下文（Phase 4 消费）
 */
export interface ValidationContext {
  /** 当前世界配置 */
  worldConfig: WorldConfig;
  /** 当前场景中存在的实体 ID 列表 */
  entityIds: readonly string[];
}

/**
 * 校验结果
 */
export interface ValidationResult {
  /** 是否通过校验 */
  valid: boolean;
  /** 错误信息列表 */
  errors: string[];
}

// ─── Action Schema ──────────────────────────────────────────

/**
 * 完整的 Action Schema 定义
 *
 * 描述一个 RuleAction 类型的所有元数据，包括参数结构、
 * 使用约束、示例和可选的校验函数。
 */
export interface ActionSchema {
  /**
   * Action 类型标识
   * 必须与 RuleAction 联合类型中对应成员的 type 字面量完全一致
   */
  type: string;
  /** 功能分类 */
  category: ActionCategory;
  /** 显示名称（中文） */
  displayName: string;
  /** 用途描述（中文，面向 AI） */
  description: string;
  /** 参数列表 */
  params: readonly ActionParamSchema[];
  /** 使用约束说明（面向 AI 的注意事项） */
  constraints?: readonly string[];
  /** 使用示例 */
  examples?: readonly ActionExample[];
  /** 可选的校验函数（Phase 4 使用） */
  validate?: (
    action: Record<string, unknown>,
    context: ValidationContext
  ) => ValidationResult;
}

// ─── 实体别名映射 ──────────────────────────────────────────

/**
 * 实体别名映射
 *
 * 将 AI 输出中的人类可读名称（如 "player"、NPC 名称）
 * 映射到引擎使用的实际实体 ID（UUID / npc_xxx）。
 *
 * 用于 Validation Pipeline 的 entityRef 解析和
 * ExecutionContext 中的运行时别名解析。
 */
export interface EntityAliasMap {
  /** 别名 → 实际实体 ID（大小写不敏感的别名作为 key） */
  aliases: Map<string, string>;
  /** 实际 ID → 首选别名（用于 prompt/日志展示） */
  displayNames: Map<string, string>;
}
