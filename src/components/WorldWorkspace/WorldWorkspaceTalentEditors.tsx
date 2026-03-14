import { Plus, Trash2 } from "lucide-react";
import { useMemo, type RefObject } from "react";

import { Button, Card, Input, Select, Textarea, Toggle } from "@/components/ui";
import type { TalentConfig, World } from "@/lib/world/types";
import { color, colorAlpha } from "@/styles/tokens";

import {
  TALENT_CATEGORY_OPTIONS,
  TALENT_DUPLICATE_POLICY_OPTIONS,
} from "./world-workspace-talent-shared";

export type TalentRulesValue = NonNullable<World["rules"]["talentRules"]>;
export type TalentPityRuleValue = NonNullable<TalentRulesValue["pity"]>[number];
export type TalentSelectOption = { value: string; label: string };
export type TagSelectionItem = { id: string; name: string };

const EMPTY_SELECT_VALUE = "__none__";

export function TalentRulesCardEditor({
  talentRules,
  onChange,
}: {
  talentRules?: TalentRulesValue;
  onChange: (updates: Partial<TalentRulesValue>) => void;
}) {
  return (
    <Card variant="outlined" className="space-y-4 p-4">
      <div>
        <h4
          className="text-sm font-semibold"
          style={{ color: color("textPrimary") }}
        >
          天赋选择规则
        </h4>
        <p
          className="mt-1 text-xs"
          style={{ color: colorAlpha("textMuted", 0.72) }}
        >
          这里控制角色创建阶段的抽取次数、候选规模、消耗字段与重复策略；品质、抽取池和保底规则在下方分区单独维护。
        </p>
      </div>

      <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
        <Field label="角色创建初始抽取次数（留空=默认 2）">
          <Input
            type="number"
            value={talentRules?.initialDrawCount ?? ""}
            onChange={(event) =>
              onChange({
                initialDrawCount:
                  event.target.value.trim() === ""
                    ? undefined
                    : Number(event.target.value),
              })
            }
            placeholder="2"
          />
        </Field>
        <Field label="每次抽取候选数（留空=默认 3）">
          <Input
            type="number"
            value={talentRules?.initialOffersPerDraw ?? ""}
            onChange={(event) =>
              onChange({
                initialOffersPerDraw:
                  event.target.value.trim() === ""
                    ? undefined
                    : Number(event.target.value),
              })
            }
            placeholder="3"
          />
        </Field>
        <Field label="重复抽取策略">
          <Select
            value={talentRules?.duplicatePolicy ?? "exclude_owned"}
            onValueChange={(value) =>
              onChange({
                duplicatePolicy: value as TalentRulesValue["duplicatePolicy"],
              })
            }
            options={TALENT_DUPLICATE_POLICY_OPTIONS.map((option) => ({
              value: option.value,
              label: option.label,
            }))}
          />
        </Field>
        <Field label="免费抽取属性键（可选）">
          <Input
            value={talentRules?.freeDrawAttributeKey ?? ""}
            onChange={(event) =>
              onChange({ freeDrawAttributeKey: event.target.value })
            }
            placeholder="free_talent_draws"
          />
        </Field>
        <Field label="抽取点属性键（可选）">
          <Input
            value={talentRules?.drawPointAttributeKey ?? ""}
            onChange={(event) =>
              onChange({ drawPointAttributeKey: event.target.value })
            }
            placeholder="talent_draw_points"
          />
        </Field>
        <Field label="每次抽取消耗点数（可选）">
          <Input
            type="number"
            value={talentRules?.drawPointCost ?? ""}
            onChange={(event) =>
              onChange({
                drawPointCost:
                  event.target.value.trim() === ""
                    ? undefined
                    : Number(event.target.value),
              })
            }
            placeholder="1"
          />
        </Field>
      </div>

      <ToggleSetting
        title="允许游戏中获得新天赋"
        description="关闭后，普通流程不应再让角色在运行中继续新增天赋。"
        checked={talentRules?.allowAcquireDuringGame ?? true}
        onCheckedChange={(checked) =>
          onChange({ allowAcquireDuringGame: checked })
        }
      />
    </Card>
  );
}

export function TalentPityRulesEditor({
  pityRules,
  rarityOptions,
  onAdd,
  onRemove,
  onUpdate,
}: {
  pityRules: NonNullable<TalentRulesValue["pity"]>;
  rarityOptions: TalentSelectOption[];
  onAdd: () => void;
  onRemove: (index: number) => void;
  onUpdate: (index: number, updates: Partial<TalentPityRuleValue>) => void;
}) {
  return (
    <Card variant="outlined" className="space-y-4 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4
            className="text-sm font-semibold"
            style={{ color: color("textPrimary") }}
          >
            保底规则
          </h4>
          <p
            className="mt-1 text-xs"
            style={{ color: colorAlpha("textMuted", 0.72) }}
          >
            为连续未命中高品质的抽取流程配置保底阈值与兜底品质。通常建议按阈值递增排列。
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onAdd}>
          <Plus className="mr-1 h-4 w-4" />
          添加保底
        </Button>
      </div>

      {pityRules.length === 0 ? (
        <p className="text-sm" style={{ color: colorAlpha("textMuted", 0.76) }}>
          当前没有保底规则。若世界不需要抽取保底，可保持为空。
        </p>
      ) : (
        <div className="space-y-3">
          {pityRules.map((rule, index) => {
            const selectOptions = [
              ...rarityOptions,
              ...(!rarityOptions.some(
                (option) => option.value === rule.guaranteeRarity,
              )
                ? [
                    {
                      value: rule.guaranteeRarity,
                      label: `${rule.guaranteeRarity}（已引用）`,
                    },
                  ]
                : []),
            ];

            return (
              <div
                key={`${rule.guaranteeRarity}-${index}`}
                className="grid gap-3 rounded-xl border p-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end"
                style={{
                  borderColor: colorAlpha("border", 0.3),
                  background: colorAlpha("bgCard", 0.2),
                }}
              >
                <Field label="连续未命中次数">
                  <Input
                    type="number"
                    value={rule.afterMisses}
                    onChange={(event) =>
                      onUpdate(index, {
                        afterMisses: Number(event.target.value),
                      })
                    }
                    placeholder="3"
                  />
                </Field>
                <Field label="保底品质">
                  <Select
                    value={rule.guaranteeRarity}
                    onValueChange={(value) =>
                      onUpdate(index, { guaranteeRarity: value })
                    }
                    options={selectOptions}
                  />
                </Field>
                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onRemove(index)}
                  >
                    <Trash2 className="mr-1 h-4 w-4" />
                    删除
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

export function TalentCardEditor({
  talent,
  rarityOptions,
  poolItems,
  nameInputRef,
  onChange,
  onRemove,
}: {
  talent: TalentConfig;
  rarityOptions: TalentSelectOption[];
  poolItems: TagSelectionItem[];
  nameInputRef?: RefObject<HTMLInputElement | null>;
  onChange: (updates: Partial<TalentConfig>) => void;
  onRemove: () => void;
}) {
  const raritySelectOptions = useMemo(
    () => [
      { value: EMPTY_SELECT_VALUE, label: "未设置" },
      ...rarityOptions,
      ...(!talent.rarity ||
      rarityOptions.some((option) => option.value === talent.rarity)
        ? []
        : [
            {
              value: talent.rarity,
              label: `${talent.rarity}（已引用）`,
            },
          ]),
    ],
    [rarityOptions, talent.rarity],
  );
  const drawPoolItems = useMemo(() => {
    const nextItems = [...poolItems];
    for (const poolId of talent.draw?.poolIds ?? []) {
      if (!nextItems.some((item) => item.id === poolId)) {
        nextItems.push({ id: poolId, name: `${poolId}（已引用）` });
      }
    }
    return nextItems;
  }, [poolItems, talent.draw?.poolIds]);

  const updateDraw = (updates: Partial<NonNullable<TalentConfig["draw"]>>) => {
    const currentDraw = talent.draw ?? {};
    const nextWeight = Object.prototype.hasOwnProperty.call(updates, "weight")
      ? updates.weight
      : currentDraw.weight;
    const nextPoolIds = Object.prototype.hasOwnProperty.call(updates, "poolIds")
      ? updates.poolIds
      : currentDraw.poolIds;
    const nextMinLevel = Object.prototype.hasOwnProperty.call(
      updates,
      "minLevel",
    )
      ? updates.minLevel
      : currentDraw.minLevel;

    onChange({
      draw:
        nextWeight === undefined &&
        (nextPoolIds?.length ?? 0) === 0 &&
        nextMinLevel === undefined
          ? undefined
          : {
              ...(nextWeight === undefined ? {} : { weight: nextWeight }),
              ...((nextPoolIds?.length ?? 0) === 0
                ? {}
                : { poolIds: nextPoolIds }),
              ...(nextMinLevel === undefined ? {} : { minLevel: nextMinLevel }),
            },
    });
  };

  return (
    <Card variant="outlined" className="space-y-4 p-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Field label="天赋 ID">
          <Input
            value={talent.id}
            onChange={(event) => onChange({ id: event.target.value })}
            placeholder="sharp_eye"
          />
        </Field>
        <Field label="天赋名称">
          <Input
            ref={nameInputRef}
            value={talent.name}
            onChange={(event) => onChange({ name: event.target.value })}
            placeholder="锐眼"
          />
        </Field>
        <Field label="分类">
          <Select
            value={talent.category ?? "misc"}
            onValueChange={(value) =>
              onChange({ category: value as TalentConfig["category"] })
            }
            options={TALENT_CATEGORY_OPTIONS.map((option) => ({
              value: option.value,
              label: option.label,
            }))}
          />
        </Field>
        <Field label="图标（可选）">
          <Input
            value={talent.icon ?? ""}
            onChange={(event) => onChange({ icon: event.target.value })}
            placeholder="star"
          />
        </Field>
      </div>

      <Field label="描述">
        <Textarea
          value={talent.description}
          onChange={(event) => onChange({ description: event.target.value })}
          className="min-h-24"
          placeholder="描述天赋效果与叙事语义"
        />
      </Field>

      <div
        className="space-y-4 rounded-xl border px-4 py-4"
        style={{
          borderColor: colorAlpha("border", 0.3),
          background: colorAlpha("bgCard", 0.2),
        }}
      >
        <div>
          <h5
            className="text-sm font-semibold"
            style={{ color: color("textPrimary") }}
          >
            抽取配置
          </h5>
          <p
            className="mt-1 text-xs"
            style={{ color: colorAlpha("textMuted", 0.72) }}
          >
            配置该天赋在抽取系统中的品质、权重、所属抽取池与等级门槛。留空时按运行时默认规则处理。
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Field label="品质（可选）">
            <Select
              value={talent.rarity ?? EMPTY_SELECT_VALUE}
              onValueChange={(value) =>
                onChange({
                  rarity: value === EMPTY_SELECT_VALUE ? undefined : value,
                })
              }
              options={raritySelectOptions}
            />
          </Field>
          <Field label="抽取权重（可选）">
            <Input
              type="number"
              value={talent.draw?.weight ?? ""}
              onChange={(event) =>
                updateDraw({
                  weight:
                    event.target.value.trim() === ""
                      ? undefined
                      : Number(event.target.value),
                })
              }
              placeholder="1"
            />
          </Field>
          <Field label="最低等级门槛（可选）">
            <Input
              type="number"
              value={talent.draw?.minLevel ?? ""}
              onChange={(event) =>
                updateDraw({
                  minLevel:
                    event.target.value.trim() === ""
                      ? undefined
                      : Number(event.target.value),
                })
              }
              placeholder="5"
            />
          </Field>
        </div>

        <TagSelectionField
          label="所属抽取池"
          description="不选时表示不显式绑定抽取池，由上层抽取规则决定。"
          items={drawPoolItems}
          value={talent.draw?.poolIds ?? []}
          onChange={(nextValue) => updateDraw({ poolIds: nextValue })}
          emptyMessage="请先在上方创建抽取池。"
        />
      </div>

      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={onRemove}>
          <Trash2 className="mr-1 h-4 w-4" />
          删除天赋
        </Button>
      </div>
    </Card>
  );
}

export function TagSelectionField({
  label,
  description,
  items,
  value,
  onChange,
  emptyMessage = "先在天赋区创建条目后再绑定。",
}: {
  label: string;
  description?: string;
  items: TagSelectionItem[];
  value: string[];
  onChange: (nextValue: string[]) => void;
  emptyMessage?: string;
}) {
  const resolvedItems = useMemo(() => {
    const nextItems = [...items];
    for (const itemId of value) {
      if (!nextItems.some((item) => item.id === itemId)) {
        nextItems.push({ id: itemId, name: `${itemId}（已引用）` });
      }
    }
    return nextItems;
  }, [items, value]);

  return (
    <div>
      <span
        className="text-xs font-medium"
        style={{ color: color("textSecondary") }}
      >
        {label}
      </span>
      {description ? (
        <p
          className="mt-1 text-xs"
          style={{ color: colorAlpha("textMuted", 0.72) }}
        >
          {description}
        </p>
      ) : null}
      <div className="mt-2 flex flex-wrap gap-2">
        {resolvedItems.map((item) => {
          const selected = value.includes(item.id);
          return (
            <button
              key={item.id}
              type="button"
              className="rounded-full border px-3 py-1.5 text-xs transition-all"
              style={{
                color: selected ? color("primary") : color("textSecondary"),
                background: selected
                  ? colorAlpha("primary", 0.12)
                  : "transparent",
                borderColor: colorAlpha(
                  selected ? "primary" : "border",
                  selected ? 0.45 : 0.3,
                ),
              }}
              onClick={() => {
                const nextValue = selected
                  ? value.filter((entry) => entry !== item.id)
                  : [...value, item.id];
                onChange(nextValue);
              }}
            >
              {item.name}
            </button>
          );
        })}
        {resolvedItems.length === 0 ? (
          <p
            className="text-xs"
            style={{ color: colorAlpha("textMuted", 0.72) }}
          >
            {emptyMessage}
          </p>
        ) : null}
      </div>
    </div>
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

function ToggleSetting({
  title,
  description,
  checked,
  onCheckedChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div
      className="flex items-start justify-between gap-3 rounded-xl border px-4 py-3"
      style={{
        borderColor: colorAlpha("border", 0.3),
        background: colorAlpha("bgCard", 0.22),
      }}
    >
      <div className="min-w-0">
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
      <Toggle checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}
