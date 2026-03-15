/**
 * Director 模块类型定义
 */

// === 剧情大纲 ===
export interface PlotOutline {
  currentArc: StoryArc;
  completedArcs: StoryArc[];
  plannedArcs: StoryArc[];
}

export interface StoryArc {
  id: string;
  title: string;
  premise: string; // 核心冲突/目标
  milestones: Milestone[];
  involvedEntityIds: string[];
  status: "active" | "completed" | "abandoned" | "modified";
  deviations: string[]; // 玩家行动导致的偏离记录
}

export interface Milestone {
  id: string;
  description: string;
  triggerConditions: string; // 自然语言触发条件
  effects: string; // 触发后效果
  status: "pending" | "triggered" | "skipped";
}

// === 伏笔系统 ===
export interface Foreshadow {
  id: string;
  description: string;
  plantedAtTurn: number;
  triggerCondition: string;
  revealEffect: string;
  status: "planted" | "hinted" | "revealed" | "abandoned";
  hintCount: number;
  relatedEntityIds: string[];
}

// === 导演决策日志 ===
export interface DirectorLogEntry {
  turn: number;
  timestamp: number;
  plotDirectives: string;
  turnNarrativeIntent: string;
  narrativeHints: string;
  archiveUpdatesSummary: string; // 档案更新摘要
  outlineUpdatesSummary?: string; // 大纲更新摘要
}

// === 大纲更新指令（导演 AI 输出） ===
// 导演 AI 输出 outlineUpdates 字符串，系统暂不做结构化解析
// Phase B 再实现结构化的大纲更新

// === 导演 AI 解析结果 ===
export interface DirectorOutput {
  plotDirectives: string;
  turnNarrativeIntent: string;
  narrativeHints: string;
  archiveUpdatesRaw: string; // 原始 XML 内容
  outlineUpdatesRaw?: string; // 原始 XML 内容
  /** 解析是否发生降级（缺失必填标签） */
  degraded?: boolean;
  /** 解析警告信息（缺失的标签名等） */
  parseWarnings?: string[];
}
