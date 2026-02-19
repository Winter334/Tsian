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
import { ChatCommands } from "@/domain/commands/chat";
import { createConversation } from "@/domain/entities/conversation";
import { ChatEvents } from "@/domain/events/chat";
import { SaveEvents, type SaveDeletedPayload } from "@/domain/events/save";
import { createChatCommandHandlers } from "./commands/handlers";
import { getChatRepository, resetChatRepository } from "./repository/factory";
import { useChatUIStore } from "./store/ui-store";

/**
 * 确保存档内有默认会话
 * 如果没有会话，自动创建一个
 * 总是设置 currentConversationId 为当前存档的会话
 */
function ensureDefaultConversation(): void {
  try {
    const repository = getChatRepository();
    const uiStore = useChatUIStore.getState();
    const conversations = repository.getAllConversations();

    if (conversations.length === 0) {
      // 创建默认会话
      const defaultConversation = createConversation({
        title: "新游戏",
      });
      repository.addConversation(defaultConversation);

      // 设置为当前会话
      uiStore.setCurrentConversation(defaultConversation.id);
    } else {
      // 存档已有会话，选择最近更新的
      // 注意：总是设置，因为切换存档后旧的 conversationId 不再有效
      const sorted = [...conversations].sort(
        (a, b) => b.updatedAt - a.updatedAt
      );
      uiStore.setCurrentConversation(sorted[0].id);
    }
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
    [SaveEvents.SAVE_LOADED]: (_event) => {
      // 1. 重置 Repository（切换存档后需要重新创建）
      resetChatRepository();

      // 2. 确保有默认会话（会自动设置 currentConversationId）
      ensureDefaultConversation();
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
}

/**
 * 注销 Chat 模块
 */
export async function unregisterChatModule(): Promise<void> {
  await registry.unregister("lyra.chat");
}

// 导出类型和常量供外部使用
export * from "./components";
export * from "./hooks";
export * from "./store";
export { ChatCommands, ChatEvents };
