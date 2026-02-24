import { useMemo } from "react";

import type { Character } from "@/domain/entities/character";
import { deserializeTagsFromYjs, type PassiveModifier } from "@/domain/types";
import { computeFullStats } from "@/lib/rules/stats-pipeline";
import type { WorldConfig } from "@/lib/world/types";
import { useInventoryStore } from "@/modules";

const EMPTY_ITEMS: ReturnType<
  typeof useInventoryStore.getState
>["items"][string] = [];

export function useCharacterFullStats(
  character: Character | null,
  worldConfig: WorldConfig,
): Record<string, number> {
  const characterItems = useInventoryStore((s) =>
    character ? (s.items[character.id] ?? EMPTY_ITEMS) : EMPTY_ITEMS,
  );

  return useMemo(() => {
    if (!character) return {};

    const passiveModifiers: PassiveModifier[] = [];

    for (const item of characterItems) {
      if (!item.equipped) continue;

      for (const effect of item.effects ?? []) {
        if (effect.type !== "modifier" || !effect.modifiers?.length) continue;
        passiveModifiers.push(...effect.modifiers);
      }
    }

    const talentsById = new Map(
      (worldConfig.talents ?? []).map((talent) => [talent.id, talent]),
    );
    for (const talentId of character.talentIds ?? []) {
      const talent = talentsById.get(talentId);
      if (!talent?.modifiers?.length) continue;
      passiveModifiers.push(...talent.modifiers);
    }

    const tagsMap = deserializeTagsFromYjs(character.tags);
    for (const [, tagMetadata] of tagsMap) {
      const trigger = tagMetadata.trigger;
      if (trigger?.timing !== "passive" || !trigger.modifiers?.length) continue;
      passiveModifiers.push(...trigger.modifiers);
    }

    return computeFullStats({
      baseAttributes: character.attributes ?? {},
      primaryAttributes: worldConfig.primaryAttributes,
      derivedStats: worldConfig.derivedStats,
      passiveModifiers,
    });
  }, [
    character,
    characterItems,
    worldConfig.primaryAttributes,
    worldConfig.derivedStats,
    worldConfig.talents,
  ]);
}
