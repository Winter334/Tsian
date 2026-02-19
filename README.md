# Lyra

纯网页 AI 角色扮演游戏框架 - 打开网址即可游玩。

## 特性

- 🌐 **纯网页应用** - 无需下载安装，打开网址即可使用
- 🔌 **模块热插拔** - 功能模块可动态加载/卸载
- 🎮 **AI 角色扮演** - 沉浸式 AIRP 游戏体验
- 👥 **多人联机** - 基于 Yjs CRDT 的实时同步
- 💾 **大容量存储** - IndexedDB + OPFS 支持 GB 级数据

## 技术栈

- **框架**: React 19 + TypeScript + Vite
- **样式**: Tailwind CSS 4 + Framer Motion
- **状态**: Zustand + Yjs
- **存储**: IndexedDB (y-indexeddb) + OPFS
- **联机**: Yjs + Hocuspocus

## 开始使用

```bash
# 安装依赖
pnpm install

# 开发服务器
pnpm dev

# 生产构建
pnpm build

# 预览构建结果
pnpm preview
```

## 项目结构

```
src/
├── core/                 # 核心基础设施
│   ├── event-bus/        # 事件总线
│   ├── command-bus/      # 命令总线
│   ├── registry/         # 模块注册表
│   └── storage/          # 存储层
├── modules/              # 功能模块（热插拔）
├── components/           # 共享 UI 组件
├── hooks/                # 共享 Hooks
├── lib/                  # 工具库
└── styles/               # 样式文件
```

## 架构

```
┌────────────────────────────────────────────┐
│ Plugin System (模块注册/生命周期/Hooks)    │
├────────────────────────────────────────────┤
│ Core (EventBus + CommandBus + Repository)  │
├────────────────────────────────────────────┤
│ Modules (Chat │ Character │ Combat │ Mods) │
└────────────────────────────────────────────┘
```

## 文档

- [架构设计文档](plans/lyra-next-architecture.md)
- [架构评估报告](plans/architecture-review.md)
- [方案对比分析](plans/architecture-comparison.md)

## 许可证

- 代码: AGPL-3.0
- 资源: CC BY-NC-SA 4.0
