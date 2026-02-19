/**
 * RoomSyncBridge 模块入口
 *
 * 统一管理 Yjs 状态到 Store 和 EventBus 的同步
 *
 * 基于 room-sync-bridge-proposal.md 设计文档
 */

// ===== 类型导出 =====
export type {
  EventMeta,
  HostTransferMeta,
  HostTransferType,
  MemberActionMeta,
  MemberActionType,
  RoomSnapshot,
  SnapshotDiff,
  SnapshotMember,
  SyncBridgeConfig,
} from "./types";

// ===== 工具函数导出 =====
export {
  createEmptySnapshot,
  DEFAULT_SYNC_BRIDGE_CONFIG,
  toSnapshotMember,
} from "./types";

// ===== 事件派生导出 =====
export {
  computeSnapshotDiff,
  deriveRoomEvents,
  hasSnapshotChanged,
} from "./deriveRoomEvents";
export type { DeriveEventsResult, EventMetaReader } from "./deriveRoomEvents";

// ===== 核心类导出 =====
export { RoomSyncBridge } from "./RoomSyncBridge";
