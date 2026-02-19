import { Loader2, Plus, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type KeyboardEvent,
} from "react";

import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Textarea,
  useToast,
} from "@/components/ui";
import { MemoryCommands } from "@/domain/commands";
import type { ManualMemory } from "@/domain/entities/memory";
import { useCommand } from "@/hooks/use-command";
import { useCurrentConversationId } from "@/modules/chat";
import { color, colorAlpha } from "@/styles/tokens";

import { useMemoryCompression } from "./useMemoryCompression";

interface ManualMemoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * 创建模式下的来源文本
   * - NarrativeBlock 传入选中原文
   * - MemoryManager 创建入口可传空字符串
   */
  sourceContent?: string;
  /** 来源消息 ID（创建模式可选） */
  sourceMessageId?: string;
  /** 编辑模式目标条目（存在即进入编辑模式） */
  editMemory?: ManualMemory | null;
}

function normalizeTags(tags: string[]): string[] {
  const deduped = new Set<string>();
  for (const tag of tags) {
    const value = tag.trim();
    if (value) {
      deduped.add(value);
    }
  }
  return [...deduped];
}

export function ManualMemoryDialog({
  open,
  onOpenChange,
  sourceContent = "",
  sourceMessageId,
  editMemory,
}: ManualMemoryDialogProps) {
  const dispatch = useCommand();
  const {
    error: toastError,
    success: toastSuccess,
    warning: toastWarning,
  } = useToast();
  const currentConversationId = useCurrentConversationId();

  const isEditMode = Boolean(editMemory);
  const initialSourceText = sourceContent.trim();

  const [sourceText, setSourceText] = useState(initialSourceText);
  const [summary, setSummary] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const { compressText, isCompressing, error } = useMemoryCompression();

  const normalizedSourceText = sourceText.trim();
  const canSave =
    Boolean(currentConversationId) &&
    normalizedSourceText.length > 0 &&
    summary.trim().length > 0 &&
    !isCompressing &&
    !isSaving;

  const addTag = useCallback((rawValue: string) => {
    const value = rawValue.trim();
    if (!value) {
      return;
    }

    setTags((previous) => {
      if (previous.includes(value)) {
        return previous;
      }
      return [...previous, value];
    });
    setTagInput("");
  }, []);

  const handleTagKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter" || event.key === ",") {
        event.preventDefault();
        addTag(tagInput);
      }

      if (event.key === "Backspace" && !tagInput && tags.length > 0) {
        setTags((previous) => previous.slice(0, -1));
      }
    },
    [addTag, tagInput, tags.length],
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    setTagInput("");

    if (editMemory) {
      setSourceText(editMemory.sourceContent);
      setSummary(editMemory.summary);
      setTags((previous) => {
        const sameLength = previous.length === editMemory.tags.length;
        const sameValue =
          sameLength &&
          previous.every((tag, index) => tag === editMemory.tags[index]);
        return sameValue ? previous : [...editMemory.tags];
      });
      return;
    }

    setSourceText(initialSourceText);
    setSummary("");
    setTags((previous) => (previous.length === 0 ? previous : []));
  }, [editMemory, initialSourceText, open]);

  const handleCompress = useCallback(async () => {
    if (!normalizedSourceText) {
      toastWarning("原始文本不能为空", "请先填写原始文本后再进行 AI 压缩。");
      return;
    }

    try {
      const compressed = await compressText(normalizedSourceText);
      setSummary(compressed);
    } catch (compressError) {
      const message =
        compressError instanceof Error
          ? compressError.message
          : "AI 压缩失败，请稍后重试。";
      toastWarning("AI 压缩失败", message);
    }
  }, [compressText, normalizedSourceText, toastWarning]);

  const handleSave = useCallback(async () => {
    if (!currentConversationId) {
      toastError(
        isEditMode ? "无法更新记忆" : "无法保存记忆",
        "当前没有激活会话。",
      );
      return;
    }

    const normalizedSource = sourceText.trim();
    const normalizedSummary = summary.trim();
    if (!normalizedSource) {
      toastWarning("原始文本不能为空", "请填写原始文本后再保存。");
      return;
    }

    if (!normalizedSummary) {
      toastWarning("摘要不能为空", "请填写记忆摘要后再保存。");
      return;
    }

    setIsSaving(true);
    try {
      const normalizedTagList = normalizeTags(tags);

      if (isEditMode && editMemory) {
        const result = await dispatch({
          type: MemoryCommands.UPDATE_MANUAL_MEMORY,
          payload: {
            conversationId: currentConversationId,
            id: editMemory.id,
            updates: {
              sourceContent: normalizedSource,
              summary: normalizedSummary,
              tags: normalizedTagList,
            },
          },
        });

        if (!result.success) {
          toastError("更新记忆失败", result.error ?? "未知错误");
          return;
        }

        toastSuccess("记忆已更新");
        onOpenChange(false);
        return;
      }

      const result = await dispatch({
        type: MemoryCommands.ADD_MANUAL_MEMORY,
        payload: {
          conversationId: currentConversationId,
          sourceContent: normalizedSource,
          summary: normalizedSummary,
          tags: normalizedTagList,
          sourceMessageId,
        },
      });

      if (!result.success) {
        toastError("保存记忆失败", result.error ?? "未知错误");
        return;
      }

      toastSuccess("记忆已保存");
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  }, [
    currentConversationId,
    dispatch,
    editMemory,
    isEditMode,
    onOpenChange,
    sourceMessageId,
    sourceText,
    summary,
    tags,
    toastError,
    toastSuccess,
    toastWarning,
  ]);

  const normalizedTags = useMemo(() => normalizeTags(tags), [tags]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent width="lg">
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? "编辑手动记忆" : "保存为手动记忆"}
          </DialogTitle>
        </DialogHeader>

        <div className="mt-4 space-y-4">
          <section className="space-y-2">
            <h4
              className="text-sm font-medium"
              style={{ color: color("textPrimary") }}
            >
              原始文本
            </h4>
            <Textarea
              value={sourceText}
              onChange={(event) => setSourceText(event.target.value)}
              rows={5}
              placeholder="请输入要保存的原始文本"
              disabled={isSaving}
            />
          </section>

          <section className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h4
                className="text-sm font-medium"
                style={{ color: color("textPrimary") }}
              >
                记忆摘要
              </h4>
              {!isEditMode && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCompress}
                  disabled={
                    isSaving ||
                    isCompressing ||
                    normalizedSourceText.length === 0
                  }
                >
                  {isCompressing && (
                    <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                  )}
                  {isCompressing ? "AI 压缩中..." : "AI 压缩"}
                </Button>
              )}
            </div>

            <Textarea
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
              rows={6}
              placeholder={
                !isEditMode && isCompressing
                  ? "正在生成摘要..."
                  : "请输入记忆摘要"
              }
              disabled={isSaving}
            />

            {!isEditMode && error && (
              <p className="text-xs" style={{ color: color("warning") }}>
                {error}
              </p>
            )}
          </section>

          <section className="space-y-2">
            <h4
              className="text-sm font-medium"
              style={{ color: color("textPrimary") }}
            >
              标签
            </h4>

            <div className="flex items-center gap-2">
              <Input
                value={tagInput}
                onChange={(event) => setTagInput(event.target.value)}
                onKeyDown={handleTagKeyDown}
                placeholder="输入标签后回车"
                disabled={isSaving}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addTag(tagInput)}
                disabled={isSaving || !tagInput.trim()}
              >
                <Plus className="mr-1 h-4 w-4" />
                添加
              </Button>
            </div>

            {normalizedTags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {normalizedTags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs"
                    style={{
                      color: color("primary"),
                      background: colorAlpha("primary", 0.1),
                      borderColor: colorAlpha("primary", 0.3),
                    }}
                  >
                    <span>{tag}</span>
                    <button
                      type="button"
                      className="inline-flex h-4 w-4 items-center justify-center rounded-sm"
                      onClick={() =>
                        setTags((previous) =>
                          previous.filter((item) => item !== tag),
                        )
                      }
                      disabled={isSaving}
                      aria-label={`移除标签 ${tag}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </section>
        </div>

        <DialogFooter className="mt-6">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            取消
          </Button>
          <Button type="button" onClick={handleSave} disabled={!canSave}>
            {isSaving
              ? isEditMode
                ? "更新中..."
                : "保存中..."
              : isEditMode
                ? "保存修改"
                : "保存记忆"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
