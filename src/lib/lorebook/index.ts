/**
 * 世界书（Lorebook）模块导出
 *
 * 世界书服务于 Lyra 四层内容配置体系中的「设定层 Lore」，
 * 为 Narrator AI 提供世界观、地点、角色背景等设定信息。
 */

// 类型
export { DEFAULT_LOREBOOK_SETTINGS } from "./types";
export type {
  ActivationStrategy,
  Lorebook,
  LorebookEntry,
  LorebookSettings,
} from "./types";

// 存储层
export { lorebookStorage } from "./storage";
export type { LorebookIndex, LorebookStorage } from "./storage";

// Store
export { useLorebookStore } from "./store";

// 激活引擎（纯函数）
export {
  buildScanText,
  collectActivatedEntries,
  collectActivatedEntriesFromAll,
  matchKeywords,
  shouldActivateEntry,
} from "./activator";

// 内容收集器
export {
  collectWorldInfoContent,
  collectWorldInfoContentSync,
} from "./collector";

// 默认世界书
export { defaultLorebook } from "./presets/default";
