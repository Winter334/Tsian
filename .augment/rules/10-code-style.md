---
type: always_apply
description: Lyra Next 代码风格规范（命名、导入、状态修改边界与样式规范）。
---

# 代码风格（迁移自 `.kilocode/rules/10-code-style.mdc`）

## 命名

- **组件**：PascalCase（`ChatMessage.tsx`）
- **hooks**：camelCase + `use` 前缀（`useChatStore.ts`）
- **工具函数**：camelCase（`formatDate.ts`）
- **常量**：UPPER_SNAKE_CASE

## 组件

```tsx
// 函数式组件 + 类型
interface Props { ... }
export function Component({ prop }: Props) { ... }
```

## 导入顺序

```ts
// 1. React/外部库
// 2. @/ 别名导入
// 3. 相对路径
// 4. 样式
```

## UI 组件导入

- ✅ 通过聚合入口导入：`import { Button, Panel } from "@/components/ui"`
- ❌ 禁止直接引用内部实现路径

## 禁止

- ❌ `any` 类型（用 `unknown` + 类型守卫）
- ❌ 直接修改状态（用 Immer）
- ❌ 硬编码颜色值（用 Token 系统）

## 样式规范

- ✅ 布局/间距/尺寸：使用 Tailwind 类
- ✅ 动态主题颜色：使用 Token 系统（`color()`, `colorAlpha()`, `glow()` 等）
- ❌ 禁止硬编码颜色值（如 `#00e5cc`、`rgb(0, 229, 204)`）

