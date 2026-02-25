/**
 * 背包物品列表组件
 *
 * 在角色面板中展示指定角色的物品列表
 * 支持装备/卸下/使用/丢弃等交互操作
 */

import { motion } from "framer-motion";
import {
  Boxes,
  FlaskConical,
  Gem,
  HelpCircle,
  Package,
  ScrollText,
  Shield,
  Sword,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import type { ItemCategory, ItemInstance } from "@/domain/entities/item";
import type { DirectAction } from "@/domain/types";
import type { WorldConfig } from "@/lib/world";
import { directActionService } from "@/modules/game/services";
import { useInventoryStore } from "@/modules/inventory/store";
import { color, colorAlpha, glow } from "@/styles/tokens";

// ── 稳定引用：避免 selector 中 `?? []` 每次创建新数组导致无限循环 ──
const EMPTY_ITEMS: ItemInstance[] = [];

// ── 类别中文映射 ──

const CATEGORY_LABELS: Record<ItemCategory, string> = {
  weapon: "武器",
  armor: "护甲",
  accessory: "饰品",
  consumable: "消耗品",
  material: "素材",
  quest: "任务物品",
  misc: "杂物",
};

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

function isEquippableItem(item: ItemInstance): boolean {
  return (
    Boolean(item.equipSlot) ||
    item.category === "weapon" ||
    item.category === "armor" ||
    item.category === "accessory"
  );
}

const ACTION_BUTTON_CLASS_NAME =
  "inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium leading-none transition-all duration-150 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-55";

// ── 动画 ──

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

// ── 组件 ──

interface InventorySectionProps {
  characterId: string;
  worldConfig: WorldConfig;
  /** 动画序号，与 CharacterPanel 中其他 Section 的 custom 值衔接 */
  animationIndex?: number;
}

export function InventorySection({
  characterId,
  worldConfig,
  animationIndex = 4,
}: InventorySectionProps) {
  const items = useInventoryStore((s) => s.items[characterId] ?? EMPTY_ITEMS);
  const equipSlotDefinitions =
    worldConfig.inventoryRules?.equipSlotDefinitions ?? [];
  const equipSlotLabelMap = new Map(
    equipSlotDefinitions.map((slotDefinition) => [
      slotDefinition.id,
      slotDefinition.label,
    ]),
  );

  const [confirmDiscardItemId, setConfirmDiscardItemId] = useState<
    string | null
  >(null);
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
            `[InventorySection] ${actionLabel} failed:`,
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

  const handleEquipItem = useCallback(
    async (item: ItemInstance) => {
      setConfirmDiscardItemId(null);
      await runDirectAction(
        {
          type: "equip_item",
          actorId: characterId,
          payload: { instanceId: item.instanceId },
        },
        "装备",
      );
    },
    [characterId, runDirectAction],
  );

  const handleUnequipItem = useCallback(
    async (item: ItemInstance) => {
      setConfirmDiscardItemId(null);
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

  const handleUseItem = useCallback(
    async (item: ItemInstance) => {
      setConfirmDiscardItemId(null);

      // 检查是否需要选择目标（包含 $target 占位符的消耗品）
      const needsTargetSelection =
        item.effects?.some((effect) =>
          effect.onUse?.some(
            (action) => "target" in action && action.target === "$target",
          ),
        ) ?? false;

      if (needsTargetSelection) {
        // 需要选择目标的消耗品暂不支持（未来通过目标选择弹窗实现）
        console.warn("[InventorySection] 该消耗品需要选择目标，暂不支持");
        return;
      }

      // self 目标或无目标的消耗品：targetId 默认为自身
      await runDirectAction(
        {
          type: "use_item",
          actorId: characterId,
          payload: {
            instanceId: item.instanceId,
            targetId: characterId,
          },
        },
        "使用",
      );
    },
    [characterId, runDirectAction],
  );

  const handleDiscardItem = useCallback(
    async (item: ItemInstance) => {
      if (item.equipped) {
        return;
      }

      if (confirmDiscardItemId !== item.instanceId) {
        setConfirmDiscardItemId(item.instanceId);
        return;
      }

      setConfirmDiscardItemId(null);
      await runDirectAction(
        {
          type: "drop_item",
          actorId: characterId,
          payload: { instanceId: item.instanceId },
        },
        "丢弃",
      );
    },
    [characterId, confirmDiscardItemId, runDirectAction],
  );

  useEffect(() => {
    if (!confirmDiscardItemId) {
      return;
    }

    const stillExists = items.some(
      (item) => item.instanceId === confirmDiscardItemId,
    );

    if (!stillExists) {
      setConfirmDiscardItemId(null);
    }
  }, [confirmDiscardItemId, items]);

  return (
    <motion.div
      custom={animationIndex}
      variants={sectionVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Section 标题 — 与现有 SectionTitle 样式完全一致 */}
      <div
        className="flex items-center gap-2 mb-3"
        style={{
          borderBottom: `1px solid ${colorAlpha("primary", 0.15)}`,
          paddingBottom: "0.5rem",
        }}
      >
        <span style={{ color: color("primary") }}>
          <Package className="w-4 h-4" />
        </span>
        <h3
          className="text-sm font-semibold uppercase tracking-wider"
          style={{ color: color("primary") }}
        >
          背包
        </h3>
      </div>

      {/* 物品列表 */}
      {items.length === 0 ? (
        <p
          className="text-xs pl-1 py-2"
          style={{ color: colorAlpha("textMuted", 0.6) }}
        >
          暂无物品
        </p>
      ) : (
        <div className="space-y-2 pl-1">
          {items.map((item) => {
            const canEquip = !item.equipped && isEquippableItem(item);
            const canUnequip = item.equipped;
            const canUse = item.category === "consumable";
            const canDiscard = !item.equipped;
            const hasActions = canEquip || canUnequip || canUse || canDiscard;
            const hasDetails =
              Boolean(item.description) ||
              Boolean(item.equipSlot) ||
              item.equipped ||
              hasActions;
            const isConfirmingDiscard =
              confirmDiscardItemId === item.instanceId;
            const isSubmittingCurrentItem =
              submittingItemId === item.instanceId;

            return (
              <div
                key={item.instanceId}
                className="rounded-md px-2 py-1.5 transition-colors duration-150"
                style={{
                  background: colorAlpha("primary", 0.04),
                  border: `1px solid ${colorAlpha("primary", 0.08)}`,
                }}
              >
                {/* 名称、数量、类别图标、装备标记 */}
                <div className="flex items-center gap-2">
                  {/* 类别图标 */}
                  <span
                    className="shrink-0"
                    style={{
                      color: item.equipped
                        ? color("secondary")
                        : color("primary"),
                    }}
                  >
                    {getCategoryIcon(item.category)}
                  </span>

                  {/* 信息 */}
                  <div className="flex-1 min-w-0 flex items-center gap-1.5">
                    <span
                      className="text-sm font-semibold"
                      style={{
                        color: color("textPrimary"),
                        textShadow: item.equipped
                          ? glow("secondary", "sm", 0.3)
                          : undefined,
                      }}
                    >
                      {item.name}
                    </span>

                    {/* 数量 */}
                    {item.quantity > 1 && (
                      <span
                        className="text-xs"
                        style={{ color: color("textMuted") }}
                      >
                        x{item.quantity}
                      </span>
                    )}

                    {/* 已装备标记 */}
                    {item.equipped && (
                      <span
                        className="text-xs px-1 py-0.5 rounded"
                        style={{
                          background: colorAlpha("secondary", 0.12),
                          color: color("secondary"),
                        }}
                      >
                        已装备
                      </span>
                    )}

                    {/* 类别文字 */}
                    <span
                      className="text-xs ml-auto hidden sm:inline"
                      style={{ color: colorAlpha("textMuted", 0.5) }}
                    >
                      {CATEGORY_LABELS[item.category] ?? item.category}
                    </span>
                  </div>
                </div>

                {/* 详细信息 — 始终显示 */}
                {hasDetails && (
                  <div
                    className="mt-2 pt-2 ml-5.5 space-y-1.5"
                    style={{
                      borderTop: `1px solid ${colorAlpha("primary", 0.1)}`,
                    }}
                  >
                    {/* 描述 */}
                    {item.description && (
                      <p
                        className="text-xs leading-relaxed"
                        style={{ color: colorAlpha("textMuted", 0.7) }}
                      >
                        {item.description}
                      </p>
                    )}

                    {/* 装备位置 */}
                    {item.equipSlot && (
                      <div className="flex items-center gap-2">
                        <span
                          className="text-xs"
                          style={{ color: colorAlpha("textMuted", 0.5) }}
                        >
                          装备位置
                        </span>
                        <span
                          className="text-xs font-medium px-1.5 py-0.5 rounded"
                          style={{
                            background: colorAlpha("primary", 0.1),
                            color: color("primary"),
                          }}
                        >
                          {equipSlotLabelMap.get(item.equipSlot) ??
                            item.equipSlot}
                        </span>
                      </div>
                    )}

                    {/* 装备状态文字 */}
                    {item.equipped !== undefined && (
                      <div className="flex items-center gap-2">
                        <span
                          className="text-xs"
                          style={{ color: colorAlpha("textMuted", 0.5) }}
                        >
                          状态
                        </span>
                        <span
                          className="text-xs font-medium"
                          style={{
                            color: item.equipped
                              ? color("secondary")
                              : colorAlpha("textMuted", 0.6),
                          }}
                        >
                          {item.equipped ? "✦ 已装备" : "未装备"}
                        </span>
                      </div>
                    )}

                    {/* 操作按钮 */}
                    {hasActions && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                        {canEquip && (
                          <button
                            type="button"
                            className={ACTION_BUTTON_CLASS_NAME}
                            style={{
                              background: colorAlpha("primary", 0.1),
                              color: color("primary"),
                              border: `1px solid ${colorAlpha("primary", 0.22)}`,
                            }}
                            onClick={() => {
                              void handleEquipItem(item);
                            }}
                            disabled={isSubmitting}
                          >
                            <Sword className="w-3 h-3" />
                            <span>
                              {isSubmittingCurrentItem ? "处理中..." : "装备"}
                            </span>
                          </button>
                        )}

                        {canUnequip && (
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
                              {isSubmittingCurrentItem ? "处理中..." : "卸下"}
                            </span>
                          </button>
                        )}

                        {canUse && (
                          <button
                            type="button"
                            className={ACTION_BUTTON_CLASS_NAME}
                            style={{
                              background: colorAlpha("success", 0.12),
                              color: color("success"),
                              border: `1px solid ${colorAlpha("success", 0.24)}`,
                            }}
                            onClick={() => {
                              void handleUseItem(item);
                            }}
                            disabled={isSubmitting}
                          >
                            <FlaskConical className="w-3 h-3" />
                            <span>
                              {isSubmittingCurrentItem ? "处理中..." : "使用"}
                            </span>
                          </button>
                        )}

                        {canDiscard && (
                          <button
                            type="button"
                            className={ACTION_BUTTON_CLASS_NAME}
                            style={
                              isConfirmingDiscard
                                ? {
                                    background: colorAlpha("error", 0.14),
                                    color: color("error"),
                                    border: `1px solid ${colorAlpha("error", 0.26)}`,
                                  }
                                : {
                                    background: colorAlpha("warning", 0.12),
                                    color: color("warning"),
                                    border: `1px solid ${colorAlpha("warning", 0.24)}`,
                                  }
                            }
                            onClick={() => {
                              void handleDiscardItem(item);
                            }}
                            disabled={isSubmitting}
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>
                              {isSubmittingCurrentItem
                                ? "处理中..."
                                : isConfirmingDiscard
                                  ? "确认丢弃？"
                                  : "丢弃"}
                            </span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
