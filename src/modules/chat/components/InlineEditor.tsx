import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

import { Button, Textarea } from "@/components/ui";
import { colorAlpha } from "@/styles/tokens";

interface InlineEditorProps {
  initialContent: string;
  onSave: (content: string) => void;
  onCancel: () => void;
}

export function InlineEditor({
  initialContent,
  onSave,
  onCancel,
}: InlineEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [content, setContent] = useState(initialContent);

  const trimmedCurrent = useMemo(() => content.trim(), [content]);
  const trimmedInitial = useMemo(() => initialContent.trim(), [initialContent]);
  const canSave =
    trimmedCurrent.length > 0 && trimmedCurrent !== trimmedInitial;

  useEffect(() => {
    setContent(initialContent);
  }, [initialContent]);

  const resizeTextarea = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    textarea.style.height = "0px";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, []);

  useLayoutEffect(() => {
    resizeTextarea();
  }, [content, resizeTextarea]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    textarea.focus();
    textarea.select();
  }, []);

  const handleSave = useCallback(() => {
    if (!canSave) {
      return;
    }
    onSave(trimmedCurrent);
  }, [canSave, onSave, trimmedCurrent]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
        return;
      }

      if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        handleSave();
      }
    },
    [handleSave, onCancel],
  );

  return (
    <div
      className="rounded-lg border p-3"
      style={{
        background: colorAlpha("bgCard", 0.35),
        borderColor: colorAlpha("primary", 0.28),
      }}
    >
      <Textarea
        ref={textareaRef}
        value={content}
        onChange={(event) => {
          setContent(event.target.value);
        }}
        onKeyDown={handleKeyDown}
        rows={3}
        className="min-h-0! resize-none overflow-hidden text-sm"
        style={{
          background: colorAlpha("bgElevated", 0.45),
          borderColor: colorAlpha("primary", 0.35),
        }}
      />

      <div className="mt-3 flex items-center justify-end gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          style={{
            color: colorAlpha("textSecondary", 0.9),
          }}
        >
          取消
        </Button>
        <Button size="sm" onClick={handleSave} disabled={!canSave}>
          保存
        </Button>
      </div>
    </div>
  );
}
