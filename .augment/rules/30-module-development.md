---
type: always_apply
description: Lyra Next 模块开发规范，定义模块结构、开发流程与 Services 使用边界。
---

# 模块开发规范（迁移自 `.kilocode/rules/30-module-development.mdc`）

适用范围：`src/modules/**/*`

## 模块结构

```text
src/modules/{module-name}/
├── index.ts          # 模块入口，注册到 registry
├── handlers.ts       # 命令处理器
├── store.ts          # Zustand store
└── components/       # 模块 UI 组件（可选）
```

## 新模块开发流程

1. 在 `src/domain/entities/` 定义实体
2. 在 `src/domain/events/` 定义事件常量
3. 在 `src/domain/commands/` 定义命令常量
4. 在 `src/modules/{module}/handlers.ts` 实现命令处理器
5. 在 `src/modules/{module}/store.ts` 创建 Zustand store
6. 在 `src/modules/{module}/index.ts` 导出 `registerXxxModule()` 函数
7. **在 `src/modules/index.ts` 中调用注册函数**（⚠️ 必须，否则模块不会生效）

## 服务注册（Services 规则）

Services **只能用于只读查询和纯计算**，修改状态必须通过 CommandBus。

```ts
// ✅ 允许：只读查询
getCharacter(id: string): Character;

// ✅ 允许：纯计算
calculateDamage(attacker, target): number;

// ❌ 禁止：修改状态
setHealth(id: string, value: number): void;
```

查看各模块的 `services/` 目录了解已注册的服务（如 `src/modules/room/services/`）。

