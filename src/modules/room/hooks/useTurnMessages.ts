/**
 * 回合消息 Hook
 *
 * 用于联机模式下展示回合消息
 * 结合 HistoryDoc 的归档消息和当前 TurnDoc 的实时数据
 *
 * ⚠️ 架构说明：
 * 使用 useTurnDocStatus 监听 TurnDoc 的同步状态，
 * 确保只有在 TurnDoc 同步完成后才设置观察器。
 */

import { subdocManager, yjsManager } from "@/core/yjs";
import type { Member, PlayerAction } from "@/core/yjs/room/types";
import type { Character } from "@/domain/entities/character";
import type { Message } from "@/domain/entities/message";
import { useCallback, useEffect, useState } from "react";
import * as Y from "yjs";
import {
  convertTurnToMessages,
  toMessageEntities,
} from "../services/turn-converter";
import { useRoomStore } from "../store";
import { useTurnDocStatus } from "./useTurnDocStatus";

/**
 * 回合消息状态
 */
export interface TurnMessagesState {
  /** 消息列表 */
  messages: Message[];
  /** 是否正在加载 */
  loading: boolean;
  /** 错误信息 */
  error: Error | null;
  /** 当前回合号 */
  currentTurn: number;
  /** AI 响应是否正在流式输出 */
  isStreaming: boolean;
}

/**
 * 回合消息 Hook 返回值
 */
export interface UseTurnMessagesReturn extends TurnMessagesState {
  /** 刷新消息 */
  refresh: () => void;
}

/**
 * 回合消息 Hook
 *
 * 特性：
 * 1. 从 HistoryDoc 加载历史消息（已完成回合）
 * 2. 从当前 TurnDoc 实时获取进行中的行动和 AI 响应
 * 3. 自动合并历史和实时消息
 * 4. 响应式更新
 *
 * @param roomId 房间 ID
 */
export function useTurnMessages(roomId: string | null): UseTurnMessagesReturn {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [currentTurn, setCurrentTurn] = useState(0);
  const [isStreaming, setIsStreaming] = useState(false);

  // 从 MainDoc 获取的当前回合号（用于 useTurnDocStatus）
  const [turnFromMain, setTurnFromMain] = useState(0);

  // 监听 MainDoc 连接状态
  const connectionStatus = useRoomStore((s) => s.connectionStatus);

  // 监听 TurnDoc 的同步状态
  const turnDocStatus = useTurnDocStatus(roomId, turnFromMain);

  // 会话 ID
  const conversationId = roomId ? `room:${roomId}:main` : null;

  /**
   * 从 SaveSlot 加载持久化的历史消息
   */
  const loadSaveSlotMessages = useCallback((): Message[] => {
    if (!conversationId) {
      return [];
    }

    try {
      const currentSaveId = yjsManager.getCurrentSaveId();
      if (!currentSaveId) {
        return [];
      }

      const saveSlot = yjsManager.getSaveSlots().get(currentSaveId) as
        | Y.Map<unknown>
        | undefined;
      if (!saveSlot) {
        return [];
      }

      const messagesMap = saveSlot.get("messages") as
        | Y.Map<Y.Array<unknown>>
        | undefined;
      if (!messagesMap) {
        return [];
      }

      const messagesArray = messagesMap.get(conversationId);
      if (!messagesArray) {
        return [];
      }

      const messages = messagesArray.toArray() as Message[];
      return messages;
    } catch {
      return [];
    }
  }, [conversationId]);

  /**
   * 从 HistoryDoc 加载实时消息（本次游戏新产生）
   */
  const loadHistoryDocMessages = useCallback(async (): Promise<Message[]> => {
    if (!roomId || !conversationId) {
      return [];
    }

    try {
      const historyDoc = await subdocManager.loadHistoryDoc(roomId);
      const messagesMap = historyDoc.getMap("messages") as Y.Map<
        Y.Array<unknown>
      >;
      const messagesArray = messagesMap.get(conversationId);

      if (!messagesArray) {
        return [];
      }

      return messagesArray.toArray() as Message[];
    } catch {
      return [];
    }
  }, [roomId, conversationId]);

  /**
   * 合并 SaveSlot 和 HistoryDoc 消息（去重）
   * SaveSlot 包含持久化的历史消息
   * HistoryDoc 包含本次游戏新产生的实时消息
   */
  const loadHistoryMessages = useCallback(async (): Promise<Message[]> => {
    // 1. 从 SaveSlot 加载持久化消息
    const saveSlotMessages = loadSaveSlotMessages();

    // 2. 从 HistoryDoc 加载实时消息
    const historyDocMessages = await loadHistoryDocMessages();

    // 3. 合并并去重（使用消息 ID）
    const messageMap = new Map<string, Message>();

    // 先添加 SaveSlot 消息
    for (const msg of saveSlotMessages) {
      messageMap.set(msg.id, msg);
    }

    // 再添加 HistoryDoc 消息（如果 ID 相同则覆盖，保持最新）
    for (const msg of historyDocMessages) {
      messageMap.set(msg.id, msg);
    }

    // 按创建时间排序
    const mergedMessages = Array.from(messageMap.values()).sort(
      (a, b) => a.createdAt - b.createdAt
    );

    return mergedMessages;
  }, [loadSaveSlotMessages, loadHistoryDocMessages]);

  /**
   * 从当前 TurnDoc 获取进行中的消息
   */
  const getCurrentTurnMessages = useCallback((): Message[] => {
    if (!roomId) {
      return [];
    }

    const mainDoc = subdocManager.getMainDoc(roomId);
    if (!mainDoc) {
      return [];
    }

    const configMap = mainDoc.getMap("config");
    const turnNumber = (configMap.get("currentTurnNumber") as number) || 0;

    if (turnNumber <= 0) {
      return [];
    }

    const turnDoc = subdocManager.getTurnDoc(roomId, turnNumber);
    if (!turnDoc) {
      return [];
    }

    // 获取成员信息
    const membersMap = mainDoc.getMap("members") as Y.Map<Member>;
    const members = new Map<string, Member>();
    membersMap.forEach((member, id) => {
      members.set(id, member);
    });

    // 获取角色信息（用于显示角色名称而非玩家名称）
    const charactersMap = mainDoc.getMap("characters") as Y.Map<Y.Map<unknown>>;
    const characters: Character[] = [];
    charactersMap.forEach((charMap) => {
      try {
        const character: Character = {
          id: charMap.get("id") as string,
          name: charMap.get("name") as string,
          controlType:
            (charMap.get("controlType") as Character["controlType"]) ??
            "player",
          description: charMap.get("description") as string | undefined,
          personality: charMap.get("personality") as string | undefined,
          appearance: charMap.get("appearance") as string | undefined,
          creatorUniqueTag: charMap.get("creatorUniqueTag") as string,
          operatorUserId: charMap.get("operatorUserId") as string,
          operatorUniqueTag: charMap.get("operatorUniqueTag") as string,
          status: charMap.get("status") as Character["status"],
          createdAt: charMap.get("createdAt") as number,
          updatedAt: charMap.get("updatedAt") as number,
          attributes: charMap.get("attributes") as
            | Record<string, unknown>
            | undefined,
          tags: charMap.get("tags") as Record<string, unknown> | undefined,
        };
        characters.push(character);
      } catch {
        // 角色提取失败，跳过
      }
    });

    // 获取玩家行动
    const actionsMap = turnDoc.getMap("actions") as Y.Map<PlayerAction>;
    const actions = new Map<string, PlayerAction>();
    actionsMap.forEach((action, userId) => {
      actions.set(userId, action);
    });

    // 获取 AI 响应
    const aiResponseText = turnDoc.getText("aiResponse");
    const aiResponse = aiResponseText.toString();

    // 检查回合状态
    const turnConfig = turnDoc.getMap("config");
    const status = turnConfig.get("status") as string;

    // 如果回合已完成，不需要这里生成消息（由 HistoryDoc 提供）
    if (status === "completed") {
      return [];
    }

    // 如果没有行动且没有 AI 响应，不生成消息
    if (actions.size === 0 && !aiResponse) {
      return [];
    }

    // 生成当前回合的消息（传入角色信息以显示角色名称）
    const result = convertTurnToMessages({
      turnNumber,
      actions,
      members,
      characters,
      aiResponse: aiResponse || "", // 可能为空（正在等待 AI 响应）
      completedAt: Date.now(),
      conversationId: conversationId!,
    });

    // 如果 AI 正在流式输出，标记最后一条消息为 streaming
    const messageEntities = toMessageEntities(result.messages, conversationId!);

    if (aiResponse && status === "processing") {
      setIsStreaming(true);
      // 标记 AI 消息为 streaming 状态
      const lastMsg = messageEntities[messageEntities.length - 1];
      if (lastMsg && lastMsg.role === "assistant") {
        lastMsg.status = "streaming";
      }
    } else {
      setIsStreaming(false);
    }

    return messageEntities;
  }, [roomId, conversationId]);

  /**
   * 刷新消息
   */
  const refresh = useCallback(async () => {
    if (!roomId) {
      setMessages([]);
      setCurrentTurn(0);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 加载历史消息
      const historyMessages = await loadHistoryMessages();

      // 获取当前回合消息
      const currentMessages = getCurrentTurnMessages();

      // 合并消息
      const mergedMessages = [...historyMessages, ...currentMessages];
      setMessages(mergedMessages);

      // 更新当前回合号
      const mainDoc = subdocManager.getMainDoc(roomId);
      if (mainDoc) {
        const configMap = mainDoc.getMap("config");
        const turnNumber = (configMap.get("currentTurnNumber") as number) || 0;
        setCurrentTurn(turnNumber);
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [roomId, loadHistoryMessages, getCurrentTurnMessages]);

  // Effect 1: MainDoc 同步后，监听当前回合号变化
  useEffect(() => {
    if (!roomId || connectionStatus !== "synced") {
      setTurnFromMain(0);
      return;
    }

    const mainDoc = subdocManager.getMainDoc(roomId);
    if (!mainDoc) {
      return;
    }

    const configMap = mainDoc.getMap("config");

    // 更新回合号并刷新
    const updateTurnNumber = () => {
      const turn = (configMap.get("currentTurnNumber") as number) || 0;
      setTurnFromMain(turn);
      setCurrentTurn(turn);
      // 回合号变化时触发刷新
      refresh();
    };

    // 初始化
    updateTurnNumber();

    // 监听配置变化（回合号变化）
    configMap.observe(updateTurnNumber);

    return () => {
      configMap.unobserve(updateTurnNumber);
    };
  }, [roomId, connectionStatus, refresh]);

  // Effect 2: TurnDoc 同步后，设置 TurnDoc 观察器
  useEffect(() => {
    // 只有当 TurnDoc 已同步才设置观察器
    if (!roomId || turnFromMain <= 0 || turnDocStatus !== "synced") {
      return;
    }

    // TurnDoc 同步完成，刷新一次
    refresh();

    // 设置 TurnDoc 观察器
    const turnDoc = subdocManager.getTurnDoc(roomId, turnFromMain);
    if (!turnDoc) {
      return;
    }

    const actionsMap = turnDoc.getMap("actions");
    const aiResponseText = turnDoc.getText("aiResponse");

    const observer = () => refresh();

    actionsMap.observe(observer);
    aiResponseText.observe(observer);

    return () => {
      actionsMap.unobserve(observer);
      aiResponseText.unobserve(observer);
    };
  }, [roomId, turnFromMain, turnDocStatus, refresh]);

  // Effect 3: roomId 变化时重置状态
  useEffect(() => {
    if (!roomId) {
      setMessages([]);
      setCurrentTurn(0);
      setTurnFromMain(0);
    }
  }, [roomId]);

  return {
    messages,
    loading,
    error,
    currentTurn,
    isStreaming,
    refresh,
  };
}
