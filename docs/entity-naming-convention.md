# 实体命名与寻址规范

> 本文档记录 IRNR 系统中实体引用的命名约定和重名处理机制。

## 背景

IRNR Pipeline 中 Parser AI 需要在 JSON 指令中引用游戏实体（玩家、NPC、物品等）。内部使用 UUID 标识实体，但 AI 需要使用可读的名称来引用。

## 语义别名系统

### 核心概念

系统维护一张 **EntityAliasMap**（语义别名 → 内部 UUID），在每次 Pipeline 执行时构建。

```typescript
interface EntityAliasMap {
  aliases: Map<string, string>;       // 别名 → UUID
  displayNames: Map<string, string>;  // UUID → 首选别名（用于 prompt 展示）
}
```

### 别名映射规则

| 实体类型         | 别名                            | 说明                |
| ---------------- | ------------------------------- | ------------------- |
| 当前行动角色     | `"player"`, `"self"`, `"actor"` | Solo 模式下三者等价 |
| 多人模式其他玩家 | 角色名称                        | 如 `"流萤白沙"`     |
| NPC（不重名）    | NPC 名称                        | 如 `"老铁匠汉斯"`   |
| NPC（重名）      | `"名称(短ID)"`                  | 如 `"哥布林(npc1)"` |

### 解析优先级

`resolveEntityId()` 的查找顺序：

1. `undefined` / `"self"` / `"actor"` → 当前 `actorId`
2. `"target"` → 当前 `targetId`
3. `"player"` → 当前 `actorId`（Solo 模式）
4. `$variable` → 从变量空间查找
5. 别名表查找 → EntityAliasMap.aliases
6. 原样返回 → 作为 UUID 直接使用

---

## 重名 NPC 处理方案

### 场景

```
T1: AI 创建 NPC "哥布林"（内部 ID: npc_001）→ 活跃
T2: "哥布林" 被归档
T3: AI 创建新 NPC "哥布林"（内部 ID: npc_002）→ 活跃
T4: 导演 AI 想让第一个"哥布林"重新登场
```

### 方案：稳定短 ID

每个 NPC 创建时分配一个**自增短 ID**（`npc1`, `npc2`, `npc3`...），存储在 `fields.shortId` 中，永久不变。

#### 短 ID 生成规则

- 存档级别维护一个 `npcCounter` 计数器
- 每次创建 NPC 时 `npcCounter++`，生成 `npc{counter}`
- 计数器只增不减，即使 NPC 被删除/归档
- 短 ID 在存档内唯一

#### ID 层次

```
内部 UUID:  npc_1770870697217_3291  ← 引擎/存档内部使用
短 ID:     npc1                     ← AI 引用、日志展示
名称别名:  哥布林                   ← 不重名时使用
消歧别名:  哥布林(npc1)             ← 重名时使用
```

#### 别名构建逻辑

```typescript
function buildNpcAliases(npcEntities: EntityData[]): void {
  // 1. 统计名称出现次数
  const nameCount = new Map<string, number>();
  for (const entity of npcEntities) {
    const name = entity.fields.name as string;
    nameCount.set(name, (nameCount.get(name) ?? 0) + 1);
  }

  // 2. 根据是否重名决定别名格式
  for (const entity of npcEntities) {
    const name = entity.fields.name as string;
    const shortId = entity.fields.shortId as string;

    if (nameCount.get(name)! > 1) {
      // 重名：用 "名称(短ID)" 作为主别名
      const disambiguated = `${name}(${shortId})`;
      aliases.set(disambiguated, entity.id);
      displayNames.set(entity.id, disambiguated);
    } else {
      // 不重名：直接用名称
      aliases.set(name, entity.id);
      displayNames.set(entity.id, name);
    }

    // 短 ID 始终可用作备选引用
    aliases.set(shortId, entity.id);
  }
}
```

#### AI 看到的效果

**不重名时**（大多数场景）：

```
### 实体引用规则
- "player" 或 "self" → 当前行动角色（流萤白沙）
- "老铁匠汉斯" 或 "npc1" → NPC 老铁匠汉斯 (active)
```

**重名时**：

```
### 实体引用规则
- "player" 或 "self" → 当前行动角色（流萤白沙）
- "哥布林(npc1)" 或 "npc1" → 哥布林 (archived) - 洞穴守卫
- "哥布林(npc2)" 或 "npc2" → 哥布林 (active) - 森林巡逻兵
⚠️ 有同名 NPC，请使用带括号的完整引用或短 ID 来区分
```

**导演 AI 恢复归档 NPC**：

```json
{ "type": "npcStatusChange", "npcId": "npc1", "status": "active" }
```

### 存档结构变更

需要在存档中新增：

```typescript
// 存档级别
interface SaveData {
  npcCounter: number;  // 新增：NPC 短 ID 计数器
}

// NPC 实体级别
interface NpcFields {
  shortId: string;     // 新增：如 "npc1", "npc2"
  name: string;
  // ... 其他字段
}
```

### 实施时机

此方案标记为**延迟实施**，在导演 AI 模块开发时一并实施。

原因：
1. 当前 Parser AI 每轮最多创建 1-2 个 NPC，重名概率极低
2. 需要存档结构迁移（加字段 + 兼容旧存档）
3. 重名恢复场景的主要触发者是导演 AI，尚未开发

当前阶段（Phase 1）仅实现：
- `"player"` / `"self"` → actorId 的基础映射
- NPC 直接用名称作为别名（不处理重名）