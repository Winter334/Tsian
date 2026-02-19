/**
 * 激活策略编辑区组件
 *
 * 设计文档 6.1~6.2 节：
 * - 单选切换：常量激活 / 关键字激活
 * - constant 时隐藏关键词与扫描深度
 * - selective 时显示关键词输入 + 扫描度覆盖
 * - 扫描深度覆盖：开 = null（使用全局）/ 关 = number（自定义）
 */

import { useState } from "react";

import { Input, Toggle } from "@/components/ui";
import type { ActivationStrategy } from "@/lib/lorebook";
import { cn } from "@/lib/utils";
import { borders, color, colorAlpha } from "@/styles/tokens";

import { KeywordInput } from "./KeywordInput";

interface ActivationStrategySectionProps {
  /** 当前激活策略 */
  strategy: ActivationStrategy;
  /** 策略变更回调 */
  onStrategyChange: (strategy: ActivationStrategy) => void;
  /** 关键词列表 */
  keywords: string[];
  /** 关键词变更回调 */
  onKeywordsChange: (keywords: string[]) => void;
  /** 扫描深度覆盖（null = 使用全局） */
  scanDepth: number | null;
  /** 扫描深度变更回调 */
  onScanDepthChange: (scanDepth: number | null) => void;
}

export function ActivationStrategySection({
  strategy,
  onStrategyChange,
  keywords,
  onKeywordsChange,
  scanDepth,
  onScanDepthChange,
}: ActivationStrategySectionProps) {
  return (
    <div className="flex flex-col gap-4">
      {/* 策略选择 */}
      <SectionHeader title="激活策略" />

      <StrategySelector strategy={strategy} onChange={onStrategyChange} />

      {/* constant 模式说明 */}
      {strategy === "constant" && (
        <p className="text-xs px-1" style={{ color: color("textMuted") }}>
          此条目将始终注入到提示词中，无需关键词触发。
        </p>
      )}

      {/* selective 模式：关键词 + 扫描深度 */}
      {strategy === "selective" && (
        <>
          {/* 关键词输入 */}
          <div className="flex flex-col gap-1.5">
            <label
              className="text-sm font-medium"
              style={{ color: color("textSecondary") }}
            >
              触发关键词
            </label>
            <KeywordInput
              keywords={keywords}
              onChange={onKeywordsChange}
              placeholder="输入关键词，回车或逗号分隔"
            />
            <p className="text-xs px-1" style={{ color: color("textMuted") }}>
              当对话中出现任一关键词时，此条目将被激活（OR 逻辑）。
            </p>
          </div>

          {/* 扫描深度覆盖 */}
          <ScanDepthOverride
            scanDepth={scanDepth}
            onChange={onScanDepthChange}
          />
        </>
      )}
    </div>
  );
}

// ===== 子组件 =====

/** 区块标题 */
function SectionHeader({ title }: { title: string }) {
  return (
    <h3
      className="text-sm font-semibold"
      style={{ color: color("textPrimary") }}
    >
      {title}
    </h3>
  );
}

/** 策略单选器 */
function StrategySelector({
  strategy,
  onChange,
}: {
  strategy: ActivationStrategy;
  onChange: (s: ActivationStrategy) => void;
}) {
  return (
    <div className="flex gap-3">
      <StrategyOption
        label="常量激活"
        description="始终注入"
        selected={strategy === "constant"}
        onClick={() => onChange("constant")}
      />
      <StrategyOption
        label="关键字激活"
        description="条件触发"
        selected={strategy === "selective"}
        onClick={() => onChange("selective")}
      />
    </div>
  );
}

/** 单个策略选项卡片 */
function StrategyOption({
  label,
  description,
  selected,
  onClick,
}: {
  label: string;
  description: string;
  selected: boolean;
  onClick: () => void;
}) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        "flex-1 flex flex-col items-center gap-1",
        "px-4 py-3",
        "rounded-lg border-2",
        "transition-all duration-200",
        "cursor-pointer"
      )}
      style={{
        borderColor: selected
          ? colorAlpha("primary", 0.7)
          : colorAlpha("border", isHovered ? 0.6 : 0.4),
        background: selected
          ? colorAlpha("primary", 0.1)
          : colorAlpha("bgCard", isHovered ? 0.7 : 0.5),
        borderRadius: borders.radius.md,
      }}
    >
      <span
        className="text-sm font-medium"
        style={{
          color: selected ? color("primary") : color("textSecondary"),
        }}
      >
        {label}
      </span>
      <span
        className="text-xs"
        style={{
          color: selected ? colorAlpha("primary", 0.7) : color("textMuted"),
        }}
      >
        {description}
      </span>
    </button>
  );
}

/** 扫描深度覆盖控件 */
function ScanDepthOverride({
  scanDepth,
  onChange,
}: {
  scanDepth: number | null;
  onChange: (scanDepth: number | null) => void;
}) {
  const useGlobal = scanDepth === null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label
          className="text-sm font-medium"
          style={{ color: color("textSecondary") }}
        >
          扫描深度
        </label>
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: color("textMuted") }}>
            {useGlobal ? "使用全局" : "自定义"}
          </span>
          <Toggle
            checked={useGlobal}
            onCheckedChange={(checked) => {
              if (checked) {
                onChange(null);
              } else {
                onChange(2); // 默认值
              }
            }}
            className="scale-75"
          />
        </div>
      </div>

      {!useGlobal && (
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={1}
            max={100}
            value={scanDepth ?? 2}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10);
              if (!isNaN(val) && val > 0) {
                onChange(val);
              }
            }}
            className="w-24 h-9! py-1! px-3! text-center"
          />
          <span className="text-xs" style={{ color: color("textMuted") }}>
            条消息
          </span>
        </div>
      )}

      <p className="text-xs px-1" style={{ color: color("textMuted") }}>
        {useGlobal
          ? "使用世界书全局设定的扫描深度。"
          : `仅扫描最近 ${scanDepth ?? 2} 条消息中的关键词。`}
      </p>
    </div>
  );
}
