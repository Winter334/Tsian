/**
 * 世界书激活引擎
 *
 * 纯函数模块，负责判断世界书条目是否应被激活。
 * 不依赖任何状态管理，便于测试和复用。
 */

import type { Message } from "@/lib/ai/types";
import type { Lorebook, LorebookEntry, LorebookSettings } from "./types";

// ===== 扫描文本构建 =====

/**
 * 从聊天历史中构建扫描文本
 *
 * @param chatHistory 完整聊天历史
 * @param scanDepth 扫描深度（最近 N 条消息）
 * @returns 拼接后的扫描文本
 */
export function buildScanText(
  chatHistory: Message[],
  scanDepth: number
): string {
  if (scanDepth <= 0 || chatHistory.length === 0) {
    return "";
  }

  const recentMessages = chatHistory.slice(-scanDepth);
  return recentMessages.map((m) => m.content).join("\n");
}

// ===== 关键字匹配 =====

/**
 * 检查扫描文本是否匹配关键字列表（OR 逻辑）
 *
 * @param scanText 待扫描的文本
 * @param keywords 关键字列表
 * @param caseSensitive 是否区分大小写
 * @returns 是否匹配（任一关键字出现即为 true）
 */
export function matchKeywords(
  scanText: string,
  keywords: string[],
  caseSensitive: boolean
): boolean {
  if (keywords.length === 0) {
    return false;
  }

  return keywords.some((keyword) => {
    if (!keyword.trim()) return false;

    if (caseSensitive) {
      return scanText.includes(keyword);
    }
    return scanText.toLowerCase().includes(keyword.toLowerCase());
  });
}

// ===== 条目激活判定 =====

/**
 * 判断单个条目是否应被激活
 *
 * @param entry 世界书条目
 * @param settings 世界书全局设置
 * @param chatHistory 聊天历史
 * @returns 是否激活
 */
export function shouldActivateEntry(
  entry: LorebookEntry,
  settings: LorebookSettings,
  chatHistory: Message[]
): boolean {
  // 未启用的条目不激活
  if (!entry.enabled) {
    return false;
  }

  // 常量策略：始终激活
  if (entry.activationStrategy === "constant") {
    return true;
  }

  // 关键字策略：扫描聊天历史
  if (entry.activationStrategy === "selective") {
    const depth = entry.scanDepth ?? settings.defaultScanDepth;
    const scanText = buildScanText(chatHistory, depth);

    return matchKeywords(
      scanText,
      entry.primaryKeywords,
      settings.caseSensitive
    );
  }

  return false;
}

// ===== 批量收集激活条目 =====

/**
 * 从单个世界书中收集所有激活的条目
 *
 * @param lorebook 世界书
 * @param chatHistory 聊天历史
 * @returns 激活的条目列表（已按 order 排序）
 */
export function collectActivatedEntries(
  lorebook: Lorebook,
  chatHistory: Message[]
): LorebookEntry[] {
  const activated: LorebookEntry[] = [];

  for (const entry of lorebook.entries) {
    if (shouldActivateEntry(entry, lorebook.settings, chatHistory)) {
      activated.push(entry);
    }
  }

  // 按 order 排序（越小越靠前）
  return activated.sort((a, b) => a.order - b.order);
}

/**
 * 从多个世界书中收集所有激活的条目
 *
 * @param lorebooks 世界书列表
 * @param chatHistory 聊天历史
 * @returns 激活的条目列表（先按世界书顺序，再按条目 order 排序）
 */
export function collectActivatedEntriesFromAll(
  lorebooks: Lorebook[],
  chatHistory: Message[]
): LorebookEntry[] {
  const allActivated: LorebookEntry[] = [];

  for (const lorebook of lorebooks) {
    const activated = collectActivatedEntries(lorebook, chatHistory);
    allActivated.push(...activated);
  }

  return allActivated;
}
