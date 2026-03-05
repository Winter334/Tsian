# Prompt V2 P0 实施分析报告

> **状态**：仅分析，禁止改代码
> **范围**：Phase 0 协议冻结与基础设施

---

## 1. 当前实现现状

### 1.1 Prompt 上下文构建

| 符号                      | 文件路径                                        | 说明                               |
| ------------------------- | ----------------------------------------------- | ---------------------------------- |
| `VariableContext`         | `src/lib/prompt/types.ts:188-297`               | 当前上下文结构，Envelope 的前身    |
| `buildVariableContext()`  | `src/lib/prompt/utils.ts:74-121`                | 辅助构建函数                       |
| `DefaultMessageAssembler` | `src/lib/prompt/assembler.ts:20-58`             | 按 Preset+Context 组装消息         |
| `PipelineBlackboard`      | `src/domain/types/pipeline-blackboard.ts:23-74` | 管线黑板，含 `baseVariableContext` |
| `buildDirectorContext()`  | `src/modules/director/context-builder.ts:17-83` | Director 专用上下文                |
| Parser context 构建       | `src/modules/game/agents/parser.ts:42-56`       | 内联构建                           |
| Narrator context 构建     | `src/modules/game/agents/narrator.ts:44-54`     | 内联构建                           |

### 1.2 PostProcess 内置规则与标签

| 符号                      | 文件路径                                     | 说明             |
| ------------------------- | -------------------------------------------- | ---------------- |
| `BUILTIN_RULES`           | `src/lib/post-process/builtin-rules.ts:6-35` | 两条内置规则定义 |
| `postProcessForPersist()` | `src/lib/post-process/index.ts:38-44`        | persist 阶段入口 |
| `postProcessForRender()`  | `src/lib/post-process/index.ts:52-58`        | render 阶段入口  |
| `PostProcessRule` 类型    | `src/lib/post-process/types.ts:29-54`        | 规则接口         |
| post-processor agent      | `src/modules/game/agents/post-processor.ts`  | IRNR 管线中使用  |
| room handler              | `src/modules/room/commands/handlers.ts`      | 联机中使用       |
| `parseGameContent()`      | `src/modules/chat/utils/parseGameContent.ts` | render 阶段消费  |

**关键发现**：`builtin:memory-summary` 和 `builtin:choices` 作为字符串字面量硬编码在 `BUILTIN_RULES` 数组中，**没有**独立的命名常量。标签路径 `<memory_summary>` 和 `<choices>` 也是正则字符串字面量。

### 1.3 PresetPurpose 与 activePresetByPurpose

| 符号                                    | 文件路径                          | 说明                                                    |
| --------------------------------------- | --------------------------------- | ------------------------------------------------------- |
| `PresetPurpose` 类型                    | `src/lib/prompt/types.ts:21`      | `"narrative" \| "parser" \| "summarizer" \| "director"` |
| `STORAGE_KEYS.ACTIVE_PRESET_BY_PURPOSE` | `src/lib/prompt/storage.ts:23`    | localStorage key                                        |
| `DEFAULT_ACTIVE_PRESET_BY_PURPOSE`      | `src/lib/prompt/store.ts:24-28`   | 默认值对象                                              |
| `getPresetForPurpose()`                 | `src/lib/prompt/store.ts:336-347` | 按 purpose 获取                                         |

**关键发现**：`PresetPurpose` 是联合类型，四个值分散在多处硬编码（如 `storage.ts:148-153`、`storage.ts:315`）。P0 需将四值提取为常量数组。

### 1.4 Feature Flag 与设置持久化

| 符号               | 文件路径                                    | 说明                            |
| ------------------ | ------------------------------------------- | ------------------------------- |
| `settings` 封装    | `src/core/storage/index.ts:12-29`           | localStorage get/set/remove     |
| `useSettingsStore` | `src/stores/settings.ts:116-404`            | Zustand + immer，load/save 模式 |
| `Toggle` 组件      | `src/components/ui/toggle.tsx:18-91`        | 开关 UI 组件                    |
| `ToggleCard` 组件  | `src/components/ui/toggle.tsx:97+`          | 带标题描述的开关                |
| Settings 首页      | `src/components/Settings/index.tsx:278-380` | 卡片网格布局                    |

**关键发现**：项目中**不存在**任何 feature flag 机制。需要新建。现有模式是 `settings.get/set` + Zustand store。

### 1.5 Delta 类型

**关键发现**：代码中**没有**任何 Delta 相关的类型定义。仅存在于计划文档中（`plans/prompt-evolution-collaboration-architecture.md:152-186`）。

---

## 2. P0 最小改动方案

### 2.1 新增文件（4 个）

| #   | 文件路径                       | 内容                                                                                                                       | 依赖                                            |
| --- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| N1  | `src/lib/prompt/constants.ts`  | 冻结常量：`PRESET_PURPOSES`、`BUILTIN_RULE_IDS`、`EXTRACT_TAG_PATHS`、`DIRECTOR_TAGS`、`ENVELOPE_VERSION`、`DELTA_VERSION` | 无                                              |
| N2  | `src/domain/types/envelope.ts` | `ContextEnvelope` interface，含所有 MVP 必填字段                                                                           | 依赖 `PresetPurpose`（from `lib/prompt/types`） |
| N3  | `src/domain/types/delta.ts`    | `TurnDelta` + `DeltaPatch` + `DeltaCommitStatus` + `DeltaSource` 类型                                                      | 无外部依赖                                      |
| N4  | `src/stores/feature-flags.ts`  | `useFeatureFlagStore` Zustand store，`USE_ENVELOPE_V2` 等 flag                                                             | 依赖 `src/core/storage`                         |

### 2.2 修改文件（3 个）

| #   | 文件路径                    | 改动点                                                         | 影响范围           |
| --- | --------------------------- | -------------------------------------------------------------- | ------------------ |
| M1  | `src/domain/types/index.ts` | 新增 `export * from "./envelope"` 和 `export * from "./delta"` | 纯追加导出，零破坏 |
| M2  | `src/lib/prompt/index.ts`   | 新增 `export * from "./constants"`                             | 纯追加导出，零破坏 |
| M3  | `src/stores/settings.ts`    | 在 `loadSettings` 中加载 feature flag，`saveSettings` 中持久化 | 追加逻辑，向后兼容 |

### 2.3 可选修改（1 个，P0 非必须）

| #   | 文件路径                            | 改动点                                                           | 说明                                                            |
| --- | ----------------------------------- | ---------------------------------------------------------------- | --------------------------------------------------------------- |
| O1  | `src/components/Settings/index.tsx` | Settings 首页新增"开发者选项"卡片，内含 `USE_ENVELOPE_V2` Toggle | P0 DoD 说"localStorage 或 Settings 面板"，localStorage 即可满足 |

---

## 3. 调用链影响说明

### P0 改动的调用链影响：**零影响**

P0 所有改动均为**纯新增**（新类型文件 + 新常量文件 + 新 store），不修改任何现有函数签名或逻辑分支。

```
现有调用链（不受影响）：
  Handler → buildVariableContext() → Assembler.assemble() → AI
  PostProcess → BUILTIN_RULES → mergeRules() → pipeline
  Settings → loadSettings()/saveSettings() → localStorage

P0 新增（独立存在，不接入现有链路）：
  constants.ts ← 被 envelope.ts/delta.ts 引用
  envelope.ts ← 被 domain/types/index.ts 导出
  delta.ts ← 被 domain/types/index.ts 导出
  feature-flags.ts ← 被 Settings UI 读写
```

后续 Phase 1+ 才会在管线代码中引用这些类型和 flag。

---

## 4. 风险点与规避措施（仅 P0 范围）

| #   | 风险                                               | 概率 | 影响 | 规避                                                                              |
| --- | -------------------------------------------------- | ---- | ---- | --------------------------------------------------------------------------------- |
| R1  | Envelope interface 字段与 VariableContext 语义偏移 | 低   | 高   | 在 `envelope.ts` 中写明映射注释；字段名严格遵循规范文档 §5.1.1                    |
| R2  | 常量定义与已有硬编码不一致                         | 低   | 中   | 常量值必须与 `builtin-rules.ts:8,22`、`types.ts:21` 完全一致                      |
| R3  | feature flag store 与 settings store 加载时序冲突  | 低   | 低   | feature-flags 独立 store，不依赖 settings store 初始化                            |
| R4  | 新类型文件导致循环依赖                             | 低   | 中   | envelope.ts 只从 `lib/prompt/types` 导入 `PresetPurpose` 类型（type-only import） |

---

## 5. 建议编码顺序

| Step | 文件                           | 操作                | 前置     | 验证                                                                         |
| ---- | ------------------------------ | ------------------- | -------- | ---------------------------------------------------------------------------- |
| 1    | `src/lib/prompt/constants.ts`  | 新建                | 无       | 编译通过                                                                     |
| 2    | `src/lib/prompt/index.ts`      | 追加导出            | Step 1   | 编译通过                                                                     |
| 3    | `src/domain/types/envelope.ts` | 新建                | Step 1   | 编译通过                                                                     |
| 4    | `src/domain/types/delta.ts`    | 新建                | Step 1   | 编译通过                                                                     |
| 5    | `src/domain/types/index.ts`    | 追加导出            | Step 3,4 | 编译通过；`import { ContextEnvelope, TurnDelta } from "@/domain"` 可用       |
| 6    | `src/stores/feature-flags.ts`  | 新建                | 无       | `localStorage.setItem('lyra.flags.useEnvelopeV2', 'true')` 后 store 读取正确 |
| 7    | `src/stores/settings.ts`       | 追加 flag load/save | Step 6   | 编译通过                                                                     |

> **总计**：4 个新文件 + 3 处小修改。全部为追加操作，可一步 `pnpm build` 验证。

---

## 6. 关键常量参考值

以下常量值必须与代码中已有硬编码完全一致：

```typescript
// src/lib/prompt/constants.ts

/** 冻结的四种预设用途 */
export const PRESET_PURPOSES = ["narrative", "parser", "summarizer", "director"] as const;

/** 冻结的内置后处理规则 ID */
export const BUILTIN_RULE_IDS = {
  MEMORY_SUMMARY: "builtin:memory-summary",
  CHOICES: "builtin:choices",
} as const;

/** 冻结的标签路径 */
export const EXTRACT_TAG_PATHS = {
  MEMORY_SUMMARY: "memory_summary",
  CHOICES: "choices",
} as const;

/** Director 输出标签 */
export const DIRECTOR_TAGS = {
  REQUIRED: ["plot_directives", "narrative_hints", "archive_updates"] as const,
  OPTIONAL: ["outline_updates"] as const,
} as const;

/** 协议版本 */
export const ENVELOPE_VERSION = "2.0.0";
export const DELTA_VERSION = "1.0.0";
```
