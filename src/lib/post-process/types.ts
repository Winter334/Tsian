/**
 * 后处理规则执行阶段
 *
 * - persist: 文本持久化前执行
 * - render: UI 渲染前执行
 */
export type PostProcessPhase = "persist" | "render";

/**
 * 后处理规则来源
 *
 * - builtin: 内置规则
 * - user: 用户自定义规则
 */
export type PostProcessRuleSource = "builtin" | "user";

/**
 * 后处理动作类型
 *
 * - remove: 移除匹配内容
 * - replace: 替换匹配内容
 * - extract-and-remove: 提取内容并移除匹配内容
 */
export type PostProcessAction = "remove" | "replace" | "extract-and-remove";

/**
 * 后处理规则定义
 */
export interface PostProcessRule {
  /** 规则唯一 ID */
  id: string;
  /** 规则显示名称 */
  name: string;
  /** 规则描述 */
  description?: string;
  /** 正则表达式模式（不包含分隔符） */
  pattern: string;
  /** 正则标志位 */
  flags: string;
  /** 替换字符串 */
  replacement: string;
  /** 后处理动作 */
  action: PostProcessAction;
  /** 提取键名（仅 extract-and-remove 使用） */
  extractKey?: string;
  /** 执行阶段 */
  phase: PostProcessPhase;
  /** 规则来源 */
  source: PostProcessRuleSource;
  /** 是否启用 */
  enabled: boolean;
  /** 执行顺序（越小越先执行） */
  order: number;
}

/**
 * 后处理执行结果
 */
export interface PostProcessResult {
  /** 处理后的文本 */
  text: string;
  /** 提取到的结构化数据 */
  extracted: Record<string, string[]>;
  /** 执行警告 */
  warnings: string[];
}
