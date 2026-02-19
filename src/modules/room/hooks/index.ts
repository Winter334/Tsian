/**
 * 房间模块 Hooks 导出
 *
 * 提供房间相关的 React Hooks，用于 UI 组件访问房间状态和操作
 *
 * ⚠️ 架构说明：
 * - 状态读取 Hooks：只读访问 Store，符合架构规范
 * - 操作 Hooks：通过 CommandBus 发送命令，符合架构规范
 * - UI 组件应使用这些 Hooks，而不是直接访问 Store 的修改方法
 */

// ===== 状态读取 Hooks =====

/**
 * 获取房间基本信息（模式、当前房间、错误、加载状态）
 */
export { useRoomInfo } from "./useRoomInfo";

/**
 * 获取房间成员列表
 */
export { useRoomMembers } from "./useRoomMembers";

/**
 * 获取房间角色列表和当前用户角色
 */
export {
  useRoomCharacters,
  type UseRoomCharactersResult,
} from "./useRoomCharacters";

/**
 * 获取连接状态
 */
export { useConnectionStatus } from "./useConnectionStatus";

// ===== 操作 Hooks =====

/**
 * 创建房间
 */
export {
  useCreateRoom,
  type CreateRoomOptions,
  type CreateRoomResult,
} from "./useCreateRoom";

/**
 * 加入房间
 */
export { useJoinRoom, type JoinRoomResult } from "./useJoinRoom";

/**
 * 查询房间信息（用于加入前预览）
 */
export { useQueryRoom, type RoomPreview } from "./useQueryRoom";

/**
 * 离开房间
 */
export { useLeaveRoom, type LeaveRoomResult } from "./useLeaveRoom";

// ===== 行动系统 Hooks =====

/**
 * 行动输入状态同步（Awareness 集成）
 */
export {
  useActionAwareness,
  type ActionAwarenessState,
  type ActionStatus,
  type PlayerActionInfo,
  type UseActionAwarenessReturn,
} from "./useActionAwareness";

/**
 * 当前用户行动状态 Hook
 * 从 TurnDoc 读取已提交的行动状态
 * 解决"第一次提交被重置"问题
 */
export {
  useMyAction,
  type MyActionState,
  type UseMyActionReturn,
} from "./useMyAction";

/**
 * 回合行动状态 Hook
 * 从 TurnDoc 读取所有玩家的行动提交状态
 * 解决"自动开始不触发AI回复"问题
 */
export {
  useTurnActions,
  type PlayerActionState,
  type UseTurnActionsReturn,
} from "./useTurnActions";

/**
 * 回合控制 Hook
 * 管理回合超时、缓冲期、自动锁定逻辑
 */
export {
  useTurnControl,
  type TurnControlState,
  type UseTurnControlReturn,
} from "./useTurnControl";

// ===== 消息展示 Hooks =====

/**
 * 回合消息 Hook
 * 联机模式下结合历史和实时消息展示
 */
export {
  useTurnMessages,
  type TurnMessagesState,
  type UseTurnMessagesReturn,
} from "./useTurnMessages";

// ===== TurnDoc 同步状态 Hooks =====

/**
 * TurnDoc 同步状态 Hook
 * 监听指定回合的 TurnDoc 同步状态
 */
export { useTurnDocStatus, useTurnDocSynced } from "./useTurnDocStatus";

// ===== AI 处理 Hooks =====

/**
 * AI 响应 Hook
 * 使用 useSyncExternalStore 监听 Y.Text 变化
 */
export { useAiResponse, useAiResponseWithDoc } from "./useAiResponse";

/**
 * AI 状态 Hook
 * 监听 aiStatus、aiError、aiAborted 字段
 */
export {
  useAiStatus,
  useAiStatusWithDoc,
  type AiStatusInfo,
} from "./useAiStatus";
