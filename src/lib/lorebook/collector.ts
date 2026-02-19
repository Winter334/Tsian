/**
 * 世界书内容收集器
 *
 * 编排激活流程：
 * 1. 从 Store 获取激活的世界书
 * 2. 调用激活引擎收集激活条目
 * 3. 解析条目中的变量模板
 * 4. 组装最终内容
 *
 * 这是消息组装器调用世界书系统的入口点。
 */

import { variableResolver } from "@/lib/prompt/resolver";
import type { VariableContext } from "@/lib/prompt/types";
import { collectActivatedEntriesFromAll } from "./activator";
import { useLorebookStore } from "./store";
import type { Lorebook, LorebookEntry } from "./types";

/**
 * 收集世界书内容
 *
 * 供消息组装器在处理 worldInfo Marker 时调用。
 * 从所有激活的世界书中收集匹配的条目，解析变量后拼接为最终文本。
 *
 * @param context 变量上下文（包含 chatHistory 用于关键字扫描）
 * @returns 拼接后的世界书内容字符串
 */
export async function collectWorldInfoContent(
  context: VariableContext
): Promise<string> {
  const store = useLorebookStore.getState();

  // 如果 store 未初始化，返回空内容
  if (!store.initialized) {
    return "";
  }

  // 获取所有激活的世界书
  const activeLorebooks = await store.getActiveLorebooks();

  if (activeLorebooks.length === 0) {
    return "";
  }

  // 收集激活条目
  const activatedEntries = collectActivatedEntriesFromAll(
    activeLorebooks,
    context.chatHistory
  );

  if (activatedEntries.length === 0) {
    return "";
  }

  // 组装内容
  return assembleContent(activatedEntries, context);
}

/**
 * 同步版本的收集函数
 *
 * 使用已缓存的世界书数据进行收集，不触发异步加载。
 * 适用于已确认世界书数据已加载到缓存的场景。
 *
 * @param context 变量上下文
 * @returns 拼接后的世界书内容字符串
 */
export function collectWorldInfoContentSync(context: VariableContext): string {
  const store = useLorebookStore.getState();

  if (!store.initialized) {
    return "";
  }

  // 从缓存中获取激活的世界书
  const activeLorebooks: Lorebook[] = [];
  for (const id of store.activeLorebookIds) {
    const cached = store.loadedLorebooks.get(id);
    if (cached) {
      activeLorebooks.push(cached);
    }
  }

  if (activeLorebooks.length === 0) {
    return "";
  }

  // 收集激活条目
  const activatedEntries = collectActivatedEntriesFromAll(
    activeLorebooks,
    context.chatHistory
  );

  if (activatedEntries.length === 0) {
    return "";
  }

  return assembleContent(activatedEntries, context);
}

/**
 * 组装激活条目内容
 *
 * @param entries 激活的条目列表（已排序）
 * @param context 变量上下文（用于解析条目中的变量模板）
 * @returns 拼接后的内容
 */
function assembleContent(
  entries: LorebookEntry[],
  context: VariableContext
): string {
  return entries
    .map((entry) => {
      // 解析条目中的变量模板
      const resolved = variableResolver.resolve(entry.content, context);
      return resolved.content;
    })
    .filter((content) => content.trim().length > 0)
    .join("\n\n");
}
