import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronRight, Sparkles, Star, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button, Card } from "@/components/ui";
import type { PassiveModifier } from "@/domain/types/rule-script";
import { useMotionTokens } from "@/hooks";
import { generateTalentCandidates } from "@/lib/rules/talent-draw";
import {
  getTalentRarityVisual,
  type TalentRarityConfig,
} from "@/lib/ui/talent-rarity";
import type { TalentConfig } from "@/lib/world/types";
import {
  aggregateDimensionEffects,
  DEFAULT_WORLD_CONFIG,
} from "@/lib/world/types";
import { createStaggerVariants } from "@/styles/motion-variants";
import { color, colorAlpha, glow } from "@/styles/tokens";

import {
  getManualTalentIds,
  getRemainingCreationAttributePoints,
  getTalentAttributePointCost,
  usesSharedTalentPointBudget,
} from "../talent-point-budget";
import type { StepProps } from "../types";

type DrawPhase = "idle" | "offering";
type SourceType = "dimension" | "draw";

interface ObtainedTalentRecord {
  talentId: string;
  talent: TalentConfig;
  source: SourceType;
  reason: string;
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

function createUnknownTalent(talentId: string): TalentConfig {
  return {
    id: talentId,
    name: talentId,
    description: "该天赋未在当前世界配置中找到。",
  };
}

function TalentCard({
  talent,
  rarity,
  rarityLabel,
  source,
  reason,
  interactive,
  onClick,
}: {
  talent: TalentConfig;
  rarity: Pick<TalentRarityConfig, "colorToken" | "glowToken"> | null;
  rarityLabel: string | null;
  source: SourceType;
  reason: string;
  interactive: boolean;
  onClick?: () => void;
}) {
  const effectLines = useMemo(() => getTalentEffectLines(talent), [talent]);
  const sourceTone = source === "dimension" ? "secondary" : "primary";
  const rarityVisual = getTalentRarityVisual(rarity, {
    fallbackColor: sourceTone,
    fallbackGlow: sourceTone,
    backgroundAlpha: interactive ? 0.18 : 0.14,
    borderAlpha: interactive ? 0.38 : 0.32,
    glowAlpha: interactive ? 0.26 : 0.2,
    strongGlowAlpha: interactive ? 0.4 : 0.32,
  });

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
        className="relative h-full overflow-hidden p-4"
        style={{
          cursor: interactive ? "pointer" : "default",
          borderColor: rarityVisual.accentBorder,
          boxShadow: interactive
            ? rarityVisual.accentGlowStrong
            : rarityVisual.accentGlow,
          background: `linear-gradient(135deg, ${rarityVisual.accentSoft} 0%, ${colorAlpha(
            "bgElevated",
            0.88,
          )} 56%, ${rarityVisual.glowSoft} 100%)`,
        }}
      >
        <div className="flex items-start gap-3">
          <div
            className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
            style={{
              background: `linear-gradient(135deg, ${rarityVisual.accentSoft} 0%, ${rarityVisual.glowSoft} 100%)`,
              border: `1px solid ${rarityVisual.accentBorder}`,
              color: rarityVisual.accentColor,
              boxShadow: rarityVisual.accentGlow,
            }}
          >
            <Star className="h-5 w-5" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3
                className="text-sm font-semibold"
                style={{ color: rarityVisual.accentColor }}
              >
                {talent.name}
              </h3>

              {rarityLabel ? (
                <span
                  className="rounded-full px-2 py-0.5 text-[11px] font-medium"
                  style={{
                    background: rarityVisual.accentSoft,
                    color: rarityVisual.accentColor,
                    border: `1px solid ${rarityVisual.accentBorder}`,
                    boxShadow: rarityVisual.accentGlow,
                  }}
                >
                  {rarityLabel}
                </span>
              ) : null}

              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px]"
                style={{
                  background: colorAlpha(sourceTone, 0.12),
                  color: color(sourceTone),
                  border: `1px solid ${colorAlpha(sourceTone, 0.28)}`,
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

  const initialSelectedTalentIds = useMemo(
    () =>
      getManualTalentIds(
        worldConfig,
        context.dimensionSelections,
        context.talentIds,
      ),
    [context.dimensionSelections, context.talentIds, worldConfig],
  );

  const [selectedTalentIds, setSelectedTalentIds] = useState<string[]>(
    initialSelectedTalentIds,
  );
  const [drawPhase, setDrawPhase] = useState<DrawPhase>("idle");
  const [currentCandidates, setCurrentCandidates] = useState<TalentConfig[]>(
    [],
  );
  const [pendingSkippedTalentIds, setPendingSkippedTalentIds] = useState<
    string[]
  >([]);

  const obtainedTalentIds = useMemo(
    () => [...new Set([...autoTalentIds, ...selectedTalentIds])],
    [autoTalentIds, selectedTalentIds],
  );
  const talentPointCost = getTalentAttributePointCost(worldConfig);
  const remainingAttributePoints = getRemainingCreationAttributePoints(
    worldConfig,
    context.allocatedPoints,
    selectedTalentIds.length,
  );
  const isSharedBudgetMode = usesSharedTalentPointBudget(worldConfig);

  const remainingDraws = Math.max(
    initialDrawCount - selectedTalentIds.length,
    0,
  );

  const nextDrawExcludedTalentIds = useMemo(
    () => [...new Set([...excludedTalentIds, ...pendingSkippedTalentIds])],
    [excludedTalentIds, pendingSkippedTalentIds],
  );

  const getDrawPreview = useCallback(
    (extraExcludedTalentIds: string[] = []) => {
      if (remainingDraws <= 0) {
        return { candidates: [], poolUsed: null };
      }

      if (isSharedBudgetMode && remainingAttributePoints < talentPointCost) {
        return { candidates: [], poolUsed: null };
      }

      return generateTalentCandidates({
        allTalents,
        ownedTalentIds: obtainedTalentIds,
        talentRules: worldConfig.talentRules,
        excludeTalentIds: [
          ...new Set([...nextDrawExcludedTalentIds, ...extraExcludedTalentIds]),
        ],
      });
    },
    [
      allTalents,
      isSharedBudgetMode,
      nextDrawExcludedTalentIds,
      obtainedTalentIds,
      remainingAttributePoints,
      remainingDraws,
      talentPointCost,
      worldConfig.talentRules,
    ],
  );

  const nextDrawPreview = useMemo(() => getDrawPreview(), [getDrawPreview]);

  const isOffering = drawPhase === "offering" && currentCandidates.length > 0;
  const isSelectionLimitReached = remainingDraws === 0;
  const isOutOfAttributePoints =
    isSharedBudgetMode &&
    remainingDraws > 0 &&
    remainingAttributePoints < talentPointCost;
  const isPoolExhausted =
    !isOutOfAttributePoints &&
    remainingDraws > 0 &&
    nextDrawPreview.candidates.length === 0;
  const canStartDraw =
    !isOffering &&
    remainingDraws > 0 &&
    !isOutOfAttributePoints &&
    nextDrawPreview.candidates.length > 0;
  const canLeaveStep = !isOffering;

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

    selectedTalentIds.forEach((talentId) => {
      records.push({
        talentId,
        talent: talentsById.get(talentId) ?? createUnknownTalent(talentId),
        source: "draw",
        reason: "手动选择",
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
    onValidationChange?.(canLeaveStep);
  }, [canLeaveStep, onValidationChange]);

  const handleStartDraw = useCallback(() => {
    if (!canStartDraw) {
      return;
    }

    setCurrentCandidates(nextDrawPreview.candidates);
    setDrawPhase("offering");
    setPendingSkippedTalentIds([]);
  }, [canStartDraw, nextDrawPreview.candidates]);

  const handleRerollCurrentOffer = useCallback(() => {
    if (!isOffering) {
      return;
    }

    const skippedTalentIds = currentCandidates.map((talent) => talent.id);
    const rerolledPreview = getDrawPreview(skippedTalentIds);

    if (rerolledPreview.candidates.length > 0) {
      setCurrentCandidates(rerolledPreview.candidates);
      setPendingSkippedTalentIds([]);
      return;
    }

    setPendingSkippedTalentIds(skippedTalentIds);
    setCurrentCandidates([]);
    setDrawPhase("idle");
  }, [currentCandidates, getDrawPreview, isOffering]);

  const handleRemoveSelectedTalent = useCallback(
    (talentId: string) => {
      if (isOffering) {
        return;
      }

      setSelectedTalentIds((prev) => prev.filter((id) => id !== talentId));
    },
    [isOffering],
  );

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
              每次抽取会生成一组候选天赋，你可以从当前候选中选择 1
              项，也可以重新抽取当前结果。维度赠送的天赋会直接加入已获得列表，不消耗手动选择槽位。
              {isSharedBudgetMode
                ? ` 每次手动选择还会额外消耗 ${talentPointCost} 点属性点。`
                : ""}
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
              剩余可保留槽位：{remainingDraws}/{initialDrawCount}
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

            {isSharedBudgetMode ? (
              <span
                className="rounded-full px-3 py-1 text-xs font-medium"
                style={{
                  background: colorAlpha(
                    remainingAttributePoints < talentPointCost
                      ? "warning"
                      : "primary",
                    0.12,
                  ),
                  color: color(
                    remainingAttributePoints < talentPointCost
                      ? "warning"
                      : "primary",
                  ),
                  border: `1px solid ${colorAlpha(
                    remainingAttributePoints < talentPointCost
                      ? "warning"
                      : "primary",
                    0.22,
                  )}`,
                }}
              >
                剩余属性点：{remainingAttributePoints}
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
                  ? `当前有 ${currentCandidates.length} 个候选待处理，选择 1 项或重新抽取后才能继续。`
                  : canStartDraw
                    ? selectedTalentIds.length > 0
                      ? "你可以继续抽取新的候选，也可以直接进入下一步。"
                      : "你可以开始抽取天赋，也可以暂时不选直接进入下一步。"
                    : isSelectionLimitReached
                      ? "手动已选天赋已达上限；可移除已选项后继续抽取，或直接进入下一步。"
                      : isOutOfAttributePoints
                        ? "共享属性点不足；可移除已选项后继续抽取，或直接进入下一步。"
                        : isPoolExhausted
                          ? "当前已无新的有效候选；可直接进入下一步，或移除已选项后再试。"
                          : "当前可以直接进入下一步。"}
              </p>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {!isOffering && canStartDraw ? (
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
                  将根据当前已拥有天赋与维度限制，生成一组新的候选天赋。你也可以先进入下一步，稍后再返回调整。
                  {nextDrawPreview.candidates.length > 0
                    ? ` 本轮预计出现 ${nextDrawPreview.candidates.length} 个可选项。`
                    : ""}
                  {isSharedBudgetMode
                    ? ` 若本轮选中天赋，还会额外消耗 ${talentPointCost} 点属性点。`
                    : ""}
                </p>

                <Button
                  onClick={handleStartDraw}
                  className="mt-6"
                  disabled={!canStartDraw}
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
                        rarity={rarity}
                        rarityLabel={rarity?.label ?? null}
                        source="draw"
                        reason="点击即可选中"
                        interactive
                        onClick={() => handleSelectCandidate(talent.id)}
                      />
                    </motion.div>
                  ))}
                </div>

                <div className="mt-4 flex justify-end">
                  <Button variant="ghost" onClick={handleRerollCurrentOffer}>
                    重新抽取
                  </Button>
                </div>
              </motion.div>
            ) : null}

            {!isOffering && !canStartDraw ? (
              <motion.div
                key="draw-blocked"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="flex min-h-48 flex-col items-center justify-center rounded-2xl border p-6 text-center"
                style={{
                  borderColor: colorAlpha(
                    isOutOfAttributePoints || isPoolExhausted
                      ? "warning"
                      : "secondary",
                    0.22,
                  ),
                  background: `linear-gradient(135deg, ${colorAlpha(
                    isOutOfAttributePoints || isPoolExhausted
                      ? "warning"
                      : "secondary",
                    0.08,
                  )} 0%, ${colorAlpha("bgBase", 0.55)} 100%)`,
                }}
              >
                <div
                  className="mb-4 flex h-14 w-14 items-center justify-center rounded-full"
                  style={{
                    background: colorAlpha(
                      isOutOfAttributePoints || isPoolExhausted
                        ? "warning"
                        : "secondary",
                      0.14,
                    ),
                    color: color(
                      isOutOfAttributePoints || isPoolExhausted
                        ? "warning"
                        : "secondary",
                    ),
                  }}
                >
                  <Check className="h-6 w-6" />
                </div>

                <h4
                  className="text-lg font-semibold"
                  style={{ color: color("textPrimary") }}
                >
                  {isSelectionLimitReached
                    ? "手动天赋已达上限"
                    : isOutOfAttributePoints
                      ? "共享属性点不足"
                      : isPoolExhausted
                        ? "已无更多可抽取天赋"
                        : "当前无需继续抽取"}
                </h4>
                <p
                  className="mt-2 max-w-xl text-sm leading-relaxed"
                  style={{ color: colorAlpha("textMuted", 0.82) }}
                >
                  {isSelectionLimitReached
                    ? "你已保留最多数量的手动天赋。若想继续追求更好的结果，可先从下方移除已选天赋，再继续抽取；也可以直接进入下一步。"
                    : isOutOfAttributePoints
                      ? "当前共享属性点不足以支付新的手动天赋。若想继续抽取，可先移除部分已选天赋回收预算；也可以直接进入下一步。"
                      : isPoolExhausted
                        ? "当前世界、已拥有天赋与维度限制下已经没有新的有效候选。你可以直接进入下一步，或移除已选天赋后重新尝试。"
                        : "当前没有待处理候选，你可以直接进入下一步。"}
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
              包含维度赠送与抽取选中的全部结果。手动选择获得的天赋可移除，维度赠送不可移除。最终会同步写入角色的
              talentIds。
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
                    <div className="space-y-2">
                      <TalentCard
                        talent={record.talent}
                        rarity={rarity}
                        rarityLabel={rarity?.label ?? null}
                        source={record.source}
                        reason={record.reason}
                        interactive={false}
                      />

                      {record.source === "draw" ? (
                        <div className="flex justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              handleRemoveSelectedTalent(record.talentId)
                            }
                            disabled={isOffering}
                          >
                            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                            移除已选
                          </Button>
                        </div>
                      ) : null}
                    </div>
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
