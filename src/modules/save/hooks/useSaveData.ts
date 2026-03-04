/**
 * Save 数据 Hooks - 订阅存档槽位数据
 *
 * 这些 Hooks 订阅 Yjs 文档中的存档槽位数据变化
 */

import { yjsManager } from "@/core/yjs";
import type { SaveSlotInfo } from "@/core/yjs/types";
import { useCurrentSaveId } from "@/hooks/useCurrentSaveId";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import type * as Y from "yjs";

/**
 * 订阅存档槽位列表
 *
 * @returns 所有存档槽位信息列表（按更新时间倒序）
 */
export function useSaveSlots(): SaveSlotInfo[] {
  const [saves, setSaves] = useState<SaveSlotInfo[]>([]);

  useEffect(() => {
    if (!yjsManager.isInitialized()) {
      setSaves([]);
      return;
    }

    const savesMap = yjsManager.getSaveSlots();
    if (!savesMap) {
      setSaves([]);
      return;
    }

    // 更新状态的函数
    const updateSaves = () => {
      setSaves(yjsManager.listSaves());
    };

    // 订阅变化 - 使用 observeDeep 监听存档内部字段变化（如 members）
    savesMap.observeDeep(updateSaves);

    // 初始加载
    updateSaves();

    // 清理订阅
    return () => {
      savesMap.unobserveDeep(updateSaves);
    };
  }, []);

  return saves;
}

/**
 * 使用 useSyncExternalStore 订阅存档槽位列表（更高效的实现）
 */
export function useSaveSlotsSync(): SaveSlotInfo[] {
  const subscribe = useCallback((onStoreChange: () => void) => {
    if (!yjsManager.isInitialized()) return () => {};

    const savesMap = yjsManager.getSaveSlots();
    if (!savesMap) return () => {};

    savesMap.observe(onStoreChange);
    return () => savesMap.unobserve(onStoreChange);
  }, []);

  const getSnapshot = useCallback(() => {
    if (!yjsManager.isInitialized()) return [];
    return yjsManager.listSaves();
  }, []);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/**
 * 获取当前存档 ID
 */
export { useCurrentSaveId };

/**
 * 获取当前存档信息
 */
export function useCurrentSave(): SaveSlotInfo | null {
  const saveId = useCurrentSaveId();
  const saves = useSaveSlots();

  if (!saveId) return null;
  return saves.find((s) => s.id === saveId) || null;
}

/**
 * 检查是否有存档
 */
export function useHasSaves(): boolean {
  const saves = useSaveSlots();
  return saves.length > 0;
}

/**
 * 深度订阅存档槽位（包括内部数据变化）
 *
 * 用于需要监听存档内部数据变化的场景
 */
export function useSaveSlotDeep(saveId: string | null): Y.Map<unknown> | null {
  const [saveDoc, setSaveDoc] = useState<Y.Map<unknown> | null>(null);

  useEffect(() => {
    if (!saveId || !yjsManager.isInitialized()) {
      setSaveDoc(null);
      return;
    }

    const savesMap = yjsManager.getSaveSlots();
    const save = savesMap.get(saveId) as Y.Map<unknown> | undefined;

    if (!save) {
      setSaveDoc(null);
      return;
    }

    setSaveDoc(save);

    // 订阅存档内部变化
    const observer = () => {
      // 触发重新渲染
      setSaveDoc(save);
    };

    save.observeDeep(observer);

    return () => {
      save.unobserveDeep(observer);
    };
  }, [saveId]);

  return saveDoc;
}
