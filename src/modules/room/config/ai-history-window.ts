/**
 * 联机 AI 历史读取窗口（用于记忆注入）
 *
 * 统一集中维护默认值与上限，便于后续调优。
 */
export const ROOM_AI_HISTORY_WINDOW = {
  defaultLimit: 160,
  maxLimit: 400,
} as const;
