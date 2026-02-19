/**
 * 变量存储实现
 *
 * 提供本地变量（对话级）和全局变量的持久化存储
 */

import type { VariableStorage } from "./types";

// 全局变量的 localStorage key
const GLOBAL_VARS_KEY = "lyra:global-variables";

/**
 * 持久化变量存储实现
 *
 * - 本地变量：存储在内存中，与对话生命周期绑定
 * - 全局变量：存储在 localStorage 中，跨对话持久化
 */
export class PersistentVariableStorage implements VariableStorage {
  /** 本地变量（对话级） */
  private localVars = new Map<string, string>();

  /** 对话 ID（用于标识不同对话的变量） */
  private conversationId: string | null = null;

  constructor(conversationId?: string) {
    this.conversationId = conversationId || null;
  }

  /**
   * 设置对话 ID
   * 当切换对话时调用，会清空本地变量
   */
  setConversationId(id: string): void {
    if (this.conversationId !== id) {
      this.localVars.clear();
      this.conversationId = id;
    }
  }

  // ============================================
  // 本地变量操作
  // ============================================

  getLocal(name: string): string | undefined {
    return this.localVars.get(name);
  }

  setLocal(name: string, value: string): void {
    this.localVars.set(name, value);
  }

  deleteLocal(name: string): void {
    this.localVars.delete(name);
  }

  getAllLocal(): Record<string, string> {
    return Object.fromEntries(this.localVars);
  }

  /**
   * 清空所有本地变量
   */
  clearLocal(): void {
    this.localVars.clear();
  }

  // ============================================
  // 全局变量操作
  // ============================================

  getGlobal(name: string): string | undefined {
    const globals = this.loadGlobalVars();
    return globals[name];
  }

  setGlobal(name: string, value: string): void {
    const globals = this.loadGlobalVars();
    globals[name] = value;
    this.saveGlobalVars(globals);
  }

  deleteGlobal(name: string): void {
    const globals = this.loadGlobalVars();
    delete globals[name];
    this.saveGlobalVars(globals);
  }

  getAllGlobal(): Record<string, string> {
    return this.loadGlobalVars();
  }

  /**
   * 清空所有全局变量
   */
  clearGlobal(): void {
    this.saveGlobalVars({});
  }

  // ============================================
  // 私有方法
  // ============================================

  private loadGlobalVars(): Record<string, string> {
    try {
      const data = localStorage.getItem(GLOBAL_VARS_KEY);
      if (data) {
        return JSON.parse(data);
      }
    } catch (error) {
      console.warn("[VariableStorage] 加载全局变量失败:", error);
    }
    return {};
  }

  private saveGlobalVars(vars: Record<string, string>): void {
    try {
      localStorage.setItem(GLOBAL_VARS_KEY, JSON.stringify(vars));
    } catch (error) {
      console.warn("[VariableStorage] 保存全局变量失败:", error);
    }
  }
}

/**
 * 全局变量存储实例
 */
export const variableStorage = new PersistentVariableStorage();

/**
 * 创建变量存储实例（用于测试或隔离场景）
 */
export function createVariableStorage(
  conversationId?: string
): PersistentVariableStorage {
  return new PersistentVariableStorage(conversationId);
}
