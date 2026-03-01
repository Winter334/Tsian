import {
  Archive,
  BookText,
  Compass,
  Flag,
  HelpCircle,
  Search,
  Shield,
  Sparkles,
  Swords,
  User,
} from "lucide-react";
import { useMemo } from "react";

import { Button, Input, Select } from "@/components/ui";
import type {
  EntityArchetype,
  EntityPresence,
  NarrativeEntity,
} from "@/modules";
import { color, colorAlpha } from "@/styles/tokens";

import type { ArchiveListFilter } from "./hooks/useArchiveWorkspaceState";

interface ArchiveEntityListProps {
  entities: NarrativeEntity[];
  selectedEntityId: string | null;
  searchKeyword: string;
  filter: ArchiveListFilter;
  onSearchKeywordChange: (keyword: string) => void;
  onFilterChange: (filter: ArchiveListFilter) => void;
  onSelectEntity: (entityId: string) => void;
  onCreateEntity: () => void;
}

const PRESENCE_ORDER: EntityPresence[] = [
  "active",
  "nearby",
  "dormant",
  "resolved",
];

const FILTER_OPTIONS: Array<{ value: ArchiveListFilter; label: string }> = [
  { value: "all", label: "全部" },
  { value: "presence:active", label: "在场（active）" },
  { value: "presence:nearby", label: "附近（nearby）" },
  { value: "presence:dormant", label: "休眠（dormant）" },
  { value: "presence:resolved", label: "已解决（resolved）" },
  { value: "archetype:character", label: "类别：角色" },
  { value: "archetype:event", label: "类别：事件" },
  { value: "archetype:faction", label: "类别：势力" },
  { value: "archetype:location", label: "类别：地点" },
  { value: "archetype:item_unique", label: "类别：唯一道具" },
  { value: "archetype:quest", label: "类别：任务" },
  { value: "archetype:mystery", label: "类别：谜团" },
  { value: "archetype:custom", label: "类别：自定义" },
];

const PRESENCE_LABEL: Record<EntityPresence, string> = {
  active: "active（在场）",
  nearby: "nearby（附近）",
  dormant: "dormant（休眠）",
  resolved: "resolved（已解决）",
};

const PRESENCE_DOT_COLOR: Record<EntityPresence, string> = {
  active: color("success"),
  nearby: color("primary"),
  dormant: color("warning"),
  resolved: color("textMuted"),
};

function getArchetypeLabel(archetype: EntityArchetype): string {
  switch (archetype) {
    case "character":
      return "角色";
    case "event":
      return "事件";
    case "faction":
      return "势力";
    case "location":
      return "地点";
    case "item_unique":
      return "唯一道具";
    case "quest":
      return "任务";
    case "mystery":
      return "谜团";
    case "custom":
      return "自定义";
  }
}

function ArchetypeIcon({ archetype }: { archetype: EntityArchetype }) {
  const className = "h-4 w-4";

  switch (archetype) {
    case "character":
      return <User className={className} />;
    case "event":
      return <Sparkles className={className} />;
    case "faction":
      return <Shield className={className} />;
    case "location":
      return <Compass className={className} />;
    case "item_unique":
      return <Swords className={className} />;
    case "quest":
      return <Flag className={className} />;
    case "mystery":
      return <HelpCircle className={className} />;
    case "custom":
      return <Archive className={className} />;
    default:
      return <BookText className={className} />;
  }
}

export function ArchiveEntityList({
  entities,
  selectedEntityId,
  searchKeyword,
  filter,
  onSearchKeywordChange,
  onFilterChange,
  onSelectEntity,
  onCreateEntity,
}: ArchiveEntityListProps) {
  const normalizedKeyword = searchKeyword.trim().toLowerCase();

  const filteredEntities = useMemo(() => {
    return entities.filter((entity) => {
      if (
        normalizedKeyword.length > 0 &&
        !entity.name.toLowerCase().includes(normalizedKeyword)
      ) {
        return false;
      }

      if (filter === "all") {
        return true;
      }

      if (filter.startsWith("presence:")) {
        const presence = filter.replace("presence:", "") as EntityPresence;
        return entity.presence === presence;
      }

      if (filter.startsWith("archetype:")) {
        const archetype = filter.replace("archetype:", "") as EntityArchetype;
        return entity.archetype === archetype;
      }

      return true;
    });
  }, [entities, filter, normalizedKeyword]);

  const grouped = useMemo(() => {
    const map = new Map<EntityPresence, NarrativeEntity[]>();
    PRESENCE_ORDER.forEach((presence) => {
      map.set(presence, []);
    });

    filteredEntities.forEach((entity) => {
      const bucket = map.get(entity.presence);
      if (bucket) {
        bucket.push(entity);
      }
    });

    return PRESENCE_ORDER.map((presence) => ({
      presence,
      entities: map.get(presence) ?? [],
    }));
  }, [filteredEntities]);

  return (
    <section className="flex h-full min-h-0 flex-col">
      <div
        className="space-y-2 border-b px-3 py-3"
        style={{ borderColor: colorAlpha("primary", 0.14) }}
      >
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2"
            style={{ color: color("textMuted") }}
          />
          <Input
            value={searchKeyword}
            onChange={(event) => onSearchKeywordChange(event.target.value)}
            placeholder="按名称搜索实体"
            className="h-9 pl-8"
          />
        </div>

        <Select
          value={filter}
          onValueChange={(value) => onFilterChange(value as ArchiveListFilter)}
          options={FILTER_OPTIONS}
          size="sm"
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {grouped.every((group) => group.entities.length === 0) && (
          <div
            className="rounded-md border px-3 py-4 text-center text-xs"
            style={{
              color: color("textMuted"),
              borderColor: colorAlpha("primary", 0.18),
              background: colorAlpha("bgElevated", 0.28),
            }}
          >
            没有匹配的实体
          </div>
        )}

        <div className="space-y-3">
          {grouped.map((group) => {
            if (group.entities.length === 0) {
              return null;
            }

            return (
              <div key={group.presence} className="space-y-1.5">
                <div
                  className="px-1 text-xs font-semibold"
                  style={{
                    color: colorAlpha("textSecondary", 0.85),
                  }}
                >
                  {PRESENCE_LABEL[group.presence]}
                </div>

                <div className="space-y-1">
                  {group.entities.map((entity) => {
                    const selected = entity.id === selectedEntityId;
                    return (
                      <button
                        key={entity.id}
                        type="button"
                        onClick={() => onSelectEntity(entity.id)}
                        className="w-full rounded-md border px-2.5 py-2 text-left transition-colors"
                        style={{
                          borderColor: selected
                            ? colorAlpha("primary", 0.5)
                            : colorAlpha("primary", 0.14),
                          background: selected
                            ? colorAlpha("primary", 0.16)
                            : colorAlpha("bgCard", 0.18),
                        }}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0 flex items-center gap-2">
                            <span style={{ color: color("primary") }}>
                              <ArchetypeIcon archetype={entity.archetype} />
                            </span>
                            <span
                              className="truncate text-sm font-medium"
                              style={{ color: color("textPrimary") }}
                            >
                              {entity.name || "(未命名实体)"}
                            </span>
                          </div>

                          <span
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{
                              background: PRESENCE_DOT_COLOR[entity.presence],
                            }}
                          />
                        </div>

                        <div
                          className="mt-1 text-xs"
                          style={{ color: colorAlpha("textSecondary", 0.76) }}
                        >
                          {getArchetypeLabel(entity.archetype)}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div
        className="border-t px-3 py-3"
        style={{ borderColor: colorAlpha("primary", 0.14) }}
      >
        <Button type="button" className="w-full" onClick={onCreateEntity}>
          + 新建实体
        </Button>
      </div>
    </section>
  );
}
