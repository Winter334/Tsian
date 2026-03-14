import { AnimatePresence, motion } from "framer-motion";
import { Plus, Trash2 } from "lucide-react";
import { useMemo, type RefObject } from "react";

import { Button, Input, Panel, Select, Textarea } from "@/components/ui";
import type { PassiveModifier } from "@/domain/types/rule-script";
import type { ConditionConfig } from "@/lib/world/types";
import { color, colorAlpha } from "@/styles/tokens";

import {
  WorldEditorDimensionMetaBadge,
  WorldEditorEmptySectionHint,
  WorldEditorField,
  WorldEditorFormSection,
  WorldEditorInventoryCard,
  WorldEditorSectionRulesEditorButton,
  WorldEditorToggleSetting,
} from "./WorldEditorPaneInventorySectionShared";
import {
  MASTER_DETAIL_LIST_CONTENT_CLASS,
  MASTER_DETAIL_LIST_PANEL_CLASS,
} from "./WorldEditorPaneInventorySectionShared.helpers";
import { NumericFieldListEditor } from "./WorldEditorPaneRuleSectionShared";
import {
  buildNumericFieldRecord,
  type NumericFieldEntry,
} from "./WorldEditorPaneRuleSectionShared.helpers";

const CONDITION_TRIGGER_MODE_OPTIONS = [
  { value: "ai", label: "AI 管理" },
  { value: "turn_start", label: "回合开始自动触发" },
  { value: "on_damage", label: "受伤时触发" },
  { value: "passive", label: "被动触发" },
] as const;

const EMPTY_PASSIVE_MODIFIERS: PassiveModifier[] = [];

type ConditionTriggerMode =
  | "ai"
  | NonNullable<ConditionConfig["trigger"]>["timing"];

interface WorldEditorPaneConditionsSectionProps {
  conditions: readonly ConditionConfig[];
  statFieldOptions: Array<{ value: string; label: string }>;
  activeCondition: ConditionConfig | null;
  resolvedActiveConditionIndex: number;
  rulesEditorActive: boolean;
  rulesEditorTitle: string;
  detailRef: RefObject<HTMLDivElement | null>;
  nameInputRef: RefObject<HTMLInputElement | null>;
  onOpenRulesEditor: () => void;
  onSetActiveConditionIndex: (index: number) => void;
  onAddCondition: () => void;
  onUpdateCondition: (index: number, updates: Partial<ConditionConfig>) => void;
  onRemoveCondition: (index: number) => void;
}

export function WorldEditorPaneConditionsSection({
  conditions,
  statFieldOptions,
  activeCondition,
  resolvedActiveConditionIndex,
  rulesEditorActive,
  rulesEditorTitle,
  detailRef,
  nameInputRef,
  onOpenRulesEditor,
  onSetActiveConditionIndex,
  onAddCondition,
  onUpdateCondition,
  onRemoveCondition,
}: WorldEditorPaneConditionsSectionProps) {
  return (
    <WorldEditorFormSection
      title="状态"
      description="当前阶段只结构化基础层：显示名、说明、持续时间、基础触发模式、基础分类与是否可叠加；低风险 passive 属性修正已可结构化编辑，其余复杂 actions / modifiers / 脚本继续走 JSON 兜底。"
      action={
        <div className="flex flex-wrap gap-2">
          <WorldEditorSectionRulesEditorButton
            active={rulesEditorActive}
            title={rulesEditorTitle}
            onOpen={onOpenRulesEditor}
          />
          <Button variant="outline" size="sm" onClick={onAddCondition}>
            <Plus className="mr-1 h-4 w-4" />
            添加状态
          </Button>
        </div>
      }
    >
      {conditions.length > 0 ? (
        <div className="grid gap-3 xl:h-168 xl:grid-cols-[minmax(260px,320px)_minmax(0,1fr)] 2xl:grid-cols-[minmax(280px,360px)_minmax(0,1fr)]">
          <Panel variant="outlined" className={MASTER_DETAIL_LIST_PANEL_CLASS}>
            <div
              className={MASTER_DETAIL_LIST_CONTENT_CLASS}
              role="tablist"
              aria-label="状态切换"
            >
              {conditions.map((condition, index) => {
                const isActive = resolvedActiveConditionIndex === index;
                const conditionTitle =
                  condition.name.trim() ||
                  condition.id.trim() ||
                  `未命名状态 ${index + 1}`;
                const descriptionText = condition.description?.trim() ?? "";
                const triggerMode = getConditionTriggerMode(condition);
                const triggerLabel =
                  CONDITION_TRIGGER_MODE_OPTIONS.find(
                    (option) => option.value === triggerMode,
                  )?.label ?? "AI 管理";

                return (
                  <button
                    key={`${condition.id || "condition"}-${index}`}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => onSetActiveConditionIndex(index)}
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
                          title={conditionTitle}
                        >
                          {conditionTitle}
                        </p>
                        <p
                          className="mt-1 text-[11px]"
                          style={{ color: colorAlpha("textMuted", 0.74) }}
                        >
                          ID：{condition.id || "未设置"}
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
                        label="触发"
                        value={triggerLabel}
                        accent={triggerMode !== "ai"}
                      />
                      <WorldEditorDimensionMetaBadge
                        label="持续"
                        value={
                          condition.duration !== undefined
                            ? `${condition.duration} 回合`
                            : "未设置"
                        }
                      />
                      <WorldEditorDimensionMetaBadge
                        label="叠加"
                        value={condition.stackable ? "可叠加" : "不可叠加"}
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
                      title={descriptionText || "当前状态尚未填写说明"}
                    >
                      {descriptionText || "当前状态尚未填写说明"}
                    </p>
                  </button>
                );
              })}
            </div>
          </Panel>

          {activeCondition ? (
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                ref={detailRef}
                key={`condition-${resolvedActiveConditionIndex}`}
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
                          activeCondition.name.trim() ||
                          activeCondition.id.trim() ||
                          `未命名状态 ${resolvedActiveConditionIndex + 1}`
                        }
                      >
                        {activeCondition.name.trim() ||
                          activeCondition.id.trim() ||
                          `未命名状态 ${resolvedActiveConditionIndex + 1}`}
                      </h5>
                      <p
                        className="mt-2 text-xs leading-5"
                        style={{ color: colorAlpha("textMuted", 0.74) }}
                      >
                        {activeCondition.description?.trim() ||
                          "当前状态尚未填写说明，可直接在下方详情中补充。"}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <WorldEditorDimensionMetaBadge
                        label="ID"
                        value={activeCondition.id || "未设置"}
                        mono
                      />
                      <WorldEditorDimensionMetaBadge
                        label="触发"
                        value={
                          CONDITION_TRIGGER_MODE_OPTIONS.find(
                            (option) =>
                              option.value ===
                              getConditionTriggerMode(activeCondition),
                          )?.label ?? "AI 管理"
                        }
                        accent={
                          getConditionTriggerMode(activeCondition) !== "ai"
                        }
                      />
                    </div>
                  </div>
                </Panel>

                <ConditionCardEditor
                  condition={activeCondition}
                  statFieldOptions={statFieldOptions}
                  nameInputRef={nameInputRef}
                  onChange={(updates) =>
                    onUpdateCondition(resolvedActiveConditionIndex, updates)
                  }
                  onRemove={() =>
                    onRemoveCondition(resolvedActiveConditionIndex)
                  }
                />
              </motion.div>
            </AnimatePresence>
          ) : null}
        </div>
      ) : (
        <WorldEditorEmptySectionHint message="当前还没有预定义状态；若继续为空，运行时将只能依赖动态注入状态。" />
      )}
    </WorldEditorFormSection>
  );
}

function getConditionTriggerMode(
  condition: ConditionConfig,
): ConditionTriggerMode {
  return condition.trigger?.timing ?? "ai";
}

function buildConditionTriggerUpdate(
  condition: ConditionConfig,
  mode: ConditionTriggerMode,
): Partial<ConditionConfig> {
  if (mode === "ai") {
    return { trigger: undefined };
  }

  const currentTrigger = condition.trigger;
  return {
    trigger: {
      ...(currentTrigger ?? {}),
      timing: mode,
      ...(mode === "on_damage" ? {} : { damageFilter: undefined }),
    },
  };
}

function isStructuredPassiveStatModifier(
  modifier: PassiveModifier,
): modifier is PassiveModifier & {
  scope: "stat";
  field: string;
  value: number;
} {
  return (
    modifier.scope === "stat" &&
    typeof modifier.field === "string" &&
    modifier.field.trim().length > 0 &&
    typeof modifier.value === "number" &&
    Number.isFinite(modifier.value)
  );
}

function buildPassiveStatModifiers(
  entries: NumericFieldEntry[],
  conditionName: string,
): PassiveModifier[] {
  const readableConditionName = conditionName.trim() || "未命名状态";

  return Object.entries(buildNumericFieldRecord(entries) ?? {}).map(
    ([field, value]) => ({
      scope: "stat",
      field,
      value,
      reason: `状态「${readableConditionName}」属性修正`,
    }),
  );
}

function ConditionCardEditor({
  condition,
  statFieldOptions,
  nameInputRef,
  onChange,
  onRemove,
}: {
  condition: ConditionConfig;
  statFieldOptions: Array<{ value: string; label: string }>;
  nameInputRef?: RefObject<HTMLInputElement | null>;
  onChange: (updates: Partial<ConditionConfig>) => void;
  onRemove: () => void;
}) {
  const triggerMode = getConditionTriggerMode(condition);
  const tagsText = (condition.tags ?? []).join(", ");
  const damageFilterText =
    condition.trigger?.timing === "on_damage"
      ? (condition.trigger.damageFilter?.damageTypes ?? []).join(", ")
      : "";
  const passiveModifiers =
    condition.trigger?.modifiers ?? EMPTY_PASSIVE_MODIFIERS;
  const structuredPassiveStatModifiers = useMemo(
    () => passiveModifiers.filter(isStructuredPassiveStatModifier),
    [passiveModifiers],
  );
  const advancedPassiveModifiers = useMemo(
    () =>
      passiveModifiers.filter(
        (modifier) => !isStructuredPassiveStatModifier(modifier),
      ),
    [passiveModifiers],
  );
  const passiveStatEntries = useMemo(
    () =>
      structuredPassiveStatModifiers.map((modifier) => ({
        field: modifier.field,
        value: modifier.value,
      })),
    [structuredPassiveStatModifiers],
  );

  return (
    <WorldEditorInventoryCard variant="outlined" className="space-y-4 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p
            className="text-sm font-semibold"
            style={{ color: color("textPrimary") }}
          >
            {condition.name || "未命名状态"}
          </p>
          <p
            className="mt-1 text-xs"
            style={{ color: colorAlpha("textMuted", 0.72) }}
          >
            状态 ID：{condition.id}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onRemove}>
          <Trash2 className="mr-1 h-4 w-4" />
          删除状态
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
        <WorldEditorField label="显示名">
          <Input
            ref={nameInputRef}
            value={condition.name}
            onChange={(event) => onChange({ name: event.target.value })}
            placeholder="中毒"
          />
        </WorldEditorField>
        <WorldEditorField label="图标（可选）">
          <Input
            value={condition.icon ?? ""}
            onChange={(event) => onChange({ icon: event.target.value })}
            placeholder="skull"
          />
        </WorldEditorField>
        <WorldEditorField label="基础分类标签（逗号分隔）">
          <Input
            value={tagsText}
            onChange={(event) =>
              onChange({
                tags: event.target.value
                  .split(",")
                  .map((item) => item.trim())
                  .filter(Boolean),
              })
            }
            placeholder="debuff, poison"
          />
        </WorldEditorField>
      </div>

      <WorldEditorField label="说明">
        <Textarea
          value={condition.description ?? ""}
          onChange={(event) => onChange({ description: event.target.value })}
          className="min-h-24"
          placeholder="描述该状态对角色体验与玩法的影响"
        />
      </WorldEditorField>

      <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
        <WorldEditorField label="基础触发模式">
          <Select
            value={triggerMode}
            onValueChange={(value) =>
              onChange(
                buildConditionTriggerUpdate(
                  condition,
                  value as ConditionTriggerMode,
                ),
              )
            }
            options={CONDITION_TRIGGER_MODE_OPTIONS.map((option) => ({
              value: option.value,
              label: option.label,
            }))}
          />
        </WorldEditorField>
        <WorldEditorField label="持续回合（可选）">
          <Input
            type="number"
            value={condition.duration ?? ""}
            onChange={(event) =>
              onChange({
                duration:
                  event.target.value.trim() === ""
                    ? undefined
                    : Number(event.target.value),
              })
            }
            placeholder="3"
          />
        </WorldEditorField>
        <WorldEditorToggleSetting
          title="是否可叠加"
          description="决定同一状态被重复添加时是否允许保留叠层语义。"
          checked={condition.stackable ?? false}
          onCheckedChange={(checked) => onChange({ stackable: checked })}
        />
        <WorldEditorToggleSetting
          title="触发后自动递减持续时间"
          description="适用于系统管理触发器；关闭后，该状态不会在触发时自动消耗剩余回合。"
          checked={
            triggerMode !== "ai" && condition.trigger?.autoDecrement !== false
          }
          onCheckedChange={(checked) =>
            onChange({
              trigger:
                triggerMode === "ai"
                  ? undefined
                  : {
                      ...(condition.trigger ?? { timing: triggerMode }),
                      timing: triggerMode,
                      autoDecrement: checked,
                    },
            })
          }
        />
      </div>

      <p className="text-xs" style={{ color: colorAlpha("textMuted", 0.72) }}>
        当前模型没有单独的“隐藏/显示”字段；只要列在这里，就会作为预定义状态参与作者态与运行时引用。内部
        ID 由系统维护，无需普通作者手工管理。
      </p>

      {triggerMode === "passive" ? (
        <div className="space-y-3">
          <NumericFieldListEditor
            title="被动属性修正"
            description="只结构化最稳定的属性值加算（scope=stat）；系统会自动生成内部 reason 并清理空条目。"
            fieldLabel="目标字段"
            valueLabel="修正值"
            addLabel="添加修正"
            emptyMessage={
              statFieldOptions.length === 0
                ? "先配置主要属性或衍生属性后，再为状态添加被动修正。"
                : "当前没有被动属性修正；更复杂的检定/伤害修正仍建议使用高级 JSON。"
            }
            fieldOptions={statFieldOptions}
            entries={passiveStatEntries}
            onChange={(entries) => {
              const structuredModifiers = buildPassiveStatModifiers(
                entries,
                condition.name,
              );
              const nextModifiers = [
                ...advancedPassiveModifiers,
                ...structuredModifiers,
              ];
              onChange({
                trigger: {
                  ...(condition.trigger ?? { timing: "passive" }),
                  timing: "passive",
                  modifiers:
                    nextModifiers.length > 0 ? nextModifiers : undefined,
                },
              });
            }}
          />

          {advancedPassiveModifiers.length > 0 ? (
            <p
              className="text-xs"
              style={{ color: colorAlpha("textMuted", 0.72) }}
            >
              当前还有 {advancedPassiveModifiers.length}
              条复杂被动修正保留在高级 JSON 中，结构化面板不会覆盖它们。
            </p>
          ) : null}
        </div>
      ) : null}

      {triggerMode === "on_damage" ? (
        <WorldEditorField label="伤害类型过滤（逗号分隔，可选）">
          <Input
            value={damageFilterText}
            onChange={(event) =>
              onChange({
                trigger: {
                  ...(condition.trigger ?? { timing: "on_damage" }),
                  timing: "on_damage",
                  ...(event.target.value.trim().length > 0
                    ? {
                        damageFilter: {
                          damageTypes: event.target.value
                            .split(",")
                            .map((item) => item.trim())
                            .filter(Boolean),
                        },
                      }
                    : { damageFilter: undefined }),
                },
              })
            }
            placeholder="fire, poison"
          />
        </WorldEditorField>
      ) : null}

      <details
        className="rounded-xl border px-4 py-3"
        style={{
          borderColor: colorAlpha("border", 0.3),
          background: colorAlpha("bgCard", 0.22),
        }}
      >
        <summary
          className="cursor-pointer text-sm font-medium"
          style={{ color: color("textPrimary") }}
        >
          高级 JSON 仍可继续补充的内容
        </summary>
        <div
          className="mt-3 space-y-2 text-xs"
          style={{ color: colorAlpha("textMuted", 0.72) }}
        >
          <p>• turn_start / on_damage 的具体 actions</p>
          <p>• check / damage_* / 表达式型 passive modifiers</p>
          <p>• 更复杂的 damageFilter 与规则脚本细节</p>
        </div>
      </details>
    </WorldEditorInventoryCard>
  );
}
