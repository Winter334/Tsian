/**
 * 数据验证工具函数
 *
 * 用于验证导入数据的格式和完整性
 */

import {
  EXPORT_VERSION,
  type ExportData,
  type ExportedConversation,
  type ExportedMessage,
  type ExportedSave,
} from "../types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * 验证结果
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
  data?: ExportData;
}

/**
 * 验证导出数据格式
 */
export function validateExportData(data: unknown): ValidationResult {
  // 1. 基本结构检查
  if (!data || typeof data !== "object") {
    return { valid: false, error: "无效的数据格式" };
  }

  const obj = data as Record<string, unknown>;

  // 2. 版本检查
  if (typeof obj.version !== "number") {
    return { valid: false, error: "缺少版本信息" };
  }

  if (obj.version > EXPORT_VERSION) {
    return {
      valid: false,
      error: `不支持的版本 (v${obj.version})，请更新应用`,
    };
  }

  // 3. 类型检查
  if (obj.type !== "single_save" && obj.type !== "full_backup") {
    return { valid: false, error: "未知的导出类型" };
  }

  // 4. 导出时间检查
  if (typeof obj.exportedAt !== "number") {
    return { valid: false, error: "缺少导出时间" };
  }

  // 5. 数据完整性检查 + 归一化
  if (obj.type === "single_save") {
    if (!obj.save || typeof obj.save !== "object") {
      return { valid: false, error: "缺少存档数据" };
    }

    const saveValidation = validateSave(obj.save);
    if (!saveValidation.valid || !saveValidation.data) {
      return { valid: false, error: saveValidation.error };
    }

    const normalizedData: ExportData = {
      ...(data as ExportData),
      type: "single_save",
      save: saveValidation.data,
    };

    return { valid: true, data: normalizedData };
  }

  if (!Array.isArray(obj.saves)) {
    return { valid: false, error: "缺少存档列表" };
  }

  const normalizedSaves: ExportedSave[] = [];
  for (let i = 0; i < obj.saves.length; i++) {
    const saveValidation = validateSave(obj.saves[i]);
    if (!saveValidation.valid || !saveValidation.data) {
      return {
        valid: false,
        error: `存档 ${i + 1}: ${saveValidation.error}`,
      };
    }
    normalizedSaves.push(saveValidation.data);
  }

  const normalizedData: ExportData = {
    ...(data as ExportData),
    type: "full_backup",
    saves: normalizedSaves,
  };

  return { valid: true, data: normalizedData };
}

/**
 * 验证单个存档数据
 */
function validateSave(
  save: unknown,
): Omit<ValidationResult, "data"> & { data?: ExportedSave } {
  if (!save || typeof save !== "object") {
    return { valid: false, error: "存档数据无效" };
  }

  const obj = save as Record<string, unknown>;

  // 必需字段检查
  if (typeof obj.id !== "string" || !obj.id) {
    return { valid: false, error: "存档缺少 ID" };
  }

  if (typeof obj.name !== "string") {
    return { valid: false, error: "存档缺少名称" };
  }

  if (typeof obj.createdAt !== "number") {
    return { valid: false, error: "存档缺少创建时间" };
  }

  if (typeof obj.updatedAt !== "number") {
    return { valid: false, error: "存档缺少更新时间" };
  }

  // 会话列表检查
  if (!Array.isArray(obj.conversations)) {
    return { valid: false, error: "存档缺少会话列表" };
  }

  for (let i = 0; i < obj.conversations.length; i++) {
    const convValidation = validateConversation(obj.conversations[i]);
    if (!convValidation.valid) {
      return {
        valid: false,
        error: `会话 ${i + 1}: ${convValidation.error}`,
      };
    }
  }

  // 消息检查
  if (!obj.messages || typeof obj.messages !== "object") {
    return { valid: false, error: "存档缺少消息数据" };
  }

  const conversationIds = new Set(
    obj.conversations
      .filter((conversation): conversation is ExportedConversation =>
        isRecord(conversation),
      )
      .map((conversation) => conversation.id),
  );

  const messages = obj.messages as Record<string, unknown>;
  for (const [convId, msgArray] of Object.entries(messages)) {
    if (!conversationIds.has(convId)) {
      return {
        valid: false,
        error: `会话 ${convId} 的消息存在，但缺少对应会话元数据`,
      };
    }
    if (!Array.isArray(msgArray)) {
      return {
        valid: false,
        error: `会话 ${convId} 的消息格式无效`,
      };
    }

    for (let i = 0; i < msgArray.length; i++) {
      const msgValidation = validateMessage(msgArray[i]);
      if (!msgValidation.valid) {
        return {
          valid: false,
          error: `会话 ${convId} 消息 ${i + 1}: ${msgValidation.error}`,
        };
      }
    }
  }

  // gameState 检查（可选，但必须是对象）
  if (obj.gameState !== undefined && typeof obj.gameState !== "object") {
    return { valid: false, error: "游戏状态格式无效" };
  }

  // 联机元信息校验（可选字段）
  if (
    obj.type !== undefined &&
    obj.type !== "solo" &&
    obj.type !== "multiplayer"
  ) {
    return { valid: false, error: "存档 type 字段无效" };
  }

  if (obj.lastRoomId !== undefined && typeof obj.lastRoomId !== "string") {
    return { valid: false, error: "存档 lastRoomId 字段格式无效" };
  }

  if (obj.lastRoomCode !== undefined && typeof obj.lastRoomCode !== "string") {
    return { valid: false, error: "存档 lastRoomCode 字段格式无效" };
  }

  if (obj.memberCount !== undefined && typeof obj.memberCount !== "number") {
    return { valid: false, error: "存档 memberCount 字段格式无效" };
  }

  if (obj.members !== undefined) {
    if (!Array.isArray(obj.members)) {
      return { valid: false, error: "存档 members 字段格式无效" };
    }

    for (let i = 0; i < obj.members.length; i++) {
      const memberValidation = validateMember(obj.members[i]);
      if (!memberValidation.valid) {
        return {
          valid: false,
          error: `存档成员 ${i + 1}: ${memberValidation.error}`,
        };
      }
    }
  }

  if (obj.maxPlayers !== undefined && typeof obj.maxPlayers !== "number") {
    return { valid: false, error: "存档 maxPlayers 字段格式无效" };
  }

  if (obj.turnDuration !== undefined && typeof obj.turnDuration !== "number") {
    return { valid: false, error: "存档 turnDuration 字段格式无效" };
  }

  // 游戏进度校验（可选字段）
  if (
    obj.currentTurnNumber !== undefined &&
    typeof obj.currentTurnNumber !== "number"
  ) {
    return { valid: false, error: "存档 currentTurnNumber 字段格式无效" };
  }

  if (obj.archivedTurns !== undefined) {
    if (!Array.isArray(obj.archivedTurns)) {
      return { valid: false, error: "存档 archivedTurns 字段格式无效" };
    }

    for (let i = 0; i < obj.archivedTurns.length; i++) {
      const archivedTurnValidation = validateArchivedTurn(obj.archivedTurns[i]);
      if (!archivedTurnValidation.valid) {
        return {
          valid: false,
          error: `归档回合 ${i + 1}: ${archivedTurnValidation.error}`,
        };
      }
    }
  }

  // 缺失字段安全默认值（导入阶段直接读取）
  const normalizedSave: ExportedSave = {
    ...(save as ExportedSave),
    type: obj.type === "multiplayer" ? "multiplayer" : "solo",
    ...(obj.currentTurnNumber === undefined ? { currentTurnNumber: 0 } : {}),
    ...(obj.worldNarrative === undefined ? { worldNarrative: undefined } : {}),
  };

  return { valid: true, data: normalizedSave };
}

/**
 * 验证会话数据
 */
function validateConversation(
  conv: unknown,
): Omit<ValidationResult, "data"> & { data?: ExportedConversation } {
  if (!conv || typeof conv !== "object") {
    return { valid: false, error: "会话数据无效" };
  }

  const obj = conv as Record<string, unknown>;

  if (typeof obj.id !== "string" || !obj.id) {
    return { valid: false, error: "会话缺少 ID" };
  }

  if (typeof obj.title !== "string") {
    return { valid: false, error: "会话缺少标题" };
  }

  if (typeof obj.createdAt !== "number") {
    return { valid: false, error: "会话缺少创建时间" };
  }

  if (typeof obj.updatedAt !== "number") {
    return { valid: false, error: "会话缺少更新时间" };
  }

  return { valid: true, data: conv as ExportedConversation };
}

/**
 * 验证消息数据
 */
function validateMessage(
  msg: unknown,
): Omit<ValidationResult, "data"> & { data?: ExportedMessage } {
  if (!msg || typeof msg !== "object") {
    return { valid: false, error: "消息数据无效" };
  }

  const obj = msg as Record<string, unknown>;

  if (typeof obj.id !== "string" || !obj.id) {
    return { valid: false, error: "消息缺少 ID" };
  }

  if (!["user", "assistant", "system"].includes(obj.role as string)) {
    return { valid: false, error: "消息角色无效" };
  }

  if (typeof obj.content !== "string") {
    return { valid: false, error: "消息缺少内容" };
  }

  if (typeof obj.createdAt !== "number") {
    return { valid: false, error: "消息缺少创建时间" };
  }

  return { valid: true, data: msg as ExportedMessage };
}

/**
 * 验证联机成员信息
 */
function validateMember(member: unknown): Omit<ValidationResult, "data"> & {
  data?: { displayName: string; role: "host" | "guest" };
} {
  if (!member || typeof member !== "object") {
    return { valid: false, error: "成员数据无效" };
  }

  const obj = member as Record<string, unknown>;

  if (typeof obj.displayName !== "string" || !obj.displayName) {
    return { valid: false, error: "成员 displayName 无效" };
  }

  if (obj.role !== "host" && obj.role !== "guest") {
    return { valid: false, error: "成员 role 无效" };
  }

  return {
    valid: true,
    data: obj as { displayName: string; role: "host" | "guest" },
  };
}

/**
 * 验证归档回合数据
 */
function validateArchivedTurn(turn: unknown): Omit<ValidationResult, "data"> & {
  data?: {
    turnNumber: number;
    completedAt: number;
    actions: Record<string, unknown>;
    aiResponseLength: number;
  };
} {
  if (!turn || typeof turn !== "object") {
    return { valid: false, error: "归档回合数据无效" };
  }

  const obj = turn as Record<string, unknown>;

  if (typeof obj.turnNumber !== "number") {
    return { valid: false, error: "turnNumber 无效" };
  }

  if (typeof obj.completedAt !== "number") {
    return { valid: false, error: "completedAt 无效" };
  }

  if (!obj.actions || typeof obj.actions !== "object") {
    return { valid: false, error: "actions 无效" };
  }

  if (typeof obj.aiResponseLength !== "number") {
    return { valid: false, error: "aiResponseLength 无效" };
  }

  return {
    valid: true,
    data: obj as {
      turnNumber: number;
      completedAt: number;
      actions: Record<string, unknown>;
      aiResponseLength: number;
    },
  };
}
