import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  BellRing,
  ChevronRight,
  Gift,
  HeartPulse,
  Sparkles,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button, Panel } from "@/components/ui";
import { RoomEvents, type CharacterLeveledUpEvent } from "@/domain/events/room";
import { useEvent } from "@/hooks";
import { useRuntimeWorldConfig } from "@/hooks/useRuntimeWorldConfig";
import { getPendingLevelAllocationState } from "@/lib/world/level-allocation";
import type { WorldConfig } from "@/lib/world/types";
import { color, colorAlpha, glow } from "@/styles/tokens";

import { usePlayerCharacter } from "../CharacterPanel/usePlayerCharacter";

const AUTO_HIDE_DURATION = 8000;

interface LevelUpNotificationProps {
  onOpenCharacterPanel: () => void;
}

interface SummarySectionProps {
  icon: LucideIcon;
  title: string;
  items: string[];
  accent: "primary" | "secondary" | "warning";
}

type RewardSummary = {
  type: string;
  detail: Record<string, unknown>;
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function formatSignedValue(value: number): string {
  return value > 0 ? `+${value}` : `${value}`;
}

function formatTimestamp(timestamp: number): string {
  if (!Number.isFinite(timestamp)) {
    return "--:--";
  }

  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return "--:--";
  }

  return date.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildStatLabelMap(worldConfig: WorldConfig): Map<string, string> {
  const labels = new Map<string, string>();

  for (const attribute of worldConfig.primaryAttributes) {
    labels.set(attribute.key, attribute.label);
  }

  for (const stat of worldConfig.derivedStats) {
    labels.set(stat.key, stat.label);
  }

  return labels;
}

function getTalentName(talentId: string, worldConfig: WorldConfig): string {
  const normalizedId = talentId.trim();
  if (!normalizedId) {
    return "未知天赋";
  }

  const talent = worldConfig.talents?.find((item) => item.id === normalizedId);
  return talent?.name ?? normalizedId;
}

function getSkillName(skillId: string, worldConfig: WorldConfig): string {
  const normalizedId = skillId.trim();
  if (!normalizedId) {
    return "未知技能";
  }

  const skill = worldConfig.skillTemplates?.find(
    (item) => item.id === normalizedId,
  );
  return skill?.name ?? normalizedId;
}

function getItemName(itemId: string, worldConfig: WorldConfig): string {
  const normalizedId = itemId.trim();
  if (!normalizedId) {
    return "未知物品";
  }

  const item = worldConfig.itemTemplates?.find(
    (template) => template.id === normalizedId,
  );
  return item?.name ?? normalizedId;
}

function formatStatEntries(
  values: Record<string, number>,
  labelMap: Map<string, string>,
): string[] {
  return Object.entries(values)
    .filter(([, value]) => isFiniteNumber(value) && value !== 0)
    .map(
      ([key, value]) =>
        `${labelMap.get(key) ?? key} ${formatSignedValue(value)}`,
    );
}

function getRewardSummaryLines(
  rewards: RewardSummary[],
  worldConfig: WorldConfig,
  labelMap: Map<string, string>,
): string[] {
  return rewards
    .map((reward) => {
      switch (reward.type) {
        case "attribute_bonus": {
          const attributes = reward.detail.attributes;
          if (
            !attributes ||
            typeof attributes !== "object" ||
            Array.isArray(attributes)
          ) {
            return null;
          }

          const formatted = formatStatEntries(
            attributes as Record<string, number>,
            labelMap,
          );
          return formatted.length > 0
            ? `额外属性：${formatted.join("，")}`
            : null;
        }
        case "free_talent_draw": {
          const drawCount = isFiniteNumber(reward.detail.drawCount)
            ? Math.max(0, Math.trunc(reward.detail.drawCount))
            : 0;
          if (drawCount <= 0) {
            return null;
          }

          const meta: string[] = [];
          const poolId =
            typeof reward.detail.poolId === "string" &&
            reward.detail.poolId.trim().length > 0
              ? reward.detail.poolId.trim()
              : null;
          const guaranteedRarity =
            typeof reward.detail.guaranteedRarity === "string" &&
            reward.detail.guaranteedRarity.trim().length > 0
              ? reward.detail.guaranteedRarity.trim()
              : null;

          if (poolId) {
            meta.push(`池 ${poolId}`);
          }
          if (guaranteedRarity) {
            meta.push(`保底 ${guaranteedRarity}`);
          }

          return `获得 ${drawCount} 次天赋抽取${
            meta.length > 0 ? `（${meta.join("，")}）` : ""
          }`;
        }
        case "grant_talent": {
          const talentId =
            typeof reward.detail.talentId === "string"
              ? reward.detail.talentId
              : "";
          return talentId
            ? `获得天赋：${getTalentName(talentId, worldConfig)}`
            : null;
        }
        case "skill_pick": {
          const skillId =
            typeof reward.detail.skillId === "string"
              ? reward.detail.skillId
              : "";
          return skillId
            ? `获得技能待选项：${getSkillName(skillId, worldConfig)}`
            : "获得技能待选项";
        }
        case "grant_skill": {
          const skillId =
            typeof reward.detail.skillId === "string"
              ? reward.detail.skillId
              : "";
          return skillId
            ? `获得技能：${getSkillName(skillId, worldConfig)}`
            : "获得新技能";
        }
        case "grant_item": {
          const itemId =
            typeof reward.detail.itemId === "string"
              ? reward.detail.itemId
              : "";
          const quantity = isFiniteNumber(reward.detail.quantity)
            ? Math.max(1, Math.trunc(reward.detail.quantity))
            : 1;
          return itemId
            ? `获得物品：${getItemName(itemId, worldConfig)} ×${quantity}`
            : `获得物品 ×${quantity}`;
        }
        default:
          return null;
      }
    })
    .filter((line): line is string => Boolean(line));
}

function SummarySection({
  icon: Icon,
  title,
  items,
  accent,
}: SummarySectionProps) {
  return (
    <section
      className="space-y-2 rounded-xl border p-3"
      style={{
        background: colorAlpha("bgElevated", 0.28),
        borderColor: colorAlpha(accent, 0.2),
      }}
    >
      <div className="flex items-center gap-2">
        <span
          className="inline-flex h-7 w-7 items-center justify-center rounded-lg"
          style={{
            background: colorAlpha(accent, 0.12),
            color: color(accent),
            boxShadow: glow(accent, "sm", 0.12),
          }}
        >
          <Icon className="h-4 w-4" />
        </span>
        <h3
          className="text-xs font-semibold uppercase tracking-[0.16em]"
          style={{ color: colorAlpha("textSecondary", 0.86) }}
        >
          {title}
        </h3>
      </div>

      <ul className="space-y-1.5">
        {items.map((item) => (
          <li
            key={item}
            className="text-sm leading-relaxed"
            style={{ color: colorAlpha("textPrimary", 0.92) }}
          >
            • {item}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function LevelUpNotification({
  onOpenCharacterPanel,
}: LevelUpNotificationProps) {
  const shouldReduceMotion = useReducedMotion();
  const worldConfig = useRuntimeWorldConfig();
  const currentCharacter = usePlayerCharacter();

  const [notification, setNotification] =
    useState<CharacterLeveledUpEvent | null>(null);
  const [visible, setVisible] = useState(false);

  const hideTimerRef = useRef<number | null>(null);

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  useEvent<CharacterLeveledUpEvent>(
    RoomEvents.CHARACTER_LEVELED_UP,
    (event) => {
      setNotification(event.payload);
      setVisible(true);
    },
  );

  useEffect(() => {
    if (!notification || !visible) {
      clearHideTimer();
      return;
    }

    clearHideTimer();
    hideTimerRef.current = window.setTimeout(() => {
      setVisible(false);
    }, AUTO_HIDE_DURATION);

    return clearHideTimer;
  }, [clearHideTimer, notification, visible]);

  useEffect(() => clearHideTimer, [clearHideTimer]);

  const labelMap = useMemo(() => buildStatLabelMap(worldConfig), [worldConfig]);
  const growthItems = useMemo(
    () =>
      notification
        ? formatStatEntries(notification.appliedGrowth, labelMap)
        : [],
    [labelMap, notification],
  );
  const rewardItems = useMemo(
    () =>
      notification?.appliedRewards
        ? getRewardSummaryLines(
            notification.appliedRewards,
            worldConfig,
            labelMap,
          )
        : [],
    [labelMap, notification?.appliedRewards, worldConfig],
  );
  const recoveryItems = useMemo(
    () =>
      notification
        ? formatStatEntries(notification.resourceRecovery, labelMap)
        : [],
    [labelMap, notification],
  );

  const pendingAllocationPoints = useMemo(() => {
    const allocationState = getPendingLevelAllocationState(
      currentCharacter,
      worldConfig,
    );
    return allocationState?.unspentPoints ?? 0;
  }, [currentCharacter, worldConfig]);

  const pendingTalentDrawCount =
    currentCharacter?.pendingTalentDraws?.length ?? 0;
  const isCurrentPlayerNotification =
    notification?.characterId != null &&
    notification.characterId === currentCharacter?.id;

  const actionItems = useMemo(() => {
    if (!isCurrentPlayerNotification) {
      return [];
    }

    const items: string[] = [];

    if (pendingAllocationPoints > 0) {
      items.push(`仍有 ${pendingAllocationPoints} 点属性点待分配`);
    }

    if (pendingTalentDrawCount > 0) {
      items.push(`仍有 ${pendingTalentDrawCount} 次天赋抽取待领取`);
    }

    return items;
  }, [
    isCurrentPlayerNotification,
    pendingAllocationPoints,
    pendingTalentDrawCount,
  ]);

  const handleClose = useCallback(() => {
    clearHideTimer();
    setVisible(false);
  }, [clearHideTimer]);

  const handleOpenCharacterPanel = useCallback(() => {
    handleClose();
    onOpenCharacterPanel();
  }, [handleClose, onOpenCharacterPanel]);

  const notificationKey = notification
    ? `${notification.characterId}-${notification.updatedAt}`
    : "level-up";

  return (
    <div className="pointer-events-none absolute inset-x-0 top-18 z-20 flex justify-center px-3 sm:px-4 md:top-22">
      <AnimatePresence mode="wait">
        {notification && visible ? (
          <motion.div
            key={notificationKey}
            initial={{
              opacity: 0,
              y: shouldReduceMotion ? 0 : -20,
              scale: shouldReduceMotion ? 1 : 0.98,
            }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{
              opacity: 0,
              y: shouldReduceMotion ? 0 : -16,
              scale: shouldReduceMotion ? 1 : 0.985,
            }}
            transition={{
              duration: shouldReduceMotion ? 0.14 : 0.22,
              ease: "easeOut",
            }}
            className="pointer-events-auto w-full max-w-2xl"
          >
            <Panel
              variant="glass"
              enterAnimation={false}
              borderGlow={false}
              className="overflow-hidden"
              style={{
                background: `linear-gradient(180deg, ${colorAlpha(
                  "bgElevated",
                  0.9,
                )} 0%, ${colorAlpha("bgBase", 0.88)} 100%)`,
                borderColor: colorAlpha("secondary", 0.24),
                boxShadow: `${glow("secondary", "lg", 0.14)}, ${glow(
                  "primary",
                  "md",
                  0.08,
                )}`,
              }}
            >
              <div
                className="absolute inset-x-0 top-0 h-px"
                style={{
                  background: `linear-gradient(90deg, transparent, ${colorAlpha(
                    "secondary",
                    0.9,
                  )}, transparent)`,
                }}
              />

              <div className="space-y-4 p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-flex h-8 w-8 items-center justify-center rounded-xl"
                        style={{
                          background: colorAlpha("secondary", 0.14),
                          color: color("secondary"),
                          boxShadow: glow("secondary", "sm", 0.18),
                        }}
                      >
                        <BellRing className="h-4 w-4" />
                      </span>
                      <span
                        className="text-[11px] font-semibold uppercase tracking-[0.22em]"
                        style={{ color: colorAlpha("secondary", 0.9) }}
                      >
                        Level Up
                      </span>
                      <span
                        className="text-[11px]"
                        style={{ color: colorAlpha("textMuted", 0.8) }}
                      >
                        {formatTimestamp(notification.updatedAt)}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <h2
                        className="text-xl font-semibold sm:text-2xl"
                        style={{
                          color: color("textPrimary"),
                          textShadow: glow("secondary", "sm", 0.18),
                        }}
                      >
                        等级提升！ Lv.{notification.previousLevel} → Lv.
                        {notification.newLevel}
                      </h2>
                      <p
                        className="text-sm leading-relaxed"
                        style={{ color: colorAlpha("textSecondary", 0.84) }}
                      >
                        成长结果已完成结算，已同步至当前角色状态。
                        {notification.reason?.trim()
                          ? ` 原因：${notification.reason.trim()}`
                          : ""}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleClose}
                    aria-label="关闭升级通知"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl transition-colors"
                    style={{
                      color: colorAlpha("textMuted", 0.84),
                      background: colorAlpha("bgElevated", 0.34),
                      border: `1px solid ${colorAlpha("primary", 0.12)}`,
                    }}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  {growthItems.length > 0 ? (
                    <SummarySection
                      icon={Sparkles}
                      title="自动成长"
                      items={growthItems}
                      accent="secondary"
                    />
                  ) : null}

                  {notification.pointsAwarded &&
                  notification.pointsAwarded > 0 ? (
                    <SummarySection
                      icon={Zap}
                      title="成长点数"
                      items={[
                        `获得 ${notification.pointsAwarded} 个属性点待分配`,
                      ]}
                      accent="warning"
                    />
                  ) : null}

                  {rewardItems.length > 0 ? (
                    <SummarySection
                      icon={Gift}
                      title="升级奖励"
                      items={rewardItems}
                      accent="primary"
                    />
                  ) : null}

                  {recoveryItems.length > 0 ? (
                    <SummarySection
                      icon={HeartPulse}
                      title="资源恢复"
                      items={recoveryItems}
                      accent="secondary"
                    />
                  ) : null}
                </div>

                {notification.progressInsufficient ? (
                  <div
                    className="rounded-xl border px-3 py-2 text-xs leading-relaxed"
                    style={{
                      background: colorAlpha("warning", 0.08),
                      borderColor: colorAlpha("warning", 0.18),
                      color: colorAlpha("warning", 0.92),
                    }}
                  >
                    本次升级存在进度不足标记，系统仍已完成等级结算与奖励发放。
                  </div>
                ) : null}

                {actionItems.length > 0 ? (
                  <div
                    className="flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between"
                    style={{
                      background: colorAlpha("secondary", 0.08),
                      borderColor: colorAlpha("secondary", 0.16),
                    }}
                  >
                    <div className="space-y-1">
                      <p
                        className="text-sm font-medium"
                        style={{ color: color("textPrimary") }}
                      >
                        仍有成长内容待处理
                      </p>
                      <ul className="space-y-1">
                        {actionItems.map((item) => (
                          <li
                            key={item}
                            className="text-xs leading-relaxed"
                            style={{ color: colorAlpha("textSecondary", 0.84) }}
                          >
                            • {item}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleOpenCharacterPanel}
                      className="w-full shrink-0 sm:w-auto"
                      style={{
                        color: color("textPrimary"),
                        borderColor: colorAlpha("secondary", 0.42),
                        background: colorAlpha("secondary", 0.08),
                        boxShadow: glow("secondary", "sm", 0.12),
                      }}
                    >
                      查看角色
                      <ChevronRight className="ml-1 h-4 w-4" />
                    </Button>
                  </div>
                ) : null}
              </div>
            </Panel>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
