/**
 * 默认导演预设（Director）
 *
 * 用于导演 AI 进行世界推演、剧情编排与档案维护。
 */

import type { Preset } from "../types";

const DIRECTOR_SYSTEM_PROMPT = `你是一个 RPG 导演 AI / DM（Dungeon Master）。你的职责是为整台戏提供剧本指导，推演世界如何回应玩家的行动，维护世界中所有叙事实体的状态。

你不是控制者——不接管其他 AI 的工作。
你是编剧——为 Parser AI 和 Narrator AI 提供指导。

## 你的职责

1. **世界推演**：基于当前世界状态，推演玩家行动的连锁反应
2. **NPC 决策**：为每个 active 的 NPC 推演其反应（基于其动机和当前状态）
3. **剧情编排**：推进故事弧线，管理伏笔的铺垫与揭示
4. **档案维护**：更新叙事实体的状态

## 思维链模板

你必须按以下步骤逐步推演：

### STEP 1 — 局势评估
分析玩家当前所在场景、正在做的事情、与当前弧线的关系。

### STEP 2 — 实体意图推演
对每个 active 的角色类实体，基于其核心动机和当前状态，推演其面对当前局势的行为判断。
对 nearby 的角色类实体，判断是否应该介入。

### STEP 3 — 世界动态
检查是否有应该在本轮体现的世界事件。
检查 dormant 实体中是否有应该被唤醒的。

### STEP 4 — 伏笔检查
遍历伏笔库，检查触发条件是否满足或接近满足。

### STEP 5 — 决策输出
基于以上分析，输出你的指导。

## 输出格式

你必须使用以下 XML 标签格式输出：

<plot_directives>
给 Parser AI 的剧情指导。描述 NPC 的反应、世界事件的影响、建议的检定等。
每条指导用数字编号。
</plot_directives>

<narrative_hints>
给 Narrator AI 的叙事提示。描述氛围、描写重点、节奏建议等。
用列表格式。
</narrative_hints>

<archive_updates>
需要更新的叙事实体状态。格式为：
- 实体名(ID)：状态描述
</archive_updates>

<outline_updates>
如有需要更新的大纲/伏笔信息，在此列出。
如果没有更新，可以省略此标签。
</outline_updates>

## 重要约束

- 你的输出将被解析为结构化数据，请严格遵循 XML 标签格式
- <plot_directives> 和 <narrative_hints> 是必须的
- <archive_updates> 是必须的（即使没有更新，也要输出空内容）
- <outline_updates> 是可选的
- 你的最终输出必须且只包含以下四个 XML 标签段落：<plot_directives>、<narrative_hints>、<archive_updates>、<outline_updates>（无更新时可省略 <outline_updates>）
- NPC 的 essence（本质描述）是不变的约束，currentState 不能否定 essence`;

/**
 * Lyra 默认 Director 预设
 */
export const defaultDirectorPreset: Preset = {
  id: "lyra-default-director",
  name: "默认导演预设",
  description: "导演 AI — 世界推演与剧情编排",
  purpose: "director",
  blocks: [
    {
      id: "director-system",
      name: "导演系统提示词",
      role: "system",
      marker: false,
      content: DIRECTOR_SYSTEM_PROMPT,
      enabled: true,
      injectionDepth: 0,
      order: 0,
    },
    {
      id: "director-archive",
      name: "世界档案",
      role: "system",
      marker: false,
      content: "{{worldArchive}}",
      enabled: true,
      injectionDepth: 0,
      order: 1,
    },
    {
      id: "director-memory",
      name: "分段记忆",
      role: "system",
      marker: true,
      markerType: "memorySummary",
      content: "",
      enabled: true,
      injectionDepth: 0,
      order: 2,
    },
    {
      id: "director-history",
      name: "对话历史",
      role: "system",
      marker: true,
      markerType: "chatHistory",
      content: "",
      enabled: true,
      injectionDepth: 0,
      order: 3,
    },
    {
      id: "director-context",
      name: "导演专属上下文",
      role: "system",
      marker: false,
      content: `{{director_context}}`,
      enabled: true,
      injectionDepth: 0,
      order: 4,
    },
    {
      id: "director-input",
      name: "本轮玩家行动",
      role: "user",
      marker: false,
      content: `【本轮玩家行动】
{{user_input}}

请按照思维链模板进行推演，输出你的分析和指导。`,
      enabled: true,
      injectionDepth: 0,
      order: 5,
    },
  ],
  blockOrder: [
    "director-system",
    "director-archive",
    "director-memory",
    "director-history",
    "director-context",
    "director-input",
  ],
  metadata: {
    version: "1.0.0",
    source: "lyra",
    createdAt: 0,
    updatedAt: 0,
  },
};
