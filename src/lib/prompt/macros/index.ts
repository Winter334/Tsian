/**
 * 宏系统模块入口
 *
 * 导出所有宏系统相关的类型、函数和实例
 */

// 类型导出
export { MemoryVariableStorage } from "./types";
export type {
  MacroDefinition,
  MacroHandler,
  MacroRegistry,
  MacroResult,
  VariableStorage,
} from "./types";

// 注册表
export { createMacroRegistry, macroRegistry } from "./registry";

// 变量存储
export {
  createVariableStorage,
  PersistentVariableStorage,
  variableStorage,
} from "./storage";

// 内置宏
export { builtinMacros } from "./builtins";

// 解析器
export { createMacroParser, MacroParser, macroParser } from "./parser";
export type { MacroParserConfig, MacroParseResult } from "./parser";
