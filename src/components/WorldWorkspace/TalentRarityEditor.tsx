import { Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import { Button, Card, Input } from "@/components/ui";
import type { WorldConfig } from "@/lib/world/types";
import { color, colorAlpha } from "@/styles/tokens";

type TalentRarity = NonNullable<
  NonNullable<WorldConfig["talentRules"]>["rarities"]
>[number];

interface TalentRarityEditorProps {
  rarities: TalentRarity[];
  onAdd: () => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, updates: Partial<TalentRarity>) => void;
}

export function TalentRarityEditor({
  rarities,
  onAdd,
  onRemove,
  onUpdate,
}: TalentRarityEditorProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (rarities.length === 0) {
      if (activeIndex !== 0) {
        setActiveIndex(0);
      }
      return;
    }

    if (activeIndex > rarities.length - 1) {
      setActiveIndex(rarities.length - 1);
    }
  }, [activeIndex, rarities.length]);

  const resolvedActiveIndex =
    rarities.length === 0 ? -1 : Math.min(activeIndex, rarities.length - 1);
  const activeRarity =
    resolvedActiveIndex >= 0 ? rarities[resolvedActiveIndex] : null;

  const handleAdd = () => {
    onAdd();
    setActiveIndex(rarities.length);
  };

  const handleRemove = (id: string, index: number) => {
    onRemove(id);
    setActiveIndex((currentIndex) => {
      if (rarities.length <= 1) {
        return 0;
      }

      if (currentIndex > index) {
        return currentIndex - 1;
      }

      if (currentIndex === index) {
        return Math.min(index, rarities.length - 2);
      }

      return currentIndex;
    });
  };

  return (
    <Card variant="outlined" className="space-y-4 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4
            className="text-sm font-semibold"
            style={{ color: color("textPrimary") }}
          >
            品质定义
          </h4>
          <p
            className="mt-1 text-xs"
            style={{ color: colorAlpha("textMuted", 0.72) }}
          >
            定义天赋的品质层级、权重、主题色与解锁门槛，供抽取规则与单个天赋引用。
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleAdd}>
          <Plus className="mr-1 h-4 w-4" />
          添加品质
        </Button>
      </div>

      {rarities.length === 0 ? (
        <EmptyState message="当前还没有品质定义。新增后即可在天赋与保底规则中引用。" />
      ) : (
        <div className="grid gap-3 xl:grid-cols-[minmax(220px,280px)_minmax(0,1fr)]">
          <div
            className="space-y-2 rounded-xl border p-3"
            style={{
              borderColor: colorAlpha("border", 0.3),
              background: colorAlpha("bgCard", 0.2),
            }}
            role="tablist"
            aria-label="品质切换"
          >
            {rarities.map((rarity, index) => {
              const isActive = resolvedActiveIndex === index;
              const title =
                rarity.label.trim() || rarity.id.trim() || `品质 ${index + 1}`;
              return (
                <button
                  key={`${rarity.id}-${index}`}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveIndex(index)}
                  className="w-full rounded-xl border px-3 py-3 text-left transition-all duration-150"
                  style={{
                    borderColor: colorAlpha(
                      isActive ? "primary" : "border",
                      isActive ? 0.42 : 0.28,
                    ),
                    background: colorAlpha(
                      isActive ? "primary" : "bgCard",
                      isActive ? 0.12 : 0.16,
                    ),
                    boxShadow: isActive
                      ? `0 0 18px ${colorAlpha("primary", 0.12)}`
                      : "none",
                  }}
                >
                  <p
                    className="text-sm font-medium"
                    style={{
                      color: isActive ? color("primary") : color("textPrimary"),
                    }}
                    title={title}
                  >
                    {title}
                  </p>
                  <p
                    className="mt-1 font-mono text-[11px] break-all"
                    style={{ color: colorAlpha("textMuted", 0.74) }}
                  >
                    ID：{rarity.id}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <MetaBadge label="权重" value={String(rarity.weight)} />
                    <MetaBadge
                      label="门槛"
                      value={
                        rarity.minLevel === undefined
                          ? "无"
                          : `Lv.${rarity.minLevel}`
                      }
                    />
                  </div>
                </button>
              );
            })}
          </div>

          {activeRarity ? (
            <div
              className="space-y-3 rounded-xl border p-4"
              style={{
                borderColor: colorAlpha("border", 0.3),
                background: colorAlpha("bgCard", 0.16),
              }}
            >
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <Field label="品质 ID">
                  <Input
                    value={activeRarity.id}
                    onChange={(event) =>
                      onUpdate(activeRarity.id, { id: event.target.value })
                    }
                    placeholder="epic"
                  />
                </Field>
                <Field label="显示名">
                  <Input
                    value={activeRarity.label}
                    onChange={(event) =>
                      onUpdate(activeRarity.id, { label: event.target.value })
                    }
                    placeholder="史诗"
                  />
                </Field>
                <Field label="抽取权重">
                  <Input
                    type="number"
                    value={activeRarity.weight}
                    onChange={(event) =>
                      onUpdate(activeRarity.id, {
                        weight: Number(event.target.value),
                      })
                    }
                    placeholder="1"
                  />
                </Field>
                <Field label="颜色 Token（可选）">
                  <Input
                    value={activeRarity.colorToken ?? ""}
                    onChange={(event) =>
                      onUpdate(activeRarity.id, {
                        colorToken: event.target.value,
                      })
                    }
                    placeholder="talent.rarity.epic"
                  />
                </Field>
                <Field label="光效 Token（可选）">
                  <Input
                    value={activeRarity.glowToken ?? ""}
                    onChange={(event) =>
                      onUpdate(activeRarity.id, {
                        glowToken: event.target.value,
                      })
                    }
                    placeholder="glow.epic"
                  />
                </Field>
                <Field label="最低等级门槛（可选）">
                  <Input
                    type="number"
                    value={activeRarity.minLevel ?? ""}
                    onChange={(event) =>
                      onUpdate(activeRarity.id, {
                        minLevel:
                          event.target.value.trim() === ""
                            ? undefined
                            : Number(event.target.value),
                      })
                    }
                    placeholder="10"
                  />
                </Field>
              </div>

              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    handleRemove(activeRarity.id, resolvedActiveIndex)
                  }
                >
                  <Trash2 className="mr-1 h-4 w-4" />
                  删除品质
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </Card>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span
        className="text-xs font-medium"
        style={{ color: color("textSecondary") }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

function MetaBadge({ label, value }: { label: string; value: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px]"
      style={{
        borderColor: colorAlpha("border", 0.3),
        background: colorAlpha("bgCard", 0.24),
      }}
    >
      <span style={{ color: colorAlpha("textMuted", 0.72) }}>{label}</span>
      <span style={{ color: color("textPrimary") }}>{value}</span>
    </span>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div
      className="rounded-xl border px-4 py-4 text-sm"
      style={{
        borderColor: colorAlpha("border", 0.3),
        background: colorAlpha("bgCard", 0.2),
        color: colorAlpha("textMuted", 0.78),
      }}
    >
      {message}
    </div>
  );
}
