import { Plus, X } from "lucide-react";
import { useMemo, useState } from "react";

import { Button, Input } from "@/components/ui";
import { color, colorAlpha } from "@/styles/tokens";

interface ArchiveTagEditorProps {
  tags: string[];
  onChange: (nextTags: string[]) => void;
}

export function ArchiveTagEditor({ tags, onChange }: ArchiveTagEditorProps) {
  const [draftTag, setDraftTag] = useState("");

  const normalizedTags = useMemo(() => {
    const unique = new Set<string>();
    tags.forEach((tag) => {
      const value = tag.trim();
      if (value.length > 0) {
        unique.add(value);
      }
    });
    return Array.from(unique);
  }, [tags]);

  const handleAddTag = () => {
    const value = draftTag.trim();
    if (value.length === 0 || normalizedTags.includes(value)) {
      return;
    }

    onChange([...normalizedTags, value]);
    setDraftTag("");
  };

  const handleRemoveTag = (tag: string) => {
    onChange(normalizedTags.filter((item) => item !== tag));
  };

  return (
    <section className="space-y-2.5">
      <h4
        className="text-sm font-semibold"
        style={{ color: color("textPrimary") }}
      >
        标签
      </h4>

      <div className="flex flex-wrap gap-2">
        {normalizedTags.length === 0 && (
          <span className="text-xs" style={{ color: color("textMuted") }}>
            暂无标签
          </span>
        )}

        {normalizedTags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs"
            style={{
              color: color("primary"),
              background: colorAlpha("primary", 0.12),
              border: `1px solid ${colorAlpha("primary", 0.25)}`,
            }}
          >
            {tag}
            <button
              type="button"
              onClick={() => handleRemoveTag(tag)}
              className="inline-flex h-4 w-4 items-center justify-center rounded-full"
              aria-label={`删除标签 ${tag}`}
              style={{ color: colorAlpha("textSecondary", 0.9) }}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <Input
          value={draftTag}
          onChange={(event) => setDraftTag(event.target.value)}
          placeholder="输入标签后回车或点击添加"
          className="h-9"
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              handleAddTag();
            }
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAddTag}
        >
          <Plus className="h-4 w-4" />
          添加
        </Button>
      </div>
    </section>
  );
}
