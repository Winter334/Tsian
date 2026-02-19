/**
 * 双层雷达图组件
 *
 * 第一层（内层）：主属性面（allocatableAttributes）
 * 第二层（外层）：非资源衍生属性（showInUI && !isResource）
 *
 * 归一化规则：
 * - 主属性：1~30
 * - 非资源衍生：0~max(当前值, 10)
 * - level 字段始终不进入雷达轴
 *
 * 交互：
 * - 入场时数据多边形从中心向外扩展动画
 * - 点击切换主属性 / 衍生属性高亮模式
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type {
  DerivedStatConfig,
  PrimaryAttributeConfig,
  WorldConfig,
} from "@/lib/world/types";
import { color, colorAlpha } from "@/styles/tokens";

// ── 类型 ──

interface RadarAxis {
  key: string;
  label: string;
  value: number;
  /** 归一化后的值 (0~1) */
  normalized: number;
}

interface CharacterRadarChartProps {
  /** 运行时 WorldConfig */
  worldConfig: WorldConfig;
  /** 完整属性集（base + derived） */
  fullStats: Record<string, number | string | boolean>;
  /** 是否播放入场动画（默认 true） */
  animate?: boolean;
}

// ── 工具函数 ──

/** 安全归一化：防 NaN / 除0 / clamp 0~1 */
function safeNormalize(value: number, min: number, max: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(min) || !Number.isFinite(max))
    return 0;
  if (max <= min) return 0;
  const normalized = (value - min) / (max - min);
  return Math.max(0, Math.min(1, normalized));
}

/** 获取数值，非数字返回 0 */
function getNumericValue(
  stats: Record<string, number | string | boolean>,
  key: string,
): number {
  const v = stats[key];
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

/** 计算多边形顶点坐标 */
function getPolygonPoints(
  axes: RadarAxis[],
  cx: number,
  cy: number,
  radius: number,
  /** 动画进度 0~1，缩放归一化值 */
  progress: number = 1,
): string {
  return axes
    .map((axis, i) => {
      const angle = (Math.PI * 2 * i) / axes.length - Math.PI / 2;
      const r = radius * axis.normalized * progress;
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      return `${x},${y}`;
    })
    .join(" ");
}

/** 获取轴标签的坐标位置 */
function getLabelPosition(
  index: number,
  total: number,
  cx: number,
  cy: number,
  radius: number,
): { x: number; y: number; anchor: "middle" | "start" | "end" } {
  const angle = (Math.PI * 2 * index) / total - Math.PI / 2;
  const labelRadius = radius + 18;
  const x = cx + labelRadius * Math.cos(angle);
  const y = cy + labelRadius * Math.sin(angle);

  // 根据角度决定文本锚点
  const angleDeg = ((angle * 180) / Math.PI + 360) % 360;
  let anchor: "middle" | "start" | "end" = "middle";
  if (angleDeg > 10 && angleDeg < 170) anchor = "start";
  else if (angleDeg > 190 && angleDeg < 350) anchor = "end";

  return { x, y, anchor };
}

/** ease-out 三次缓动 */
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

// ── 数据准备 hooks ──

function usePrimaryAxes(
  worldConfig: WorldConfig,
  fullStats: Record<string, number | string | boolean>,
): RadarAxis[] {
  return useMemo(() => {
    // 决定主属性列表：pointBuyRules.allocatableAttributes 优先，否则 fallback primaryAttributes
    let primaryKeys: string[];
    if (
      worldConfig.pointBuyRules?.allocatableAttributes &&
      worldConfig.pointBuyRules.allocatableAttributes.length > 0
    ) {
      primaryKeys = worldConfig.pointBuyRules.allocatableAttributes;
    } else {
      primaryKeys = worldConfig.primaryAttributes
        .map((a) => a.key)
        .filter((k) => k !== "level");
    }

    // 排除 level
    primaryKeys = primaryKeys.filter((k) => k !== "level");

    // 构建属性映射表用于查找 label
    const attrMap = new Map<string, PrimaryAttributeConfig>();
    for (const attr of worldConfig.primaryAttributes) {
      attrMap.set(attr.key, attr);
    }

    return primaryKeys.map((key) => {
      const config = attrMap.get(key);
      const label = config?.label ?? key;
      const value = getNumericValue(fullStats, key);
      // 主属性归一化范围：1~30
      const normalized = safeNormalize(value, 1, 30);
      return { key, label, value, normalized };
    });
  }, [worldConfig, fullStats]);
}

function useDerivedAxes(
  worldConfig: WorldConfig,
  fullStats: Record<string, number | string | boolean>,
): RadarAxis[] {
  return useMemo(() => {
    // 筛选非资源衍生属性：showInUI === true && isResource !== true
    const derivedConfigs = worldConfig.derivedStats.filter(
      (s: DerivedStatConfig) => s.showInUI === true && s.isResource !== true,
    );

    return derivedConfigs.map((config) => {
      const value = getNumericValue(fullStats, config.key);
      // 非资源衍生归一化：0~max(当前值, 10)
      const maxVal = Math.max(value, 10);
      const normalized = safeNormalize(value, 0, maxVal);
      return {
        key: config.key,
        label: config.label,
        value,
        normalized,
      };
    });
  }, [worldConfig, fullStats]);
}

// ── 入场动画 hook ──

function useEntranceAnimation(animate: boolean): number {
  const [progress, setProgress] = useState(animate ? 0 : 1);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (!animate) {
      setProgress(1);
      return;
    }

    setProgress(0);
    startRef.current = null;

    const duration = 700; // ms
    let rafId: number;

    function tick(timestamp: number) {
      if (startRef.current === null) startRef.current = timestamp;
      const elapsed = timestamp - startRef.current;
      const t = Math.min(elapsed / duration, 1);
      setProgress(easeOutCubic(t));
      if (t < 1) {
        rafId = requestAnimationFrame(tick);
      }
    }

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [animate]);

  return progress;
}

// ── 网格背景 ──

function RadarGrid({
  axes,
  cx,
  cy,
  radius,
  rings,
}: {
  axes: RadarAxis[];
  cx: number;
  cy: number;
  radius: number;
  rings: number;
}) {
  const n = axes.length;
  if (n < 3) return null;

  return (
    <g>
      {/* 同心多边形网格 */}
      {Array.from({ length: rings }, (_, ringIdx) => {
        const r = (radius * (ringIdx + 1)) / rings;
        const points = Array.from({ length: n }, (_, i) => {
          const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
          return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
        }).join(" ");

        return (
          <polygon
            key={ringIdx}
            points={points}
            fill="none"
            stroke={colorAlpha("primary", 0.08 + ringIdx * 0.02)}
            strokeWidth={0.5}
          />
        );
      })}

      {/* 轴线（从中心向外） */}
      {axes.map((_, i) => {
        const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
        return (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={cx + radius * Math.cos(angle)}
            y2={cy + radius * Math.sin(angle)}
            stroke={colorAlpha("primary", 0.1)}
            strokeWidth={0.5}
          />
        );
      })}
    </g>
  );
}

// ── 数据面 ──

function RadarPolygon({
  axes,
  cx,
  cy,
  radius,
  fillColor,
  fillAlpha,
  strokeColor,
  strokeAlpha,
  animationProgress = 1,
}: {
  axes: RadarAxis[];
  cx: number;
  cy: number;
  radius: number;
  fillColor: string;
  fillAlpha: number;
  strokeColor: string;
  strokeAlpha: number;
  /** 入场动画进度 0~1 */
  animationProgress?: number;
}) {
  if (axes.length < 3) return null;

  const points = getPolygonPoints(axes, cx, cy, radius, animationProgress);

  return (
    <polygon
      points={points}
      fill={colorAlpha(fillColor as "primary", fillAlpha)}
      stroke={colorAlpha(strokeColor as "primary", strokeAlpha)}
      strokeWidth={1.5}
      strokeLinejoin="round"
    />
  );
}

// ── 轴标签与数值 ──

function RadarLabels({
  axes,
  cx,
  cy,
  radius,
}: {
  axes: RadarAxis[];
  cx: number;
  cy: number;
  radius: number;
}) {
  const n = axes.length;
  if (n < 3) return null;

  return (
    <g>
      {axes.map((axis, i) => {
        const pos = getLabelPosition(i, n, cx, cy, radius);
        return (
          <g key={axis.key}>
            {/* 标签名 */}
            <text
              x={pos.x}
              y={pos.y - 4}
              textAnchor={pos.anchor}
              fill={color("textMuted")}
              fontSize={10}
              fontWeight={500}
            >
              {axis.label}
            </text>
            {/* 数值 */}
            <text
              x={pos.x}
              y={pos.y + 10}
              textAnchor={pos.anchor}
              fill={color("textPrimary")}
              fontSize={11}
              fontWeight={700}
            >
              {Math.round(axis.value)}
            </text>
          </g>
        );
      })}
    </g>
  );
}

// ── 顶点圆点 ──

function RadarDots({
  axes,
  cx,
  cy,
  radius,
  colorName,
  animationProgress = 1,
}: {
  axes: RadarAxis[];
  cx: number;
  cy: number;
  radius: number;
  colorName: "primary" | "secondary";
  animationProgress?: number;
}) {
  const n = axes.length;
  if (n < 3) return null;

  return (
    <g>
      {axes.map((axis, i) => {
        const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
        const r = radius * axis.normalized * animationProgress;
        const x = cx + r * Math.cos(angle);
        const y = cy + r * Math.sin(angle);
        return (
          <circle
            key={axis.key}
            cx={x}
            cy={y}
            r={2.5}
            fill={color(colorName)}
            style={{
              filter: `drop-shadow(0 0 3px ${colorAlpha(colorName, 0.6)})`,
            }}
          />
        );
      })}
    </g>
  );
}

// ── 主组件 ──

export function CharacterRadarChart({
  worldConfig,
  fullStats,
  animate = true,
}: CharacterRadarChartProps) {
  const primaryAxes = usePrimaryAxes(worldConfig, fullStats);
  const derivedAxes = useDerivedAxes(worldConfig, fullStats);

  const hasDerivedLayer = derivedAxes.length >= 3;

  // 入场动画
  const animProgress = useEntranceAnimation(animate);

  // 点击切换主属性 / 衍生属性模式
  const [showDerived, setShowDerived] = useState(false);
  const handleToggle = useCallback(() => {
    if (hasDerivedLayer) {
      setShowDerived((prev) => !prev);
    }
  }, [hasDerivedLayer]);

  // 悬浮状态
  const [isHovered, setIsHovered] = useState(false);

  // 尺寸配置
  const size = 280;
  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2 - 45;

  // 至少需要 3 个主属性轴才能渲染
  if (primaryAxes.length < 3) {
    return (
      <div
        className="flex items-center justify-center py-8 text-sm"
        style={{ color: color("textMuted") }}
      >
        属性不足，无法生成雷达图
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="w-full max-w-70"
        onClick={handleToggle}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          overflow: "visible",
          cursor: hasDerivedLayer ? "pointer" : "default",
          filter:
            isHovered && hasDerivedLayer
              ? `drop-shadow(0 0 6px ${colorAlpha("primary", 0.25)})`
              : "none",
          transition: "filter 300ms ease",
        }}
      >
        {/* ── 主属性网格（始终可见） ── */}
        <RadarGrid
          axes={primaryAxes}
          cx={cx}
          cy={cy}
          radius={radius}
          rings={4}
        />

        {/* ── 衍生属性层（网格 + 数据面 + 圆点） ── */}
        {hasDerivedLayer && (
          <g
            style={{
              opacity: showDerived ? 1 : 0.3,
              transition: "opacity 300ms ease",
            }}
          >
            <RadarGrid
              axes={derivedAxes}
              cx={cx}
              cy={cy}
              radius={radius * 0.85}
              rings={3}
            />
            <RadarPolygon
              axes={derivedAxes}
              cx={cx}
              cy={cy}
              radius={radius * 0.85}
              fillColor="secondary"
              fillAlpha={0.15}
              strokeColor="secondary"
              strokeAlpha={0.7}
              animationProgress={animProgress}
            />
            <RadarDots
              axes={derivedAxes}
              cx={cx}
              cy={cy}
              radius={radius * 0.85}
              colorName="secondary"
              animationProgress={animProgress}
            />
          </g>
        )}

        {/* ── 主属性层（数据面 + 圆点） ── */}
        <g
          style={{
            opacity: showDerived ? 0.3 : 1,
            transition: "opacity 300ms ease",
          }}
        >
          <RadarPolygon
            axes={primaryAxes}
            cx={cx}
            cy={cy}
            radius={radius}
            fillColor="primary"
            fillAlpha={0.15}
            strokeColor="primary"
            strokeAlpha={0.7}
            animationProgress={animProgress}
          />
          <RadarDots
            axes={primaryAxes}
            cx={cx}
            cy={cy}
            radius={radius}
            colorName="primary"
            animationProgress={animProgress}
          />
        </g>

        {/* ── 主属性标签 ── */}
        <g
          style={{
            opacity: showDerived ? 0 : animProgress,
            transition: "opacity 300ms ease",
            pointerEvents: "none",
          }}
        >
          <RadarLabels axes={primaryAxes} cx={cx} cy={cy} radius={radius} />
        </g>

        {/* ── 衍生属性标签（仅在衍生模式下显示） ── */}
        {hasDerivedLayer && (
          <g
            style={{
              opacity: showDerived ? animProgress : 0,
              transition: "opacity 300ms ease",
              pointerEvents: "none",
            }}
          >
            <RadarLabels
              axes={derivedAxes}
              cx={cx}
              cy={cy}
              radius={radius * 0.85}
            />
          </g>
        )}
      </svg>
    </div>
  );
}
