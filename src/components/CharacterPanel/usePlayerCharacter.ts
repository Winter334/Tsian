import { useCallback, useEffect, useState } from "react";

import { yjsManager } from "@/core/yjs";
import type { Character } from "@/domain/entities/character";
import { useCurrentSaveId } from "@/modules";
import { yMapToCharacter } from "@/modules/game/repository";

/**
 * 从当前存档读取第一个 player 角色
 * 参考 chat handler 中的数据获取方式
 */
export function usePlayerCharacter(): Character | null {
  const [character, setCharacter] = useState<Character | null>(null);
  const currentSaveId = useCurrentSaveId();

  const readCharacter = useCallback(() => {
    const currentSave = yjsManager.getCurrentSave();
    if (!currentSave) {
      setCharacter(null);
      return;
    }

    const charactersMap = currentSave.get("characters") as
      | import("yjs").Map<import("yjs").Map<unknown>>
      | undefined;

    if (charactersMap && charactersMap.size > 0) {
      let playerChar: Character | null = null;
      charactersMap.forEach((charMap) => {
        const char = yMapToCharacter(charMap);
        if ((char.controlType ?? "player") === "player" && !playerChar) {
          playerChar = char;
        }
      });

      setCharacter(playerChar);
      return;
    }

    setCharacter(null);
  }, []);

  useEffect(() => {
    // 初始读取（覆盖 currentSaveId 从 null 变为有效值的场景）
    readCharacter();

    const currentSave = yjsManager.getCurrentSave();
    if (!currentSave) return;

    const mapHandler = () => readCharacter();
    let observedCharactersMap:
      | import("yjs").Map<import("yjs").Map<unknown>>
      | undefined;

    const rebindCharactersMapObserver = () => {
      const nextCharactersMap = currentSave.get("characters") as
        | import("yjs").Map<import("yjs").Map<unknown>>
        | undefined;

      if (nextCharactersMap === observedCharactersMap) {
        return;
      }

      if (observedCharactersMap) {
        observedCharactersMap.unobserveDeep(mapHandler);
      }

      observedCharactersMap = nextCharactersMap;

      if (observedCharactersMap) {
        observedCharactersMap.observeDeep(mapHandler);
      }
    };

    const saveHandler = () => {
      rebindCharactersMapObserver();
      readCharacter();
    };

    currentSave.observe(saveHandler);
    rebindCharactersMapObserver();

    return () => {
      if (observedCharactersMap) {
        observedCharactersMap.unobserveDeep(mapHandler);
        observedCharactersMap = undefined;
      }
      currentSave.unobserve(saveHandler);
    };
  }, [readCharacter, currentSaveId]);

  return character;
}
