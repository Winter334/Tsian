# DC 分层与检定系统设计方案

**版本**：1.0  
**性质**：核心机制设计文档  
**前置依赖**：Rules Engine、IRNR 管线、装备系统（equipment-system-and-dual-pipeline.md）  
**设计日期**：2025-07-15  

---

## 1. 问题陈述

### 1.1 当前状况

当前系统中，**所有技能检定的 DC 都由 AI（Parser AI）设定**。即使是攻击这样规则完全明确的操作，DC 也依赖 AI 在 RuleScript 中给出。

这相当于让 DM 在每次攻击时都临时决定 AC 值——不仅低效，而且不可靠：
- AI 可能上一轮给某个怪物 AC 15，下一轮变成 AC 12
- AI 需要在每个 check 中额外输出 DC 值，浪费 token
- 无法支持 UI 直接发起的对抗性操作（如偷窃按钮），因为没有 Parser AI 参与就没有 DC

### 1.2 D&D/TRPG 的设计哲学

> **能用规则解决的，就不要浪费 DM 的注意力。DM 的判断力是稀缺资源，应该用在真正需要判断的地方。**

映射到 Lyra：

> **能用公式算出的 DC，就不要浪费 AI 的 token 和注意力。AI 的判断力应该用在情境性、创造性的操作上。**

---

## 2. D&D 中 DC 的管理方式

D&D 5e 的 DC 来源分为三个层级，**并非所有 DC 都由 DM 判定**：

### 2.1 公式化 DC（完全机械计算，DM 无需介入）

| 场景 | DC 来源 | 公式 |
|------|--------|------|
| 近战/远程攻击 | 目标的 AC（护甲等级） | `AC = 10 + 敏捷修正 + 护甲加值 + 盾牌 + 特殊能力` |
| 法术豁免 | 施法者的法术 DC | `DC = 8 + 熟练加值 + 施法属性修正` |
| 毒素/陷阱 | 怪物/陷阱数据卡 | 固定数值，写在数据里 |

**特点**：完全由数据驱动，不需要任何判断。

### 2.2 对抗检定（双方掷骰对比，无固定 DC）

| 场景 | 攻方检定 | 守方检定 |
|------|---------|--------|
| 偷窃/扒窃 | 巧手（Sleight of Hand） | 察觉（Perception） |
| 潜行 | 隐匿（Stealth） | 察觉（Perception） |
| 擒抱 | 运动（Athletics） | 运动 或 体操（Acrobatics） |
| 欺骗 | 欺诈（Deception） | 洞察（Insight） |

**特点**：没有固定 DC，而是双方各掷一次骰，比大小。DM 完全不需要设定数值。

### 2.3 情境 DC（需要 DM 判断）

| 场景 | DM 做什么 |
|------|----------|
| 说服一个对你有敌意的守卫 | 根据 NPC 性格、当前态度、玩家论点质量设定 DC |
| 翻越一面墙 | 根据墙的高度、材质、天气设定 DC |
| 在图书馆找到特定情报 | 根据情报的稀缺性、图书馆规模设定 DC |
| 创造性行动（用吊灯砸人） | 完全由 DM 即兴判断 |

**特点**：高度依赖上下文，无法预先公式化。这才是真正需要 DM（AI）介入的地方。

DMG 提供了一个参考表帮助 DM 快速判断：

| 难度 | DC |
|------|----|
| 极易 | 5 |
| 简单 | 10 |
| 中等 | 15 |
| 困难 | 20 |
| 极难 | 25 |
| 近乎不可能 | 30 |

---

## 3. Lyra 的 DC 分层方案

### 3.1 三层 DC 来源

```
DC 解析优先级（从高到低）：

① 公式化 DC
   → 数据中已有公式或可从实体属性直接计算
   → 完全跳过 AI 判定
   → 例: 攻击 → DC = target.ac
   
② 对抗检定
   → 双方各自掷骰 + 属性修正，比大小
   → 无需固定 DC，完全跳过 AI 判定
   → 例: 偷窃 → attacker.sleight_of_hand vs target.perception
   
③ 情境 DC（兜底）
   → 需要 AI 根据上下文判断
   → 仅用于无法公式化的操作
   → 例: 说服守卫 → AI 根据 NPC 态度设 DC
```

### 3.2 操作类型映射

```
┌──────────────────┬──────────────┬────────────────────────────────────┐
│ 操作类型          │ DC 来源       │ 计算方式                            │
├──────────────────┼──────────────┼────────────────────────────────────┤
│ 攻击（武器）      │ 公式化        │ DC = 目标 AC                        │
│                  │              │ AC = 基础值 + 敏捷修正 + 装备加值     │
├──────────────────┼──────────────┼────────────────────────────────────┤
│ 攻击（法术）      │ 公式化        │ DC = 施法者 spell_dc               │
│                  │              │ spell_dc = 8 + 熟练 + 施法属性修正   │
├──────────────────┼──────────────┼────────────────────────────────────┤
│ 偷窃/扒窃        │ 对抗检定      │ 玩家 巧手 vs 目标 察觉               │
│                  │              │ 各自 d20 + 属性修正，比大小           │
├──────────────────┼──────────────┼────────────────────────────────────┤
│ 潜行             │ 对抗检定      │ 玩家 隐匿 vs 目标 察觉               │
├──────────────────┼──────────────┼────────────────────────────────────┤
│ 擒抱/挣脱        │ 对抗检定      │ 运动 vs 运动/体操                    │
├──────────────────┼──────────────┼────────────────────────────────────┤
│ 欺骗             │ 对抗检定      │ 欺诈 vs 洞察                        │
├──────────────────┼──────────────┼────────────────────────────────────┤
│ 说服/交涉        │ 混合          │ 简单情况: 对抗（游说 vs 洞察）        │
│                  │              │ 复杂情况: AI 设 DC（考虑 NPC 态度）   │
├──────────────────┼──────────────┼────────────────────────────────────┤
│ 翻越障碍/撬锁     │ 情境 DC       │ AI 根据描述设 DC                    │
│                  │              │ 可给 AI 推荐值（简单10/中等15/困难20） │
├──────────────────┼──────────────┼────────────────────────────────────┤
│ 创造性行动        │ 情境 DC       │ 完全由 AI 判断                      │
└──────────────────┴──────────────┴────────────────────────────────────┘
```

---

## 4. 对管线路由的影响

### 4.1 三种执行路径

结合装备系统方案中的双管线架构，完整的操作路由实际上是三条路径：

```
玩家操作
  │
  ├─ 确定型操作（装备/卸下/丢弃）
  │   → 轻量管线：validate → execute → 即时生效
  │   → 不需要掷骰，不需要 AI
  │
  ├─ 可公式化的仲裁型操作（攻击/偷窃/潜行）
  │   → 规则引擎路径：validate → 公式算 DC / 对抗掷骰 → 规则引擎执行 → 叙事 AI
  │   → 需要规则引擎，但不需要 Parser AI 设定 DC
  │
  └─ 情境性操作（说服/创造性行动/复杂互动）
      → 完整 IRNR 管线：Parser AI 设 DC → 掷骰 → 规则引擎执行 → 叙事 AI
      → 需要 AI 判断 DC
```

### 4.2 中型路径与重型路径的关系

中型路径和重型路径在**实现上是同一条管线**，区别仅在于 DC 的来源。不需要新建一条物理上独立的管线，而是在规则引擎内部根据 `dcSource` 字段分发：

```
                     SkillCheckAction
                           │
                    ┌──────┴──────┐
                    │  dcSource?  │
                    └──────┬──────┘
                           │
           ┌───────────────┼───────────────┐
           │               │               │
     "formula"        "opposed"         "ai"
           │               │               │
     读实体属性       双方各掷骰       使用 AI 给的
     计算 DC         比较结果          dc 字段
           │               │               │
           └───────────────┼───────────────┘
                           │
                    掷骰 + 比较 DC
                           │
                    成功 / 失败
                           │
                    写入 ResultFrame
```

---

## 5. 数据模型变更

### 5.1 SkillCheckAction 扩展

```typescript
// src/domain/types/rule-script.ts — 修改 SkillCheckAction

export interface SkillCheckAction extends RuleActionBase {
  type: "skillCheck";
  
  /** 执行检定的实体 ID */
  entity: string;
  /** 检定使用的属性/技能 */
  skill: string;
  
  /**
   * DC 来源
   * 
   * "formula"  → 从目标实体的属性公式计算（如 AC = 10 + dex_mod + armor_bonus）
   * "opposed"  → 对抗检定，双方各自掷骰比较
   * "fixed"    → 固定值（如陷阱、毒素的固定 DC）
   * "ai"       → AI 判定（现有行为，兜底方案）
   * 
   * 默认值: "ai"（向后兼容，不指定时使用 AI 给的 dc 值）
   */
  dcSource?: "formula" | "opposed" | "fixed" | "ai";
  
  // ── dcSource = "formula" ──
  /** 目标实体 ID */
  targetEntity?: string;
  /** 
   * DC 公式字符串
   * 引用目标实体的属性字段
   * 例: "target.ac", "target.spell_dc", "10 + target.dex_mod + target.armor_bonus"
   */
  dcFormula?: string;
  
  // ── dcSource = "opposed" ──
  /** 对抗目标的实体 ID */
  opposedEntity?: string;
  /** 对抗目标使用的属性/技能 */
  opposedSkill?: string;
  
  // ── dcSource = "fixed" ──
  /** 固定 DC 值 */
  fixedDC?: number;
  
  // ── dcSource = "ai"（现有字段，保持兼容）──
  /** AI 判定的 DC 值 */
  dc?: number;
  
  // ── 通用字段 ──
  /** 检定修正（加值/减值） */
  modifier?: number;
  /** 成功/失败时的后续 actions */
  onSuccess?: RuleAction[];
  onFailure?: RuleAction[];
}
```

### 5.2 向后兼容

```typescript
/**
 * 向后兼容策略：
 * 
 * 1. dcSource 默认为 "ai"
 *    → 不指定 dcSource 时，引擎使用现有的 dc 字段
 *    → 所有现存的 RuleScript 无需修改
 * 
 * 2. AI 仍可使用 dcSource: "ai" + dc 字段
 *    → 对于情境性操作，AI 行为不变
 * 
 * 3. 渐进式迁移
 *    → 在 Action Schema 中引导 AI 使用合适的 dcSource
 *    → 引擎侧实现公式计算后，AI 输出 dcSource: "formula" 时自动走公式路径
 *    → 不影响旧的 dcSource: "ai" 路径
 */
```

### 5.3 CheckResult 扩展

```typescript
// src/domain/types/result-frame.ts — 扩展

export interface CheckResult {
  /** 检定类型 */
  checkType: string;
  /** 使用的属性/技能 */
  skill: string;
  /** 掷骰结果 */
  roll: number;
  /** 修正值 */
  modifier: number;
  /** 最终结果 = roll + modifier */
  total: number;
  
  /** DC 来源（新增） */
  dcSource: "formula" | "opposed" | "fixed" | "ai";
  
  // dcSource != "opposed" 时：
  /** 目标 DC */
  dc?: number;
  /** DC 公式（仅 dcSource="formula" 时填充，用于调试/展示） */
  dcFormulaUsed?: string;
  
  // dcSource = "opposed" 时：
  /** 对方掷骰结果 */
  opposedRoll?: number;
  /** 对方修正值 */
  opposedModifier?: number;
  /** 对方最终结果 */
  opposedTotal?: number;
  /** 对方使用的技能 */
  opposedSkill?: string;
  
  /** 是否成功 */
  success: boolean;
  /** 成功/失败的差值 */
  margin: number;
}
```

---

## 6. 引擎侧实现

### 6.1 DC 解析器

```typescript
// src/lib/rules/dc-resolver.ts (新文件)

import type { Entity } from "@/domain/types/entity";
import type { SkillCheckAction } from "@/domain/types/rule-script";

/**
 * DC 解析结果
 */
interface ResolvedDC {
  /** 解析方式 */
  source: "formula" | "opposed" | "fixed" | "ai";
  /** 
   * 固定 DC 值
   * 对于 "opposed" 类型为 undefined（需要对方掷骰）
   */
  dc?: number;
  /** 对抗检定时对方的技能和实体 */
  opposed?: {
    entity: Entity;
    skill: string;
  };
  /** 调试信息：使用的公式 */
  formulaUsed?: string;
}

/**
 * 解析 SkillCheckAction 的 DC
 * 
 * 优先级：
 * 1. 如果指定了 dcSource，使用对应策略
 * 2. 如果未指定 dcSource（向后兼容），使用 dc 字段
 */
function resolveDC(
  action: SkillCheckAction,
  getEntity: (id: string) => Entity | undefined
): ResolvedDC {
  const source = action.dcSource ?? "ai";
  
  switch (source) {
    case "formula": {
      if (!action.targetEntity || !action.dcFormula) {
        throw new Error("dcSource='formula' requires targetEntity and dcFormula");
      }
      const target = getEntity(action.targetEntity);
      if (!target) {
        throw new Error(`Target entity not found: ${action.targetEntity}`);
      }
      const dc = evaluateFormula(action.dcFormula, target);
      return { source: "formula", dc, formulaUsed: action.dcFormula };
    }
    
    case "opposed": {
      if (!action.opposedEntity || !action.opposedSkill) {
        throw new Error("dcSource='opposed' requires opposedEntity and opposedSkill");
      }
      const opponent = getEntity(action.opposedEntity);
      if (!opponent) {
        throw new Error(`Opposed entity not found: ${action.opposedEntity}`);
      }
      return {
        source: "opposed",
        opposed: { entity: opponent, skill: action.opposedSkill },
      };
    }
    
    case "fixed": {
      if (action.fixedDC === undefined) {
        throw new Error("dcSource='fixed' requires fixedDC");
      }
      return { source: "fixed", dc: action.fixedDC };
    }
    
    case "ai":
    default: {
      if (action.dc === undefined) {
        throw new Error("dcSource='ai' requires dc field");
      }
      return { source: "ai", dc: action.dc };
    }
  }
}
```

### 6.2 公式求值器

```typescript
// src/lib/rules/formula-evaluator.ts (新文件)

import type { Entity } from "@/domain/types/entity";

/**
 * 求值公式字符串
 * 
 * 支持的语法：
 * - 属性引用: "target.ac", "target.dex_mod"
 * - 算术运算: "+", "-", "*", "/"
 * - 常量: 数字
 * - 简写: 纯属性名 "ac" 等价于 "target.ac"
 * 
 * 示例：
 * - "target.ac"                          → 直接读取目标 AC
 * - "10 + target.dex_mod + target.armor"  → 计算公式
 * - "8 + target.proficiency + target.wis_mod" → 法术 DC
 * 
 * 安全性：
 * - 不使用 eval()
 * - 仅支持有限的算术运算
 * - 属性引用仅从 entity.fields 中读取
 */
function evaluateFormula(formula: string, target: Entity): number {
  // 实现策略：
  // 1. 词法分析：拆分为 token（数字、属性引用、运算符）
  // 2. 属性替换：将 "target.xxx" 替换为实际数值
  // 3. 算术求值：简单的四则运算求值（或使用现有的 mathjs 等库）
  // ...
}
```

### 6.3 对抗检定执行器

```typescript
// src/lib/rules/opposed-check.ts (新文件)

import type { Entity } from "@/domain/types/entity";
import type { DiceRoll } from "@/domain/types/result-frame";

interface OpposedCheckInput {
  /** 主动方 */
  attacker: {
    entity: Entity;
    skill: string;
    modifier?: number;
  };
  /** 被动方 */
  defender: {
    entity: Entity;
    skill: string;
  };
}

interface OpposedCheckResult {
  /** 主动方掷骰 */
  attackerRoll: number;
  attackerModifier: number;
  attackerTotal: number;
  /** 被动方掷骰 */
  defenderRoll: number;
  defenderModifier: number;
  defenderTotal: number;
  /** 主动方是否成功（平局视为失败，D&D 规则） */
  success: boolean;
  /** 差值 = attackerTotal - defenderTotal */
  margin: number;
}

/**
 * 执行对抗检定
 * 
 * 规则（遵循 D&D 5e）：
 * 1. 双方各掷 1d20
 * 2. 各自加上对应技能/属性的修正值
 * 3. 比较总值，高者胜
 * 4. 平局时被动方（defender）胜（D&D 惯例）
 */
function executeOpposedCheck(input: OpposedCheckInput): OpposedCheckResult {
  const attackerRoll = rollD20();
  const attackerMod = getSkillModifier(input.attacker.entity, input.attacker.skill) 
                      + (input.attacker.modifier ?? 0);
  const attackerTotal = attackerRoll + attackerMod;
  
  const defenderRoll = rollD20();
  const defenderMod = getSkillModifier(input.defender.entity, input.defender.skill);
  const defenderTotal = defenderRoll + defenderMod;
  
  return {
    attackerRoll,
    attackerModifier: attackerMod,
    attackerTotal,
    defenderRoll,
    defenderModifier: defenderMod,
    defenderTotal,
    success: attackerTotal > defenderTotal,  // 平局 defender 胜
    margin: attackerTotal - defenderTotal,
  };
}
```

### 6.4 引擎集成

```typescript
// src/lib/rules/engine.ts — 修改 executeSkillCheck

async function executeSkillCheck(action: SkillCheckAction, context: ExecutionContext): Promise<void> {
  const resolvedDC = resolveDC(action, context.getEntity);
  
  if (resolvedDC.source === "opposed" && resolvedDC.opposed) {
    // ── 对抗检定路径 ──
    const result = executeOpposedCheck({
      attacker: {
        entity: context.getEntity(action.entity)!,
        skill: action.skill,
        modifier: action.modifier,
      },
      defender: {
        entity: resolvedDC.opposed.entity,
        skill: resolvedDC.opposed.skill,
      },
    });
    
    context.addCheckResult({
      checkType: action.type,
      skill: action.skill,
      roll: result.attackerRoll,
      modifier: result.attackerModifier,
      total: result.attackerTotal,
      dcSource: "opposed",
      opposedRoll: result.defenderRoll,
      opposedModifier: result.defenderModifier,
      opposedTotal: result.defenderTotal,
      opposedSkill: resolvedDC.opposed.skill,
      success: result.success,
      margin: result.margin,
    });
    
    // 执行成功/失败分支
    if (result.success && action.onSuccess) {
      await context.executeActions(action.onSuccess);
    } else if (!result.success && action.onFailure) {
      await context.executeActions(action.onFailure);
    }
    
  } else {
    // ── 固定 DC 路径（formula / fixed / ai）──
    const dc = resolvedDC.dc!;
    const entity = context.getEntity(action.entity)!;
    const roll = rollD20();
    const mod = getSkillModifier(entity, action.skill) + (action.modifier ?? 0);
    const total = roll + mod;
    const success = total >= dc;
    
    context.addCheckResult({
      checkType: action.type,
      skill: action.skill,
      roll,
      modifier: mod,
      total,
      dcSource: resolvedDC.source,
      dc,
      dcFormulaUsed: resolvedDC.formulaUsed,
      success,
      margin: total - dc,
    });
    
    if (success && action.onSuccess) {
      await context.executeActions(action.onSuccess);
    } else if (!success && action.onFailure) {
      await context.executeActions(action.onFailure);
    }
  }
}
```

---

## 7. AI Schema 引导

### 7.1 Action Schema 更新

在 `action-schemas.ts` 中更新 `skillCheck` 的 schema，引导 AI 选择合适的 `dcSource`：

```typescript
// src/lib/ai/action-schemas.ts — skillCheck 部分

const skillCheckSchema = {
  type: "skillCheck",
  description: "执行技能检定",
  properties: {
    // ...现有字段...
    
    dcSource: {
      type: "string",
      enum: ["formula", "opposed", "fixed", "ai"],
      description: `DC 来源，选择最合适的方式：
        - "formula": 可从目标属性计算的 DC（如攻击 → DC = 目标 AC）。需提供 targetEntity + dcFormula。
        - "opposed": 对抗检定，双方掷骰比较（如偷窃 → 巧手 vs 察觉）。需提供 opposedEntity + opposedSkill。
        - "fixed": 固定 DC（如已知难度的陷阱）。需提供 fixedDC。
        - "ai": 需要根据情境判断的 DC（如说服难度取决于 NPC 态度）。需提供 dc。
        
        选择建议：
        - 攻击/法术 → 使用 "formula"
        - 偷窃/潜行/欺骗/擒抱 → 使用 "opposed"
        - 翻越障碍/撬锁等环境检定 → 使用 "ai"
        - 数据卡明确标注 DC 的效果 → 使用 "fixed"
        
        默认: "ai"`,
    },
    
    // formula 相关
    targetEntity: {
      type: "string",
      description: "目标实体 ID（dcSource='formula' 或 'opposed' 时需要）",
    },
    dcFormula: {
      type: "string",
      description: "DC 计算公式，引用目标实体的属性（dcSource='formula' 时需要）。例: 'target.ac'",
    },
    
    // opposed 相关
    opposedEntity: {
      type: "string",
      description: "对抗目标实体 ID（dcSource='opposed' 时需要）",
    },
    opposedSkill: {
      type: "string",
      description: "对抗目标使用的技能/属性（dcSource='opposed' 时需要）",
    },
    
    // fixed 相关
    fixedDC: {
      type: "number",
      description: "固定 DC 值（dcSource='fixed' 时需要）",
    },
    
    // ai 相关（现有字段）
    dc: {
      type: "number",
      description: "AI 判定的 DC 值（dcSource='ai' 或未指定 dcSource 时需要）",
    },
  },
};
```

### 7.2 对 AI 行为的影响

引入 `dcSource` 后，AI 的行为变化：

**之前：**
```json
{
  "type": "skillCheck",
  "entity": "player",
  "skill": "attack",
  "dc": 15,
  "onSuccess": [...],
  "onFailure": [...]
}
```
AI 需要自己看目标的 AC 是多少，然后手动写 dc=15。不仅浪费 token，还可能写错。

**之后：**
```json
{
  "type": "skillCheck",
  "entity": "player",
  "skill": "attack",
  "dcSource": "formula",
  "targetEntity": "goblin_1",
  "dcFormula": "target.ac",
  "onSuccess": [...],
  "onFailure": [...]
}
```
AI 只需要指明"攻击目标是谁"，DC 由引擎从目标的 AC 属性自动计算。

**偷窃示例：**
```json
{
  "type": "skillCheck",
  "entity": "player",
  "skill": "sleight_of_hand",
  "dcSource": "opposed",
  "opposedEntity": "merchant",
  "opposedSkill": "perception",
  "onSuccess": [
    { "type": "grantItem", "target": "player", "templateId": "gold_pouch", ... }
  ],
  "onFailure": [
    { "type": "addTag", "target": "player", "tag": "caught_stealing", ... }
  ]
}
```

---

## 8. UI 驱动的对抗性操作

### 8.1 与装备系统方案的衔接

装备系统方案中预留了**操作缓冲区**机制（见 equipment-system-and-dual-pipeline.md §2.4）。

DC 分层方案使得 UI 驱动的对抗性操作成为可能：

```
玩家在 UI 上点击 NPC → 选择"偷窃"
  │
  ▼
构造操作请求（不经过 Parser AI）
  {
    type: "skillCheck",
    entity: "player",
    skill: "sleight_of_hand",
    dcSource: "opposed",
    opposedEntity: "merchant",
    opposedSkill: "perception",
    onSuccess: [...],
    onFailure: [...]
  }
  │
  ▼
规则引擎直接处理：
  - 读取玩家 巧手 修正
  - 读取商人 察觉 修正
  - 双方掷骰
  - 比较结果
  - 执行 onSuccess / onFailure
  - 生成 ResultFrame
  │
  ▼
将 ResultFrame 缓冲，随下次发送一并送入叙事 AI：
  "你趁商人不注意，手指灵巧地探向他的钱袋..."
  或 "你的手刚伸出去，商人猛然回头，死死盯着你的手..."
```

**关键区别**：与确定型操作（装备/卸下）不同，对抗性操作的结果有剧情意义（成功/失败会影响后续剧情），因此需要叙事 AI 介入。但 DC 计算不需要 AI，叙事生成才需要。

### 8.2 操作流程对比

| 步骤 | 确定型（装备） | 对抗型（偷窃）via UI | 情境型（说服）via 文字 |
|------|-------------|-------------------|--------------------|
| 意图来源 | UI 点击 | UI 点击 | 玩家文字输入 |
| 意图解析 | 无需 | 无需 | Parser AI |
| DC 来源 | 无需 DC | 公式/对抗（引擎算） | AI 判定 |
| 规则执行 | 直接执行 | 规则引擎掷骰 | 规则引擎掷骰 |
| 叙事生成 | 无 | 缓冲 → 随下次发送 | Narrative AI |
| AI 感知 | 状态快照 | ResultFrame + 状态快照 | ResultFrame |

---

## 9. WorldConfig 扩展

### 9.1 DC 公式注册

为了让引擎知道哪些操作可以用公式计算 DC，可以在 WorldConfig 中注册常用公式：

```typescript
// WorldConfig 中的可选扩展

interface WorldConfig {
  // ...现有字段...
  
  /**
   * 检定规则配置（可选）
   * 
   * 定义常用检定的 DC 来源和公式。
   * 引擎和 AI Schema 都可以引用这些预定义规则。
   */
  checkRules?: {
    /**
     * 预定义的 DC 公式
     * key: 操作标识（如 "melee_attack", "ranged_attack", "spell_save"）
     * value: DC 解析配置
     */
    dcPresets?: Record<string, DCPreset>;
    
    /**
     * 预定义的对抗检定
     * key: 操作标识（如 "steal", "stealth", "grapple"）
     * value: 对抗配置
     */
    opposedPresets?: Record<string, OpposedPreset>;
  };
}

interface DCPreset {
  /** 人类可读的描述 */
  label: string;
  /** DC 公式 */
  formula: string;
  /** 默认使用的技能 */
  defaultSkill?: string;
}

interface OpposedPreset {
  /** 人类可读的描述 */
  label: string;
  /** 主动方默认技能 */
  attackerSkill: string;
  /** 被动方默认技能 */
  defenderSkill: string;
}
```

**示例 WorldConfig：**

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
        "formula": "8 + caster.proficiency + caster.spellcasting_mod",
        "defaultSkill": "varies"
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
    }
  }
}
```

### 9.2 AI 使用预设的简化写法

有了预设后，AI 可以更简洁地描述检定：

```json
{
  "type": "skillCheck",
  "entity": "player",
  "preset": "steal",
  "opposedEntity": "merchant",
  "onSuccess": [...],
  "onFailure": [...]
}
```

引擎自动从 `opposedPresets.steal` 中读取 `attackerSkill` 和 `defenderSkill`，AI 不需要每次都重复写技能名称。

---

## 10. 实施路线

### 10.1 与装备系统方案的关系

DC 分层方案与装备系统方案是**并行独立**的。装备系统专注于确定型操作（轻量管线），DC 分层专注于仲裁型操作的 DC 解析优化。两者可以独立推进。

但存在依赖关系：
- DC 分层中的 `formula` 模式依赖**统一属性计算**（装备系统方案 P0），因为公式需要读取的属性值必须包含装备加成
- UI 驱动的对抗性操作依赖**轻量管线框架**（装备系统方案 P2），作为入口

### 10.2 分阶段实施

#### Phase A: 数据模型（与装备系统 P1 同步）— 预计 1 天

- [ ] `SkillCheckAction` 增加 `dcSource` 及相关字段
- [ ] `CheckResult` 增加 `dcSource`、对抗检定结果字段
- [ ] 确保 `dcSource` 默认为 `"ai"`（向后兼容）

#### Phase B: 引擎实现 — 预计 2-3 天

- [ ] 实现 `dc-resolver.ts`（DC 解析器）
- [ ] 实现 `formula-evaluator.ts`（公式求值器）
- [ ] 实现 `opposed-check.ts`（对抗检定执行器）
- [ ] 修改 `engine.ts` 中的 `executeSkillCheck`，集成 DC 解析器
- [ ] 单元测试：各种 dcSource 的正确性

#### Phase C: AI Schema 更新 — 预计 0.5 天

- [ ] 更新 `action-schemas.ts` 中的 skillCheck schema
- [ ] 添加 dcSource 的选择引导注释
- [ ] 测试 AI 是否能正确使用 dcSource

#### Phase D: WorldConfig 预设（可选）— 预计 1 天

- [ ] WorldConfig 类型增加 `checkRules` 字段
- [ ] 引擎支持从预设读取 DC 配置
- [ ] AI Schema 支持 `preset` 简写

#### Phase E: UI 驱动对抗操作（后续）— 与装备系统 P4 协同

- [ ] UI 交互设计（NPC 右键菜单 → 偷窃/攻击等）
- [ ] 操作缓冲区实现
- [ ] 缓冲操作随发送按钮注入 IRNR 管线

---

## 11. 风险与注意事项

### 11.1 公式安全性

`formula-evaluator.ts` 不能使用 `eval()`。需要实现安全的表达式解析器，仅支持：
- 属性引用（从 entity.fields 读取）
- 四则运算（+、-、*、/）
- 数字常量

### 11.2 AI 的适应性

引入 `dcSource` 后，AI 需要一定时间适应新的 schema。初期可能：
- 忘记指定 dcSource（→ 默认 "ai"，向后兼容）
- 错误指定 dcSource（→ 引擎 validate 时报错，fallback 到 "ai"）
- 混合使用（→ 可接受，渐进迁移）

建议在 Action Schema 的注释中给出清晰的选择指南，而非强制。

### 11.3 属性名称一致性

公式中引用的属性名（如 `target.ac`、`target.dex_mod`）必须与 WorldConfig 中定义的属性 ID 一致。这依赖于：
- WorldConfig 中 `primaryAttributes` 和 `derivedStats` 的 ID 命名规范
- Entity 的 fields 中使用相同的 key

如果 WorldConfig 用中文 ID（如 `"力量"`），公式也需要用中文：`"target.力量"`。这可能不太优雅，但保持了一致性。

### 11.4 对抗检定的叙事处理

对抗检定涉及双方掷骰，叙事 AI 需要能看到双方的结果。`CheckResult` 中的 `opposedRoll`、`opposedTotal` 等字段会包含在 ResultFrame 中，叙事 AI 可以据此描写对抗过程。

---

## 附录 A：与现有系统的对比

| 维度 | 当前系统 | 改进后 |
|------|---------|-------|
| 攻击 DC | AI 判定（可能不一致） | 自动从目标 AC 计算 |
| 偷窃/潜行 | AI 设固定 DC | 对抗检定（双方掷骰） |
| 说服/交涉 | AI 判定 | AI 判定（不变） |
| AI token 消耗 | 每个 check 都需要输出 DC | 仅情境性 check 需要 |
| DC 一致性 | 依赖 AI 记忆 | 公式保证一致 |
| UI 驱动对抗操作 | 不可能 | 可以（对抗检定不需要 AI 设 DC） |

## 附录 B：D&D 5e 标准难度等级参考

| 难度 | DC | 适用场景举例 |
|------|-----|------------|
| 极易（Very Easy） | 5 | 普通人也能轻松完成 |
| 简单（Easy） | 10 | 稍有能力的人能完成 |
| 中等（Medium） | 15 | 需要一定专业能力 |
| 困难（Hard） | 20 | 需要出色的能力 |
| 极难（Very Hard） | 25 | 只有顶尖高手能完成 |
| 近乎不可能（Nearly Impossible） | 30 | 传说级别的壮举 |

这个参考表可以作为提示词的一部分提供给 AI，帮助其在 `dcSource: "ai"` 时设定合理的 DC。
