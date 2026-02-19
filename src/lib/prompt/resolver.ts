/**
 * 变量解析器
 *
 * 负责解析提示词中的变量模板（如 {{user}}, {{char}}, {{scenario}} 等）
 * 以及酒馆脚本宏（如 {{roll:d20}}, {{getvar::name}} 等）
 */

import { macroParser } from "./macros";
import { findMarkerByIdOrAlias } from "./marker-registry";
import type {
  ResolveResult,
  VariableContext,
  VariableResolver,
} from "./types";

/**
 * 变量解析器实现
 */
class DefaultVariableResolver implements VariableResolver {
  private customVariables = new Map<string, (ctx: VariableContext) => string>();
  private customFunctions = new Map<
    string,
    (args: string[], ctx: VariableContext) => string
  >();

  /**
   * 解析变量模板
   * 处理顺序：
   * 1. 先解析酒馆脚本宏（变量宏、随机宏、注释宏等）
   * 2. 再解析基础变量（{{user}}, {{char}} 等）
   */
  resolve(template: string, context: VariableContext): ResolveResult {
    const warnings: ResolveResult["warnings"] = [];

    // 第一阶段：解析酒馆脚本宏
    const macroResult = macroParser.parse(template, context);
    let content = macroResult.content;

    // 合并宏解析的警告
    for (const w of macroResult.warnings) {
      warnings.push({
        variable: w.macro,
        reason: w.reason,
      });
    }

    // 第二阶段：解析基础变量
    const variablePattern = /\{\{([^}]+)\}\}/g;

    content = content.replace(variablePattern, (match, expression) => {
      const trimmed = expression.trim();

      // 跳过包含分隔符的表达式（这些应该已被宏解析器处理）
      // 如果还存在，说明是未知的宏，保留原样
      if (trimmed.includes("::") || trimmed.includes(":")) {
        // 检查是否是自定义函数
        if (trimmed.includes(":") && !trimmed.includes("::")) {
          const [funcName, argsStr] = trimmed.split(":", 2);
          const args = argsStr
            ? argsStr.split(",").map((s: string) => s.trim())
            : [];

          const handler = this.customFunctions.get(funcName.trim());
          if (handler) {
            try {
              return handler(args, context);
            } catch (error) {
              warnings.push({
                variable: match,
                reason: `函数调用失败: ${
                  error instanceof Error ? error.message : String(error)
                }`,
              });
              return match;
            }
          }
        }
        // 未知的宏或函数，保留原样
        return match;
      }

      // 尝试解析内置变量
      const value = this.resolveBuiltinVariable(trimmed, context, warnings);
      if (value !== undefined) {
        return value;
      }

      // 尝试解析自定义变量
      const customResolver = this.customVariables.get(trimmed);
      if (customResolver) {
        try {
          return customResolver(context);
        } catch (error) {
          warnings.push({
            variable: match,
            reason: `自定义变量解析失败: ${
              error instanceof Error ? error.message : String(error)
            }`,
          });
          return match;
        }
      }

      // 变量不存在，不再警告（可能是预期的保留变量）
      // 只有在严格模式下才警告
      return match;
    });

    return { content, warnings };
  }

  /**
   * 解析内置变量
   */
  private resolveBuiltinVariable(
    name: string,
    context: VariableContext,
    _warnings: ResolveResult["warnings"]
  ): string | undefined {
    // 优先查 Marker 注册表（按 id 或别名匹配）
    const entry = findMarkerByIdOrAlias(name);
    if (entry && !entry.multiMessage) {
      return entry.render(context);
    }

    // 非 Marker 变量保留 switch
    switch (name) {
      case "char":
        return this.resolveChar(context);

      case "turn":
        return context.turn ? String(context.turn.number) : "";

      case "date":
        return new Date().toLocaleDateString("zh-CN");

      case "time":
        return new Date().toLocaleTimeString("zh-CN");

      case "datetime":
        return new Date().toLocaleString("zh-CN");

      case "weekday":
        return new Date().toLocaleDateString("zh-CN", { weekday: "long" });

      case "personality":
        return "";

      case "group":
        if (context.mode === "multiplayer" && context.players) {
          return context.players.map((p) => p.name).join("、");
        }
        return "";

      default:
        return undefined;
    }
  }

  /**
   * 解析 {{char}} 变量
   */
  private resolveChar(context: VariableContext): string {
    if (context.mode === "solo") {
      return "AI 助手";
    } else {
      return "游戏主持人（GM）";
    }
  }

  /**
   * 注册自定义变量
   */
  registerVariable(
    name: string,
    resolver: (ctx: VariableContext) => string
  ): void {
    this.customVariables.set(name, resolver);
  }

  /**
   * 注册变量函数
   */
  registerFunction(
    name: string,
    handler: (args: string[], ctx: VariableContext) => string
  ): void {
    this.customFunctions.set(name, handler);
  }
}

/**
 * 全局变量解析器实例
 */
export const variableResolver: VariableResolver = new DefaultVariableResolver();

/**
 * 创建变量解析器实例（用于测试或隔离场景）
 */
export function createVariableResolver(): VariableResolver {
  return new DefaultVariableResolver();
}
