/**
 * 角色创建 - 步骤6：确认总览
 *
 * 双栏角色预览布局：
 * - 左侧：属性雷达图（最终值）
 * - 右侧：维度详情 + 天赋详情
 * - 底部：外貌/性格/背景紧凑描述区
 */
import { motion } from "framer-motion";
import { BookOpen, Camera, Shield, Sparkles, User, Wrench } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";

import { useMotionTokens } from "@/hooks";
import { getCategoryIcon } from "@/lib/ui/category-icons";
import type { TalentConfig, WorldConfig } from "@/lib/world/types";
import {
  aggregateDimensionEffects,
  DEFAULT_WORLD_CONFIG,
  resolveDimensionSelections,
} from "@/lib/world/types";
import { createStaggerVariants } from "@/styles/motion-variants";
import { color, colorAlpha, glow } from "@/styles/tokens";

import { GradientDivider } from "../components";
import type { StepProps } from "../types";

// ============================================================
// 雷达图常量与工具函数
// ============================================================

const RADAR_SIZE = 200;
const RADAR_CENTER = RADAR_SIZE / 2;
const RADAR_RADIUS = RADAR_SIZE / 2 - 34;
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
  const labelRadius = radius + 19;
  const x = cx + labelRadius * Math.cos(angle);
  const y = cy + labelRadius * Math.sin(angle);

  const angleDeg = ((angle * 180) / Math.PI + 360) % 360;
  let anchor: "middle" | "start" | "end" = "middle";
  if (angleDeg > 10 && angleDeg < 170) anchor = "start";
  else if (angleDeg > 190 && angleDeg < 350) anchor = "end";

  return { x, y, anchor };
}

// ============================================================
// 辅助函数
// ============================================================

/** 查找属性配置 */
function getAttributeConfig(key: string, worldConfig: WorldConfig) {
  return worldConfig.primaryAttributes.find((a) => a.key === key);
}

/** 查找天赋信息 */
function getTalent(
  talentId: string,
  worldConfig: WorldConfig,
): TalentConfig | undefined {
  return worldConfig.talents?.find((t) => t.id === talentId);
}

// ============================================================
// 子组件
// ============================================================

/** 区域标题（卡片内） */
function SectionTitle({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <span style={{ color: color("primary") }}>{icon}</span>
      <h3
        className="text-xs font-semibold uppercase tracking-wider"
        style={{ color: color("primary") }}
      >
        {children}
      </h3>
    </div>
  );
}

/** 小型属性雷达图（内嵌版，复用属性步骤的绘制思路） */
function MiniAttributeRadarChart({ axes }: { axes: RadarAxis[] }) {
  if (axes.length < 3) {
    return (
      <div
        className="h-50 flex items-center justify-center text-sm"
        style={{ color: color("textMuted") }}
      >
        属性不足，无法生成雷达图
      </div>
    );
  }

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
        className="w-50 h-50"
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
            points={getRegularPolygonPoints(
              axes.length,
              RADAR_CENTER,
              RADAR_CENTER,
              RADAR_RADIUS,
            )}
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
          transition={{ duration: 0.35, ease: "easeOut" }}
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
              r={2.8}
              fill={color("primary")}
              stroke={colorAlpha("bgBase", 0.9)}
              strokeWidth={0.8}
              initial={false}
              animate={{ cx: x, cy: y }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              style={{
                filter: `drop-shadow(0 0 4px ${colorAlpha("primary", 0.45)})`,
              }}
            />
          );
        })}

        {/* 轴标签（缩写 + 数值） */}
        {axes.map((axis, index) => {
          const pos = getLabelPosition(
            index,
            axes.length,
            RADAR_CENTER,
            RADAR_CENTER,
            RADAR_RADIUS,
          );

          return (
            <g key={`label-${axis.key}`}>
              <text
                x={pos.x}
                y={pos.y - 5}
                textAnchor={pos.anchor}
                dominantBaseline="middle"
                fontSize={10}
                fontWeight={700}
                letterSpacing={0.4}
                fill={color("textSecondary")}
              >
                {axis.shortLabel}
              </text>
              <text
                x={pos.x}
                y={pos.y + 6}
                textAnchor={pos.anchor}
                dominantBaseline="middle"
                fontSize={11}
                fontWeight={700}
                fill={color("primary")}
              >
                {axis.value}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ============================================================
// 主组件
// ============================================================

/**
 * 角色创建步骤6：确认总览（双栏预览）
 *
 * 不包含导航按钮，由 WizardFooter 处理。
 * config.ts 中 `getNextStep` 返回 null + `nextLabel: "开始冒险"`，
 * GameWizard index.tsx 的 `handleNext` 会自动调用 `onComplete(context)`。
 */
export function SoloCharConfirmStep({ context, onUpdateContext }: StepProps) {
  const tokens = useMotionTokens();
  const itemVariants = createStaggerVariants(tokens, "y", 0.12);

  const worldConfig = context.worldConfig ?? DEFAULT_WORLD_CONFIG;
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const localAvatarObjectUrlRef = useRef<string | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | undefined>(
    context.avatarUrl,
  );

  useEffect(() => {
    setAvatarPreviewUrl(context.avatarUrl);
  }, [context.avatarUrl]);

  useEffect(() => {
    return () => {
      if (localAvatarObjectUrlRef.current) {
        URL.revokeObjectURL(localAvatarObjectUrlRef.current);
      }
    };
  }, []);

  const handleAvatarUploadClick = useCallback(() => {
    avatarInputRef.current?.click();
  }, []);

  const handleAvatarChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      if (localAvatarObjectUrlRef.current) {
        URL.revokeObjectURL(localAvatarObjectUrlRef.current);
      }

      const objectUrl = URL.createObjectURL(file);
      localAvatarObjectUrlRef.current = objectUrl;
      setAvatarPreviewUrl(objectUrl);
      onUpdateContext({ avatarUrl: objectUrl, portraitFile: file });
      event.target.value = "";
    },
    [onUpdateContext],
  );

  // 维度选择解析（用于显示标签与详情）
  const resolvedDimensions = useMemo(
    () =>
      resolveDimensionSelections(
        worldConfig,
        context.dimensionSelections ?? {},
      ),
    [context.dimensionSelections, worldConfig],
  );

  // 聚合维度效果（用于计算最终属性）
  const dimensionEffects = useMemo(
    () =>
      aggregateDimensionEffects(worldConfig, context.dimensionSelections ?? {}),
    [context.dimensionSelections, worldConfig],
  );

  // 雷达图主属性 keys（优先 pointBuyRules，回退到 primaryAttributes 前 6 项）
  const radarAttributeKeys = useMemo(() => {
    const fromPointBuy = worldConfig.pointBuyRules?.allocatableAttributes ?? [];
    if (fromPointBuy.length >= 3) return fromPointBuy.slice(0, 6);

    return worldConfig.primaryAttributes
      .filter((attr) => attr.key !== "level")
      .map((attr) => attr.key)
      .slice(0, 6);
  }, [worldConfig]);

  // 最终属性值（基础 + 分配 + 维度修正）
  const finalAttributes = useMemo(() => {
    const result: Record<string, number> = {};
    for (const attr of worldConfig.primaryAttributes) {
      const key = attr.key;
      const baseValue = attr.defaultValue;
      const allocatedValue = context.allocatedPoints?.[key] ?? 0;
      const dimensionMod = dimensionEffects.attributeModifiers[key] ?? 0;
      result[key] = baseValue + allocatedValue + dimensionMod;
    }
    return result;
  }, [
    context.allocatedPoints,
    dimensionEffects.attributeModifiers,
    worldConfig.primaryAttributes,
  ]);

  // 雷达图轴数据
  const radarAxes = useMemo((): RadarAxis[] => {
    return radarAttributeKeys
      .map((key) => {
        const attrConfig = getAttributeConfig(key, worldConfig);
        if (!attrConfig) return null;

        const value = finalAttributes[key] ?? attrConfig.defaultValue;
        const minValue = attrConfig.min ?? 1;
        const maxValue = Math.max(minValue + 1, attrConfig.max ?? value, value);

        return {
          key,
          shortLabel: getAttributeShortLabel(key),
          value,
          normalized: safeNormalize(value, minValue, maxValue),
        };
      })
      .filter((axis): axis is RadarAxis => axis != null);
  }, [finalAttributes, radarAttributeKeys, worldConfig]);

  // 天赋列表
  const talentInfos = useMemo(() => {
    const ids = context.talentIds ?? [];
    return ids
      .map((id) => getTalent(id, worldConfig))
      .filter((t): t is TalentConfig => t != null);
  }, [context.talentIds, worldConfig]);

  // 维度自动天赋来源 (talentId → dimensionLabel)
  const dimensionTalentSources = useMemo(() => {
    const sources = new Map<string, string>();
    for (const dim of worldConfig.dimensions ?? []) {
      const selectedId = (context.dimensionSelections ?? {})[dim.id];
      if (!selectedId) continue;
      const option = dim.options.find(
        (candidate) => candidate.id === selectedId,
      );
      if (!option?.effects) continue;
      for (const tid of option.effects.grantedTalents ?? []) {
        sources.set(tid, dim.label);
      }
    }
    return sources;
  }, [context.dimensionSelections, worldConfig]);

  // 底部描述项
  const descriptionItems = useMemo(() => {
    const items: Array<{ key: string; label: string; content: string } | null> =
      [
        context.characterAppearance
          ? {
              key: "appearance",
              label: "外貌",
              content: context.characterAppearance,
            }
          : null,
        context.characterPersonality
          ? {
              key: "personality",
              label: "性格",
              content: context.characterPersonality,
            }
          : null,
        context.characterDescription
          ? {
              key: "description",
              label: "背景",
              content: context.characterDescription,
            }
          : null,
      ];
    return items.filter(
      (item): item is { key: string; label: string; content: string } =>
        item != null,
    );
  }, [
    context.characterAppearance,
    context.characterPersonality,
    context.characterDescription,
  ]);

  const descriptionGridClassName = useMemo(() => {
    if (descriptionItems.length <= 1) return "grid grid-cols-1 gap-2";
    if (descriptionItems.length === 2)
      return "grid grid-cols-1 sm:grid-cols-2 gap-2";
    return "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2";
  }, [descriptionItems.length]);

  return (
    <div className="p-3 md:p-6 lg:p-8 max-w-4xl mx-auto">
      {/* 角色卡片容器 */}
      <motion.div
        className="rounded-2xl overflow-hidden mx-auto max-w-4xl"
        style={{
          background: `linear-gradient(180deg,
            ${colorAlpha("primary", 0.08)} 0%,
            ${colorAlpha("bgCard", 0.95)} 28%,
            ${colorAlpha("bgCard", 0.95)} 100%
          )`,
          border: `2px solid ${colorAlpha("primary", 0.3)}`,
          boxShadow: `${glow(
            "primary",
            "lg",
            0.14,
          )}, inset 0 1px 0 ${colorAlpha("primary", 0.1)}`,
        }}
        initial={{ opacity: 0, y: 26, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{
          duration: tokens.duration.slow,
          ease: [0.16, 1, 0.3, 1],
        }}
      >
        {/* 顶部渐变装饰条 */}
        <div
          className="h-1 w-full"
          style={{
            background: `linear-gradient(90deg, ${color("primary")}, ${color(
              "secondary",
            )}, ${color("primary")})`,
          }}
        />

        <div className="p-4 md:p-5 space-y-4">
          {/* 主体双栏 */}
          <div className="grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)] gap-4 items-start">
            {/* 左侧：头像上传 + 名称 + 雷达图 */}
            <motion.div
              className="rounded-xl p-3 space-y-4"
              style={{
                background: colorAlpha("primary", 0.04),
                border: `1px solid ${colorAlpha("primary", 0.14)}`,
                boxShadow: `inset 0 1px 0 ${colorAlpha("primary", 0.08)}`,
              }}
              variants={itemVariants}
              initial="hidden"
              animate="visible"
              custom={0}
            >
              <div className="flex flex-col items-center gap-2.5">
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="hidden"
                />

                <motion.button
                  type="button"
                  onClick={handleAvatarUploadClick}
                  className="group relative h-48 w-48 overflow-hidden rounded-lg"
                  style={{
                    background: colorAlpha("primary", 0.08),
                    border: `1px solid ${colorAlpha("primary", 0.28)}`,
                  }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  animate={{
                    boxShadow: [
                      glow("primary", "sm", 0.2),
                      glow("primary", "md", 0.35),
                      glow("primary", "sm", 0.2),
                    ],
                  }}
                  transition={{
                    duration: 2.2,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                  aria-label="上传头像"
                >
                  {avatarPreviewUrl ? (
                    <img
                      src={avatarPreviewUrl}
                      alt="角色头像预览"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div
                      className="flex h-full w-full items-center justify-center"
                      style={{
                        background: colorAlpha("primary", 0.08),
                        color: color("textSecondary"),
                      }}
                    >
                      <User className="h-10 w-10" />
                    </div>
                  )}

                  <div
                    className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1.5 py-1.5 text-[11px]"
                    style={{
                      background: `linear-gradient(180deg, ${colorAlpha(
                        "bgBase",
                        0,
                      )} 0%, ${colorAlpha("bgBase", 0.72)} 55%, ${colorAlpha(
                        "bgBase",
                        0.88,
                      )} 100%)`,
                      color: color("textSecondary"),
                    }}
                  >
                    <Camera
                      className="h-3.5 w-3.5"
                      style={{ color: color("primary") }}
                    />
                    <span>上传头像</span>
                  </div>
                </motion.button>

                <p
                  className="text-sm font-semibold"
                  style={{ color: color("textPrimary") }}
                >
                  {context.characterName || "未命名"}
                </p>
              </div>

              <div>
                <SectionTitle icon={<Shield className="w-3.5 h-3.5" />}>
                  属性雷达
                </SectionTitle>
                <MiniAttributeRadarChart axes={radarAxes} />
              </div>
            </motion.div>

            {/* 右侧：维度详情 + 天赋详情 */}
            <motion.div
              className="space-y-3 min-w-0"
              variants={itemVariants}
              initial="hidden"
              animate="visible"
              custom={1}
            >
              {/* 维度详情 */}
              <div
                className="rounded-xl p-3"
                style={{
                  background: colorAlpha("primary", 0.04),
                  border: `1px solid ${colorAlpha("primary", 0.14)}`,
                }}
              >
                <SectionTitle icon={<Shield className="w-3.5 h-3.5" />}>
                  维度详情
                </SectionTitle>

                {resolvedDimensions.length > 0 ? (
                  <div className="space-y-2">
                    {resolvedDimensions.map((dimension) => (
                      <div
                        key={dimension.dimensionId}
                        className="rounded-lg px-3 py-2.5"
                        style={{
                          background: colorAlpha("bgCard", 0.55),
                          border: `1px solid ${colorAlpha("primary", 0.12)}`,
                        }}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className="text-[11px] px-2 py-0.5 rounded-full"
                            style={{
                              background: colorAlpha("secondary", 0.12),
                              border: `1px solid ${colorAlpha("secondary", 0.28)}`,
                              color: color("secondary"),
                            }}
                          >
                            {dimension.dimensionLabel}
                          </span>
                          <span
                            className="text-sm font-semibold"
                            style={{ color: color("textPrimary") }}
                          >
                            {dimension.option.name}
                          </span>
                        </div>
                        <p
                          className="text-xs mt-1 leading-relaxed line-clamp-3"
                          style={{ color: color("textMuted") }}
                        >
                          {dimension.option.description}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs" style={{ color: color("textMuted") }}>
                    未选择维度
                  </p>
                )}
              </div>

              {/* 天赋详情 */}
              <div
                className="rounded-xl p-3"
                style={{
                  background: colorAlpha("primary", 0.04),
                  border: `1px solid ${colorAlpha("primary", 0.14)}`,
                }}
              >
                <SectionTitle icon={<Sparkles className="w-3.5 h-3.5" />}>
                  天赋
                </SectionTitle>

                {talentInfos.length > 0 ? (
                  <div className="space-y-2">
                    {talentInfos.map((talent) => {
                      const sourceDimensionLabel = dimensionTalentSources.get(
                        talent.id,
                      );
                      const sourceTone = sourceDimensionLabel
                        ? "secondary"
                        : "primary";

                      return (
                        <div
                          key={talent.id}
                          className="rounded-lg px-3 py-2.5"
                          style={{
                            background: colorAlpha("bgCard", 0.55),
                            border: `1px solid ${colorAlpha(sourceTone, 0.22)}`,
                          }}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span style={{ color: color("primary") }}>
                                {getCategoryIcon(talent.category, {
                                  miscIcon: Wrench,
                                })}
                              </span>
                              <span
                                className="text-sm font-semibold truncate"
                                style={{ color: color("textPrimary") }}
                              >
                                {talent.name}
                              </span>
                            </div>

                            <span
                              className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full shrink-0"
                              style={{
                                background: colorAlpha(sourceTone, 0.12),
                                border: `1px solid ${colorAlpha(sourceTone, 0.3)}`,
                                color: color(sourceTone),
                              }}
                              title={
                                sourceDimensionLabel
                                  ? `来源：${sourceDimensionLabel}`
                                  : "来源：手动选择"
                              }
                            >
                              {sourceDimensionLabel ? (
                                <Sparkles className="w-3 h-3" />
                              ) : (
                                <User className="w-3 h-3" />
                              )}
                              {sourceDimensionLabel
                                ? sourceDimensionLabel
                                : "手动选择"}
                            </span>
                          </div>

                          <p
                            className="text-xs mt-1 leading-relaxed line-clamp-2"
                            style={{ color: color("textMuted") }}
                          >
                            {talent.description}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs" style={{ color: color("textMuted") }}>
                    未选择天赋
                  </p>
                )}
              </div>
            </motion.div>
          </div>

          {/* 底部描述区 */}
          {descriptionItems.length > 0 && (
            <>
              <GradientDivider />
              <motion.div
                variants={itemVariants}
                initial="hidden"
                animate="visible"
                custom={3}
              >
                <SectionTitle icon={<BookOpen className="w-3.5 h-3.5" />}>
                  描述
                </SectionTitle>

                <div className="flex flex-wrap items-center gap-1.5 mb-2">
                  {descriptionItems.map((item, index) => (
                    <div
                      key={item.key}
                      className="inline-flex items-center gap-1.5"
                    >
                      <span
                        className="text-[11px] px-2 py-0.5 rounded-full"
                        style={{
                          background: colorAlpha("primary", 0.08),
                          border: `1px solid ${colorAlpha("primary", 0.22)}`,
                          color: color("textSecondary"),
                        }}
                      >
                        {item.label}
                      </span>
                      {index < descriptionItems.length - 1 && (
                        <span
                          className="text-xs"
                          style={{ color: color("textMuted") }}
                        >
                          ·
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                <div className={descriptionGridClassName}>
                  {descriptionItems.map((item) => (
                    <div
                      key={`content-${item.key}`}
                      className="rounded-lg px-3 py-2.5"
                      style={{
                        background: colorAlpha("bgCard", 0.5),
                        border: `1px solid ${colorAlpha("primary", 0.12)}`,
                      }}
                    >
                      <p
                        className="text-xs leading-relaxed line-clamp-2"
                        style={{ color: color("textSecondary") }}
                      >
                        {item.content}
                      </p>
                    </div>
                  ))}
                </div>
              </motion.div>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
