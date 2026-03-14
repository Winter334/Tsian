import { AnimatePresence, motion } from "framer-motion";
import { Plus, Trash2 } from "lucide-react";
import type { RefObject } from "react";

import { Button, Input, Panel, Select } from "@/components/ui";
import type { DerivedStatConfig } from "@/lib/world/types";
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

const DERIVED_STAT_CATEGORY_OPTIONS = [
  { value: "", label: "未分类" },
  { value: "resource", label: "资源" },
  { value: "combat", label: "战斗" },
  { value: "defense", label: "防御" },
  { value: "misc", label: "其他" },
] as const;

interface WorldEditorPaneDerivedStatsSectionProps {
  derivedStats: readonly DerivedStatConfig[];
  statFieldOptions: Array<{ value: string; label: string }>;
  activeDerivedStat: DerivedStatConfig | null;
  resolvedActiveDerivedStatIndex: number;
  rulesEditorActive: boolean;
  rulesEditorTitle: string;
  detailRef: RefObject<HTMLDivElement | null>;
  labelInputRef: RefObject<HTMLInputElement | null>;
  onOpenRulesEditor: () => void;
  onSetActiveDerivedStatIndex: (index: number) => void;
  onAddDerivedStat: () => void;
  onUpdateDerivedStat: (
    index: number,
    updates: Partial<DerivedStatConfig>,
  ) => void;
  onRemoveDerivedStat: (index: number) => void;
}

export function WorldEditorPaneDerivedStatsSection({
  derivedStats,
  statFieldOptions,
  activeDerivedStat,
  resolvedActiveDerivedStatIndex,
  rulesEditorActive,
  rulesEditorTitle,
  detailRef,
  labelInputRef,
  onOpenRulesEditor,
  onSetActiveDerivedStatIndex,
  onAddDerivedStat,
  onUpdateDerivedStat,
  onRemoveDerivedStat,
}: WorldEditorPaneDerivedStatsSectionProps) {
  return (
    <WorldEditorFormSection
      title="衍生属性"
      description="面向作者态编辑公式、边界、显示开关与资源字段，不改运行时消费边界。"
      action={
        <div className="flex flex-wrap gap-2">
          <WorldEditorSectionRulesEditorButton
            active={rulesEditorActive}
            title={rulesEditorTitle}
            onOpen={onOpenRulesEditor}
          />
          <Button variant="outline" size="sm" onClick={onAddDerivedStat}>
            <Plus className="mr-1 h-4 w-4" />
            添加衍生属性
          </Button>
        </div>
      }
    >
      {derivedStats.length > 0 ? (
        <div className="grid gap-3 xl:h-168 xl:grid-cols-[minmax(260px,320px)_minmax(0,1fr)] 2xl:grid-cols-[minmax(280px,360px)_minmax(0,1fr)]">
          <Panel variant="outlined" className={MASTER_DETAIL_LIST_PANEL_CLASS}>
            <div
              className={MASTER_DETAIL_LIST_CONTENT_CLASS}
              role="tablist"
              aria-label="衍生属性切换"
            >
              {derivedStats.map((stat, index) => {
                const isActive = resolvedActiveDerivedStatIndex === index;
                const statTitle =
                  stat.label.trim() ||
                  stat.key.trim() ||
                  `未命名衍生属性 ${index + 1}`;
                const categoryText = stat.category ?? "未分类";
                const maxFieldText = stat.maxField?.trim() || "未绑定";

                return (
                  <button
                    key={`${stat.key || "derived-stat"}-${index}`}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => onSetActiveDerivedStatIndex(index)}
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
                          title={statTitle}
                        >
                          {statTitle}
                        </p>
                        <p
                          className="mt-1 text-[11px]"
                          style={{ color: colorAlpha("textMuted", 0.74) }}
                        >
                          Key：{stat.key || "未设置"}
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
                        label="分类"
                        value={categoryText}
                      />
                      <WorldEditorDimensionMetaBadge
                        label="资源"
                        value={stat.isResource ? "是" : "否"}
                        accent={stat.isResource ?? false}
                      />
                      <WorldEditorDimensionMetaBadge
                        label="上限字段"
                        value={maxFieldText}
                      />
                    </div>
                    <p
                      className="mt-2 text-[11px] leading-5"
                      style={{
                        color: colorAlpha(
                          "textMuted",
                          isActive ? 0.82 : 0.72,
                        ),
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                      title={stat.formula || "当前衍生属性尚未填写公式"}
                    >
                      {stat.formula || "当前衍生属性尚未填写公式"}
                    </p>
                  </button>
                );
              })}
            </div>
          </Panel>

          {activeDerivedStat ? (
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                ref={detailRef}
                key={`derived-stat-${resolvedActiveDerivedStatIndex}`}
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
                          activeDerivedStat.label.trim() ||
                          activeDerivedStat.key.trim() ||
                          `未命名衍生属性 ${resolvedActiveDerivedStatIndex + 1}`
                        }
                      >
                        {activeDerivedStat.label.trim() ||
                          activeDerivedStat.key.trim() ||
                          `未命名衍生属性 ${resolvedActiveDerivedStatIndex + 1}`}
                      </h5>
                      <p
                        className="mt-2 text-xs leading-5"
                        style={{ color: colorAlpha("textMuted", 0.74) }}
                      >
                        {activeDerivedStat.formula ||
                          "当前衍生属性尚未填写公式，可直接在下方详情中补充。"}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <WorldEditorDimensionMetaBadge
                        label="Key"
                        value={activeDerivedStat.key || "未设置"}
                        mono
                      />
                      <WorldEditorDimensionMetaBadge
                        label="资源"
                        value={activeDerivedStat.isResource ? "是" : "否"}
                        accent={activeDerivedStat.isResource ?? false}
                      />
                    </div>
                  </div>
                </Panel>

                <DerivedStatCardEditor
                  stat={activeDerivedStat}
                  statFieldOptions={statFieldOptions}
                  labelInputRef={labelInputRef}
                  onChange={(updates) =>
                    onUpdateDerivedStat(resolvedActiveDerivedStatIndex, updates)
                  }
                  onRemove={() =>
                    onRemoveDerivedStat(resolvedActiveDerivedStatIndex)
                  }
                />
              </motion.div>
            </AnimatePresence>
          ) : null}
        </div>
      ) : (
        <WorldEditorEmptySectionHint message="当前还没有衍生属性。可先补充资源字段、修正值或防御类公式。" />
      )}
    </WorldEditorFormSection>
  );
}

function DerivedStatCardEditor({
  stat,
  statFieldOptions,
  labelInputRef,
  onChange,
  onRemove,
}: {
  stat: DerivedStatConfig;
  statFieldOptions: Array<{ value: string; label: string }>;
  labelInputRef?: RefObject<HTMLInputElement | null>;
  onChange: (updates: Partial<DerivedStatConfig>) => void;
  onRemove: () => void;
}) {
  const isResource = stat.isResource ?? false;
  const availableMaxFieldOptions = statFieldOptions.filter(
    (option) => option.value !== stat.key,
  );

  return (
    <WorldEditorInventoryCard variant="outlined" className="space-y-4 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p
            className="text-sm font-semibold"
            style={{ color: color("textPrimary") }}
          >
            {stat.label || "未命名衍生属性"}
          </p>
          <p
            className="mt-1 text-xs"
            style={{ color: colorAlpha("textMuted", 0.72) }}
          >
            公式可引用主要属性、level 与其他衍生属性；当前 key：{stat.key}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onRemove}>
          <Trash2 className="mr-1 h-4 w-4" />
          删除衍生属性
        </Button>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <WorldEditorField label="显示名">
          <Input
            ref={labelInputRef}
            value={stat.label}
            onChange={(event) => onChange({ label: event.target.value })}
            placeholder="生命值"
          />
        </WorldEditorField>
        <WorldEditorField label="公式">
          <Input
            value={stat.formula}
            onChange={(event) => onChange({ formula: event.target.value })}
            placeholder="max_hp"
          />
        </WorldEditorField>
      </div>

      <p className="text-xs" style={{ color: colorAlpha("textMuted", 0.72) }}>
        描述语义当前由显示名承载；若需要更复杂说明，可继续使用当前分区 JSON
        高级编辑。
      </p>

      <div className="grid gap-3 md:grid-cols-3">
        <WorldEditorField label="最小值（可选）">
          <Input
            type="number"
            value={stat.min ?? ""}
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
        <WorldEditorField label="最大值（可选）">
          <Input
            type="number"
            value={stat.max ?? ""}
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
        <WorldEditorField label="展示分组（可选）">
          <Select
            value={stat.category ?? ""}
            onValueChange={(value) =>
              onChange({
                category:
                  value === ""
                    ? undefined
                    : (value as DerivedStatConfig["category"]),
              })
            }
            options={DERIVED_STAT_CATEGORY_OPTIONS.map((option) => ({
              value: option.value,
              label: option.label,
            }))}
          />
        </WorldEditorField>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <WorldEditorToggleSetting
          title="在 UI 中显示"
          description="控制该字段是否作为可见属性参与作者态/角色面板展示。"
          checked={stat.showInUI ?? false}
          onCheckedChange={(checked) => onChange({ showInUI: checked })}
        />
        <WorldEditorToggleSetting
          title="作为资源字段"
          description="启用后，该字段按资源 current 语义工作，可绑定上限字段。"
          checked={isResource}
          onCheckedChange={(checked) =>
            onChange({
              isResource: checked,
              ...(checked ? {} : { maxField: undefined }),
            })
          }
        />
      </div>

      <WorldEditorField label="上限字段（仅资源字段需要）">
        <Select
          value={isResource ? (stat.maxField ?? "") : ""}
          onValueChange={(value) =>
            onChange({ maxField: value === "" ? undefined : value })
          }
          disabled={!isResource}
          options={[
            {
              value: "",
              label: isResource ? "选择上限字段" : "先开启资源字段",
            },
            ...availableMaxFieldOptions,
          ]}
        />
      </WorldEditorField>

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
          高级字段
        </summary>
        <div className="mt-3 space-y-3">
          <WorldEditorField label="内部 Key">
            <Input
              value={stat.key}
              onChange={(event) => onChange({ key: event.target.value })}
              placeholder="hp"
            />
          </WorldEditorField>
          <p
            className="text-xs"
            style={{ color: colorAlpha("textMuted", 0.72) }}
          >
            key / id 主要用于公式引用与运行时接线，系统会自动补齐默认值；普通作者无需频繁手工维护。
          </p>
        </div>
      </details>
    </WorldEditorInventoryCard>
  );
}
