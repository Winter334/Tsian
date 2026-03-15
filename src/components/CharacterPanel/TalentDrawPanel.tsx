import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, ChevronUp, Sparkles, Star } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button, Card, Panel } from "@/components/ui";
import {
  RoomCommands,
  type ClaimTalentDrawPayload,
} from "@/domain/commands/room";
import type { Character, PendingTalentDraw } from "@/domain/entities/character";
import type { PassiveModifier } from "@/domain/types/rule-script";
import { useCommand, useToast } from "@/hooks";
import { generateTalentCandidates } from "@/lib/rules/talent-draw";
import {
  getTalentRarityVisual,
  type TalentRarityConfig,
} from "@/lib/ui/talent-rarity";
import { getOrCreateUserId, getUniqueTag } from "@/lib/user-identity";
import {
  aggregateDimensionEffects,
  type TalentConfig,
  type WorldConfig,
} from "@/lib/world/types";
import { useRoomInfo } from "@/modules";
import { color, colorAlpha, glow } from "@/styles/tokens";

interface TalentDrawPanelProps {
  character: Character;
  worldConfig: WorldConfig;
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

function getPendingDrawSourceLabel(draw: PendingTalentDraw): string {
  const source = draw.source?.trim();
  return source && source.length > 0 ? source : "成长奖励";
}

function TalentCandidateCard({
  talent,
  rarity,
  rarityLabel,
  selected,
  disabled,
  onClick,
}: {
  talent: TalentConfig;
  rarity: Pick<TalentRarityConfig, "colorToken" | "glowToken"> | null;
  rarityLabel: string | null;
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const effectLines = useMemo(() => getTalentEffectLines(talent), [talent]);
  const rarityVisual = getTalentRarityVisual(rarity, {
    fallbackColor: "primary",
    fallbackGlow: "primary",
    backgroundAlpha: selected ? 0.18 : 0.12,
    borderAlpha: selected ? 0.46 : 0.3,
    glowAlpha: selected ? 0.26 : 0.16,
    strongGlowAlpha: selected ? 0.42 : 0.3,
    glowSize: selected ? "md" : "sm",
    strongGlowSize: "lg",
  });

  return (
    <Card
      variant={selected ? "elevated" : "outlined"}
      hover={!disabled}
      onClick={disabled ? undefined : onClick}
      className="h-full p-4"
      style={{
        borderColor: rarityVisual.accentBorder,
        boxShadow: selected
          ? `${rarityVisual.accentGlowStrong}, inset 0 0 0 1px ${rarityVisual.glowSoft}`
          : rarityVisual.accentGlow,
        background: `linear-gradient(135deg, ${rarityVisual.accentSoft} 0%, ${colorAlpha(
          "bgElevated",
          0.86,
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
            <h4
              className="text-sm font-semibold"
              style={{ color: rarityVisual.accentColor }}
            >
              {talent.name}
            </h4>

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

            {selected ? (
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
                style={{
                  background: rarityVisual.accentSoft,
                  color: rarityVisual.accentColor,
                  border: `1px solid ${rarityVisual.accentBorder}`,
                  boxShadow: rarityVisual.accentGlow,
                }}
              >
                <Check className="h-3 w-3" />
                已选中
              </span>
            ) : null}
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
  );
}

export function TalentDrawPanel({
  character,
  worldConfig,
}: TalentDrawPanelProps) {
  const dispatch = useCommand();
  const toast = useToast();
  const { currentRoom } = useRoomInfo();
  const currentUserId = useMemo(() => getOrCreateUserId(), []);
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeDraw, setActiveDraw] = useState<PendingTalentDraw | null>(null);
  const [candidates, setCandidates] = useState<TalentConfig[]>([]);
  const [selectedTalentId, setSelectedTalentId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const pendingDraws = useMemo(
    () => character.pendingTalentDraws ?? [],
    [character.pendingTalentDraws],
  );
  const allTalents = useMemo(
    () => worldConfig.talents ?? [],
    [worldConfig.talents],
  );
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
  const poolById = useMemo(
    () =>
      new Map(
        (worldConfig.talentRules?.pools ?? []).map((pool) => [pool.id, pool]),
      ),
    [worldConfig.talentRules?.pools],
  );
  const dimensionEffects = useMemo(
    () =>
      aggregateDimensionEffects(
        worldConfig,
        character.dimensionSelections ?? {},
      ),
    [character.dimensionSelections, worldConfig],
  );
  const ownedTalentIds = useMemo(
    () =>
      Array.from(
        new Set([
          ...(character.talentIds ?? []),
          ...dimensionEffects.grantedTalents,
        ]),
      ),
    [character.talentIds, dimensionEffects.grantedTalents],
  );
  const roomId = currentRoom?.roomId ?? null;
  const uniqueTag = getUniqueTag() ?? "";
  const confirmBlockedReason = !roomId
    ? "当前房间上下文不可用，暂时无法确认天赋。"
    : !uniqueTag
      ? "当前身份未完成初始化，暂时无法确认天赋。"
      : null;
  const selectedTalent = selectedTalentId
    ? (talentsById.get(selectedTalentId) ??
      candidates.find((candidate) => candidate.id === selectedTalentId) ??
      null)
    : null;

  useEffect(() => {
    if (activeDraw && !pendingDraws.some((draw) => draw.id === activeDraw.id)) {
      setActiveDraw(null);
      setCandidates([]);
      setSelectedTalentId(null);
    }
  }, [activeDraw, pendingDraws]);

  useEffect(() => {
    if (
      selectedTalentId &&
      !candidates.some((talent) => talent.id === selectedTalentId)
    ) {
      setSelectedTalentId(null);
    }
  }, [candidates, selectedTalentId]);

  const handleToggleExpanded = useCallback(() => {
    setIsExpanded((current) => !current);
  }, []);

  const handleStartDraw = useCallback(
    (draw: PendingTalentDraw) => {
      const result = generateTalentCandidates({
        allTalents,
        ownedTalentIds,
        talentRules: worldConfig.talentRules,
        offersPerDraw:
          draw.offersPerDraw ?? worldConfig.talentRules?.initialOffersPerDraw,
        poolId: draw.poolId,
        guaranteedRarity: draw.guaranteedRarity,
        excludeTalentIds: dimensionEffects.excludedTalents,
      });

      setIsExpanded(true);
      setActiveDraw(draw);
      setCandidates(result.candidates);
      setSelectedTalentId(null);
      setSuccessMessage(null);

      if (result.candidates.length === 0) {
        toast.warning(
          "暂无可选天赋",
          "当前已拥有天赋与维度限制下没有新的有效候选。",
        );
      }
    },
    [
      allTalents,
      dimensionEffects.excludedTalents,
      ownedTalentIds,
      toast,
      worldConfig.talentRules,
    ],
  );

  const handleCancelActiveDraw = useCallback(() => {
    if (submitting) {
      return;
    }

    setActiveDraw(null);
    setCandidates([]);
    setSelectedTalentId(null);
  }, [submitting]);

  const handleConfirm = useCallback(async () => {
    if (!activeDraw) {
      return;
    }

    if (!selectedTalentId) {
      toast.warning("尚未选择天赋", "请先从候选列表中选择一个天赋。");
      return;
    }

    if (!roomId) {
      toast.error("无法确认天赋", "当前房间上下文不可用");
      return;
    }

    if (!uniqueTag) {
      toast.error("无法确认天赋", "当前身份未完成初始化");
      return;
    }

    setSubmitting(true);

    try {
      const result = await dispatch<ClaimTalentDrawPayload, void>({
        type: RoomCommands.CLAIM_TALENT_DRAW,
        payload: {
          roomId,
          characterId: character.id,
          userId: currentUserId,
          uniqueTag,
          pendingDrawId: activeDraw.id,
          selectedTalentId,
        },
      });

      if (!result.success) {
        toast.error("天赋领取失败", result.error || "请稍后重试");
        return;
      }

      const talentName =
        talentsById.get(selectedTalentId)?.name ?? selectedTalentId;
      setSuccessMessage(`已确认领取「${talentName}」`);
      setActiveDraw(null);
      setCandidates([]);
      setSelectedTalentId(null);
      toast.success("天赋领取成功", `已获得「${talentName}」`);
    } catch (error) {
      toast.error(
        "天赋领取失败",
        error instanceof Error ? error.message : "请稍后重试",
      );
    } finally {
      setSubmitting(false);
    }
  }, [
    activeDraw,
    character.id,
    currentUserId,
    dispatch,
    roomId,
    selectedTalentId,
    talentsById,
    toast,
    uniqueTag,
  ]);

  if (pendingDraws.length === 0) {
    return null;
  }

  return (
    <Panel
      className="space-y-4 p-4"
      style={{
        background: colorAlpha("bgElevated", 0.5),
        border: `1px solid ${colorAlpha("secondary", 0.18)}`,
        boxShadow: glow("secondary", "sm", 0.12),
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span style={{ color: color("secondary") }}>
              <Sparkles className="h-4 w-4" />
            </span>
            <h3
              className="text-sm font-semibold uppercase tracking-[0.16em]"
              style={{ color: color("secondary") }}
            >
              🎴 {pendingDraws.length} 次天赋抽取待领取
            </h3>
          </div>
          <p
            className="text-xs leading-relaxed"
            style={{ color: colorAlpha("textSecondary", 0.84) }}
          >
            候选会在本地生成，只有确认领取后才会通过 CommandBus 写入角色天赋。
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div
            className="shrink-0 rounded-full px-3 py-1 text-sm font-semibold"
            style={{
              background: colorAlpha("secondary", 0.14),
              color: color("secondary"),
              border: `1px solid ${colorAlpha("secondary", 0.24)}`,
              boxShadow: glow("secondary", "sm", 0.16),
            }}
          >
            待处理 {pendingDraws.length}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="px-3"
            onClick={handleToggleExpanded}
          >
            {isExpanded ? "收起" : "展开"}
            {isExpanded ? (
              <ChevronUp className="ml-1.5 h-4 w-4" />
            ) : (
              <ChevronDown className="ml-1.5 h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {isExpanded ? (
          <motion.div
            key="talent-draw-content"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            {successMessage ? (
              <div
                className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm"
                style={{
                  background: colorAlpha("success", 0.1),
                  color: color("success"),
                  border: `1px solid ${colorAlpha("success", 0.22)}`,
                }}
              >
                <Check className="h-4 w-4 shrink-0" />
                <span>{successMessage}</span>
              </div>
            ) : null}

            <div className="space-y-3">
              {pendingDraws.map((draw, index) => {
                const offersPerDraw =
                  draw.offersPerDraw ??
                  worldConfig.talentRules?.initialOffersPerDraw ??
                  3;
                const poolLabel = draw.poolId
                  ? (poolById.get(draw.poolId)?.label ?? draw.poolId)
                  : "默认抽取池";
                const guaranteedRarityLabel = draw.guaranteedRarity
                  ? (rarityById.get(draw.guaranteedRarity)?.label ??
                    draw.guaranteedRarity)
                  : null;
                const isActive = activeDraw?.id === draw.id;

                return (
                  <Card
                    key={draw.id}
                    variant={isActive ? "elevated" : "outlined"}
                    hover={!submitting}
                    className="p-4"
                    style={{
                      borderColor: isActive
                        ? colorAlpha("secondary", 0.3)
                        : colorAlpha("border", 0.28),
                      background: isActive
                        ? `linear-gradient(135deg, ${colorAlpha(
                            "secondary",
                            0.08,
                          )} 0%, ${colorAlpha("bgElevated", 0.84)} 100%)`
                        : undefined,
                      boxShadow: isActive
                        ? glow("secondary", "sm", 0.12)
                        : undefined,
                    }}
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className="rounded-full px-2 py-0.5 text-[11px] font-medium"
                            style={{
                              background: colorAlpha("secondary", 0.12),
                              color: color("secondary"),
                              border: `1px solid ${colorAlpha(
                                "secondary",
                                0.24,
                              )}`,
                            }}
                          >
                            待领取 #{index + 1}
                          </span>
                          <span
                            className="rounded-full px-2 py-0.5 text-[11px]"
                            style={{
                              background: colorAlpha("primary", 0.08),
                              color: colorAlpha("textSecondary", 0.92),
                              border: `1px solid ${colorAlpha("border", 0.2)}`,
                            }}
                          >
                            来源：{getPendingDrawSourceLabel(draw)}
                          </span>
                          <span
                            className="rounded-full px-2 py-0.5 text-[11px]"
                            style={{
                              background: colorAlpha("primary", 0.08),
                              color: colorAlpha("textSecondary", 0.92),
                              border: `1px solid ${colorAlpha("border", 0.2)}`,
                            }}
                          >
                            {offersPerDraw} 候选
                          </span>
                          <span
                            className="rounded-full px-2 py-0.5 text-[11px]"
                            style={{
                              background: colorAlpha("primary", 0.08),
                              color: colorAlpha("textSecondary", 0.92),
                              border: `1px solid ${colorAlpha("border", 0.2)}`,
                            }}
                          >
                            抽取池：{poolLabel}
                          </span>
                          {guaranteedRarityLabel ? (
                            <span
                              className="rounded-full px-2 py-0.5 text-[11px]"
                              style={{
                                background: colorAlpha("warning", 0.1),
                                color: color("warning"),
                                border: `1px solid ${colorAlpha(
                                  "warning",
                                  0.2,
                                )}`,
                              }}
                            >
                              保底：{guaranteedRarityLabel}
                            </span>
                          ) : null}
                        </div>

                        <p
                          className="text-xs leading-relaxed"
                          style={{ color: colorAlpha("textMuted", 0.82) }}
                        >
                          将根据当前已拥有天赋和维度限制生成本次候选列表。
                        </p>
                      </div>

                      <Button
                        type="button"
                        variant={isActive ? "secondary" : "ghost"}
                        onClick={() => handleStartDraw(draw)}
                        disabled={submitting}
                      >
                        {isActive ? "重新查看候选" : "开始抽取"}
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>

            {activeDraw ? (
              <motion.div
                key={activeDraw.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                <div
                  className="rounded-2xl border p-4"
                  style={{
                    borderColor: colorAlpha("primary", 0.18),
                    background: `linear-gradient(135deg, ${colorAlpha(
                      "primary",
                      0.06,
                    )} 0%, ${colorAlpha("bgBase", 0.55)} 100%)`,
                  }}
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Sparkles
                          className="h-4 w-4"
                          style={{ color: color("primary") }}
                        />
                        <h4
                          className="text-sm font-semibold uppercase tracking-[0.16em]"
                          style={{ color: color("primary") }}
                        >
                          当前抽取：{getPendingDrawSourceLabel(activeDraw)}
                        </h4>
                      </div>
                      <p
                        className="text-xs leading-relaxed"
                        style={{ color: colorAlpha("textSecondary", 0.84) }}
                      >
                        候选仅存在于本地界面中，确认后会提交
                        RoomCommands.CLAIM_TALENT_DRAW。
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={handleCancelActiveDraw}
                        disabled={submitting}
                      >
                        返回待领取列表
                      </Button>
                      <Button
                        type="button"
                        onClick={handleConfirm}
                        disabled={
                          submitting ||
                          !selectedTalentId ||
                          candidates.length === 0 ||
                          confirmBlockedReason !== null
                        }
                      >
                        {submitting ? "确认中..." : "确认领取"}
                      </Button>
                    </div>
                  </div>

                  {confirmBlockedReason ? (
                    <p
                      className="mt-3 text-xs"
                      style={{ color: colorAlpha("warning", 0.9) }}
                    >
                      {confirmBlockedReason}
                    </p>
                  ) : null}
                </div>

                {candidates.length > 0 ? (
                  <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
                    {candidates.map((candidate) => {
                      const rarity = candidate.rarity
                        ? (rarityById.get(candidate.rarity) ?? null)
                        : null;

                      return (
                        <motion.div
                          key={candidate.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.18 }}
                        >
                          <TalentCandidateCard
                            talent={candidate}
                            rarity={rarity}
                            rarityLabel={rarity?.label ?? null}
                            selected={selectedTalentId === candidate.id}
                            disabled={submitting}
                            onClick={() => setSelectedTalentId(candidate.id)}
                          />
                        </motion.div>
                      );
                    })}
                  </div>
                ) : (
                  <div
                    className="rounded-2xl border p-5 text-sm"
                    style={{
                      borderColor: colorAlpha("warning", 0.2),
                      background: `linear-gradient(135deg, ${colorAlpha(
                        "warning",
                        0.08,
                      )} 0%, ${colorAlpha("bgBase", 0.55)} 100%)`,
                      color: colorAlpha("textSecondary", 0.9),
                    }}
                  >
                    当前已拥有天赋和维度限制下没有新的有效候选，暂时无法完成本次抽取。
                  </div>
                )}

                {selectedTalent ? (
                  <div
                    className="rounded-2xl border p-4"
                    style={{
                      borderColor: colorAlpha("success", 0.2),
                      background: colorAlpha("success", 0.06),
                    }}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Check
                        className="h-4 w-4"
                        style={{ color: color("success") }}
                      />
                      <span
                        className="text-sm font-medium"
                        style={{ color: color("textPrimary") }}
                      >
                        当前已选择：{selectedTalent.name}
                      </span>
                    </div>
                  </div>
                ) : null}
              </motion.div>
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </Panel>
  );
}
