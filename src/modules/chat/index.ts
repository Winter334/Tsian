/**
 * Chat 模块入口
 *
 * 职责：
 * - 消息收发
 * - 与 AI 对话
 * - 会话管理
 */

import { registry } from "@/core";
import type { ModuleManifest } from "@/core/registry";
import { yjsManager } from "@/core/yjs";
import { ChatCommands } from "@/domain/commands/chat";
import { createConversation } from "@/domain/entities/conversation";
import { createMessage } from "@/domain/entities/message";
import { ChatEvents } from "@/domain/events/chat";
import {
  SaveEvents,
  type SaveDeletedPayload,
  type SaveLoadedPayload,
} from "@/domain/events/save";
import {
  getRuntimeWorldNarrative,
  worldNarrativeToYMap,
} from "@/lib/world/resolve-config";
import { snapshotRegistry } from "@/modules/checkpoint/snapshot-api";
import { createChatCommandHandlers } from "./commands/handlers";
import { getChatRepository, resetChatRepository } from "./repository/factory";
import { chatSnapshotFields } from "./snapshot";
import { useChatUIStore } from "./store/ui-store";

function injectOpeningIfNeeded(
  conversationId: string,
  saveType: SaveLoadedPayload["saveType"],
): void {
  if (saveType !== "solo") {
    return;
  }

  const narrative = getRuntimeWorldNarrative();
  const opening = narrative.opening?.trim();
  if (!opening || narrative.openingInjected) {
    return;
  }

  const repository = getChatRepository();
  const currentSave = yjsManager.getCurrentSave();
  if (!currentSave) {
    return;
  }

  const updateInjectedFlag = (): void => {
    currentSave.set(
      "worldNarrative",
      worldNarrativeToYMap({
        ...narrative,
        openingInjected: true,
      }),
    );
  };

  if (repository.getMessageCount(conversationId) > 0) {
    updateInjectedFlag();
    return;
  }

  const createdAt = Date.now();
  const openingMessage = {
    ...createMessage({
      role: "assistant",
      content: opening,
      conversationId,
      metadata: {
        type: "opening",
        conversationId,
      },
    }),
    status: "complete" as const,
    createdAt,
    updatedAt: createdAt,
  };
  repository.addMessage(conversationId, openingMessage);
  updateInjectedFlag();
}

/**
 * 确保存档内有默认会话
 * 如果没有会话，自动创建一个
 * 总是设置 currentConversationId 为当前存档的会话
 */
function ensureDefaultConversation(
  saveType: SaveLoadedPayload["saveType"],
): void {
  try {
    const repository = getChatRepository();
    const uiStore = useChatUIStore.getState();
    const conversations = repository.getAllConversations();

    let targetConversationId: string;

    if (conversations.length === 0) {
      // 创建默认会话
      const defaultConversation = createConversation({
        title: "新游戏",
      });
      repository.addConversation(defaultConversation);
      targetConversationId = defaultConversation.id;
    } else {
      // 存档已有会话，选择最近更新的
      // 注意：总是设置，因为切换存档后旧的 conversationId 不再有效
      const sorted = [...conversations].sort(
        (a, b) => b.updatedAt - a.updatedAt,
      );
      targetConversationId = sorted[0].id;
    }

    injectOpeningIfNeeded(targetConversationId, saveType);

    // 设置为当前会话
    uiStore.setCurrentConversation(targetConversationId);
  } catch {
    // 确保默认会话失败，静默处理
  }
}

/**
 * Chat 模块 Manifest
 */
const manifest: ModuleManifest = {
  id: "lyra.chat",
  version: "0.1.0",
  commands: createChatCommandHandlers(),
  eventHandlers: {
    // 监听存档加载事件
    // 注意：createSaveHandler 会依次 emit SAVE_CREATED + SAVE_LOADED，
    // chat 只需响应 SAVE_LOADED 即可避免双重执行
    [SaveEvents.SAVE_LOADED]: (event) => {
      // 1. 重置 Repository（切换存档后需要重新创建）
      resetChatRepository();

      const payload = event.payload as SaveLoadedPayload;

      // 2. 确保有默认会话（会自动设置 currentConversationId）
      ensureDefaultConversation(payload.saveType);
    },

    // 监听存档删除事件
    [SaveEvents.SAVE_DELETED]: (event) => {
      // 只在删除当前存档时才清理状态
      const payload = event.payload as SaveDeletedPayload;
      if (payload.isCurrentSave) {
        resetChatRepository();
        const uiStore = useChatUIStore.getState();
        uiStore.setCurrentConversation(null);
      }
    },
  },
};

/**
 * 注册 Chat 模块
 */
export async function registerChatModule(): Promise<void> {
  await registry.register(manifest);
  snapshotRegistry.register("lyra.chat", chatSnapshotFields);
}

/**
 * 注销 Chat 模块
 */
export async function unregisterChatModule(): Promise<void> {
  snapshotRegistry.unregister("lyra.chat");
  await registry.unregister("lyra.chat");
}

// 导出类型和常量供外部使用
export * from "./components";
export * from "./hooks";
export * from "./store";
export { ChatCommands, ChatEvents };
