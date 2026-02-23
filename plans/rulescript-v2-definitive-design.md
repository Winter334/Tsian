# RuleScript v2 终极指令集设计

**版本**：2.0  
**性质**：核心架构设计文档（权威定义）  
**设计日期**：2025-07-15  
**状态**：待评审  

> 本文档是 Lyra 规则引擎指令集的完整定义。
> 所有其他文档（DC 分层、装备系统等）中涉及指令集的部分以本文档为准。

---

## 0. 设计哲学

### 0.1 第一原则

```
AI 的创造力 = 少量正交原子操作 × 自由组合 × reason 叙事桥梁
```

- **小而正交**：每个指令有且仅有一个不可替代的职责
- **组合即创造**：不新增指令，通过组合现有指令表达新行为
- **语义直觉**：指令名即意图，AI 不需要查文档就能正确使用
- **reason 桥梁**：机制层和叙事层通过 `reason` 字段连接，AI 的叙事创造力在此释放

### 0.2 TRPG 行为的本质结构

所有 TRPG 行为都可以分解为以下模式：

```
模式 A — 确定性效果：
  直接执行 → 效果生效
  例：喝药水恢复 HP、装备武器、NPC 离场

模式 B — 不确定性判定：
  尝试 → 掷骰 → 成功/失败 → 不同后果
  例：攻击、施法、偷窃、说服

模式 C — 持续性效果：
  施加状态 → 每回合/受伤时自动触发 → 到期移除
  例：中毒、灼烧、护盾、祝福

模式 D — 被动修正：
  存在即生效 → 修改检定/伤害/属性的计算
  例：天赋加成、装备效果、地形修正
```

指令集的设计目标是用最少的原子操作覆盖这四种模式的所有组合。

### 0.3 核心结构改进：check 内嵌分支

**v1 的痛点**：check 和 conditional 总是成对出现，通过脆弱的字符串变量名（resultVar）连接。

```
v1：3 步表达 1 个自然概念
  check(resultVar="hit") → conditional(condition="hit") → damage
  
  问题：
  - AI 需要发明变量名
  - 需要在两个 action 之间保持引用一致
  - 拼写错误 = 静默失败
  - 违反"一个概念一个表达"原则
```

```
v2：1 步表达 1 个自然概念
  check(onSuccess=[damage], onFailure=[...])
  
  优势：
  - 消除 90%+ 的 conditional 使用
  - 消除 resultVar 拼写错误风险
  - AI 输出更简洁，更接近自然思维
  - check 本身就是完整的"尝试→后果"语义单元
```

---

## 1. 指令总览

### 1.1 AI 可见指令（14 个）

```
┌─────────┬──────────────┬──────────────────────────────────────┐
│ 类别     │ 指令          │ 职责                                │
├─────────┼──────────────┼──────────────────────────────────────┤
│ 判定     │ check        │ 技能/属性/攻击检定（内嵌成败分支）     │
│         │ roll         │ 独立掷骰/表达式求值                   │
├─────────┼──────────────┼──────────────────────────────────────┤
│ 数值     │ damage       │ 战斗伤害（触发 on_damage 防御链）     │
│         │ heal         │ 恢复资源（有上限保护）                │
│         │ cost         │ 消耗资源（不触发防御链）              │
│         │ set          │ 直接设置属性值（无保护，慎用）         │
├─────────┼──────────────┼──────────────────────────────────────┤
│ 状态     │ addTag       │ 添加状态/效果（可带触发器/被动修正）   │
│         │ removeTag    │ 移除状态/效果                        │
│         │ modifyTag    │ 修改状态叠层/元数据                   │
├─────────┼──────────────┼──────────────────────────────────────┤
│ 实体     │ grantItem    │ 授予物品                             │
│         │ removeItem   │ 移除物品                             │
│         │ grantSkill   │ 授予技能                             │
│         │ removeSkill  │ 移除技能                             │
├─────────┼──────────────┼──────────────────────────────────────┤
│ NPC     │ spawn        │ 创建实体（NPC/怪物/召唤物）           │
│         │ despawn      │ 移除/归档实体                        │
├─────────┼──────────────┼──────────────────────────────────────┤
│ 流程     │ branch       │ 条件分支（仅用于非检定条件判断）       │
└─────────┴──────────────┴──────────────────────────────────────┘

核心集：16 个

随子系统扩展可能增加少量领域指令（如装备操控 +2、地图移动 +1），
上限预估 ~20 个。新增指令仅在"操作独立子系统数据模型"时才引入，
凡是能用 set/damage/heal/addTag 等核心指令表达的，绝不新增。
```

### 1.2 引擎内部指令（AI 不可见）

```
┌──────────────┬──────────────────────────────────────────────┐
│ 指令          │ 用途                                        │
├──────────────┼──────────────────────────────────────────────┤
│ modifyDamage │ on_damage 触发器内部，修改即将造成的伤害量     │
└──────────────┴──────────────────────────────────────────────┘
```

### 1.3 相比当前代码的变更

```
┌──────────────────┬─────────────────────────────────────────────────┐
│ 当前指令          │ 处理方式                                        │
├──────────────────┼─────────────────────────────────────────────────┤
│ npcAction        │ 移除。NPC 行动用与玩家相同的原子操作组合表达       │
│ conditional      │ 重命名为 branch，降级为罕见使用。                 │
│                  │ 90% 场景被 check.onSuccess/onFailure 取代        │
│ sequence         │ 移除。then/else/actions 数组本身就是顺序执行       │ 
│ gain             │ 重命名为 heal（语义更直觉）                       │
│ lose             │ 重命名为 cost（语义更直觉）                       │
│ setValue         │ 重命名为 set（更简洁）                            │
│ npcCreate        │ 重命名为 spawn（更简洁，更泛化）                   │
│ npcStatusChange  │ 重命名为 despawn（更简洁）                        │
└──────────────────┴─────────────────────────────────────────────────┘
```

---

## 2. 指令详细定义

### 2.1 check — 技能检定（核心指令）

**职责**：执行一次判定，根据结果走不同分支。TRPG 不确定性的唯一来源。

```typescript
export interface CheckAction {
  type: "check";

  // ── 基础信息 ──

  /** 检定名称（叙事用，如 "挥剑攻击"、"撬锁"） */
  name: string;
  /** 检定使用的技能/属性 ID（对应 WorldConfig 中的定义） */
  skill: string;
  /** 执行检定的实体 ID。省略时默认为当前行动角色 */
  target?: string;
  /** 检定修正值（加算到掷骰结果上） */
  modifier?: ValueExpression;

  // ── DC 来源（四层分级）──

  /**
   * DC 来源类型
   *
   * 选择优先级（从高到低）：
   *   "formula"  — 可从目标属性公式计算（攻击→AC、法术→spell_dc）
   *   "opposed"  — 对抗检定，双方掷骰比较（偷窃、潜行、欺骗）
   *   "fixed"    — 固定已知数值（陷阱、毒素、数据卡明确标注的 DC）
   *   "ai"       — 需要根据情境判断（说服、创造性行动、环境互动）
   *
   * 默认: "ai"（无法公式化时的兜底方案）
   */
  dcSource?: "formula" | "opposed" | "fixed" | "ai";

  // ── dcSource = "formula" 时的参数 ──

  /** DC 计算目标实体 ID */
  dcTarget?: string;
  /**
   * DC 公式字符串，引用目标实体的属性
   *
   * 语法：
   *   简单引用: "target.ac"
   *   算术公式: "8 + target.proficiency + target.wis_mod"
   *
   * 公式中的 "target" 指向 dcTarget 指定的实体
   */
  dcFormula?: string;

  // ── dcSource = "opposed" 时的参数 ──

  /** 对抗目标的实体 ID */
  opposedEntity?: string;
  /** 对抗目标使用的技能/属性 ID */
  opposedSkill?: string;

  // ── dcSource = "fixed" 时的参数 ──

  /** 固定 DC 值 */
  fixedDC?: number;

  // ── dcSource = "ai" 时的参数 ──

  /** AI 判定的 DC 值 */
  dc?: ValueExpression;

  // ── ★ 核心改进：内嵌成败分支 ──

  /**
   * 检定成功时执行的 action 序列
   *
   * 这是 v2 的核心改进。取代了 v1 中 check + conditional 的两步模式。
   * 允许为空数组（表示成功时无特殊效果，仅记录检定结果）。
   */
  onSuccess: RuleAction[];

  /**
   * 检定失败时执行的 action 序列
   *
   * 省略或空数组表示失败时无特殊效果。
   * 常见用途：失败后的负面效果、反噬、暴露等。
   */
  onFailure?: RuleAction[];

  // ── 高级参数（罕见使用）──

  /**
   * 存储检定结果的变量名
   *
   * 绝大多数场景不需要此字段（用 onSuccess/onFailure 直接表达分支）。
   * 仅在以下罕见场景中使用：
   *   - 同一个检定结果需要在后续多个位置引用
   *   - 检定结果需要与其他条件组合判断（配合 branch 使用）
   */
  resultVar?: string;

  /** 原因/描述（供叙事 AI 参考） */
  reason?: string;
}
```

**DC 来源决策流程图**：

```
这次检定的 DC 从哪来？
  │
  ├─ 攻击目标？有 AC？法术？有 spell_dc？
  │   → dcSource: "formula"
  │   → dcTarget: "目标ID", dcFormula: "target.ac"
  │
  ├─ 双方对抗？（偷窃 vs 察觉、潜行 vs 察觉、欺骗 vs 洞察）
  │   → dcSource: "opposed"
  │   → opposedEntity: "对手ID", opposedSkill: "perception"
  │
  ├─ 固定已知的 DC？（陷阱 DC 15、毒素 DC 12）
  │   → dcSource: "fixed"
  │   → fixedDC: 15
  │
  └─ 需要根据情境判断？（说服的难度取决于 NPC 态度）
      → dcSource: "ai"
      → dc: 18
```

**引擎执行逻辑**：

```
executeCheck(action):

  1. 解析 DC
     switch (action.dcSource ?? "ai"):
       "formula"  → dc = evaluateFormula(action.dcFormula, getEntity(action.dcTarget))
       "opposed"  → 进入对抗检定路径（见下文）
       "fixed"    → dc = action.fixedDC
       "ai"       → dc = resolve(action.dc)

  2a. 标准检定路径（formula / fixed / ai）：
     roll = d20()
     mod = getSkillModifier(entity, action.skill) + resolve(action.modifier ?? 0)
     total = roll + mod
     success = (total >= dc)

  2b. 对抗检定路径（opposed）：
     attackerRoll = d20() + getSkillModifier(attacker, action.skill)
     defenderRoll = d20() + getSkillModifier(defender, action.opposedSkill)
     success = (attackerRoll > defenderRoll)   // 平局防守方胜（D&D 惯例）

  3. 记录检定结果到 ResultFrame
     → CheckResult { skill, roll, modifier, total, dc, dcSource, success, margin, ... }
     → 对抗检定额外记录 opposedRoll, opposedTotal, opposedSkill

  4. 执行分支
     if success:
       execute(action.onSuccess)
     else:
       execute(action.onFailure ?? [])

  5. 存储变量（如果指定了 resultVar）
     if action.resultVar:
       context.vars[action.resultVar] = success
```

---

### 2.2 roll — 独立掷骰

**职责**：执行一次独立的掷骰或表达式求值，将结果存入变量供后续使用。

```typescript
export interface RollAction {
  type: "roll";
  /** 骰子表达式，如 "2d6+3"、"1d20"、"str_mod * 2" */
  expression: string;
  /** 掷骰用途说明（显示在 mechanicSummary 中） */
  purpose?: string;
  /** 存储掷骰结果（数值）的变量名 */
  resultVar?: string;
}
```

**与 check 的区别**：
- `check` 判定成败（布尔），驱动分支逻辑
- `roll` 产生数值，通常用于确定伤害量等数值结果
- 大部分场景下 `roll` 是不需要的——`damage.amount` 直接写骰子表达式即可
- `roll` 主要用于：一个掷骰结果需要在多个地方引用的罕见场景

---

### 2.3 damage — 战斗伤害

**职责**：对目标造成战斗伤害。会触发 on_damage 防御链（触发器、护甲减免等）。

```typescript
export interface DamageAction {
  type: "damage";
  /** 受伤实体 ID */
  target: string;
  /** 伤害量。支持数字、骰子表达式、属性引用 */
  amount: ValueExpression;
  /** 受影响的资源字段。默认由 WorldConfig 第一个资源字段决定，兜底 "hp" */
  field?: string;
  /** 对应的上限字段（用于 clamp） */
  maxField?: string;
  /** 伤害类型标记（如 "fire"、"slashing"），影响 on_damage 触发器过滤 */
  damageType?: string;
  /** 伤害原因（叙事桥梁） */
  reason?: string;
}
```

**与 cost 的关键区别**：
- `damage` 触发 on_damage 触发器链（护甲减免、伤害反射、吸收盾等）
- `cost` 纯数值扣减，不触发任何触发器
- **战斗伤害用 `damage`，资源消耗用 `cost`**

---

### 2.4 heal — 恢复资源

**职责**：恢复目标的资源值，不超过上限。

```typescript
export interface HealAction {
  type: "heal";
  /** 目标实体 ID */
  target: string;
  /** 恢复量 */
  amount: ValueExpression;
  /** 受影响的资源字段。默认由 WorldConfig 决定，兜底 "hp" */
  field?: string;
  /** 上限字段。默认自动推导 "max_{field}" */
  maxField?: string;
  /** 恢复原因（叙事桥梁） */
  reason?: string;
}
```

**v1 对照**：原名 `gain`。改名为 `heal` 更接近自然语言——"heal the player"。

---

### 2.5 cost — 消耗资源

**职责**：扣减目标的资源值。不触发 on_damage 触发器链。

```typescript
export interface CostAction {
  type: "cost";
  /** 目标实体 ID */
  target: string;
  /** 消耗量（正数） */
  amount: ValueExpression;
  /** 受影响的资源字段。默认由 WorldConfig 决定，兜底 "hp" */
  field?: string;
  /** 消耗原因（叙事桥梁） */
  reason?: string;
}
```

**v1 对照**：原名 `lose`。改名为 `cost` 语义更精准——"costs 15 MP"。

**与 damage 的对照**：

| 维度 | damage | cost |
|------|--------|------|
| 触发 on_damage | ✅ 是 | ❌ 否 |
| 典型场景 | 战斗伤害 | 施法消耗 MP、饥饿值下降 |
| 伤害类型 | 有（fire/slashing 等） | 无 |
| 语义 | 被动承受 | 主动消耗 |

---

### 2.6 set — 直接设置属性值

**职责**：直接覆写目标的属性字段。无上下限保护，慎用。

```typescript
export interface SetAction {
  type: "set";
  /** 目标实体 ID */
  target: string;
  /** 要设置的属性字段名 */
  field: string;
  /** 目标值 */
  value: ValueExpression;
  /** 设置原因（叙事桥梁） */
  reason?: string;
}
```

**v1 对照**：原名 `setValue`，简化为 `set`。

**使用原则**：
- 大多数情况应使用 `damage`/`heal`/`cost`（有边界保护和触发器联动）
- `set` 仅用于：等级提升、重置属性、特殊剧情效果等需要精确覆写的场景

---

### 2.7 addTag — 添加状态标签

**职责**：为目标添加状态标签。可配置触发器实现持续效果和被动修正。

这是系统中最强大的指令之一——通过 trigger 机制，它可以表达几乎所有的持续性/被动效果。

```typescript
export interface AddTagAction {
  type: "addTag";
  /** 目标实体 ID */
  target: string;
  /** 标签 ID（如预定义 condition 的 ID，或自定义命名） */
  tag: string;
  /** 效果的显示名称 */
  displayName?: string;
  /** 效果描述（AI 和系统共用） */
  effectDescription?: string;

  /**
   * 结构化触发器（可选）
   *
   * 定义标签附带的自动化效果。
   * 不设置 trigger 时标签为纯标记性质（AI 参考描述进行叙事）。
   */
  trigger?: ConditionTrigger;

  /** 持续回合数。不设置则为永久效果 */
  duration?: number;
  /** 添加原因（叙事桥梁） */
  reason?: string;
}
```

**ConditionTrigger 定义**：

```typescript
export interface ConditionTrigger {
  /**
   * 触发时机
   *
   * "turn_start" — 回合开始时自动执行 actions
   * "on_damage"  — 拥有者即将受到伤害时触发（可修改伤害量）
   * "passive"    — 被动标记，不自动触发，引擎自动叠加 modifiers 修正
   */
  timing: "turn_start" | "on_damage" | "passive";

  /** 自动执行的 action 序列（timing=turn_start/on_damage 时使用） */
  actions?: RuleAction[];

  /** 被动修正列表（timing=passive 时使用） */
  modifiers?: PassiveModifier[];

  /** on_damage 专用：伤害类型过滤 */
  damageFilter?: { damageTypes: string[] };

  /** 是否在每次触发后自动递减 duration */
  autoDecrement?: boolean;
}
```

**PassiveModifier 定义**：

```typescript
export interface PassiveModifier {
  /**
   * 修正作用域
   *
   * "check"        — 检定修正（叠加到掷骰结果上）
   * "damage_dealt" — 造成伤害修正
   * "damage_taken" — 承受伤害修正
   * "stat"         — 属性值修正（直接修改有效值）
   */
  scope: "check" | "damage_dealt" | "damage_taken" | "stat";

  /** 过滤条件（限定生效范围） */
  filter?: string;
  /** 修正的目标字段（scope=stat 时必填） */
  field?: string;
  /** 加算修正值 */
  value?: ValueExpression;
  /** 乘算修正（scope=damage_taken 时使用，如 0.5=减半） */
  multiplier?: number;
  /** 修正来源描述 */
  reason: string;
}
```

**组合示例**：

```json
// 中毒（持续伤害）
{ "type": "addTag", "target": "player", "tag": "poisoned",
  "displayName": "中毒", "effectDescription": "每回合受到毒素伤害",
  "trigger": {
    "timing": "turn_start",
    "actions": [
      { "type": "damage", "target": "self", "amount": 3,
        "damageType": "poison", "reason": "中毒持续伤害" }
    ]
  },
  "duration": 3 }

// 石化皮肤（被动防御修正）
{ "type": "addTag", "target": "player", "tag": "stone_skin",
  "displayName": "石化皮肤",
  "trigger": {
    "timing": "passive",
    "modifiers": [
      { "scope": "damage_taken", "filter": "physical",
        "value": -3, "reason": "石化皮肤减免物理伤害" },
      { "scope": "stat", "field": "ac", "value": 2,
        "reason": "石化皮肤增加护甲" }
    ]
  },
  "duration": 5 }

// 纯叙事标记（无机制效果）
{ "type": "addTag", "target": "player", "tag": "wanted",
  "displayName": "被通缉",
  "effectDescription": "你的画像贴满了城镇的每一面墙",
  "reason": "偷窃失败被目击" }
```

---

### 2.8 removeTag — 移除状态标签

```typescript
export interface RemoveTagAction {
  type: "removeTag";
  /** 目标实体 ID */
  target: string;
  /** 要移除的标签 ID */
  tag: string;
  /** 移除原因（叙事桥梁） */
  reason?: string;
}
```

---

### 2.9 modifyTag — 修改标签叠层

```typescript
export interface ModifyTagAction {
  type: "modifyTag";
  /** 目标实体 ID */
  target: string;
  /** 要修改的标签 ID */
  tag: string;
  /** 操作类型 */
  operation: "set" | "increment" | "decrement";
  /** 操作值。set 时为目标值，increment/decrement 时为变化量（默认 1） */
  value?: ValueExpression;
  /** 修改原因（叙事桥梁） */
  reason?: string;
}
```

---

### 2.10 grantItem — 授予物品

```typescript
export interface GrantItemAction {
  type: "grantItem";
  /** 目标角色 ID */
  target: string;
  /** 物品模板 ID（可选，引用预设模板时填写） */
  templateId?: string;
  /** 物品名称 */
  name: string;
  /** 物品描述 */
  description: string;
  /** 物品类别 */
  category: "weapon" | "armor" | "accessory" | "consumable" | "material" | "quest" | "misc";
  /** 数量，默认 1 */
  quantity?: number;
  /** 装备槽位 ID（来自 WorldConfig.inventoryRules.equipSlotDefinitions） */
  equipSlot?: string;
  /** 物品效果列表 */
  effects?: ItemEffect[];
  /** 获得原因（叙事桥梁） */
  reason?: string;
}
```

---

### 2.11 removeItem — 移除物品

```typescript
export interface RemoveItemAction {
  type: "removeItem";
  /** 目标角色 ID */
  target: string;
  /** 物品实例 ID */
  instanceId: string;
  /** 移除数量，默认全部 */
  quantity?: number;
  /** 移除原因（叙事桥梁） */
  reason?: string;
}
```

---

### 2.12 grantSkill — 授予技能

```typescript
export interface GrantSkillAction {
  type: "grantSkill";
  /** 目标角色 ID */
  target: string;
  /** 技能模板 ID（可选） */
  templateId?: string;
  /** 技能名称 */
  name: string;
  /** 技能描述 */
  description: string;
  /** 技能类别 */
  category: "combat" | "magic" | "survival" | "social" | "craft" | "misc";
  /** 是否可主动使用 */
  activeUsable?: boolean;
  /** 使用消耗（仅 activeUsable=true 时有效） */
  cost?: { field: string; amount: number };
  /** 习得原因（叙事桥梁） */
  reason?: string;
}
```

---

### 2.13 removeSkill — 移除技能

```typescript
export interface RemoveSkillAction {
  type: "removeSkill";
  /** 目标角色 ID */
  target: string;
  /** 技能实例 ID */
  instanceId: string;
  /** 失去原因（叙事桥梁） */
  reason?: string;
}
```

---

### 2.14 spawn — 创建实体

**职责**：在场景中创建新实体。取代 v1 的 `npcCreate`，语义更泛化。

```typescript
export interface SpawnAction {
  type: "spawn";
  /** 实体数据 */
  entity: {
    /** 实体名称（必填，必须唯一） */
    name: string;
    /** 实体描述 */
    description?: string;
    /** 性格特征（NPC） */
    personality?: string;
    /** 外貌描述 */
    appearance?: string;
    /** 属性值（key 必须匹配 WorldConfig.primaryAttributes） */
    attributes?: Record<string, number>;
    /** 天赋 ID 列表（必须存在于 WorldConfig.talents） */
    talentIds?: string[];
  };
}
```

**v1 对照**：原名 `npcCreate`。改名为 `spawn` 更通用——未来可用于创建怪物、召唤物、甚至场景物件。

---

### 2.15 despawn — 移除/归档实体

**职责**：将实体从当前场景移除或永久归档。取代 v1 的 `npcStatusChange`。

```typescript
export interface DespawnAction {
  type: "despawn";
  /** 实体 ID */
  entityId: string;
  /**
   * 移除模式
   *
   * "temporary" — 暂时离场，可在后续剧情中通过 spawn 重新出现
   * "permanent" — 永久归档，不再参与游戏
   */
  mode: "temporary" | "permanent";
  /** 移除原因（叙事桥梁） */
  reason?: string;
}
```

**v1 对照**：原名 `npcStatusChange`，有三个状态值 `active/off_scene/archived`。
v2 简化为两个：`temporary`（= v1 的 off_scene）和 `permanent`（= v1 的 archived）。
`active` 状态不需要显式设置——实体被 `spawn` 后天然就是 active。

---

### 2.16 branch — 条件分支

**职责**：基于条件表达式选择执行不同的 action 序列。

```typescript
export interface BranchAction {
  type: "branch";
  /** 条件表达式（见第 3 章：条件表达式语言） */
  condition: ConditionExpression;
  /** 条件为真时执行 */
  then: RuleAction[];
  /** 条件为假时执行 */
  else?: RuleAction[];
}
```

**重要：`branch` 是低频指令。**

v2 中 90%+ 的条件分支场景由 `check.onSuccess/onFailure` 处理。`branch` 仅用于**不涉及掷骰判定的条件分支**：

```json
// 典型 branch 使用场景：基于角色状态做判断
{ "type": "branch",
  "condition": "player.hp < 10",
  "then": [
    { "type": "addTag", "target": "player", "tag": "desperate",
      "reason": "生命垂危，激发求生本能" }
  ] }

// 另一个场景：检查是否拥有某个标签
{ "type": "branch",
  "condition": "hasTag(player, 'blessed')",
  "then": [
    { "type": "heal", "target": "player", "amount": 5,
      "reason": "祝福的力量在关键时刻涌出" }
  ] }
```

**不应使用 branch 的场景**：

```json
// ❌ 错误：用 branch 做检定后分支（应该用 check.onSuccess）
{ "type": "check", "name": "攻击", "skill": "melee", "dc": 15,
  "resultVar": "hit", "onSuccess": [], "onFailure": [] }
{ "type": "branch", "condition": "hit",
  "then": [{ "type": "damage", ... }] }

// ✅ 正确：直接用 check.onSuccess
{ "type": "check", "name": "攻击", "skill": "melee", "dc": 15,
  "onSuccess": [{ "type": "damage", ... }] }
```

---

### 2.17 modifyDamage — 修改伤害量（引擎内部）

**AI 不可见。仅在 addTag.trigger.timing="on_damage" 的 actions 中使用。**

```typescript
export interface ModifyDamageAction {
  type: "modifyDamage";
  /** 伤害乘数（0.5=减半，0=免疫，2=双倍） */
  multiplier?: ValueExpression;
  /** 固定值减免 */
  reduction?: ValueExpression;
  /** 修改原因 */
  reason?: string;
}
```

---

## 3. 条件表达式语言

用于 `branch.condition` 字段和（罕见的）`check.resultVar` 后续引用。

### 3.1 语法定义

```
Expression     := OrExpr
OrExpr         := AndExpr ( "||" AndExpr )*
AndExpr        := NotExpr ( "&&" NotExpr )*
NotExpr        := "!" NotExpr | CompareExpr
CompareExpr    := ValueExpr ( CompareOp ValueExpr )?
CompareOp      := "<" | "<=" | ">" | ">=" | "==" | "!="
ValueExpr      := Number | VarRef | FieldRef | Predicate
Number         := [0-9]+ ( "." [0-9]+ )?
VarRef         := identifier                        // 引用 resultVar
FieldRef       := identifier "." identifier          // 引用实体属性
Predicate      := PredicateName "(" ArgList ")"
PredicateName  := "hasTag" | "hasItem"
ArgList        := identifier ( "," StringLiteral )
StringLiteral  := "'" [^']* "'"
```

### 3.2 支持的表达式

```
── 原子表达式 ──

变量引用（布尔）：
  atk_result                     → 引用 check 存储的 resultVar
  
实体属性引用：
  player.hp                      → 读取实体属性值
  哥布林.str                      → 支持中文实体 ID
  
数值字面量：
  42, 0.5, 0

── 比较运算 ──

  player.hp < 10                 → 小于
  player.hp <= 50                → 小于等于
  player.hp > 0                  → 大于
  player.hp >= player.max_hp     → 大于等于（可引用其他属性）
  dmg_roll == 20                 → 等于
  player.hp != 0                 → 不等于

── 逻辑运算 ──

  atk_result && dmg_roll > 10    → 与
  player.hp < 10 || flee_check   → 或
  !stealth_result                → 非

── 特殊谓词 ──

  hasTag(player, 'poisoned')     → 实体是否拥有标签
  hasItem(player, 'iron_sword')  → 实体是否拥有物品（按名称匹配）

── 不支持（有意排除）──

  赋值: x = 1                    → 用 roll/set 代替
  函数调用: foo()                → 除上面列出的谓词外不支持
  字符串比较: name == "xxx"      → 不支持
  三元运算: a ? b : c            → 用嵌套 branch 代替
  算术运算: a + b                → 在 condition 中不支持（在 ValueExpression 中支持）
```

### 3.3 安全性

**实现策略：使用受控作用域的表达式求值，不从零实现解析器。**

威胁模型分析：公式来源只有两个——AI 输出（不可能恶意）和 WorldConfig（自己编写或导入前可审核）。不存在不可信输入直接进入公式求值的路径。因此不需要从零实现词法分析器 + AST 解析器，那样做只会带来 500-800 行难以维护的代码和扩展性瓶颈。

推荐方案：

```typescript
// 方案 A：轻量表达式求值库（如 expr-eval，~5KB）
import { Parser } from 'expr-eval';
const parser = new Parser();
function evaluate(formula: string, context: Record<string, number>): number {
  return parser.evaluate(formula, context);
}

// 方案 B：new Function + 受控作用域（零依赖）
function evaluate(formula: string, target: Record<string, number>): number {
  const fn = new Function('target', `"use strict"; return (${formula});`);
  return fn(target);
}
// "target.ac" 天然就是 JS 属性访问语法，无需转换
// 未来 "Math.floor(target.hp / 2)" 也免费支持
```

防护措施：
- 属性引用仅从显式传入的 context 对象中读取（非全局作用域）
- 嵌套深度限制：最大 10 层
- 表达式长度限制：最大 500 字符

---

## 4. 值表达式 (ValueExpression)

用于 `amount`、`modifier`、`dc`、`value` 等数值字段。

```typescript
export type ValueExpression = string | number | boolean;
```

### 4.1 支持的格式

```
── 数字字面量 ──
  42, 0.5, -3

── 骰子表达式 ──
  "1d20"         → 1 个 20 面骰
  "2d6+3"        → 2 个 6 面骰 + 3
  "3d8-2"        → 3 个 8 面骰 - 2
  "1d4+str_mod"  → 1 个 4 面骰 + 力量修正

── 属性引用 ──
  "str_mod"      → 当前行动实体的力量修正
  "player.hp"    → 指定实体的属性
  "level"        → 当前行动实体的等级

── 变量引用 ──
  "fire_dmg"     → 引用 roll.resultVar 存储的数值

── 混合表达式 ──
  "2d6 + str_mod + 2"  → 骰子 + 属性 + 常量
```

### 4.2 与 ConditionExpression 的区别

| 维度 | ValueExpression | ConditionExpression |
|------|----------------|--------------------|
| 用途 | 计算数值 | 判断真假 |
| 出现位置 | amount、modifier、dc、value | branch.condition |
| 支持骰子 | ✅ "2d6+3" | ❌ |
| 支持比较 | ❌ | ✅ "hp < 10" |
| 支持逻辑 | ❌ | ✅ "&& \|\| !" |
| 返回类型 | number | boolean |

---

## 5. 公式求值器 (DC Formula)

用于 `check.dcFormula` 字段。与 ValueExpression 类似但上下文不同。

### 5.1 语法

```
── 属性引用 ──
  target.ac                       → DC 目标实体的 AC
  target.spell_dc                 → DC 目标实体的法术 DC
  target.dex_mod                  → DC 目标实体的敏捷修正

── 算术运算 ──
  10 + target.dex_mod             → 常量 + 属性引用
  8 + target.proficiency + target.wis_mod  → 多项相加

── 简写 ──
  纯属性名 "ac" 等价于 "target.ac"
```

### 5.2 安全性

与条件表达式语言（§3.3）使用相同的求值策略：受控作用域的表达式求值（`expr-eval` 库或 `new Function`），不从零实现解析器。公式中的 `target.xxx` 引用仅从显式传入的实体属性 context 对象中读取。

---

## 6. 对抗检定详细设计

### 6.1 执行流程

```
check(dcSource="opposed", skill="sleight_of_hand",
      opposedEntity="merchant", opposedSkill="perception")

  1. 主动方掷骰：
     attackerRoll = d20()
     attackerMod  = getSkillModifier(attacker, "sleight_of_hand")
     attackerTotal = attackerRoll + attackerMod

  2. 被动方掷骰：
     defenderRoll = d20()
     defenderMod  = getSkillModifier(defender, "perception")
     defenderTotal = defenderRoll + defenderMod

  3. 比较：
     success = (attackerTotal > defenderTotal)
     // 平局时被动方胜（D&D 5e 惯例）

  4. 记录到 CheckResult：
     {
       skill: "sleight_of_hand",
       roll: attackerRoll,
       modifier: attackerMod,
       total: attackerTotal,
       dcSource: "opposed",
       opposedRoll: defenderRoll,
       opposedModifier: defenderMod,
       opposedTotal: defenderTotal,
       opposedSkill: "perception",
       success: success,
       margin: attackerTotal - defenderTotal
     }

  5. 执行分支：
     success → onSuccess
     failure → onFailure
```

### 6.2 CheckResult 完整定义

```typescript
export interface CheckResult {
  /** 检定名称 */
  name: string;
  /** 使用的技能/属性 */
  skill: string;
  /** 掷骰结果（裸骰值） */
  roll: number;
  /** 修正值 */
  modifier: number;
  /** 最终结果 = roll + modifier */
  total: number;

  /** DC 来源 */
  dcSource: "formula" | "opposed" | "fixed" | "ai";

  // ── 标准检定结果（formula / fixed / ai）──
  /** 目标 DC */
  dc?: number;
  /** DC 公式（dcSource=formula 时，用于调试/展示） */
  dcFormulaUsed?: string;

  // ── 对抗检定结果（opposed）──
  /** 对方掷骰结果 */
  opposedRoll?: number;
  /** 对方修正值 */
  opposedModifier?: number;
  /** 对方最终结果 */
  opposedTotal?: number;
  /** 对方使用的技能 */
  opposedSkill?: string;

  // ── 通用结果 ──
  /** 是否成功 */
  success: boolean;
  /** 差值（正=成功余量，负=失败差距） */
  margin: number;
}
```

---

## 7. WorldConfig 检定预设

### 7.1 类型定义

```typescript
interface WorldConfig {
  // ... 现有字段 ...

  /**
   * 检定规则配置（可选）
   *
   * 注册常用检定的 DC 来源和公式，
   * 减少 AI 每次需要重复指定的信息量。
   */
  checkRules?: {
    /** 预定义的 DC 公式 */
    dcPresets?: Record<string, DCPreset>;
    /** 预定义的对抗检定 */
    opposedPresets?: Record<string, OpposedPreset>;
    /** AI 情境 DC 的参考表 */
    dcGuideline?: DCGuideline;
  };
}

interface DCPreset {
  label: string;
  formula: string;
  defaultSkill?: string;
}

interface OpposedPreset {
  label: string;
  attackerSkill: string;
  defenderSkill: string;
}

interface DCGuideline {
  /** 难度等级参考（如 D&D 的 5/10/15/20/25/30） */
  scale: { label: string; dc: number; description: string }[];
}
```

### 7.2 示例配置

```json
{
  "checkRules": {
    "dcPresets": {
      "melee_attack": {
        "label": "近战攻击",
        "formula": "target.ac",
        "defaultSkill": "melee_attack"
      },
      "ranged_attack": {
        "label": "远程攻击",
        "formula": "target.ac",
        "defaultSkill": "ranged_attack"
      },
      "spell_save": {
        "label": "法术豁免",
        "formula": "8 + caster.proficiency + caster.spellcasting_mod"
      }
    },
    "opposedPresets": {
      "steal": {
        "label": "偷窃",
        "attackerSkill": "sleight_of_hand",
        "defenderSkill": "perception"
      },
      "stealth": {
        "label": "潜行",
        "attackerSkill": "stealth",
        "defenderSkill": "perception"
      },
      "grapple": {
        "label": "擒抱",
        "attackerSkill": "athletics",
        "defenderSkill": "athletics"
      },
      "deceive": {
        "label": "欺骗",
        "attackerSkill": "deception",
        "defenderSkill": "insight"
      }
    },
    "dcGuideline": {
      "scale": [
        { "label": "极易", "dc": 5, "description": "普通人也能轻松完成" },
        { "label": "简单", "dc": 10, "description": "稍有能力的人能完成" },
        { "label": "中等", "dc": 15, "description": "需要一定专业能力" },
        { "label": "困难", "dc": 20, "description": "需要出色的能力" },
        { "label": "极难", "dc": 25, "description": "只有顶尖高手能完成" },
        { "label": "近乎不可能", "dc": 30, "description": "传说级别的壮举" }
      ]
    }
  }
}
```

### 7.3 预设使用的简写语法

AI 可以使用预设名称来简化 check 的编写：

```json
// 使用预设（简写）：
{ "type": "check", "name": "挥剑攻击",
  "preset": "melee_attack", "dcTarget": "哥布林",
  "onSuccess": [{ "type": "damage", "target": "哥布林", "amount": "1d8+str_mod" }] }

// 等价于（展开）：
{ "type": "check", "name": "挥剑攻击",
  "skill": "melee_attack", "dcSource": "formula",
  "dcTarget": "哥布林", "dcFormula": "target.ac",
  "onSuccess": [{ "type": "damage", "target": "哥布林", "amount": "1d8+str_mod" }] }

// 对抗预设：
{ "type": "check", "name": "偷窃",
  "preset": "steal", "opposedEntity": "商人",
  "onSuccess": [{ "type": "grantItem", ... }],
  "onFailure": [{ "type": "addTag", "target": "player", "tag": "caught_stealing" }] }
```

引擎自动从 WorldConfig 的预设中填充 `skill`、`dcSource`、`dcFormula`（或 `opposedSkill`）。

---

## 8. RuleScript 顶层结构

```typescript
export interface RuleScript {
  version: 2;
  actions: RuleAction[];
}

export type RuleAction =
  // 判定
  | CheckAction
  | RollAction
  // 数值
  | DamageAction
  | HealAction
  | CostAction
  | SetAction
  // 状态
  | AddTagAction
  | RemoveTagAction
  | ModifyTagAction
  // 实体
  | GrantItemAction
  | RemoveItemAction
  | GrantSkillAction
  | RemoveSkillAction
  // NPC
  | SpawnAction
  | DespawnAction
  // 流程
  | BranchAction;

// 引擎内部（不在 RuleAction 联合类型中暴露给 AI）
export type InternalAction =
  | ModifyDamageAction;

// 触发器内部可用的 action 类型（RuleAction + InternalAction）
export type TriggerAction = RuleAction | InternalAction;
```

---

## 9. 全场景验证

### 9.1 基础攻击（formula DC）

```json
{ "type": "check", "name": "挥剑攻击", "skill": "melee",
  "dcSource": "formula", "dcTarget": "哥布林", "dcFormula": "target.ac",
  "onSuccess": [
    { "type": "damage", "target": "哥布林", "amount": "1d8+str_mod",
      "damageType": "slashing", "reason": "铁剑划过哥布林的胸膛" }
  ],
  "onFailure": [] }
```

### 9.2 施法（消耗 + 检定 + AoE + 状态）

```json
[
  { "type": "cost", "target": "player", "amount": 15, "field": "mp",
    "reason": "施放火球术" },
  { "type": "check", "name": "火球术", "skill": "magic",
    "dcSource": "ai", "dc": 13,
    "onSuccess": [
      { "type": "damage", "target": "哥布林A", "amount": "3d6",
        "damageType": "fire", "reason": "火球术爆炸" },
      { "type": "damage", "target": "哥布林B", "amount": "3d6",
        "damageType": "fire", "reason": "火球术爆炸" },
      { "type": "addTag", "target": "哥布林A", "tag": "burning",
        "displayName": "灼烧", "duration": 2,
        "trigger": { "timing": "turn_start",
          "actions": [{ "type": "damage", "target": "self", "amount": "1d4",
                        "damageType": "fire", "reason": "灼烧持续伤害" }] } }
    ],
    "onFailure": [
      { "type": "cost", "target": "player", "amount": 5, "field": "hp",
        "reason": "法术失控反噬" }
    ] }
]
```

### 9.3 偷窃（对抗检定 + 物品转移）

```json
{ "type": "check", "name": "偷窃", "skill": "sleight_of_hand",
  "dcSource": "opposed", "opposedEntity": "商人", "opposedSkill": "perception",
  "onSuccess": [
    { "type": "grantItem", "target": "player", "name": "金币袋",
      "description": "从商人腰间摸来的钱袋", "category": "misc",
      "reason": "成功偷走了商人的钱袋" }
  ],
  "onFailure": [
    { "type": "addTag", "target": "player", "tag": "caught_stealing",
      "displayName": "被抓现行",
      "reason": "商人一把抓住了你的手腕" }
  ] }
```

### 9.4 使用预设简写

```json
{ "type": "check", "name": "挥剑攻击",
  "preset": "melee_attack", "dcTarget": "哥布林",
  "onSuccess": [
    { "type": "damage", "target": "哥布林", "amount": "1d8+str_mod",
      "damageType": "slashing", "reason": "铁剑命中" }
  ] }
```

### 9.5 NPC 行动（与玩家完全相同的语法）

```json
{ "type": "check", "name": "哥布林攻击", "skill": "melee",
  "target": "哥布林",
  "dcSource": "formula", "dcTarget": "player", "dcFormula": "target.ac",
  "onSuccess": [
    { "type": "damage", "target": "player", "amount": "1d6+2",
      "damageType": "slashing", "reason": "哥布林的弯刀砍中了你的手臂" }
  ],
  "onFailure": [] }
```

### 9.6 "命运之子"天赋（AI 自由创造）

```json
// 诠释 A：战斗中给予额外豁免
{ "type": "check", "name": "命运庇护", "skill": "luck",
  "dcSource": "fixed", "fixedDC": 8, "modifier": 5,
  "onSuccess": [
    { "type": "heal", "target": "player", "amount": 0, "field": "hp",
      "reason": "命运之子：一阵神秘的风吹偏了箭矢的轨迹" }
  ] }

// 诠释 B：社交中降低 DC（AI 直接给更低的 dc）
{ "type": "check", "name": "交涉", "skill": "persuasion",
  "dcSource": "ai", "dc": 10,
  "onSuccess": [
    { "type": "despawn", "entityId": "守卫", "mode": "temporary",
      "reason": "守卫莫名觉得你值得信赖，让你通过了" }
  ],
  "reason": "命运之子天赋使对方产生好感，DC 降低" }

// 诠释 C：危机中减免伤害
{ "type": "addTag", "target": "player", "tag": "fate_shield",
  "displayName": "命运庇护",
  "effectDescription": "世界的眷顾为你抵挡了部分伤害",
  "trigger": {
    "timing": "on_damage",
    "actions": [
      { "type": "modifyDamage", "multiplier": 0.5,
        "reason": "命运之子天赋" }
    ]
  },
  "duration": 1 }

// 诠释 D：探索中直接叙事（无 action）
{ "version": 2, "actions": [] }
// AI 在叙事输出中描述：你的直觉引导你注意到了墙上的裂缝...
```

### 9.7 复杂组合：多步连锁战斗

```json
[
  { "type": "check", "name": "战士冲锋", "skill": "athletics",
    "dcSource": "fixed", "fixedDC": 12,
    "onSuccess": [
      { "type": "addTag", "target": "player", "tag": "charging",
        "displayName": "冲锋",
        "trigger": {
          "timing": "passive",
          "modifiers": [
            { "scope": "damage_dealt", "value": 3, "reason": "冲锋加成伤害" }
          ]
        },
        "duration": 1,
        "reason": "冲锋蓄力" },
      { "type": "check", "name": "冲锋攻击", "skill": "melee",
        "dcSource": "formula", "dcTarget": "boss", "dcFormula": "target.ac",
        "onSuccess": [
          { "type": "damage", "target": "boss", "amount": "2d6+str_mod",
            "damageType": "slashing",
            "reason": "冲锋斩击命中，额外冲锋加成" },
          { "type": "addTag", "target": "boss", "tag": "staggered",
            "displayName": "踉跄", "duration": 1,
            "reason": "猛烈的冲撞使敌人失去平衡" }
        ],
        "onFailure": [
          { "type": "addTag", "target": "player", "tag": "overextended",
            "displayName": "破绽", "duration": 1,
            "trigger": {
              "timing": "passive",
              "modifiers": [
                { "scope": "stat", "field": "ac", "value": -2,
                  "reason": "冲锋失败暴露破绽" }
              ]
            },
            "reason": "冲锋落空，身体失去平衡" }
        ] }
    ],
    "onFailure": [
      { "type": "cost", "target": "player", "amount": 5, "field": "stamina",
        "reason": "冲锋失败浪费体力" }
    ] }
]
```

### 9.8 非检定条件分支（branch 的合法使用）

```json
[
  { "type": "branch",
    "condition": "player.hp < 10 && hasTag(player, 'cornered')",
    "then": [
      { "type": "set", "target": "player", "field": "rage_mode", "value": 1,
        "reason": "绝境激发了潜在的狂暴之力" },
      { "type": "addTag", "target": "player", "tag": "berserk",
        "displayName": "狂暴",
        "trigger": {
          "timing": "passive",
          "modifiers": [
            { "scope": "damage_dealt", "value": 5, "reason": "狂暴加成" },
            { "scope": "stat", "field": "ac", "value": -2, "reason": "狂暴降低防御" }
          ]
        },
        "duration": 3 }
    ] }
]
```

---

## 10. 迁移方案

项目尚未上线，不需要维护兼容层。直接原地替换：

- [ ] 直接在 `rule-script.ts` 中替换类型定义（不建新文件）
- [ ] 全局重命名：gain→heal、lose→cost、setValue→set、conditional→branch、npcCreate→spawn、npcStatusChange→despawn
- [ ] 删除 npcAction、sequence、modifyDamage 的类型定义和 schema
- [ ] 修改引擎中所有 action handler，适配新类型名和新字段
- [ ] 更新 action-schemas.ts，一次性替换为 v2 schema
- [ ] 更新 Prompt 模板中的指令集描述

---

## 11. 实施路线

### Phase A: 类型定义与引擎核心（2-3 天）

- [ ] 直接替换 `rule-script.ts` 类型定义（重命名 + 新增字段 + 删除废弃类型）
- [ ] 实现 DC 解析器（`dc-resolver.ts`）
- [ ] 实现公式求值器（`formula-evaluator.ts`，基于 `expr-eval` 或 `new Function` 受控作用域）
- [ ] 实现对抗检定执行器（`opposed-check.ts`）
- [ ] 实现条件表达式求值器（`condition-evaluator.ts`，复用公式求值器方案）
- [ ] 修改引擎 `executeCheck` 支持 onSuccess/onFailure + dcSource
- [ ] 单元测试

### Phase B: Action Schema 重写（1-2 天）

- [ ] 重写 `action-schemas.ts`（v2 指令集）
- [ ] 移除 npcAction/sequence/modifyDamage 的 AI 可见 schema
- [ ] 更新 check schema（加入 dcSource、onSuccess/onFailure、preset）
- [ ] 更新命名（gain→heal、lose→cost 等）
- [ ] 添加 WorldConfig.checkRules 的 schema 生成逻辑

### Phase C: Prompt 适配（1 天）

- [ ] 更新解析 AI 的 system prompt 中的指令集描述
- [ ] 更新示例（使用 v2 语法）
- [ ] 测试 AI 是否能正确使用新语法

### Phase D: 结果展示适配（1 天）

- [ ] CheckResult 扩展（对抗检定字段）
- [ ] ResultFrame 展示适配（UI 侧）
- [ ] mechanicSummary 生成适配（对抗检定的描述）

---

## 12. 风险与注意事项

### 12.1 AI 适应期

新的 check 内嵌 onSuccess/onFailure 语法对 AI 来说更自然，但需要时间适应。
初期可能出现：
- AI 仍然使用 resultVar + branch 的旧模式（→ 兼容，不报错）
- AI 忘记填 onSuccess（→ 校验提示）
- AI 在 onSuccess 中嵌套过深（→ 深度限制 10 层）

### 12.2 全量替换注意事项

项目未上线，直接全量替换，不维护兼容层。但需确保：
- 所有引用旧类型名的代码全部更新（全局搜索 `gain`/`lose`/`setValue`/`conditional`/`npcCreate`/`npcStatusChange`/`npcAction`/`sequence`）
- 引擎 handler、schema、prompt 模板三处同步更新，不遗漏

### 12.3 条件表达式安全性

表达式求值采用受控作用域方案（见 §3.3），需要完整的测试覆盖：
- 正常表达式
- 异常表达式（语法错误、无效属性引用）
- 边界情况（空字符串、超长表达式、深嵌套）

### 12.4 性能

- 公式求值器和条件表达式解析器可能被频繁调用，需要考虑缓存
- 对抗检定涉及两次掷骰 + 两次属性查询，确保不会成为瓶颈
- check 的 onSuccess/onFailure 嵌套可能导致递归执行，需要深度限制

---

## 附录 A：扩展性分析

### A.1 核心集 vs 领域指令

16 个核心指令覆盖了所有「实体属性 / 状态 / 判定 / 生命周期 / 物品技能增删」操作。但某些子系统拥有独立的数据模型，其状态修改无法用核心指令表达：

```
┌──────────────────┬────────────────────────────────────┬─────────────┐
│ 未来功能          │ 核心指令能否覆盖                     │ 需要新指令？  │
├──────────────────┼────────────────────────────────────┼─────────────┤
│ AI 装备/卸下物品  │ ❌ item.equipped 不是实体属性        │ ✅ +2       │
│ AI 使用消耗品     │ ❌ 涉及物品数量修改 + 效果触发        │ ✅ +1       │
│ 简单位置移动      │ ✅ set(field="zone")               │ ❌          │
│ 复杂地图移动      │ ❌ 需要路径校验和区域触发             │ 可能 +1     │
│ 交易/转移物品     │ ⚠️ removeItem(A) + grantItem(B)    │ 可选        │
│ 修改 NPC 态度     │ ✅ set(target="npc", field="mood") │ ❌          │
│ 修改天气/环境     │ ✅ set(target="world", field=...)   │ ❌          │
│ 触发剧情事件      │ ✅ addTag(target="world", tag=...)  │ ❌          │
│ 召唤/解散随从     │ ✅ spawn / despawn                  │ ❌          │
│ 修改时间          │ ✅ set(target="world", field="time")│ ❌          │
└──────────────────┴────────────────────────────────────┴─────────────┘
```

### A.2 扩展原则

新增指令的唯一合法理由是「操作目标是独立于 entity.fields 的子系统数据模型」。

- entity.fields → set / damage / heal / cost 覆盖
- entity.tags → addTag / removeTag / modifyTag 覆盖
- entity.inventory → grantItem / removeItem 覆盖
- entity.skills → grantSkill / removeSkill 覆盖
- **item.equipped → 需要 equipItem / unequipItem（装备子系统领域指令）**
- **map.position → 可能需要 move（地图子系统领域指令，取决于复杂度）**

核心集 16 + 领域扩展上限 ~4 = 总上限 ~20 个 AI 可见指令。

## 附录 B：指令数量对比

| 版本 | AI 可见指令数 | 引擎内部 | 总计 |
|------|-------------|---------|------|
| v1 (当前) | 19 | 0 | 19 |
| v1 (清理后) | 15 | 2 | 17 |
| v2 (本文档) | 16 | 1 | 17 |

指令数量变化不大，但结构性改进显著：
- check 吸收了 90% 的 conditional 职责
- 移除了 npcAction 这个最大的困惑源
- DC 分层让引擎能自主计算大部分 DC

## 附录 C：AI 每轮输出的 token 节省估算

```
典型战斗场景（攻击→命中→伤害）：

v1:
  check(resultVar) + conditional(condition) + damage
  ≈ 90 tokens

v2:
  check(onSuccess=[damage])
  ≈ 55 tokens

节省：≈ 39%

复杂场景（施法 + 消耗 + 多目标 + 状态）：

v1:
  lose + check(resultVar) + conditional(then=[damage, damage, addTag])
  ≈ 180 tokens

v2:
  cost + check(onSuccess=[damage, damage, addTag])
  ≈ 120 tokens

节省：≈ 33%
```

## 附录 D：完整类型定义汇总

```typescript
// ── RuleScript v2 完整类型 ──

export interface RuleScript {
  version: 2;
  actions: RuleAction[];
}

export type RuleAction =
  | CheckAction      // 检定（内嵌成败分支）
  | RollAction       // 独立掷骰
  | DamageAction     // 战斗伤害
  | HealAction       // 恢复资源
  | CostAction       // 消耗资源
  | SetAction        // 直接设置属性
  | AddTagAction     // 添加状态
  | RemoveTagAction  // 移除状态
  | ModifyTagAction  // 修改状态叠层
  | GrantItemAction  // 授予物品
  | RemoveItemAction // 移除物品
  | GrantSkillAction // 授予技能
  | RemoveSkillAction// 移除技能
  | SpawnAction      // 创建实体
  | DespawnAction    // 移除实体
  | BranchAction;    // 条件分支

export type ValueExpression = string | number | boolean;
export type ConditionExpression = string;
```
