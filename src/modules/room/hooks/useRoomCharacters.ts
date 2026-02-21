/**
 * 房间角色 Hook
 *
 * 获取房间角色列表和当前用户的角色信息
 * ✅ 符合架构规范：UI 组件只读取状态
 */

import { subdocManager } from "@/core/yjs";
import type { Character } from "@/domain/entities/character";
import { canOperateCharacter } from "@/domain/entities/character";
import { getOrCreateUserId, getUniqueTag } from "@/lib/user-identity";
import { yMapToCharacter } from "@/modules/game/repository";
import { useCallback, useEffect, useMemo, useState } from "react";
import * as Y from "yjs";
import { useRoomStore } from "../store";

/**
 * 角色列表 Hook 返回值
 */
export interface UseRoomCharactersResult {
  /** 所有角色列表 */
  characters: Character[];
  /** 当前用户的角色（如果有） */
  myCharacter: Character | null;
  /** 当前用户是否已有角色 */
  hasCharacter: boolean;
  /** 刷新角色列表 */
  refresh: () => void;
}

/**
 * 获取房间角色列表
 *
 * @returns 角色列表和当前用户角色信息
 *
 * @example
 * ```tsx
 * const { characters, myCharacter, hasCharacter } = useRoomCharacters();
 *
 * return (
 *   <div>
 *     {hasCharacter ? (
 *       <p>你的角色: {myCharacter?.name}</p>
 *     ) : (
 *       <CharacterCreationForm />
 *     )}
 *   </div>
 * );
 * ```
 */
export function useRoomCharacters(): UseRoomCharactersResult {
  const currentRoom = useRoomStore((s) => s.currentRoom);
  const [characters, setCharacters] = useState<Character[]>([]);

  const userId = useMemo(() => getOrCreateUserId(), []);
  const uniqueTag = useMemo(() => getUniqueTag() || "", []);

  // 刷新角色列表
  const refresh = useCallback(() => {
    if (!currentRoom) {
      setCharacters([]);
      return;
    }

    const mainDoc = subdocManager.getMainDoc(currentRoom.roomId);
    if (!mainDoc) {
      setCharacters([]);
      return;
    }

    const charactersMap = mainDoc.getMap("characters") as Y.Map<Y.Map<unknown>>;
    const charList: Character[] = [];

    charactersMap.forEach((charMap) => {
      try {
        const character = yMapToCharacter(charMap);
        charList.push(character);
      } catch {
        // 角色提取失败，跳过
      }
    });

    setCharacters(charList);
  }, [currentRoom]);

  // 监听角色变化
  useEffect(() => {
    if (!currentRoom) {
      setCharacters([]);
      return;
    }

    const mainDoc = subdocManager.getMainDoc(currentRoom.roomId);
    if (!mainDoc) {
      return;
    }

    const charactersMap = mainDoc.getMap("characters") as Y.Map<Y.Map<unknown>>;

    // 初始加载
    refresh();

    // 监听变化
    const observer = () => {
      refresh();
    };

    charactersMap.observeDeep(observer);

    return () => {
      charactersMap.unobserveDeep(observer);
    };
  }, [currentRoom, refresh]);

  // 计算当前用户的角色
  const myCharacter = useMemo(() => {
    return (
      characters.find((char) => canOperateCharacter(char, userId, uniqueTag)) ||
      null
    );
  }, [characters, userId, uniqueTag]);

  const hasCharacter = myCharacter !== null;

  return {
    characters,
    myCharacter,
    hasCharacter,
    refresh,
  };
}
