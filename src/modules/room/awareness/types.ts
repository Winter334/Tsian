/**
 * room/awareness 类型定义
 *
 * 承载 ActionInput 相关 Awareness 协议语义。
 */

/**
 * 行动状态
 */
export type ActionStatus = "empty" | "draft" | "submitted" | "locked";

/**
 * 玩家行动 Awareness 状态（协议层）
 */
export interface ActionAwarenessState {
  /** 用户 ID */
  id: string;
  /** 用户名 */
  name: string;
  /** 行动状态 */
  actionStatus: ActionStatus;
  /** 是否正在输入（typing indicator） */
  isTyping: boolean;
  /** 最后输入时间 */
  lastTypingAt: number;
  /** 最后更新时间 */
  lastActiveAt: number;
}

/**
 * 玩家行动状态信息（UI 消费层）
 */
export interface PlayerActionInfo {
  userId: string;
  displayName: string;
  status: ActionStatus;
  isTyping: boolean;
}
