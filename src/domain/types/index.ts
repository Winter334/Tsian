/**
 * 领域层共享类型定义
 */

/**
 * 实体基类接口
 */
export interface Entity {
  /** 唯一标识 */
  id: string;
  /** 创建时间戳 */
  createdAt: number;
  /** 更新时间戳 */
  updatedAt: number;
}

/**
 * 生成唯一 ID
 */
export function generateId(): string {
  return crypto.randomUUID();
}

/**
 * 生成带时间戳前缀的 ID（可排序）
 */
export function generateSortableId(): string {
  const timestamp = Date.now().toString(36);
  const uuid = crypto.randomUUID().slice(0, 8);
  return `${timestamp}-${uuid}`;
}

/**
 * IRNR 结果帧类型
 */
export * from "./result-frame";

/**
 * IRNR 规则脚本类型
 */
export * from "./rule-script";

/**
 * 标签序列化/反序列化工具
 */
export {
  deserializeTagsFromYjs,
  serializeTagsForYjs,
} from "./tag-serialization";

/**
 * Pipeline 相关实体数据类型
 */
export * from "./entity";

/**
 * AI 状态相关类型
 */
export * from "./ai-status";

/**
 * IRNR Pipeline 公共契约类型
 */
export * from "./pipeline-contract";

/**
 * Pipeline 黑板类型
 */
export * from "./pipeline-blackboard";

/**
 * 轻量管线（Direct Pipeline）类型
 */
export * from "./direct-action";

/**
 * Prompt v2 Envelope 协议类型
 */
export * from "./envelope";

/**
 * Prompt v2 Delta 协议类型
 */
export * from "./delta";
