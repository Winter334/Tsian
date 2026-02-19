/**
 * 角色资源条组件
 *
 * 从 worldConfig.derivedStats 中提取 isResource 字段，
 * 按声明顺序显示资源条（HP / MP 等）。
 *
 * 缺值降级规则：
 * - current 缺失 → 0
 * - max 缺失 → 至少为 1
 * 无资源字段时隐藏整个区块。
 */

import { Activity } from "lucide-react";
import { useMemo } from "react";

import type { WorldConfig } from "@/lib/world/types";
import { color, colorAlpha, glow } from "@/styles/tokens";

// ── 类型 ──

interface ResourceEntry {
  key: string;
  label: string;
  current: number;
  max: number;
  percent: number;
  maxFieldKey: string;
}

interface CharacterResourcesProps {
  worldConfig: WorldConfig;
  fullStats: Record<string, number | string | boolean>;
}

// ── 工具 ──

function getNum(
  stats: Record<string, number | string | boolean>,
  key: string,
  fallback: number,
): number {
  const v = stats[key];
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

// ── 主组件 ──

export function CharacterResources({
  worldConfig,
  fullStats,
}: CharacterResourcesProps) {
  const resources = useMemo<ResourceEntry[]>(() => {
    const result: ResourceEntry[] = [];

    // 按 derivedStats 声明顺序遍历，保持顺序
    for (const stat of worldConfig.derivedStats) {
      if (!stat.isResource || !stat.maxField) continue;

      const current = getNum(fullStats, stat.key, 0);
      const rawMax = getNum(fullStats, stat.maxField, 0);
      const max = Math.max(rawMax, 1); // 上限至少为 1
      const percent = Math.max(0, Math.min(1, current / max));

      result.push({
        key: stat.key,
        label: stat.label,
        current,
        max,
        percent,
        maxFieldKey: stat.maxField,
      });
    }

    return result;
  }, [worldConfig.derivedStats, fullStats]);

  // 无资源字段时不渲染
  if (resources.length === 0) return null;

  return (
    <div className="space-y-2.5">
      <div
        className="flex items-center gap-2 mb-2"
        style={{
          borderBottom: `1px solid ${colorAlpha("primary", 0.15)}`,
          paddingBottom: "0.5rem",
        }}
      >
        <span style={{ color: color("primary") }}>
          <Activity className="w-4 h-4" />
        </span>
        <h3
          className="text-sm font-semibold uppercase tracking-wider"
          style={{ color: color("primary") }}
        >
          资源
        </h3>
      </div>

      {resources.map((res) => {
        // 根据百分比选择颜色状态
        const barColorKey: "error" | "warning" | "primary" =
          res.percent < 0.25
            ? "error"
            : res.percent < 0.5
              ? "warning"
              : "primary";

        return (
          <div key={res.key} className="space-y-1 pl-1">
            {/* 标签行 */}
            <div className="flex items-center justify-between">
              <span
                className="text-xs font-medium"
                style={{ color: color("textMuted") }}
              >
                {res.label}
              </span>
              <span className="text-xs" style={{ color: color("textMuted") }}>
                <span
                  className="font-bold text-sm"
                  style={{
                    color: color(barColorKey),
                    textShadow:
                      res.percent < 0.25 ? glow("error", "sm", 0.4) : undefined,
                  }}
                >
                  {Math.round(res.current)}
                </span>
                <span style={{ color: colorAlpha("textMuted", 0.6) }}>
                  {" / "}
                </span>
                <span style={{ color: color("textSecondary") }}>
                  {Math.round(res.max)}
                </span>
              </span>
            </div>

            {/* 进度条 */}
            <div
              className="relative h-2 rounded-full overflow-hidden"
              style={{
                background: colorAlpha("primary", 0.08),
                border: `1px solid ${colorAlpha(barColorKey, 0.15)}`,
              }}
            >
              <div
                className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
                style={{
                  width: `${Math.round(res.percent * 100)}%`,
                  background: `linear-gradient(90deg, ${colorAlpha(barColorKey, 0.6)}, ${colorAlpha(barColorKey, 0.9)})`,
                  boxShadow: glow(barColorKey, "sm", 0.3),
                }}
              />
            </div>

            {/* 百分比 */}
            <div className="text-right">
              <span
                className="text-xs"
                style={{ color: colorAlpha("textMuted", 0.5) }}
              >
                {Math.round(res.percent * 100)}%
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
