/**
 * 角色创建 - 天赋选择步骤
 *
 * 从 worldConfig.talents 获取所有可选天赋
 * 处理维度天赋（自动获得）、排除天赋、互斥天赋
 * 处理前置条件（属性要求）
 *
 * 改造说明：
 * - 分类 Tab 筛选栏（如果天赋有 category 分类信息）
 * - 2 列响应式网格布局（手机 1 列，平板+ 2 列）
 * - 使用 useMotionTokens() + createStaggerVariants() 替代废弃 variants
 * - 导航由 WizardFooter 统一处理，组件不含导航按钮
 * - 自动获得天赋置顶 + secondary 色左边框装饰
 * - 禁用天赋降低透明度 + Lock 图标
 */

import { AnimatePresence, motion } from "framer-motion";
import { Ban, Check, Lock, Sparkles, Star, Wrench } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Card } from "@/components/ui";
import { useMotionTokens } from "@/hooks";
import { getCategoryIcon } from "@/lib/ui/category-icons";
import type { TalentConfig, WorldConfig } from "@/lib/world/types";
import {
  aggregateDimensionEffects,
  DEFAULT_WORLD_CONFIG,
} from "@/lib/world/types";
import { createStaggerVariants } from "@/styles/motion-variants";
import { color, colorAlpha, glow } from "@/styles/tokens";

import type { StepProps } from "../types";

// ============================================================
// 辅助函数
// ============================================================

/** 天赋分类名称 */
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

/** 从 primaryAttributes 查找属性显示名 */
function getAttributeLabel(key: string, worldConfig: WorldConfig): string {
  const attr = worldConfig.primaryAttributes.find((a) => a.key === key);
  return attr?.label ?? key;
}

// ============================================================
// 类型定义
// ============================================================

type TalentStatus =
  | "available"
  | "selected"
  | "auto_dimension"
  | "excluded"
  | "exclusive"
  | "prereq_fail"
  | "max_reached";

interface TalentWithStatus {
  talent: TalentConfig;
  status: TalentStatus;
  reason?: string;
}

// ============================================================
// TalentCard 子组件
// ============================================================

function TalentCard({
  talentWithStatus,
  onClick,
}: {
  talentWithStatus: TalentWithStatus;
  onClick: () => void;
}) {
  const { talent, status, reason } = talentWithStatus;
  const isAuto = status === "auto_dimension";
  const isSelected = status === "selected";
  const isDisabled =
    status === "excluded" ||
    status === "exclusive" ||
    status === "prereq_fail" ||
    status === "max_reached";

  const isHighlighted = isSelected || isAuto;

  return (
    <motion.div
      layout
      initial={false}
      animate={{
        scale: isHighlighted ? 1 : 1,
        opacity: isDisabled ? 0.5 : 1,
      }}
      whileTap={!isDisabled && !isAuto ? { scale: 0.98 } : undefined}
      transition={{ duration: 0.2 }}
    >
      <Card
        variant={isHighlighted ? "elevated" : "outlined"}
        onClick={isDisabled ? undefined : onClick}
        hover={!isDisabled && !isAuto}
        className="p-3 relative overflow-hidden"
        style={{
          ...(isAuto
            ? {
                borderColor: color("secondary"),
                borderLeftWidth: "3px",
                boxShadow: glow("secondary", "sm", 0.15),
              }
            : isSelected
              ? {
                  borderColor: color("primary"),
                  boxShadow: glow("primary", "md", 0.3),
                }
              : undefined),
          ...(isDisabled
            ? {
                cursor: "not-allowed",
              }
            : undefined),
        }}
      >
        <div className="flex items-start gap-3">
          {/* 分类图标 */}
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
            style={{
              background: isHighlighted
                ? colorAlpha(isAuto ? "secondary" : "primary", 0.2)
                : colorAlpha("primary", 0.08),
              border: `1px solid ${
                isHighlighted
                  ? colorAlpha(isAuto ? "secondary" : "primary", 0.5)
                  : colorAlpha("primary", 0.2)
              }`,
              color: isHighlighted
                ? color(isAuto ? "secondary" : "primary")
                : color("textSecondary"),
            }}
          >
            {isDisabled ? (
              <Lock className="w-4 h-4" />
            ) : (
              getCategoryIcon(talent.category, {
                miscIcon: Wrench,
                size: "md",
              })
            )}
          </div>

          <div className="flex-1 min-w-0">
            {/* 天赋名称 + 标签 */}
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h3
                className="text-sm font-semibold"
                style={{
                  color: isHighlighted
                    ? color(isAuto ? "secondary" : "primary")
                    : isDisabled
                      ? color("textMuted")
                      : color("textPrimary"),
                }}
              >
                {talent.name}
              </h3>

              {/* 分类标签 */}
              <span
                className="text-xs px-1.5 py-0.5 rounded"
                style={{
                  background: colorAlpha("primary", 0.08),
                  color: color("textMuted"),
                }}
              >
                {getCategoryLabel(talent.category)}
              </span>

              {/* 自动获得状态标签 */}
              {isAuto && (
                <span
                  className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full"
                  style={{
                    background: colorAlpha("secondary", 0.15),
                    color: color("secondary"),
                    border: `1px solid ${colorAlpha("secondary", 0.3)}`,
                  }}
                >
                  <Sparkles className="w-3 h-3" />
                  {reason ?? "自动获得"}
                </span>
              )}
            </div>

            {/* 天赋描述 */}
            <p
              className="text-xs leading-relaxed line-clamp-2"
              style={{ color: color("textMuted") }}
            >
              {talent.description}
            </p>

            {/* 禁用原因 */}
            {isDisabled && reason && (
              <div
                className="flex items-center gap-1 mt-1.5 text-xs"
                style={{ color: color("error") }}
              >
                {status === "excluded" ? (
                  <Ban className="w-3 h-3" />
                ) : status === "prereq_fail" ? (
                  <Lock className="w-3 h-3" />
                ) : (
                  <Ban className="w-3 h-3" />
                )}
                {reason}
              </div>
            )}
          </div>

          {/* 选中/自动指示器 */}
          <AnimatePresence>
            {isHighlighted && (
              <motion.div
                className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                style={{
                  background: isAuto ? color("secondary") : color("primary"),
                }}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
              >
                <Check className="w-3 h-3" style={{ color: color("bgBase") }} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </Card>
    </motion.div>
  );
}

// ============================================================
// 主组件
// ============================================================

/**
 * 角色创建：天赋选择
 *
 * 6 种天赋状态：available | selected | auto_dimension | excluded | exclusive | prereq_fail | max_reached
 * 自动获得天赋来源追踪（dimensionTalentSources: Map<talentId, dimensionId>）
 * 前置条件检查（属性值要求）
 * 互斥检查（exclusiveWith）
 * 最终天赋 = autoTalents ∪ selected（去重）
 */
export function SoloCharTalentsStep({ context, onUpdateContext }: StepProps) {
  const motionConfig = useMotionTokens();
  const itemVariants = createStaggerVariants(motionConfig, "y", 0.1);

  const worldConfig = context.worldConfig ?? DEFAULT_WORLD_CONFIG;
  const allTalents = useMemo(() => worldConfig.talents ?? [], [worldConfig]);
  const initialCount = worldConfig.talentRules?.initialCount ?? 2;

  // 聚合所有维度效果
  const dimensionEffects = useMemo(
    () =>
      aggregateDimensionEffects(worldConfig, context.dimensionSelections ?? {}),
    [context.dimensionSelections, worldConfig],
  );

  // 自动获得的天赋（来自所有维度）
  const autoTalents = useMemo(
    () => dimensionEffects.grantedTalents,
    [dimensionEffects],
  );

  // 维度排除天赋
  const excludedTalents = useMemo(
    () => dimensionEffects.excludedTalents,
    [dimensionEffects],
  );

  // 判断哪些天赋来自哪个维度（用于 UI 区分来源）
  const dimensionTalentSources = useMemo(() => {
    const sources = new Map<string, string>(); // talentId → dimensionId
    for (const dim of worldConfig.dimensions ?? []) {
      const selectedId = (context.dimensionSelections ?? {})[dim.id];
      if (!selectedId) continue;
      const option = dim.options.find((o) => o.id === selectedId);
      if (!option?.effects) continue;
      for (const tid of option.effects.grantedTalents ?? []) {
        sources.set(tid, dim.id);
      }
    }
    return sources;
  }, [context.dimensionSelections, worldConfig]);

  // 玩家选择的天赋（排除自动获得的）
  const [selected, setSelected] = useState<string[]>(() => {
    const restored = context.talentIds ?? [];
    return restored.filter((id) => !autoTalents.includes(id));
  });

  // 分类 Tab 筛选
  const [activeCategory, setActiveCategory] = useState<string>("all");

  // 最终天赋列表
  const finalTalents = useMemo(
    () => [...new Set([...autoTalents, ...selected])],
    [autoTalents, selected],
  );

  // 实时同步天赋数据到上下文
  useEffect(() => {
    onUpdateContext({ talentIds: [...finalTalents] });
  }, [finalTalents, onUpdateContext]);

  // 获取当前属性值
  const attributes = useMemo<Record<string, number>>(
    () => context.attributes ?? {},
    [context.attributes],
  );

  // 计算每个天赋的状态
  const talentsWithStatus: TalentWithStatus[] = useMemo(() => {
    return allTalents.map((talent) => {
      // 自动获得（来自某个维度）
      const sourceDimId = dimensionTalentSources.get(talent.id);
      if (sourceDimId) {
        const sourceDim = worldConfig.dimensions?.find(
          (d) => d.id === sourceDimId,
        );
        const dimLabel = sourceDim?.label ?? sourceDimId;
        return {
          talent,
          status: "auto_dimension" as TalentStatus,
          reason: `${dimLabel}天赋`,
        };
      }

      // 被排除（查找排除来源维度）
      if (excludedTalents.includes(talent.id)) {
        let excludeSource = "";
        for (const dim of worldConfig.dimensions ?? []) {
          const selId = (context.dimensionSelections ?? {})[dim.id];
          if (!selId) continue;
          const opt = dim.options.find((o) => o.id === selId);
          if (opt?.effects?.excludedTalents?.includes(talent.id)) {
            excludeSource = dim.label;
            break;
          }
        }
        return {
          talent,
          status: "excluded" as TalentStatus,
          reason: excludeSource
            ? `${excludeSource}不可选择此天赋`
            : "不可选择此天赋",
        };
      }

      // 已选中
      if (selected.includes(talent.id)) {
        return { talent, status: "selected" as TalentStatus };
      }

      // 前置条件检查
      if (talent.prerequisites?.attributes) {
        const prereqAttrs = talent.prerequisites.attributes;
        const failedAttrs: string[] = [];
        for (const [attrKey, requiredValue] of Object.entries(prereqAttrs)) {
          if ((attributes[attrKey] ?? 0) < requiredValue) {
            failedAttrs.push(
              `${getAttributeLabel(attrKey, worldConfig)} ≥ ${requiredValue}`,
            );
          }
        }
        if (failedAttrs.length > 0) {
          return {
            talent,
            status: "prereq_fail" as TalentStatus,
            reason: `需要：${failedAttrs.join("、")}`,
          };
        }
      }

      // 互斥检查
      if (talent.exclusiveWith) {
        const conflicting = talent.exclusiveWith.find(
          (excId) => selected.includes(excId) || autoTalents.includes(excId),
        );
        if (conflicting) {
          const conflictTalent = allTalents.find((t) => t.id === conflicting);
          return {
            talent,
            status: "exclusive" as TalentStatus,
            reason: `与「${conflictTalent?.name ?? conflicting}」互斥`,
          };
        }
      }

      // 名额已满
      if (selected.length >= initialCount) {
        return {
          talent,
          status: "max_reached" as TalentStatus,
          reason: `已达最大选择数（${initialCount}）`,
        };
      }

      return { talent, status: "available" as TalentStatus };
    });
  }, [
    allTalents,
    dimensionTalentSources,
    excludedTalents,
    selected,
    attributes,
    autoTalents,
    initialCount,
    context.dimensionSelections,
    worldConfig,
  ]);

  // 排序：自动获得 → 已选 → 可选 → 禁用
  const sortedTalents = useMemo(() => {
    const order: Record<TalentStatus, number> = {
      auto_dimension: 0,
      selected: 1,
      available: 2,
      max_reached: 3,
      exclusive: 4,
      prereq_fail: 5,
      excluded: 6,
    };
    return [...talentsWithStatus].sort(
      (a, b) => order[a.status] - order[b.status],
    );
  }, [talentsWithStatus]);

  // 提取分类列表（仅在有分类信息时显示 Tab）
  const categories = useMemo(() => {
    const cats = new Set<string>();
    allTalents.forEach((t) => {
      if (t.category) cats.add(t.category);
    });
    if (cats.size === 0) return null; // 无分类信息，不显示 Tab
    return ["all", ...Array.from(cats)];
  }, [allTalents]);

  // 按分类筛选后的天赋
  const filteredTalents = useMemo(() => {
    if (activeCategory === "all") return sortedTalents;
    return sortedTalents.filter((tw) => tw.talent.category === activeCategory);
  }, [activeCategory, sortedTalents]);

  // 切换选择
  const handleToggle = useCallback(
    (talentId: string) => {
      const tw = talentsWithStatus.find((t) => t.talent.id === talentId);
      if (!tw) return;

      // 自动获得的不可操作
      if (tw.status === "auto_dimension") return;

      if (tw.status === "selected") {
        // 取消选择
        setSelected((prev) => prev.filter((id) => id !== talentId));
      } else if (tw.status === "available") {
        // 选择
        setSelected((prev) => [...prev, talentId]);
      }
      // 其他状态（disabled）不响应
    },
    [talentsWithStatus],
  );

  return (
    <div className="p-4 px-3 md:p-8 md:px-6 max-w-2xl mx-auto">
      {/* 已选计数 */}
      <motion.div
        className="flex items-center justify-center gap-2 mb-6"
        variants={itemVariants}
        initial="hidden"
        animate="visible"
        custom={0}
      >
        <span className="text-sm" style={{ color: color("textMuted") }}>
          已选天赋：
        </span>
        <span className="text-lg font-bold" style={{ color: color("primary") }}>
          {selected.length}
        </span>
        <span className="text-sm" style={{ color: color("textMuted") }}>
          / {initialCount}
        </span>
        {autoTalents.length > 0 && (
          <span
            className="text-xs ml-2 px-2 py-0.5 rounded-full"
            style={{
              background: colorAlpha("secondary", 0.1),
              color: color("secondary"),
            }}
          >
            +{autoTalents.length} 自动获得
          </span>
        )}
      </motion.div>

      {/* 分类 Tab 筛选栏（仅在有分类数据时显示） */}
      {categories && (
        <motion.div
          className="flex gap-2 mb-4 overflow-x-auto pb-2 scrollbar-hide"
          variants={itemVariants}
          initial="hidden"
          animate="visible"
          custom={1}
        >
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className="px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors"
              style={{
                background:
                  activeCategory === cat
                    ? colorAlpha("primary", 0.2)
                    : colorAlpha("primary", 0.05),
                color:
                  activeCategory === cat
                    ? color("primary")
                    : color("textMuted"),
                border: `1px solid ${colorAlpha(
                  "primary",
                  activeCategory === cat ? 0.4 : 0.1,
                )}`,
              }}
            >
              {cat === "all"
                ? "全部"
                : getCategoryLabel(cat as TalentConfig["category"])}
            </button>
          ))}
        </motion.div>
      )}

      {/* 天赋卡片网格 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {filteredTalents.map((tw, index) => (
          <motion.div
            key={tw.talent.id}
            custom={index + (categories ? 2 : 1)}
            variants={itemVariants}
            initial="hidden"
            animate="visible"
          >
            <TalentCard
              talentWithStatus={tw}
              onClick={() => handleToggle(tw.talent.id)}
            />
          </motion.div>
        ))}
      </div>

      {/* 无天赋时的提示 */}
      {filteredTalents.length === 0 && (
        <motion.div
          className="text-center py-12"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <Star
            className="w-8 h-8 mx-auto mb-3"
            style={{ color: color("textMuted") }}
          />
          <p className="text-sm" style={{ color: color("textMuted") }}>
            {activeCategory !== "all" ? "该分类下没有可用天赋" : "暂无可用天赋"}
          </p>
        </motion.div>
      )}
    </div>
  );
}
