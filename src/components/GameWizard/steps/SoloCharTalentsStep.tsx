import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronRight, Sparkles, Star, Wrench } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button, Card } from "@/components/ui";
import type { PassiveModifier } from "@/domain/types/rule-script";
import { useMotionTokens } from "@/hooks";
import { generateTalentCandidates } from "@/lib/rules/talent-draw";
import { getCategoryIcon } from "@/lib/ui/category-icons";
import type { TalentConfig } from "@/lib/world/types";
import {
  aggregateDimensionEffects,
  DEFAULT_WORLD_CONFIG,
} from "@/lib/world/types";
import { createStaggerVariants } from "@/styles/motion-variants";
import { color, colorAlpha, glow } from "@/styles/tokens";

import type { StepProps } from "../types";

type DrawPhase = "idle" | "offering";
type SourceType = "dimension" | "draw";
type ColorKey = Parameters<typeof color>[0];

interface ObtainedTalentRecord {
  talentId: string;
  talent: TalentConfig;
  source: SourceType;
  reason: string;
}

function getCategoryLabel(category?: TalentConfig["category"]): string {
  switch (category) {
    case "combat":
      return "战斗";
    case "magic":
      return "魔法";
    case "survival":
      return "生存";
    case "social":
      return "社交";
    case "misc":
      return "其他";
    default:
      return "通用";
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

function getTalentEffectLines(talent: TalentConfig): string[] {
  const lines = (talent.modifiers ?? [])
    .map(
      (modifier) => modifier.reason?.trim() || formatModifier(modifier).trim(),
    )
    .filter((line) => line.length > 0);

  return Array.from(new Set(lines));
}

function camelToKebab(value: string): string {
  return value.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);
}

function resolveConfigTokenColor(
  token: string | undefined,
  fallback: ColorKey,
): string {
  if (!token?.trim()) {
    return color(fallback);
  }

  return `var(--color-${camelToKebab(token.trim())})`;
}

function resolveConfigTokenAlpha(
  token: string | undefined,
  alpha: number,
  fallback: ColorKey,
): string {
  const baseColor = resolveConfigTokenColor(token, fallback);
  return `color-mix(in srgb, ${baseColor} ${Math.round(alpha * 100)}%, transparent)`;
}

function createUnknownTalent(talentId: string): TalentConfig {
  return {
    id: talentId,
    name: talentId,
    description: "该天赋未在当前世界配置中找到。",
    category: "misc",
  };
}

function getNumericAttribute(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

function TalentCard({
  talent,
  rarityLabel,
  rarityColorToken,
  source,
  reason,
  interactive,
  onClick,
}: {
  talent: TalentConfig;
  rarityLabel: string | null;
  rarityColorToken?: string;
  source: SourceType;
  reason: string;
  interactive: boolean;
  onClick?: () => void;
}) {
  const effectLines = useMemo(() => getTalentEffectLines(talent), [talent]);
  const fallbackAccent: ColorKey =
    source === "dimension" ? "secondary" : "primary";
  const accentColor = resolveConfigTokenColor(rarityColorToken, fallbackAccent);
  const accentSoft = resolveConfigTokenAlpha(
    rarityColorToken,
    0.14,
    fallbackAccent,
  );
  const accentBorder = resolveConfigTokenAlpha(
    rarityColorToken,
    0.3,
    fallbackAccent,
  );

  return (
    <motion.div
      layout
      initial={interactive ? { opacity: 0, y: 14 } : false}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12, scale: 0.96 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      whileTap={interactive ? { scale: 0.985 } : undefined}
      className="h-full"
    >
      <Card
        variant={interactive ? "elevated" : "outlined"}
        hover={interactive}
        onClick={interactive ? onClick : undefined}
        className="h-full p-4 relative overflow-hidden"
        style={{
          cursor: interactive ? "pointer" : "default",
          borderColor:
            source === "dimension"
              ? colorAlpha("secondary", 0.35)
              : accentBorder,
          boxShadow:
            source === "dimension"
              ? glow("secondary", "sm", 0.16)
              : `0 0 16px ${accentSoft}`,
          background:
            source === "dimension"
              ? `linear-gradient(135deg, ${colorAlpha("secondary", 0.08)} 0%, ${colorAlpha("bgElevated", 0.92)} 100%)`
              : `linear-gradient(135deg, ${accentSoft} 0%, ${colorAlpha("bgElevated", 0.9)} 100%)`,
        }}
      >
        <div className="flex items-start gap-3">
          <div
            className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
            style={{
              background:
                source === "dimension"
                  ? colorAlpha("secondary", 0.14)
                  : accentSoft,
              border: `1px solid ${
                source === "dimension"
                  ? colorAlpha("secondary", 0.32)
                  : accentBorder
              }`,
              color: source === "dimension" ? color("secondary") : accentColor,
            }}
          >
            {getCategoryIcon(talent.category, { miscIcon: Wrench, size: "md" })}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3
                className="text-sm font-semibold"
                style={{
                  color:
                    source === "dimension" ? color("secondary") : accentColor,
                }}
              >
                {talent.name}
              </h3>

              {rarityLabel ? (
                <span
                  className="rounded-full px-2 py-0.5 text-[11px] font-medium"
                  style={{
                    background: accentSoft,
                    color: accentColor,
                    border: `1px solid ${accentBorder}`,
                  }}
                >
                  {rarityLabel}
                </span>
              ) : null}

              <span
                className="rounded-full px-2 py-0.5 text-[11px]"
                style={{
                  background: colorAlpha("primary", 0.08),
                  color: color("textMuted"),
                  border: `1px solid ${colorAlpha("primary", 0.12)}`,
                }}
              >
                {getCategoryLabel(talent.category)}
              </span>

              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px]"
                style={{
                  background:
                    source === "dimension"
                      ? colorAlpha("secondary", 0.12)
                      : colorAlpha("primary", 0.1),
                  color:
                    source === "dimension"
                      ? color("secondary")
                      : color("primary"),
                  border: `1px solid ${
                    source === "dimension"
                      ? colorAlpha("secondary", 0.28)
                      : colorAlpha("primary", 0.22)
                  }`,
                }}
              >
                {source === "dimension" ? (
                  <Sparkles className="h-3 w-3" />
                ) : (
                  <Check className="h-3 w-3" />
                )}
                {reason}
              </span>
            </div>

            <p
              className="mt-2 text-xs leading-relaxed"
              style={{ color: colorAlpha("textMuted", 0.86) }}
            >
              {talent.description}
            </p>

            {effectLines.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {effectLines.slice(0, 3).map((line) => (
                  <span
                    key={line}
                    className="rounded-md px-2 py-1 text-[11px] leading-relaxed"
                    style={{
                      background: colorAlpha("bgBase", 0.55),
                      color: colorAlpha("textSecondary", 0.92),
                      border: `1px solid ${colorAlpha("border", 0.18)}`,
                    }}
                  >
                    {line}
                  </span>
                ))}
                {effectLines.length > 3 ? (
                  <span
                    className="rounded-md px-2 py-1 text-[11px]"
                    style={{
                      background: colorAlpha("primary", 0.08),
                      color: color("textMuted"),
                      border: `1px solid ${colorAlpha("primary", 0.14)}`,
                    }}
                  >
                    +{effectLines.length - 3} 项效果
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

export function SoloCharTalentsStep({
  context,
  onUpdateContext,
  onValidationChange,
}: StepProps) {
  const motionConfig = useMotionTokens();
  const itemVariants = createStaggerVariants(motionConfig, "y", 0.08);

  const worldConfig = context.worldConfig ?? DEFAULT_WORLD_CONFIG;
  const allTalents = useMemo(() => worldConfig.talents ?? [], [worldConfig]);
  const talentsById = useMemo(
    () => new Map(allTalents.map((talent) => [talent.id, talent])),
    [allTalents],
  );
  const rarityById = useMemo(
    () =>
      new Map(
        (worldConfig.talentRules?.rarities ?? []).map((rarity) => [
          rarity.id,
          rarity,
        ]),
      ),
    [worldConfig.talentRules?.rarities],
  );

  const initialDrawCount = worldConfig.talentRules?.initialDrawCount ?? 2;
  const levelAttributeKey =
    worldConfig.levelSystem?.levelAttributeKey ?? "level";
  const defaultCharacterLevel =
    worldConfig.primaryAttributes.find((attr) => attr.key === levelAttributeKey)
      ?.defaultValue ?? 1;
  const characterLevel = getNumericAttribute(
    context.attributes?.[levelAttributeKey],
    defaultCharacterLevel,
  );

  const dimensionEffects = useMemo(
    () =>
      aggregateDimensionEffects(worldConfig, context.dimensionSelections ?? {}),
    [context.dimensionSelections, worldConfig],
  );

  const autoTalentIds = dimensionEffects.grantedTalents;
  const excludedTalentIds = dimensionEffects.excludedTalents;

  const dimensionTalentSources = useMemo(() => {
    const sources = new Map<string, string>();

    for (const dimension of worldConfig.dimensions ?? []) {
      const selectedOptionId = (context.dimensionSelections ?? {})[
        dimension.id
      ];
      if (!selectedOptionId) {
        continue;
      }

      const selectedOption = dimension.options.find(
        (option) => option.id === selectedOptionId,
      );
      if (!selectedOption?.effects?.grantedTalents?.length) {
        continue;
      }

      const label = dimension.label ?? dimension.id;
      for (const talentId of selectedOption.effects.grantedTalents) {
        sources.set(talentId, label);
      }
    }

    return sources;
  }, [context.dimensionSelections, worldConfig.dimensions]);

  const initialSelectedTalentIds = useMemo(() => {
    const autoTalentIdSet = new Set(autoTalentIds);
    const excludedTalentIdSet = new Set(excludedTalentIds);

    return Array.from(new Set(context.talentIds ?? [])).filter(
      (talentId) =>
        !autoTalentIdSet.has(talentId) && !excludedTalentIdSet.has(talentId),
    );
  }, [autoTalentIds, context.talentIds, excludedTalentIds]);

  const [selectedTalentIds, setSelectedTalentIds] = useState<string[]>(
    initialSelectedTalentIds,
  );
  const [drawPhase, setDrawPhase] = useState<DrawPhase>("idle");
  const [currentCandidates, setCurrentCandidates] = useState<TalentConfig[]>(
    [],
  );

  const obtainedTalentIds = useMemo(
    () => [...new Set([...autoTalentIds, ...selectedTalentIds])],
    [autoTalentIds, selectedTalentIds],
  );

  const remainingDraws = Math.max(
    initialDrawCount - selectedTalentIds.length,
    0,
  );

  const nextDrawPreview = useMemo(() => {
    if (remainingDraws <= 0) {
      return { candidates: [], poolUsed: null };
    }

    return generateTalentCandidates({
      allTalents,
      ownedTalentIds: obtainedTalentIds,
      characterLevel,
      talentRules: worldConfig.talentRules,
      excludeTalentIds: excludedTalentIds,
    });
  }, [
    allTalents,
    characterLevel,
    excludedTalentIds,
    obtainedTalentIds,
    remainingDraws,
    worldConfig.talentRules,
  ]);

  const isOffering = drawPhase === "offering" && currentCandidates.length > 0;
  const isPoolExhausted =
    !isOffering &&
    remainingDraws > 0 &&
    nextDrawPreview.candidates.length === 0;
  const isComplete = remainingDraws === 0 || isPoolExhausted;

  const obtainedRecords = useMemo((): ObtainedTalentRecord[] => {
    const records: ObtainedTalentRecord[] = [];

    for (const talentId of autoTalentIds) {
      records.push({
        talentId,
        talent: talentsById.get(talentId) ?? createUnknownTalent(talentId),
        source: "dimension",
        reason: `${dimensionTalentSources.get(talentId) ?? "维度"}赠送`,
      });
    }

    selectedTalentIds.forEach((talentId, index) => {
      records.push({
        talentId,
        talent: talentsById.get(talentId) ?? createUnknownTalent(talentId),
        source: "draw",
        reason: `第 ${index + 1} 抽获得`,
      });
    });

    return records;
  }, [autoTalentIds, dimensionTalentSources, selectedTalentIds, talentsById]);

  const currentOfferRecords = useMemo(
    () =>
      currentCandidates.map((talent) => ({
        talent,
        rarity: talent.rarity ? (rarityById.get(talent.rarity) ?? null) : null,
      })),
    [currentCandidates, rarityById],
  );

  useEffect(() => {
    onUpdateContext({ talentIds: obtainedTalentIds });
  }, [obtainedTalentIds, onUpdateContext]);

  useEffect(() => {
    onValidationChange?.(isComplete);
  }, [isComplete, onValidationChange]);

  const handleStartDraw = useCallback(() => {
    if (remainingDraws <= 0 || nextDrawPreview.candidates.length === 0) {
      return;
    }

    setCurrentCandidates(nextDrawPreview.candidates);
    setDrawPhase("offering");
  }, [nextDrawPreview.candidates, remainingDraws]);

  const handleSelectCandidate = useCallback(
    (talentId: string) => {
      if (!isOffering) {
        return;
      }

      setSelectedTalentIds((prev) => {
        if (prev.includes(talentId)) {
          return prev;
        }
        return [...prev, talentId];
      });
      setCurrentCandidates([]);
      setDrawPhase("idle");
    },
    [isOffering],
  );

  return (
    <div className="mx-auto max-w-5xl px-3 py-4 md:px-6 md:py-8">
      <motion.div
        className="mb-6"
        variants={itemVariants}
        initial="hidden"
        animate="visible"
        custom={0}
      >
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2
              className="text-xl font-semibold md:text-2xl"
              style={{ color: color("textPrimary") }}
            >
              天赋选择
            </h2>
            <p
              className="mt-2 text-sm leading-relaxed"
              style={{ color: colorAlpha("textMuted", 0.82) }}
            >
              每次抽取会生成一组候选天赋，你只能从当前候选中选择 1
              项。维度赠送的天赋会直接加入已获得列表，不消耗抽取次数。
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span
              className="rounded-full px-3 py-1 font-medium"
              style={{
                background: colorAlpha("primary", 0.12),
                color: color("primary"),
                border: `1px solid ${colorAlpha("primary", 0.22)}`,
              }}
            >
              剩余抽取次数：{remainingDraws}/{initialDrawCount}
            </span>

            {autoTalentIds.length > 0 ? (
              <span
                className="rounded-full px-3 py-1 text-xs font-medium"
                style={{
                  background: colorAlpha("secondary", 0.12),
                  color: color("secondary"),
                  border: `1px solid ${colorAlpha("secondary", 0.25)}`,
                }}
              >
                +{autoTalentIds.length} 维度赠送
              </span>
            ) : null}

            {excludedTalentIds.length > 0 ? (
              <span
                className="rounded-full px-3 py-1 text-xs"
                style={{
                  background: colorAlpha("warning", 0.12),
                  color: color("warning"),
                  border: `1px solid ${colorAlpha("warning", 0.2)}`,
                }}
              >
                {excludedTalentIds.length} 项维度排除
              </span>
            ) : null}
          </div>
        </div>
      </motion.div>

      <motion.div
        variants={itemVariants}
        initial="hidden"
        animate="visible"
        custom={1}
      >
        <Card variant="outlined" className="p-4 md:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3
                className="text-sm font-semibold uppercase tracking-[0.2em]"
                style={{ color: color("primary") }}
              >
                当前抽取
              </h3>
              <p
                className="mt-1 text-xs"
                style={{ color: colorAlpha("textMuted", 0.78) }}
              >
                {isOffering
                  ? `从 ${currentCandidates.length} 个候选中选择 1 项`
                  : isComplete
                    ? isPoolExhausted
                      ? "可抽取的有效天赋已耗尽，本步已提前结束。"
                      : "初始抽取已完成，可以进入下一步。"
                    : `准备开始第 ${selectedTalentIds.length + 1} 抽`}
              </p>
            </div>

            <div
              className="rounded-full px-3 py-1 text-xs"
              style={{
                background: colorAlpha("bgElevated", 0.72),
                color: colorAlpha("textSecondary", 0.88),
                border: `1px solid ${colorAlpha("border", 0.16)}`,
              }}
            >
              角色等级 Lv.{characterLevel}
            </div>
          </div>

          <AnimatePresence mode="wait">
            {!isOffering && !isComplete ? (
              <motion.div
                key="draw-ready"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed p-6 text-center"
                style={{
                  borderColor: colorAlpha("primary", 0.22),
                  background: `linear-gradient(135deg, ${colorAlpha("primary", 0.08)} 0%, ${colorAlpha("bgBase", 0.5)} 100%)`,
                }}
              >
                <div
                  className="mb-4 flex h-16 w-16 items-center justify-center rounded-full"
                  style={{
                    background: colorAlpha("primary", 0.14),
                    color: color("primary"),
                    boxShadow: glow("primary", "sm", 0.18),
                  }}
                >
                  <Sparkles className="h-7 w-7" />
                </div>

                <h4
                  className="text-lg font-semibold"
                  style={{ color: color("textPrimary") }}
                >
                  开始下一次天赋抽取
                </h4>
                <p
                  className="mt-2 max-w-xl text-sm leading-relaxed"
                  style={{ color: colorAlpha("textMuted", 0.82) }}
                >
                  将根据当前等级、已拥有天赋与维度限制，生成一组新的候选天赋。确认后本轮会出现{" "}
                  {nextDrawPreview.candidates.length || 0} 个可选项。
                </p>

                <Button
                  onClick={handleStartDraw}
                  className="mt-6"
                  disabled={nextDrawPreview.candidates.length === 0}
                >
                  开始抽取
                  <ChevronRight className="ml-1.5 h-4 w-4" />
                </Button>
              </motion.div>
            ) : null}

            {isOffering ? (
              <motion.div
                key="draw-offers"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  {currentOfferRecords.map(({ talent, rarity }, index) => (
                    <motion.div
                      key={talent.id}
                      custom={index}
                      variants={itemVariants}
                      initial="hidden"
                      animate="visible"
                    >
                      <TalentCard
                        talent={talent}
                        rarityLabel={rarity?.label ?? null}
                        rarityColorToken={rarity?.colorToken}
                        source="draw"
                        reason="点击即可选中"
                        interactive
                        onClick={() => handleSelectCandidate(talent.id)}
                      />
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            ) : null}

            {!isOffering && isComplete ? (
              <motion.div
                key="draw-complete"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="flex min-h-48 flex-col items-center justify-center rounded-2xl border p-6 text-center"
                style={{
                  borderColor: colorAlpha(
                    isPoolExhausted ? "warning" : "success",
                    0.22,
                  ),
                  background: `linear-gradient(135deg, ${colorAlpha(
                    isPoolExhausted ? "warning" : "success",
                    0.08,
                  )} 0%, ${colorAlpha("bgBase", 0.55)} 100%)`,
                }}
              >
                <div
                  className="mb-4 flex h-14 w-14 items-center justify-center rounded-full"
                  style={{
                    background: colorAlpha(
                      isPoolExhausted ? "warning" : "success",
                      0.14,
                    ),
                    color: color(isPoolExhausted ? "warning" : "success"),
                  }}
                >
                  <Check className="h-6 w-6" />
                </div>

                <h4
                  className="text-lg font-semibold"
                  style={{ color: color("textPrimary") }}
                >
                  {isPoolExhausted ? "已无更多可抽取天赋" : "抽取完成"}
                </h4>
                <p
                  className="mt-2 max-w-xl text-sm leading-relaxed"
                  style={{ color: colorAlpha("textMuted", 0.82) }}
                >
                  {isPoolExhausted
                    ? "当前世界、等级与维度限制下已经没有新的有效候选，本次角色创建的天赋抽取提前结束。"
                    : "你已经完成本次角色创建阶段的全部天赋抽取，可以继续下一步确认最终角色信息。"}
                </p>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </Card>
      </motion.div>

      <motion.div
        className="mt-6"
        variants={itemVariants}
        initial="hidden"
        animate="visible"
        custom={2}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h3
              className="text-sm font-semibold uppercase tracking-[0.2em]"
              style={{ color: color("secondary") }}
            >
              已获得天赋
            </h3>
            <p
              className="mt-1 text-xs"
              style={{ color: colorAlpha("textMuted", 0.78) }}
            >
              包含维度赠送与抽取选中的全部结果。最终会同步写入角色的 talentIds。
            </p>
          </div>

          <span
            className="rounded-full px-3 py-1 text-xs"
            style={{
              background: colorAlpha("secondary", 0.1),
              color: color("secondary"),
              border: `1px solid ${colorAlpha("secondary", 0.22)}`,
            }}
          >
            共 {obtainedTalentIds.length} 项
          </span>
        </div>

        {obtainedRecords.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <AnimatePresence>
              {obtainedRecords.map((record, index) => {
                const rarity = record.talent.rarity
                  ? (rarityById.get(record.talent.rarity) ?? null)
                  : null;

                return (
                  <motion.div
                    key={`${record.source}-${record.talentId}`}
                    layout
                    custom={index}
                    variants={itemVariants}
                    initial="hidden"
                    animate="visible"
                  >
                    <TalentCard
                      talent={record.talent}
                      rarityLabel={rarity?.label ?? null}
                      rarityColorToken={rarity?.colorToken}
                      source={record.source}
                      reason={record.reason}
                      interactive={false}
                    />
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        ) : (
          <Card variant="outlined" className="p-8 text-center">
            <Star
              className="mx-auto mb-3 h-8 w-8"
              style={{ color: color("textMuted") }}
            />
            <p
              className="text-sm"
              style={{ color: colorAlpha("textMuted", 0.82) }}
            >
              当前尚未获得任何天赋，点击上方按钮开始抽取。
            </p>
          </Card>
        )}
      </motion.div>
    </div>
  );
}
