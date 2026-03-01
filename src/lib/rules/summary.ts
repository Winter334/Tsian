/**
 * mechanicSummary 生成器
 *
 * 根据规则引擎执行收集的检定、骰子、状态变更，
 * 生成结构化的中文机制摘要文本，供正文 AI 扩写使用。
 */

import type {
  Check,
  DiceRoll,
  StructuralChange,
  ValueChange,
} from "@/domain/types";
import type { SummaryLine } from "./engine";

// ─── NPC 摘要条目 ─────────────────────────────────────────

/** NPC 操作的摘要条目，供 mechanicSummary 使用 */
export interface NpcSummaryEntry {
  /** 操作类型 */
  type: "create" | "statusChange" | "action";
  /** NPC 实体 ID */
  npcId: string;
  /** NPC 名称 */
  npcName: string;
  /** 详细信息（描述/状态变更/行动意图） */
  detail: string;
}

// ─── 输入接口 ─────────────────────────────────────────────

export interface MechanicSummaryInput {
  checks: readonly Check[];
  diceRolls: readonly DiceRoll[];
  valueChanges: readonly ValueChange[];
  /** NPC 操作摘要条目 */
  npcSummaryEntries?: readonly NpcSummaryEntry[];
  /** 结构化变更（物品/技能增减） */
  structuralChanges?: readonly StructuralChange[];
  /** 有序摘要行（优先使用，为空时回退到分类渲染） */
  summaryLines?: readonly SummaryLine[];
}

export function generateMechanicSummary(
  input: MechanicSummaryInput,
  entityDisplayNames?: Map<string, string>,
): string {
  // 优先使用有序时间线摘要
  if (input.summaryLines && input.summaryLines.length > 0) {
    const result = input.summaryLines
      .map((line) => (line.indent > 0 ? `  → ${line.text}` : line.text))
      .join("\n");
    return result;
  }

  // ── 回退：分类渲染（向后兼容） ──
  const lines: string[] = [];

  // 检定结果
  if (input.checks.length > 0) {
    for (const check of input.checks) {
      const result = check.success ? "成功" : "失败";
      const dcPart =
        check.dcSource === "opposed"
          ? (() => {
              const opposedSkillText = check.opposedSkill ?? "unknown";

              if (
                typeof check.opposedRoll === "number" &&
                typeof check.opposedModifier === "number" &&
                typeof check.opposedTotal === "number"
              ) {
                const opposedModifierText =
                  check.opposedModifier >= 0
                    ? `+${check.opposedModifier}`
                    : `${check.opposedModifier}`;
                return ` vs 对抗(${opposedSkillText}) ${check.opposedRoll}${opposedModifierText}=${check.opposedTotal}`;
              }

              return typeof check.opposedTotal === "number"
                ? ` vs 对抗(${opposedSkillText}) ${check.opposedTotal}`
                : "";
            })()
          : typeof check.dc === "number"
            ? ` vs DC ${check.dc}`
            : "";
      const marginPart = `（余量 ${check.margin >= 0 ? "+" : ""}${check.margin}）`;
      lines.push(
        `${check.name}：${check.roll}+${check.modifier}=${check.total}${dcPart}，${result}${marginPart}。`,
      );
    }
  }

  // NPC 操作摘要
  if (input.npcSummaryEntries && input.npcSummaryEntries.length > 0) {
    for (const entry of input.npcSummaryEntries) {
      switch (entry.type) {
        case "create":
          lines.push(`NPC「${entry.npcName}」加入场景。`);
          break;
        case "statusChange":
          lines.push(`NPC「${entry.npcName}」状态变更: ${entry.detail}。`);
          break;
        case "action":
          lines.push(`NPC「${entry.npcName}」: ${entry.detail}。`);
          break;
      }
    }
  }

  // 状态变更（跳过 NPC 创建相关的 valueChange，避免重复）
  if (input.valueChanges.length > 0) {
    for (const change of input.valueChanges) {
      // 跳过 NPC 创建的 valueChange（已在 NPC 摘要中处理）
      if (change.field === "npc.create") continue;

      // 使用语义别名替换 UUID
      const displayId =
        entityDisplayNames?.get(change.entityId) ?? change.entityId;

      if (typeof change.delta === "number" && change.delta !== 0) {
        const sign = change.delta >= 0 ? "+" : "";
        const reason = change.reason ? `（${change.reason}）` : "";
        lines.push(
          `${displayId}.${change.field}：${change.oldValue} → ${change.newValue}（${sign}${change.delta}）${reason}`,
        );
      } else if (
        typeof change.oldValue === "boolean" ||
        typeof change.newValue === "boolean"
      ) {
        // 标签变更
        const reason = change.reason ? `（${change.reason}）` : "";
        lines.push(
          `${displayId}.${change.field}：${change.oldValue} → ${change.newValue}${reason}`,
        );
      } else {
        const reason = change.reason ? `（${change.reason}）` : "";
        lines.push(
          `${displayId}.${change.field}：${change.oldValue} → ${change.newValue}${reason}`,
        );
      }
    }
  }

  // 结构化变更（物品/技能）
  if (input.structuralChanges && input.structuralChanges.length > 0) {
    for (const change of input.structuralChanges) {
      // 跳过失败的变更
      if (change.details?.failed === true) continue;

      const name =
        typeof change.details?.name === "string"
          ? change.details.name
          : change.entityId;
      const quantity =
        typeof change.details?.quantity === "number"
          ? change.details.quantity
          : 1;

      switch (change.type) {
        case "item_added":
          lines.push(`获得物品: ${name}${quantity > 1 ? ` x${quantity}` : ""}`);
          break;
        case "item_removed":
          lines.push(`失去物品: ${name}${quantity > 1 ? ` x${quantity}` : ""}`);
          break;
        case "item_used":
          lines.push(`使用物品: ${name} ×${quantity} (${change.targetId})`);
          break;
        case "skill_learned":
          lines.push(`习得技能: ${name}`);
          break;
        case "skill_removed":
          lines.push(`遗忘技能: ${name}`);
          break;
      }
    }
  }

  if (lines.length === 0) {
    return "无需结算";
  }

  return lines.join(" ");
}
