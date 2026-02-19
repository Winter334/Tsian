---
type: always_apply
description: Lyra Next 项目概述与技术栈，帮助 Agent/Chat 在实现时保持统一项目上下文。
---

# Lyra Next（迁移自 `.kilocode/rules/00-project.mdc`）

面向终端玩家的跨平台 AI 角色扮演游戏框架（打开网址即可游玩）。

## 核心理念

- **热插拔模块化**：模块可在运行时加载/卸载，通过事件通信解耦
- **沉浸式动画 UI**：丰富的过渡动画、动态背景、流式响应渲染
- **多人联机**：基于 Yjs CRDT 的实时协作，支持回合制多人游戏
- **高度可自定义**：预设系统、世界书、角色卡，用户可深度定制体验

## 技术栈

- **框架**：React 19 + TypeScript + Vite
- **样式**：Tailwind CSS 4 + Framer Motion
- **状态**：Zustand + Yjs
- **存储**：IndexedDB (y-indexeddb) + OPFS
- **联机**：Yjs + Hocuspocus

## 项目结构

```text
src/
├── core/              # 核心基础设施（EventBus/CommandBus/Services）
├── modules/           # 功能模块（chat/data/room/save）
├── domain/            # 领域层（命令/事件/实体）
├── components/ui/     # 通用 UI 组件
├── hooks/             # 自定义 Hooks
├── lib/               # 工具库（ai/prompt/rules 等）
├── stores/            # 全局配置状态
└── styles/            # 样式文件
```

## 常用命令

```bash
pnpm dev          # 开发服务器
pnpm build        # 生产构建
pnpm preview      # 预览构建结果
```

