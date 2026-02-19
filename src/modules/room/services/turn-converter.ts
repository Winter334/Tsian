/**
 * 回合数据转换服务
 *
 * 将 TurnDoc 中的结构化数据转换为 conversation 消息格式
 * 用于联机模式下的消息展示和历史归档
 *
 * 遵循架构规范：
 * - 只提供纯函数转换逻辑，不修改状态
 * - 通过 CommandBus 调用来实际写入数据
 */

import type { Member, PlayerAction } from "@/core/yjs/room/types";
import type { Character } from "@/domain/entities/character";
import type { Message, MessageRole } from "@/domain/entities/message";

/**
 * 转换后的消息项
 */
export interface ConvertedMessage {
  /** 消息 ID */
  id: string;
  /** 消息角色 */
  role: MessageRole;
  /** 消息内容 */
  content: string;
  /** 创建时间 */
  createdAt: number;
  /** 元数据 */
  metadata?: Record<string, unknown>;
}

/**
 * 回合转换选项
 */
export interface TurnConversionOptions {
  /** 回合号 */
  turnNumber: number;
  /** 玩家行动 Map（userId -> PlayerAction） */
  actions: Map<string, PlayerAction>;
  /** 成员信息 Map（userId -> Member） */
  members: Map<string, Member>;
  /** 角色列表（可选，用于显示角色名称而非玩家名称） */
  characters?: Character[];
  /** AI 响应内容 */
  aiResponse: string;
  /** 回合完成时间 */
  completedAt: number;
  /** 会话 ID */
  conversationId: string;
}

/**
 * 根据 userId 获取角色名称
 *
 * 优先使用角色名称，如果没有角色则使用玩家显示名称
 *
 * @param userId 用户 ID
 * @param members 成员信息 Map
 * @param characters 角色列表
 * @returns 显示名称（角色名称或玩家名称）
 */
export function getDisplayNameForUser(
  userId: string,
  members: Map<string, Member>,
  characters?: Character[]
): string {
  // 优先查找角色名称
  if (characters && characters.length > 0) {
    const character = characters.find(
      (char) => char.operatorUserId === userId && char.status === "active"
    );
    if (character) {
      return character.name;
    }
  }

  // 回退到玩家显示名称
  const member = members.get(userId);
  return member?.displayName || userId;
}

/**
 * 回合转换结果
 */
export interface TurnConversionResult {
  /** 转换后的消息列表 */
  messages: ConvertedMessage[];
  /** 回合分隔标记消息 */
  separator: ConvertedMessage;
  /** 玩家行动消息列表 */
  actionMessages: ConvertedMessage[];
  /** AI 响应消息 */
  aiMessage: ConvertedMessage;
}

/**
 * 生成回合分隔标记内容
 *
 * @param turnNumber 回合号
 * @returns 分隔标记文本
 */
export function generateTurnSeparator(turnNumber: number): string {
  return `--- 第 ${turnNumber} 回合 ---`;
}

/**
 * 格式化玩家行动内容
 *
 * @param displayName 玩家显示名称
 * @param content 行动内容
 * @returns 格式化后的行动文本
 */
export function formatPlayerAction(
  displayName: string,
  content: string
): string {
  return `[${displayName}] ${content}`;
}

/**
 * 合并多个玩家行动为单条消息内容
 *
 * @param actions 行动列表
 * @param members 成员信息 Map
 * @param characters 角色列表（可选）
 * @returns 合并后的内容
 */
export function mergePlayerActions(
  actions: Map<string, PlayerAction>,
  members: Map<string, Member>,
  characters?: Character[]
): string {
  const lines: string[] = [];

  // 按提交时间排序
  const sortedActions = Array.from(actions.entries()).sort(
    ([, a], [, b]) => a.submittedAt - b.submittedAt
  );

  for (const [userId, action] of sortedActions) {
    const displayName = getDisplayNameForUser(userId, members, characters);
    lines.push(formatPlayerAction(displayName, action.content));
  }

  return lines.join("\n");
}

/**
 * 将回合数据转换为 conversation 消息格式
 *
 * 转换策略：
 * 1. 创建回合分隔标记（system 消息）
 * 2. 将所有玩家行动合并为单条 user 消息
 * 3. AI 响应作为 assistant 消息
 *
 * @param options 转换选项
 * @returns 转换结果
 */
export function convertTurnToMessages(
  options: TurnConversionOptions
): TurnConversionResult {
  const {
    turnNumber,
    actions,
    members,
    characters,
    aiResponse,
    completedAt,
    conversationId,
  } = options;

  const now = completedAt;

  // 1. 创建回合分隔标记
  const separator: ConvertedMessage = {
    id: crypto.randomUUID(),
    role: "system",
    content: generateTurnSeparator(turnNumber),
    createdAt: now - 2, // 确保分隔符在最前面
    metadata: {
      type: "turn_separator",
      turnNumber,
      conversationId,
    },
  };

  // 2. 创建玩家行动消息（每个玩家一条，用于回放；或合并为一条，用于展示）
  const actionMessages: ConvertedMessage[] = [];
  const sortedActions = Array.from(actions.entries()).sort(
    ([, a], [, b]) => a.submittedAt - b.submittedAt
  );

  for (const [userId, action] of sortedActions) {
    // 使用角色名称（如果有）或玩家显示名称
    const displayName = getDisplayNameForUser(userId, members, characters);

    actionMessages.push({
      id: crypto.randomUUID(),
      role: "user",
      content: formatPlayerAction(displayName, action.content),
      createdAt: action.submittedAt,
      metadata: {
        type: "player_action",
        turnNumber,
        playerId: userId,
        playerName: displayName,
        conversationId,
      },
    });
  }

  // 3. 创建 AI 响应消息
  const aiMessage: ConvertedMessage = {
    id: crypto.randomUUID(),
    role: "assistant",
    content: aiResponse,
    createdAt: now,
    metadata: {
      type: "ai_response",
      turnNumber,
      conversationId,
    },
  };

  // 组合所有消息
  const messages: ConvertedMessage[] = [
    separator,
    ...actionMessages,
    aiMessage,
  ];

  return {
    messages,
    separator,
    actionMessages,
    aiMessage,
  };
}

/**
 * 将转换后的消息转换为标准 Message 实体格式
 *
 * @param converted 转换后的消息
 * @param conversationId 会话 ID
 * @returns Message 实体
 */
export function toMessageEntity(
  converted: ConvertedMessage,
  conversationId: string
): Message {
  return {
    id: converted.id,
    role: converted.role,
    content: converted.content,
    status: "complete",
    conversationId,
    createdAt: converted.createdAt,
    updatedAt: converted.createdAt,
    metadata: converted.metadata,
  };
}

/**
 * 批量转换为 Message 实体
 *
 * @param convertedMessages 转换后的消息列表
 * @param conversationId 会话 ID
 * @returns Message 实体列表
 */
export function toMessageEntities(
  convertedMessages: ConvertedMessage[],
  conversationId: string
): Message[] {
  return convertedMessages.map((msg) => toMessageEntity(msg, conversationId));
}
