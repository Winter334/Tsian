/**
 * 条目编辑器 Hook
 *
 * 管理编辑草稿状态：
 * - 从 store 加载条目数据到本地草稿
 * - 跟踪脏状态（是否有未保存变更）
 * - 提供保存/重置操作
 *
 * 设计文档 5.3 节：显式保存、离开确认、保持滚动位置
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useToast } from "@/components/ui";
import type { ActivationStrategy, LorebookEntry } from "@/lib/lorebook";
import { useLorebookStore } from "@/lib/lorebook";

/** 编辑器草稿状态（可编辑的字段子集） */
export interface EntryDraft {
  name: string;
  content: string;
  enabled: boolean;
  comment: string;
  activationStrategy: ActivationStrategy;
  primaryKeywords: string[];
  scanDepth: number | null;
}

/** Hook 返回值 */
export interface UseLorebookEntryEditorReturn {
  /** 当前草稿 */
  draft: EntryDraft;
  /** 原始条目数据 */
  original: LorebookEntry | null;
  /** 是否有未保存变更 */
  isDirty: boolean;
  /** 是否正在保存 */
  isSaving: boolean;
  /** 更新草稿字段 */
  updateDraft: <K extends keyof EntryDraft>(
    field: K,
    value: EntryDraft[K]
  ) => void;
  /** 保存草稿到 store */
  save: () => Promise<boolean>;
  /** 重置草稿为原始值 */
  resetDraft: () => void;
}

/** 从 LorebookEntry 提取可编辑字段作为草稿 */
function entryToDraft(entry: LorebookEntry): EntryDraft {
  return {
    name: entry.name,
    content: entry.content,
    enabled: entry.enabled,
    comment: entry.comment ?? "",
    activationStrategy: entry.activationStrategy,
    primaryKeywords: [...entry.primaryKeywords],
    scanDepth: entry.scanDepth,
  };
}

/** 创建空草稿 */
function createEmptyDraft(): EntryDraft {
  return {
    name: "",
    content: "",
    enabled: true,
    comment: "",
    activationStrategy: "selective",
    primaryKeywords: [],
    scanDepth: null,
  };
}

/**
 * 条目编辑器 Hook
 *
 * @param lorebookId - 世界书 ID
 * @param entryId - 条目 ID（null 表示未选中）
 */
export function useLorebookEntryEditor(
  lorebookId: string,
  entryId: string | null
): UseLorebookEntryEditorReturn {
  const updateEntry = useLorebookStore((s) => s.updateEntry);
  const cachedLorebook = useLorebookStore(
    (s) => s.loadedLorebooks.get(lorebookId) ?? null
  );

  const { success, error: toastError } = useToast();

  const [draft, setDraft] = useState<EntryDraft>(createEmptyDraft);
  const [isSaving, setIsSaving] = useState(false);

  // 从缓存中获取原始条目
  const original = useMemo(() => {
    if (!cachedLorebook || !entryId) return null;
    return cachedLorebook.entries.find((e) => e.id === entryId) ?? null;
  }, [cachedLorebook, entryId]);

  // 用于跟踪当前正在编辑的 entryId，避免 original 变化时覆盖用户正在编辑的草稿
  const initializedEntryIdRef = useRef<string | null>(null);

  // 当 entryId 变化时，初始化草稿
  useEffect(() => {
    if (entryId !== initializedEntryIdRef.current) {
      initializedEntryIdRef.current = entryId;
      if (original) {
        setDraft(entryToDraft(original));
      } else {
        setDraft(createEmptyDraft());
      }
    }
  }, [entryId, original]);

  // 脏检测：对比草稿与原始数据
  const isDirty = useMemo(() => {
    if (!original) return false;
    const orig = entryToDraft(original);
    return JSON.stringify(draft) !== JSON.stringify(orig);
  }, [draft, original]);

  // 更新草稿字段
  const updateDraft = useCallback(
    <K extends keyof EntryDraft>(field: K, value: EntryDraft[K]) => {
      setDraft((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  // 保存草稿到 store
  const save = useCallback(async (): Promise<boolean> => {
    if (!entryId || !isDirty) return true;

    setIsSaving(true);
    try {
      await updateEntry(lorebookId, entryId, {
        name: draft.name,
        content: draft.content,
        enabled: draft.enabled,
        comment: draft.comment || undefined,
        activationStrategy: draft.activationStrategy,
        primaryKeywords: draft.primaryKeywords,
        scanDepth: draft.scanDepth,
      });
      // 保存成功后更新 initializedEntryIdRef，使得下次 original 变化时不覆盖草稿
      // （因为 original 会通过 store 更新反映新值）
      success("已保存", "条目修改已保存");
      return true;
    } catch {
      toastError("保存失败", "请稍后重试");
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [entryId, isDirty, lorebookId, draft, updateEntry, success, toastError]);

  // 重置草稿为原始值
  const resetDraft = useCallback(() => {
    if (original) {
      setDraft(entryToDraft(original));
    }
  }, [original]);

  return {
    draft,
    original,
    isDirty,
    isSaving,
    updateDraft,
    save,
    resetDraft,
  };
}
