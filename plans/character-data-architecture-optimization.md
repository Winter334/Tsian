# 角色数据架构字段扩展成本优化分析

## 1. 现状：新增字段的修改清单

以新增 `age` 和 `gender` 两个可选字段为例，当前需要修改 **8 个文件中的 11 处定义**：

| #   | 文件                                      | 修改点                                   | 类型           |
| --- | ----------------------------------------- | ---------------------------------------- | -------------- |
| 1   | `domain/entities/character.ts`            | `Character` 接口                         | **源定义**     |
| 2   | `domain/entities/character.ts`            | `CreateCharacterParams` 接口             | **源定义**     |
| 3   | `domain/entities/character.ts`            | `UpdateCharacterParams` 接口             | **源定义**     |
| 4   | `domain/commands/room.ts`                 | `CreateCharacterPayload`                 | 冗余复制       |
| 5   | `domain/commands/room.ts`                 | `UpdateCharacterPayload.updates`         | 冗余复制       |
| 6   | `domain/events/room.ts`                   | `CharacterCreatedEvent`                  | 冗余复制       |
| 7   | `domain/events/room.ts`                   | `CharacterUpdatedEvent.updates`          | 冗余复制       |
| 8   | `domain/commands/save.ts`                 | `CreateSavePayload.initialCharacter`     | 冗余复制       |
| 9   | `modules/game/repository/entity-codec.ts` | `characterToYMap` / `yMapToCharacter`    | 逐字段编解码   |
| 10  | `modules/room/commands/handlers.ts`       | `createCharacterHandler` 内联 Y.Map 写入 | 逐字段透传     |
| 11  | `modules/room/hooks/useRoomCharacters.ts` | `extractCharacterFromYMap`               | 重复的解码实现 |

## 2. 根因分析

### 2.1 问题一：命令/事件载荷手动重复实体字段（#4-#8）

当前 `CreateCharacterPayload`、`CharacterCreatedEvent` 等接口**手动列出**了角色的每个描述字段，而不是引用 `Character` 或 `CreateCharacterParams` 类型。

**对比现有的正面范例**：`UpdateNpcInfoPayload` 已经使用了类型引用模式：

```typescript
// ✅ 已有的好模式（UpdateNpcInfoPayload）
updates: Partial<Pick<Character, "name" | "description" | "personality" | "appearance" | "talentIds">>

// ❌ 当前的问题模式（UpdateCharacterPayload.updates）
updates: {
  name?: string;
  status?: "active" | "off_scene" | "archived" | "dead";
  attributes?: Record<string, unknown>;
  description?: string;
  personality?: string;
  appearance?: string;
  age?: number;
  gender?: string;
  dimensionSelections?: Record<string, string>;
  talentIds?: string[];
}
```

**根因**：开发过程中缺乏统一的类型复用规范，角色相关的命令/事件接口各自独立定义。

### 2.2 问题二：三套独立的 Y.Map ↔ Character 转换实现（#9-#11）

项目中存在 **三套功能重叠的编解码实现**：

| 实现位置                          | 函数                                      | 用途                               |
| --------------------------------- | ----------------------------------------- | ---------------------------------- |
| `entity-codec.ts`                 | `characterToYMap()` / `yMapToCharacter()` | SaveSlot 读写（save handler 调用） |
| `room/commands/handlers.ts`       | `createCharacterHandler` 内联代码         | 创建角色时写入 MainDoc             |
| `room/hooks/useRoomCharacters.ts` | `extractCharacterFromYMap()`              | UI 层读取角色                      |

这三套实现做的**几乎完全相同的事**，但彼此独立维护。新增字段时必须同步修改所有三处。

**具体对比**：

```typescript
// entity-codec.ts 中的 characterToYMap
if (character.age !== undefined) { charMap.set("age", character.age); }
if (character.gender !== undefined) { charMap.set("gender", character.gender); }

// handlers.ts createCharacterHandler 中的内联写入（重复！）
if (character.age !== undefined) { charMap.set("age", character.age); }
if (character.gender !== undefined) { charMap.set("gender", character.gender); }

// useRoomCharacters.ts extractCharacterFromYMap 中的读取（又重复！）
age: (charMap.get("age") as number | undefined) || undefined,
gender: (charMap.get("gender") as string | undefined) || undefined,
```

**根因**：`createCharacterHandler` 没有复用 `characterToYMap()`，而是自己内联实现了同样的逻辑。`extractCharacterFromYMap` 也没有复用 `yMapToCharacter()`。

### 2.3 问题三：Handler 中逐字段解构和透传（#10）

`createCharacterHandler` 手动从 payload 中解构每个字段，再传递给 `createCharacter()`：

```typescript
const { roomId, name, userId, uniqueTag, attributes, controlType,
        description, personality, appearance, age, gender } = payload;

const character = createCharacter({
  name, description, personality, appearance, age, gender,
  creatorUniqueTag: uniqueTag,
  operatorUserId: userId,
  // ...
});
```

新增字段时必须同时修改解构列表和 `createCharacter` 调用。

### 2.4 合理 vs 不必要的分层

| 分层                                              | 是否合理 | 说明                             |
| ------------------------------------------------- | -------- | -------------------------------- |
| `Character` 实体定义                              | ✅ 合理   | 领域核心，必须存在               |
| `CreateCharacterParams` / `UpdateCharacterParams` | ✅ 合理   | 工厂函数的输入参数，语义清晰     |
| 命令 Payload 中的上下文字段 (`roomId`, `userId`)  | ✅ 合理   | 命令需要知道在哪个房间、谁在操作 |
| 命令 Payload 中重复列出角色描述字段               | ❌ 不必要 | 应引用实体类型                   |
| 事件 Payload 中重复列出角色描述字段               | ❌ 不必要 | 应引用实体类型                   |
| `entity-codec.ts` 编解码层                        | ✅ 合理   | Yjs 序列化需要专门处理           |
| Handler 内联的 Y.Map 写入                         | ❌ 不必要 | 应复用 `characterToYMap()`       |
| Hook 中的 `extractCharacterFromYMap`              | ❌ 不必要 | 应复用 `yMapToCharacter()`       |

## 3. 优化方案

### 方案 A：命令/事件载荷引用实体类型（推荐，优先实施）

**核心思路**：命令和事件的 Payload 不再手动列出角色字段，而是引用 `Character`、`CreateCharacterParams`、`UpdateCharacterParams` 类型。

#### 3.1 提取角色描述字段类型

在 `character.ts` 中定义可复用的字段集合类型：

```typescript
/**
 * 角色描述字段（可扩展的部分）
 * 新增角色描述字段时，只需修改此类型
 */
export type CharacterProfileFields = Pick<Character,
  | "description" | "personality" | "appearance"
  | "age" | "gender"
>;
```

#### 3.2 重构 CreateCharacterPayload

```typescript
// 优化前：手动列出所有字段
export interface CreateCharacterPayload {
  roomId: string;
  name: string;
  userId: string;
  uniqueTag: string;
  attributes?: Record<string, unknown>;
  controlType?: ControlType;
  description?: string;  // ❌ 重复
  personality?: string;  // ❌ 重复
  appearance?: string;   // ❌ 重复
  age?: number;          // ❌ 重复
  gender?: string;       // ❌ 重复
  dimensionSelections?: Record<string, string>;
  talentIds?: string[];
}

// 优化后：引用 CreateCharacterParams
export interface CreateCharacterPayload {
  roomId: string;
  userId: string;
  uniqueTag: string;
  /** 角色创建参数（不含 operator 身份信息，由 handler 注入） */
  characterData: Omit<CreateCharacterParams,
    "creatorUniqueTag" | "operatorUserId" | "operatorUniqueTag"
  >;
}
```

#### 3.3 重构 UpdateCharacterPayload

```typescript
// 优化后：引用 UpdateCharacterParams
export interface UpdateCharacterPayload {
  roomId: string;
  characterId: string;
  userId: string;
  uniqueTag: string;
  updates: UpdateCharacterParams;
}
```

#### 3.4 重构 CharacterCreatedEvent

```typescript
// 优化后：引用 Character 类型
export interface CharacterCreatedEvent {
  roomId: string;
  /** 完整的角色数据快照 */
  character: Character;
}
```

#### 3.5 重构 CharacterUpdatedEvent

```typescript
// 优化后：引用 UpdateCharacterParams
export interface CharacterUpdatedEvent {
  roomId: string;
  characterId: string;
  operatorUserId: string;
  operatorUniqueTag: string;
  updates: UpdateCharacterParams;
  updatedAt: number;
}
```

#### 3.6 重构 CreateSavePayload

```typescript
// 优化后：引用 CreateCharacterParams
export interface CreateSavePayload {
  name: string;
  initialCharacter?: Omit<CreateCharacterParams,
    "creatorUniqueTag" | "operatorUserId" | "operatorUniqueTag"
  >;
}
```

#### 评估

| 维度     | 评价                                                                                     |
| -------- | ---------------------------------------------------------------------------------------- |
| 修改量   | 中等（6 个接口定义 + 调用方适配）                                                        |
| 效果     | **新增字段只需改 1 处（`Character` + `CreateCharacterParams`/`UpdateCharacterParams`）** |
| 向后兼容 | ⚠️ 需要更新所有调用方（UI 组件的 dispatch 调用）                                          |
| 架构影响 | 无，仅类型层面变化                                                                       |
| 风险     | 低，TypeScript 编译器会自动检测所有不兼容的调用                                          |

---

### 方案 B：消除重复的 Y.Map 编解码实现（推荐，与 A 并行实施）

**核心思路**：统一使用 `entity-codec.ts` 中的 `characterToYMap()` 和 `yMapToCharacter()` 作为唯一的编解码入口。

#### 3.7 重构 createCharacterHandler

```typescript
export async function createCharacterHandler(payload, _context) {
  const { roomId, userId, uniqueTag, characterData } = payload;

  // 创建角色实体（一步到位，不再逐字段解构）
  const character = createCharacter({
    ...characterData,
    creatorUniqueTag: uniqueTag,
    operatorUserId: userId,
    operatorUniqueTag: uniqueTag,
    status: "active",
  });

  // ✅ 复用 characterToYMap（不再内联重复）
  mainDoc.transact(() => {
    const charMap = characterToYMap(character);
    charactersMap.set(character.id, charMap);
  });

  // 事件使用完整的 character 对象
  eventBus.emit(eventBus.createEvent(RoomEvents.CHARACTER_CREATED, {
    roomId,
    character,
  }));
}
```

#### 3.8 重构 updateCharacterHandler

```typescript
export async function updateCharacterHandler(payload, _context) {
  const { roomId, characterId, userId, uniqueTag, updates } = payload;

  // ✅ 复用 yMapToCharacter 读取角色（不再内联重复）
  const character = yMapToCharacter(charMap);

  // 验证权限
  if (!canOperateCharacter(character, userId, uniqueTag)) { ... }

  // 更新逻辑保持不变（逐字段 set 是 Yjs 增量同步的要求，不能整体替换）
  // 但可以提取为 applyUpdatesToYMap 辅助函数
}
```

#### 3.9 删除 extractCharacterFromYMap，复用 yMapToCharacter

```typescript
// useRoomCharacters.ts
// 优化前：自定义的 extractCharacterFromYMap 函数（52 行）
// 优化后：直接引用 entity-codec
import { yMapToCharacter } from "@/modules/game/repository";

charactersMap.forEach((charMap) => {
  const character = yMapToCharacter(charMap);  // ✅ 复用
  charList.push(character);
});
```

#### 3.10 提取 applyUpdatesToYMap 辅助函数

将 `updateCharacterHandler` 中逐字段写入 Y.Map 的逻辑提取为编解码层函数：

```typescript
// entity-codec.ts 新增
/**
 * 将更新参数应用到 Y.Map（增量更新，不替换整个 Map）
 */
export function applyCharacterUpdates(
  charMap: Y.Map<unknown>,
  updates: UpdateCharacterParams,
): void {
  if (updates.name !== undefined) charMap.set("name", updates.name);
  if (updates.status !== undefined) charMap.set("status", updates.status);
  if (updates.description !== undefined) charMap.set("description", updates.description);
  if (updates.personality !== undefined) charMap.set("personality", updates.personality);
  if (updates.appearance !== undefined) charMap.set("appearance", updates.appearance);
  if (updates.age !== undefined) charMap.set("age", updates.age);
  if (updates.gender !== undefined) charMap.set("gender", updates.gender);
  if (updates.attributes !== undefined) {
    const existing = (charMap.get("attributes") as Record<string, unknown>) || {};
    charMap.set("attributes", { ...existing, ...updates.attributes });
  }
  // ... 其他字段
  charMap.set("updatedAt", Date.now());
}
```

**注意**：增量更新不能用 `characterToYMap` 整体替换——Yjs 的增量同步要求逐字段 set，这样只有变更的字段会同步到其他节点。`applyCharacterUpdates` 集中管理这些逐字段写入逻辑。

#### 评估

| 维度     | 评价                                                             |
| -------- | ---------------------------------------------------------------- |
| 修改量   | 小（删除 2 处重复实现，改为 import 调用）                        |
| 效果     | **编解码逻辑从 3 处减少到 1 处**，新增字段只改 `entity-codec.ts` |
| 向后兼容 | ✅ 完全兼容（内部重构，外部 API 不变）                            |
| 架构影响 | 更好地遵循单一职责原则                                           |
| 风险     | 极低                                                             |

---

### 方案 C：基于字段元数据的声明式编解码（可选，长期优化）

**核心思路**：定义 Character 的字段元数据列表，自动生成 Y.Map 编解码逻辑，彻底消除逐字段维护。

```typescript
// character-fields.ts
interface FieldDef {
  key: string;
  type: "string" | "number" | "boolean" | "json" | "array" | "record";
  required?: boolean;
  defaultValue?: unknown;
  /** json 序列化类型需要 parse/stringify */
  serialize?: "json";
}

const CHARACTER_FIELDS: FieldDef[] = [
  { key: "id", type: "string", required: true },
  { key: "name", type: "string", required: true },
  { key: "controlType", type: "string", required: true, defaultValue: "player" },
  { key: "status", type: "string", required: true, defaultValue: "active" },
  { key: "creatorUniqueTag", type: "string", required: true },
  { key: "operatorUserId", type: "string", required: true },
  { key: "operatorUniqueTag", type: "string", required: true },
  { key: "createdAt", type: "number", required: true },
  { key: "updatedAt", type: "number", required: true },
  // 可选描述字段 — 新增字段只需在这里加一行
  { key: "description", type: "string" },
  { key: "personality", type: "string" },
  { key: "appearance", type: "string" },
  { key: "age", type: "number" },
  { key: "gender", type: "string" },
  { key: "dimensionSelections", type: "json", serialize: "json" },
  { key: "talentIds", type: "array" },
  { key: "attributes", type: "record" },
  { key: "tags", type: "record" },
];
```

然后自动生成 `toYMap` / `fromYMap`：

```typescript
function entityToYMap(entity: Record<string, unknown>, fields: FieldDef[]): Y.Map<unknown> {
  const map = new Y.Map<unknown>();
  for (const field of fields) {
    const value = entity[field.key];
    if (value !== undefined) {
      map.set(field.key, field.serialize === "json" ? JSON.stringify(value) : value);
    }
  }
  return map;
}
```

#### 评估

| 维度     | 评价                                                       |
| -------- | ---------------------------------------------------------- |
| 修改量   | 较大（需重构整个编解码层）                                 |
| 效果     | **编解码逻辑完全自动化**，新增字段只需加一行元数据         |
| 向后兼容 | ⚠️ 需要充分测试序列化/反序列化一致性                        |
| 架构影响 | 引入元编程模式，增加抽象复杂度                             |
| 风险     | 中等 — 类型安全性降低，运行时错误更难调试                  |
| 建议     | **暂不实施**。当前 Character 字段相对稳定，方案 A+B 已够用 |

## 4. 推荐实施策略

### 优先级排序

```mermaid
graph LR
    B[方案 B: 消除重复编解码] --> A[方案 A: 载荷引用实体类型]
    A --> C[方案 C: 声明式编解码]
    style B fill:#22c55e,color:#fff
    style A fill:#3b82f6,color:#fff
    style C fill:#6b7280,color:#fff
```

| 步骤 | 方案                    | 改动范围 | 效果                    |
| ---- | ----------------------- | -------- | ----------------------- |
| 1    | **B: 消除重复编解码**   | 3 个文件 | 编解码从 3 处 → 1 处    |
| 2    | **A: 载荷引用实体类型** | 6 个文件 | 类型定义从 11 处 → 3 处 |
| 3    | C: 声明式编解码         | 待定     | 仅当字段频繁变化时考虑  |

### 实施后的新增字段修改清单

实施方案 A + B 后，新增一个角色字段只需修改：

| #   | 文件                                      | 修改点                                                          |
| --- | ----------------------------------------- | --------------------------------------------------------------- |
| 1   | `domain/entities/character.ts`            | `Character` 接口                                                |
| 2   | `domain/entities/character.ts`            | `CreateCharacterParams` 接口（如果创建时需要）                  |
| 3   | `domain/entities/character.ts`            | `UpdateCharacterParams` 接口（如果需要可更新）                  |
| 4   | `modules/game/repository/entity-codec.ts` | `characterToYMap` / `yMapToCharacter` / `applyCharacterUpdates` |

从 **8 个文件 11 处修改** 降至 **2 个文件 4 处修改**，且都集中在领域层和编解码层。

### 不再需要修改的文件

- ~~`domain/commands/room.ts`~~ → 通过类型引用自动获得新字段
- ~~`domain/events/room.ts`~~ → 通过类型引用自动获得新字段
- ~~`domain/commands/save.ts`~~ → 通过类型引用自动获得新字段
- ~~`modules/room/commands/handlers.ts`~~ → 使用 spread 和 `characterToYMap` 无需逐字段
- ~~`modules/room/hooks/useRoomCharacters.ts`~~ → 复用 `yMapToCharacter`

## 5. 实施注意事项

### 5.1 向后兼容

- 方案 A 修改了命令/事件的 Payload 结构，需要更新所有 `commandBus.dispatch()` 调用点
- TypeScript 编译器会在编译时捕获所有不兼容的调用，不会遗漏
- 建议在一个 PR 中完成所有变更，避免中间状态

### 5.2 Yjs 增量同步约束

`updateCharacterHandler` 中**不能**用 `characterToYMap()` 整体替换 Y.Map——这会导致 Yjs 认为所有字段都变了，触发全量同步。必须保持逐字段 `charMap.set()` 的方式，但可以通过 `applyCharacterUpdates()` 集中管理。

### 5.3 事件 Payload 设计权衡

方案 A 中 `CharacterCreatedEvent` 直接包含完整的 `Character` 对象，这意味着事件消费者能拿到所有字段。如果未来有字段不想暴露给事件消费者，可以用 `Omit` 排除。但对于当前的角色实体，完整暴露是合理的。

### 5.4 NPC 相关 Payload 的统一

当前 `UpdateNpcInfoPayload` 已经用了 `Partial<Pick<Character, ...>>` 的好模式，但 `CreateNpcPayload` 还是手动列出字段。建议在方案 A 中一并统一 NPC 相关 Payload。