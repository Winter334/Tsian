/**
 * 宏系统类型定义
 *
 * 酒馆脚本宏系统的可扩展框架
 * 支持变量宏、随机宏、注释宏等
 */

import type { VariableContext } from "../types";

// ============================================
// 宏基础类型
// ============================================

/**
 * 宏执行结果
 */
export interface MacroResult {
  /** 替换后的内容（如果是空字符串则表示删除该宏） */
  content: string;
  /** 是否有副作用（如设置变量） */
  hasSideEffect?: boolean;
}

/**
 * 宏处理器函数
 * @param args - 宏参数（由分隔符分割后的数组）
 * @param context - 变量上下文
 * @param storage - 变量存储接口
 * @returns 宏执行结果
 */
export type MacroHandler = (
  args: string[],
  context: VariableContext,
  storage: VariableStorage
) => MacroResult;

/**
 * 宏定义
 */
export interface MacroDefinition {
  /** 宏名称（如 "getvar", "roll"） */
  name: string;
  /** 参数分隔符（酒馆脚本中变量宏用 "::"，函数宏用 ":"） */
  separator: "::" | ":";
  /** 宏处理器 */
  handler: MacroHandler;
  /** 描述（用于调试和文档） */
  description?: string;
}

// ============================================
// 变量存储接口
// ============================================

/**
 * 变量存储接口
 * 支持本地变量（对话级）和全局变量
 */
export interface VariableStorage {
  // 本地变量（对话级）
  getLocal(name: string): string | undefined;
  setLocal(name: string, value: string): void;
  deleteLocal(name: string): void;
  getAllLocal(): Record<string, string>;

  // 全局变量
  getGlobal(name: string): string | undefined;
  setGlobal(name: string, value: string): void;
  deleteGlobal(name: string): void;
  getAllGlobal(): Record<string, string>;
}

/**
 * 内存变量存储实现（用于测试或单次解析）
 */
export class MemoryVariableStorage implements VariableStorage {
  private localVars = new Map<string, string>();
  private globalVars = new Map<string, string>();

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

  getGlobal(name: string): string | undefined {
    return this.globalVars.get(name);
  }

  setGlobal(name: string, value: string): void {
    this.globalVars.set(name, value);
  }

  deleteGlobal(name: string): void {
    this.globalVars.delete(name);
  }

  getAllGlobal(): Record<string, string> {
    return Object.fromEntries(this.globalVars);
  }
}

// ============================================
// 宏注册表接口
// ============================================

/**
 * 宏注册表接口
 */
export interface MacroRegistry {
  /** 注册宏 */
  register(macro: MacroDefinition): void;

  /** 获取宏定义 */
  get(name: string): MacroDefinition | undefined;

  /** 获取所有宏名称 */
  list(): string[];

  /** 检查宏是否存在 */
  has(name: string): boolean;
}
