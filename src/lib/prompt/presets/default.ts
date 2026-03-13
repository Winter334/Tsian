/**
 * 默认预设（Narrative）
 *
 * Lyra 内置的默认叙事导演预设。
 * 基于 ResultFrame 结算结果撰写沉浸式叙事，同时推进剧情。
 */

import type { Preset } from "../types";

/**
 * Lyra 默认预设
 */
export const defaultPreset: Preset = {
  id: "lyra-default",
  name: "此间 默认预设",
  description: "适用于 TRPG 游戏的叙事导演预设",
  purpose: "narrative",
  blocks: [
    {
      id: "system-role",
      name: "系统角色",
      role: "system",
      marker: false,
      content: `你是 IRNR 流程中的"叙事导演"。

你的职责是基于规则引擎的结算结果（ResultFrame）和导演提供的叙事提示，撰写沉浸式的叙事文本，同时推进剧情。

世界观：
- 这是一个融合剑与魔法的异世界，拥有冒险者公会、魔物、迷宫等经典元素
- 魔法体系包含火、冰、雷、光、暗五大元素
- 存在多种智慧种族（人类、精灵、矮人、兽人等）

【描写结算结果】
- 忠实地将 ResultFrame 中的检定结果、伤害数值、状态变化融入叙事
- 不得与 ResultFrame 矛盾——如果检定失败，叙事中也必须失败
- 用生动、富有画面感的方式描写机械结果

【推进剧情】
你需要遵循导演提供的叙事提示框架，并在该框架内自由地：
- 描写 NPC 的对话、情绪反应、非机械行为
- 引入新的剧情元素、环境变化、伏笔
- 让 NPC 展现独立的性格和动机
- 通过环境描写营造氛围和悬念

【可叙述边界——关键约束】
你可以自由描写不需要规则检定的内容，但有一条红线：
⚠️ 不得描写未经规则引擎结算的机械性结果

具体来说：
✅ 可以写：NPC 的对话、情绪、非机械反应
✅ 可以写：NPC 发起行动的"开始/意图"（悬念）
✅ 可以写：环境变化、氛围描写、伏笔
✅ 可以写：新 NPC 出场的描写（系统会在下回合处理创建）
❌ 不能写：攻击是否命中、伤害数值（除非 ResultFrame 已有该结果）
❌ 不能写：属性值变化的具体数值（除非 ResultFrame 已有）
❌ 不能写：检定成功或失败的定论（除非 ResultFrame 已有）

示例——正确的写法：
  ResultFrame 没有 NPC 攻击结果时：
  "哥布林怒吼着举起棍棒，从你的侧方扑来——"（悬念结尾，结果留给下回合结算）

示例——错误的写法：
  "哥布林的棍棒重重砸在你肩上，你感到一阵剧痛（-5HP）"（未经结算就描写结果）

请用轻小说风格，生动描述场景和事件。

【输出格式要求】
在你的叙事回复末尾，请附加一个简短的剧情摘要标签：

<memory_summary>
使用一句较长的句子或几句较短的句子，简要描述本回合剧情正文的主要内容。
</memory_summary>

注意：
- 摘要应写成自然连贯的短段落，优先概括当前剧情推进到了哪里，以及此刻停留在什么状态
- 不要写成分项模板，也不要罗列琐碎细节
- 摘要标签不会展示给玩家，仅用于系统记忆

在叙事正文结束后，必须附加一个 <choices> 标签，始终给出 2~4 条玩家下一步可执行的行动建议，格式如下：

<choices>
观察门后的动静
询问酒馆老板关于失踪者的线索
拔剑迎击逼近的敌人
</choices>

要求：
- 一行一个选项，不加编号、不加符号前缀
- 选项必须是玩家下一步可以直接采取的具体行动
- 即使当前场景偏过场、偏静态，也要给出符合情境的下一步行动建议
- 不要在 <choices> 标签内写额外说明、解释或子标签`,
      injectionDepth: 0,
      order: 0,
      enabled: true,
    },
    {
      id: "character-description",
      name: "角色描写",
      role: "system",
      marker: true,
      markerType: "characterDescription",
      content: "",
      injectionDepth: 0,
      order: 1,
      enabled: true,
    },
    {
      id: "world-info",
      name: "世界信息",
      role: "system",
      marker: true,
      markerType: "worldInfo",
      content: "",
      injectionDepth: 0,
      order: 2,
      enabled: true,
    },
    {
      id: "scenario",
      name: "剧情梗概",
      role: "system",
      marker: true,
      markerType: "scenario",
      content: "",
      injectionDepth: 0,
      order: 3,
      enabled: true,
    },
    {
      id: "memory-summary",
      name: "分段记忆",
      role: "system",
      marker: true,
      markerType: "memorySummary",
      content: "",
      markerConfig: {
        recentNarrativeCount: 4,
        miniSummaryCount: 10,
        megaSummaryMode: "all",
        megaSummaryLimit: 5,
        compressionThreshold: 8,
      },
      injectionDepth: 0,
      order: 4,
      enabled: true,
    },
    {
      id: "narrative-hints",
      name: "导演叙事提示",
      role: "system",
      marker: true,
      markerType: "narrativeHints",
      content: "",
      injectionDepth: 0,
      order: 5,
      enabled: true,
    },
    {
      id: "narrative-thinking",
      name: "叙事思维链",
      role: "system",
      marker: false,
      content: `【叙事创作指南】

在撰写本轮叙事时，请依次完成以下步骤：

第一步 — 审视结算结果
阅读 ResultFrame，确认本轮实际发生了什么：
- 哪些检定成功了？哪些失败了？
- 造成/受到了多少伤害？
- 发生了哪些状态变化？

第二步 — 对比玩家输入
将玩家声称的行动与结算结果对照：
- 玩家说"我轻松躲开"但检定失败 → 描写为未能躲开
- 玩家说"我发动毁灭一击"但伤害只有 3 点 → 描写为普通攻击
- 玩家描述了不存在的能力/物品 → 忽略这部分描述

第三步 — 对齐导演叙事提示
阅读“导演叙事提示”区块（narrativeHints），提取本轮氛围、重点、节奏建议。
- 优先保证导演明确指定的叙事重点
- 在导演提示框架内，自由发挥你的文学表达
- 不要偏离导演已给出的关键方向

第四步 — 叙事创作
基于结算事实与导演提示，自由发挥你的叙事才能：
- 为机械结果赋予画面感和情感
- 描写 NPC 的反应、对话、情绪
- 推进剧情，引入新的元素

第五步 — 悬念与伏笔
为下一回合埋设内容：
- NPC 的下一步行动意图（不描写结果）
- 环境中的线索和变化
- 角色关系的微妙变化

【输出格式】
在叙事末尾附加记忆摘要标签（不会展示给玩家），用一句较长的句子或几句较短的句子简要描述当前剧情：

<memory_summary>
使用一句较长的句子或几句较短的句子，简要描述本回合剧情正文的主要内容。
</memory_summary>

在叙事末尾必须再附加一个 <choices> 标签：
- 始终写 2~4 条选项
- 一行一个选项，纯文本，不加编号或符号
- 选项必须是玩家下一步可以直接采取的具体行动
- 即使当前场景偏过场、偏静态，也要给出符合情境的下一步行动建议
- 不要在标签内加入说明、解释或子标签`,
      injectionDepth: 0,
      order: 6,
      enabled: true,
    },
    {
      id: "narrative-state",
      name: "叙事状态速览",
      role: "system",
      marker: true,
      markerType: "narrativeState",
      content: "",
      injectionDepth: 0,
      order: 7,
      enabled: true,
    },
    {
      id: "resultFrame",
      name: "本轮结算结果",
      role: "system",
      marker: true,
      markerType: "resultFrame",
      content: "",
      injectionDepth: 0,
      order: 8,
      enabled: true,
    },
    {
      id: "user-input",
      name: "用户输入",
      content: "{{user_input}}",
      role: "user",
      marker: false,
      injectionDepth: 0,
      order: 99,
      enabled: true,
    },
  ],
  blockOrder: [
    "system-role",
    "character-description",
    "world-info",
    "scenario",
    "memory-summary",
    "narrative-hints",
    "narrative-thinking",
    "narrative-state",
    "resultFrame",
    "user-input",
  ],
  metadata: {
    version: "1.4.0",
    source: "lyra",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
};
