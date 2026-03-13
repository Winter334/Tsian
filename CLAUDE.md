# Lyra Next

面向终端玩家的跨平台 AI TRPG / RPG 框架。

## Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | 启动 Vite 开发服务器 |
| `pnpm build` | 执行 TypeScript 检查并构建生产包 |
| `pnpm preview` | 预览构建结果 |
| `pnpm lint` | 对 `src/` 运行 ESLint |
| `pnpm typecheck` | 运行 TypeScript 无输出类型检查 |
| `pnpm test` | 启动 Vitest 监听模式 |
| `pnpm test:run` | 单次运行 Vitest |

- 本仓库使用 `pnpm`；以 `package.json` 和 `pnpm-lock.yaml` 为准。

## Architecture

```text
src/
├── core/          # EventBus / CommandBus / registry / services 等基础设施
├── domain/        # 命令、事件、实体等领域定义
├── modules/       # 业务模块实现、handlers、store、sync、services
├── components/    # UI 与业务组件
├── hooks/         # 组合式 React hooks
├── lib/           # 工具库与非业务逻辑能力
├── stores/        # 全局配置类 store
└── styles/        # 样式资源
```

- 核心架构是 DDD + 事件溯源 + 插件式模块系统。
- 业务写路径默认走：用户操作 / AI 工具 -> `CommandBus.dispatch()` -> handler -> `EventBus.emit()` -> store / UI 消费。
- `services` 只用于只读查询和纯计算，不能承担状态写入。
- 模块间优先通过命令、事件或 services token 通信，避免直接依赖彼此内部实现。
- `modules/*/sync/` 是 Yjs -> Store 的同步桥接特例，可直接更新 store；业务逻辑本身仍应走命令链。
- 新增模块或新增模块入口后，必须补 `src/modules/index.ts` 的注册与导出。

## Search Rules

- 进入未知代码区域时，优先使用 `mcp__ace-tool__search_context` 建立语义上下文，再做定向 Grep / Read。
- 搜索查询优先复用用户原始措辞，并补充模块名、命令名、事件名等关键词。
- 只有在文件或标识符已经足够明确时，才直接用 Grep / Glob。

## Code Style

- React 组件使用 PascalCase；hooks 使用 `useXxx`；工具函数使用 camelCase；常量使用 UPPER_SNAKE_CASE。
- 组件优先用带 `Props` 类型的函数式写法。
- 导入顺序保持：外部库 -> `@/` 别名 -> 相对路径 -> 样式。
- 通用 UI 组件统一从 `@/components/ui` 聚合入口导入，不直接依赖其内部实现路径。
- 禁止 `any`；优先 `unknown` + 类型守卫。
- 布局、间距、尺寸优先 Tailwind。
- 动态主题颜色优先 token/helper，禁止硬编码 `#hex` 或 `rgb(...)` 颜色。

## Gotchas

- 业务组件不要直接调用业务模块 store 的写方法；业务写入应回到命令链。
- 从业务模块 store 读取时优先取状态数据，不在组件层拿写入函数。
- `stores/` 与 `lib/*/store.ts` 属于全局配置 store；专用管理组件可以直接修改，但业务组件仍应只读访问。
- `src/modules/index.ts` 是模块是否真正生效的最终检查点。
- 若任务是复杂前端 artifact / 原型搭建，优先复用现有 `/artifacts-builder` skill，而不是重复搭建新的 agent 或脚手架。

## Key Files

- `src/modules/index.ts` - 所有模块的统一注册入口与公共导出
- `src/core/registry/index.ts` - 模块 manifest、生命周期、commands / eventHandlers / aiTools 注册逻辑
- `plans/prompt-evolution-collaboration-architecture.md` - Director / Parser / Narrator / Summarizer / PostProcess 协同设计基线

## Project Agents

- `lyra-codebase-explorer` - 先做语义搜索，再收敛到关键文件与调用链。
- `architecture-guardian` - 检查 CommandBus、EventBus、services 与模块边界是否合规。
- `module-specialist` - 新增/扩展模块时核对 commands、events、handlers、store、入口与全局注册链。
- `ui-style-keeper` - React 组件、工作台界面、Tailwind、token 主题与共享 UI 导入规范。
