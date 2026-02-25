/**
 * 装备面板组件
 *
 * 在角色面板中按 WorldConfig 定义的装备槽位展示已装备物品，
 * 支持直接卸下操作。
 */

import { motion } from "framer-motion";
import {
  Boxes,
  FlaskConical,
  Gem,
  HelpCircle,
  ScrollText,
  Shield,
  Sword,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import type { ItemCategory, ItemInstance } from "@/domain/entities/item";
import type { DirectAction } from "@/domain/types";
import type { PassiveModifier } from "@/domain/types/rule-script";
import type { WorldConfig } from "@/lib/world";
import { directActionService } from "@/modules/game/services";
import { useInventoryStore } from "@/modules/inventory/store";
import { color, colorAlpha, glow } from "@/styles/tokens";

const EMPTY_ITEMS: ItemInstance[] = [];

const ACTION_BUTTON_CLASS_NAME =
  "inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium leading-none transition-all duration-150 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-55";

const easeOut = [0.0, 0.0, 0.2, 1.0] as const;

const sectionVariants = {
  hidden: { opacity: 0, y: 15 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: 0.1 + i * 0.08,
      duration: 0.3,
      ease: easeOut,
    },
  }),
};

interface EquipmentSectionProps {
  characterId: string;
  worldConfig: WorldConfig;
  /** 动画序号，与 CharacterPanel 中其他 Section 的 custom 值衔接 */
  animationIndex?: number;
}

function getCategoryIcon(category: ItemCategory) {
  switch (category) {
    case "weapon":
      return <Sword className="w-3.5 h-3.5" />;
    case "armor":
      return <Shield className="w-3.5 h-3.5" />;
    case "accessory":
      return <Gem className="w-3.5 h-3.5" />;
    case "consumable":
      return <FlaskConical className="w-3.5 h-3.5" />;
    case "material":
      return <Boxes className="w-3.5 h-3.5" />;
    case "quest":
      return <ScrollText className="w-3.5 h-3.5" />;
    case "misc":
    default:
      return <HelpCircle className="w-3.5 h-3.5" />;
  }
}

function formatModifierValue(value: PassiveModifier["value"]): string {
  if (typeof value === "number") {
    return value > 0 ? `+${value}` : `${value}`;
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  return "";
}

function formatModifier(modifier: PassiveModifier): string {
  switch (modifier.scope) {
    case "stat": {
      const field = modifier.field ?? "属性";
      const valueText = formatModifierValue(modifier.value);
      return valueText ? `${field}${valueText}` : `${field}调整`;
    }
    case "check": {
      const valueText = formatModifierValue(modifier.value);
      const base = valueText ? `检定${valueText}` : "检定修正";
      return modifier.filter ? `${base}（${modifier.filter}）` : base;
    }
    case "damage_dealt": {
      if (typeof modifier.multiplier === "number") {
        return `造成伤害×${modifier.multiplier}`;
      }
      const valueText = formatModifierValue(modifier.value);
      return valueText ? `造成伤害${valueText}` : "造成伤害修正";
    }
    case "damage_taken": {
      if (typeof modifier.multiplier === "number") {
        return `承受伤害×${modifier.multiplier}`;
      }
      const valueText = formatModifierValue(modifier.value);
      return valueText ? `承受伤害${valueText}` : "承受伤害修正";
    }
    default:
      return "被动修正";
  }
}

function getItemEffectLines(item: ItemInstance): string[] {
  const lines: string[] = [];

  for (const effect of item.effects ?? []) {
    if (effect.type === "modifier" && effect.modifiers) {
      for (const modifier of effect.modifiers) {
        const line =
          modifier.reason?.trim().length > 0
            ? modifier.reason
            : formatModifier(modifier);

        if (line.trim().length > 0) {
          lines.push(line.trim());
        }
      }
    }

    const description = effect.description?.trim();
    if (description && description.length > 0) {
      lines.push(description);
    }
  }

  return Array.from(new Set(lines));
}

export function EquipmentSection({
  characterId,
  worldConfig,
  animationIndex = 4,
}: EquipmentSectionProps) {
  const items = useInventoryStore((s) => s.items[characterId] ?? EMPTY_ITEMS);
  const slotDefinitions =
    worldConfig.inventoryRules?.equipSlotDefinitions ?? [];

  const equippedBySlot = useMemo(() => {
    const bySlot = new Map<string, ItemInstance[]>();

    for (const item of items) {
      if (!item.equipped || !item.equipSlot) {
        continue;
      }

      const current = bySlot.get(item.equipSlot);
      if (current) {
        current.push(item);
      } else {
        bySlot.set(item.equipSlot, [item]);
      }
    }

    return bySlot;
  }, [items]);

  const [submittingItemId, setSubmittingItemId] = useState<string | null>(null);
  const isSubmitting = submittingItemId !== null;

  const runDirectAction = useCallback(
    async (action: DirectAction, actionLabel: string) => {
      const instanceId = action.payload.instanceId as string;
      setSubmittingItemId(instanceId);

      try {
        const result = await directActionService.execute(action);
        if (!result.success) {
          console.warn(
            `[EquipmentSection] ${actionLabel} failed:`,
            result.error,
          );
        }
      } finally {
        setSubmittingItemId((current) =>
          current === instanceId ? null : current,
        );
      }
    },
    [],
  );

  const handleUnequipItem = useCallback(
    async (item: ItemInstance) => {
      await runDirectAction(
        {
          type: "unequip_item",
          actorId: characterId,
          payload: { instanceId: item.instanceId },
        },
        "卸下",
      );
    },
    [characterId, runDirectAction],
  );

  return (
    <motion.div
      custom={animationIndex}
      variants={sectionVariants}
      initial="hidden"
      animate="visible"
    >
      <div
        className="flex items-center gap-2 mb-3"
        style={{
          borderBottom: `1px solid ${colorAlpha("primary", 0.15)}`,
          paddingBottom: "0.5rem",
        }}
      >
        <span style={{ color: color("primary") }}>
          <Shield className="w-4 h-4" />
        </span>
        <h3
          className="text-sm font-semibold uppercase tracking-wider"
          style={{ color: color("primary") }}
        >
          装备
        </h3>
      </div>

      {slotDefinitions.length === 0 ? (
        <p
          className="text-xs pl-1 py-2"
          style={{ color: colorAlpha("textMuted", 0.6) }}
        >
          当前世界未配置装备系统
        </p>
      ) : (
        <div className="space-y-2 pl-1">
          {slotDefinitions.map((slotDefinition) => {
            const equippedItems =
              equippedBySlot.get(slotDefinition.id) ?? EMPTY_ITEMS;

            return (
              <div
                key={slotDefinition.id}
                className="rounded-md overflow-hidden"
                style={{
                  background: colorAlpha("primary", 0.03),
                  border: `1px solid ${colorAlpha("primary", 0.12)}`,
                }}
              >
                <div
                  className="px-2 py-1.5 flex items-center gap-2"
                  style={{
                    background: colorAlpha("primary", 0.06),
                    borderBottom: `1px solid ${colorAlpha("primary", 0.1)}`,
                  }}
                >
                  <span
                    className="text-xs font-semibold"
                    style={{ color: color("primary") }}
                  >
                    {slotDefinition.label}
                  </span>
                  {(slotDefinition.maxCount ?? 1) > 1 && (
                    <span
                      className="text-[11px] px-1 py-0.5 rounded"
                      style={{
                        background: colorAlpha("secondary", 0.12),
                        color: color("secondary"),
                      }}
                    >
                      x{slotDefinition.maxCount}
                    </span>
                  )}
                </div>

                <div className="px-2 py-2">
                  {equippedItems.length === 0 ? (
                    <p
                      className="text-xs"
                      style={{ color: colorAlpha("textMuted", 0.55) }}
                    >
                      (空槽位)
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {equippedItems.map((item, index) => {
                        const effectLines = getItemEffectLines(item);
                        const effectText =
                          effectLines.length > 0
                            ? effectLines.join(" / ")
                            : "无特殊效果";
                        const isSubmittingCurrentItem =
                          submittingItemId === item.instanceId;

                        return (
                          <div
                            key={item.instanceId}
                            className={
                              index < equippedItems.length - 1
                                ? "pb-2"
                                : undefined
                            }
                            style={
                              index < equippedItems.length - 1
                                ? {
                                    borderBottom: `1px solid ${colorAlpha("primary", 0.08)}`,
                                  }
                                : undefined
                            }
                          >
                            <div className="flex items-start gap-2">
                              <span
                                className="shrink-0 mt-0.5"
                                style={{ color: color("secondary") }}
                              >
                                {getCategoryIcon(item.category)}
                              </span>

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span
                                    className="text-sm font-semibold"
                                    style={{
                                      color: color("textPrimary"),
                                      textShadow: glow("secondary", "sm", 0.3),
                                    }}
                                  >
                                    {item.name}
                                  </span>
                                  {item.quantity > 1 && (
                                    <span
                                      className="text-xs"
                                      style={{ color: color("textMuted") }}
                                    >
                                      x{item.quantity}
                                    </span>
                                  )}
                                </div>

                                <p
                                  className="text-xs mt-1 leading-relaxed"
                                  style={{
                                    color:
                                      effectLines.length > 0
                                        ? colorAlpha("textMuted", 0.72)
                                        : colorAlpha("textMuted", 0.58),
                                  }}
                                >
                                  {effectText}
                                </p>
                              </div>

                              <button
                                type="button"
                                className={ACTION_BUTTON_CLASS_NAME}
                                style={{
                                  background: colorAlpha("secondary", 0.12),
                                  color: color("secondary"),
                                  border: `1px solid ${colorAlpha("secondary", 0.24)}`,
                                }}
                                onClick={() => {
                                  void handleUnequipItem(item);
                                }}
                                disabled={isSubmitting}
                              >
                                <Shield className="w-3 h-3" />
                                <span>
                                  {isSubmittingCurrentItem
                                    ? "处理中..."
                                    : "卸下"}
                                </span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
