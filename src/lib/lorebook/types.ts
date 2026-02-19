/**
 * 世界书（Lorebook）类型定义
 *
 * 世界书服务于 Lyra 四层内容配置体系中的「设定层 Lore」，
 * 为 Narrator AI 提供世界观、地点、角色背景等设定信息。
 */

// ===== 世界书 =====

/**
 * 世界书
 */
export interface Lorebook {
  /** 唯一标识符 */
  id: string;

  /** 世界书名称 */
  name: string;

  /** 世界书描述 */
  description?: string;

  /** 条目列表 */
  entries: LorebookEntry[];

  /** 全局设置 */
  settings: LorebookSettings;

  /** 元数据 */
  metadata: {
    version: string;
    createdAt: number;
    updatedAt: number;
  };
}

// ===== 世界书条目 =====

/**
 * 激活策略
 *
 * - constant: 常量激活（始终注入）
 * - selective: 关键字触发激活
 */
export type ActivationStrategy = "constant" | "selective";

/**
 * 世界书条目
 */
export interface LorebookEntry {
  /** 唯一标识符 */
  id: string;

  /** 条目名称（仅用于管理，不发送给 AI） */
  name: string;

  /** 条目内容（发送给 AI 的提示词，支持变量模板） */
  content: string;

  /** 是否启用 */
  enabled: boolean;

  // === 激活设置 ===

  /** 激活策略 */
  activationStrategy: ActivationStrategy;

  /** 主要关键字列表（OR 逻辑：任一匹配即激活） */
  primaryKeywords: string[];

  /** 扫描深度覆盖（null 表示使用全局设置） */
  scanDepth: number | null;

  // === 插入设置 ===

  /** 同位置排序优先级（越大越靠后） */
  order: number;

  // === 元数据 ===

  /** 条目备注（仅用于管理） */
  comment?: string;
}

// ===== 全局设置 =====

/**
 * 世界书全局设置
 */
export interface LorebookSettings {
  /** 默认扫描深度（扫描最近 N 条消息） */
  defaultScanDepth: number;

  /** 关键字匹配是否区分大小写 */
  caseSensitive: boolean;

  /** Token 预算上限（0 = 无限制） */
  tokenBudget: number;
}

// ===== 默认值 =====

/**
 * 默认世界书设置
 */
export const DEFAULT_LOREBOOK_SETTINGS: LorebookSettings = {
  defaultScanDepth: 2,
  caseSensitive: false,
  tokenBudget: 0,
};
