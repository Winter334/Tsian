/**
 * 世界书工作区导航状态 Hook
 *
 * 管理 UI 层临时状态（设计文档 10.2 节）：
 * - selectedLorebookId: 当前选中的世界书
 * - mobilePage: 移动端当前页面
 * - editingEntryId: 正在编辑的条目（阶段3实现）
 *
 * 这是纯 UI 导航状态，不涉及业务数据修改。
 */

import { useCallback, useState } from "react";

/** 移动端页面枚举 */
export type MobilePage = "lorebookList" | "entryList";

/** 工作区导航状态 */
export interface LorebookWorkspaceState {
  /** 当前选中的世界书 ID */
  selectedLorebookId: string | null;

  /** 移动端当前页面 */
  mobilePage: MobilePage;

  /** 正在编辑的条目 ID（阶段3预留） */
  editingEntryId: string | null;
}

/** 工作区导航动作 */
export interface LorebookWorkspaceActions {
  /** 选中一本世界书（桌面端：显示其条目列表；移动端：跳转条目列表页） */
  selectLorebook: (id: string) => void;

  /** 移动端返回世界书列表 */
  navigateToLorebookList: () => void;

  /** 开始编辑条目（阶段3预留） */
  startEditingEntry: (entryId: string) => void;

  /** 结束编辑条目（阶段3预留） */
  finishEditingEntry: () => void;

  /** 重置所有导航状态 */
  reset: () => void;
}

/**
 * 世界书工作区导航状态 Hook
 */
export function useLorebookWorkspaceState(): LorebookWorkspaceState &
  LorebookWorkspaceActions {
  const [selectedLorebookId, setSelectedLorebookId] = useState<string | null>(
    null
  );
  const [mobilePage, setMobilePage] = useState<MobilePage>("lorebookList");
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);

  const selectLorebook = useCallback((id: string) => {
    setSelectedLorebookId(id);
    setMobilePage("entryList");
  }, []);

  const navigateToLorebookList = useCallback(() => {
    setMobilePage("lorebookList");
    // 不清除 selectedLorebookId，保留选择状态以备桌面端使用
  }, []);

  const startEditingEntry = useCallback((entryId: string) => {
    setEditingEntryId(entryId);
  }, []);

  const finishEditingEntry = useCallback(() => {
    setEditingEntryId(null);
  }, []);

  const reset = useCallback(() => {
    setSelectedLorebookId(null);
    setMobilePage("lorebookList");
    setEditingEntryId(null);
  }, []);

  return {
    selectedLorebookId,
    mobilePage,
    editingEntryId,
    selectLorebook,
    navigateToLorebookList,
    startEditingEntry,
    finishEditingEntry,
    reset,
  };
}
