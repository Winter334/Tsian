/**
 * 提示词系统模块导出
 */

// 类型
export type {
  CharacterInfo,
  GameStateSnapshot,
  MarkerType,
  MessageAssembler,
  PlayerAction,
  PlayerInfo,
  Preset,
  PresetPurpose,
  PromptBlock,
  ResolveResult,
  TurnInfo,
  VariableContext,
  VariableResolver,
} from "./types";

// 存储层
export { presetStorage } from "./storage";
export type { PresetIndex, PresetStorage } from "./storage";

// 预设 Store
export { usePresetStore } from "./store";

// 变量解析器
export { createVariableResolver, variableResolver } from "./resolver";

// 消息组装器
export { createMessageAssembler, messageAssembler } from "./assembler";

// 默认预设
export { defaultPreset } from "./presets/default";
export { defaultDirectorPreset } from "./presets/default-director";
export { defaultParserPreset } from "./presets/default-parser";
export { defaultSummarizerPreset } from "./presets/default-summarizer";

// 协议冻结常量
export * from "./constants";

// 工具函数
export { createQuickPreset } from "./utils";

// 默认预设工具
export { getDefaultPresetForPurpose } from "./normalize";

// 宏系统
export {
  // 内置宏
  builtinMacros,
  createMacroParser,
  createMacroRegistry,
  createVariableStorage,
  // 解析器
  MacroParser,
  macroParser,
  // 注册表
  macroRegistry,
  MemoryVariableStorage,
  // 变量存储
  PersistentVariableStorage,
  variableStorage,
} from "./macros";
export type {
  MacroDefinition,
  MacroHandler,
  MacroParserConfig,
  MacroParseResult,
  MacroRegistry,
  MacroResult,
  VariableStorage,
} from "./macros";

// 转换器
export {
  convertTavernToLyra,
  exportLyraPreset,
  importLyraPreset,
  isLyraExportFormat,
  isLyraPreset,
  isTavernPreset,
} from "./converters";
export type {
  ConversionResult,
  ConversionWarning,
  LyraExportFormat,
  TavernPreset,
} from "./converters";
