/**
 * 后处理规则面板主组件
 *
 * 受控模式：
 * - rules 由父组件提供
 * - 所有编辑操作通过 onChange 回传
 */
import { Upload } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";

import { Button, Dialog, DialogContent } from "@/components/ui";
import {
  BUILTIN_RULES,
  importTavernRegexScripts,
  isTavernRegexScript,
  mergeRules,
  type PostProcessRule,
} from "@/lib/post-process";
import { cn } from "@/lib/utils";
import { borders, color, colorAlpha, gradientText } from "@/styles/tokens";

import { RuleEditorDialog } from "./RuleEditorDialog";
import { RuleList } from "./RuleList";
import { RuleTestPanel } from "./RuleTestPanel";

export interface PostProcessPanelProps {
  rules: PostProcessRule[];
  onChange: (rules: PostProcessRule[]) => void;
}

interface ImportPreviewState {
  fileName: string;
  rules: PostProcessRule[];
  warnings: string[];
}

function getNextOrder(items: PostProcessRule[]): number {
  return (
    items.reduce((maxOrder, item) => Math.max(maxOrder, item.order), -1) + 1
  );
}

/**
 * 后处理规则面板。
 */
export function PostProcessPanel({ rules, onChange }: PostProcessPanelProps) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [importPreview, setImportPreview] = useState<ImportPreviewState | null>(
    null,
  );
  const [importError, setImportError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const mergedRules = useMemo(() => mergeRules(BUILTIN_RULES, rules), [rules]);

  const orderedRules = useMemo(
    () => [...mergedRules].sort((a, b) => a.order - b.order),
    [mergedRules],
  );

  const builtinDefaults = useMemo(
    () => new Map(BUILTIN_RULES.map((item) => [item.id, item])),
    [],
  );

  const editingRule = useMemo(
    () =>
      editingRuleId
        ? (orderedRules.find((item) => item.id === editingRuleId) ?? null)
        : null,
    [editingRuleId, orderedRules],
  );

  const closeEditor = useCallback(() => {
    setEditorOpen(false);
    setEditingRuleId(null);
  }, []);

  const toPresetRules = useCallback(
    (nextMergedRules: PostProcessRule[]) => {
      const presetRules: PostProcessRule[] = [];
      const sortedRules = [...nextMergedRules].sort(
        (a, b) => a.order - b.order,
      );

      for (const rule of sortedRules) {
        if (rule.source === "builtin") {
          const defaultBuiltin = builtinDefaults.get(rule.id);
          if (
            defaultBuiltin &&
            (rule.enabled !== defaultBuiltin.enabled ||
              rule.order !== defaultBuiltin.order)
          ) {
            presetRules.push({ ...rule });
          }
          continue;
        }

        presetRules.push({ ...rule });
      }

      return presetRules;
    },
    [builtinDefaults],
  );

  const emitRulesChange = useCallback(
    (nextMergedRules: PostProcessRule[]) => {
      onChange(toPresetRules(nextMergedRules));
    },
    [onChange, toPresetRules],
  );

  const handleToggleEnabled = useCallback(
    (id: string, enabled: boolean) => {
      emitRulesChange(
        orderedRules.map((item) =>
          item.id === id ? { ...item, enabled } : item,
        ),
      );
    },
    [emitRulesChange, orderedRules],
  );

  const handleEdit = useCallback((id: string) => {
    setEditingRuleId(id);
    setEditorOpen(true);
  }, []);

  const handleDelete = useCallback(
    (id: string) => {
      const target = orderedRules.find((item) => item.id === id);
      if (!target || target.source === "builtin") {
        return;
      }
      emitRulesChange(orderedRules.filter((item) => item.id !== id));
    },
    [emitRulesChange, orderedRules],
  );

  const handleReorder = useCallback(
    (nextRules: PostProcessRule[]) => {
      emitRulesChange(nextRules);
    },
    [emitRulesChange],
  );

  const handleAdd = useCallback(() => {
    setEditingRuleId(null);
    setEditorOpen(true);
  }, []);

  const handleSaveRule = useCallback(
    (savedRule: PostProcessRule) => {
      if (editingRuleId) {
        emitRulesChange(
          orderedRules.map((item) =>
            item.id === editingRuleId
              ? { ...savedRule, id: editingRuleId }
              : item,
          ),
        );
        return;
      }

      emitRulesChange([
        ...orderedRules,
        { ...savedRule, order: getNextOrder(orderedRules) },
      ]);
    },
    [editingRuleId, emitRulesChange, orderedRules],
  );

  const triggerImportFileSelect = useCallback(() => {
    setImportError(null);
    fileInputRef.current?.click();
  }, []);

  const handleFileSelect = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      try {
        const raw = await file.text();
        const data: unknown = JSON.parse(raw);

        const list = Array.isArray(data) ? data : [data];
        const hasValidItem = list.some((item) => isTavernRegexScript(item));

        if (!hasValidItem) {
          setImportError("该 JSON 不是有效的酒馆正则脚本格式。");
          return;
        }

        const result = importTavernRegexScripts(data);
        if (result.rules.length === 0) {
          setImportError(
            result.warnings[0] ?? "未能导入任何规则，请检查脚本内容。",
          );
          return;
        }

        setImportPreview({
          fileName: file.name,
          rules: result.rules.map((item) => ({ ...item, source: "user" })),
          warnings: result.warnings,
        });
      } catch (error) {
        setImportError(
          error instanceof SyntaxError
            ? "JSON 解析失败，请确认文件格式。"
            : `导入失败：${error instanceof Error ? error.message : "未知错误"}`,
        );
      } finally {
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    },
    [],
  );

  const closeImportPreview = useCallback(() => {
    setImportPreview(null);
  }, []);

  const handleConfirmImport = useCallback(() => {
    if (!importPreview) return;

    const startOrder = getNextOrder(orderedRules);
    const importedRules = importPreview.rules.map((item, index) => ({
      ...item,
      order: startOrder + index,
    }));

    emitRulesChange([...orderedRules, ...importedRules]);
    setImportPreview(null);
    setImportError(null);
  }, [emitRulesChange, importPreview, orderedRules]);

  return (
    <div
      className="flex flex-col gap-3 rounded-md border p-3"
      style={{
        borderColor: colorAlpha("primary", 0.22),
        background: colorAlpha("bgElevated", 0.22),
        borderRadius: borders.radius.md,
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileSelect}
        className="hidden"
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold" style={gradientText()}>
          后处理规则
        </h3>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={triggerImportFileSelect}
          >
            <Upload size={14} />
            导入酒馆正则
          </Button>
          <Button size="sm" onClick={handleAdd}>
            + 新增
          </Button>
        </div>
      </div>

      {importError && (
        <div
          className={cn("rounded px-3 py-2 text-xs")}
          style={{
            color: color("error"),
            background: colorAlpha("error", 0.1),
            border: `1px solid ${colorAlpha("error", 0.28)}`,
          }}
        >
          {importError}
        </div>
      )}

      <RuleList
        rules={orderedRules}
        onToggleEnabled={handleToggleEnabled}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onReorder={handleReorder}
      />

      <RuleTestPanel rules={orderedRules} />

      <RuleEditorDialog
        open={editorOpen}
        rule={editingRule}
        isBuiltin={editingRule?.source === "builtin"}
        onSave={handleSaveRule}
        onClose={closeEditor}
      />

      <Dialog
        open={!!importPreview}
        onOpenChange={(open) => !open && closeImportPreview()}
      >
        <DialogContent
          title="导入酒馆正则预览"
          width="lg"
          animateLifecycle
          footer={
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={closeImportPreview}>
                取消
              </Button>
              <Button onClick={handleConfirmImport}>
                确认追加 {importPreview?.rules.length ?? 0} 条规则
              </Button>
            </div>
          }
        >
          {importPreview && (
            <div className="flex flex-col gap-3">
              <div
                className="rounded px-3 py-2 text-xs"
                style={{
                  color: color("textSecondary"),
                  background: colorAlpha("bgBase", 0.35),
                  border: `1px solid ${colorAlpha("primary", 0.22)}`,
                }}
              >
                文件：{importPreview.fileName}
              </div>

              <div className="space-y-1">
                <p
                  className="text-xs font-medium"
                  style={{ color: color("textSecondary") }}
                >
                  将要导入的规则
                </p>
                <div
                  className="max-h-44 overflow-auto rounded border px-2 py-2"
                  style={{
                    borderColor: colorAlpha("primary", 0.2),
                    background: colorAlpha("bgBase", 0.3),
                  }}
                >
                  <ul className="space-y-1 text-xs">
                    {importPreview.rules.map((item) => (
                      <li
                        key={item.id}
                        style={{ color: color("textSecondary") }}
                      >
                        • {item.name}（
                        {item.phase === "persist" ? "持久化前" : "渲染前"}）
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="space-y-1">
                <p
                  className="text-xs font-medium"
                  style={{ color: color("textSecondary") }}
                >
                  警告信息
                </p>
                {importPreview.warnings.length === 0 ? (
                  <div
                    className="rounded border border-dashed px-3 py-2 text-xs"
                    style={{
                      borderColor: colorAlpha("primary", 0.22),
                      color: color("textMuted"),
                    }}
                  >
                    无警告
                  </div>
                ) : (
                  <ul className="max-h-36 list-disc space-y-1 overflow-auto pl-5 text-xs">
                    {importPreview.warnings.map((warning, index) => (
                      <li
                        key={`import-warning-${index}`}
                        style={{ color: color("warning") }}
                      >
                        {warning}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
