import { useMemo } from "react";

import type { Character } from "@/domain/entities/character";
import { deserializeTagsFromYjs } from "@/domain/types";
import type { WorldConfig } from "@/lib/world/types";

export interface CharacterTag {
  id: string;
  mapKey: string;
  displayName: string;
  effectDescription: string;
  remainingDuration?: number;
  stacks?: number;
  source: "predefined" | "ai-generated";
  timing?: "turn_start" | "on_damage" | "passive";
  icon?: string;
}

const SOURCE_ORDER: Record<CharacterTag["source"], number> = {
  predefined: 0,
  "ai-generated": 1,
};

function compareCharacterTags(a: CharacterTag, b: CharacterTag): number {
  const aDurationOrder = a.remainingDuration === undefined ? 1 : 0;
  const bDurationOrder = b.remainingDuration === undefined ? 1 : 0;

  if (aDurationOrder !== bDurationOrder) {
    return aDurationOrder - bDurationOrder;
  }

  const sourceOrderDelta = SOURCE_ORDER[a.source] - SOURCE_ORDER[b.source];
  if (sourceOrderDelta !== 0) {
    return sourceOrderDelta;
  }

  return a.displayName.localeCompare(b.displayName, "zh-Hans-CN");
}

export function useCharacterTags(
  character: Character | null,
  worldConfig: WorldConfig,
): CharacterTag[] {
  return useMemo(() => {
    if (!character) return [];

    const tagsMap = deserializeTagsFromYjs(character.tags);
    if (tagsMap.size === 0) return [];

    const conditionIconById = new Map<string, string | undefined>(
      (worldConfig.conditions ?? []).map((condition) => [
        condition.id,
        condition.icon,
      ]),
    );

    const tags: CharacterTag[] = [];

    for (const [tagKey, metadata] of tagsMap) {
      if (metadata.category === "talent" || metadata.category === "equipment") {
        continue;
      }

      tags.push({
        id: metadata.id || tagKey,
        mapKey: tagKey,
        displayName: metadata.displayName,
        effectDescription: metadata.effectDescription,
        remainingDuration: metadata.remainingDuration,
        stacks: metadata.stacks,
        source: metadata.source,
        timing: metadata.trigger?.timing,
        icon:
          conditionIconById.get(metadata.id) ?? conditionIconById.get(tagKey),
      });
    }

    tags.sort(compareCharacterTags);
    return tags;
  }, [character, worldConfig.conditions]);
}
