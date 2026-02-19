---
type: always_apply
description: Lyra Next 架构规范（DDD + 事件溯源 + 插件系统），约束模块职责、通信方式与状态修改边界。
---

# 架构规范（迁移自 `.kilocode/rules/20-architecture.mdc`）

适用范围：`src/**/*`

## 核心架构：DDD + 事件溯源 + 插件系统

```text
┌─────────────────────────────────────────────────────┐
│ Plugin System (模块注册/生命周期/Hooks)              │
├─────────────────────────────────────────────────────┤
│ Core (EventBus + CommandBus + Repository + Services) │
├─────────────────────────────────────────────────────┤
│ Modules (Chat │ Data │ Room │ Save)                 │
└─────────────────────────────────────────────────────┘
```

## 数据流

```text
用户操作 / AI 工具
       ↓
  CommandBus.dispatch()
       ↓
  Command Handler (验证 → 执行 → 更新状态)
       ↓
  EventBus.emit()
       ↓
  模块订阅事件 → 更新 UI
```

## 目录职责

| 目录 | 职责 | 依赖 | 可修改状态 |
|------|------|------|-----------|
| `core/` | 基础设施（EventBus/CommandBus/Services） | 无依赖 | ❌ |
| `domain/` | 领域逻辑（命令/事件/实体定义） | 只依赖 core | ❌ |
| `stores/` | 全局配置 Store（settings 等） | core/lib | 见下方说明 |
| `lib/*/store.ts` | 工具库配置 Store（prompt 等） | 无业务逻辑 | 见下方说明 |
| `modules/*/handlers.ts` | 命令处理器 | core/domain/stores | ✅ **可修改状态** |
| `modules/*/sync/` | Yjs→Store 同步桥接 | core/yjs/store | ✅ **架构特例** |
| `modules/*/store.ts` | 业务模块 Zustand store | 无 | 定义方法，不直接调用 |
| `components/ui/` | 通用 UI 组件（容器/原子/复合） | hooks/styles | ❌ |
| `components/**` | 业务 UI 组件 | hooks/modules(只读)/ui | ❌ |
| `lib/` | 工具库 | 无业务逻辑 | ❌ |

> **全局配置 Store 说明**：
>
> - `stores/` 和 `lib/*/store.ts` 是全局配置 Store（如主题、AI 配置、预设配置）
> - 这些 Store **不属于业务模块**，不需要通过 CommandBus 访问
> - **专用管理组件**（如 `AISettings`、`PresetWorkspace`）可以直接调用其修改方法
> - **业务组件**应只读访问这些 Store
> - Handlers 可只读访问全局配置 Store，这不影响模块热插拔能力

> **SyncBridge 特例**：`modules/*/sync/` 作为 Yjs 状态到本地 Store 的唯一桥接点，允许直接更新 Store。业务逻辑仍需通过 CommandBus。

## 模块通信规则

- ✅ 通过 `commandBus.dispatch()` 发送命令
- ✅ 通过 `eventBus.on()` 订阅事件
- ✅ 通过 `services.get(Token)` 获取其他模块服务（**只读**）
- ❌ 禁止模块间直接 import
- ❌ 禁止绕过 CommandBus 修改状态

## ⚠️ 常见反模式

### 反模式 1：业务组件直接调用业务模块 store 修改方法

```tsx
// ❌ 错误：在业务组件中直接调用业务模块 store 方法
const addConversation = useChatStore((s) => s.addConversation);
addConversation(newConvo);  // 绕过了 CommandBus

// ✅ 正确：通过 CommandBus
const dispatch = useCommand();
dispatch({ type: ChatCommands.CREATE_CONVERSATION, payload: {...} });
```

### 反模式 2：从业务模块 store 获取修改函数

```tsx
// ❌ 错误：获取业务模块 store 的修改函数
const { setCurrentConversation, removeConversation } = useChatStore();

// ✅ 正确：只获取数据
const conversations = useChatStore((s) => s.conversations);
```

### 反模式 3：直接导入其他模块的内部实现

```tsx
// ❌ 错误：直接导入模块内部
import { useChatStore } from "@/modules/chat/store";

// ✅ 正确：通过模块顶层入口
import { useChatStore } from "@/modules";
```

## 模块 Manifest

每个模块必须在入口文件声明：

```ts
registry.register({
  id: "lyra.chat",
  commands: { ... },
  eventHandlers: { ... },
  aiTools: [ ... ],
});
```

## 存储层

```ts
// 小数据设置
localStorage.setItem("key", value);

// 游戏状态 (Yjs)
import { Doc } from "yjs";
import { IndexeddbPersistence } from "y-indexeddb";

// 大文件 (OPFS)
const root = await navigator.storage.getDirectory();
const fileHandle = await root.getFileHandle("image.png", { create: true });
```

## AI 调用

```ts
// 用户配置代理 URL，前端直接 fetch
const response = await fetch(proxyUrl, {
  method: "POST",
  body: JSON.stringify({ messages, model }),
});
```

