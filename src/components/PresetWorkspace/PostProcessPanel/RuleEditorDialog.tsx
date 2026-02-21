/**
 * 后处理规则编辑对话框
 *
 * 说明：
 * - 使用本地编辑副本，避免直接修改外部状态
 * - 内置规则编辑时，核心字段只读
 * - 正则 pattern + flags 实时校验
 */
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button, Dialog, DialogContent, Input } from "@/components/ui";
import {
  generateRuleId,
  validateRegexPattern,
  type PostProcessAction,
  type PostProcessPhase,
  type PostProcessRule,
} from "@/lib/post-process";
import { cn } from "@/lib/utils";
import { borders, color, colorAlpha } from "@/styles/tokens";

export interface RuleEditorDialogProps {
  open: boolean;
  rule: PostProcessRule | null;
  isBuiltin: boolean;
  onSave: (rule: PostProcessRule) => void;
  onClose: () => void;
}

const ACTION_OPTIONS: Array<{
  value: PostProcessAction;
  label: string;
  hint: string;
}> = [
  { value: "remove", label: "移除", hint: "删除匹配内容" },
  { value: "replace", label: "替换", hint: "替换为指定文本" },
  {
    value: "extract-and-remove",
    label: "提取并移除",
    hint: "提取匹配内容到结构化数据并移除",
  },
];

const PHASE_OPTIONS: Array<{
  value: PostProcessPhase;
  label: string;
  hint: string;
}> = [
  {
    value: "persist",
    label: "持久化前",
    hint: "在消息写入存储前执行",
  },
  {
    value: "render",
    label: "渲染前",
    hint: "在 UI 渲染前执行",
  },
];

function createDefaultRule(): PostProcessRule {
  return {
    id: generateRuleId(),
    name: "新后处理规则",
    description: "",
    pattern: "",
    flags: "g",
    replacement: "",
    action: "remove",
    phase: "persist",
    source: "user",
    enabled: true,
    order: 0,
  };
}

function normalizeRule(rule: PostProcessRule): PostProcessRule {
  const normalizedName = rule.name.trim();
  const normalizedDescription = rule.description?.trim() || undefined;
  const normalizedFlags = rule.flags.trim();

  if (rule.action === "extract-and-remove") {
    return {
      ...rule,
      name: normalizedName,
      description: normalizedDescription,
      flags: normalizedFlags,
      replacement: "",
      extractKey: rule.extractKey?.trim() || "",
    };
  }

  if (rule.action === "remove") {
    return {
      ...rule,
      name: normalizedName,
      description: normalizedDescription,
      flags: normalizedFlags,
      replacement: "",
      extractKey: undefined,
    };
  }

  return {
    ...rule,
    name: normalizedName,
    description: normalizedDescription,
    flags: normalizedFlags,
    extractKey: undefined,
  };
}

function isSameRule(left: PostProcessRule, right: PostProcessRule): boolean {
  return (
    JSON.stringify(normalizeRule(left)) === JSON.stringify(normalizeRule(right))
  );
}

/**
 * 规则编辑对话框。
 */
export function RuleEditorDialog({
  open,
  rule,
  isBuiltin,
  onSave,
  onClose,
}: RuleEditorDialogProps) {
  const [draft, setDraft] = useState<PostProcessRule>(createDefaultRule);
  const [initialDraft, setInitialDraft] =
    useState<PostProcessRule>(createDefaultRule);

  useEffect(() => {
    if (!open) return;
    const nextDraft = rule ? { ...rule } : createDefaultRule();
    setDraft(nextDraft);
    setInitialDraft(nextDraft);
  }, [open, rule]);

  const updateField = useCallback(
    <K extends keyof PostProcessRule>(field: K, value: PostProcessRule[K]) => {
      setDraft((prev) => ({ ...prev, [field]: value }));
    },
    [],
  );

  const regexValidation = useMemo(
    () => validateRegexPattern(draft.pattern, draft.flags),
    [draft.pattern, draft.flags],
  );

  const hasName = draft.name.trim().length > 0;
  const hasExtractKey =
    draft.action !== "extract-and-remove" ||
    (draft.extractKey?.trim().length ?? 0) > 0;

  const canSave = regexValidation.valid && hasName && hasExtractKey;
  const hasChanges = useMemo(
    () => !isSameRule(draft, initialDraft),
    [draft, initialDraft],
  );

  const handleSave = useCallback(() => {
    if (!canSave) return;
    onSave(normalizeRule(draft));
    onClose();
  }, [canSave, draft, onClose, onSave]);

  const handleActionChange = useCallback((action: PostProcessAction) => {
    setDraft((prev) => {
      if (action === "extract-and-remove") {
        return {
          ...prev,
          action,
          replacement: "",
          extractKey: prev.extractKey || "extractedData",
        };
      }

      if (action === "remove") {
        return {
          ...prev,
          action,
          replacement: "",
          extractKey: undefined,
        };
      }

      return {
        ...prev,
        action,
        extractKey: undefined,
      };
    });
  }, []);

  const handleClose = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        onClose();
      }
    },
    [onClose],
  );

  const coreReadonly = isBuiltin;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        title={rule ? "编辑后处理规则" : "新建后处理规则"}
        width="lg"
        animateLifecycle
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>
              取消
            </Button>
            <Button onClick={handleSave} disabled={!canSave || !hasChanges}>
              保存
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          {coreReadonly && (
            <div
              className="rounded px-3 py-2 text-xs"
              style={{
                color: color("warning"),
                background: colorAlpha("warning", 0.12),
                border: `1px solid ${colorAlpha("warning", 0.35)}`,
              }}
            >
              当前为内置规则：正则、Flags、处理方式、阶段等核心字段为只读。
            </div>
          )}

          <FormField label="名称" required>
            <Input
              value={draft.name}
              onChange={(event) => updateField("name", event.target.value)}
              placeholder="输入规则名称"
            />
          </FormField>

          <FormField label="描述（可选）">
            <Input
              value={draft.description ?? ""}
              onChange={(event) =>
                updateField("description", event.target.value)
              }
              placeholder="输入规则用途说明"
            />
          </FormField>

          <FormField label="正则表达式" required>
            <Input
              value={draft.pattern}
              onChange={(event) => updateField("pattern", event.target.value)}
              placeholder="如：<choices>([\\s\\S]*?)</choices>"
              readOnly={coreReadonly}
            />
          </FormField>

          <FormField label="Flags" required>
            <Input
              value={draft.flags}
              onChange={(event) => updateField("flags", event.target.value)}
              placeholder='如："gi"'
              readOnly={coreReadonly}
            />
          </FormField>

          <RegexStatus
            valid={regexValidation.valid}
            error={regexValidation.error}
          />

          <FormField label="处理方式" required>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {ACTION_OPTIONS.map((option) => (
                <RadioCard
                  key={option.value}
                  name="post-process-action"
                  checked={draft.action === option.value}
                  onChange={() => handleActionChange(option.value)}
                  label={option.label}
                  hint={option.hint}
                  disabled={coreReadonly}
                />
              ))}
            </div>
          </FormField>

          {draft.action === "replace" && (
            <FormField label="替换字符串" required>
              <Input
                value={draft.replacement}
                onChange={(event) =>
                  updateField("replacement", event.target.value)
                }
                placeholder='支持捕获组，如 "$1"'
                readOnly={coreReadonly}
              />
            </FormField>
          )}

          {draft.action === "extract-and-remove" && (
            <FormField label="提取键名" required>
              <Input
                value={draft.extractKey ?? ""}
                onChange={(event) =>
                  updateField("extractKey", event.target.value)
                }
                placeholder="如：choices / miniSummary"
                readOnly={coreReadonly}
              />
            </FormField>
          )}

          <FormField label="阶段" required>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {PHASE_OPTIONS.map((option) => (
                <RadioCard
                  key={option.value}
                  name="post-process-phase"
                  checked={draft.phase === option.value}
                  onChange={() => updateField("phase", option.value)}
                  label={option.label}
                  hint={option.hint}
                  disabled={coreReadonly}
                />
              ))}
            </div>
          </FormField>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FormField({
  label,
  required = false,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        className="text-sm font-medium"
        style={{ color: color("textSecondary") }}
      >
        {label}
        {required && (
          <span className="ml-1" style={{ color: color("warning") }}>
            *
          </span>
        )}
      </label>
      {children}
    </div>
  );
}

function RegexStatus({ valid, error }: { valid: boolean; error?: string }) {
  return (
    <div
      className="rounded px-3 py-2 text-xs"
      style={{
        color: valid ? color("primary") : color("error"),
        background: valid
          ? colorAlpha("primary", 0.1)
          : colorAlpha("error", 0.1),
        border: `1px solid ${valid ? colorAlpha("primary", 0.3) : colorAlpha("error", 0.3)}`,
      }}
    >
      {valid ? "✅ 正则有效" : `❌ 正则无效：${error ?? "未知错误"}`}
    </div>
  );
}

interface RadioCardProps {
  name: string;
  checked: boolean;
  onChange: () => void;
  label: string;
  hint: string;
  disabled?: boolean;
}

function RadioCard({
  name,
  checked,
  onChange,
  label,
  hint,
  disabled = false,
}: RadioCardProps) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-2 rounded px-3 py-2 transition-all",
        disabled && "cursor-not-allowed opacity-60",
      )}
      style={{
        background: checked
          ? colorAlpha("primary", 0.12)
          : colorAlpha("bgBase", 0.3),
        border: `1px solid ${checked ? colorAlpha("primary", 0.45) : colorAlpha("primary", 0.2)}`,
        borderRadius: borders.radius.sm,
      }}
    >
      <input
        type="radio"
        name={name}
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        className="mt-0.5 h-4 w-4"
        style={{ accentColor: color("primary") }}
      />
      <span className="min-w-0">
        <span
          className="block text-sm font-medium"
          style={{ color: color("textPrimary") }}
        >
          {label}
        </span>
        <span className="block text-xs" style={{ color: color("textMuted") }}>
          {hint}
        </span>
      </span>
    </label>
  );
}
