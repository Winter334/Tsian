# 跨模块耦合审计报告

**创建日期**：2025-07-18
**触发来源**：Phase 4b 实施过程中发现的跨模块直接导入问题
**状态**：已部分修复（inventory ↔ game 双向解耦完成）

---

## 1. 当前状态

### 1.1 已解耦的依赖（Phase 4b 中完成）

| 来源                                                | 目标                            | Service Token                   | 状态     |
| --------------------------------------------------- | ------------------------------- | ------------------------------- | -------- |
| `inventory/consumable-executor` → `game/repository` | `GameStateServiceContract`      | `GAME_STATE_SERVICE_TOKEN`      | ✅ 已解耦 |
| `game/irnr-pipeline` → `inventory/store`            | `InventoryQueryServiceContract` | `INVENTORY_QUERY_SERVICE_TOKEN` | ✅ 已解耦 |
| `game/game-state-service` → `inventory/store`       | 同上                            | 同上                            | ✅ 已解耦 |
| `game/direct-action-service` → `inventory/store`    | 同上                            | 同上                            | ✅ 已解耦 |

### 1.2 仍存在的跨模块直接导入

#### 高频被依赖：`characterToYMap` / `yMapToCharacter` 编解码函数

| 消费模块   | 文件                                     | 导入内容                             | 性质   |
| ---------- | ---------------------------------------- | ------------------------------------ | ------ |
| save       | `save/commands/handlers.ts`              | `characterToYMap`                    | 编解码 |
| room       | `room/sync/RoomSyncBridge.ts`            | `characterToYMap`, `yMapToCharacter` | 编解码 |
| room       | `room/hooks/useRoomCharacters.ts`        | `yMapToCharacter`                    | 编解码 |
| room       | `room/commands/handlers.ts`              | `yMapToCharacter`, `characterToYMap` | 编解码 |
| checkpoint | `checkpoint/services/snapshot-config.ts` | `entity-codec` 中的编解码函数        | 编解码 |

#### `createGameStateRepository` / `applyStructuralChanges`

| 消费模块 | 文件                           | 导入内容                                                      | 性质      |
| -------- | ------------------------------ | ------------------------------------------------------------- | --------- |
| room     | `room/commands/ai-handlers.ts` | `createGameStateRepository`, `applyStructuralChanges`         | 仓储+服务 |
| chat     | `chat/commands/handlers.ts`    | `GameStateRepository`, `EntityData`, `applyStructuralChanges` | 仓储+服务 |

#### `prepareMemoryData`

| 消费模块 | 文件                           | 导入内容            | 性质     |
| -------- | ------------------------------ | ------------------- | -------- |
| chat     | `chat/commands/handlers.ts`    | `prepareMemoryData` | 服务调用 |
| room     | `room/commands/ai-handlers.ts` | `prepareMemoryData` | 服务调用 |

#### `inventory-codec`

| 消费模块   | 文件                                     | 导入内容             | 性质   |
| ---------- | ---------------------------------------- | -------------------- | ------ |
| checkpoint | `checkpoint/services/snapshot-config.ts` | inventory 编解码函数 | 编解码 |

#### 通过公共 API 的跨模块导入（符合规范）

| 消费模块   | 文件                 | 导入内容                         | 性质        |
| ---------- | -------------------- | -------------------------------- | ----------- |
| room       | 组件文件             | `ChoicesPanel`, `NarrativeBlock` | UI 组件复用 |
| memory     | 组件文件(x4)         | `useCurrentConversationId`       | Hook 复用   |
| chat       | 组件文件             | `useCheckpoints`, `useRoomStore` | Hook 复用   |
| chat       | `NarrativeBlock.tsx` | `ManualMemoryDialog`             | UI 组件复用 |
| checkpoint | `index.ts`           | `useRoomStore`                   | Hook 复用   |

---

## 2. 依赖热力图

| 模块          | 被其他模块不规范依赖次数 |                   主要依赖者 |
| ------------- | ------------------------ | ---------------------------: |
| **game**      | **~8**                   | chat, room, save, checkpoint |
| **memory**    | **2**                    |                   chat, room |
| **inventory** | **1**                    |                   checkpoint |
| **chat**      | 0（通过公共 API 导入）   |                            — |
| **room**      | 0（通过公共 API 导入）   |                            — |

---

## 3. 建议的解耦方案

### 3.1 `characterToYMap` / `yMapToCharacter` → 提取到共享层

**问题**：这是被依赖最多的跨模块函数，被 4 个模块引用。

**建议方案**：将 `entity-codec.ts` 中的编解码函数提取到 `src/lib/codec/` 或 `src/domain/codec/` 作为共享基础设施。这些函数本质上是 Character 实体与 Yjs 数据结构之间的转换工具，不属于任何特定模块的业务逻辑。

**改动范围**：
- 新增 `src/lib/codec/character-codec.ts`（从 `entity-codec.ts` 提取）
- 修改 5 个消费方的导入路径
- game 模块内部改为从 `@/lib/codec` 导入（或保留内部引用）

**风险**：低。纯粹的文件移动 + 导入路径修改。

### 3.2 `applyStructuralChanges` → 提升为 service token

**问题**：chat 和 room 的 handlers 直接导入 game 模块的 `applyStructuralChanges` 函数。

**建议方案**：将此函数作为 `GameStateServiceContract` 的一个新方法（已有此 service token）。

**改动范围**：
- `GameStateServiceContract` 新增 `applyStructuralChanges()` 方法
- game 模块的实现中添加方法
- chat/room handlers 改为通过 `services.get(GAME_STATE_SERVICE_TOKEN)` 调用

**风险**：低。

### 3.3 `prepareMemoryData` → 提升为 memory service token

**问题**：chat 和 room 的 handlers 直接导入 memory 模块的 `prepareMemoryData` 函数。

**建议方案**：新增 `MemoryServiceContract` + `MEMORY_SERVICE_TOKEN`。

**改动范围**：
- `src/core/services/tokens.ts` 新增 contract 和 token
- memory 模块注册实现
- chat/room handlers 改为通过 service token 调用

**风险**：低。

### 3.4 `inventory-codec` → 同 3.1 的共享层方案

**问题**：checkpoint 直接导入 inventory 的编解码函数。

**建议方案**：与 3.1 一起处理，将物品/技能的编解码函数也提取到 `src/lib/codec/`。

---

## 4. 是否需要立即推进

### 不建议立即全面重构的理由

1. **功能优先**：Phase 4c（操作日志、装备面板）和后续 Phase 有更高的业务价值
2. **当前耦合不影响功能**：所有跨模块导入都能正常工作，只是违反了架构规范
3. **重构风险虽低但耗时**：涉及 10+ 个文件的导入路径修改，需要逐一验证
4. **模块热插拔暂未启用**：当前阶段尚未需要在运行时加载/卸载模块

### 建议的推进策略

1. **随功能开发顺带修复**（推荐）：当修改某个文件时，顺带将该文件中的跨模块导入迁移到 service token（就像 Phase 4b 中做的那样）
2. **编解码函数统一提取**（可单独排期）：`characterToYMap`/`yMapToCharacter` 的提取可以作为一个独立的小型重构任务，因为它是被依赖最多的
3. **全面解耦重构**（不推荐立即执行）：等项目功能基本稳定后再统一处理

### 优先级排序

| 优先级 | 项目                                          | 理由                                 |
| ------ | --------------------------------------------- | ------------------------------------ |
| P1     | 编解码函数提取到共享层                        | 被依赖最多，提取后收益最大           |
| P2     | `applyStructuralChanges` → `GameStateService` | 已有 service token，只需扩展方法     |
| P2     | `prepareMemoryData` → `MemoryService`         | 模式清晰，改动小                     |
| P3     | `createGameStateRepository` 直接调用          | 需要评估 room/ai-handlers 的特殊场景 |

---

## 5. 验证检查清单

在完成解耦后可用以下命令验证：

```bash
# 检查是否还有跨模块直接导入（排除 @/modules/index.ts 公共入口）
grep -r "from \"@/modules/" src/modules/ --include="*.ts" --include="*.tsx" | grep -v "node_modules" | grep -v "__tests__"
```

期望结果：所有导入都应该是通过模块的 `index.ts` 公共入口，或者通过 `@/core/services/tokens` 的 service token。
