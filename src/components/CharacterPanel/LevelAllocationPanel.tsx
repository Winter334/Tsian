import { motion } from "framer-motion";
import { Minus, Plus, Zap } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button, Panel } from "@/components/ui";
import {
  RoomCommands,
  type AllocateLevelPointsPayload,
} from "@/domain/commands/room";
import type { Character } from "@/domain/entities/character";
import { useCommand, useToast } from "@/hooks";
import { getOrCreateUserId, getUniqueTag } from "@/lib/user-identity";
import { getPendingLevelAllocationState } from "@/lib/world/level-allocation";
import type { PrimaryAttributeConfig, WorldConfig } from "@/lib/world/types";
import { useRoomInfo } from "@/modules";
import { color, colorAlpha, glow } from "@/styles/tokens";

interface LevelAllocationPanelProps {
  character: Character;
  worldConfig: WorldConfig;
}

function getSafeInteger(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.trunc(value));
}

function getAllocationTotal(allocation: Record<string, number>): number {
  return Object.values(allocation).reduce((sum, value) => sum + value, 0);
}

function isSameAllocation(
  left: Record<string, number>,
  right: Record<string, number>,
): boolean {
  const leftEntries = Object.entries(left);
  const rightEntries = Object.entries(right);

  if (leftEntries.length !== rightEntries.length) {
    return false;
  }

  return leftEntries.every(([key, value]) => right[key] === value);
}

function normalizePendingAllocation(
  allocation: Record<string, number>,
  allocatableAttributes: readonly string[],
  unspentPoints: number,
  maxPerAttribute?: number,
): Record<string, number> {
  const normalized: Record<string, number> = {};
  let spent = 0;

  for (const attributeKey of allocatableAttributes) {
    const rawValue = allocation[attributeKey];
    if (!Number.isFinite(rawValue) || rawValue <= 0) {
      continue;
    }

    const normalizedValue = Math.max(0, Math.trunc(rawValue));
    const cappedValue =
      maxPerAttribute !== undefined
        ? Math.min(normalizedValue, maxPerAttribute)
        : normalizedValue;
    const remainingBudget = Math.max(0, unspentPoints - spent);
    const finalValue = Math.min(cappedValue, remainingBudget);

    if (finalValue <= 0) {
      break;
    }

    normalized[attributeKey] = finalValue;
    spent += finalValue;
  }

  return normalized;
}

function getProgressPercent(
  attributeConfig: PrimaryAttributeConfig | undefined,
  value: number,
): number {
  const min = attributeConfig?.min ?? 0;
  const configuredMax = attributeConfig?.max;
  const max =
    typeof configuredMax === "number" && Number.isFinite(configuredMax)
      ? configuredMax
      : Math.max(min + 1, value, 20);
  const range = Math.max(1, max - min);

  return Math.max(0, Math.min(1, (value - min) / range));
}

export function LevelAllocationPanel({
  character,
  worldConfig,
}: LevelAllocationPanelProps) {
  const dispatch = useCommand();
  const toast = useToast();
  const { currentRoom } = useRoomInfo();
  const currentUserId = useMemo(() => getOrCreateUserId(), []);
  const [pendingAllocation, setPendingAllocation] = useState<
    Record<string, number>
  >({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const allocationState = useMemo(
    () => getPendingLevelAllocationState(character, worldConfig),
    [character, worldConfig],
  );

  const attributeConfigMap = useMemo(() => {
    const map = new Map<string, PrimaryAttributeConfig>();

    for (const attribute of worldConfig.primaryAttributes) {
      map.set(attribute.key, attribute);
    }

    return map;
  }, [worldConfig.primaryAttributes]);

  const allocatableAttributesKey =
    allocationState?.allocatableAttributes.join("|") ?? "";

  useEffect(() => {
    if (!allocationState) {
      setPendingAllocation((current) =>
        Object.keys(current).length === 0 ? current : {},
      );
      return;
    }

    setPendingAllocation((current) => {
      const normalized = normalizePendingAllocation(
        current,
        allocationState.allocatableAttributes,
        allocationState.unspentPoints,
        allocationState.maxPerAttribute,
      );

      return isSameAllocation(current, normalized) ? current : normalized;
    });
  }, [
    allocatableAttributesKey,
    allocationState,
    allocationState?.maxPerAttribute,
    allocationState?.unspentPoints,
    character.id,
  ]);

  const allocatedPoints = useMemo(
    () => getAllocationTotal(pendingAllocation),
    [pendingAllocation],
  );

  const roomId = currentRoom?.roomId ?? null;
  const uniqueTag = getUniqueTag() ?? "";
  const confirmBlockedReason = !roomId
    ? "当前房间上下文不可用，暂时无法确认分配。"
    : !uniqueTag
      ? "当前身份未完成初始化，暂时无法确认分配。"
      : null;

  const updateAllocation = useCallback(
    (attributeKey: string, delta: 1 | -1) => {
      if (!allocationState) {
        return;
      }

      setPendingAllocation((current) => {
        const currentValue = current[attributeKey] ?? 0;
        const spent = getAllocationTotal(current);

        if (delta === 1) {
          if (spent >= allocationState.unspentPoints) {
            return current;
          }

          if (
            allocationState.maxPerAttribute !== undefined &&
            currentValue >= allocationState.maxPerAttribute
          ) {
            return current;
          }

          return {
            ...current,
            [attributeKey]: currentValue + 1,
          };
        }

        if (currentValue <= 0) {
          return current;
        }

        if (currentValue === 1) {
          const { [attributeKey]: _removed, ...rest } = current;
          return rest;
        }

        return {
          ...current,
          [attributeKey]: currentValue - 1,
        };
      });
    },
    [allocationState],
  );

  const handleConfirm = useCallback(async () => {
    if (!allocationState) {
      return;
    }

    const latestRoomId = currentRoom?.roomId;
    if (!latestRoomId) {
      toast.error("无法确认分配", "当前房间上下文不可用");
      return;
    }

    const latestUniqueTag = getUniqueTag();
    if (!latestUniqueTag) {
      toast.error("无法确认分配", "当前身份未完成初始化");
      return;
    }

    const normalizedAllocation = normalizePendingAllocation(
      pendingAllocation,
      allocationState.allocatableAttributes,
      allocationState.unspentPoints,
      allocationState.maxPerAttribute,
    );
    const pointsToSpend = getAllocationTotal(normalizedAllocation);

    if (pointsToSpend <= 0) {
      toast.warning("尚未分配属性点", "请先为至少一个属性增加点数");
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await dispatch<AllocateLevelPointsPayload, void>({
        type: RoomCommands.ALLOCATE_LEVEL_POINTS,
        payload: {
          roomId: latestRoomId,
          characterId: character.id,
          userId: currentUserId,
          uniqueTag: latestUniqueTag,
          allocation: normalizedAllocation,
        },
      });

      if (!result.success) {
        toast.error("属性点分配失败", result.error || "请稍后重试");
        return;
      }

      setPendingAllocation({});
      toast.success("属性点分配成功", `已确认分配 ${pointsToSpend} 点属性点`);
    } catch (error) {
      toast.error(
        "属性点分配失败",
        error instanceof Error ? error.message : "请稍后重试",
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [
    allocationState,
    character.id,
    currentRoom?.roomId,
    currentUserId,
    dispatch,
    pendingAllocation,
    toast,
  ]);

  if (!allocationState) {
    return null;
  }

  return (
    <Panel
      className="space-y-4 p-4"
      style={{
        background: colorAlpha("bgElevated", 0.5),
        border: `1px solid ${colorAlpha("warning", 0.18)}`,
        boxShadow: glow("warning", "sm", 0.12),
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span style={{ color: color("warning") }}>
              <Zap className="h-4 w-4" />
            </span>
            <h3
              className="text-sm font-semibold uppercase tracking-[0.16em]"
              style={{ color: color("warning") }}
            >
              待分配属性点
            </h3>
          </div>
          <p
            className="text-xs leading-relaxed"
            style={{ color: colorAlpha("textSecondary", 0.84) }}
          >
            已获得成长点数，可随时确认分配，不会打断当前叙事流程。
          </p>
        </div>

        <div
          className="shrink-0 rounded-full px-3 py-1 text-sm font-semibold"
          style={{
            background: colorAlpha("warning", 0.14),
            color: color("warning"),
            border: `1px solid ${colorAlpha("warning", 0.24)}`,
            boxShadow: glow("warning", "sm", 0.18),
          }}
        >
          {allocationState.unspentPoints} 点
        </div>
      </div>

      <div className="space-y-3">
        {allocationState.allocatableAttributes.map((attributeKey) => {
          const attributeConfig = attributeConfigMap.get(attributeKey);
          const currentValue = getSafeInteger(
            character.attributes?.[attributeKey],
          );
          const pendingValue = pendingAllocation[attributeKey] ?? 0;
          const projectedValue = currentValue + pendingValue;
          const progressPercent = getProgressPercent(
            attributeConfig,
            projectedValue,
          );
          const canIncrease =
            allocatedPoints < allocationState.unspentPoints &&
            (allocationState.maxPerAttribute === undefined ||
              pendingValue < allocationState.maxPerAttribute);
          const canDecrease = pendingValue > 0;

          return (
            <div
              key={attributeKey}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3"
            >
              <div className="space-y-1.5 min-w-0">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className="truncate text-sm font-medium"
                      style={{ color: color("textPrimary") }}
                    >
                      {attributeConfig?.label ?? attributeKey}
                    </span>
                    {pendingValue > 0 && (
                      <span
                        className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                        style={{
                          background: colorAlpha("primary", 0.12),
                          color: color("primary"),
                          border: `1px solid ${colorAlpha("primary", 0.2)}`,
                        }}
                      >
                        +{pendingValue}
                      </span>
                    )}
                  </div>
                  <span
                    className="shrink-0 text-sm font-semibold"
                    style={{ color: colorAlpha("textSecondary", 0.88) }}
                  >
                    {projectedValue}
                  </span>
                </div>

                <div
                  className="relative h-2 overflow-hidden rounded-full"
                  style={{
                    background: colorAlpha("primary", 0.08),
                    border: `1px solid ${colorAlpha("primary", 0.14)}`,
                  }}
                >
                  <motion.div
                    className="absolute inset-y-0 left-0 rounded-full"
                    animate={{ width: `${Math.round(progressPercent * 100)}%` }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    style={{
                      background: `linear-gradient(90deg, ${colorAlpha("primary", 0.5)}, ${colorAlpha("secondary", 0.85)})`,
                      boxShadow: glow("primary", "sm", 0.2),
                    }}
                  />
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="h-8 w-8 px-0"
                  onClick={() => updateAllocation(attributeKey, 1)}
                  disabled={!canIncrease || isSubmitting}
                  aria-label={`增加 ${attributeConfig?.label ?? attributeKey}`}
                >
                  <Plus className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 px-0"
                  onClick={() => updateAllocation(attributeKey, -1)}
                  disabled={!canDecrease || isSubmitting}
                  aria-label={`减少 ${attributeConfig?.label ?? attributeKey}`}
                >
                  <Minus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <div
        className="flex flex-col gap-3 border-t pt-3 sm:flex-row sm:items-center sm:justify-between"
        style={{ borderColor: colorAlpha("primary", 0.12) }}
      >
        <div className="space-y-1">
          <p
            className="text-sm font-medium"
            style={{ color: colorAlpha("textSecondary", 0.88) }}
          >
            已分配：{allocatedPoints} / {allocationState.unspentPoints}
          </p>
          {confirmBlockedReason ? (
            <p
              className="text-xs"
              style={{ color: colorAlpha("warning", 0.88) }}
            >
              {confirmBlockedReason}
            </p>
          ) : allocationState.maxPerAttribute !== undefined ? (
            <p
              className="text-xs"
              style={{ color: colorAlpha("textMuted", 0.78) }}
            >
              单项本次最多分配 {allocationState.maxPerAttribute} 点
            </p>
          ) : null}
        </div>

        <Button
          type="button"
          size="sm"
          className="min-w-30"
          onClick={handleConfirm}
          disabled={
            allocatedPoints <= 0 ||
            isSubmitting ||
            confirmBlockedReason !== null
          }
        >
          {isSubmitting ? "确认中..." : "确认分配"}
        </Button>
      </div>
    </Panel>
  );
}
