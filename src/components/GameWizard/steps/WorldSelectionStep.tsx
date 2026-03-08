import { Loader2, Orbit, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Card } from "@/components/ui";
import {
  DEFAULT_WORLD_CONFIG,
  resolveWorldRules,
  useWorldStore,
  type WorldIndex,
} from "@/lib/world";
import type { World, WorldConfig, WorldId } from "@/lib/world/types";
import { color, colorAlpha } from "@/styles/tokens";

import type { StepProps } from "../types";

interface SummaryMetric {
  label: string;
  value: string;
}

interface WorldOptionCardProps {
  worldIndex: WorldIndex;
  world: World | null;
  isSelected: boolean;
  isActive: boolean;
  isPending: boolean;
  onSelect: (worldId: WorldId) => void;
}

function getSourceLabel(source: World["meta"]["source"]): string {
  return source === "custom" ? "自定义" : "内置";
}

function getDescriptionExcerpt(description?: string): string {
  const trimmed = description?.trim();
  if (!trimmed) {
    return "未提供世界描述。";
  }

  return trimmed.length > 88 ? `${trimmed.slice(0, 88)}…` : trimmed;
}

function buildSummaryMetrics(worldConfig: WorldConfig): SummaryMetric[] {
  const visibleDimensions = (worldConfig.dimensions ?? []).filter(
    (dimension) => dimension.options.length > 0,
  ).length;

  return [
    {
      label: "主要属性",
      value: String(worldConfig.primaryAttributes.length),
    },
    {
      label: "创建维度",
      value: String(visibleDimensions),
    },
    {
      label: "可选天赋",
      value: String(worldConfig.talents?.length ?? 0),
    },
  ];
}

function WorldOptionCard({
  worldIndex,
  world,
  isSelected,
  isActive,
  isPending,
  onSelect,
}: WorldOptionCardProps) {
  return (
    <Card
      variant={isSelected ? "elevated" : "outlined"}
      hover={!isPending}
      onClick={() => {
        if (!isPending) {
          onSelect(worldIndex.id);
        }
      }}
      className="h-full p-4"
      style={
        isSelected
          ? {
              borderColor: color("primary"),
              boxShadow: `0 0 24px ${colorAlpha("primary", 0.14)}`,
            }
          : undefined
      }
    >
      <div className="flex h-full flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3
                className="truncate text-sm font-semibold"
                style={{ color: color("textPrimary") }}
              >
                {worldIndex.name || "未命名世界"}
              </h3>
              <span
                className="rounded-full px-2 py-0.5 text-[11px]"
                style={{
                  background: colorAlpha(
                    worldIndex.source === "custom" ? "primary" : "secondary",
                    0.12,
                  ),
                  color: color(
                    worldIndex.source === "custom" ? "primary" : "secondary",
                  ),
                }}
              >
                {getSourceLabel(worldIndex.source)}
              </span>
              {isActive && (
                <span
                  className="rounded-full px-2 py-0.5 text-[11px]"
                  style={{
                    background: colorAlpha("success", 0.14),
                    color: color("success"),
                  }}
                >
                  当前活动
                </span>
              )}
              {isSelected && (
                <span
                  className="rounded-full px-2 py-0.5 text-[11px]"
                  style={{
                    background: colorAlpha("primary", 0.16),
                    color: color("primary"),
                  }}
                >
                  已选中
                </span>
              )}
            </div>
            <p
              className="mt-2 text-sm leading-relaxed"
              style={{ color: colorAlpha("textMuted", 0.82) }}
            >
              {getDescriptionExcerpt(world?.meta.description)}
            </p>
          </div>

          {isPending ? (
            <Loader2
              className="mt-0.5 h-4 w-4 shrink-0 animate-spin"
              style={{ color: color("primary") }}
            />
          ) : null}
        </div>

        <div
          className="mt-auto flex items-center justify-between text-xs"
          style={{ color: colorAlpha("textMuted", 0.72) }}
        >
          <span>上次更新</span>
          <span>
            {world?.meta.updatedAt
              ? new Date(world.meta.updatedAt).toLocaleDateString("zh-CN")
              : "未记录"}
          </span>
        </div>
      </div>
    </Card>
  );
}

export function WorldSelectionStep({
  context,
  onNext,
  onUpdateContext,
  onValidationChange,
}: StepProps) {
  const worlds = useWorldStore((state) => state.worlds);
  const activeWorldId = useWorldStore((state) => state.activeWorldId);
  const loadedWorlds = useWorldStore((state) => state.loadedWorlds);
  const getWorld = useWorldStore((state) => state.getWorld);

  const [pendingWorldId, setPendingWorldId] = useState<WorldId | null>(null);

  useEffect(() => {
    for (const world of worlds) {
      if (!loadedWorlds.has(world.id)) {
        void getWorld(world.id);
      }
    }
  }, [getWorld, loadedWorlds, worlds]);

  const selectedWorldId =
    pendingWorldId ?? context.worldId ?? activeWorldId ?? worlds[0]?.id ?? null;
  const selectedWorld = selectedWorldId
    ? (loadedWorlds.get(selectedWorldId) ?? null)
    : null;

  const selectedWorldConfig = useMemo(
    () =>
      selectedWorld
        ? resolveWorldRules(selectedWorld)
        : (context.worldConfig ?? DEFAULT_WORLD_CONFIG),
    [context.worldConfig, selectedWorld],
  );

  const summaryMetrics = useMemo(
    () => buildSummaryMetrics(selectedWorldConfig),
    [selectedWorldConfig],
  );

  useEffect(() => {
    if (
      !selectedWorldId ||
      context.stepData.worldSelection?.worldId === selectedWorldId
    ) {
      return;
    }

    onUpdateContext({
      worldId: selectedWorldId,
      worldConfig: selectedWorldConfig,
      stepData: {
        ...context.stepData,
        worldSelection: { worldId: selectedWorldId },
      },
    });
  }, [context.stepData, onUpdateContext, selectedWorldConfig, selectedWorldId]);

  useEffect(() => {
    onValidationChange?.(Boolean(selectedWorldId) && pendingWorldId === null);
  }, [onValidationChange, pendingWorldId, selectedWorldId]);

  const handleSelectWorld = useCallback(
    async (worldId: WorldId) => {
      if (worldId === selectedWorldId && pendingWorldId === null) {
        return;
      }

      setPendingWorldId(worldId);

      try {
        const world = loadedWorlds.get(worldId) ?? (await getWorld(worldId));
        const worldConfig = world
          ? resolveWorldRules(world)
          : DEFAULT_WORLD_CONFIG;
        const updates = {
          worldId,
          worldConfig,
          dimensionSelections: undefined,
          talentIds: undefined,
          allocatedPoints: undefined,
          attributes: undefined,
          stepData: {
            ...context.stepData,
            worldSelection: { worldId },
          },
        };

        if (context.mode === "create-room") {
          onNext(updates);
          return;
        }

        onUpdateContext(updates);
      } finally {
        setPendingWorldId(null);
      }
    },
    [
      context.mode,
      context.stepData,
      getWorld,
      loadedWorlds,
      onNext,
      onUpdateContext,
      pendingWorldId,
      selectedWorldId,
    ],
  );

  if (worlds.length === 0) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-6 md:px-6 md:py-8">
        <Card variant="outlined" hover={false} className="p-6 text-center">
          <p
            className="text-base font-medium"
            style={{ color: color("textPrimary") }}
          >
            暂无可选世界
          </p>
          <p
            className="mt-2 text-sm"
            style={{ color: colorAlpha("textMuted", 0.78) }}
          >
            世界系统尚未准备完成，当前流程无法继续。
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-4 md:gap-6 md:px-6 md:py-8">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.8fr)_minmax(280px,1fr)]">
        <Card variant="outlined" hover={false} className="p-5 md:p-6">
          <div className="flex items-start gap-3">
            <div
              className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
              style={{
                background: colorAlpha("primary", 0.12),
                border: `1px solid ${colorAlpha("primary", 0.2)}`,
              }}
            >
              <Orbit className="h-5 w-5" style={{ color: color("primary") }} />
            </div>
            <div>
              <h2
                className="text-lg font-semibold"
                style={{ color: color("textPrimary") }}
              >
                选择本次冒险使用的世界
              </h2>
              <p
                className="mt-1 text-sm leading-relaxed"
                style={{ color: colorAlpha("textMuted", 0.78) }}
              >
                单机建档与联机建房都会从这里取作者态世界真源。当前活动世界已自动作为默认选择，你也可以在开始前切换到其他世界。
              </p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
            {worlds.map((worldIndex) => (
              <WorldOptionCard
                key={worldIndex.id}
                worldIndex={worldIndex}
                world={loadedWorlds.get(worldIndex.id) ?? null}
                isSelected={worldIndex.id === selectedWorldId}
                isActive={worldIndex.id === activeWorldId}
                isPending={worldIndex.id === pendingWorldId}
                onSelect={handleSelectWorld}
              />
            ))}
          </div>
        </Card>

        <Card variant="outlined" hover={false} className="p-5 md:p-6">
          <div className="flex items-start gap-3">
            <div
              className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
              style={{
                background: colorAlpha("secondary", 0.12),
                border: `1px solid ${colorAlpha("secondary", 0.2)}`,
              }}
            >
              <Sparkles
                className="h-5 w-5"
                style={{ color: color("secondary") }}
              />
            </div>
            <div className="min-w-0 flex-1">
              <p
                className="text-sm"
                style={{ color: colorAlpha("textMuted", 0.74) }}
              >
                当前选择
              </p>
              <h3
                className="mt-1 truncate text-base font-semibold"
                style={{ color: color("textPrimary") }}
              >
                {selectedWorld?.meta.name ??
                  worlds.find((world) => world.id === selectedWorldId)?.name ??
                  "默认世界"}
              </h3>
              <p
                className="mt-2 text-sm leading-relaxed"
                style={{ color: colorAlpha("textMuted", 0.8) }}
              >
                {getDescriptionExcerpt(selectedWorld?.meta.description)}
              </p>
            </div>
          </div>

          <dl className="mt-5 grid grid-cols-3 gap-3">
            {summaryMetrics.map((metric) => (
              <div
                key={metric.label}
                className="rounded-lg px-3 py-3 text-center"
                style={{
                  background: colorAlpha("bgCard", 0.46),
                  border: `1px solid ${colorAlpha("border", 0.24)}`,
                }}
              >
                <dt
                  className="text-[11px] uppercase tracking-wide"
                  style={{ color: colorAlpha("textMuted", 0.72) }}
                >
                  {metric.label}
                </dt>
                <dd
                  className="mt-1 text-lg font-semibold"
                  style={{ color: color("textPrimary") }}
                >
                  {metric.value}
                </dd>
              </div>
            ))}
          </dl>

          <div
            className="mt-5 rounded-lg px-3 py-3 text-sm leading-relaxed"
            style={{
              background: colorAlpha("primary", 0.05),
              border: `1px solid ${colorAlpha("primary", 0.16)}`,
              color: colorAlpha("textMuted", 0.84),
            }}
          >
            切换世界后，后续角色创建维度、属性点分配与天赋规则都会立即改为使用所选世界；已选的维度、属性与天赋会自动清空，避免跨世界残留数据。
          </div>
        </Card>
      </div>
    </div>
  );
}
