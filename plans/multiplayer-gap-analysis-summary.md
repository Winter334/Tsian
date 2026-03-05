# Lyra Next 联机模式差距分析 — 综合报告

> **生成时间**：2026-03-02  
> **输入文档**：4 份分层分析报告（核心基础设施 / 功能模块 / UI 组件 / Yjs 同步层）

---

## 1. 项目联机现状总览

Lyra Next 的联机能力**已形成可运行的端到端链路**：基于 Yjs CRDT 的三层文档模型（MainDoc / TurnDoc / HistoryDoc）承载房间状态、回合状态与历史归档；Room 模块提供建房 / 入房 / 回合推进 / AI 处理 / 成员管理的完整命令面；RoomSyncBridge 实现了快照差异检测与事件派生；GameWizard 完成了联机建房 / 入房 / 等待大厅 / 续玩的 UI 流程。当前项目已经可以进行"以回合叙事为核心的多人协作"游戏。

然而，联机能力是**业务层拼装出来的**而非核心层内建能力——EventBus / CommandBus / Registry 本身不区分单机 / 联机，联机主要集中在 `core/yjs + modules/room` 链路。单机与联机并非同构实现，而是"单机 Chat 链路 + 联机 Room 链路"双轨并行，存在命令定义与实现不对齐、权限校验不统一、部分业务域未联机同步、游戏内联机信息感知不足等缺口。

### 已完成的联机基础能力

- ✅ Yjs CRDT 多文档架构（MainDoc / TurnDoc / HistoryDoc + SharedWebSocket 复用）
- ✅ 房间生命周期管理（创建 / 加入 / 离开 / 重连 / 房主转让）
- ✅ 回合制核心链路（行动提交 / 锁定 / AI 生成 / 回合完成 / 历史归档）
- ✅ AI 流式响应的跨端实时同步（TurnDoc.aiResponse Y.Text）
- ✅ 角色系统跨端同步（MainDoc.characters → SaveSlot 镜像）
- ✅ 历史消息跨端同步（HistoryDoc → Guest SaveSlot 镜像）
- ✅ 联机记忆同步（HistoryDoc.memoryRoot + MemorySync）
- ✅ 联机存档管理（saveType 区分、联机续玩、成员到齐校验）
- ✅ GameWizard 联机流程（建房 / 入房 / 等待大厅 / 开局条件约束）
- ✅ 联机专用 UI 组件库（ConnectionIndicator / HostControlButton / MemberList / RoomInfoDialog / TypingIndicator）
- ✅ 联机设置配置（自定义 API/WS 地址、格式校验）

---

## 2. 功能对照矩阵

### 2.1 对话 / 消息系统

| 功能                          | 单机  | 联机  |   状态   | 说明                                                        |
| ----------------------------- | :---: | :---: | :------: | ----------------------------------------------------------- |
| 发送用户消息                  |   ✅   |   ✅   |  ✅ 可用  | 单机走 Chat Handler；联机走 Room ActionInput                |
| AI 流式回复                   |   ✅   |   ✅   |  ✅ 可用  | 单机走 StreamSession；联机走 TurnDoc.aiResponse             |
| 消息编辑（用户）              |   ✅   |   ❌   |  ⚠️ 缺失  | 联机 TurnNarrativeFlow 未传 messageId，编辑上下文菜单不可用 |
| 消息编辑（AI）                |   ✅   |   ❌   |  ⚠️ 缺失  | 同上                                                        |
| 消息删除                      |   ✅   |   ❌   |  ⚠️ 缺失  | 联机无统一删除语义                                          |
| 重新生成 AI 回复              |   ✅   |   ✅   |  ✅ 可用  | 联机通过 REGENERATE_AI_TURN 实现                            |
| 会话创建 / 选择 / 清空 / 删除 |   ✅   |   —   | ℹ️ 不适用 | 联机采用回合制，不以会话为中心                              |
| 消息分支管理                  |   ✅   |   ❌   |  ⚠️ 缺失  | 联机未实现 conversation branching                           |
| 从检查点回溯重生成            |   ✅   |   ❌   |  ⚠️ 缺失  | 联机的 checkpoint 链路未对接回溯流程                        |
| 流式事件通知                  |   ✅   |   ✅   |  ✅ 可用  | 各自链路的事件机制均正常                                    |
| 行动撤回                      |   —   |   ❌   |  ⚠️ 缺失  | UI 有按钮但命令侧为 TODO，仅本地重置                        |

### 2.2 角色系统

| 功能                 | 单机  | 联机  |   状态   | 说明                                                          |
| -------------------- | :---: | :---: | :------: | ------------------------------------------------------------- |
| 角色创建（完整向导） |   ✅   |   ❌   | ⚠️ 不对齐 | 联机仅 SimpleForm，缺少维度/属性/天赋流程                     |
| 角色属性展示         |   ✅   |   ✅   |  ✅ 可用  | CharacterPanel 可展示                                         |
| 角色跨端同步         |   —   |   ✅   |  ✅ 可用  | MainDoc.characters + SyncBridge 镜像                          |
| 多玩家角色列表       |   —   |   ❌   |  ⚠️ 缺失  | 无"其他玩家角色"统一列表/卡片区                               |
| 当前角色定位         |   ✅   |   ⚠️   |  ⚠️ 风险  | usePlayerCharacter 取"第一个 player 角色"，未按操作者身份过滤 |
| 装备系统             |   ✅   |   ❌   |  ⚠️ 缺失  | Inventory 仅本地 SaveSlot，不跨玩家同步                       |
| 背包系统             |   ✅   |   ❌   |  ⚠️ 缺失  | 同上                                                          |
| 技能系统             |   ✅   |   ❌   |  ⚠️ 缺失  | 同上                                                          |
| 状态标签             |   ✅   |   ✅   |  ✅ 可用  | 随角色数据同步                                                |

### 2.3 NPC 系统

| 功能         | 单机  | 联机  |  状态  | 说明                                     |
| ------------ | :---: | :---: | :----: | ---------------------------------------- |
| NPC 列表展示 |   ✅   |   ✅   | ✅ 可用 | 右侧场景栏 NpcList                       |
| NPC 详情弹窗 |   ✅   |   ✅   | ✅ 可用 | NpcDetailDialog                          |
| NPC 创建     |   ✅   |   ❌   | ⚠️ 缺失 | room/npc/create 命令已定义但未注册处理器 |
| NPC 状态更新 |   ✅   |   ❌   | ⚠️ 缺失 | room/npc/status/update 命令未注册处理器  |
| NPC 信息更新 |   ✅   |   ❌   | ⚠️ 缺失 | room/npc/info/update 命令未注册处理器    |

### 2.4 世界设定（Lorebook）

| 功能              | 单机  | 联机  |    状态    | 说明                                                |
| ----------------- | :---: | :---: | :--------: | --------------------------------------------------- |
| Lorebook 编辑     |   ✅   |   ✅   | ℹ️ 本地配置 | 设计上为本地配置，不联机共享                        |
| Lorebook 激活策略 |   ✅   |   ✅   |   ✅ 可用   | 本地配置，AI 调用时生效                             |
| worldConfig 快照  |   ✅   |   ⚠️   |  ⚠️ 不一致  | Guest 新建存档时取本地 preset，未对齐 Host 权威配置 |

### 2.5 世界档案（WorldArchive）

| 功能            | 单机  | 联机  |  状态  | 说明                               |
| --------------- | :---: | :---: | :----: | ---------------------------------- |
| 实体创建 / 编辑 |   ✅   |   ❌   | ⚠️ 缺失 | 仅本地 SaveSlot，不跨玩家同步      |
| 实体关系管理    |   ✅   |   ❌   | ⚠️ 缺失 | 同上                               |
| AI 驱动实体更新 |   ✅   |   ❌   | ⚠️ 缺失 | 同上，各玩家看到的实体状态可能分叉 |

### 2.6 存档系统

| 功能            | 单机  | 联机  |   状态   | 说明                                         |
| --------------- | :---: | :---: | :------: | -------------------------------------------- |
| 存档创建        |   ✅   |   ✅   |  ✅ 可用  | 联机由 Room handler 创建 multiplayer save    |
| 存档加载        |   ✅   |   ✅   |  ✅ 可用  | 联机通过 MultiplayerSaveDialog               |
| 存档删除        |   ✅   |   ✅   |  ✅ 可用  | SaveManager 支持                             |
| 自动保存        |   ✅   |   ✅   |  ✅ 可用  | 单机 STREAM_END；联机 TURN_COMPLETED（Host） |
| 联机续玩        |   —   |   ✅   |  ✅ 可用  | saveId 匹配 + 成员到齐校验                   |
| 导入 / 导出     |   ✅   |   ⚠️   | ⚠️ 不完整 | 联机专有状态（members/roomId 等）保真不足    |
| Checkpoint 跨端 |   ✅   |   ❌   |  ⚠️ 缺失  | 基于 SaveSlot 本地语义，不跨玩家同步         |

### 2.7 AI 调用

| 功能           | 单机  | 联机  |  状态  | 说明                                 |
| -------------- | :---: | :---: | :----: | ------------------------------------ |
| Prompt 构建    |   ✅   |   ✅   | ✅ 可用 | 联机 IRNR 管线已打通                 |
| AI 流式生成    |   ✅   |   ✅   | ✅ 可用 | 联机通过 TurnDoc.aiResponse 实时同步 |
| AI 工具调用    |   ✅   |   ✅   | ✅ 可用 | Host 执行，结果写入 TurnDoc          |
| AI 后处理      |   ✅   |   ✅   | ✅ 可用 | Host 侧执行                          |
| AI 取消 / 重试 |   ✅   |   ✅   | ✅ 可用 | CANCEL_AI_TURN / REGENERATE_AI_TURN  |

### 2.8 预设系统

| 功能            | 单机  | 联机  |    状态    | 说明             |
| --------------- | :---: | :---: | :--------: | ---------------- |
| 预设编辑 / 切换 |   ✅   |   ✅   | ℹ️ 本地配置 | 设计上为本地配置 |
| 预设导入 / 导出 |   ✅   |   ✅   | ℹ️ 本地配置 | 不联机共享       |

### 2.9 UI 功能

| 功能                     | 单机  | 联机  |  状态  | 说明                           |
| ------------------------ | :---: | :---: | :----: | ------------------------------ |
| 左侧栏（角色/状态/日志） |   ✅   |   ✅   | ✅ 可用 | 但缺少联机信息                 |
| 右侧栏（场景/工具）      |   ✅   |   ⚠️   | ⚠️ 不足 | 场景栏偏 NPC，无玩家协作视图   |
| 操作日志                 |   ✅   |   ✅   | ✅ 可用 |                                |
| 常驻联机状态显示         |   —   |   ❌   | ⚠️ 缺失 | 游戏内无连接态/人数/倒计时总览 |
| 房间信息弹窗             |   —   |   ✅   | ✅ 可用 | RoomInfoDialog 已挂载          |
| 场景展示                 |   ✅   |   ✅   | ✅ 可用 |                                |

### 2.10 回合制系统

| 功能            | 单机  | 联机  |  状态  | 说明                                       |
| --------------- | :---: | :---: | :----: | ------------------------------------------ |
| 回合推进        |   —   |   ✅   | ✅ 可用 | START_TURN / ADVANCE_PHASE / COMPLETE_TURN |
| 行动提交 / 锁定 |   —   |   ✅   | ✅ 可用 | SUBMIT_ACTION + LOCK_ACTION                |
| 行动修改 / 撤回 |   —   |   ❌   | ⚠️ 缺失 | UI 有入口但命令未闭环                      |
| 超时处理        |   —   |   ⚠️   | ⚠️ 部分 | TimeoutDialog 存在但 KICK_MEMBER 无处理器  |
| 回合历史归档    |   —   |   ✅   | ✅ 可用 | HistoryDoc.archivedTurns                   |

### 2.11 成员管理

| 功能            | 单机  | 联机  |   状态   | 说明                                  |
| --------------- | :---: | :---: | :------: | ------------------------------------- |
| 成员加入 / 离开 |   —   |   ✅   |  ✅ 可用  | SyncBridge 派生 MEMBER_JOINED 等事件  |
| 房主转让        |   —   |   ✅   |  ✅ 可用  | HOST_TRANSFERRED 事件派生             |
| 踢出成员        |   —   |   ❌   | ❌ 不可用 | KICK_MEMBER 被 UI 调用但无处理器      |
| 房间设置更新    |   —   |   ❌   |  ⚠️ 缺失  | room/settings/update 命令未注册处理器 |
| 房间删除        |   —   |   ❌   |  ⚠️ 缺失  | room/delete 命令未注册处理器          |

---

## 3. 按优先级分类的问题清单

### P0 — 必须修复（不修复则联机不可用或数据不一致）

#### P0-1：KICK_MEMBER 命令无处理器导致运行时失败

- **问题描述**：`TimeoutDialog` 在"踢出未提交玩家"路径会 dispatch `room/member/kick`，但该命令无注册处理器，运行时必然失败
- **影响范围**：回合超时流程、房主管理能力
- **涉及文件/模块**：`src/domain/commands/room.ts`、`src/modules/room/handlers.ts`、超时弹窗组件
- **建议方向**：在 Room handlers 中实现 KICK_MEMBER 处理器，含 Host 权限校验 + MainDoc 成员移除 + 事件派生

#### P0-2：多个 Room/Chat 命令已定义但未实现

- **问题描述**：`room/delete`、`room/settings/update`、`room/turn/action/update`、`room/history/load`、`room/history/archive`、`room/npc/*`、`chat.regenerate_message`、`chat.stop_generation`、`chat.update_conversation` 等命令仅有定义无处理器
- **影响范围**：NPC 联机管理、房间设置修改、行动修改、历史管理等功能名义支持实际不可用
- **涉及文件/模块**：`src/domain/commands/room.ts`、`src/domain/commands/chat.ts`、`src/modules/room/handlers.ts`、`src/modules/chat/handlers.ts`
- **建议方向**：逐一评估哪些命令是 MVP 必需的，优先实现 NPC 管理和 settings update；非必需的可标记为 planned

#### P0-3：Inventory / Skill 联机同步缺失

- **问题描述**：InventorySyncBridge 仅从 SaveSlot 本地同步到 InventoryStore，未通过联机文档跨玩家同步
- **影响范围**：多人对战中装备变更、战利品分配、技能使用无法跨客户端一致
- **涉及文件/模块**：`src/modules/inventory/sync/`、需新增 MainDoc 或 HistoryDoc 中的 inventory 命名空间
- **建议方向**：将 Inventory/Skill 状态挂入 MainDoc 或新增子文档，建立对应 SyncBridge

#### P0-4：WorldArchive 联机同步缺失

- **问题描述**：WorldArchiveSyncBridge 仅本地同步，实体档案不跨玩家共享
- **影响范围**：玩家看到的世界实体状态可能分叉，AI 基于不一致状态生成内容
- **涉及文件/模块**：`src/modules/world-archive/sync/`、需扩展联机文档结构
- **建议方向**：将 WorldArchive 数据挂入 HistoryDoc 或 MainDoc，建立跨端 SyncBridge

#### P0-5：worldConfig 缺少 Host 权威同步

- **问题描述**：Guest 新建联机存档时 worldConfig 取本地 preset 快照，未强制对齐 Host 端配置
- **影响范围**：规则计算、UI 推导、AI prompt 构建可能与 Host 不一致
- **涉及文件/模块**：`src/modules/room/handlers.ts`（JOIN_ROOM 链路）、`src/modules/save/handlers.ts`
- **建议方向**：在 MainDoc 中同步 worldConfig 权威快照，Guest 加入时从 MainDoc 回填而非使用本地 preset

#### P0-6：共享 WebSocket 引用计数泄漏风险

- **问题描述**：`TurnDocProvider.disconnectAll()` 未对共享 WebSocket 引用逐一 release，可能导致连接残留
- **影响范围**：离房后连接不彻底清理，下次联机状态异常
- **涉及文件/模块**：`src/core/yjs/turn-doc-provider.ts`、`src/core/yjs/shared-ws-manager.ts`
- **建议方向**：确保 disconnectAll 逐连接调用 release，与 SharedWebSocketManager 引用计数配对

#### P0-7：usePlayerCharacter 联机角色定位错误风险

- **问题描述**：当前取"第一个 player 角色"，联机场景下所有玩家角色都在 characters 列表中，可能展示他人角色
- **影响范围**：角色面板、HUD 侧栏展示的角色可能不是当前玩家的
- **涉及文件/模块**：`src/components/CharacterPanel/usePlayerCharacter.ts`
- **建议方向**：改为按 `operatorUserId` / `operatorUniqueTag` 匹配当前用户身份

---

### P1 — 重要缺失（严重影响联机体验）

#### P1-1：联机权限校验不一致

- **问题描述**：多个"仅 Host 可调用"命令（EXTEND_TURN_DEADLINE / FORCE_START_TURN / LOCK_ACTION）缺少 Handler 级身份校验；SUBMIT_ACTION 未校验 userId 与成员身份绑定
- **影响范围**：安全性和一致性风险，恶意客户端可伪造操作
- **涉及文件/模块**：`src/modules/room/handlers.ts`、`src/core/command-bus.ts`
- **建议方向**：实现 CommandBus 权限中间件，基于 sender + room membership/role 统一预校验

#### P1-2：模块注册体系不统一

- **问题描述**：save / data / room 三个模块绕过 Registry 直接注册命令，unregisterAllModules 未调用 unregisterRoomModule
- **影响范围**：生命周期与可观测性不一致，热插拔能力打折
- **涉及文件/模块**：`src/modules/index.ts`、`src/modules/save/index.ts`、`src/modules/data/index.ts`、`src/modules/room/index.ts`
- **建议方向**：让 save/data/room 也以 manifest 进入 Registry，补齐 unregister 路径

#### P1-3：模式状态源分散

- **问题描述**：AppState / SaveType / RoomStore.mode 三者共同决定"当前模式"，缺少统一 SessionMode 聚合状态源
- **影响范围**：边界状态难定位，跨模块模式判断可能不一致
- **涉及文件/模块**：`src/App.tsx`、`src/modules/room/store.ts`、`src/modules/save/`
- **建议方向**：新增 session store 或 core session service，统一派生 mode / saveType / roomId / isHost / connectionStatus

#### P1-4：游戏内缺少常驻联机状态入口

- **问题描述**：GameHUD 没有常驻连接状态、成员数、回合剩余时间、房主身份提示
- **影响范围**：多人协作时信息不透明，增加沟通成本
- **涉及文件/模块**：`src/components/GameHUD/index.tsx`、`src/components/Multiplayer/RoomInfoButton.tsx`
- **建议方向**：在 GameHUD 顶部或右上角接入常驻联机胶囊，复用 RoomInfoButton

#### P1-5：联机角色创建与单机能力不对齐

- **问题描述**：单机有多步骤完整向导（维度/属性/天赋/确认），联机仅 SimpleForm 快速创建
- **影响范围**：高自定义世界的联机体验降级
- **涉及文件/模块**：`src/components/GameWizard/steps/WaitingLobby.tsx`、`src/components/GameWizard/components/CharacterCreation/SimpleForm.tsx`
- **建议方向**：在 WaitingLobby 提供"快速创建 / 详细创建"二选一

#### P1-6：联机消息编辑 / 删除链路缺失统一语义

- **问题描述**：联机主视图由 Turn/History 驱动，chat 编辑语义主要面向单机消息，联机下消息级编辑不可用
- **影响范围**：联机玩家无法编辑已发送的行动或消息
- **涉及文件/模块**：`src/modules/room/components/TurnNarrativeFlow.tsx`、`src/modules/chat/components/NarrativeBlock.tsx`
- **建议方向**：在 TurnDoc 层增加 action update 语义，为已提交行动提供修改/撤回命令闭环

#### P1-7：GameHUD 右侧场景栏缺少玩家协作视图

- **问题描述**：当前偏 NPC 视图，缺少成员提交状态 / 在线状态的主入口
- **影响范围**：联机时缺少对队友状态的实时感知
- **涉及文件/模块**：`src/components/GameHUD/RightSidebarSceneTab.tsx`
- **建议方向**：增加"玩家协作区"tab，展示成员在线状态、提交进度、当前回合动作概览

#### P1-8：currentSaveId 监听采用轮询

- **问题描述**：`useCurrentSaveId()` 通过 `setInterval(100ms)` 轮询，性能浪费且时效不精确
- **影响范围**：存档切换响应延迟、不必要的性能消耗
- **涉及文件/模块**：相关 hooks 文件
- **建议方向**：在 yjsManager load/save 切换时提供 subscribe API，替代轮询

#### P1-9：缺少同步一致性测试矩阵

- **问题描述**：联机逻辑复杂但缺少自动化测试覆盖（断网、重入、回放等场景）
- **影响范围**：回归风险高，改动可能引入隐蔽的同步问题
- **涉及文件/模块**：测试目录
- **建议方向**：建立专项测试集覆盖断线重连、回合切换竞态、离房清理、联机续玩等场景

---

### P2 — 优化改进（可后续迭代）

#### P2-1：Chat 单机高级能力未在联机等价落地

- **问题描述**：消息级编辑 / 重生成 / 分支管理在联机回合流中未等价迁移
- **影响范围**：联机叙事灵活性不如单机
- **涉及文件/模块**：`src/modules/chat/`、`src/modules/room/components/`
- **建议方向**：评估联机场景对分支管理的实际需求，选择性迁移

#### P2-2：Data / Save 对联机专有状态保真不足

- **问题描述**：导出模型未覆盖 members / lastRoomId / HistoryDoc / TurnDoc 等联机数据
- **影响范围**：联机存档导入后无法恢复完整联机关系
- **涉及文件/模块**：`src/modules/data/handlers.ts`
- **建议方向**：扩展导出模型覆盖联机元信息；HistoryDoc/TurnDoc 可选导出

#### P2-3：Multiplayer 组件复用不足

- **问题描述**：WaitingLobby 自带 ConnectionIndicator 实现而非复用 components/Multiplayer；MemberList 组件复用率低
- **影响范围**：维护成本上升，行为不一致
- **涉及文件/模块**：`src/components/GameWizard/steps/WaitingLobby.tsx`、`src/components/Multiplayer/`
- **建议方向**：推动组件复用，消除重复实现

#### P2-4：aiTools manifest 能力未落地

- **问题描述**：Registry 支持 aiTools 声明，但所有模块 manifest 中 aiTools 为空
- **影响范围**：AI 工具能力无法通过 Registry 统一收集/执行
- **涉及文件/模块**：各模块 `index.ts` manifest 定义
- **建议方向**：至少为 room/game/memory 提供 manifest 级工具声明

#### P2-5：缺少统一 useMultiplayer/useYjs 抽象层

- **问题描述**：联机相关 hooks 分散在 room/chat/memory 多个入口
- **影响范围**：多入口维护成本高，新增联机功能时接入路径不清晰
- **涉及文件/模块**：`src/modules/room/hooks/`、`src/modules/chat/hooks/`、`src/modules/memory/`
- **建议方向**：抽取统一 useMultiplayer 层，封装连接、同步、状态等公共逻辑

#### P2-6：联机设置缺少诊断工具

- **问题描述**：MultiplayerSettings 无"测试连接 / 延迟检查 / 服务器健康状态"可视化
- **影响范围**：用户连接问题排查困难
- **涉及文件/模块**：`src/components/Settings/MultiplayerSettings.tsx`
- **建议方向**：增加连接测试按钮和状态指示

#### P2-7：历史消息分页性能问题

- **问题描述**：内部先 `toArray()` 再切片，超长会话时内存放大；AI 处理前记忆注入全量拉取
- **影响范围**：长时房间性能下降
- **涉及文件/模块**：历史消息读取相关代码、AI 处理链路
- **建议方向**：改为尾索引游标 + 局部区间读取；Memory 注入只读最近 N 条

#### P2-8：Awareness 缺少独立模块化封装

- **问题描述**：Awareness 逻辑分布于 provider 与 hooks，无独立文件
- **影响范围**：演进时边界不清晰
- **涉及文件/模块**：`src/core/yjs/multiplayer-provider.ts`、room hooks
- **建议方向**：抽取独立 awareness 模块

#### P2-9：AppShell 与现有主流程关系未收敛

- **问题描述**：App.tsx 当前主流程使用 TitleScreen/GameHub/GameHUD，AppShell 未进入主流程
- **影响范围**：双布局体系增加认知负担
- **涉及文件/模块**：`src/components/layout/AppShell.tsx`、`src/App.tsx`
- **建议方向**：明确接入或弃用，减少双布局体系

#### P2-10：SubdocManager 残留 TODO 注释

- **问题描述**：loadMainDoc/loadTurnDoc 路径保留"TODO: 网络同步"本地占位语义
- **影响范围**：认知负担
- **涉及文件/模块**：`src/core/yjs/subdoc-manager.ts`
- **建议方向**：清理或标注明确状态

---

## 4. 实施路线图

### Phase 1：联机基础可用（修复 P0 问题）

**目标**：确保联机核心链路无运行时错误、数据一致性有保障。

| 任务                                                                        | 涉及主要文件                                                  |
| --------------------------------------------------------------------------- | ------------------------------------------------------------- |
| 实现 KICK_MEMBER 处理器                                                     | `src/modules/room/handlers.ts`                                |
| 评估并实现 MVP 必需的未注册命令（NPC 管理、settings update、action update） | `src/modules/room/handlers.ts`、`src/domain/commands/room.ts` |
| 修复 usePlayerCharacter 按操作者身份过滤                                    | `src/components/CharacterPanel/usePlayerCharacter.ts`         |
| worldConfig Host 权威同步                                                   | `src/modules/room/handlers.ts`（JOIN_ROOM）、MainDoc 结构扩展 |
| 修复 TurnDocProvider.disconnectAll 引用计数                                 | `src/core/yjs/turn-doc-provider.ts`                           |
| Inventory/Skill 联机同步（挂入 MainDoc + SyncBridge）                       | `src/modules/inventory/sync/`、`src/core/yjs/`                |
| WorldArchive 联机同步（挂入联机文档 + SyncBridge）                          | `src/modules/world-archive/sync/`、`src/core/yjs/`            |

---

### Phase 2：联机体验完善（解决 P1 问题）

**目标**：权限体系统一、信息感知充分、关键流程闭环。

| 任务                                              | 涉及主要文件                                                                  |
| ------------------------------------------------- | ----------------------------------------------------------------------------- |
| 实现 CommandBus 权限中间件（Host/Guest 统一校验） | `src/core/command-bus.ts`、`src/modules/room/handlers.ts`                     |
| 统一模块注册体系（save/data/room → Registry）     | `src/modules/index.ts`、各模块 `index.ts`                                     |
| 新增 SessionMode 聚合层                           | 新建 `src/core/session/` 或 `src/stores/session.ts`                           |
| GameHUD 接入常驻联机状态胶囊                      | `src/components/GameHUD/index.tsx`、复用 `RoomInfoButton`                     |
| 联机角色创建增加"详细创建"分支                    | `src/components/GameWizard/steps/WaitingLobby.tsx`                            |
| 行动撤回命令闭环                                  | `src/modules/room/handlers.ts`、`src/modules/room/components/ActionInput.tsx` |
| 联机消息编辑语义                                  | `src/modules/room/components/TurnNarrativeFlow.tsx`                           |
| 右侧栏增加玩家协作视图                            | `src/components/GameHUD/RightSidebarSceneTab.tsx`                             |
| 替换 currentSaveId 轮询为事件订阅                 | `src/core/yjs/yjs-manager.ts`、相关 hooks                                     |
| 建立联机同步一致性测试集                          | 测试目录                                                                      |

---

### Phase 3：联机优化打磨（P2 + 打磨优化）

**目标**：架构收敛、性能优化、开发者体验提升。

| 任务                                       | 涉及主要文件                                        |
| ------------------------------------------ | --------------------------------------------------- |
| Chat 单机高级能力选择性迁移到联机          | `src/modules/chat/`、`src/modules/room/`            |
| Data/Save 联机状态导出增强                 | `src/modules/data/handlers.ts`                      |
| Multiplayer 组件去重与复用推动             | `src/components/Multiplayer/`、`WaitingLobby.tsx`   |
| aiTools manifest 落地                      | 各模块 `index.ts`                                   |
| 统一 useMultiplayer 抽象层                 | 新建抽象 hooks                                      |
| 联机诊断工具                               | `src/components/Settings/MultiplayerSettings.tsx`   |
| 历史消息分页性能优化                       | 历史读取相关代码                                    |
| Awareness 独立模块化                       | `src/core/yjs/`                                     |
| AppShell 定位收敛                          | `src/components/layout/AppShell.tsx`、`src/App.tsx` |
| 清理 SubdocManager TODO 注释               | `src/core/yjs/subdoc-manager.ts`                    |
| 长时房间压测（万条消息、百回合、频繁重连） | 测试/压测环境                                       |

---

## 5. 详细分析文档索引

| #   | 文档                                                     | 关注点                                                                                      | 主要发现                                                                |
| --- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| 1   | [核心基础设施分析](./multiplayer-gap-analysis-1-core.md) | EventBus / CommandBus / Registry / Yjs 基础设施 / 模块注册 / 应用层模式切换                 | 核心总线模式中立但缺少权限语义；模块注册不统一；联机能力集中在 core/yjs |
| 2   | [功能模块分析](./multiplayer-gap-analysis-2-modules.md)  | Chat / Data / Room / Save / Domain 各模块单机 vs 联机能力对比                               | 双轨并行架构；命令定义与实现不对齐；权限校验覆盖不均                    |
| 3   | [UI 组件层分析](./multiplayer-gap-analysis-3-ui.md)      | 聊天 UI / GameHUD / Multiplayer 组件 / GameWizard / CharacterPanel / SaveManager / Settings | 组件能力可用但接入分散；游戏内联机感知不足；角色创建深度不对齐          |
| 4   | [Yjs 同步层分析](./multiplayer-gap-analysis-4-sync.md)   | 文档结构 / SyncBridge 覆盖 / 数据同步完整性 / 可靠性评估                                    | 三文档模型完整；Inventory/WorldArchive/Checkpoint 未联机同步；性能隐患  |
