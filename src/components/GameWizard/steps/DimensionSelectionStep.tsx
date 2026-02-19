/**
 * 角色创建 - 通用维度选择步骤
 *
 * 接收 CharacterDimension 配置，动态渲染选项卡片
 * 替代原有的 SoloCharRaceStep 和 SoloCharBackgroundStep
 *
 * 改造说明：
 * - 2 列响应式网格布局（手机 1 列，平板+ 2 列）
 * - 选中卡片增强动画（边框发光 pulse + Check 弹入）
 * - 使用 useMotionTokens() + createStaggerVariants() 替代废弃 variants
 * - 导航由 WizardFooter 统一处理，组件不含导航按钮
 * - 点击卡片 → 保存选择到上下文（不自动前进，用户通过 WizardFooter 手动前进）
 */

import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, Check, Layers, Shield, Sparkles, Users } from "lucide-react";
import type { ComponentType } from "react";
import { useCallback, useEffect, useMemo } from "react";

import { Card } from "@/components/ui";
import { useMotionTokens } from "@/hooks";
import type {
  CharacterDimension,
  DimensionOption,
  WorldConfig,
} from "@/lib/world/types";
import { DEFAULT_WORLD_CONFIG } from "@/lib/world/types";
import { createStaggerVariants } from "@/styles/motion-variants";
import { color, colorAlpha, glow } from "@/styles/tokens";

import type { StepProps, WizardContext } from "../types";

// ============================================================
// 常量与辅助函数
// ============================================================

/**
 * defaults key → WizardContext 字段映射
 * DimensionOption.defaults 的 key 对应 WizardContext 中的字段名
 */
const DEFAULTS_CONTEXT_MAP: Record<string, keyof WizardContext> = {
  appearance: "characterAppearance",
  personality: "characterPersonality",
  description: "characterDescription",
};

/** defaults key → 显示标签映射 */
const DEFAULTS_LABEL_MAP: Record<string, string> = {
  appearance: "外貌",
  personality: "性格",
  description: "背景故事",
};

/** 从 primaryAttributes 查找属性显示名 */
function getAttributeLabel(key: string, worldConfig: WorldConfig): string {
  const attr = worldConfig.primaryAttributes.find((a) => a.key === key);
  return attr?.label ?? key;
}

/** 格式化属性修正值（+2 / -1） */
function formatModifier(value: number): string {
  return value > 0 ? `+${value}` : `${value}`;
}

/** 查找天赋名称 */
function getTalentName(talentId: string, worldConfig: WorldConfig): string {
  const talent = worldConfig.talents?.find((t) => t.id === talentId);
  return talent?.name ?? talentId;
}

/** 安全获取 WizardContext 中的字符串字段 */
function getContextStringField(
  ctx: WizardContext,
  key: keyof WizardContext,
): string | undefined {
  const value = ctx[key];
  return typeof value === "string" ? value : undefined;
}

/** 根据维度 ID 获取图标组件 */
function getDimensionIcon(dimensionId: string, isSelected: boolean) {
  const iconStyle = {
    color: isSelected ? color("primary") : color("textSecondary"),
  };

  switch (dimensionId) {
    case "race":
      return <Users className="w-5 h-5" style={iconStyle} />;
    case "background":
      return <BookOpen className="w-5 h-5" style={iconStyle} />;
    default:
      return <Layers className="w-5 h-5" style={iconStyle} />;
  }
}

/**
 * 收集选项的预填信息（仅当对应上下文字段为空时列出）
 */
function collectPrefillLabels(
  option: DimensionOption,
  context: WizardContext,
): string[] {
  if (!option.defaults) return [];

  const labels: string[] = [];
  for (const [key] of Object.entries(option.defaults)) {
    const contextKey = DEFAULTS_CONTEXT_MAP[key];
    if (!contextKey) continue;
    const currentValue = getContextStringField(context, contextKey);
    if (!currentValue) {
      labels.push(DEFAULTS_LABEL_MAP[key] ?? key);
    }
  }
  return labels;
}

// ============================================================
// Props
// ============================================================

interface DimensionStepProps extends StepProps {
  dimension: CharacterDimension;
}

// ============================================================
// 子组件：DimensionOptionCard
// ============================================================

function DimensionOptionCard({
  option,
  dimensionId,
  isSelected,
  onClick,
  worldConfig,
  prefillLabels,
}: {
  option: DimensionOption;
  dimensionId: string;
  isSelected: boolean;
  onClick: () => void;
  worldConfig: WorldConfig;
  prefillLabels: string[];
}) {
  const modifiers = option.effects?.attributeModifiers ?? {};
  const modifierEntries = Object.entries(modifiers).filter(([, v]) => v !== 0);
  const grantedTalents = option.effects?.grantedTalents ?? [];

  return (
    <Card
      variant={isSelected ? "elevated" : "outlined"}
      onClick={onClick}
      hover
      className="relative h-full overflow-hidden p-4"
      style={
        isSelected
          ? {
              borderColor: color("primary"),
              boxShadow: glow("primary", "md", 0.3),
            }
          : undefined
      }
    >
      {/* 选中时的脉冲发光动画 */}
      {isSelected && (
        <motion.div
          className="absolute inset-0 pointer-events-none rounded-[inherit]"
          animate={{
            boxShadow: [
              glow("primary", "sm", 0.15),
              glow("primary", "md", 0.35),
              glow("primary", "sm", 0.15),
            ],
          }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        />
      )}

      <div className="flex items-start gap-3 relative">
        {/* 维度图标 */}
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
          style={{
            background: isSelected
              ? colorAlpha("primary", 0.2)
              : colorAlpha("primary", 0.08),
            border: `1px solid ${
              isSelected
                ? colorAlpha("primary", 0.5)
                : colorAlpha("primary", 0.2)
            }`,
          }}
        >
          {getDimensionIcon(dimensionId, isSelected)}
        </div>

        <div className="flex-1 min-w-0">
          {/* 选项名称 */}
          <h3
            className="text-base font-semibold mb-1"
            style={{
              color: isSelected ? color("primary") : color("textPrimary"),
            }}
          >
            {option.name}
          </h3>

          {/* 选项描述 */}
          <p
            className="text-sm mb-2 leading-relaxed"
            style={{ color: color("textMuted") }}
          >
            {option.description}
          </p>

          {/* 属性修正 */}
          {modifierEntries.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {modifierEntries.map(([attrKey, value]) => (
                <span
                  key={attrKey}
                  className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{
                    background: colorAlpha(
                      value > 0 ? "success" : "error",
                      0.1,
                    ),
                    color: color(value > 0 ? "success" : "error"),
                    border: `1px solid ${colorAlpha(
                      value > 0 ? "success" : "error",
                      0.3,
                    )}`,
                  }}
                >
                  <Shield className="w-3 h-3" />
                  {getAttributeLabel(attrKey, worldConfig)}
                  {formatModifier(value)}
                </span>
              ))}
            </div>
          )}

          {/* 赠送天赋 */}
          {grantedTalents.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {grantedTalents.map((talentId) => (
                <span
                  key={talentId}
                  className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
                  style={{
                    background: colorAlpha("secondary", 0.1),
                    color: color("secondary"),
                    border: `1px solid ${colorAlpha("secondary", 0.3)}`,
                  }}
                >
                  <Sparkles className="w-3 h-3" />
                  {getTalentName(talentId, worldConfig)}
                </span>
              ))}
            </div>
          )}

          {/* 预填提示（显示在卡片上，让用户选择前即可看到） */}
          {prefillLabels.length > 0 && (
            <p
              className="text-xs flex items-center gap-1"
              style={{ color: color("textMuted") }}
            >
              <Sparkles className="w-3 h-3 shrink-0" />
              将自动预填：{prefillLabels.join("、")}
            </p>
          )}
        </div>

        {/* 选中指示器 - 固定占位，避免选中切换造成布局抖动 */}
        <div className="w-6 h-6 shrink-0">
          <motion.div
            className="w-full h-full rounded-full flex items-center justify-center"
            style={{
              background: color("primary"),
            }}
            initial={false}
            animate={{
              scale: isSelected ? 1 : 0.6,
              opacity: isSelected ? 1 : 0,
            }}
            transition={{
              type: "spring",
              stiffness: 500,
              damping: 25,
            }}
          >
            <Check
              className="w-3.5 h-3.5"
              style={{ color: color("bgBase") }}
              strokeWidth={3}
            />
          </motion.div>
        </div>
      </div>
    </Card>
  );
}

// ============================================================
// 主组件：DimensionSelectionStep
// ============================================================

/**
 * 通用维度选择步骤组件
 *
 * 根据传入的 CharacterDimension 配置动态渲染：
 * - 2 列响应式网格选项卡片（属性修正 + 天赋标签 + 预填提示）
 * - 点击卡片 → 保存选择到上下文
 * - 再次点击已选卡片 → 取消选择
 * - 点击 WizardFooter 下一步 → 前进到下一步
 */
export function DimensionSelectionStep({
  context,
  onUpdateContext,
  onValidationChange,
  dimension,
}: DimensionStepProps) {
  const motionConfig = useMotionTokens();
  const worldConfig = context.worldConfig ?? DEFAULT_WORLD_CONFIG;

  // 交错入场 variants
  const cardVariants = createStaggerVariants(motionConfig, "y", 0.1);

  // 当前已选选项（从上下文读取，重新进入步骤时可恢复）
  const currentSelection = context.dimensionSelections?.[dimension.id];

  // 维度是否必选：默认必选（仅当 required 显式为 false 时允许跳过）
  const isDimensionRequired = dimension.required !== false;
  const isValid = isDimensionRequired ? Boolean(currentSelection) : true;

  // 将当前步骤验证状态同步给父组件（用于控制 Footer 下一步按钮）
  useEffect(() => {
    onValidationChange?.(isValid);
  }, [isValid, onValidationChange]);

  // 为每个选项预计算预填标签（仅在对应上下文字段为空时显示）
  const prefillMap = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const option of dimension.options) {
      map.set(option.id, collectPrefillLabels(option, context));
    }
    return map;
  }, [dimension.options, context]);

  // 点击卡片：保存选择到上下文（不前进）
  const handleSelect = useCallback(
    (optionId: string) => {
      const isDeselecting = currentSelection === optionId;
      const updates: Partial<WizardContext> = {};

      if (isDeselecting) {
        // 取消选择：移除该维度的 key
        const { [dimension.id]: _, ...rest } =
          context.dimensionSelections ?? {};
        updates.dimensionSelections = rest;
      } else {
        // 新选择：更新维度选择
        updates.dimensionSelections = {
          ...context.dimensionSelections,
          [dimension.id]: optionId,
        };

        // 预填 defaults（仅当对应字段为空时）
        const option = dimension.options.find((o) => o.id === optionId);
        if (option?.defaults) {
          for (const [defaultKey, defaultValue] of Object.entries(
            option.defaults,
          )) {
            const ctxKey = DEFAULTS_CONTEXT_MAP[defaultKey];
            if (!ctxKey) continue;
            if (!getContextStringField(context, ctxKey)) {
              (updates as Record<string, unknown>)[ctxKey] = defaultValue;
            }
          }
        }
      }

      onUpdateContext(updates);
    },
    [currentSelection, context, dimension, onUpdateContext],
  );

  return (
    <div className="w-full max-w-2xl mx-auto px-3 md:px-6">
      {/* 响应式网格：手机 1 列，平板+ 2 列 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {dimension.options.map((option, index) => (
          <motion.div
            key={option.id}
            custom={index}
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            layout
            className="h-full"
          >
            <DimensionOptionCard
              option={option}
              dimensionId={dimension.id}
              isSelected={currentSelection === option.id}
              onClick={() => handleSelect(option.id)}
              worldConfig={worldConfig}
              prefillLabels={prefillMap.get(option.id) ?? []}
            />
          </motion.div>
        ))}
      </div>

      <AnimatePresence initial={false}>
        {isDimensionRequired && !isValid && (
          <motion.p
            className="mt-4 px-3 py-2 text-sm text-center rounded-lg"
            style={{
              color: color("warning"),
              background: colorAlpha("warning", 0.1),
              border: `1px solid ${colorAlpha("warning", 0.3)}`,
            }}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: motionConfig.duration.fast }}
          >
            请选择一个选项以继续
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================
// 工厂函数：创建带维度配置的步骤组件
// ============================================================

/**
 * 创建绑定特定维度的步骤组件
 *
 * 用于 config.ts 中注册步骤，无需修改 WizardStepConfig 类型
 * @example
 * ```ts
 * "solo-dim-race": {
 *   component: createDimensionStepComponent(raceDimension),
 *   ...
 * }
 * ```
 */
export function createDimensionStepComponent(
  dimension: CharacterDimension,
): ComponentType<StepProps> {
  function DimensionStep(props: StepProps) {
    return <DimensionSelectionStep {...props} dimension={dimension} />;
  }
  DimensionStep.displayName = `DimensionStep(${dimension.id})`;
  return DimensionStep;
}
