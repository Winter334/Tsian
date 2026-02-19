/**
 * Save 模块事件定义
 *
 * 存档槽位相关的领域事件
 */

/**
 * Save 事件类型常量
 */
export const SaveEvents = {
  // 存档槽位事件
  SAVE_CREATED: "save.save_created",
  SAVE_LOADED: "save.save_loaded",
  SAVE_DELETED: "save.save_deleted",
  SAVE_RENAMED: "save.save_renamed",
} as const;

/**
 * Save 事件类型
 */
export type SaveEventType = (typeof SaveEvents)[keyof typeof SaveEvents];

// ============ 事件 Payload 类型 ============

/**
 * 存档创建事件 Payload
 */
export interface SaveCreatedPayload {
  saveId: string;
  name: string;
}

/**
 * 存档加载事件 Payload
 */
export interface SaveLoadedPayload {
  saveId: string;
  previousSaveId: string | null;
  /** 存档类型：单人或联机 */
  saveType: "solo" | "multiplayer";
}

/**
 * 存档删除事件 Payload
 */
export interface SaveDeletedPayload {
  saveId: string;
  saveName: string; // 便于 UI 提示
  isCurrentSave: boolean; // 消费方据此决定是否清理状态
}

/**
 * 存档重命名事件 Payload
 */
export interface SaveRenamedPayload {
  saveId: string;
  oldName: string;
  newName: string;
}
