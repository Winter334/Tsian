/**
 * 房间服务模块导出
 *
 * 遵循架构规范：
 * - Services 只用于只读查询和纯计算
 * - 修改状态必须通过 CommandBus
 */

export {
  convertTurnToMessages,
  formatPlayerAction,
  generateTurnSeparator,
  getDisplayNameForUser,
  mergePlayerActions,
  toMessageEntities,
  toMessageEntity,
  type ConvertedMessage,
  type TurnConversionOptions,
  type TurnConversionResult,
} from "./turn-converter";
