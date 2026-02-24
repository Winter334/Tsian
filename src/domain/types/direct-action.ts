/**
 * 轻量管线（Direct Pipeline）类型定义
 *
 * 轻量管线处理确定性操作（装备、卸下、使用、丢弃等）。
 * 与重型管线（IRNR）不同，不经过 Parser AI 和 Rules Engine，
 * 直接校验合法性后通过 CommandBus 执行。
 */

/** 轻量管线支持的操作类型 */
export type DirectActionType =
  | "equip_item"
  | "unequip_item"
  | "use_item"
  | "drop_item";

/** 轻量管线的操作描述 */
export interface DirectAction {
  /** 操作类型 */
  type: DirectActionType;
  /** 发起者角色 ID */
  actorId: string;
  /** 操作参数 */
  payload: Record<string, unknown>;
}

/** 轻量管线操作的执行结果 */
export interface DirectActionResult {
  success: boolean;
  error?: string;
}

/** 轻量管线校验结果 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/** 轻量管线操作处理器接口 */
export interface DirectActionHandler {
  /** 前置校验（快速失败，提升用户体验） */
  validate(action: DirectAction): ValidationResult;
  /** 执行操作（通过 CommandBus dispatch） */
  execute(action: DirectAction): Promise<DirectActionResult>;
}
