/**
 * 世界书全局设置对话框
 *
 * 配置项：
 * - defaultScanDepth：默认扫描深度
 * - caseSensitive：关键词匹配大小写敏感
 * - tokenBudget：Token 预算上限（0 = 无限制）
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  Button,
  Dialog,
  DialogContent,
  Input,
  Toggle,
  useToast,
} from "@/components/ui";
import {
  DEFAULT_LOREBOOK_SETTINGS,
  useLorebookStore,
  type LorebookSettings,
} from "@/lib/lorebook";
import { cn } from "@/lib/utils";
import { color, colorAlpha } from "@/styles/tokens";

interface LorebookGlobalSettingsDialogProps {
  /** 是否打开 */
  open: boolean;
  /** 当前要编辑的世界书 ID */
  lorebookId: string | null;
  /** 打开状态变化 */
  onOpenChange: (open: boolean) => void;
}

export function LorebookGlobalSettingsDialog({
  open,
  lorebookId,
  onOpenChange,
}: LorebookGlobalSettingsDialogProps) {
  const getLorebook = useLorebookStore((s) => s.getLorebook);
  const updateLorebook = useLorebookStore((s) => s.updateLorebook);
  const cachedLorebook = useLorebookStore((s) =>
    lorebookId ? s.loadedLorebooks.get(lorebookId) ?? null : null
  );
  const { success, error } = useToast();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [lorebookName, setLorebookName] = useState("未选择世界书");
  const [draft, setDraft] = useState<LorebookSettings>(
    DEFAULT_LOREBOOK_SETTINGS
  );

  const initialRef = useRef<LorebookSettings>(DEFAULT_LOREBOOK_SETTINGS);

  // 打开时加载当前世界书设置
  useEffect(() => {
    if (!open || !lorebookId) {
      return;
    }

    let cancelled = false;
    setLoading(true);

    getLorebook(lorebookId)
      .then((lorebook) => {
        if (!lorebook || cancelled) {
          return;
        }
        const loadedSettings = { ...lorebook.settings };
        setLorebookName(lorebook.name);
        setDraft(loadedSettings);
        initialRef.current = loadedSettings;
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, lorebookId, getLorebook]);

  // 监听缓存更新（保存后立即回显）
  useEffect(() => {
    if (!open || !cachedLorebook) {
      return;
    }
    const syncedSettings = { ...cachedLorebook.settings };
    setLorebookName(cachedLorebook.name);
    setDraft(syncedSettings);
    initialRef.current = syncedSettings;
  }, [open, cachedLorebook]);

  const isDirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(initialRef.current),
    [draft]
  );

  const updateDraft = useCallback(
    <K extends keyof LorebookSettings>(
      field: K,
      value: LorebookSettings[K]
    ) => {
      setDraft((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  const handleSave = useCallback(async () => {
    if (!lorebookId) {
      return;
    }

    setSaving(true);
    try {
      await updateLorebook(lorebookId, { settings: draft });
      initialRef.current = draft;
      success("已保存", `世界书「${lorebookName}」全局设置已更新`);
      onOpenChange(false);
    } catch {
      error("保存失败", "请稍后重试");
    } finally {
      setSaving(false);
    }
  }, [
    lorebookId,
    updateLorebook,
    draft,
    success,
    lorebookName,
    onOpenChange,
    error,
  ]);

  const handleReset = useCallback(() => {
    setDraft(initialRef.current);
  }, []);

  const canSubmit = !!lorebookId && !loading && !saving && isDirty;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        width="md"
        title="世界书全局设置"
        description={`当前世界书：${lorebookName}`}
        closeOnBackdropClick={!saving}
      >
        {loading ? (
          <div className="py-8 text-center">
            <p className="text-sm" style={{ color: color("textMuted") }}>
              加载设置中...
            </p>
          </div>
        ) : !lorebookId ? (
          <div className="py-8 text-center">
            <p className="text-sm" style={{ color: color("error") }}>
              未选择世界书
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {/* 默认扫描深度 */}
            <section className="space-y-2">
              <label
                className="text-sm font-medium block"
                style={{ color: color("textSecondary") }}
              >
                默认扫描深度
              </label>
              <p className="text-xs" style={{ color: color("textMuted") }}>
                条目未设置覆盖值时，扫描最近 N 条消息匹配关键词。
              </p>
              <Input
                type="number"
                min={1}
                max={100}
                value={draft.defaultScanDepth}
                onChange={(e) => {
                  const value = Number.parseInt(e.target.value, 10);
                  if (!Number.isFinite(value)) return;
                  const normalized = Math.min(100, Math.max(1, value));
                  updateDraft("defaultScanDepth", normalized);
                }}
                className="w-28 h-9! py-1! px-3!"
              />
            </section>

            {/* 大小写敏感 */}
            <section
              className={cn("rounded-md border p-3")}
              style={{ borderColor: colorAlpha("primary", 0.2) }}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p
                    className="text-sm font-medium"
                    style={{ color: color("textSecondary") }}
                  >
                    大小写敏感匹配
                  </p>
                  <p
                    className="text-xs mt-1"
                    style={{ color: color("textMuted") }}
                  >
                    开启后，关键词匹配区分大小写。
                  </p>
                </div>
                <Toggle
                  checked={draft.caseSensitive}
                  onCheckedChange={(checked) =>
                    updateDraft("caseSensitive", checked)
                  }
                />
              </div>
            </section>

            {/* Token 预算 */}
            <section className="space-y-2">
              <label
                className="text-sm font-medium block"
                style={{ color: color("textSecondary") }}
              >
                Token 预算上限
              </label>
              <p className="text-xs" style={{ color: color("textMuted") }}>
                0 表示不限制，其他值表示世界书注入内容的预算上限。
              </p>
              <Input
                type="number"
                min={0}
                value={draft.tokenBudget}
                onChange={(e) => {
                  const value = Number.parseInt(e.target.value, 10);
                  if (!Number.isFinite(value)) return;
                  updateDraft("tokenBudget", Math.max(0, value));
                }}
                className="w-32 h-9! py-1! px-3!"
              />
            </section>
          </div>
        )}

        <div className="mt-6 flex items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            disabled={!isDirty || loading || saving}
          >
            重置
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            取消
          </Button>
          <Button size="sm" onClick={handleSave} disabled={!canSubmit}>
            {saving ? "保存中..." : "保存"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
