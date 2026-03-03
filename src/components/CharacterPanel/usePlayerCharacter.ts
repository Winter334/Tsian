import { useCallback, useEffect, useState } from "react";

import { yjsManager } from "@/core/yjs";
import type { Character } from "@/domain/entities/character";
import { getUniqueTag } from "@/lib/user-identity";
import { useCurrentSaveId, useRoomStore } from "@/modules";
import { yMapToCharacter } from "@/modules/game/repository";

/**
 * 从当前存档读取第一个 player 角色
 * 参考 chat handler 中的数据获取方式
 */
export function usePlayerCharacter(): Character | null {
  const [character, setCharacter] = useState<Character | null>(null);
  const currentSaveId = useCurrentSaveId();
  const roomMode = useRoomStore((s) => s.mode);
  const localUserId = useRoomStore((s) => s.localUser.userId);

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
      const localUniqueTag = getUniqueTag() || "";
      let onlineMatchedByUserId: Character | null = null;
      let onlineMatchedByUniqueTag: Character | null = null;
      let offlinePlayerChar: Character | null = null;

      charactersMap.forEach((charMap) => {
        const char = yMapToCharacter(charMap);
        const isPlayerCharacter = (char.controlType ?? "player") === "player";

        if (!isPlayerCharacter) {
          return;
        }

        if (roomMode === "online") {
          if (
            !onlineMatchedByUserId &&
            localUserId &&
            char.operatorUserId === localUserId
          ) {
            onlineMatchedByUserId = char;
          }

          if (
            !onlineMatchedByUniqueTag &&
            localUniqueTag &&
            char.operatorUniqueTag === localUniqueTag
          ) {
            onlineMatchedByUniqueTag = char;
          }

          return;
        }

        if (!offlinePlayerChar) {
          offlinePlayerChar = char;
        }
      });

      if (roomMode === "online") {
        setCharacter(onlineMatchedByUserId ?? onlineMatchedByUniqueTag ?? null);
        return;
      }

      setCharacter(offlinePlayerChar);
      return;
    }

    setCharacter(null);
  }, [localUserId, roomMode]);

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
