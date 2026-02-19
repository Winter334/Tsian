/**
 * 默认总结预设（Summarizer）
 *
 * 用于分段记忆系统将多条回合摘要压缩为一个连贯的大总结。
 */
import type { Preset } from "../types";

/**
 * Lyra 默认 Summarizer 预设
 */
export const defaultSummarizerPreset: Preset = {
  id: "default-summarizer",
  name: "默认总结预设",
  description: "用于分段记忆系统的自动总结",
  purpose: "summarizer",
  blocks: [
    {
      id: "summarizer-system",
      name: "总结系统提示词",
      role: "system",
      marker: false,
      content: `你是一个叙事摘要专家。你的任务是将多条回合摘要压缩为一个连贯的剧情概要。

要求：
1. 保留关键事件、重要 NPC 互动、状态变化
2. 保留伏笔线索和未解决的悬念
3. 保留地点转移和时间推进
4. 使用简洁但信息完整的叙述风格
5. 按时间顺序组织内容
6. 不要添加原文中没有的信息`,
      injectionDepth: 0,
      order: 0,
      enabled: true,
    },
  ],
  blockOrder: ["summarizer-system"],
  metadata: {
    version: "1.0.0",
    source: "lyra",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
};
