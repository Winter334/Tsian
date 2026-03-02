import { useCallback, useEffect, useState } from "react";

import { yjsManager } from "@/core/yjs";
import type { Character } from "@/domain/entities/character";
import { useCurrentSaveId } from "@/modules";
import { yMapToCharacter } from "@/modules/game/repository";

/**
 * 按 characterId 从当前存档读取单个角色
 */
export function useNpcCharacter(characterId: string | null): Character | null {
  const [character, setCharacter] = useState<Character | null>(null);
  const currentSaveId = useCurrentSaveId();

  const readCharacter = useCallback(() => {
    if (!characterId) {
      setCharacter(null);
      return;
    }

    const currentSave = yjsManager.getCurrentSave();
    if (!currentSave) {
      setCharacter(null);
      return;
    }

    const charactersMap = currentSave.get("characters") as
      | import("yjs").Map<import("yjs").Map<unknown>>
      | undefined;

    const characterMap = charactersMap?.get(characterId);
    if (characterMap) {
      setCharacter(yMapToCharacter(characterMap));
      return;
    }

    setCharacter(null);
  }, [characterId]);

  useEffect(() => {
    // 初始读取（覆盖 characterId / currentSaveId 变化场景）
    readCharacter();

    if (!characterId) return;

    const currentSave = yjsManager.getCurrentSave();
    if (!currentSave) return;
    const targetCharacterId = characterId;

    const mapHandler = () => readCharacter();
    let observedCharactersMap:
      | import("yjs").Map<import("yjs").Map<unknown>>
      | undefined;
    let observedCharacterMap: import("yjs").Map<unknown> | undefined;

    function rebindCharacterMapObserver() {
      const nextCharactersMap = currentSave?.get("characters") as
        | import("yjs").Map<import("yjs").Map<unknown>>
        | undefined;

      if (nextCharactersMap !== observedCharactersMap) {
        if (observedCharactersMap) {
          observedCharactersMap.unobserve(charactersHandler);
        }

        observedCharactersMap = nextCharactersMap;

        if (observedCharactersMap) {
          observedCharactersMap.observe(charactersHandler);
        }
      }

      const nextCharacterMap = observedCharactersMap?.get(targetCharacterId);
      if (nextCharacterMap === observedCharacterMap) {
        return;
      }

      if (observedCharacterMap) {
        observedCharacterMap.unobserveDeep(mapHandler);
      }

      observedCharacterMap = nextCharacterMap;

      if (observedCharacterMap) {
        observedCharacterMap.observeDeep(mapHandler);
      }
    }

    function charactersHandler() {
      rebindCharacterMapObserver();
      readCharacter();
    }

    const saveHandler = () => {
      rebindCharacterMapObserver();
      readCharacter();
    };

    currentSave.observe(saveHandler);
    rebindCharacterMapObserver();

    return () => {
      if (observedCharacterMap) {
        observedCharacterMap.unobserveDeep(mapHandler);
        observedCharacterMap = undefined;
      }

      if (observedCharactersMap) {
        observedCharactersMap.unobserve(charactersHandler);
        observedCharactersMap = undefined;
      }

      currentSave.unobserve(saveHandler);
    };
  }, [characterId, currentSaveId, readCharacter]);

  return character;
}
