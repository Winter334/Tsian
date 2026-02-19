/**
 * 宏解析器
 *
 * 负责解析和执行宏模板
 */

import type { VariableContext } from "../types";
import { builtinMacros } from "./builtins";
import { macroRegistry } from "./registry";
import { variableStorage } from "./storage";
import type { MacroRegistry, VariableStorage } from "./types";

/**
 * 宏解析结果
 */
export interface MacroParseResult {
  /** 解析后的内容 */
  content: string;
  /** 解析过程中的警告 */
  warnings: Array<{
    macro: string;
    reason: string;
  }>;
  /** 是否有副作用（如设置变量） */
  hasSideEffects: boolean;
}

/**
 * 宏解析器配置
 */
export interface MacroParserConfig {
  /** 使用的宏注册表 */
  registry?: MacroRegistry;
  /** 使用的变量存储 */
  storage?: VariableStorage;
}

/**
 * 宏解析器类
 */
export class MacroParser {
  private registry: MacroRegistry;
  private storage: VariableStorage;
  private initialized = false;

  constructor(config?: MacroParserConfig) {
    this.registry = config?.registry || macroRegistry;
    this.storage = config?.storage || variableStorage;
  }

  /**
   * 初始化解析器（注册内置宏）
   */
  initialize(): void {
    if (this.initialized) return;

    // 注册所有内置宏
    for (const macro of builtinMacros) {
      this.registry.register(macro);
    }

    this.initialized = true;
  }

  /**
   * 解析宏模板
   */
  parse(template: string, context: VariableContext): MacroParseResult {
    // 确保已初始化
    if (!this.initialized) {
      this.initialize();
    }

    const warnings: MacroParseResult["warnings"] = [];
    let hasSideEffects = false;

    // 先处理注释宏 {{//...}}
    let content = template.replace(/\{\{\/\/[^}]*\}\}/g, "");

    // 正则匹配 {{macro...}}
    // 支持 :: 和 : 两种分隔符
    const macroPattern = /\{\{([^}]+)\}\}/g;

    content = content.replace(macroPattern, (match, expression) => {
      const trimmed = expression.trim();

      // 跳过已处理的注释
      if (trimmed.startsWith("//")) {
        return "";
      }

      // 尝试解析宏
      // 先尝试 :: 分隔符（变量宏）
      if (trimmed.includes("::")) {
        const parts = trimmed.split("::");
        const macroName = parts[0].trim();
        const args = parts.slice(1);

        const macroDef = this.registry.get(macroName);
        if (macroDef && macroDef.separator === "::") {
          try {
            const result = macroDef.handler(args, context, this.storage);
            if (result.hasSideEffect) {
              hasSideEffects = true;
            }
            return result.content;
          } catch (error) {
            warnings.push({
              macro: match,
              reason: `宏执行失败: ${
                error instanceof Error ? error.message : String(error)
              }`,
            });
            return match;
          }
        }
      }

      // 尝试 : 分隔符（函数宏）
      if (trimmed.includes(":")) {
        const colonIndex = trimmed.indexOf(":");
        const macroName = trimmed.substring(0, colonIndex).trim();
        const argsStr = trimmed.substring(colonIndex + 1);

        const macroDef = this.registry.get(macroName);
        if (macroDef && macroDef.separator === ":") {
          try {
            const result = macroDef.handler([argsStr], context, this.storage);
            if (result.hasSideEffect) {
              hasSideEffects = true;
            }
            return result.content;
          } catch (error) {
            warnings.push({
              macro: match,
              reason: `宏执行失败: ${
                error instanceof Error ? error.message : String(error)
              }`,
            });
            return match;
          }
        }
      }

      // 不是已注册的宏，保留原样（可能是基础变量如 {{user}}）
      return match;
    });

    return { content, warnings, hasSideEffects };
  }

  /**
   * 注册自定义宏
   */
  registerMacro(
    name: string,
    separator: "::" | ":",
    handler: (
      args: string[],
      context: VariableContext,
      storage: VariableStorage
    ) => { content: string; hasSideEffect?: boolean }
  ): void {
    this.registry.register({ name, separator, handler });
  }
}

/**
 * 全局宏解析器实例
 */
export const macroParser = new MacroParser();

// 自动初始化
macroParser.initialize();

/**
 * 创建宏解析器实例（用于测试或隔离场景）
 */
export function createMacroParser(config?: MacroParserConfig): MacroParser {
  const parser = new MacroParser(config);
  parser.initialize();
  return parser;
}
