import { Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button, Card, Input, Select } from "@/components/ui";
import {
  TALENT_RARITY_COLOR_TOKENS,
  TALENT_RARITY_GLOW_TOKENS,
  getTalentRarityVisual,
} from "@/lib/ui/talent-rarity";
import type { WorldConfig } from "@/lib/world/types";
import { color, colorAlpha } from "@/styles/tokens";

type TalentRarity = NonNullable<
  NonNullable<WorldConfig["talentRules"]>["rarities"]
>[number];

type TalentRarityToken =
  | (typeof TALENT_RARITY_COLOR_TOKENS)[number]
  | (typeof TALENT_RARITY_GLOW_TOKENS)[number];

interface TalentRarityEditorProps {
  rarities: TalentRarity[];
  onAdd: () => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, updates: Partial<TalentRarity>) => void;
}

const EMPTY_SELECT_VALUE = "__none__";
const TALENT_RARITY_TOKEN_LABELS: Record<TalentRarityToken, string> = {
  textMuted: "中性",
  primary: "主色",
  secondary: "辅助色",
  warning: "警告",
  error: "错误",
};

const EDITOR_CARD_HOVER_STYLE = {
  scale: 1,
  y: 0,
  borderColor: colorAlpha("primary", 0.52),
} as const;

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

  const colorTokenOptions = useMemo(
    () =>
      buildTokenOptions(
        TALENT_RARITY_COLOR_TOKENS,
        activeRarity?.colorToken,
        "未设置（默认 primary）",
      ),
    [activeRarity?.colorToken],
  );
  const glowTokenOptions = useMemo(
    () =>
      buildTokenOptions(
        TALENT_RARITY_GLOW_TOKENS,
        activeRarity?.glowToken,
        "未设置（跟随颜色）",
      ),
    [activeRarity?.glowToken],
  );

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
            品质定义
          </h4>
          <p
            className="mt-1 text-xs"
            style={{ color: colorAlpha("textMuted", 0.72) }}
          >
            定义天赋的品质层级、权重与视觉 token；供抽取规则与单个天赋引用。
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
              const rarityVisual = getTalentRarityVisual(rarity, {
                backgroundAlpha: 0.12,
                borderAlpha: 0.36,
                glowAlpha: 0.18,
                strongGlowAlpha: 0.28,
              });

              return (
                <button
                  key={`${rarity.id}-${index}`}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveIndex(index)}
                  className="w-full rounded-xl border px-3 py-3 text-left transition-all duration-150"
                  style={{
                    borderColor: isActive
                      ? rarityVisual.accentBorder
                      : colorAlpha("border", 0.28),
                    background: isActive
                      ? `linear-gradient(135deg, ${rarityVisual.accentSoft} 0%, ${colorAlpha("bgCard", 0.2)} 100%)`
                      : colorAlpha("bgCard", 0.16),
                    boxShadow: isActive ? rarityVisual.accentGlow : "none",
                  }}
                >
                  <p
                    className="text-sm font-medium"
                    style={{
                      color: isActive
                        ? rarityVisual.accentColor
                        : color("textPrimary"),
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
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{
                        background: rarityVisual.accentColor,
                        boxShadow: rarityVisual.accentGlow,
                      }}
                    />
                    <MetaBadge label="权重" value={String(rarity.weight)} />
                  </div>
                </button>
              );
            })}
          </div>

          {activeRarity ? (
            <div
              className="space-y-4 rounded-xl border p-4"
              style={{
                borderColor: colorAlpha("border", 0.3),
                background: colorAlpha("bgCard", 0.16),
              }}
            >
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-2">
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
                  <Select
                    value={
                      activeRarity.colorToken?.trim() || EMPTY_SELECT_VALUE
                    }
                    onValueChange={(value) =>
                      onUpdate(activeRarity.id, {
                        colorToken:
                          value === EMPTY_SELECT_VALUE ? undefined : value,
                      })
                    }
                    options={colorTokenOptions}
                  />
                </Field>
                <Field label="光效 Token（可选）">
                  <Select
                    value={activeRarity.glowToken?.trim() || EMPTY_SELECT_VALUE}
                    onValueChange={(value) =>
                      onUpdate(activeRarity.id, {
                        glowToken:
                          value === EMPTY_SELECT_VALUE ? undefined : value,
                      })
                    }
                    options={glowTokenOptions}
                  />
                </Field>
              </div>

              <TalentRarityPreview rarity={activeRarity} />

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

function TalentRarityPreview({ rarity }: { rarity: TalentRarity }) {
  const rarityVisual = getTalentRarityVisual(rarity, {
    backgroundAlpha: 0.16,
    borderAlpha: 0.42,
    glowAlpha: 0.24,
    strongGlowAlpha: 0.38,
  });
  const previewTitle = rarity.label.trim() || rarity.id.trim() || "未命名品质";

  return (
    <div
      className="space-y-3 rounded-2xl border p-4"
      style={{
        borderColor: rarityVisual.accentBorder,
        background: `linear-gradient(135deg, ${rarityVisual.accentSoft} 0%, ${colorAlpha("bgCard", 0.68)} 56%, ${rarityVisual.glowSoft} 100%)`,
        boxShadow: rarityVisual.accentGlowStrong,
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p
            className="text-[11px] font-medium uppercase tracking-[0.22em]"
            style={{ color: colorAlpha("textMuted", 0.74) }}
          >
            效果预览
          </p>
          <p
            className="mt-2 text-sm font-semibold"
            style={{ color: rarityVisual.accentColor }}
          >
            {previewTitle}
          </p>
          <p
            className="mt-1 text-xs leading-5"
            style={{ color: colorAlpha("textMuted", 0.78) }}
          >
            颜色 token 控制文字与边框基调，glow token
            控制外层辉光与发光点缀；未设置 glow 时会跟随颜色 token。
          </p>
        </div>

        <span
          className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium"
          style={{
            borderColor: rarityVisual.accentBorder,
            background: rarityVisual.accentSoft,
            color: rarityVisual.accentColor,
            boxShadow: rarityVisual.accentGlow,
          }}
        >
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{
              background: rarityVisual.accentColor,
              boxShadow: rarityVisual.accentGlowStrong,
            }}
          />
          {rarity.id || "未设置 ID"}
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div
          className="rounded-xl border p-3"
          style={{
            borderColor: rarityVisual.accentBorder,
            background: colorAlpha("bgCard", 0.28),
          }}
        >
          <p
            className="text-[11px] font-medium uppercase tracking-[0.18em]"
            style={{ color: colorAlpha("textMuted", 0.72) }}
          >
            标签层
          </p>
          <div className="mt-3">
            <span
              className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium"
              style={{
                borderColor: rarityVisual.accentBorder,
                background: rarityVisual.accentSoft,
                color: rarityVisual.accentColor,
                boxShadow: rarityVisual.accentGlow,
              }}
            >
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{
                  background: rarityVisual.accentColor,
                  boxShadow: rarityVisual.accentGlowStrong,
                }}
              />
              {previewTitle}
            </span>
          </div>
        </div>

        <div
          className="rounded-xl border p-3"
          style={{
            borderColor: rarityVisual.accentBorder,
            background: `linear-gradient(135deg, ${rarityVisual.accentSoft} 0%, ${rarityVisual.glowSoft} 100%)`,
            boxShadow: rarityVisual.accentGlowStrong,
          }}
        >
          <p
            className="text-[11px] font-medium uppercase tracking-[0.18em]"
            style={{ color: colorAlpha("textMuted", 0.72) }}
          >
            卡面层
          </p>
          <div className="mt-3 flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p
                className="truncate text-sm font-semibold"
                style={{ color: rarityVisual.accentColor }}
                title={previewTitle}
              >
                {previewTitle}
              </p>
              <p
                className="mt-1 text-xs leading-5"
                style={{ color: colorAlpha("textMuted", 0.8) }}
              >
                外层发光直接来自 glow
                token，可用于验证当前品质在抽取卡面上的层次效果。
              </p>
            </div>
            <span
              className="shrink-0 rounded-full border px-2.5 py-1 text-[11px]"
              style={{
                borderColor: rarityVisual.accentBorder,
                background: colorAlpha("bgCard", 0.24),
                color: rarityVisual.accentColor,
                boxShadow: rarityVisual.accentGlow,
              }}
            >
              权重 {rarity.weight}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function buildTokenOptions<Token extends TalentRarityToken>(
  tokens: readonly Token[],
  currentValue: string | undefined,
  emptyLabel: string,
): Array<{ value: string; label: string }> {
  const options = [
    { value: EMPTY_SELECT_VALUE, label: emptyLabel },
    ...tokens.map((token) => ({
      value: token,
      label: `${token} · ${TALENT_RARITY_TOKEN_LABELS[token]}`,
    })),
  ];
  const normalizedValue = currentValue?.trim();

  if (normalizedValue && !tokens.includes(normalizedValue as Token)) {
    options.push({
      value: normalizedValue,
      label: `${normalizedValue}（已引用）`,
    });
  }

  return options;
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
