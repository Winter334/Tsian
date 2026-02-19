/**
 * 宏注册表实现
 *
 * 管理所有已注册的宏处理器
 */

import type { MacroDefinition, MacroRegistry } from "./types";

/**
 * 默认宏注册表实现
 */
class DefaultMacroRegistry implements MacroRegistry {
  private macros = new Map<string, MacroDefinition>();

  register(macro: MacroDefinition): void {
    if (this.macros.has(macro.name)) {
      console.warn(`[MacroRegistry] 宏 "${macro.name}" 已存在，将被覆盖`);
    }
    this.macros.set(macro.name, macro);
  }

  get(name: string): MacroDefinition | undefined {
    return this.macros.get(name);
  }

  list(): string[] {
    return Array.from(this.macros.keys());
  }

  has(name: string): boolean {
    return this.macros.has(name);
  }
}

/**
 * 全局宏注册表实例
 */
export const macroRegistry: MacroRegistry = new DefaultMacroRegistry();

/**
 * 创建宏注册表实例（用于测试或隔离场景）
 */
export function createMacroRegistry(): MacroRegistry {
  return new DefaultMacroRegistry();
}
