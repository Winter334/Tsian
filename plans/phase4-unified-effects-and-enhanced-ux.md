# Phase 4：统一效果模型与增强体验

**版本**：2.0
**性质**：实施计划文档
**前置依赖**：Phase 0-3 已完成（双管线架构、装备操作垂直切片、轻量管线框架、效果联动）
**设计日期**：2025-07-17
**修订日期**：2025-07-18（v2.0 - 基于讨论重构操作日志与消耗品模型）

---

## 1. 设计决策摘要

以下决策在 Phase 4 规划讨论中确定：

### 1.1 三通道管线模型

| 通道                       | 触发方式 | 流程                                    | 适用场景                                         |
| -------------------------- | -------- | --------------------------------------- | ------------------------------------------------ |
| **通道 1：轻量管线**       | UI 按钮  | validate → execute → Store 更新 → toast | 装备/卸下/丢弃/确定性消耗品                      |
| **通道 2：模板化规则管线** | UI 交互  | 预构建 RuleScript → Engine → 操作日志   | 行动型消耗品/偷窃/战斗（**本期实现消耗品部分**） |
| **通道 3：完整 IRNR**      | 文字输入 | Parser AI → Engine → Narrative AI       | 自由文本交互                                     |

### 1.2 统一效果模型（BG3 模型）

**核心原则**：效果就是效果，引擎只处理效果本身，不关心来源。

- 所有结构化效果统一通过 **Tag 系统**注入引擎
- 装备效果在实体构建时创建 **shadow Tag**（运行时派生，不单独持久化）
- `collectPassiveModifiers()` 无需修改——统一扫描所有 Tags
- Parser AI **不需要知道**结构化效果的存在，引擎自动附加
- 纯叙事/抽象效果通过 Tag 的 `effectDescription` 供 AI 感知

### 1.3 效果生效原则

**核心原则**：确定性效果是噪音，AI 通过实体状态自然感知。

- **即时静默生效**：所有确定性可即时生效的效果（HP/MP 恢复、属性修改、添加状态）直接修改状态，不通知 AI
- AI 通过下次 IRNR 时构建的实体快照自然感知状态变化
- 将叙事中心放在真正需要描写的事件上（战斗、检定、剧情转折），而不是"玩家使用了药水"这样的小事
- UI 通过 toast 提供即时反馈

### 1.4 操作日志策略

- **操作日志（Operation Log）**：存储 UI 操作通过规则引擎产生的 `ResultFrame`
- ResultFrame 有两个输入源：AI 行动脚本（通道 3）和玩家 UI 交互（通道 2）
- 操作日志在下次 IRNR 启动时与其他 ResultFrame 合并，统一由 Narrative AI 叙事
- 不随意触发 Narrative AI，保持管线流程完整性
- HUD 中提供入口查看待叙事的操作日志

### 1.5 UI 决策

- 装备面板 → 角色详情页新增 `"equipment"` 标签页
- 不使用拖拽操作，通过按钮交互
- 暂不在 LeftSidebar 侧边栏展示装备面板

### 1.6 消耗品使用：双路径模型

消耗品 `onUse` 根据内容自动判断执行路径：

| 路径                 | 判断条件                                    | 执行方式                             | 产出                   | AI 感知                 |
| -------------------- | ------------------------------------------- | ------------------------------------ | ---------------------- | ----------------------- |
| **路径 A：静默生效** | onUse 全部是 heal/cost/set/addTag/removeTag | `executeSimpleAction` 直接修改 Store | 无 ResultFrame         | 下次实体快照自然感知    |
| **路径 B：操作日志** | onUse 包含 check/damage/roll                | 构建 RuleScript → Engine             | ResultFrame → 操作日志 | 合并到 IRNR ResultFrame |

---

## 2. Phase 4a：统一效果基础设施

### 2.1 `computeFullStats()` 接口重构

**当前状态**：接受 `equippedItems?: ItemInstance[]`，内部提取 `scope: "stat"` 的 modifiers。

**目标**：接受统一的 `passiveModifiers?: PassiveModifier[]`，不再关心来源。

**改动文件**：`src/lib/rules/stats-pipeline.ts`

```typescript
// 修改前
export interface StatsComputeInput {
  baseAttributes: Record<string, unknown>;
  primaryAttributes: PrimaryAttributeConfig[];
  derivedStats: DerivedStatConfig[];
  talentIds?: string[];              // 移除
  equippedItems?: ItemInstance[];     // 移除
  tags?: Map<string, TagMetadata>;   // 移除
  worldConfig?: WorldConfig;         // 移除
}

// 修改后
export interface StatsComputeInput {
  baseAttributes: Record<string, unknown>;
  primaryAttributes: PrimaryAttributeConfig[];
  derivedStats: DerivedStatConfig[];
  /** 统一的被动修正列表（来自装备/天赋/buff，调用方负责收集） */
  passiveModifiers?: PassiveModifier[];
}
```

`computeFullStats()` 内部的装备效果处理逻辑（步骤 4）改为遍历 `passiveModifiers`，只处理 `scope: "stat"` 的修正。逻辑基本不变，只是数据来源从 `equippedItems.effects.modifiers` 变为 `passiveModifiers`。

### 2.2 `useCharacterFullStats()` 适配

**改动文件**：`src/hooks/useCharacterFullStats.ts`

调用方负责从所有来源收集 `PassiveModifier[]`：

```typescript
export function useCharacterFullStats(
  character: Character | null,
  worldConfig: WorldConfig,
): Record<string, number> {
  const characterItems = useInventoryStore((s) =>
    character ? (s.items[character.id] ?? EMPTY_ITEMS) : EMPTY_ITEMS,
  );

  return useMemo(() => {
    if (!character) return {};

    // 从所有来源收集被动修正
    const passiveModifiers: PassiveModifier[] = [];

    // 来源 1：已装备物品
    const equippedItems = characterItems.filter((item) => item.equipped);
    for (const item of equippedItems) {
      for (const effect of item.effects ?? []) {
        if (effect.type === "modifier" && effect.modifiers) {
          passiveModifiers.push(...effect.modifiers);
        }
      }
    }

    // 来源 2：天赋
    for (const talentId of character.talentIds ?? []) {
      const talent = worldConfig.talents?.find((t) => t.id === talentId);
      if (talent?.modifiers) {
        passiveModifiers.push(...talent.modifiers);
      }
    }

    // 来源 3：持久化 buff/debuff Tags
    // 从 character.tags 反序列化后提取 passive modifiers
    const tags = deserializeTagsFromYjs(character.tags);
    for (const [, tagMeta] of tags) {
      const trigger = tagMeta.trigger;
      if (trigger?.timing === "passive" && trigger.modifiers) {
        passiveModifiers.push(...trigger.modifiers);
      }
    }

    return computeFullStats({
      baseAttributes: character.attributes ?? {},
      primaryAttributes: worldConfig.primaryAttributes,
      derivedStats: worldConfig.derivedStats,
      passiveModifiers,
    });
  }, [character, characterItems, worldConfig]);
}
```

### 2.3 新增 `applyEquipmentEffectsToEntity()`

**改动文件**：`src/modules/game/services/entity-accessor.ts`

在实体构建时，为每件已装备物品创建一个合并的 shadow Tag：

```typescript
/**
 * 将已装备物品的效果作为 shadow Tag 注入实体
 *
 * 与 applyTalentsToEntity 类似，shadow Tag 是运行时派生的，
 * 不单独持久化。每次构建实体时从 equippedItems 重新计算。
 *
 * Tag ID 格式：`equip:{instanceId}`
 * Tag category：`"equipment"`
 */
export function applyEquipmentEffectsToEntity(
  entity: EntityData,
  equippedItems: ItemInstance[],
): void {
  for (const item of equippedItems) {
    if (!item.effects?.length) continue;

    const allModifiers: PassiveModifier[] = [];
    const descriptions: string[] = [];

    for (const effect of item.effects) {
      if (effect.modifiers) {
        allModifiers.push(...effect.modifiers);
      }
      if (effect.description) {
        descriptions.push(effect.description);
      }
    }

    const tagId = `equip:${item.instanceId}`;
    const metadata: TagMetadata = {
      id: tagId,
      displayName: item.name,
      effectDescription: descriptions.join("; "),
      source: "equipment",
      category: "equipment",
    };

    // 有结构化修正时包装为 passive trigger
    if (allModifiers.length > 0) {
      metadata.trigger = {
        timing: "passive",
        actions: [],
        modifiers: allModifiers,
      };
    }

    entity.tags.set(tagId, metadata);
  }
}
```

### 2.4 `buildEntityFromCharacterData()` 调用新函数

**改动文件**：`src/modules/game/services/entity-accessor.ts`

在 `buildEntityFromCharacterData()` 中，`applyTalentsToEntity()` 之后调用 `applyEquipmentEffectsToEntity()`。

需要传入已装备物品列表。物品数据来源：

1. 从 `InventoryStore` 读取（如果可用）
2. 或从 `EntityAccessor.getItems?.()` 读取（引擎侧）

具体方式取决于 `buildEntityFromCharacterData()` 的调用上下文。当前它在 IRNR 管线中被调用，此时 `InventoryStore` 已有数据，可以直接读取。

### 2.5 `ItemEffect` 类型扩展

**改动文件**：`src/domain/entities/item.ts`

```typescript
export interface ItemEffect {
  type: "narrative" | "modifier";
  description: string;
  modifiers?: PassiveModifier[];

  /**
   * 消耗品使用时执行的动作列表（复用 RuleAction 类型）
   *
   * 路径自动判断：
   * - 全部是 heal/cost/set/addTag/removeTag → 路径 A（静默生效）
   * - 包含 check/damage/roll → 路径 B（引擎执行 → 操作日志）
   */
  onUse?: RuleAction[];
}
```

> **注意**：`RuleAction` 是联合类型（含 check/roll 等），路径判断在运行时通过检查 action types 实现。

### 2.6 `TagMetadata` category 扩展

**改动文件**：`src/domain/types/result-frame.ts`

```typescript
export interface TagMetadata {
  // ... 现有字段 ...
  /** 标签类别 */
  category?: "talent" | "condition" | "equipment";
  // equipment 为新增：装备 shadow Tag 使用
}
```

---

## 3. Phase 4b：UI 与功能实现

### 3.1 装备面板 Tab

**新增文件**：`src/components/CharacterPanel/EquipmentSection.tsx`

**改动文件**：`src/components/CharacterPanel/index.tsx`

在 `CharacterPanelTabKey` 中新增 `"equipment"`，TAB_ITEMS 增加装备标签页。

**装备面板设计**：

```
┌─────────────────────────────────────┐
│  ⚔ 装备                             │
│                                     │
│  ┌─── 主手 ──────────────────────┐  │
│  │ 🗡 铁剑                        │  │
│  │ 力量+3 / 攻击检定+1            │  │
│  │                    [卸下]      │  │
│  └────────────────────────────────┘  │
│                                     │
│  ┌─── 副手 ──────────────────────┐  │
│  │ (空槽位)                       │  │
│  └────────────────────────────────┘  │
│                                     │
│  ┌─── 头部 ──────────────────────┐  │
│  │ 🎩 皮帽                        │  │
│  │ 无特殊效果                     │  │
│  │                    [卸下]      │  │
│  └────────────────────────────────┘  │
│                                     │
│  ... 其余槽位由 WorldConfig 定义 ... │
└─────────────────────────────────────┘
```

**数据来源**：
- 槽位定义：`worldConfig.inventoryRules?.equipSlotDefinitions`
- 已装备物品：`useInventoryStore` 中 `equipped === true` 的物品
- 匹配：物品的 `equipSlot` 与槽位 `id` 对应

**交互**：
- 每个已装备的槽位显示物品信息 + `[卸下]` 按钮
- 空槽位显示灰色提示
- 卸下通过 `directActionService.execute({ type: "unequip_item", ... })` 执行

### 3.2 操作日志 Store

**新增文件**：`src/modules/game/stores/operation-log-store.ts`

```typescript
import { create } from "zustand";
import type { ResultFrame } from "@/domain/types";

interface OperationLogEntry {
  /** 唯一标识 */
  id: string;
  /** 操作来源描述（如 "使用 火焰瓶"） */
  source: string;
  /** 引擎产生的 ResultFrame */
  resultFrame: ResultFrame;
  /** 操作时间戳 */
  timestamp: number;
}

interface OperationLogState {
  /** 日志条目列表 */
  entries: OperationLogEntry[];

  /** 添加条目 */
  addEntry(entry: Omit<OperationLogEntry, "id">): void;

  /** 消费并清空所有条目（IRNR 启动时调用），返回 ResultFrame 列表 */
  consumeAll(): ResultFrame[];

  /** 获取当前条目数 */
  count(): number;

  /** 清空 */
  clear(): void;
}
```

**写入时机**：
- 路径 B 消耗品使用后 → `addEntry({ source: "使用 火焰瓶", resultFrame, ... })`
- 未来通道 2 的其他 UI 操作（如偷窃模板）也写入操作日志

**消费时机**：在 IRNR 管线启动时（`executePipeline` 中），读取并清空操作日志，将 ResultFrame 合并到主流程。

> **注意**：路径 A（静默生效的确定性消耗品）不写入操作日志。装备/卸下/丢弃等轻量管线操作也不写入。

### 3.3 操作日志 HUD 入口

**改动文件**：`src/components/GameHUD/index.tsx` 或 `src/components/GameHUD/LeftSidebar.tsx`

在 HUD 中添加操作日志查看入口：

```
┌──── 操作日志 (1) ─────────────────────┐
│                                       │
│  🔥 火焰瓶 → 哥布林                    │
│  伤害: 2d6 = 8 (火焰)                 │
│  状态: 哥布林获得 [炎上] (3回合)        │
│                                       │
│  ⏳ 将在下次对话中由叙事描写           │
└───────────────────────────────────────┘
```

**设计要点**：
- 当操作日志非空时显示 badge（条目数量）
- 点击展开弹出面板，从 `ResultFrame.mechanicSummary` 格式化展示
- 标注"待叙事"状态
- 只读，不支持撤销（效果已生效）
- 消费后（IRNR 执行完毕）自动清除

**位置建议**：聊天输入框附近或 LeftSidebar 底部。

### 3.4 操作日志注入 IRNR 管线

**改动文件**：
- `src/modules/game/services/irnr-pipeline.ts`（管线核心）

在 `executePipeline` 中，Phase 2b 之前（或合并 ResultFrame 时）：

```typescript
// irnr-pipeline.ts - executePipeline 内部

// 读取操作日志
import { useOperationLogStore } from "../stores/operation-log-store";
const operationLogFrames = useOperationLogStore.getState().consumeAll();

// ... Phase 2a: trigger pipeline → preResultFrame ...
// ... Phase 2b: engine execution → mainResultFrame ...

// Phase 2c: 合并所有 ResultFrame
// 操作日志 + trigger + engine → 统一 ResultFrame
resultFrame = mergeAllResultFrames(
  operationLogFrames,  // UI 操作产生的 ResultFrame（可能多个）
  preResultFrame,      // trigger pipeline 产生的 ResultFrame
  mainResultFrame,     // 引擎执行产生的 ResultFrame
);
```

**`mergeAllResultFrames` 函数**：

```typescript
function mergeAllResultFrames(
  operationLogFrames: ResultFrame[],
  pre: ResultFrame | undefined,
  main: ResultFrame,
): ResultFrame {
  // 先合并操作日志（多个 → 一个）
  let mergedLog: ResultFrame | undefined;
  if (operationLogFrames.length > 0) {
    mergedLog = operationLogFrames.reduce((acc, frame) => ({
      ...acc,
      valueChanges: [...acc.valueChanges, ...frame.valueChanges],
      diceRolls: [...acc.diceRolls, ...frame.diceRolls],
      checks: [...acc.checks, ...frame.checks],
      mechanicSummary: acc.mechanicSummary
        ? `${acc.mechanicSummary} ${frame.mechanicSummary}`
        : frame.mechanicSummary,
    }));
  }

  // 组装 mechanicSummary
  const parts: string[] = [];
  if (mergedLog?.mechanicSummary) {
    parts.push(`[操作日志] ${mergedLog.mechanicSummary}`);
  }
  if (pre?.mechanicSummary) {
    parts.push(`[回合开始] ${pre.mechanicSummary}`);
  }
  parts.push(`[行动] ${main.mechanicSummary}`);

  return {
    ...main,
    valueChanges: [
      ...(mergedLog?.valueChanges ?? []),
      ...(pre?.valueChanges ?? []),
      ...main.valueChanges,
    ],
    diceRolls: [
      ...(mergedLog?.diceRolls ?? []),
      ...(pre?.diceRolls ?? []),
      ...main.diceRolls,
    ],
    checks: [
      ...(mergedLog?.checks ?? []),
      ...(pre?.checks ?? []),
      ...main.checks,
    ],
    mechanicSummary: parts.join(" "),
  };
}
```

### 3.5 消耗品 onUse 执行

**改动文件**：`src/modules/inventory/handlers.ts`（`handleUseItem`）

当前 `handleUseItem` 只做数量扣减。增加 onUse 执行逻辑，根据内容自动判断路径：

```typescript
/** 需要引擎执行的 action 类型 */
const ENGINE_ACTION_TYPES = new Set(["check", "damage", "roll"]);

/** 判断 onUse 是否需要走引擎路径 */
function requiresEngine(actions: RuleAction[]): boolean {
  return actions.some((a) => ENGINE_ACTION_TYPES.has(a.type));
}

const handleUseItem = async (command) => {
  // ... 现有校验逻辑 ...
  
  // 扣减数量（已有）
  repo.updateItemQuantity(characterId, instanceId, newQty);
  useInventoryStore.getState()._updateItemQuantity(...);

  // 收集所有 onUse actions
  const allOnUseActions: RuleAction[] = [];
  if (item.effects) {
    for (const effect of item.effects) {
      if (effect.onUse?.length) {
        allOnUseActions.push(...effect.onUse);
      }
    }
  }

  if (allOnUseActions.length > 0) {
    if (requiresEngine(allOnUseActions)) {
      // ── 路径 B：引擎执行 → 操作日志 ──
      await executeItemViaEngine(allOnUseActions, characterId, targetId, item);
    } else {
      // ── 路径 A：静默生效 ──
      for (const action of allOnUseActions) {
        await executeSimpleAction(action, characterId, targetId);
      }
    }
  }

  // ... 发射事件 + toast ...
};
```

### 3.6 路径 A：`executeSimpleAction` 函数

仅处理确定性 RuleAction，不走引擎，直接修改 Store 和 Yjs：

```typescript
async function executeSimpleAction(
  action: RuleAction,
  actorId: string,
  targetId?: string,
): Promise<void> {
  switch (action.type) {
    case "heal": {
      // 直接修改目标角色的资源字段
      // 通过 CommandBus dispatch CHARACTER.UPDATE_ATTRIBUTE
      // 或直接操作 Store + Yjs（与其他 handler 一致）
      break;
    }
    case "damage":
    case "cost": {
      // 扣减资源字段
      break;
    }
    case "set": {
      // 直接设置属性值
      break;
    }
    case "addTag": {
      // 将标签写入 character.tags（Yjs 持久化）
      // 标签的生命周期由自身 duration/trigger 管理
      persistTagToCharacter(actorId, action);
      break;
    }
    case "removeTag": {
      // 从 character.tags 移除标签
      removeTagFromCharacter(actorId, action.tag);
      break;
    }
    default:
      console.warn(`[executeSimpleAction] 不支持的动作类型: ${action.type}`);
  }
}
```

**Tag 持久化函数** `persistTagToCharacter`：

```typescript
/**
 * 将 Tag 写入 character.tags（Yjs 持久化）
 *
 * 从 AddTagAction 构建 TagMetadata，写入 Character 的 tags 字段。
 * 下次 IRNR 构建实体时，characterToEntityData() 会自动加载这些 Tags。
 */
function persistTagToCharacter(characterId: string, action: AddTagAction): void {
  const worldConfig = getRuntimeWorldConfig();
  const predefinedCondition = worldConfig.conditions?.find(
    (c) => c.id === action.tag,
  );

  const metadata: TagMetadata = {
    id: action.tag,
    displayName: action.displayName ?? predefinedCondition?.name ?? action.tag,
    effectDescription:
      action.effectDescription ??
      predefinedCondition?.description ??
      action.reason ??
      "",
    trigger: action.trigger ?? predefinedCondition?.trigger,
    remainingDuration: action.duration ?? predefinedCondition?.duration,
    source: predefinedCondition ? "predefined" : "ai-generated",
    category: "condition",
  };

  // 写入 Yjs（通过 Repository）
  const repo = getCharacterRepository();
  repo.addTag(characterId, action.tag, metadata);

  // 同步更新 Store
  useCharacterStore.getState()._addTag(characterId, action.tag, metadata);
}
```

### 3.7 路径 B：`executeItemViaEngine` 函数

构建 RuleScript → 引擎执行 → ResultFrame → 操作日志：

```typescript
/**
 * 通过引擎执行行动型消耗品
 *
 * 构建 RuleScript 并通过 Rules Engine 执行，
 * 产生的 ResultFrame 存入操作日志，
 * 效果立即应用到 Store，等待下次 IRNR 由 Narrative AI 叙事。
 */
async function executeItemViaEngine(
  actions: RuleAction[],
  actorId: string,
  targetId: string | undefined,
  item: ItemInstance,
): Promise<void> {
  // 1. 解析 target 占位符（$target → 实际 targetId）
  const resolvedActions = actions.map((action) =>
    resolveTargetPlaceholders(action, actorId, targetId),
  );

  // 2. 构建 RuleScript
  const ruleScript: RuleScript = {
    version: 2,
    actions: resolvedActions,
  };

  // 3. 构建 ExecutionContext
  const worldConfig = getRuntimeWorldConfig();
  const entityAccessor = buildEntityAccessorFromStores(); // 从当前 Store 构建
  const executionContext: ExecutionContext = {
    worldConfig,
    seed: Date.now(),
    entities: entityAccessor,
    actorId,
    targetId,
    commandId: `item-use:${item.instanceId}`,
  };

  // 4. 引擎执行
  const engine = new BasicRulesEngine();
  const result = engine.execute(ruleScript, executionContext);

  if (!result.success || !result.resultFrame) {
    console.warn(
      `[executeItemViaEngine] 执行失败: ${result.error ?? "未知错误"}`,
    );
    return;
  }

  // 5. 应用效果到 Store（valueChanges → Store + Yjs）
  await applyValueChangesToStores(result.resultFrame.valueChanges);

  // 6. 应用 tagChanges（如果消耗品添加了状态标签）
  if (result.tagChanges?.length) {
    await applyTagChangesToStores(result.tagChanges);
  }

  // 7. 存入操作日志
  useOperationLogStore.getState().addEntry({
    source: `使用 ${item.name}`,
    resultFrame: result.resultFrame,
    timestamp: Date.now(),
  });
}
```

### 3.8 onUse 执行的边界情况

| 边界情况                     | 处理方式                                       |
| ---------------------------- | ---------------------------------------------- |
| HP 溢出（治疗超过最大值）    | 夹紧到 maxHp                                   |
| 目标不存在                   | targetId 校验失败，跳过并 toast 提示           |
| addTag 目标已有同名 Tag      | 覆盖（刷新 duration），与引擎行为一致          |
| 路径 B 中引擎执行失败        | console.warn，toast 提示玩家，数量已扣减不回退 |
| 多个 effects 中的多个 onUse  | 合并后统一判断路径（不混合路径 A/B）           |
| 数量扣减到 0                 | 移除物品实例（已有逻辑）                       |
| `$target` 占位符但未选择目标 | 校验失败，提示玩家选择目标                     |

---

## 4. 数据流全景图

### 4.1 统一效果处理流

```
              ┌──── 效果来源 ────┐
              │                 │
    ┌─────────┴─────┐   ┌──────┴──────┐
    │ 静态来源       │   │ 动态来源     │
    │ (实体构建时)   │   │ (运行时)     │
    ├───────────────┤   ├─────────────┤
    │ 天赋 talentIds│   │ AI addTag   │
    │ 装备 equipped │   │ 消耗品 onUse│
    │ 持久化 Tags   │   │ 回合触发     │
    └───────┬───────┘   └──────┬──────┘
            │                  │
            ▼                  ▼
    ┌───────────────────────────────┐
    │     统一容器：Tag 系统          │
    │     Map<string, TagMetadata>  │
    │                               │
    │  天赋 Tag: id="tough"         │
    │  装备 Tag: id="equip:xxx"     │
    │  Buff Tag: id="str_boost"     │
    │  状态 Tag: id="poisoned"      │
    └──────────┬────────────────────┘
               │
    ┌──────────┴────────────────────┐
    │   collectPassiveModifiers()   │
    │   统一扫描所有 Tags            │
    └──────────┬────────────────────┘
               │
     ┌─────────┼──────────┐
     ▼         ▼          ▼
  scope=     scope=     scope=
  "stat"     "check"    "damage_*"
     │         │          │
     ▼         ▼          ▼
  computeFullStats  check执行时  damage执行时
  (UI 属性面板)    自动叠加修正  自动叠加修正
```

### 4.2 消耗品使用流：路径 A（静默生效）

```
玩家点击 "使用 治疗药水"
  │
  ▼
handleUseItem
  ├─ 扣减数量 (10→9)
  ├─ onUse: [{ type: "heal", amount: 50, field: "hp" }]
  ├─ requiresEngine? → false → 路径 A
  ├─ executeSimpleAction → 直接修改 HP (+50)
  ├─ 写入 Store + Yjs
  └─ UI toast: "已使用 治疗药水"

  ❌ 不写入操作日志
  ❌ 不通知 AI

下一轮玩家输入 "我继续向前探索"
  │
  ▼
IRNR 管线启动
  ├─ 构建实体 → HP 已恢复
  ├─ Parser AI 看到角色 HP=100/100
  │   └─ 根据状态自然生成 RuleScript（不需要特殊处理药水）
  └─ Narrative AI 自由创作（可能提到也可能不提到 HP 恢复）
```

### 4.3 消耗品使用流：路径 B（操作日志）

```
玩家点击 "使用 火焰瓶" 并选择目标"哥布林"
  │
  ▼
handleUseItem
  ├─ 扣减数量 (3→2)
  ├─ onUse: [
  │    { type: "damage", target: "$target", amount: "2d6", damageType: "fire" },
  │    { type: "addTag", target: "$target", tag: "burning", duration: 3 }
  │  ]
  ├─ requiresEngine? → true（含 damage）→ 路径 B
  ├─ executeItemViaEngine:
  │   ├─ 构建 RuleScript（$target → goblin_01）
  │   ├─ Engine 执行 → ResultFrame
  │   │   ├─ damage: 2d6=8, goblin HP 20→12
  │   │   └─ addTag: goblin 获得 burning (3回合)
  │   ├─ 应用效果到 Store + Yjs
  │   └─ ResultFrame → 操作日志
  └─ UI toast: "使用了 火焰瓶"

操作日志 HUD 显示:
  "🔥 火焰瓶 → 哥布林: 8点火焰伤害, 获得炎上(3回合)"

下一轮玩家输入 "我拔剑冲向哥布林"
  │
  ▼
IRNR 管线启动
  ├─ 读取操作日志 → [ResultFrame: 火焰瓶]
  ├─ trigger pipeline → preResultFrame（burning turn_start: -3HP）
  ├─ Parser AI → RuleScript → Engine → mainResultFrame
  ├─ mergeAllResultFrames:
  │   [操作日志] + [回合开始] + [行动]
  │   → "火焰瓶对哥布林造成8点火焰伤害..."
  │   → "炎上伤害：哥布林 HP -3"
  │   → "攻击检定：1d20+5=18 vs DC12，成功。剑击伤害：7点"
  ├─ Narrative AI 统一描写:
  │   → "火焰瓶在哥布林身上炸开，灼热的火焰灼烧着它的皮肤...
  │      它痛苦地嚎叫着，身上的火焰仍在燃烧...
  │      你趁势挥剑，锋利的剑刃划过它的胸膛..."
  └─ 清空操作日志
```

### 4.4 装备效果在引擎中的统一处理

```
玩家通过 UI 装备了火焰剑
  │
  ▼
handleEquipItem → Store 更新（静默，不写操作日志）

下一轮 IRNR "我攻击哥布林"
  │
  ▼
buildEntityFromCharacterData()
  ├─ characterToEntityData() → 加载持久化 Tags
  ├─ applyTalentsToEntity()
  │   └─ Tag "tough": { timing: "passive", modifiers: [damage_taken ×0.9] }
  └─ applyEquipmentEffectsToEntity()
      └─ Tag "equip:xxx": { timing: "passive", modifiers: [
           { scope: "stat", field: "str", value: 3 },
           { scope: "damage_dealt", filter: "fire", value: 3 },
           { scope: "check", filter: "attack", value: 1 }
         ]}
  │
  ▼
Parser AI: { actions: [{ type: "check", subtype: "attack", target: "goblin" }] }
  │
  ▼
Engine 执行 check:
  → collectPassiveModifiers("player") 
  → 找到 equip:xxx 的 scope="check" +1
  → 自动附加到 check roll
  │
  ▼
check 命中 → Engine 执行 damage:
  → collectPassiveModifiers("player")
  → 找到 equip:xxx 的 scope="damage_dealt" filter="fire" +3
  → 找到 tough 的 scope="damage_taken" ×0.9
  → 自动附加伤害修正
  │
  ▼
ResultFrame: { modifiersApplied: ["火焰剑攻击+1", "火焰剑火伤+3", "强韧减伤10%"] }
  │
  ▼
Narrative AI → "你挥动火焰剑，灼热的剑锋划过哥布林..."
```

### 4.5 Tag 完整生命周期

```
┌──── 创建 ─────────────────────────────────────────┐
│                                                   │
│  天赋:     applyTalentsToEntity (运行时派生)       │
│  装备:     applyEquipmentEffectsToEntity (运行时)  │
│  AI:       engine.executeAddTag → character.tags   │
│  消耗品A:  executeSimpleAction.addTag → char.tags  │
│  消耗品B:  engine.executeAddTag → char.tags        │
│  触发器:   trigger pipeline → char.tags            │
│                                                   │
├──── 存储 ─────────────────────────────────────────┤
│                                                   │
│  天赋/装备: 不持久化（每次从 talentIds/equipped 派生）│
│  其他 Tag:  character.tags → Yjs 持久化            │
│                                                   │
├──── 加载到 Entity ────────────────────────────────┤
│                                                   │
│  characterToEntityData()  → 反序列化 character.tags │
│  applyTalentsToEntity()   → 注入天赋 shadow Tag    │
│  applyEquipmentEffectsToEntity() → 注入装备 shadow │
│                                                   │
├──── 引擎处理 ─────────────────────────────────────┤
│                                                   │
│  passive:    collectPassiveModifiers() 自动叠加    │
│  turn_start: executeTurnStartTriggers() 自动执行   │
│  on_damage:  findOnDamageTriggers() 自动触发       │
│                                                   │
├──── 移除 ─────────────────────────────────────────┤
│                                                   │
│  天赋:     永久（除非移除天赋）                    │
│  装备:     卸下装备 → shadow Tag 自然消失           │
│  定时Tag:  duration 到期 → trigger pipeline 移除   │
│  手动:     AI removeTag / 消耗品 removeTag         │
│                                                   │
└───────────────────────────────────────────────────┘
```

---

## 5. 效果系统完备性分析

### 5.1 当前支持的效果类型

| 效果类型                 | 实现方式                                       | 支持状态 |
| ------------------------ | ---------------------------------------------- | -------- |
| 属性增减（力量+3）       | `passive` + `scope: "stat"`                    | ✅        |
| 检定修正（攻击+1）       | `passive` + `scope: "check"`                   | ✅        |
| 造成伤害修正（火伤+3）   | `passive` + `scope: "damage_dealt"`            | ✅        |
| 承受伤害修正（减伤×0.9） | `passive` + `scope: "damage_taken"`            | ✅        |
| 持续伤害（毒/灼烧）      | `turn_start` + `damage` action                 | ✅        |
| 持续回复（再生）         | `turn_start` + `heal` action                   | ✅        |
| 受伤触发（反弹伤害）     | `on_damage` + `damage` action                  | ✅        |
| 受伤减免（护盾）         | `on_damage` + `modifyDamage`                   | ✅        |
| 条件免疫（火焰免疫）     | `on_damage` + `damageFilter` + `multiplier: 0` | ✅        |
| 隐身/无敌等叙事状态      | Tag + `effectDescription`（AI 感知）           | ✅        |
| 效果叠加层数             | `TagMetadata.stacks`                           | ✅        |
| 效果持续时间             | `TagMetadata.remainingDuration`                | ✅        |

### 5.2 效果间交互能力

- **线性叠加**：`collectPassiveModifiers()` 按顺序收集所有 passive modifiers，加算/乘算线性叠加
- **无优先级**：不支持"免疫覆盖易伤"等优先级逻辑（可通过 AI 软约束处理）
- **无级联触发**：trigger pipeline 不支持级联（Phase 1 安全限制）
- **效果清除**：通过 `removeTag` 单个移除，无批量清除机制

### 5.3 已知局限与设计选择

| 局限                    | 当前处理                         | 是否需要扩展                       |
| ----------------------- | -------------------------------- | ---------------------------------- |
| 控制类效果（眩晕/沉默） | AI 通过 effectDescription 软约束 | 现阶段不强制，后续按需扩展         |
| 效果优先级              | 无优先级，线性叠加               | 大多数场景足够，极端情况由 AI 处理 |
| 级联触发                | 不支持                           | 有意的安全限制                     |
| 效果条件判断            | 无条件表达式（如"HP<50%时生效"） | 后续 Phase 可扩展 ConditionTrigger |

---

## 6. 技术风险与注意事项

### 6.1 `computeFullStats` 接口变更的向后兼容

当前调用方：
- `useCharacterFullStats` — 需要适配（收集 modifiers 后传入）
- `buildDefaultEntityFromWorldConfig` — 需要检查是否使用了 equippedItems 参数

改动是破坏性的（移除 equippedItems 参数），但影响范围可控（仅 2 个调用方）。

### 6.2 Shadow Tag 与 inventoryData 的信息重复

装备信息现在出现在两个地方：
1. `inventoryData`（物品列表中标记 equipped=true）
2. `entityEffects`（shadow Tag 的 effectDescription）

建议：保持两处都有，但职责不同：
- `inventoryData` 提供物品列表视图（背包管理用）
- `entityEffects` 提供效果视图（战斗/检定用，AI 看到统一的效果列表）

### 6.3 路径 A onUse 中的属性修改路径

`executeSimpleAction` 需要修改角色属性（如 HP）。建议：在 `handleUseItem` 中直接操作 Store 和 Yjs（与其他 handler 一致），不走引擎。

### 6.4 Tag 持久化的写入路径

消耗品 `addTag` 需要新增写入路径：

**当前写入路径**（IRNR 内部）：
1. 引擎 `executeAddTag` → `tagChanges` → `applyTagChangesToAccessor` → EntityAccessor
2. IRNR 结束时 → `finalEntityStates` → 回写 Character Store + Yjs

**新增写入路径**（轻量管线/路径 A）：
1. `executeSimpleAction.addTag` → 直接写入 Character.tags（Yjs）
2. 同步更新 Character Store

需要确认 Character Repository 是否有 `addTag`/`removeTag` 方法。如果没有，需要新增。

### 6.5 路径 B 的 EntityAccessor 构建

`executeItemViaEngine` 需要一个 EntityAccessor 来供引擎执行。当前 EntityAccessor 在 IRNR 管线内部构建。

需要提供一个从 Store 快速构建 EntityAccessor 的工具函数 `buildEntityAccessorFromStores()`，复用 `characterToEntityData` + `applyTalentsToEntity` + `applyEquipmentEffectsToEntity` 的逻辑。

### 6.6 操作日志在刷新后的丢失

操作日志存储在 Zustand Store（内存中），页面刷新后丢失。由于效果已经应用到 Store + Yjs，丢失的只是"待叙事的 ResultFrame"。

**影响**：下次 IRNR 时 Narrative AI 不会描写这些已发生的战斗事件。可接受，因为 AI 仍然能通过实体状态感知结果（如 HP 减少了、有 burning 标签）。

**可选优化**（后续）：将操作日志持久化到 localStorage 或 Yjs。

### 6.7 消耗品 onUse 与重型管线的 useItem 统一

两条路径最终都调用 `handleUseItem`：
- **轻量管线**（UI 点击使用）：走 `handleUseItem` → 路径 A/B
- **重型管线**（AI 说 `useItem`）：走引擎的 `executeUseItem` → `StructuralChange` → `handleUseItem`

建议：`handleUseItem` 统一处理 onUse 执行（无论从哪条管线调用）。重型管线的 `useItem` 也应执行 `onUse`，因为 AI 说"使用治疗药水"时，药水的效果也应该生效。

---

## 7. 实施路线

### Phase 4a：统一效果基础设施

- [ ] `computeFullStats()` 接口重构：`equippedItems` → `passiveModifiers`
- [ ] `computeFullStats()` 内部逻辑适配：遍历 passiveModifiers 中 scope="stat" 的修正
- [ ] `useCharacterFullStats()` 适配：从装备 + 天赋 + 持久化Tags 收集 PassiveModifier
- [ ] 检查 `buildDefaultEntityFromWorldConfig()` 是否需要适配
- [ ] 新增 `applyEquipmentEffectsToEntity()` 函数
- [ ] `buildEntityFromCharacterData()` 中调用 `applyEquipmentEffectsToEntity()`
- [ ] `ItemEffect` 类型新增 `onUse?: RuleAction[]` 字段
- [ ] `TagMetadata.category` 新增 `"equipment"` 选项

### Phase 4b：消耗品双路径执行

- [ ] 新增 `requiresEngine()` 路径判断函数
- [ ] 新增 `executeSimpleAction()` 函数（路径 A：heal/cost/set/addTag/removeTag）
- [ ] 新增 `persistTagToCharacter()` / `removeTagFromCharacter()` 函数
- [ ] Character Repository 新增 `addTag`/`removeTag` 方法（如不存在）
- [ ] 新增 `executeItemViaEngine()` 函数（路径 B：构建 RuleScript → Engine）
- [ ] 新增 `buildEntityAccessorFromStores()` 工具函数
- [ ] `handleUseItem` 增加 onUse 双路径执行逻辑
- [ ] 目标选择 UI（路径 B 消耗品使用时选择目标）

### Phase 4c：操作日志与 UI

- [ ] 新增 `OperationLogStore`（`operation-log-store.ts`）
- [ ] `executeItemViaEngine` 执行后写入操作日志
- [ ] IRNR 管线中新增操作日志消费逻辑
- [ ] 新增 `mergeAllResultFrames()` 函数（操作日志 + trigger + engine）
- [ ] GameHUD 中新增操作日志入口（badge + 查看面板）
- [ ] 新增 `EquipmentSection.tsx` 装备面板组件
- [ ] `CharacterPanelTabKey` 新增 `"equipment"`
- [ ] `TAB_ITEMS` 增加装备标签页
- [ ] `renderActiveTabContent` 增加 equipment case

### 后续 Phase（不在本期实施）

- [ ] 操作日志持久化（localStorage / Yjs）
- [ ] 通道 2 模板化规则管线扩展（偷窃/战斗模板等）
- [ ] 装备触发效果（on_damage 类 → 需要 shadow Tag + trigger pipeline）
- [ ] 消耗品复杂 onUse（含复杂条件逻辑，走通道 2）
- [ ] 控制类效果引擎硬约束（根据需求决定是否实现）
- [ ] 效果优先级/互斥机制
- [ ] 天赋被动修正在 `computeFullStats` 中实现（目前仅引擎侧生效）
- [ ] 效果条件判断扩展（如"HP<50%时生效"）

---

## 附录 A：效果来源与处理管线对照

| 效果来源         | 数据结构                     | 容器                           | 引擎处理                                     | UI 处理                                 | AI 感知                       |
| ---------------- | ---------------------------- | ------------------------------ | -------------------------------------------- | --------------------------------------- | ----------------------------- |
| 天赋             | `TalentConfig.modifiers`     | Tag(category=talent)           | `collectPassiveModifiers`                    | `computeFullStats` via passiveModifiers | entityEffects                 |
| 装备被动         | `ItemEffect.modifiers`       | Tag(category=equipment) shadow | `collectPassiveModifiers`                    | `computeFullStats` via passiveModifiers | entityEffects + inventoryData |
| 装备叙事         | `ItemEffect.description`     | Tag(category=equipment) shadow | effectDescription                            | 不处理                                  | entityEffects + inventoryData |
| Buff/Debuff      | `TagMetadata.trigger`        | Tag(from addTag) 持久化        | `collectPassiveModifiers` + trigger pipeline | `computeFullStats` via passiveModifiers | entityEffects                 |
| 消耗品瞬时(A)    | `ItemEffect.onUse[heal/set]` | 无（执行后消失）               | 不经过引擎                                   | 即时属性更新                            | 实体快照自然感知              |
| 消耗品Buff(A)    | `ItemEffect.onUse[addTag]`   | Tag(from addTag) 持久化        | 同 Buff/Debuff                               | 同 Buff/Debuff                          | entityEffects                 |
| 消耗品行动(B)    | `ItemEffect.onUse[damage等]` | 操作日志 ResultFrame           | Engine 执行                                  | toast + 操作日志 HUD                    | 合并到 IRNR ResultFrame       |
| 消耗品叙事       | `ItemEffect.description`     | 无                             | 不处理                                       | 不处理                                  | 实体快照自然感知              |
| WorldConfig 条件 | `ConditionConfig.trigger`    | Tag(from AI/trigger)           | trigger pipeline                             | 不处理                                  | entityEffects                 |

## 附录 B：与原设计文档的变更对照

相对于 v1.0 版 Phase 4 计划：

| v1.0 设计项                   | v2.0 修订                            | 变更说明                                  |
| ----------------------------- | ------------------------------------ | ----------------------------------------- |
| ActionBufferStore（文本摘要） | **OperationLogStore（ResultFrame）** | 存储引擎产生的 ResultFrame 而非文本摘要   |
| pendingActions 注入 IRNR      | **ResultFrame 合并到 IRNR**          | 统一数据格式，不新增 VariableContext 字段 |
| 确定性效果通知 AI             | **静默生效，不通知**                 | AI 通过实体快照自然感知                   |
| onUse 仅 5 种确定性动作       | **双路径：静默 + 引擎**              | 支持行动型消耗品通过引擎执行              |
| HUD 缓冲区入口                | **HUD 操作日志入口**                 | 展示待叙事的 ResultFrame 而非操作列表     |
| Tag 持久化"延后实施"          | **Phase 4 中基础实现**               | addTag 写入 character.tags/Yjs            |
| `{{pendingActions}}` 变量     | **移除**                             | 不需要新变量，复用 resultFrame marker     |
| 独立装备面板 UI               | ✅ 保留                               | 改为 CharacterPanel Tab                   |
| 拖拽装备操作                  | ❌ 取消                               | 改为按钮交互                              |

## 附录 C：消耗品 onUse 示例

### 路径 A 示例：治疗药水

```json
{
  "id": "healing_potion",
  "name": "治疗药水",
  "category": "consumable",
  "effects": [{
    "type": "modifier",
    "description": "恢复 50 HP",
    "onUse": [
      { "type": "heal", "target": "self", "amount": 50, "field": "hp" }
    ]
  }]
}
```

执行：`executeSimpleAction` → HP +50 → toast → 完毕

### 路径 A 示例：力量药剂

```json
{
  "id": "strength_potion",
  "name": "力量药剂",
  "category": "consumable",
  "effects": [{
    "type": "modifier",
    "description": "力量+5（3回合）",
    "onUse": [
      {
        "type": "addTag",
        "target": "self",
        "tag": "str_boost",
        "displayName": "力量增幅",
        "effectDescription": "力量属性提升5点",
        "duration": 3,
        "trigger": {
          "timing": "passive",
          "modifiers": [{ "scope": "stat", "field": "str", "value": 5, "reason": "力量药剂 +5" }]
        }
      }
    ]
  }]
}
```

执行：`executeSimpleAction.addTag` → 写入 character.tags → toast → 完毕

### 路径 B 示例：火焰瓶

```json
{
  "id": "fire_bottle",
  "name": "火焰瓶",
  "category": "consumable",
  "effects": [{
    "type": "modifier",
    "description": "投掷火焰瓶，造成火焰伤害并点燃目标",
    "onUse": [
      { "type": "damage", "target": "$target", "amount": "2d6", "damageType": "fire", "reason": "火焰瓶爆炸" },
      { "type": "addTag", "target": "$target", "tag": "burning", "duration": 3, "reason": "火焰瓶点燃" }
    ]
  }]
}
```

执行：`executeItemViaEngine` → Engine → ResultFrame (2d6=8, burning) → 操作日志 → 下次 IRNR 叙事

### 路径 B 示例：雷电卷轴（含检定）

```json
{
  "id": "lightning_scroll",
  "name": "雷电卷轴",
  "category": "consumable",
  "effects": [{
    "type": "modifier",
    "description": "释放闪电攻击，需要法术检定",
    "onUse": [
      { "type": "check", "skill": "magic", "dc": 12, "actor": "self", "reason": "释放雷电卷轴" },
      { "type": "damage", "target": "$target", "amount": "3d8", "damageType": "lightning", "reason": "闪电击中" }
    ]
  }]
}
```

执行：`executeItemViaEngine` → Engine（检定+伤害）→ ResultFrame → 操作日志
