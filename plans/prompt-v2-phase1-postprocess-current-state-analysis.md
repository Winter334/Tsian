# Prompt V2 Phase 1：PostProcess 职责收敛现状分析（仅分析）

> 范围：仅覆盖 Phase 1 相关链路与风险，不改代码、不做迁移实现。
> 依据：[`plans/prompt-v2-migration-validation-risk-plan.md`](plans/prompt-v2-migration-validation-risk-plan.md)、[`plans/prompt-v2-template-and-interface-spec.md`](plans/prompt-v2-template-and-interface-spec.md)

---

## A. 现状调用链

### A1. 单机 IRNR 链路（当前主链）

1. 聊天命令构造 IRNR 入参（含消息定位）[`sendMessageHandler`](src/modules/chat/commands/handlers.ts:287)
2. 进入 IRNR 服务并构建黑板（`messageLocation` 由 `conversationId/messageId/messageIndex` 生成）[`buildBlackboardInput()`](src/modules/game/services/irnr-pipeline.ts:77)
3. 管线顺序执行到后处理 Agent [`createGamePipeline()`](src/modules/game/agents/index.ts:21)
4. 后处理仅跑 persist 入口，抽取 `miniSummary` 并清洗正文 [`postProcessorAgent.execute()`](src/modules/game/agents/post-processor.ts:13)
5. 管线结果优先回传 `cleanNarrative` [`mapBlackboardToResult()`](src/modules/game/services/irnr-pipeline.ts:115)
6. 流式完成时以最终文本落盘到消息 [`StreamSession.complete()`](src/modules/chat/utils/stream-session.ts:80)
7. UI 渲染阶段再做 render 抽取（choices）[`parseGameContent()`](src/modules/chat/utils/parseGameContent.ts:20)

**结论**：单机是“persist 在管线、render 在 UI 解析”的双入口模式。

### A2. 联机链路（IRNR + completeTurn）

1. 联机 AI 处理触发 IRNR，但入参**不含**消息定位（仅 room/turn）[`runMultiplayer()`调用点](src/modules/room/commands/ai-handlers.ts:453)
2. 叙事 chunk 先写入 TurnDoc 原文 [`onNarrativeChunk`](src/modules/room/commands/ai-handlers.ts:466)
3. AI 完成事件触发自动归档 [`RoomEvents.AI_RESPONSE_COMPLETED` 监听](src/modules/room/index.ts:605)
4. 归档阶段再次执行 persist 后处理并写入 HistoryDoc [`completeTurnHandler()`](src/modules/room/commands/handlers.ts:2390)
5. 该处抽取 miniSummary 并分发记忆命令 [`miniSummaryParts` 处理](src/modules/room/commands/handlers.ts:2533)
6. 前端展示仍通过 render 阶段解析 choices [`TurnNarrativeFlow` 调用](src/modules/room/components/TurnNarrativeFlow.tsx:123)

**结论**：联机存在“IRNR 后处理 + completeTurn 再后处理”的割裂；抽取职责未单点收敛。

---

## B. 标签抽取当前分散点（文件+函数级）

| 标签             | 阶段       | 位置                                                                                          | 关键符号                                                              | 现状                        |
| ---------------- | ---------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | --------------------------- |
| `memory_summary` | persist    | [`src/lib/post-process/builtin-rules.ts`](src/lib/post-process/builtin-rules.ts:6)            | [`builtin:memory-summary`](src/lib/post-process/builtin-rules.ts:8)   | 内置规则定义为 persist 抽取 |
| `memory_summary` | persist    | [`src/modules/game/agents/post-processor.ts`](src/modules/game/agents/post-processor.ts:13)   | [`postProcessForPersist()`](src/lib/post-process/index.ts:38)         | 单机/IRNR 内部抽取与清洗    |
| `memory_summary` | persist    | [`src/modules/room/commands/handlers.ts`](src/modules/room/commands/handlers.ts:2464)         | [`completeTurnHandler()`](src/modules/room/commands/handlers.ts:2390) | 联机归档前再次抽取          |
| `choices`        | render     | [`src/lib/post-process/builtin-rules.ts`](src/lib/post-process/builtin-rules.ts:22)           | [`builtin:choices`](src/lib/post-process/builtin-rules.ts:22)         | 内置规则定义为 render 抽取  |
| `choices`        | render     | [`src/modules/chat/utils/parseGameContent.ts`](src/modules/chat/utils/parseGameContent.ts:20) | [`postProcessForRender()`](src/lib/post-process/index.ts:52)          | 单机/联机 UI 展示侧抽取     |
| `choices`        | regex 检测 | [`src/modules/chat/utils/parseGameContent.ts`](src/modules/chat/utils/parseGameContent.ts:46) | [`hasChoices()`](src/modules/chat/utils/parseGameContent.ts:46)       | 直接正则，当前无调用        |
| 兼容层           | persist    | [`src/lib/memory/post-processor.ts`](src/lib/memory/post-processor.ts:21)                     | [`processNarrativeOutput()`](src/lib/memory/post-processor.ts:21)     | 废弃兼容层，当前无调用      |

---

## C. 最小改动面建议（Phase 1）

> 目标对齐：[`Phase 1 DoD`](plans/prompt-v2-migration-validation-risk-plan.md:105)、[`PostProcessInput/PostProcessOutput 规范`](plans/prompt-v2-template-and-interface-spec.md:356)

### C1. 必改（最小集合）

1. **统一接口落地**
   - 修改 [`src/lib/post-process/types.ts`](src/lib/post-process/types.ts:1)
   - 新增 [`PostProcessInput`](plans/prompt-v2-template-and-interface-spec.md:356) 与 [`PostProcessOutput`](plans/prompt-v2-template-and-interface-spec.md:365)
   - 保留现有 [`PostProcessResult`](src/lib/post-process/types.ts:59) 作为兼容别名/过渡类型

2. **统一入口落地（两阶段）**
   - 修改 [`src/lib/post-process/index.ts`](src/lib/post-process/index.ts:1)
   - 新增统一入口（建议单函数接收 `phase`），让 [`postProcessForPersist()`](src/lib/post-process/index.ts:38) 与 [`postProcessForRender()`](src/lib/post-process/index.ts:52) 退化为薄封装

3. **收敛 persist 调用点**
   - 修改 [`postProcessorAgent.execute()`](src/modules/game/agents/post-processor.ts:13)：改为消费统一接口输出
   - 修改 [`completeTurnHandler()`](src/modules/room/commands/handlers.ts:2390)：联机 IRNR 场景旁路重复抽取（避免同一回合双入口处理）

4. **收敛 render 调用点**
   - 修改 [`parseGameContent()`](src/modules/chat/utils/parseGameContent.ts:20)：消费统一接口输出，不保留额外正则分支

5. **回滚开关（T20 对齐）**
   - 修改 [`src/stores/feature-flags.ts`](src/stores/feature-flags.ts:9) 与 [`src/stores/settings.ts`](src/stores/settings.ts:391)
   - 新增 `USE_UNIFIED_POSTPROCESS`，并在上述调用点做新旧路径门控

### C2. 应删除或旁路的逻辑

1. 旁路联机归档中的“重复 persist 抽取”分支 [`completeTurnHandler()`](src/modules/room/commands/handlers.ts:2464)
2. 删除或标记废弃无调用正则检测 [`hasChoices()`](src/modules/chat/utils/parseGameContent.ts:46)
3. 废弃兼容层可继续保留但不再作为入口 [`processNarrativeOutput()`](src/lib/memory/post-processor.ts:21)

### C3. 关键约束提醒

1. 目前 `choices` 仅定义在 render 规则 [`builtin:choices`](src/lib/post-process/builtin-rules.ts:22)，若严格满足“落盘不残留 `<choices>`”，需在 Phase 1 明确“persist 清洗策略与 choices 消费载体（内容或元数据）”。
2. 内置规则 ID 已冻结在常量 [`BUILTIN_RULE_IDS`](src/lib/prompt/constants.ts:16)，但当前规则定义仍为字面量，建议在 Phase 1 同步收口引用，避免漂移。

---

## D. 风险与验证映射（T03/T15/T20）

### D1. T03 映射：单机 PostProcess 抽取

- 用例来源：[`T03`](plans/prompt-v2-migration-validation-risk-plan.md:200)
- 当前落点：
  1. persist 抽取入口 [`postProcessForPersist()`](src/lib/post-process/index.ts:38)
  2. 单机写回最终文本 [`session.complete(finalContent)`](src/modules/chat/commands/handlers.ts:386)
  3. 联机归档清洗入口 [`completeTurnHandler()`](src/modules/room/commands/handlers.ts:2464)
  4. render 抽取入口 [`parseGameContent()`](src/modules/chat/utils/parseGameContent.ts:20)
- 风险：`choices` 当前为 render 才抽取，天然与“落盘不残留 `<choices>`”存在差距。

### D2. T15 映射：builtin 规则 ID 固化

- 用例来源：[`T15`](plans/prompt-v2-migration-validation-risk-plan.md:212)
- 当前落点：
  1. 常量定义 [`BUILTIN_RULE_IDS`](src/lib/prompt/constants.ts:16)
  2. 实际规则定义 [`BUILTIN_RULES`](src/lib/post-process/builtin-rules.ts:6)
- 风险：常量与规则是两处定义，尚未强绑定；未来重构易出现“常量改了但规则没改”或反向漂移。

### D3. T20 映射：Feature Flag 回退

- 用例来源：[`T20`](plans/prompt-v2-migration-validation-risk-plan.md:217)
- 当前落点：
  1. 现有 flag 仅 [`USE_ENVELOPE_V2`](src/stores/feature-flags.ts:10)
  2. settings 持久化仅覆盖该 flag [`settings.load/save`](src/stores/settings.ts:391)
- 风险：Phase 1 需要的 `USE_UNIFIED_POSTPROCESS` 尚未落地，当前无法按 DoD 要求做“统一后处理路径”的快速回退。

---

## 证据清单（仅路径 + 符号 + 调用关系摘要）

| 文件                                                                                          | 关键符号                                                                                                                                               | 调用关系摘要                                                               |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| [`src/lib/post-process/index.ts`](src/lib/post-process/index.ts:38)                           | [`postProcessForPersist()`](src/lib/post-process/index.ts:38), [`postProcessForRender()`](src/lib/post-process/index.ts:52)                            | 当前存在两个阶段便捷入口，尚无统一输入/输出契约                            |
| [`src/lib/post-process/builtin-rules.ts`](src/lib/post-process/builtin-rules.ts:6)            | [`builtin:memory-summary`](src/lib/post-process/builtin-rules.ts:8), [`builtin:choices`](src/lib/post-process/builtin-rules.ts:22)                     | memory_summary 在 persist，choices 在 render                               |
| [`src/lib/post-process/types.ts`](src/lib/post-process/types.ts:59)                           | [`PostProcessResult`](src/lib/post-process/types.ts:59)                                                                                                | 尚未落地 `PostProcessInput/PostProcessOutput`                              |
| [`src/modules/game/agents/post-processor.ts`](src/modules/game/agents/post-processor.ts:13)   | [`postProcessorAgent.execute()`](src/modules/game/agents/post-processor.ts:13)                                                                         | IRNR 内 persist 抽取 miniSummary，并尝试写记忆                             |
| [`src/modules/game/services/irnr-pipeline.ts`](src/modules/game/services/irnr-pipeline.ts:77) | [`buildBlackboardInput()`](src/modules/game/services/irnr-pipeline.ts:77), [`mapBlackboardToResult()`](src/modules/game/services/irnr-pipeline.ts:115) | `messageLocation` 决定能否回写 miniSummary；结果优先 cleanNarrative        |
| [`src/modules/chat/commands/handlers.ts`](src/modules/chat/commands/handlers.ts:287)          | [`runSolo` 入参构造](src/modules/chat/commands/handlers.ts:287), [`session.complete()`](src/modules/chat/commands/handlers.ts:386)                     | 单机链路可提供完整 messageLocation 并落盘 finalContent                     |
| [`src/modules/chat/utils/stream-session.ts`](src/modules/chat/utils/stream-session.ts:80)     | [`StreamSession.complete()`](src/modules/chat/utils/stream-session.ts:80)                                                                              | 最终消息正文以 complete 阶段内容写入存储                                   |
| [`src/modules/chat/utils/parseGameContent.ts`](src/modules/chat/utils/parseGameContent.ts:20) | [`parseGameContent()`](src/modules/chat/utils/parseGameContent.ts:20), [`hasChoices()`](src/modules/chat/utils/parseGameContent.ts:46)                 | render 阶段提取 choices；另有无调用正则检测                                |
| [`src/modules/room/commands/ai-handlers.ts`](src/modules/room/commands/ai-handlers.ts:453)    | [`runMultiplayer` 调用](src/modules/room/commands/ai-handlers.ts:453), [`onNarrativeChunk`](src/modules/room/commands/ai-handlers.ts:466)              | 联机先写 TurnDoc 原文，再由 completeTurn 归档                              |
| [`src/modules/room/index.ts`](src/modules/room/index.ts:605)                                  | [`AI_RESPONSE_COMPLETED` 监听](src/modules/room/index.ts:605)                                                                                          | 事件驱动触发 [`RoomCommands.COMPLETE_TURN`](src/modules/room/index.ts:619) |
| [`src/modules/room/commands/handlers.ts`](src/modules/room/commands/handlers.ts:2390)         | [`completeTurnHandler()`](src/modules/room/commands/handlers.ts:2390), [`postProcessForPersist()`](src/modules/room/commands/handlers.ts:2471)         | 联机归档阶段再次 persist 抽取并写 miniSummary                              |
| [`src/lib/prompt/constants.ts`](src/lib/prompt/constants.ts:16)                               | [`BUILTIN_RULE_IDS`](src/lib/prompt/constants.ts:16), [`EXTRACT_TAG_PATHS`](src/lib/prompt/constants.ts:22)                                            | 冻结常量已存在，但未完全作为规则定义唯一来源                               |
| [`src/stores/feature-flags.ts`](src/stores/feature-flags.ts:9)                                | [`FEATURE_FLAG_STORAGE_KEYS`](src/stores/feature-flags.ts:9)                                                                                           | 目前仅 envelope flag，缺少统一后处理 flag                                  |
| [`src/stores/settings.ts`](src/stores/settings.ts:391)                                        | `feature flag load/save`                                                                                                                               | 仅加载/持久化 `USE_ENVELOPE_V2`                                            |

---

## 结论（供父任务直接编码）

1. Phase 1 当前最大差距不是“没有后处理”，而是“后处理入口仍分散且联机存在重复 persist 路径”。
2. 要满足 DoD，最小实现应先落地统一契约（`PostProcessInput`/`PostProcessOutput`）并统一调用入口，再处理联机旁路与回滚开关。
3. `T03/T15/T20` 在现状代码均有可落点，但 `T03` 与 `T20` 仍存在结构性缺口（choices 落盘语义、统一后处理 flag）。
