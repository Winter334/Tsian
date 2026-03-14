import { Plus, Trash2 } from "lucide-react";
import { useMemo } from "react";

import { Button, Input, Select } from "@/components/ui";
import { color, colorAlpha } from "@/styles/tokens";

import { WorldEditorField } from "./WorldEditorPaneInventorySectionShared";
import type { NumericFieldEntry } from "./WorldEditorPaneRuleSectionShared.helpers";

function getMergedNumericFieldOptions(
  fieldOptions: Array<{ value: string; label: string }>,
  entries: NumericFieldEntry[],
): Array<{ value: string; label: string }> {
  const result = [...fieldOptions];
  const knownValues = new Set(fieldOptions.map((item) => item.value));

  for (const entry of entries) {
    const field = entry.field.trim();
    if (!field || knownValues.has(field)) {
      continue;
    }

    knownValues.add(field);
    result.push({
      value: field,
      label: `${field}（待确认字段）`,
    });
  }

  return result;
}

interface NumericFieldListEditorProps {
  title: string;
  description: string;
  fieldLabel: string;
  valueLabel: string;
  addLabel: string;
  emptyMessage: string;
  fieldOptions: Array<{ value: string; label: string }>;
  entries: NumericFieldEntry[];
  onChange: (entries: NumericFieldEntry[]) => void;
}

export function NumericFieldListEditor({
  title,
  description,
  fieldLabel,
  valueLabel,
  addLabel,
  emptyMessage,
  fieldOptions,
  entries,
  onChange,
}: NumericFieldListEditorProps) {
  const mergedFieldOptions = useMemo(
    () => getMergedNumericFieldOptions(fieldOptions, entries),
    [entries, fieldOptions],
  );
  const canAddEntry = mergedFieldOptions.length > 0;

  return (
    <div
      className="rounded-xl border px-4 py-3"
      style={{
        borderColor: colorAlpha("border", 0.3),
        background: colorAlpha("bgCard", 0.22),
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p
            className="text-sm font-medium"
            style={{ color: color("textPrimary") }}
          >
            {title}
          </p>
          <p
            className="mt-1 text-xs"
            style={{ color: colorAlpha("textMuted", 0.72) }}
          >
            {description}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            onChange([
              ...entries,
              {
                field: mergedFieldOptions[0]?.value ?? "",
                value: 0,
              },
            ])
          }
          disabled={!canAddEntry}
        >
          <Plus className="mr-1 h-4 w-4" />
          {addLabel}
        </Button>
      </div>

      {entries.length === 0 ? (
        <p
          className="mt-3 text-xs"
          style={{ color: colorAlpha("textMuted", 0.72) }}
        >
          {emptyMessage}
        </p>
      ) : (
        <div className="mt-3 space-y-3">
          {entries.map((entry, index) => (
            <div
              key={`${entry.field || "field"}-${index}`}
              className="grid gap-3 md:grid-cols-[minmax(0,1fr)_9rem_auto] [&>label]:min-w-0"
            >
              <WorldEditorField label={fieldLabel}>
                <Select
                  value={entry.field}
                  onValueChange={(value) =>
                    onChange(
                      entries.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, field: value } : item,
                      ),
                    )
                  }
                  options={[
                    { value: "", label: `选择${fieldLabel}` },
                    ...mergedFieldOptions,
                  ]}
                />
              </WorldEditorField>
              <WorldEditorField label={valueLabel}>
                <Input
                  type="number"
                  value={entry.value}
                  onChange={(event) =>
                    onChange(
                      entries.map((item, itemIndex) =>
                        itemIndex === index
                          ? {
                              ...item,
                              value:
                                event.target.value.trim() === ""
                                  ? ""
                                  : Number(event.target.value),
                            }
                          : item,
                      ),
                    )
                  }
                />
              </WorldEditorField>
              <div className="flex items-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    onChange(
                      entries.filter((_, itemIndex) => itemIndex !== index),
                    )
                  }
                >
                  <Trash2 className="mr-1 h-4 w-4" />
                  删除
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
