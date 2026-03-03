/**
 * Yjs 核心模块导出
 */

// 错误处理工具函数
export {
  checkIndexedDBAvailability,
  detectStorageErrorType,
} from "./error-utils";
export type { StorageErrorType } from "./error-utils";

// 错误处理组件
export { StorageErrorDialog } from "./errors";

// 初始化
export { initYjs, isIndexedDBSupported, showIndexedDBError } from "./init";
export type { YjsInitResult } from "./init";

// 管理器
export { YjsManager, yjsManager } from "./manager";

// 迁移
export {
  CURRENT_VERSION,
  getMigrations,
  registerMigration,
  runMigrations,
} from "./migrations";
export type { Migration, MigrationFn, MigrationResult } from "./migrations";

// 存储配额
export {
  checkStorageAndWarn,
  formatBytes,
  getStorageUsage,
  getStorageWarningLevel,
  getStorageWarningMessage,
  isPersistentStorage,
  requestPersistentStorage,
} from "./storage-quota";
export type {
  StorageThresholds,
  StorageUsage,
  StorageWarningLevel,
} from "./storage-quota";

// Hooks
export { useStorageQuota, useStorageWarning } from "./hooks/useStorageQuota";
export type { StorageQuotaState } from "./hooks/useStorageQuota";

// 组件
export {
  StorageIndicator,
  StorageWarningBanner,
} from "./components/StorageWarningBanner";

// Subdoc 管理器
export {
  generateRoomCode,
  SubdocManager,
  subdocManager,
} from "./subdoc-manager";
export type {
  HistoryMessageItem,
  PaginatedResult,
  PaginationOptions,
} from "./subdoc-manager";

export {
  updateResolveStatus,
  writeResultFrameToTurnDoc,
  type WritableResultFrame,
} from "./result-frame-accessor";

// API 客户端
export { ApiClient, apiClient, ApiError } from "./api-client";
export type {
  AddMemberRequest,
  GetTokenRequest,
  JoinRoomResponse,
  RegisterRoomRequest,
  RegisterRoomResponse,
  RoomInfo,
  TokenResponse,
} from "./api-client";

// 共享 WebSocket 管理器（Multiplexing）
export { sharedWebSocket, SharedWebSocketManager } from "./shared-websocket";

// 联机连接管理器
export {
  MultiplayerProvider,
  multiplayerProvider,
} from "./multiplayer-provider";
export type {
  AwarenessUserState,
  ConnectionConfig,
  ConnectionEventHandlers,
  ConnectionStatus,
} from "./multiplayer-provider";

// TurnDoc 网络同步管理器
export { TurnDocProvider, turnDocProvider } from "./turndoc-provider";
export type {
  TurnDocConfig,
  TurnDocStatusEvent,
  TurnDocStatusListener,
} from "./turndoc-provider";

// HistoryDoc 网络同步管理器
export { HistoryDocProvider, historyDocProvider } from "./historydoc-provider";
export type {
  HistoryDocConfig,
  HistoryDocStatusEvent,
  HistoryDocStatusListener,
} from "./historydoc-provider";

// 房间类型
export { DEFAULT_ROOM_CODE_OPTIONS, DEFAULT_SUBDOC_CONFIG } from "./room/types";
export type {
  ArchivedTurn,
  CharacterInventorySnapshot,
  CompletedTurnData,
  HistoryDocStructure,
  InventorySnapshot,
  InventoryYjsData,
  LoadedSubdocInfo,
  MainDocConfig,
  MainDocStructure,
  Member,
  MemberRole,
  MemberStatus,
  PlayerAction,
  ResolveStatus,
  RoomCodeOptions,
  RoomMetadata,
  RoomRef,
  RoomStatus,
  SubdocManagerConfig,
  TurnData,
  TurnDocStructure,
  TurnStatus,
  WorldArchiveMetadataSnapshot,
  WorldArchiveYjsData,
} from "./room/types";

// 类型
export type {
  AssetRef,
  CreateSaveParams,
  GameDocument,
  SaveMemberInfo,
  SaveSlot,
  SaveSlotInfo,
  SaveType,
  YjsInitOptions,
} from "./types";
