import { AnimatePresence, motion } from "framer-motion";
import { Plus, Trash2 } from "lucide-react";
import type { RefObject } from "react";

import { Button, Input, Panel, Textarea } from "@/components/ui";
import type { PointBuyRules, PrimaryAttributeConfig } from "@/lib/world/types";
import { color, colorAlpha } from "@/styles/tokens";

import {
  WorldEditorDimensionMetaBadge,
  WorldEditorEmptySectionHint,
  WorldEditorField,
  WorldEditorFormSection,
  WorldEditorInventoryCard,
  WorldEditorSectionRulesEditorButton,
} from "./WorldEditorPaneInventorySectionShared";
import {
  MASTER_DETAIL_LIST_CONTENT_CLASS,
  MASTER_DETAIL_LIST_PANEL_CLASS,
} from "./WorldEditorPaneInventorySectionShared.helpers";

interface WorldEditorPaneAttributesSectionProps {
  primaryAttributes: readonly PrimaryAttributeConfig[];
  pointBuyRules?: PointBuyRules;
  allocatableAttributeOptions: Array<{ value: string; label: string }>;
  activeAttribute: PrimaryAttributeConfig | null;
  resolvedActiveAttributeIndex: number;
  rulesEditorActive: boolean;
  rulesEditorTitle: string;
  detailRef: RefObject<HTMLDivElement | null>;
  labelInputRef: RefObject<HTMLInputElement | null>;
  onOpenRulesEditor: () => void;
  onSetActiveAttributeIndex: (index: number) => void;
  onAddPrimaryAttribute: () => void;
  onUpdatePrimaryAttribute: (
    index: number,
    updates: Partial<PrimaryAttributeConfig>,
  ) => void;
  onRemovePrimaryAttribute: (index: number) => void;
  onUpdatePointBuyRules: (updates: Partial<PointBuyRules>) => void;
}

export function WorldEditorPaneAttributesSection({
  primaryAttributes,
  pointBuyRules,
  allocatableAttributeOptions,
  activeAttribute,
  resolvedActiveAttributeIndex,
  rulesEditorActive,
  rulesEditorTitle,
  detailRef,
  labelInputRef,
  onOpenRulesEditor,
  onSetActiveAttributeIndex,
  onAddPrimaryAttribute,
  onUpdatePrimaryAttribute,
  onRemovePrimaryAttribute,
  onUpdatePointBuyRules,
}: WorldEditorPaneAttributesSectionProps) {
  return (
    <WorldEditorFormSection
      title="属性与点数"
      description="覆盖角色创建最关键的主要属性与 point buy 规则。"
      action={
        <div className="flex flex-wrap gap-2">
          <WorldEditorSectionRulesEditorButton
            active={rulesEditorActive}
            title={rulesEditorTitle}
            onOpen={onOpenRulesEditor}
          />
          <Button variant="outline" size="sm" onClick={onAddPrimaryAttribute}>
            <Plus className="mr-1 h-4 w-4" />
            添加属性
          </Button>
        </div>
      }
    >
      {primaryAttributes.length > 0 ? (
        <div className="grid gap-3 xl:h-168 xl:grid-cols-[minmax(260px,320px)_minmax(0,1fr)] 2xl:grid-cols-[minmax(280px,360px)_minmax(0,1fr)]">
          <Panel variant="outlined" className={MASTER_DETAIL_LIST_PANEL_CLASS}>
            <div
              className={MASTER_DETAIL_LIST_CONTENT_CLASS}
              role="tablist"
              aria-label="主要属性切换"
            >
              {primaryAttributes.map((attribute, index) => {
                const isActive = resolvedActiveAttributeIndex === index;
                const attributeTitle =
                  attribute.label.trim() ||
                  attribute.key.trim() ||
                  `未命名属性 ${index + 1}`;
                const attributeDescription =
                  attribute.description?.trim() ?? "";
                const rangeText =
                  attribute.min !== undefined || attribute.max !== undefined
                    ? `范围 ${attribute.min ?? "未设"} ~ ${attribute.max ?? "未设"}`
                    : "未设置上下限";

                return (
                  <button
                    key={`${attribute.key || "attribute"}-${index}`}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => onSetActiveAttributeIndex(index)}
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
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p
                          className="wrap-break-word text-sm font-medium leading-5"
                          style={{
                            color: isActive
                              ? color("primary")
                              : color("textPrimary"),
                          }}
                          title={attributeTitle}
                        >
                          {attributeTitle}
                        </p>
                        <p
                          className="mt-1 text-[11px]"
                          style={{ color: colorAlpha("textMuted", 0.74) }}
                        >
                          Key：{attribute.key || "未设置"}
                        </p>
                      </div>
                      <span
                        className="shrink-0 rounded-full border px-2 py-0.5 text-[11px]"
                        style={{
                          borderColor: colorAlpha(
                            isActive ? "primary" : "border",
                            isActive ? 0.36 : 0.28,
                          ),
                          color: isActive
                            ? color("primary")
                            : colorAlpha("textMuted", 0.76),
                        }}
                      >
                        {isActive ? "当前" : `#${index + 1}`}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <WorldEditorDimensionMetaBadge
                        label="默认"
                        value={String(attribute.defaultValue)}
                        accent
                      />
                      <WorldEditorDimensionMetaBadge
                        label="范围"
                        value={rangeText}
                      />
                    </div>
                    <p
                      className="mt-2 text-[11px] leading-5"
                      style={{
                        color: colorAlpha("textMuted", isActive ? 0.82 : 0.72),
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                      title={attributeDescription || "当前属性尚未填写说明"}
                    >
                      {attributeDescription || "当前属性尚未填写说明"}
                    </p>
                  </button>
                );
              })}
            </div>
          </Panel>

          {activeAttribute ? (
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                ref={detailRef}
                key={`attribute-${resolvedActiveAttributeIndex}`}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.14 }}
                className="space-y-3 xl:h-full xl:min-h-0 xl:overflow-y-auto xl:pr-1"
              >
                <Panel variant="outlined" className="p-3 sm:p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <p
                        className="text-xs font-medium uppercase tracking-[0.2em]"
                        style={{ color: colorAlpha("primary", 0.82) }}
                      >
                        当前详情
                      </p>
                      <h5
                        className="mt-2 wrap-break-word text-sm font-semibold leading-6"
                        style={{ color: color("textPrimary") }}
                        title={
                          activeAttribute.label.trim() ||
                          activeAttribute.key.trim() ||
                          `未命名属性 ${resolvedActiveAttributeIndex + 1}`
                        }
                      >
                        {activeAttribute.label.trim() ||
                          activeAttribute.key.trim() ||
                          `未命名属性 ${resolvedActiveAttributeIndex + 1}`}
                      </h5>
                      <p
                        className="mt-2 text-xs leading-5"
                        style={{ color: colorAlpha("textMuted", 0.74) }}
                      >
                        {activeAttribute.description?.trim() ||
                          "当前属性尚未填写说明，可直接在下方详情中补充。"}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <WorldEditorDimensionMetaBadge
                        label="Key"
                        value={activeAttribute.key || "未设置"}
                        mono
                      />
                      <WorldEditorDimensionMetaBadge
                        label="默认"
                        value={String(activeAttribute.defaultValue)}
                        accent
                      />
                    </div>
                  </div>
                </Panel>

                <AttributeCard
                  attribute={activeAttribute}
                  labelInputRef={labelInputRef}
                  onChange={(updates) =>
                    onUpdatePrimaryAttribute(
                      resolvedActiveAttributeIndex,
                      updates,
                    )
                  }
                  onRemove={() =>
                    onRemovePrimaryAttribute(resolvedActiveAttributeIndex)
                  }
                />
              </motion.div>
            </AnimatePresence>
          ) : null}
        </div>
      ) : (
        <WorldEditorEmptySectionHint message="当前还没有主要属性，可先添加基础属性，再配置点数分配规则。" />
      )}

      <PointBuyPanel
        value={pointBuyRules}
        allocatableOptions={allocatableAttributeOptions}
        onChange={onUpdatePointBuyRules}
      />
    </WorldEditorFormSection>
  );
}

function AttributeCard({
  attribute,
  labelInputRef,
  onChange,
  onRemove,
}: {
  attribute: PrimaryAttributeConfig;
  labelInputRef?: RefObject<HTMLInputElement | null>;
  onChange: (updates: Partial<PrimaryAttributeConfig>) => void;
  onRemove: () => void;
}) {
  return (
    <WorldEditorInventoryCard variant="outlined" className="space-y-3 p-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <WorldEditorField label="Key">
          <Input
            value={attribute.key}
            onChange={(event) => onChange({ key: event.target.value })}
            placeholder="str"
          />
        </WorldEditorField>
        <WorldEditorField label="显示名">
          <Input
            ref={labelInputRef}
            value={attribute.label}
            onChange={(event) => onChange({ label: event.target.value })}
            placeholder="力量"
          />
        </WorldEditorField>
        <WorldEditorField label="默认值">
          <Input
            type="number"
            value={String(attribute.defaultValue)}
            onChange={(event) =>
              onChange({ defaultValue: Number(event.target.value) || 0 })
            }
          />
        </WorldEditorField>
        <WorldEditorField label="最小值">
          <Input
            type="number"
            value={attribute.min ?? ""}
            onChange={(event) =>
              onChange({
                min:
                  event.target.value.trim() === ""
                    ? undefined
                    : Number(event.target.value),
              })
            }
          />
        </WorldEditorField>
        <WorldEditorField label="最大值">
          <Input
            type="number"
            value={attribute.max ?? ""}
            onChange={(event) =>
              onChange({
                max:
                  event.target.value.trim() === ""
                    ? undefined
                    : Number(event.target.value),
              })
            }
          />
        </WorldEditorField>
      </div>
      <WorldEditorField label="说明">
        <Textarea
          value={attribute.description ?? ""}
          onChange={(event) => onChange({ description: event.target.value })}
          className="min-h-24"
          placeholder="描述该属性的语义和作用"
        />
      </WorldEditorField>
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={onRemove}>
          <Trash2 className="mr-1 h-4 w-4" />
          删除属性
        </Button>
      </div>
    </WorldEditorInventoryCard>
  );
}

function PointBuyPanel({
  value,
  allocatableOptions,
  onChange,
}: {
  value?: PointBuyRules;
  allocatableOptions: Array<{ value: string; label: string }>;
  onChange: (updates: Partial<PointBuyRules>) => void;
}) {
  const allocatableAttributes = value?.allocatableAttributes ?? [];

  return (
    <WorldEditorInventoryCard variant="outlined" className="space-y-4 p-4">
      <h4
        className="text-sm font-semibold"
        style={{ color: color("textPrimary") }}
      >
        点数分配规则
      </h4>
      <div className="grid gap-3 md:grid-cols-3">
        <WorldEditorField label="额外可分配点数">
          <Input
            type="number"
            value={value?.bonusPoints ?? 10}
            onChange={(event) =>
              onChange({ bonusPoints: Number(event.target.value) || 0 })
            }
          />
        </WorldEditorField>
        <WorldEditorField label="单属性最小值">
          <Input
            type="number"
            value={value?.minPerAttribute ?? ""}
            onChange={(event) =>
              onChange({
                minPerAttribute:
                  event.target.value.trim() === ""
                    ? undefined
                    : Number(event.target.value),
              })
            }
          />
        </WorldEditorField>
        <WorldEditorField label="单属性最大值">
          <Input
            type="number"
            value={value?.maxPerAttribute ?? ""}
            onChange={(event) =>
              onChange({
                maxPerAttribute:
                  event.target.value.trim() === ""
                    ? undefined
                    : Number(event.target.value),
              })
            }
          />
        </WorldEditorField>
      </div>

      <div>
        <span
          className="text-xs font-medium"
          style={{ color: color("textSecondary") }}
        >
          可分配属性
        </span>
        <div className="mt-2 flex flex-wrap gap-2">
          {allocatableOptions.map((option) => {
            const selected = allocatableAttributes.includes(option.value);
            return (
              <button
                key={option.value}
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
                  const next = selected
                    ? allocatableAttributes.filter(
                        (item) => item !== option.value,
                      )
                    : [...allocatableAttributes, option.value];
                  onChange({ allocatableAttributes: next });
                }}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>
    </WorldEditorInventoryCard>
  );
}
