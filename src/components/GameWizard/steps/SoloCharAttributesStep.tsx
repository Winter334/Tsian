/**
 * 角色创建 - 步骤4：属性点数分配
 *
 * 从 worldConfig.pointBuyRules 获取可分配属性和总点数，
 * 使用紧凑网格卡片进行分配，并在顶部雷达图实时预览属性形态。
 *
 * 关键特性：
 * - 简化版 SVG 雷达图（六边形网格 + 动态数据面）
 * - 属性卡片 2 列紧凑布局（默认 6 项即 3x2）
 * - 剩余点数为 0 前禁止下一步（通过 onValidationChange 通知父级）
 * - 数据实时同步到向导上下文
 */

import { AnimatePresence, motion } from "framer-motion";
import { Check, Minus, Plus, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui";
import { useMotionTokens } from "@/hooks";
import type { WorldConfig } from "@/lib/world/types";
import {
  aggregateDimensionEffects,
  DEFAULT_WORLD_CONFIG,
} from "@/lib/world/types";
import { createStaggerVariants } from "@/styles/motion-variants";
import { color, colorAlpha, glow } from "@/styles/tokens";

import {
  getManualTalentIds,
  getSpentTalentAttributePoints,
  getTalentAttributePointCost,
} from "../talent-point-budget";
import type { StepProps } from "../types";

// ============================================================
// 常量与工具函数
// ============================================================

const RADAR_SIZE = 192;
const RADAR_CENTER = RADAR_SIZE / 2;
const RADAR_RADIUS = RADAR_SIZE / 2 - 36;
const RADAR_RING_COUNT = 4;

const ATTRIBUTE_SHORT_LABELS: Record<string, string> = {
  str: "STR",
  vit: "VIT",
  agi: "AGI",
  int: "INT",
  spr: "SPR",
  luk: "LUK",
  STR: "STR",
  VIT: "VIT",
  AGI: "AGI",
  INT: "INT",
  SPR: "SPR",
  LUK: "LUK",
};

interface RadarAxis {
  key: string;
  shortLabel: string;
  value: number;
  normalized: number;
}

/** 获取属性配置 */
function getAttrConfig(key: string, worldConfig: WorldConfig) {
  return worldConfig.primaryAttributes.find((a) => a.key === key);
}

/** 属性短标签（优先标准映射） */
function getAttributeShortLabel(key: string): string {
  return ATTRIBUTE_SHORT_LABELS[key] ?? key.toUpperCase();
}

/** 0~1 clamp */
function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

/** 归一化（带安全保护） */
function safeNormalize(value: number, min: number, max: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(min) || !Number.isFinite(max))
    return 0;
  if (max <= min) return 0;
  return clamp01((value - min) / (max - min));
}

/** 计算规则多边形顶点 */
function getRegularPolygonPoints(
  total: number,
  cx: number,
  cy: number,
  radius: number,
): string {
  return Array.from({ length: total }, (_, index) => {
    const angle = (Math.PI * 2 * index) / total - Math.PI / 2;
    return `${cx + radius * Math.cos(angle)},${cy + radius * Math.sin(angle)}`;
  }).join(" ");
}

/** 计算雷达数据面的 points 字符串 */
function getRadarPoints(
  axes: RadarAxis[],
  cx: number,
  cy: number,
  radius: number,
): string {
  return axes
    .map((axis, index) => {
      const angle = (Math.PI * 2 * index) / axes.length - Math.PI / 2;
      const r = radius * axis.normalized;
      return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
    })
    .join(" ");
}

/** 轴标签坐标与锚点 */
function getLabelPosition(
  index: number,
  total: number,
  cx: number,
  cy: number,
  radius: number,
): { x: number; y: number; anchor: "middle" | "start" | "end" } {
  const angle = (Math.PI * 2 * index) / total - Math.PI / 2;
  const labelRadius = radius + 16;
  const x = cx + labelRadius * Math.cos(angle);
  const y = cy + labelRadius * Math.sin(angle);

  const angleDeg = ((angle * 180) / Math.PI + 360) % 360;
  let anchor: "middle" | "start" | "end" = "middle";
  if (angleDeg > 10 && angleDeg < 170) anchor = "start";
  else if (angleDeg > 190 && angleDeg < 350) anchor = "end";

  return { x, y, anchor };
}

/** 格式化修正来源文本 */
function formatBreakdown(
  defaultValue: number,
  allocated: number,
  dimensionMod: number,
): string {
  const parts: string[] = [`基础 ${defaultValue}`];
  if (allocated > 0) parts.push(`分配 +${allocated}`);
  if (dimensionMod > 0) parts.push(`维度 +${dimensionMod}`);
  if (dimensionMod < 0) parts.push(`维度 ${dimensionMod}`);
  return parts.join(" · ");
}

/** 格式化正负号 */
function formatSigned(value: number): string {
  if (value === 0) return "0";
  return value > 0 ? `+${value}` : `${value}`;
}

// ============================================================
// 子组件：简化雷达图
// ============================================================

function MiniAttributeRadarChart({ axes }: { axes: RadarAxis[] }) {
  if (axes.length < 3) {
    return (
      <div
        className="h-48 flex items-center justify-center text-sm"
        style={{ color: color("textMuted") }}
      >
        属性不足，无法生成雷达图
      </div>
    );
  }

  const gridPoints = getRegularPolygonPoints(
    axes.length,
    RADAR_CENTER,
    RADAR_CENTER,
    RADAR_RADIUS,
  );
  const polygonPoints = getRadarPoints(
    axes,
    RADAR_CENTER,
    RADAR_CENTER,
    RADAR_RADIUS,
  );

  return (
    <div className="flex justify-center">
      <svg
        viewBox={`0 0 ${RADAR_SIZE} ${RADAR_SIZE}`}
        className="w-48 h-48"
        style={{ overflow: "visible" }}
      >
        {/* 网格层 */}
        <g>
          {Array.from({ length: RADAR_RING_COUNT }, (_, ringIndex) => {
            const ringRadius =
              (RADAR_RADIUS * (ringIndex + 1)) / RADAR_RING_COUNT;
            return (
              <polygon
                key={`ring-${ringIndex}`}
                points={getRegularPolygonPoints(
                  axes.length,
                  RADAR_CENTER,
                  RADAR_CENTER,
                  ringRadius,
                )}
                fill="none"
                stroke={colorAlpha("primary", 0.08 + ringIndex * 0.02)}
                strokeWidth={0.7}
              />
            );
          })}

          {axes.map((_, index) => {
            const angle = (Math.PI * 2 * index) / axes.length - Math.PI / 2;
            return (
              <line
                key={`axis-${index}`}
                x1={RADAR_CENTER}
                y1={RADAR_CENTER}
                x2={RADAR_CENTER + RADAR_RADIUS * Math.cos(angle)}
                y2={RADAR_CENTER + RADAR_RADIUS * Math.sin(angle)}
                stroke={colorAlpha("primary", 0.12)}
                strokeWidth={0.7}
              />
            );
          })}

          <polygon
            points={gridPoints}
            fill="none"
            stroke={colorAlpha("primary", 0.2)}
            strokeWidth={1}
          />
        </g>

        {/* 数据面 */}
        <motion.polygon
          fill={colorAlpha("primary", 0.2)}
          stroke={colorAlpha("primary", 0.8)}
          strokeWidth={1.8}
          strokeLinejoin="round"
          initial={false}
          animate={{ points: polygonPoints }}
          transition={{ duration: 0.32, ease: "easeOut" }}
        />

        {/* 顶点圆点 */}
        {axes.map((axis, index) => {
          const angle = (Math.PI * 2 * index) / axes.length - Math.PI / 2;
          const r = RADAR_RADIUS * axis.normalized;
          const x = RADAR_CENTER + r * Math.cos(angle);
          const y = RADAR_CENTER + r * Math.sin(angle);

          return (
            <motion.circle
              key={axis.key}
              r={2.7}
              fill={color("primary")}
              stroke={colorAlpha("bgBase", 0.9)}
              strokeWidth={0.8}
              initial={false}
              animate={{ cx: x, cy: y }}
              transition={{ duration: 0.32, ease: "easeOut" }}
              style={{
                filter: `drop-shadow(0 0 4px ${colorAlpha("primary", 0.5)})`,
              }}
            />
          );
        })}

        {/* 轴标签（缩写） */}
        {axes.map((axis, index) => {
          const pos = getLabelPosition(
            index,
            axes.length,
            RADAR_CENTER,
            RADAR_CENTER,
            RADAR_RADIUS,
          );
          return (
            <text
              key={`label-${axis.key}`}
              x={pos.x}
              y={pos.y}
              textAnchor={pos.anchor}
              dominantBaseline="middle"
              fontSize={10}
              fontWeight={700}
              letterSpacing={0.5}
              fill={color("textSecondary")}
            >
              {axis.shortLabel}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

// ============================================================
// 子组件：属性卡片
// ============================================================

function AttributeCard({
  attrKey,
  label,
  description,
  defaultValue,
  allocated,
  dimensionMod,
  dimensionSourceText,
  maxAlloc,
  canIncrease,
  onIncrease,
  onDecrease,
}: {
  attrKey: string;
  label: string;
  description?: string;
  defaultValue: number;
  allocated: number;
  dimensionMod: number;
  dimensionSourceText?: string;
  maxAlloc: number;
  canIncrease: boolean;
  onIncrease: () => void;
  onDecrease: () => void;
}) {
  const finalValue = defaultValue + allocated + dimensionMod;
  const canDecrease = allocated > 0;
  const atMaxAlloc = allocated >= maxAlloc;
  const hasDimensionMod = dimensionMod !== 0;
  const dimensionTone = dimensionMod > 0 ? "success" : "error";

  return (
    <div
      className="rounded-lg p-3.5"
      style={{
        background: colorAlpha("primary", 0.04),
        border: `1px solid ${colorAlpha("primary", 0.14)}`,
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p
            className="text-sm font-semibold truncate"
            style={{ color: color("textPrimary") }}
            title={label}
          >
            {label}
          </p>
          <p
            className="text-[11px] mt-0.5 uppercase font-mono tracking-wide"
            style={{ color: colorAlpha("primary", 0.68) }}
          >
            {getAttributeShortLabel(attrKey)}
          </p>
        </div>

        {hasDimensionMod && (
          <span
            className="text-[10px] px-1.5 py-0.5 rounded-full shrink-0"
            style={{
              color: color(dimensionTone),
              background: colorAlpha(dimensionTone, 0.12),
              border: `1px solid ${colorAlpha(dimensionTone, 0.35)}`,
            }}
          >
            {dimensionSourceText ?? `维度 ${formatSigned(dimensionMod)}`}
          </span>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onDecrease}
          disabled={!canDecrease}
          className="w-8 h-8 rounded-md flex items-center justify-center transition-all duration-150"
          style={{
            background: canDecrease
              ? colorAlpha("error", 0.14)
              : colorAlpha("textMuted", 0.06),
            border: `1px solid ${
              canDecrease
                ? colorAlpha("error", 0.35)
                : colorAlpha("textMuted", 0.12)
            }`,
            color: canDecrease ? color("error") : color("textMuted"),
            cursor: canDecrease ? "pointer" : "not-allowed",
            opacity: canDecrease ? 1 : 0.45,
          }}
          aria-label={`减少 ${label}`}
        >
          <Minus className="w-3.5 h-3.5" />
        </button>

        <div className="text-center min-w-16">
          <AnimatePresence mode="popLayout">
            <motion.span
              key={finalValue}
              className="text-xl font-bold leading-none inline-block"
              style={{
                color: color("textPrimary"),
                textShadow: glow("primary", "sm", 0.2),
              }}
              initial={{ y: -8, opacity: 0, scale: 0.96 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 8, opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.16 }}
            >
              {finalValue}
            </motion.span>
          </AnimatePresence>
          <p className="text-[10px] mt-1" style={{ color: color("textMuted") }}>
            分配 {allocated}/{maxAlloc}
          </p>
        </div>

        <button
          type="button"
          onClick={onIncrease}
          disabled={!canIncrease || atMaxAlloc}
          className="w-8 h-8 rounded-md flex items-center justify-center transition-all duration-150"
          style={{
            background:
              canIncrease && !atMaxAlloc
                ? colorAlpha("success", 0.14)
                : colorAlpha("textMuted", 0.06),
            border: `1px solid ${
              canIncrease && !atMaxAlloc
                ? colorAlpha("success", 0.35)
                : colorAlpha("textMuted", 0.12)
            }`,
            color:
              canIncrease && !atMaxAlloc
                ? color("success")
                : color("textMuted"),
            cursor: canIncrease && !atMaxAlloc ? "pointer" : "not-allowed",
            opacity: canIncrease && !atMaxAlloc ? 1 : 0.45,
          }}
          aria-label={`增加 ${label}`}
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      <p
        className="text-[11px] mt-2 leading-relaxed"
        style={{ color: color("textMuted") }}
        title={description}
      >
        {formatBreakdown(defaultValue, allocated, dimensionMod)}
      </p>
    </div>
  );
}

// ============================================================
// 主组件
// ============================================================

/**
 * 角色创建步骤4：属性分配
 *
 * 数据实时同步到上下文，导航由 WizardFooter 统一处理。
 */
export function SoloCharAttributesStep({
  context,
  onUpdateContext,
  onValidationChange,
}: StepProps) {
  const motionConfig = useMotionTokens();

  // 交错入场 variants
  const itemVariants = createStaggerVariants(motionConfig, "y", 0.1);

  const worldConfig = context.worldConfig ?? DEFAULT_WORLD_CONFIG;
  const pointBuyRules = worldConfig.pointBuyRules;
  const allocatableKeys = useMemo(
    () => pointBuyRules?.allocatableAttributes ?? [],
    [pointBuyRules],
  );
  const bonusPoints = pointBuyRules?.bonusPoints ?? 10;
  const maxPerAttribute = pointBuyRules?.maxPerAttribute ?? 20;

  // 从 context 恢复或初始化
  const [allocated, setAllocated] = useState<Record<string, number>>(() => {
    const restored = context.allocatedPoints ?? {};
    const initial: Record<string, number> = {};
    for (const key of allocatableKeys) {
      initial[key] = restored[key] ?? 0;
    }
    return initial;
  });

  // 维度修正
  const dimensionModifiers = useMemo(
    () =>
      aggregateDimensionEffects(worldConfig, context.dimensionSelections ?? {})
        .attributeModifiers,
    [context.dimensionSelections, worldConfig],
  );

  const dimensionModifierSources = useMemo(() => {
    const sourceMap: Record<string, string[]> = {};

    for (const dim of worldConfig.dimensions ?? []) {
      const selectedId = context.dimensionSelections?.[dim.id];
      if (!selectedId) continue;

      const option = dim.options.find(
        (candidate) => candidate.id === selectedId,
      );
      const attrMods = option?.effects?.attributeModifiers ?? {};

      for (const [attrKey, value] of Object.entries(attrMods)) {
        if (value === 0) continue;
        if (!sourceMap[attrKey]) {
          sourceMap[attrKey] = [];
        }
        sourceMap[attrKey].push(`${formatSigned(value)} ${dim.label}`);
      }
    }

    return sourceMap;
  }, [context.dimensionSelections, worldConfig.dimensions]);

  const manualTalentIds = useMemo(
    () =>
      getManualTalentIds(
        worldConfig,
        context.dimensionSelections,
        context.talentIds,
      ),
    [context.dimensionSelections, context.talentIds, worldConfig],
  );
  const talentPointCost = getTalentAttributePointCost(worldConfig);
  const spentOnTalents = getSpentTalentAttributePoints(
    worldConfig,
    manualTalentIds.length,
  );

  // 总已分配 & 剩余
  const totalAllocated = useMemo(
    () => Object.values(allocated).reduce((sum, value) => sum + value, 0),
    [allocated],
  );
  const remaining = bonusPoints - totalAllocated - spentOnTalents;

  // 计算最终属性值
  const computedAttributes = useMemo(() => {
    const attrs: Record<string, number> = {};
    for (const attr of worldConfig.primaryAttributes) {
      const key = attr.key;
      const base = attr.defaultValue;
      const alloc = allocated[key] ?? 0;
      const dimMod = dimensionModifiers[key] ?? 0;
      attrs[key] = base + alloc + dimMod;
    }
    return attrs;
  }, [allocated, dimensionModifiers, worldConfig]);

  // 雷达图轴数据（按可分配属性顺序）
  const radarAxes = useMemo((): RadarAxis[] => {
    return allocatableKeys
      .map((key) => {
        const attrConfig = getAttrConfig(key, worldConfig);
        if (!attrConfig) return null;

        const value = computedAttributes[key] ?? attrConfig.defaultValue;
        const minValue = attrConfig.min ?? 1;
        const maxValue = Math.max(
          minValue + 1,
          attrConfig.max ?? maxPerAttribute,
          value,
        );

        return {
          key,
          shortLabel: getAttributeShortLabel(key),
          value,
          normalized: safeNormalize(value, minValue, maxValue),
        };
      })
      .filter((axis): axis is RadarAxis => axis !== null);
  }, [allocatableKeys, computedAttributes, maxPerAttribute, worldConfig]);

  // 增加/减少
  const handleIncrease = useCallback(
    (key: string) => {
      if (remaining <= 0) return;

      const attrConfig = getAttrConfig(key, worldConfig);
      const defaultValue = attrConfig?.defaultValue ?? 10;
      const maxAlloc = Math.max(0, maxPerAttribute - defaultValue);

      setAllocated((prev) => {
        const current = prev[key] ?? 0;
        if (current >= maxAlloc) return prev;
        return { ...prev, [key]: current + 1 };
      });
    },
    [maxPerAttribute, remaining, worldConfig],
  );

  const handleDecrease = useCallback((key: string) => {
    setAllocated((prev) => {
      const current = prev[key] ?? 0;
      if (current <= 0) return prev;
      return { ...prev, [key]: current - 1 };
    });
  }, []);

  // 重置
  const handleReset = useCallback(() => {
    const initial: Record<string, number> = {};
    for (const key of allocatableKeys) {
      initial[key] = 0;
    }
    setAllocated(initial);
  }, [allocatableKeys]);

  // 实时同步属性数据到上下文
  useEffect(() => {
    onUpdateContext({
      allocatedPoints: allocated,
      attributes: computedAttributes,
    });
  }, [allocated, computedAttributes, onUpdateContext]);

  // 同步步骤有效性：必须把共享属性点预算分配完（remaining === 0）
  useEffect(() => {
    onValidationChange?.(remaining === 0);
  }, [remaining, onValidationChange]);

  return (
    <div className="p-4 px-3 md:p-8 md:px-6 max-w-2xl mx-auto">
      {/* 顶部雷达图 */}
      <motion.div
        className="mb-4"
        variants={itemVariants}
        initial="hidden"
        animate="visible"
        custom={0}
      >
        <MiniAttributeRadarChart axes={radarAxes} />
      </motion.div>

      {/* 剩余点数 + 重置 */}
      <motion.div
        className="flex items-center justify-center gap-3 mb-6"
        variants={itemVariants}
        initial="hidden"
        animate="visible"
        custom={1}
      >
        <span
          className="text-sm font-medium"
          style={{ color: color("textSecondary") }}
        >
          剩余{" "}
          <span
            className="font-mono"
            style={{
              color: remaining > 0 ? color("warning") : color("success"),
              textShadow:
                remaining > 0
                  ? glow("warning", "sm", 0.25)
                  : glow("success", "sm", 0.25),
            }}
          >
            {remaining}
          </span>{" "}
          / {bonusPoints} 点
        </span>

        {remaining === 0 && (
          <span
            className="inline-flex items-center justify-center w-5 h-5 rounded-full"
            style={{
              color: color("success"),
              background: colorAlpha("success", 0.12),
              border: `1px solid ${colorAlpha("success", 0.35)}`,
            }}
            aria-label="分配完成"
          >
            <Check className="w-3.5 h-3.5" />
          </span>
        )}

        <Button
          variant="ghost"
          size="sm"
          onClick={handleReset}
          disabled={totalAllocated === 0}
          className="ml-1"
        >
          <RotateCcw size={14} className="mr-1" />
          重置
        </Button>
      </motion.div>

      {talentPointCost > 0 ? (
        <motion.div
          className="mb-6 rounded-2xl border p-4"
          variants={itemVariants}
          initial="hidden"
          animate="visible"
          custom={2}
          style={{
            borderColor: colorAlpha("primary", 0.18),
            background: `linear-gradient(135deg, ${colorAlpha("primary", 0.08)} 0%, ${colorAlpha("bgBase", 0.7)} 100%)`,
          }}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p
                className="text-sm font-semibold"
                style={{ color: color("textPrimary") }}
              >
                天赋与属性点共用创建预算
              </p>
              <p
                className="mt-1 text-xs leading-relaxed"
                style={{ color: colorAlpha("textMuted", 0.82) }}
              >
                每选择 1 个手动天赋会额外消耗 {talentPointCost}{" "}
                点属性点。维度赠送天赋不消耗属性点。
              </p>
            </div>

            <div className="flex flex-wrap gap-2 text-xs">
              <span
                className="rounded-full px-3 py-1"
                style={{
                  background: colorAlpha("secondary", 0.12),
                  color: color("secondary"),
                  border: `1px solid ${colorAlpha("secondary", 0.22)}`,
                }}
              >
                手动天赋 {manualTalentIds.length} 项
              </span>
              <span
                className="rounded-full px-3 py-1"
                style={{
                  background: colorAlpha("primary", 0.12),
                  color: color("primary"),
                  border: `1px solid ${colorAlpha("primary", 0.22)}`,
                }}
              >
                天赋已消耗 {spentOnTalents} 点
              </span>
            </div>
          </div>
        </motion.div>
      ) : null}

      {/* 属性卡片网格 */}
      <motion.div
        className="grid grid-cols-1 sm:grid-cols-2 gap-3"
        variants={itemVariants}
        initial="hidden"
        animate="visible"
        custom={3}
      >
        {allocatableKeys.map((key, index) => {
          const attrConfig = getAttrConfig(key, worldConfig);
          if (!attrConfig) return null;

          const defaultValue = attrConfig.defaultValue;
          const maxAlloc = Math.max(0, maxPerAttribute - defaultValue);

          return (
            <motion.div
              key={key}
              custom={index + 4}
              variants={itemVariants}
              initial="hidden"
              animate="visible"
            >
              <AttributeCard
                attrKey={key}
                label={attrConfig.label}
                description={attrConfig.description}
                defaultValue={defaultValue}
                allocated={allocated[key] ?? 0}
                dimensionMod={dimensionModifiers[key] ?? 0}
                dimensionSourceText={
                  (dimensionModifierSources[key] ?? []).join(" · ") || undefined
                }
                maxAlloc={maxAlloc}
                canIncrease={remaining > 0}
                onIncrease={() => handleIncrease(key)}
                onDecrease={() => handleDecrease(key)}
              />
            </motion.div>
          );
        })}
      </motion.div>

      {/* 底部提示 */}
      <AnimatePresence mode="wait" initial={false}>
        {remaining > 0 ? (
          <motion.p
            key="pending"
            className="text-xs mt-4 text-center"
            style={{ color: color("warning") }}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: motionConfig.duration.fast }}
          >
            还有 {remaining} 点共享创建点数未分配，请分配完毕后继续
          </motion.p>
        ) : (
          <motion.p
            key="done"
            className="text-xs mt-4 text-center"
            style={{ color: color("success") }}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: motionConfig.duration.fast }}
          >
            ✓ 创建点数分配完毕，点击“下一步”继续
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
