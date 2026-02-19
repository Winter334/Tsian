/**
 * 记忆实体定义
 */

/**
 * 小总结条目
 *
 * 每条 assistant 消息最多对应一个小总结，
 * 由 NarrativePostProcessor 从正文 AI 输出中提取。
 */
export interface MiniSummary {
  /** 唯一 ID */
  id: string;
  /** 关联的消息 ID */
  messageId: string;
  /** 消息在对话中的序号（用于排序与范围计算） */
  messageIndex: number;
  /** 创建时间戳 */
  createdAt: number;
  /** 小总结内容 */
  content: string;
  /** 是否已被压缩为大总结 */
  compressed: boolean;
  /** 所属大总结 ID（压缩后填入） */
  megaSummaryId?: string;
}

/**
 * 大总结覆盖范围
 */
export interface MegaSummaryRange {
  /** 最早消息序号 */
  from: number;
  /** 最晚消息序号 */
  to: number;
}

/**
 * 大总结条目
 *
 * 由 Summarizer AI 将多条小总结压缩后生成。
 */
export interface MegaSummary {
  /** 唯一 ID */
  id: string;
  /** 创建时间戳 */
  createdAt: number;
  /** 压缩后的摘要文本 */
  content: string;
  /** 源小总结 ID 列表 */
  sourceMiniSummaryIds: string[];
  /** 覆盖的消息范围 */
  messageRange: MegaSummaryRange;
}

/**
 * 手动记忆条目
 *
 * 用户选择文本后由 AI 压缩，再允许用户编辑。
 */
export interface ManualMemory {
  /** 唯一 ID */
  id: string;
  /** 用户选择的原始文本 */
  sourceContent: string;
  /** AI 压缩 / 用户编辑后的摘要 */
  summary: string;
  /** 用户标签 */
  tags: string[];
  /** 创建时间戳 */
  createdAt: number;
  /** 最后更新时间戳 */
  updatedAt: number;
  /** 来源消息 ID（可选） */
  sourceMessageId?: string;
}
