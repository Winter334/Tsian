# 装备系统与双管线架构设计方案

**版本**：1.2
**性质**：核心架构设计文档
**前置依赖**：IRNR 管线、Inventory 模块、Rules Engine（RuleScript v2 已完成实现）
**设计日期**：2025-07-15
**修订日期**：2025-07-16（v1.2 — 适配 RuleScript v2 已完成状态，更新实施路线）

> **RuleScript v2 实现状态**：`rule-script.ts` 已完整实现 v2 指令集（16 个核心指令，含 `check.onSuccess/onFailure`、DC 分层、`GrantItemAction.effects` 等）。装备操作指令（`equipItem`/`unequipItem`/`useItem`）作为领域扩展指令待本方案实施时新增。

---

## 1. 问题陈述

### 1.1 愿景

实现 **AI 感知玩家 UI 操作 + 解析 AI 给出的操作 → 统一叙事输出** 的可交互沉浸式 AI 角色扮演游戏体验。

核心要求：
- 玩家从 UI 执行的操作（装备、使用物品、卸下装备等）能被 AI 感知并融入叙事
- AI 通过解析玩家输入产生的操作（战斗、检定等）经过规则引擎仲裁后输出叙事
- 两种来源的操作最终都通过叙事 AI 输出为剧情正文

### 1.2 当前困境

**所有操作被强制走同一条重型管线：**

```
所有操作 → Parser AI → Rules Engine → ResultFrame → Narrative AI
              ↑            ↑                             
           即使意图已明确    即使不需要掷骰/仲裁           
```

新增一个简单操作（如"装备铁剑"）需要修改 10 层垂直切片，开发成本是同类项目的 4-6 倍。

**结构性缺口汇总：**

| #   | 缺口                                  | 影响                              |
| --- | ------------------------------------- | --------------------------------- |
| 1   | 没有「玩家 UI 操作 → 数据变更」的通路 | 玩家无法从 UI 装备/使用物品       |
| 2   | `ItemInstance` 不携带 `effects` 字段  | 装备效果数据在模板→实例转换中丢失 |
| 3   | 属性计算管线不统一（UI 侧 vs 引擎侧） | 装备效果无处注入，两条路径不同步  |
| 4   | 缺少 equip/unequip/use 的完整实现     | 从 Action 到 UI 全链路缺失        |

### 1.3 核心洞察：操作分类

| 类型           | 特征                             | 示例                         | 需要引擎？ |
| -------------- | -------------------------------- | ---------------------------- | ---------- |
| **仲裁型操作** | 结果不确定，需要掷骰/检定/触发器 | 攻击、施法、潜行、社交检定   | ✅ 是       |
| **确定型操作** | 结果确定，仅需校验合法性         | 装备、卸下、使用消耗品、丢弃 | ❌ 否       |
| **纯查看**     | 不修改状态                       | 查看背包、查看属性           | ❌ 否       |

规则引擎的价值集中在**仲裁型操作**——公平性、可预测性、触发器联动。把这个重型机制强加到确定型操作上是过度设计。

---

## 2. 双管线架构

### 2.1 总体思路

> **让重的归重，让轻的归轻。两条管线共享数据层，AI 通过预设上下文感知状态。**

```
              ┌───────────────────────┐     ┌───────────────────────┐
              │   重型管线 (IRNR)      │     │   轻量管线 (Direct)    │
              │                      │     │                      │
              │ Parser AI            │     │ (跳过 Parser)         │
              │   ↓                  │     │                      │
              │ RuleScript           │     │ validate()           │
              │   ↓                  │     │   ↓                  │
              │ Rules Engine         │     │ execute()            │
              │   ↓                  │     │   ↓                  │
              │ ResultFrame          │     │ 即时生效              │
              │   ↓                  │     │                      │
              │ Narrative AI         │     │ (无叙事输出)          │
              │   ↓                  │     │                      │
              │ 叙事正文             │      │ UI 即时反馈           │
              └──────────┬──────────┘     └──────────┬──────────┘
                         │                           │
                         └─────────┬─────────────────┘
                                   │
                 ┌─────────────────┴───────────────────────────┐
                 │              共享数据层                       │
                 │   CommandBus / EventBus / Yjs / Store        │
                 └─────────────────────────────────────────────┘
                                   │
                 ┌─────────────────┴───────────────────────────┐
                 │         AI 上下文感知（预设注入）              │
                 │  buildInventoryData() / gameState snapshot   │
                 │  → 下一轮 IRNR 时 AI 自然看到最新状态         │
                 └─────────────────────────────────────────────┘
```

### 2.2 管线分工

| 维度            | 重型管线 (IRNR)                   | 轻量管线 (Direct)                        |
| --------------- | --------------------------------- | ---------------------------------------- |
| **触发条件**    | 玩家文字输入、AI 主动行为         | 玩家 UI 点击操作                         |
| **意图解析**    | Parser AI 解析自然语言            | 无需解析，UI 已明确                      |
| **规则执行**    | Rules Engine 执行（掷骰、触发器） | 直接校验 + 执行                          |
| **叙事生成**    | Narrative AI 生成叙事正文         | 无（UI toast/状态变更即可）              |
| **AI 感知方式** | ResultFrame 直接传给 Narrative AI | 预设上下文中的状态数据（下一轮自然感知） |
| **适用场景**    | 战斗、检定、复杂交互              | 装备、卸下、使用、丢弃                   |
| **新增成本**    | 10 层垂直切片                     | 3-4 层                                   |

### 2.3 AI 感知机制

**关键设计决策：AI 不需要显式收到"玩家装备了铁剑"的通知。**

理由：
1. AI 每轮都会收到角色的完整状态数据（通过预设中的 `gameState`、`inventoryData`），包括属性值、已装备物品等
2. AI 看到的是**当前状态快照**，而非变更日志——这与 AI 不会收到"上一轮的属性值"做对比是一致的
3. 简单操作（装备/卸下/丢弃）不产生叙事价值，让叙事 AI 描写这些内容对剧情没有帮助
4. 叙事 AI 的注意力应该集中在有剧情价值的内容上

```
玩家通过 UI 装备了铁剑
  → InventoryStore 更新: 铁剑 equipped=true, equipSlot="main_hand"
  → 属性重算: 力量从 10 变为 13 (铁剑+3)
  → UI 即时反馈: 背包界面更新

下一轮玩家输入 "我向前方的敌人挥剑"
  → IRNR 管线启动
  → buildInventoryData(): 读取 InventoryStore → 铁剑已装备 ✅
  → buildGameStateSnapshot(): 力量=13(含铁剑+3) ✅
  → Parser AI 自然看到铁剑已装备，据此生成合理的 RuleScript
```

### 2.4 操作缓冲区（为未来预留）

当前版本中，所有轻量管线操作都是**静默执行**的（不产生叙事输出，AI 通过状态快照自然感知）。

但未来某些复杂的 UI 操作（如偷窃、主动发起战斗等）可能需要显式通知 AI。对此预留**操作缓冲区**机制：

```typescript
/**
 * 操作缓冲区
 * 
 * 记录需要 AI 显式感知的 UI 操作。
 * 操作不会立即触发叙事 AI，而是在玩家按下发送按钮时，
 * 随玩家输入一起作为上下文注入 IRNR 管线。
 * 
 * 当前版本暂不实现，预留接口。
 */
interface PendingAction {
  /** 操作类型 */
  type: string;
  /** 操作摘要（供 Parser/Narrative AI 参考） */
  summary: string;
  /** 操作时间戳 */
  timestamp: number;
}

/**
 * 操作缓冲区 Store（未来实现）
 * 
 * 在玩家按下发送按钮时：
 * 1. 读取缓冲区中的待处理操作
 * 2. 将操作摘要作为额外上下文注入 IRNR 管线
 * 3. 清空缓冲区
 * 
 * 注入方式：作为 VariableContext 的额外字段，在预设模板中可引用。
 */
```

**当前阶段不实现操作缓冲区。** 所有轻量管线操作（装备/卸下/使用/丢弃）都是静默的，AI 通过预设状态快照自然感知。等到需要偷窃、战斗等复杂 UI 操作时再引入此机制。

---

## 3. 轻量管线详细设计

### 3.1 DirectAction 定义

```typescript
/**
 * 轻量管线的操作描述
 * 
 * 与 RuleScript 不同，DirectAction 是单操作、确定性的。
 * 不包含条件分支、掷骰、触发器等复杂逻辑。
 */
interface DirectAction {
  /** 操作类型 */
  type: DirectActionType;
  /** 发起者角色 ID */
  actorId: string;
  /** 操作参数 */
  payload: Record<string, unknown>;
}

type DirectActionType =
  | "equip_item"      // 装备物品
  | "unequip_item"    // 卸下装备
  | "use_item"        // 使用消耗品
  | "drop_item"       // 丢弃物品
  // 未来扩展：
  // | "trade_item"    // 交易
  // | "sort_inventory" // 整理背包
  // | "upgrade_item"  // 升级装备
  ;
```

### 3.2 轻量管线执行流程

```
玩家 UI 点击 "装备铁剑"
  │
  ▼
① 构造 DirectAction
   { type: "equip_item", actorId: "player", payload: { instanceId: "xxx", slot: "main_hand" } }
  │
  ▼
② validate(action) → ValidationResult
   - 物品是否在背包中？
   - 物品类别是否匹配槽位？
   - 槽位是否被 WorldConfig 定义？
   - 校验失败 → 返回错误（toast 提示），不继续
  │
  ▼
③ execute(action)
   - 检测槽位冲突（旧装备自动卸下）
   - 通过 CommandBus dispatch EQUIP_ITEM 命令
   - Handler 更新 Yjs + Store
   - 发射事件
  │
  ▼
④ UI 即时反馈
   - InventoryStore 变更 → React 重渲染
   - 物品状态从 "未装备" 变为 "已装备"
   - 属性面板自动更新（computeFullStats 包含装备效果）
   - 可选: toast 提示 "已装备 铁剑 → 主手"
```

**注意：没有叙事步骤。** 操作即时生效，UI 即时反馈。AI 在下一轮对话时通过预设上下文自然感知到状态变化。

---

## 4. 基础设施改进（P0 地基）

在实现双管线之前，需要先修补数据层的结构性缺口。

### 4.1 ItemInstance 增加 effects 字段

**当前问题**：`ItemTemplate` 有 `effects?: ItemEffect[]`，但 `ItemInstance` 没有。创建实例时效果丢失，AI 动态创造的物品无法携带效果。

**改动**：

```typescript
// src/domain/entities/item.ts

export interface ItemInstance {
  instanceId: string;
  templateId: string;
  name: string;
  description: string;
  category: ItemCategory;
  quantity: number;
  equipped: boolean;
  equipSlot?: EquipSlot;
  effects?: ItemEffect[];        // ← 新增
  source: "predefined" | "ai-generated";
  acquiredAt: number;
}

export interface CreateItemInstanceParams {
  templateId: string;
  name: string;
  description: string;
  category: ItemCategory;
  quantity?: number;
  equipSlot?: EquipSlot;
  effects?: ItemEffect[];        // ← 新增
  source: "predefined" | "ai-generated";
}
```

**影响范围**：
- `createItemInstance()` 工厂函数：传递 effects
- `inventory-codec.ts`：编解码 effects（JSON 序列化存入 Y.Map）
- `action-schemas.ts`：grantItem schema 增加 effects 参数描述
- ~~`rule-script.ts`：GrantItemAction 增加 effects 字段~~ → ✅ **已随 RuleScript v2 完成**
- `engine.ts`：执行 grantItem 时传递 effects 到 StructuralChange.details
- `commands/inventory.ts`：GrantItemPayload 增加 `effects` 字段
- `handlers.ts`：handleGrantItem 创建实例时传递 effects

### 4.2 统一属性计算函数

**当前问题**：UI (`useCharacterFullStats`) 和引擎 (`buildDefaultEntityFromWorldConfig`) 各自计算属性，两条路径互不相通，装备效果无处注入。

**方案**：提取共享的属性计算核心函数。

```typescript
// src/lib/rules/stats-pipeline.ts (新文件)

interface StatsComputeInput {
  /** 角色基础属性 */
  baseAttributes: Record<string, unknown>;
  /** 世界配置中的衍生属性公式 */
  derivedStats: DerivedStatConfig[];
  /** 世界配置中的基础属性默认值 */
  primaryAttributes: PrimaryAttributeConfig[];
  /** 天赋 ID 列表（天赋可能带 PassiveModifier） */
  talentIds?: string[];
  /** 已装备物品列表（物品效果中的 PassiveModifier） */
  equippedItems?: ItemInstance[];
  /** 状态标签（buff/debuff 的 PassiveModifier） */
  tags?: Map<string, TagMetadata>;
  /** 完整的 WorldConfig（用于查找天赋配置等） */
  worldConfig: WorldConfig;
}

/**
 * 统一属性计算管线
 * 
 * 计算顺序：
 * 1. 基础属性（primaryAttributes 默认值 + 角色 attributes 覆盖）
 * 2. 天赋被动修正（PassiveModifier from talents）
 * 3. 装备被动修正（PassiveModifier from equipped items' effects）
 * 4. 状态标签被动修正（PassiveModifier from tags）
 * 5. 衍生属性计算（formula 驱动）
 * 6. 资源字段保护合并（current 保留运行时值，max 取计算值）
 * 
 * UI 和引擎都调用此函数，保证数据一致。
 */
function computeFullStats(input: StatsComputeInput): Record<string, number> {
  // ...
}
```

**消费侧改动**：

```typescript
// useCharacterFullStats.ts — 改为调用 computeFullStats
export function useCharacterFullStats(...) {
  return useMemo(() => {
    const equippedItems = inventoryStore.items[charId]?.filter(i => i.equipped) ?? [];
    return computeFullStats({
      baseAttributes: character.attributes,
      equippedItems,
      talentIds: character.talentIds,
      // ...
    });
  }, [character, equippedItems, ...]);
}

// entity-accessor.ts — 改为调用 computeFullStats
export function buildDefaultEntityFromWorldConfig(...) {
  const fields = computeFullStats({ ... });
  return { id, type: "character", fields, tags: new Map() };
}
```

### 4.3 EquipSlot 类型加强（可选）

当前 `EquipSlot = string` 过于宽松。考虑是否值得在运行时增加校验：

```typescript
// 当前：
export type EquipSlot = string;

// 可选改进：保持 string 类型别名，但在 handler 中用 WorldConfig 校验
// （当前 handler 中已有此校验逻辑，无需改类型定义）
```

**结论**：保持 `string` 不变，校验在 handler 层完成。这对 AI 动态创造的世界设定更友好。

---

## 5. 装备操作的完整垂直切片（P1）

以 `equip_item` 为例，展示轻量管线中一个操作的完整实现。

### 5.1 新增命令

```typescript
// src/domain/commands/inventory.ts — 新增

export const InventoryCommands = {
  // ... 现有
  EQUIP_ITEM: "inventory.equip_item",
  UNEQUIP_ITEM: "inventory.unequip_item",
  USE_ITEM: "inventory.use_item",
} as const;

export interface EquipItemPayload {
  characterId: string;
  instanceId: string;
  /** 目标槽位，不指定时使用物品的 equipSlot 字段 */
  targetSlot?: string;
  reason?: string;
}

export interface UnequipItemPayload {
  characterId: string;
  instanceId: string;
  reason?: string;
}

export interface UseItemPayload {
  characterId: string;
  instanceId: string;
  /** 使用数量，默认 1 */
  quantity?: number;
  /** 使用目标（如对谁使用治疗药水） */
  targetId?: string;
  reason?: string;
}
```

### 5.2 新增事件

```typescript
// src/domain/events/inventory.ts — 新增

export const InventoryEvents = {
  // ... 现有
  ITEM_EQUIPPED: "inventory.item_equipped",
  ITEM_UNEQUIPPED: "inventory.item_unequipped",
  ITEM_USED: "inventory.item_used",
} as const;

export interface ItemEquippedPayload {
  characterId: string;
  item: ItemInstance;
  slot: string;
  /** 被替换下来的旧装备（如有） */
  replacedItem?: ItemInstance;
  reason?: string;
}

export interface ItemUnequippedPayload {
  characterId: string;
  item: ItemInstance;
  slot: string;
  reason?: string;
}

export interface ItemUsedPayload {
  characterId: string;
  item: ItemInstance;
  quantity: number;
  targetId?: string;
  reason?: string;
}
```

### 5.3 Store 新增方法

```typescript
// src/modules/inventory/store.ts — 新增

export interface InventoryState {
  // ... 现有字段和方法

  _equipItem(characterId: string, instanceId: string, slot: string): void;
  _unequipItem(characterId: string, instanceId: string): void;
  _updateItemQuantity(characterId: string, instanceId: string, newQuantity: number): void;
}
```

### 5.4 Handler 核心逻辑

```typescript
// src/modules/inventory/handlers.ts — handleEquipItem 伪代码

const handleEquipItem: CommandHandler<EquipItemPayload> = async (command) => {
  const { characterId, instanceId, targetSlot, reason } = command.payload;
  
  const repo = getInventoryRepository();
  const worldConfig = getRuntimeWorldConfig();
  const slotDefinitions = worldConfig.inventoryRules?.equipSlotDefinitions;
  
  // 1. 校验物品存在
  const item = repo.findItem(characterId, instanceId);
  if (!item) return { success: false, error: "Item not found" };
  
  // 2. 确定目标槽位
  const slot = targetSlot ?? item.equipSlot;
  if (!slot) return { success: false, error: "No equip slot specified" };
  
  // 3. 校验槽位合法性
  const slotDef = slotDefinitions?.find(s => s.id === slot);
  if (!slotDef) return { success: false, error: `Invalid slot: ${slot}` };
  if (slotDef.allowedCategories && !slotDef.allowedCategories.includes(item.category)) {
    return { success: false, error: `Slot ${slotDef.label} does not allow ${item.category}` };
  }
  
  // 4. 处理槽位冲突 — 卸下旧装备
  const charItems = useInventoryStore.getState().items[characterId] ?? [];
  const conflicting = charItems.find(i => i.equipped && i.equipSlot === slot);
  let replacedItem: ItemInstance | undefined;
  if (conflicting && conflicting.instanceId !== instanceId) {
    replacedItem = { ...conflicting };
    repo.updateEquipStatus(characterId, conflicting.instanceId, false);
    useInventoryStore.getState()._unequipItem(characterId, conflicting.instanceId);
  }
  
  // 5. 装备物品
  repo.updateEquipStatus(characterId, instanceId, true, slot);
  useInventoryStore.getState()._equipItem(characterId, instanceId, slot);
  
  // 6. 发射事件
  eventBus.emit(eventBus.createEvent<ItemEquippedPayload>(
    InventoryEvents.ITEM_EQUIPPED,
    { characterId, item: { ...item, equipped: true, equipSlot: slot }, slot, replacedItem, reason },
    "lyra.inventory"
  ));
  
  return { success: true };
};
```

### 5.5 Repository 新增能力

```typescript
// src/modules/inventory/repository/inventory-repository.ts — 新增

interface InventoryRepository {
  // ... 现有方法
  
  /** 更新物品的装备状态 */
  updateEquipStatus(characterId: string, instanceId: string, equipped: boolean, slot?: string): void;
  
  /** 更新物品数量（使用消耗品后） */
  updateItemQuantity(characterId: string, instanceId: string, newQuantity: number): void;
}
```

### 5.6 StructuralChange 类型扩展

```typescript
// src/domain/types/result-frame.ts — 扩展

export interface StructuralChange {
  readonly type:
    | "item_added"
    | "item_removed"
    | "item_equipped"      // ← 新增
    | "item_unequipped"    // ← 新增
    | "item_used"          // ← 新增
    | "skill_learned"
    | "skill_removed";
  readonly entityId: string;
  readonly targetId: string;
  readonly templateId?: string;
  readonly details?: Record<string, string | number | boolean>;
  readonly reason?: string;
}
```

### 5.7 StructuralChangeConsumer 扩展

```typescript
// src/modules/game/services/structural-change-consumer.ts — 新增 case

switch (change.type) {
  // ... 现有 case
  case "item_equipped":
    await dispatchEquipItem(change, commandBus);
    break;
  case "item_unequipped":
    await dispatchUnequipItem(change, commandBus);
    break;
  case "item_used":
    await dispatchUseItem(change, commandBus);
    break;
}
```

### 5.8 AI Action 支持（重型管线兼容）

AI 也应能通过重型管线发出装备/卸下指令。根据 RuleScript v2 设计文档（Appendix A），这些是**领域扩展指令**，不属于核心 16 个指令，但遵循相同的架构模式。

> **v2 对齐说明**：核心集 16 + 领域扩展上限 ~4 = 总上限 ~20 个 AI 可见指令。
> `equipItem`/`unequipItem`/`useItem` 是装备子系统的领域指令（+3），因为 `item.equipped` 不是实体属性（entity.fields），无法用核心指令 `set` 表达。

**需要修改的文件**：

1. `src/domain/types/rule-script.ts` — 新增类型定义 + 加入 `RuleAction` 联合类型
2. `src/lib/rules/engine.ts` — 在 action switch-case 中增加 `executeEquipItem`/`executeUnequipItem`/`executeUseItem`
3. `src/modules/inventory/schemas/action-schemas.ts` — 增加对应的 ActionSchema 定义

```typescript
// src/domain/types/rule-script.ts — 新增类型 + 加入 RuleAction 联合类型

export interface EquipItemAction extends RuleActionBase {
  type: "equipItem";
  target: string;       // 角色 ID
  instanceId: string;   // 物品实例 ID
  slot?: string;        // 目标槽位
  reason?: string;
}

export interface UnequipItemAction extends RuleActionBase {
  type: "unequipItem";
  target: string;
  instanceId: string;
  reason?: string;
}

export interface UseItemAction extends RuleActionBase {
  type: "useItem";
  target: string;       // 使用者
  instanceId: string;   // 物品实例 ID
  quantity?: number;
  useTarget?: string;   // 使用目标
  reason?: string;
}

// 需要更新 RuleAction 联合类型：
export type RuleAction =
  | CheckAction
  | RollAction
  // ... 现有 14 个 ...
  | EquipItemAction      // ← 领域扩展
  | UnequipItemAction    // ← 领域扩展
  | UseItemAction;       // ← 领域扩展
```

---

## 6. 轻量管线服务设计

### 6.1 DirectActionService

```typescript
// src/modules/game/services/direct-action-service.ts (新文件)

/**
 * 轻量管线服务
 * 
 * 处理确定性操作：装备、卸下、使用、丢弃等。
 * 跳过 Parser AI 和 Rules Engine，直接校验并执行。
 * 
 * 不产生叙事输出。AI 通过预设上下文中的状态快照自然感知变化。
 */
export interface DirectActionService {
  /**
   * 执行确定性操作
   * 
   * 1. 校验合法性
   * 2. 执行状态变更（通过 CommandBus）
   * 3. 返回执行结果
   */
  execute(action: DirectAction): Promise<DirectActionResult>;
}

interface DirectActionResult {
  success: boolean;
  error?: string;
}
```

### 6.2 操作处理器注册

```typescript
// 每种 DirectActionType 注册一个处理器

interface DirectActionHandler {
  /** 校验操作合法性 */
  validate(action: DirectAction): ValidationResult;
  /** 执行操作（通过 CommandBus dispatch） */
  execute(action: DirectAction): Promise<DirectActionResult>;
}

const handlers: Record<DirectActionType, DirectActionHandler> = {
  equip_item: new EquipItemHandler(),
  unequip_item: new UnequipItemHandler(),
  use_item: new UseItemHandler(),
  drop_item: new DropItemHandler(),
};
```

### 6.3 AI 感知机制

轻量管线不需要显式通知 AI。AI 感知通过已有机制自然实现：

```typescript
/**
 * AI 感知轻量管线操作的方式
 * 
 * 不需要写入聊天历史，不需要系统消息。
 * AI 通过以下已有机制在下一轮自然感知：
 */

// 1. buildInventoryData() — 从 InventoryStore 读取
//    → AI 看到角色当前拥有的物品及其 equipped 状态 ✅

// 2. buildGameStateSnapshot() — 从 EntityAccessor 读取
//    → AI 看到角色的属性值（已包含装备效果修正）✅

// 3. 预设模板中的 {{gameState}} / {{inventoryData}} 变量
//    → Parser AI 和 Narrative AI 每轮都收到最新状态 ✅
```

**不需要额外做任何事情。** 只要 Store 被正确更新，下一轮 IRNR 管线运行时 AI 就能看到最新状态。

---

## 7. UI 层设计

### 7.1 InventorySection 改造

当前 `InventorySection` 是纯只读的。改造为可交互：

```typescript
// src/components/CharacterPanel/InventorySection.tsx

// 每个物品项增加操作按钮
function ItemActions({ item, characterId, worldConfig }: {
  item: ItemInstance;
  characterId: string;
  worldConfig: WorldConfig;
}) {
  const isEquippable = !!item.equipSlot || ["weapon", "armor", "accessory"].includes(item.category);
  const isConsumable = item.category === "consumable";
  
  return (
    <div className="flex gap-1">
      {isEquippable && !item.equipped && (
        <button onClick={() => handleEquip(characterId, item)}>装备</button>
      )}
      {item.equipped && (
        <button onClick={() => handleUnequip(characterId, item)}>卸下</button>
      )}
      {isConsumable && (
        <button onClick={() => handleUse(characterId, item)}>使用</button>
      )}
      <button onClick={() => handleDrop(characterId, item)}>丢弃</button>
    </div>
  );
}

// 操作通过轻量管线执行
async function handleEquip(characterId: string, item: ItemInstance) {
  const result = await directActionService.execute({
    type: "equip_item",
    actorId: characterId,
    payload: { instanceId: item.instanceId },
  });
  
  if (!result.success) {
    toast.error(result.error);
  }
  // 成功时无需额外操作 — Store 更新自动触发 UI 重渲染
}
```

### 7.2 装备面板（后续任务）

独立的装备槽位可视化面板，展示各槽位上的装备。可在 CharacterPanel 中新增一个 Tab "装备"，或在 LeftSidebar 中展示简化版。

```
┌─────────────────────────┐
│  ⚔ 装备                 │
│                         │
│  主手: 铁剑              │
│  副手: (空)              │
│  头部: 皮帽              │
│  身体: 旅行者皮甲         │
│  腿部: (空)              │
│  脚部: 旧靴子             │
│  饰品1: 银指环            │
│  饰品2: (空)              │
└─────────────────────────┘
```

---

## 8. 数据流全景图

### 8.1 AI 驱动装备操作（重型管线）

```
玩家: "我把铁剑装备上"
  → Parser AI: 识别意图, 生成 RuleScript { actions: [{ type: "equipItem", target: "player", instanceId: "xxx" }] }
  → Rules Engine: 执行 equipItem action
    → 校验合法性
    → 生成 StructuralChange { type: "item_equipped", ... }
    → 写入 ResultFrame
  → Narrative AI: 基于 ResultFrame 生成叙事
    → "你将铁剑从背包中取出，寒光一闪..."
  → Commit:
    → StructuralChangeConsumer → dispatch EQUIP_ITEM command
    → Handler → 更新 Yjs + Store
  → 叙事输出到聊天流
```

### 8.2 玩家 UI 驱动装备操作（轻量管线）

```
玩家点击 "装备" 按钮
  → DirectActionService.execute({ type: "equip_item", ... })
    → validate(): 校验物品、槽位
    → execute(): 
      → dispatch EQUIP_ITEM command
      → Handler → 更新 Yjs + Store
  → UI 即时反馈:
    → InventoryStore 变更 → 背包界面重渲染
    → computeFullStats 重算 → 属性面板更新
    → 可选 toast: "已装备 铁剑 → 主手"
```

### 8.3 AI 自然感知玩家 UI 操作

```
第 N 轮: 玩家通过 UI 装备了铁剑
  → Store 更新: 铁剑 equipped=true
  → 属性重算: 力量 10→13
  → UI 即时反馈（无叙事输出）

第 N+1 轮: 玩家输入 "我向前方的敌人挥剑"
  → IRNR 管线启动
  → buildInventoryData(): 读取 InventoryStore
    → 铁剑(已装备, 主手) ✅
  → buildGameStateSnapshot(): 读取 EntityAccessor
    → 力量=13(含铁剑+3) ✅
  → Parser AI 看到最新状态快照，自然理解玩家已装备铁剑
  → 据此生成合理的 RuleScript（使用铁剑攻击）
```

**注意**：AI 不知道"玩家刚刚装备了铁剑"这件事（没有变更通知），但它知道"玩家当前装备着铁剑"（通过状态快照）。这是合理的——叙事 AI 不需要描写装备过程，它只需要知道当前状态来生成连贯的叙事。

---

## 9. 实施路线

### Phase 0: 地基（P0）

> **前置状态**：`GrantItemAction.effects` 已随 RuleScript v2 完成（`rule-script.ts`）。
> 此阶段主要修补数据层缺口，使 effects 能贯穿整个数据流。

- [ ] `ItemInstance` 增加 `effects?: ItemEffect[]` 字段
- [ ] `CreateItemInstanceParams` 增加 `effects?: ItemEffect[]` 字段
- [ ] 修改 `createItemInstance()` 传递 effects
- [ ] 修改 `inventory-codec.ts` 编解码 effects（JSON 序列化存入 Y.Map）
- [ ] `GrantItemPayload`（`commands/inventory.ts`）增加 `effects` 字段
- [ ] `handleGrantItem`（`handlers.ts`）创建实例时传递 effects
- [ ] `engine.ts` `executeGrantItem` 将 effects 写入 StructuralChange.details
- [ ] `structural-change-consumer.ts` `dispatchGrantItem` 读取并传递 effects
- [ ] 提取 `computeFullStats()` 统一属性计算函数（`src/lib/rules/stats-pipeline.ts`）
- [ ] `useCharacterFullStats` 改为调用 `computeFullStats()`
- [ ] `buildDefaultEntityFromWorldConfig` 改为调用 `computeFullStats()`
- [ ] `computeFullStats` 中预留 equippedItems 参数（暂不实现效果计算）

### Phase 1: 装备操作垂直切片（P1）

- [ ] 新增命令: `EQUIP_ITEM` / `UNEQUIP_ITEM` / `USE_ITEM`
- [ ] 新增事件: `ITEM_EQUIPPED` / `ITEM_UNEQUIPPED` / `ITEM_USED`
- [ ] Store 新增方法: `_equipItem` / `_unequipItem` / `_updateItemQuantity`
- [ ] Repository 新增: `updateEquipStatus` / `updateItemQuantity`
- [ ] Handler 实现（含槽位冲突检测）
- [ ] `StructuralChange` 类型扩展（增加 `item_equipped` / `item_unequipped` / `item_used`）
- [ ] `StructuralChangeConsumer` 新增 case
- [ ] AI 领域扩展指令类型: `EquipItemAction` / `UnequipItemAction` / `UseItemAction`（加入 `RuleAction` 联合类型）
- [ ] `action-schemas.ts` 增加 equipItem / unequipItem / useItem 的 ActionSchema 定义
- [ ] `engine.ts` 增加 `executeEquipItem` / `executeUnequipItem` / `executeUseItem` 分支
- [ ] `InventorySection` 增加操作按钮（通过 DirectActionService 或直接 CommandBus 执行）

### Phase 2: 轻量管线框架（P2）

- [ ] 定义 `DirectAction` 类型
- [ ] 实现 `DirectActionService` 核心（validate + execute 路由）
- [ ] 实现各操作的 `DirectActionHandler`（equip/unequip/use/drop）
- [ ] UI 操作改为通过 `DirectActionService` 执行

### Phase 3: 效果联动（P3）

- [ ] `computeFullStats` 实现装备效果计算（读取 equippedItems.effects.modifiers）
- [ ] 装备/卸下时触发属性重算
- [ ] `action-schemas.ts` grantItem schema 增加 effects 参数描述（让 AI 能动态创造带效果的物品）
- [ ] grantItem 时从模板自动继承 effects

### Phase 4: 增强体验（P4）— 后续

- [ ] 独立装备面板 UI（槽位可视化）
- [ ] 拖拽装备操作
- [ ] 消耗品使用效果执行（use_item 触发 effects）
- [ ] 装备面板在 GameHUD LeftSidebar 中展示简化版
- [ ] 操作缓冲区机制（为偷窃/战斗等复杂 UI 操作预留）

---

## 10. 风险与注意事项

### 10.1 轻量管线与重型管线的一致性

两条管线共享数据层（CommandBus → Handler → Yjs/Store），最终都写同一个 Store。
但需要确保：
- 事件名称和 payload 格式一致
- 两条管线产生的 StructuralChange 格式兼容
- 不出现重复执行（AI 说"装备铁剑"的同时玩家也点了装备）

### 10.2 AI 状态感知的局限性

AI 通过预设上下文中的状态快照感知变化，这意味着：
- AI 不知道变化**何时发生**（没有变更日志）
- AI 不知道变化的**原因**（是玩家主动装备还是剧情触发）
- 这在当前阶段是**可接受的**——AI 只需要知道当前状态来生成合理叙事

如果未来需要 AI 感知变化过程（如偷窃操作需要 AI 生成叙事），可通过**操作缓冲区**机制（见 2.4）解决：将操作摘要缓冲，随玩家下一次发送一并注入 IRNR 管线。

### 10.3 联机模式

联机模式下，玩家的 UI 操作需要通过 Yjs 同步到所有客户端。
当前 InventorySyncBridge 已处理 Store → Yjs 同步，但需要确认：
- `equipped` 字段的变更能正确通过 `observeDeep` 捕获
- 远端的 Store 更新能触发 UI 重渲染

### 10.4 向后兼容

所有改动必须保证：
- 现有的 4 个命令（GRANT/REMOVE ITEM/SKILL）不受影响
- 现有的 IRNR 管线不受影响
- 现有的 WorldConfig 格式兼容（新字段都是可选的）

### 10.5 性能

- `computeFullStats` 可能被频繁调用（每次渲染），需要 memoize
- 装备变更触发属性重算时，避免不必要的全量重算
- 轻量管线的 validate + execute 应该是同步的（不依赖 AI 调用），保证 UI 操作的即时反馈

---

## 附录 A：当前 vs 改进后的操作新增成本对比

| 操作               | 当前成本 | 改进后成本 | 说明                                    |
| ------------------ | -------- | ---------- | --------------------------------------- |
| 新增一个仲裁型操作 | 10 层    | 10 层      | 不变，这类操作本就需要完整管线          |
| 新增一个确定型操作 | 10 层    | 3-4 层     | Command + Handler + DirectActionHandler |
| 新增一个纯 UI 展示 | 1 层     | 1 层       | 不变，直接读 Store                      |

## 附录 B：与同类项目的对比

| 维度             | 同类项目         | Lyra（改进后）                 |
| ---------------- | ---------------- | ------------------------------ |
| 战斗系统公平性   | AI 自说自话      | 规则引擎仲裁，掷骰决定         |
| 简单操作开发效率 | 半天             | 半天（轻量管线）               |
| AI 感知玩家操作  | 手动维护状态描述 | 自动注入（预设上下文状态快照） |
| 装备效果联动     | 无或手动         | PassiveModifier 自动计算       |
| 多端同步         | 无               | Yjs 实时同步                   |
| 世界设定灵活性   | 硬编码           | WorldConfig 数据驱动           |
