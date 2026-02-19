/**
 * 消息组装器
 *
 * 负责根据预设和变量上下文组装最终的 AI 消息列表
 */

import type { Message as AIMessage } from "@/lib/ai/types";
import { getMarkerById } from "./marker-registry";
import { variableResolver } from "./resolver";
import type {
  MessageAssembler,
  Preset,
  PromptBlock,
  VariableContext,
} from "./types";

/**
 * 默认消息组装器实现
 */
class DefaultMessageAssembler implements MessageAssembler {
  /**
   * Marker 块上一次组装的缓存
   * key: blockId, value: 该 Marker 块解析后产生的消息数组
   */
  private markerCache = new Map<string, AIMessage[]>();

  /**
   * 根据预设和变量上下文组装消息
   */
  assemble(preset: Preset, context: VariableContext): AIMessage[] {
    const messages: AIMessage[] = [];

    // 按照 blockOrder 顺序处理提示词块
    const orderedBlocks = this.getOrderedBlocks(preset);

    for (const block of orderedBlocks) {
      // 跳过未启用的块
      if (!block.enabled) {
        continue;
      }

      // 处理 Marker 块
      if (block.marker) {
        const markerMessages = this.resolveMarker(block, context);
        // 缓存本次 Marker 块的解析结果
        this.markerCache.set(block.id, markerMessages);
        messages.push(...markerMessages);
      } else {
        // 处理普通块
        const message = this.resolveBlock(block, context);
        if (message) {
          messages.push(message);
        }
      }
    }

    return messages;
  }

  /**
   * 获取指定 Marker 块上一次组装时的解析结果
   */
  getLastMarkerResult(blockId: string): AIMessage[] {
    return this.markerCache.get(blockId) ?? [];
  }

  /**
   * 获取排序后的提示词块
   */
  private getOrderedBlocks(preset: Preset): PromptBlock[] {
    const blockMap = new Map(preset.blocks.map((b) => [b.id, b]));
    const orderedBlocks: PromptBlock[] = [];

    for (const id of preset.blockOrder) {
      const block = blockMap.get(id);
      if (block) {
        orderedBlocks.push(block);
      }
    }

    // 添加未在 blockOrder 中的块（按 order 排序）
    for (const block of preset.blocks) {
      if (!preset.blockOrder.includes(block.id)) {
        orderedBlocks.push(block);
      }
    }

    return orderedBlocks;
  }

  /**
   * 解析普通提示词块
   */
  private resolveBlock(
    block: PromptBlock,
    context: VariableContext
  ): AIMessage | null {
    // 解析变量
    const resolved = variableResolver.resolve(block.content, context);

    // 如果内容为空，跳过
    if (!resolved.content.trim()) {
      return null;
    }

    // 输出警告（如果有）
    if (resolved.warnings.length > 0) {
      console.warn(
        `[Prompt] Block "${block.name}" has warnings:`,
        resolved.warnings
      );
    }

    return {
      role: block.role,
      content: resolved.content,
    };
  }

  /**
   * 解析 Marker 块（委托给注册表）
   */
  private resolveMarker(
    block: PromptBlock,
    context: VariableContext
  ): AIMessage[] {
    const entry = getMarkerById(block.markerType!);
    if (!entry) {
      console.warn(`[Prompt] Unknown marker type: ${block.markerType}`);
      return [];
    }

    // 多消息模式（chatHistory）
    if (entry.multiMessage && entry.renderMessages) {
      return entry.renderMessages(context, block);
    }

    // 单消息模式：调用共享 render
    const content = entry.render(context);
    if (!content.trim()) {
      return [];
    }

    return [{ role: block.role, content }];
  }
}

/**
 * 全局消息组装器实例
 */
export const messageAssembler: MessageAssembler = new DefaultMessageAssembler();

/**
 * 创建消息组装器实例（用于测试或隔离场景）
 */
export function createMessageAssembler(): MessageAssembler {
  return new DefaultMessageAssembler();
}
