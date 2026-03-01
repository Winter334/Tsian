import { Eye, Heart, ScrollText, User } from "lucide-react";
import { useMemo, useState } from "react";

import { usePlayerCharacter } from "@/components/CharacterPanel/usePlayerCharacter";
import { useCharacterFullStats } from "@/hooks/useCharacterFullStats";
import { usePortrait } from "@/lib/portrait";
import { getRuntimeWorldConfig } from "@/lib/world/resolve-config";
import type { WorldConfig } from "@/lib/world/types";
import { useCurrentSaveId } from "@/modules";
import { color, colorAlpha, glow } from "@/styles/tokens";

import { OperationLogPanel } from "./OperationLogPanel";
import { SidebarStatusTags } from "./SidebarStatusTags";

interface LeftSidebarProps {
  onOpenCharacterPanel: () => void;
}

function useRuntimeWorldConfig(): WorldConfig {
  const currentSaveId = useCurrentSaveId();

  return useMemo(() => {
    void currentSaveId;
    return getRuntimeWorldConfig();
  }, [currentSaveId]);
}

function getNum(
  stats: Record<string, number>,
  key: string,
  fallback: number,
): number {
  const value = stats[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function ResourceBar({
  label,
  current,
  max,
}: {
  label: string;
  current: number;
  max: number;
}) {
  const safeMax = Math.max(max, 1);
  const safeCurrent = Math.max(0, current);
  const percent = Math.max(0, Math.min(1, safeCurrent / safeMax));

  const barColorKey: "error" | "warning" | "primary" =
    percent < 0.25 ? "error" : percent < 0.5 ? "warning" : "primary";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span style={{ color: colorAlpha("textSecondary", 0.9) }}>{label}</span>
        <span style={{ color: colorAlpha("textMuted", 0.95) }}>
          {Math.round(safeCurrent)} / {Math.round(safeMax)}
        </span>
      </div>
      <div
        className="relative h-2 rounded-full overflow-hidden"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuenow={Math.round(safeCurrent)}
        aria-valuemax={Math.round(safeMax)}
        style={{
          background: colorAlpha("primary", 0.08),
          border: `1px solid ${colorAlpha(barColorKey, 0.15)}`,
        }}
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
          style={{
            width: `${Math.round(percent * 100)}%`,
            background: `linear-gradient(90deg, ${colorAlpha(barColorKey, 0.6)}, ${colorAlpha(barColorKey, 0.9)})`,
            boxShadow: glow(barColorKey, "sm", 0.3),
          }}
        />
      </div>
    </div>
  );
}

function SidebarPortrait({
  saveId,
  characterId,
  characterName,
  onClick,
}: {
  saveId: string | null;
  characterId: string;
  characterName: string;
  onClick: () => void;
}) {
  const { portraitUrl, isLoading } = usePortrait(saveId, characterId);
  const fallbackText = characterName?.slice(0, 1).toUpperCase() || "?";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="打开角色面板"
      className="w-full rounded-lg overflow-hidden transition-all"
      style={{
        border: `1px solid ${colorAlpha("primary", 0.2)}`,
        background: colorAlpha("bgElevated", 0.45),
      }}
    >
      <div className="relative w-full" style={{ aspectRatio: "3 / 4" }}>
        {isLoading ? (
          <div
            className="w-full h-full animate-pulse"
            style={{ background: colorAlpha("primary", 0.12) }}
          />
        ) : portraitUrl ? (
          <img
            src={portraitUrl}
            alt={characterName}
            className="w-full h-full object-cover"
          />
        ) : (
          <div
            className="w-full h-full flex flex-col items-center justify-center gap-1"
            style={{
              background: colorAlpha("primary", 0.12),
              color: color("textPrimary"),
            }}
          >
            <User
              className="w-9 h-9"
              style={{ color: colorAlpha("textMuted", 0.9) }}
            />
            <span className="text-2xl font-semibold">{fallbackText}</span>
          </div>
        )}
      </div>
    </button>
  );
}

function SidebarResources({
  worldConfig,
  fullStats,
}: {
  worldConfig: WorldConfig;
  fullStats: Record<string, number>;
}) {
  const resources = useMemo(() => {
    const result: Array<{
      key: string;
      label: string;
      current: number;
      max: number;
    }> = [];

    for (const stat of worldConfig.derivedStats) {
      if (!stat.isResource || !stat.maxField) continue;

      const current = getNum(fullStats, stat.key, 0);
      const rawMax = getNum(fullStats, stat.maxField, 0);
      const max = Math.max(rawMax, 1);

      result.push({ key: stat.key, label: stat.label, current, max });
    }

    return result;
  }, [worldConfig.derivedStats, fullStats]);

  if (resources.length === 0) {
    return null;
  }

  return (
    <section
      className="rounded-lg p-3 space-y-3"
      style={{
        background: colorAlpha("bgElevated", 0.42),
        border: `1px solid ${colorAlpha("primary", 0.16)}`,
      }}
    >
      {resources.map((resource) => (
        <ResourceBar
          key={resource.key}
          label={resource.label}
          current={resource.current}
          max={resource.max}
        />
      ))}
    </section>
  );
}

function SidebarDescription({
  appearance,
  personality,
  description,
}: {
  appearance?: string;
  personality?: string;
  description?: string;
}) {
  const [expanded, setExpanded] = useState(false);

  const descriptionItems: Array<{
    key: "appearance" | "personality" | "description";
    title: "外貌" | "性格" | "背景";
    content: string;
  }> = [];

  const trimmedAppearance = appearance?.trim();
  const trimmedPersonality = personality?.trim();
  const trimmedDescription = description?.trim();

  if (trimmedAppearance) {
    descriptionItems.push({
      key: "appearance",
      title: "外貌",
      content: trimmedAppearance,
    });
  }

  if (trimmedPersonality) {
    descriptionItems.push({
      key: "personality",
      title: "性格",
      content: trimmedPersonality,
    });
  }

  if (trimmedDescription) {
    descriptionItems.push({
      key: "description",
      title: "背景",
      content: trimmedDescription,
    });
  }

  if (descriptionItems.length === 0) {
    return null;
  }

  const hasLongContent = descriptionItems.some(
    (item) => item.content.length > 100,
  );

  return (
    <section
      className="rounded-lg p-3"
      style={{
        background: colorAlpha("bgElevated", 0.42),
        border: `1px solid ${colorAlpha("primary", 0.16)}`,
      }}
    >
      <div className="space-y-2">
        {descriptionItems.map((item) => {
          const isLong = item.content.length > 100;

          return (
            <div key={item.key}>
              <div className="flex items-center gap-1.5 mb-1">
                <span style={{ color: colorAlpha("primary", 0.7) }}>
                  {item.key === "appearance" ? (
                    <Eye className="w-3.5 h-3.5" />
                  ) : item.key === "personality" ? (
                    <Heart className="w-3.5 h-3.5" />
                  ) : (
                    <ScrollText className="w-3.5 h-3.5" />
                  )}
                </span>
                <span
                  className="text-xs font-medium"
                  style={{ color: colorAlpha("textSecondary", 0.85) }}
                >
                  {item.title}
                </span>
              </div>

              <p
                className={[
                  "text-xs leading-relaxed whitespace-pre-wrap",
                  !expanded && isLong ? "line-clamp-3" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                style={{ color: colorAlpha("textMuted", 0.85) }}
              >
                {item.content}
              </p>
            </div>
          );
        })}
      </div>

      {hasLongContent && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          className="text-xs mt-1.5 transition-colors"
          style={{ color: colorAlpha("primary", 0.7) }}
        >
          {expanded ? "收起" : "展开全部"}
        </button>
      )}
    </section>
  );
}

export function LeftSidebar({ onOpenCharacterPanel }: LeftSidebarProps) {
  const character = usePlayerCharacter();
  const worldConfig = useRuntimeWorldConfig();
  const currentSaveId = useCurrentSaveId();
  const fullStats = useCharacterFullStats(character, worldConfig);

  if (!character) {
    return (
      <aside className="p-4 space-y-4 overflow-y-auto">
        <div
          className="rounded-lg p-4"
          style={{
            background: colorAlpha("bgElevated", 0.45),
            border: `1px solid ${colorAlpha("primary", 0.18)}`,
          }}
        >
          <p
            className="text-sm"
            style={{ color: colorAlpha("textMuted", 0.9) }}
          >
            暂无玩家角色数据
          </p>
        </div>
      </aside>
    );
  }

  const level = Math.max(1, Math.round(getNum(fullStats, "level", 1)));

  return (
    <aside className="p-3 space-y-3 overflow-y-auto">
      <SidebarPortrait
        saveId={currentSaveId}
        characterId={character.id}
        characterName={character.name}
        onClick={onOpenCharacterPanel}
      />

      <button
        type="button"
        onClick={onOpenCharacterPanel}
        className="w-full text-left rounded-lg p-3 transition-colors"
        style={{
          background: colorAlpha("bgElevated", 0.5),
          border: `1px solid ${colorAlpha("primary", 0.2)}`,
        }}
      >
        <p
          className="text-base font-semibold truncate"
          style={{ color: color("textPrimary") }}
        >
          {character.name}
        </p>
        <p
          className="text-xs"
          style={{ color: colorAlpha("textSecondary", 0.8) }}
        >
          LV.{level}
        </p>
      </button>

      <SidebarResources worldConfig={worldConfig} fullStats={fullStats} />
      <SidebarStatusTags character={character} worldConfig={worldConfig} />

      <SidebarDescription
        appearance={character.appearance}
        personality={character.personality}
        description={character.description}
      />

      <OperationLogPanel />
    </aside>
  );
}

export type { LeftSidebarProps };
