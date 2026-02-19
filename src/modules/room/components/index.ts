/**
 * 房间模块组件导出
 *
 * 提供联机房间相关的 UI 组件
 */

// ===== 行动输入组件 =====

/**
 * ActionInput - 联机模式行动输入组件
 * 支持提交/修改/撤回行动，集成 Awareness 状态同步
 */
export { ActionInput } from "./ActionInput";

/**
 * ActionStatusIndicator - 玩家行动状态指示器
 * 显示房间内所有玩家的行动状态
 */
export { ActionStatusIndicator } from "./ActionStatusIndicator";

// ===== 回合控制组件 =====

/**
 * CountdownTimer - 回合倒计时显示组件
 * 显示剩余时间，支持缓冲期倒计时
 */
export { CountdownProgress, CountdownTimer } from "./CountdownTimer";

/**
 * TimeoutDialog - 回合超时处理弹窗
 * 当回合超时时显示，让 Host 选择处理方式
 */
export { TimeoutDialog, type TimeoutAction } from "./TimeoutDialog";

/**
 * TurnTimeoutController - 回合超时控制器
 * 负责监听超时并管理 TimeoutDialog 生命周期
 */
export { TurnTimeoutController } from "./TurnTimeoutController";

// ===== 消息展示组件 =====

/**
 * TurnNarrativeFlow - 回合制叙事内容流
 * 联机模式下展示回合消息，支持回合分隔标记、玩家行动展示
 */
export { TurnNarrativeFlow } from "./TurnNarrativeFlow";

// ===== AI 处理组件 =====

/**
 * AiProcessingStatus - AI 处理状态显示
 * 显示 processing/retrying/failed/aborted 等状态
 */
export { AiProcessingStatus } from "./AiProcessingStatus";

/**
 * AiHostControls - Host AI 控制按钮
 * 取消/重新生成/开始下一回合等操作
 */
export { AiHostControls, GuestWaitingMessage } from "./AiHostControls";
