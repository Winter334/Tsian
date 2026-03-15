import { Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import { Button, Card, Input } from "@/components/ui";
import type { TalentConfig, WorldConfig } from "@/lib/world/types";
import { color, colorAlpha } from "@/styles/tokens";

import { TagSelectionField } from "./WorldWorkspaceTalentEditors";

type TalentPool = NonNullable<
  NonNullable<WorldConfig["talentRules"]>["pools"]
>[number];

interface TalentPoolEditorProps {
  pools: TalentPool[];
  rarityOptions: Array<{ value: string; label: string }>;
  talentOptions: TalentConfig[];
  onAdd: () => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, updates: Partial<TalentPool>) => void;
}

const EDITOR_CARD_HOVER_STYLE = {
  scale: 1,
  y: 0,
  borderColor: colorAlpha("primary", 0.52),
} as const;

export function TalentPoolEditor({
  pools,
  rarityOptions,
  talentOptions,
  onAdd,
  onRemove,
  onUpdate,
}: TalentPoolEditorProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (pools.length === 0) {
      if (activeIndex !== 0) {
        setActiveIndex(0);
      }
      return;
    }

    if (activeIndex > pools.length - 1) {
      setActiveIndex(pools.length - 1);
    }
  }, [activeIndex, pools.length]);

  const resolvedActiveIndex =
    pools.length === 0 ? -1 : Math.min(activeIndex, pools.length - 1);
  const activePool =
    resolvedActiveIndex >= 0 ? pools[resolvedActiveIndex] : null;

  const handleAdd = () => {
    onAdd();
    setActiveIndex(pools.length);
  };

  const handleRemove = (id: string, index: number) => {
    onRemove(id);
    setActiveIndex((currentIndex) => {
      if (pools.length <= 1) {
        return 0;
      }

      if (currentIndex > index) {
        return currentIndex - 1;
      }

      if (currentIndex === index) {
        return Math.min(index, pools.length - 2);
      }

      return currentIndex;
    });
  };

  const rarityItems = rarityOptions.map((option) => ({
    id: option.value,
    name: option.label,
  }));
  const talentItems = talentOptions.map((talent) => ({
    id: talent.id,
    name: talent.name.trim() || talent.id,
  }));

  return (
    <Card
      variant="outlined"
      whileHover={EDITOR_CARD_HOVER_STYLE}
      className="space-y-4 p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4
            className="text-sm font-semibold"
            style={{ color: color("textPrimary") }}
          >
            抽取池
          </h4>
          <p
            className="mt-1 text-xs"
            style={{ color: colorAlpha("textMuted", 0.72) }}
          >
            为不同来源的抽取流程配置品质、显式包含/排除与池归属。
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleAdd}>
          <Plus className="mr-1 h-4 w-4" />
          添加抽取池
        </Button>
      </div>

      {pools.length === 0 ? (
        <EmptyState message="当前还没有抽取池。新增后即可在天赋 draw.poolIds 中挂接。" />
      ) : (
        <div className="grid gap-3 xl:grid-cols-[minmax(220px,280px)_minmax(0,1fr)]">
          <div
            className="space-y-2 rounded-xl border p-3"
            style={{
              borderColor: colorAlpha("border", 0.3),
              background: colorAlpha("bgCard", 0.2),
            }}
            role="tablist"
            aria-label="抽取池切换"
          >
            {pools.map((pool, index) => {
              const isActive = resolvedActiveIndex === index;
              const title =
                pool.label?.trim() || pool.id.trim() || `抽取池 ${index + 1}`;
              return (
                <button
                  key={`${pool.id}-${index}`}
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
                    ID：{pool.id}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <MetaBadge
                      label="品质"
                      value={String(pool.allowedRarities?.length ?? 0)}
                    />
                  </div>
                </button>
              );
            })}
          </div>

          {activePool ? (
            <div
              className="space-y-4 rounded-xl border p-4"
              style={{
                borderColor: colorAlpha("border", 0.3),
                background: colorAlpha("bgCard", 0.16),
              }}
            >
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="抽取池 ID">
                  <Input
                    value={activePool.id}
                    onChange={(event) =>
                      onUpdate(activePool.id, { id: event.target.value })
                    }
                    placeholder="starter_pool"
                  />
                </Field>
                <Field label="显示名（可选）">
                  <Input
                    value={activePool.label ?? ""}
                    onChange={(event) =>
                      onUpdate(activePool.id, { label: event.target.value })
                    }
                    placeholder="新手池"
                  />
                </Field>
              </div>

              <TagSelectionField
                label="允许品质"
                description="不选时表示接受任意已定义品质。"
                items={rarityItems}
                value={activePool.allowedRarities ?? []}
                onChange={(nextValue) =>
                  onUpdate(activePool.id, { allowedRarities: nextValue })
                }
                emptyMessage="请先创建品质定义。"
              />

              <TagSelectionField
                label="显式包含天赋"
                description="可用于将特定天赋强制纳入该抽取池。"
                items={talentItems}
                value={activePool.includeTalentIds ?? []}
                onChange={(nextValue) =>
                  onUpdate(activePool.id, { includeTalentIds: nextValue })
                }
                emptyMessage="请先在天赋列表中创建条目。"
              />

              <TagSelectionField
                label="显式排除天赋"
                description="可用于从规则筛选结果中再做排除。"
                items={talentItems}
                value={activePool.excludeTalentIds ?? []}
                onChange={(nextValue) =>
                  onUpdate(activePool.id, { excludeTalentIds: nextValue })
                }
                emptyMessage="请先在天赋列表中创建条目。"
              />

              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    handleRemove(activePool.id, resolvedActiveIndex)
                  }
                >
                  <Trash2 className="mr-1 h-4 w-4" />
                  删除抽取池
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
