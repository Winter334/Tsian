import { StatusTagTooltip } from "@/components/CharacterPanel/StatusTagTooltip";
import type { Character } from "@/domain/entities/character";
import { useCharacterTags } from "@/hooks/useCharacterTags";
import type { WorldConfig } from "@/lib/world/types";

import { colorAlpha } from "@/styles/tokens";

interface SidebarStatusTagsProps {
  character: Character;
  worldConfig: WorldConfig;
}

const MAX_VISIBLE_TAGS = 6;

export function SidebarStatusTags({
  character,
  worldConfig,
}: SidebarStatusTagsProps) {
  const tags = useCharacterTags(character, worldConfig);

  if (tags.length === 0) {
    return null;
  }

  const visibleTags = tags.slice(0, MAX_VISIBLE_TAGS);
  const overflowCount = Math.max(0, tags.length - MAX_VISIBLE_TAGS);

  return (
    <section
      className="rounded-lg p-3"
      style={{
        background: colorAlpha("bgElevated", 0.42),
        border: `1px solid ${colorAlpha("primary", 0.16)}`,
      }}
    >
      <div className="flex flex-wrap gap-1.5">
        {visibleTags.map((tag) => (
          <StatusTagTooltip key={tag.mapKey} tag={tag} />
        ))}

        {overflowCount > 0 ? (
          <span
            className="inline-flex h-6 items-center rounded-md px-1.5 text-xs font-medium select-none"
            style={{
              background: colorAlpha("bgElevated", 0.5),
              border: `1px solid ${colorAlpha("primary", 0.2)}`,
              color: colorAlpha("textSecondary", 0.92),
            }}
            aria-label={`还有 ${overflowCount} 个状态效果`}
            title={`还有 ${overflowCount} 个状态效果`}
          >
            +{overflowCount}
          </span>
        ) : null}
      </div>
    </section>
  );
}

export type { SidebarStatusTagsProps };
