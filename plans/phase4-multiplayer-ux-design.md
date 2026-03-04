# 阶段4：联机体验完善 — 设计决策文档

> 本文档记录阶段4各话题的设计讨论结果，作为实现阶段的权威参考。

---

## 话题 1：常驻联机状态展示 (P1-4)

### 最终方案：非浮层顶栏（TopBar）

**核心决策**：将当前 GameHUD 中所有浮层按钮（`HubReturnButton`、移动端侧栏按钮）重构为**非浮层的薄顶栏**，作为 `<main>` 内部的 flex 布局元素，不再使用 `absolute` 定位。

#### 布局结构

```
联机模式（桌面端）：
┌──────────────────────────────────────────────────┐
│ [☰左]              2:30 🟢                [返回]  │  ← TopBar h-10, 非浮层
├──────────────────────────────────────────────────┤
│                                                  │
│  故事文本区域（零遮挡）                             │
│                                                  │
├──────────────────────────────────────────────────┤
│ [输入你的行动...]                            [➤]  │
└──────────────────────────────────────────────────┘

单机模式（桌面端）：
┌──────────────────────────────────────────────────┐
│ [☰左]                                    [返回]  │  ← 极简 TopBar
├──────────────────────────────────────────────────┤
│  故事文本区域                                     │
└──────────────────────────────────────────────────┘

移动端联机：
┌──────────────────────────────────────────────────┐
│ [☰左]        2:30 🟢          [☰右] [返回]       │
└──────────────────────────────────────────────────┘
```

#### 展示信息

| 模式 | 展示内容                  | 说明                                 |
| ---- | ------------------------- | ------------------------------------ |
| 联机 | 回合倒计时 + 连接状态圆点 | 仅显示核心信息，不显示回合号、人数等 |
| 单机 | 无额外信息                | 仅保留侧栏切换和返回入口             |

#### 交互

- 点击倒计时/连接状态区域 → 弹出 `RoomInfoDialog`（复用现有组件，展示完整房间信息）
- 点击返回 → 返回大厅（替代原 `HubReturnButton`）
- 移动端 `[☰左]` / `[☰右]` → 打开对应侧栏抽屉

#### 实现要点

1. 新建 `TopBar` 组件，放在 `GameHUD` 的 `<main>` 中作为 flex 子元素
2. 删除 `HubReturnButton` 的 `absolute` 浮层用法，功能收入 TopBar
3. 移动端侧栏按钮同样从 `absolute` 改为 TopBar 内 flex 布局
4. 通过 `useSessionStore` 判断联机/单机模式，条件渲染联机区域
5. 连接状态和倒计时逻辑可从 `RoomInfoButton` 提取复用
6. TopBar 高度 `h-10`（40px），视觉风格与侧栏一致（半透明 `bgElevated`）

#### 废弃内容

- `HubReturnButton` 组件作为独立浮层按钮的用法（功能合并到 TopBar）
- `MobileSidebarButton` 的 `absolute` 定位用法（合并到 TopBar）

---

## 话题 3：联机角色创建增强 (P1-5)

### 最终方案：废弃 SimpleForm，完全复用单机多步骤向导

**核心决策**：联机角色创建不再使用 `SimpleForm`（快速创建缺失属性/天赋等关键信息，在精细世界观中不可接受），改为与单机完全一致的多步骤向导体验。

#### WaitingLobby 交互流程

1. WaitingLobby 显示成员列表 + 角色创建状态（已创建/待创建）
2. 未创建角色的玩家看到「创建我的角色」按钮
3. 点击后打开**全屏 Dialog**，内嵌完整向导步骤
4. 向导完成后通过桥接层提交 `RoomCommands.CREATE_CHARACTER`
5. 已创建角色的玩家显示角色摘要 + 编辑按钮

#### 向导步骤（复用单机组件）

| 步骤          | 组件                     | 说明                         |
| ------------- | ------------------------ | ---------------------------- |
| 1. 名称与描述 | `SoloCharNameStep`       | 名称、外貌、性格、背景       |
| 2. 维度选择   | `DimensionSelectionStep` | worldConfig 无维度定义时跳过 |
| 3. 属性分配   | `SoloCharAttributesStep` | worldConfig 无属性规则时跳过 |
| 4. 天赋选择   | `SoloCharTalentsStep`    | worldConfig 无天赋定义时跳过 |
| 5. 确认预览   | `SoloCharConfirmStep`    | 汇总预览 + 确认              |

#### 桥接层设计

```
向导 context 暂存 → 完成 → mapContextToCharacterData() → RoomCommands.CREATE_CHARACTER
```

- 向导步骤使用"上下文暂存"模型（`context` 对象逐步填充），与单机一致
- 完成时桥接层一次性将 `context` 转换为联机命令 payload
- `worldConfig` 从 MainDoc 获取（联机权威源），通过 prop 传入向导步骤组件

#### 废弃内容

- `SimpleForm` 组件不再作为联机角色创建入口（可保留代码但标记 deprecated）
- WaitingLobby 中内嵌 SimpleForm 的卡片布局

---

## 话题 2：玩家协作视图 (P1-7)

### 最终方案：右侧栏新增「队伍」tab（仅联机模式可见）

**核心决策**：在 `RightSidebar` 中新增第三个 tab「队伍」，仅联机模式下显示。单机模式保持现有两个 tab 不变。

#### Tab 结构

| 模式 | Tab 列表                 |
| ---- | ------------------------ |
| 联机 | 场景 / **队伍** / 工具箱 |
| 单机 | 场景 / 工具箱            |

#### 「队伍」tab 内容

1. **成员列表** — 复用 `MemberList` 组件，展示头像/名称/在线状态
2. **回合提交状态** — 每个成员显示 ✅已提交 / ⏳未提交
3. **Host 控制区** — 复用 `HostControlButton`（全员已提交→开始回合 / 未全员→强制开始+确认）

#### 实现要点

1. `RightSidebarTab` 类型扩展为 `"scene" | "team" | "toolbox"`
2. 新建 `RightSidebarTeamTab` 组件，内部组合 `MemberList` + 提交进度 + `HostControlButton`
3. 通过 `useSessionStore` 判断联机模式，条件渲染 `team` tab
4. Tab 栏三个 tab 仍使用 `flex-1` 等宽（w-80/3 ≈ 107px，放图标+两字文字足够）
5. 移动端通过右侧栏抽屉访问

---

## 话题 4：行动撤回命令闭环 (P1-6)

### 最终方案：新增 WITHDRAW_ACTION 命令

**核心决策**：新增独立的 `WITHDRAW_ACTION` 命令（`room/turn/action/withdraw`），语义明确区别于 `UPDATE_ACTION`。

#### 命令定义

```typescript
// domain/commands/room.ts
WITHDRAW_ACTION: "room/turn/action/withdraw"

interface WithdrawActionPayload {
  roomId: string;
  turnNumber: number;
  userId: string;       // 被撤回行动的所属用户
  operatorId: string;   // 执行撤回的人（权限校验用）
}
```

#### 撤回语义

- 在 TurnDoc 中将该用户 action entry 的 `content` 清空、`submitted` 置为 `false`
- 撤回后用户回到"未提交"状态，可重新编写并提交行动

#### 权限规则

| 操作 | 自己 | Host 对他人         | 回合锁定后 |
| ---- | ---- | ------------------- | ---------- |
| 撤回 | ✅    | ✅（需二次确认弹窗） | ❌          |
| 修改 | ✅    | ❌                   | ❌          |
| 提交 | ✅    | ❌                   | ❌          |

#### UI 接入

- `ActionInput` 中现有的撤回按钮（Undo2 图标）绑定到 `WITHDRAW_ACTION` 命令
- 移除 `handleWithdraw` 中的 `TODO` 注释和本地状态 hack
- Host 撤回他人行动的入口放在「队伍」tab 的成员列表中（每个已提交成员旁显示撤回按钮）

#### Handler 实现要点

1. 校验 `operatorId === userId`（自己撤回）或 `operatorId` 是 Host
2. 校验回合未锁定（`isLocked === false`）
3. 在 TurnDoc 中更新 action entry
4. 发出 `ACTION_WITHDRAWN` 事件

---

## 话题 5：currentSaveId 事件化 (P1-8)

### 最终方案：YjsManager 增加 subscribeSaveId API

**核心决策**：在 `YjsManager` 中增加 `subscribeSaveId` 订阅 API，新建统一的 `useCurrentSaveId()` hook 使用 `useSyncExternalStore`，废弃所有轮询版本和模块内部版本。

#### API 设计

```typescript
// core/yjs/manager.ts
class YjsManager {
  private saveIdListeners = new Set<() => void>();

  subscribeSaveId(listener: () => void): () => void {
    this.saveIdListeners.add(listener);
    return () => this.saveIdListeners.delete(listener);
  }

  private notifySaveIdChange(): void {
    this.saveIdListeners.forEach(l => l());
  }

  // 在 loadSave() / deleteSave() / unloadSave() 中调用 notifySaveIdChange()
}
```

#### 统一 Hook

```typescript
// hooks/useCurrentSaveId.ts (新文件，全局统一入口)
export function useCurrentSaveId(): string | null {
  return useSyncExternalStore(
    (cb) => yjsManager.subscribeSaveId(cb),
    () => yjsManager.getCurrentSaveId(),
    () => null,
  );
}
```

#### 废弃内容

- `src/modules/save/hooks/useSaveData.ts` 中的 `useCurrentSaveId()`（100ms 轮询版）
- `src/modules/checkpoint/hooks/useCheckpoints.ts` 中的 `useCurrentSaveIdInternal()`
- `src/modules/chat/hooks/useChatData.ts` 中的 `useCurrentSaveIdInternal()`

---

## 话题 6：Multiplayer 组件复用 (P2-3)

### 最终方案：扩展 MemberList 支持状态展示

**核心决策**：WaitingLobby 和「队伍」tab 复用 `ConnectionIndicator` 和 `MemberList` 组件。

#### 复用清单

| 场景                  | 复用组件              | 说明                 |
| --------------------- | --------------------- | -------------------- |
| WaitingLobby 连接状态 | `ConnectionIndicator` | 替代内联重复实现     |
| WaitingLobby 成员列表 | `MemberList`          | 扩展显示角色创建状态 |
| 「队伍」tab 成员列表  | `MemberList`          | 扩展显示行动提交状态 |
| TopBar 连接状态       | `ConnectionIndicator` | 提取倒计时逻辑后复用 |

#### MemberList 扩展

```typescript
interface MemberListProps {
  // ... existing props ...
  showActionStatus?: boolean;      // 显示行动提交状态（队伍 tab 用）
  showCharacterStatus?: boolean;   // 显示角色创建状态（WaitingLobby 用）
  onWithdrawAction?: (userId: string) => void;  // Host 撤回行动回调
}
```

---

## 话题 7：P2 优化项评估

### 最终方案：本阶段纳入 P2-3 + P2-5，其余延后

| P2 项 | 描述                  | 本阶段 | 理由                      |
| ----- | --------------------- | ------ | ------------------------- |
| P2-3  | Multiplayer 组件复用  | ✅      | 与话题 1/2/3 直接关联     |
| P2-5  | useMultiplayer 抽象层 | ✅      | 在实现话题 1/2 过程中提取 |
| P2-1  | Chat 高级能力联机等价 | ❌ 延后 | 独立大功能块              |
| P2-2  | Data/Save 联机保真    | ❌ 延后 | 边缘场景                  |
| P2-4  | aiTools manifest      | ❌ 延后 | 独立功能模块              |
| P2-6  | 联机诊断工具          | ❌ 延后 | 开发者工具                |
| P2-7  | 历史消息分页          | ❌ 延后 | 性能优化                  |
| P2-8  | Awareness 模块化      | ❌ 延后 | 架构优化                  |
| P2-9  | AppShell 收敛         | ❌ 延后 | 范围太大                  |
| P2-10 | SubdocManager TODO    | ❌ 延后 | 低优先级                  |

延后项不打包为统一阶段，后续按需处理。

---

## 实施任务清单

按实现顺序排列：

1. **P1-8 currentSaveId 事件化** — YjsManager subscribe API + 统一 hook
2. **P1-4 TopBar 重构** — 非浮层顶栏，联机显示倒计时+连接状态
3. **P1-7 队伍 tab** — 右侧栏新增队伍 tab + RightSidebarTeamTab
4. **P1-6 行动撤回闭环** — WITHDRAW_ACTION 命令 + handler + UI 接入
5. **P1-5 联机角色创建** — 全屏向导 Dialog + 桥接层
6. **P2-3 组件复用** — MemberList 扩展 + WaitingLobby/TopBar 复用
7. **P2-5 useMultiplayer 抽象层** — 提取联机 hooks 统一入口
