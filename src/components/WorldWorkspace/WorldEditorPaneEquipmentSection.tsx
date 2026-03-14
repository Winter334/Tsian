import { AnimatePresence, motion } from "framer-motion";
import { Plus, Trash2 } from "lucide-react";
import type { RefObject } from "react";

import { Button, Input, Panel } from "@/components/ui";
import type { ItemCategory } from "@/domain/entities/item";
import type { EquipSlotDefinition } from "@/lib/world/types";
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
  ITEM_CATEGORY_OPTIONS,
  MASTER_DETAIL_LIST_CONTENT_CLASS,
  MASTER_DETAIL_LIST_PANEL_CLASS,
  getItemCategoryListLabel,
} from "./WorldEditorPaneInventorySectionShared.helpers";

interface WorldEditorPaneEquipmentSectionProps {
  defaultCapacity?: number;
  equipSlotDefinitions: readonly EquipSlotDefinition[];
  activeEquipSlot: EquipSlotDefinition | null;
  resolvedActiveEquipSlotIndex: number;
  rulesEditorActive: boolean;
  rulesEditorTitle: string;
  detailRef: RefObject<HTMLDivElement | null>;
  idInputRef: RefObject<HTMLInputElement | null>;
  onOpenRulesEditor: () => void;
  onSetActiveEquipSlotIndex: (index: number) => void;
  onUpdateDefaultCapacity: (value: number | undefined) => void;
  onAddEquipSlot: () => void;
  onUpdateEquipSlot: (
    index: number,
    updates: Partial<EquipSlotDefinition>,
  ) => void;
  onRemoveEquipSlot: (index: number) => void;
}

export function WorldEditorPaneEquipmentSection({
  defaultCapacity,
  equipSlotDefinitions,
  activeEquipSlot,
  resolvedActiveEquipSlotIndex,
  rulesEditorActive,
  rulesEditorTitle,
  detailRef,
  idInputRef,
  onOpenRulesEditor,
  onSetActiveEquipSlotIndex,
  onUpdateDefaultCapacity,
  onAddEquipSlot,
  onUpdateEquipSlot,
  onRemoveEquipSlot,
}: WorldEditorPaneEquipmentSectionProps) {
  return (
    <WorldEditorFormSection
      title="装备系统"
      description="配置默认背包容量与装备槽位定义；物品模板的装备槽位下拉会实时读取这里的配置。"
      action={
        <div className="flex flex-wrap gap-2">
          <WorldEditorSectionRulesEditorButton
            active={rulesEditorActive}
            title={rulesEditorTitle}
            onOpen={onOpenRulesEditor}
          />
          <Button variant="outline" size="sm" onClick={onAddEquipSlot}>
            <Plus className="mr-1 h-4 w-4" />
            添加槽位
          </Button>
        </div>
      }
    >
      <div className="grid gap-3 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)]">
        <WorldEditorField label="默认背包容量">
          <Input
            type="number"
            value={defaultCapacity ?? ""}
            onChange={(event) =>
              onUpdateDefaultCapacity(
                event.target.value.trim() === ""
                  ? undefined
                  : Number(event.target.value),
              )
            }
            placeholder="20"
          />
        </WorldEditorField>
        <WorldEditorInventoryCard variant="outlined" className="p-4">
          <p
            className="text-sm font-medium"
            style={{ color: color("textPrimary") }}
          >
            槽位 ID 与物品模板联动
          </p>
          <p
            className="mt-1 text-xs leading-5"
            style={{ color: colorAlpha("textMuted", 0.72) }}
          >
            物品模板中的 `equipSlot` 会直接引用这里的槽位 ID。修改既有槽位 ID
            后，旧模板不会自动迁移，请谨慎操作。
          </p>
        </WorldEditorInventoryCard>
      </div>

      {equipSlotDefinitions.length > 0 ? (
        <div className="grid gap-3 xl:h-168 xl:grid-cols-[minmax(260px,320px)_minmax(0,1fr)] 2xl:grid-cols-[minmax(280px,360px)_minmax(0,1fr)]">
          <Panel variant="outlined" className={MASTER_DETAIL_LIST_PANEL_CLASS}>
            <div
              className={MASTER_DETAIL_LIST_CONTENT_CLASS}
              role="tablist"
              aria-label="装备槽位切换"
            >
              {equipSlotDefinitions.map((slotDefinition, index) => (
                <EquipSlotListItemButton
                  key={`${slotDefinition.id || "equip-slot"}-${index}`}
                  slotDefinition={slotDefinition}
                  index={index}
                  active={resolvedActiveEquipSlotIndex === index}
                  onClick={() => onSetActiveEquipSlotIndex(index)}
                />
              ))}
            </div>
          </Panel>

          {activeEquipSlot ? (
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                ref={detailRef}
                key={`equip-slot-${resolvedActiveEquipSlotIndex}`}
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
                          activeEquipSlot.label.trim() ||
                          activeEquipSlot.id.trim() ||
                          `未命名槽位 ${resolvedActiveEquipSlotIndex + 1}`
                        }
                      >
                        {activeEquipSlot.label.trim() ||
                          activeEquipSlot.id.trim() ||
                          `未命名槽位 ${resolvedActiveEquipSlotIndex + 1}`}
                      </h5>
                      <p
                        className="mt-2 text-xs leading-5"
                        style={{ color: colorAlpha("textMuted", 0.74) }}
                      >
                        {activeEquipSlot.allowedCategories?.length
                          ? `当前限制：${getItemCategoryListLabel(activeEquipSlot.allowedCategories)}`
                          : "当前未限制装备类别，所有物品分类都可声明默认槽位。"}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <WorldEditorDimensionMetaBadge
                        label="ID"
                        value={activeEquipSlot.id || "未设置"}
                        mono
                      />
                      <WorldEditorDimensionMetaBadge
                        label="同槽位上限"
                        value={String(activeEquipSlot.maxCount ?? 1)}
                        accent={(activeEquipSlot.maxCount ?? 1) > 1}
                      />
                    </div>
                  </div>
                </Panel>

                <EquipSlotCardEditor
                  slotDefinition={activeEquipSlot}
                  idInputRef={idInputRef}
                  onChange={(updates) =>
                    onUpdateEquipSlot(resolvedActiveEquipSlotIndex, updates)
                  }
                  onRemove={() =>
                    onRemoveEquipSlot(resolvedActiveEquipSlotIndex)
                  }
                />
              </motion.div>
            </AnimatePresence>
          ) : null}
        </div>
      ) : (
        <WorldEditorEmptySectionHint message="当前还没有装备槽位；添加后，物品模板中的装备槽位下拉会立即同步。" />
      )}
    </WorldEditorFormSection>
  );
}

function EquipSlotListItemButton({
  slotDefinition,
  index,
  active,
  onClick,
}: {
  slotDefinition: EquipSlotDefinition;
  index: number;
  active: boolean;
  onClick: () => void;
}) {
  const slotTitle =
    slotDefinition.label.trim() ||
    slotDefinition.id.trim() ||
    `未命名槽位 ${index + 1}`;

  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className="w-full rounded-xl border px-3 py-3 text-left transition-all duration-150"
      style={{
        borderColor: colorAlpha(
          active ? "primary" : "border",
          active ? 0.42 : 0.28,
        ),
        background: colorAlpha(
          active ? "primary" : "bgCard",
          active ? 0.12 : 0.16,
        ),
        boxShadow: active ? `0 0 18px ${colorAlpha("primary", 0.12)}` : "none",
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p
            className="wrap-break-word text-sm font-medium leading-5"
            style={{
              color: active ? color("primary") : color("textPrimary"),
            }}
            title={slotTitle}
          >
            {slotTitle}
          </p>
          <p
            className="mt-1 text-[11px]"
            style={{ color: colorAlpha("textMuted", 0.74) }}
          >
            ID：{slotDefinition.id || "未设置"}
          </p>
        </div>
        <span
          className="shrink-0 rounded-full border px-2 py-0.5 text-[11px]"
          style={{
            borderColor: colorAlpha(
              active ? "primary" : "border",
              active ? 0.36 : 0.28,
            ),
            color: active ? color("primary") : colorAlpha("textMuted", 0.76),
          }}
        >
          {active ? "当前" : `#${index + 1}`}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <WorldEditorDimensionMetaBadge
          label="允许类别"
          value={getItemCategoryListLabel(slotDefinition.allowedCategories)}
          accent={(slotDefinition.allowedCategories?.length ?? 0) > 0}
        />
        <WorldEditorDimensionMetaBadge
          label="同槽位上限"
          value={String(slotDefinition.maxCount ?? 1)}
          accent={(slotDefinition.maxCount ?? 1) > 1}
        />
      </div>
    </button>
  );
}

function EquipSlotCardEditor({
  slotDefinition,
  idInputRef,
  onChange,
  onRemove,
}: {
  slotDefinition: EquipSlotDefinition;
  idInputRef?: RefObject<HTMLInputElement | null>;
  onChange: (updates: Partial<EquipSlotDefinition>) => void;
  onRemove: () => void;
}) {
  return (
    <WorldEditorInventoryCard variant="outlined" className="space-y-4 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p
            className="text-sm font-semibold"
            style={{ color: color("textPrimary") }}
          >
            {slotDefinition.label || "未命名槽位"}
          </p>
          <p
            className="mt-1 text-xs"
            style={{ color: colorAlpha("textMuted", 0.72) }}
          >
            建议使用 snake_case，例如 `main_hand` / `accessory_1`
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onRemove}>
          <Trash2 className="mr-1 h-4 w-4" />
          删除槽位
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <WorldEditorField label="槽位 ID（谨慎修改）">
          <Input
            ref={idInputRef}
            value={slotDefinition.id}
            onChange={(event) => onChange({ id: event.target.value })}
            placeholder="main_hand"
          />
        </WorldEditorField>
        <WorldEditorField label="显示名称">
          <Input
            value={slotDefinition.label}
            onChange={(event) => onChange({ label: event.target.value })}
            placeholder="主手"
          />
        </WorldEditorField>
      </div>

      <WorldEditorField label="允许物品类别">
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {ITEM_CATEGORY_OPTIONS.map((option) => {
              const category = option.value as ItemCategory;
              const selected =
                slotDefinition.allowedCategories?.includes(category) ?? false;

              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => {
                    const currentCategories =
                      slotDefinition.allowedCategories ?? [];
                    const nextCategories = selected
                      ? currentCategories.filter((item) => item !== category)
                      : [...currentCategories, category];
                    onChange({
                      allowedCategories:
                        nextCategories.length > 0 ? nextCategories : undefined,
                    });
                  }}
                  className="rounded-full border px-3 py-1.5 text-xs font-medium transition-all"
                  style={{
                    color: selected ? color("primary") : color("textSecondary"),
                    background: selected
                      ? colorAlpha("primary", 0.12)
                      : colorAlpha("bgCard", 0.24),
                    borderColor: colorAlpha(
                      selected ? "primary" : "border",
                      selected ? 0.42 : 0.28,
                    ),
                    boxShadow: selected
                      ? `0 0 16px ${colorAlpha("primary", 0.12)}`
                      : "none",
                  }}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
          <p
            className="text-xs leading-5"
            style={{ color: colorAlpha("textMuted", 0.72) }}
          >
            不选择任何类别时，表示该槽位不限制可装备的物品分类。
          </p>
        </div>
      </WorldEditorField>

      <WorldEditorField label="同槽位最大数量">
        <div className="space-y-2">
          <Input
            type="number"
            value={slotDefinition.maxCount ?? ""}
            onChange={(event) =>
              onChange({
                maxCount:
                  event.target.value.trim() === ""
                    ? undefined
                    : Number(event.target.value),
              })
            }
            placeholder="1"
          />
          <p
            className="text-xs leading-5"
            style={{ color: colorAlpha("textMuted", 0.72) }}
          >
            留空时按默认值 1 处理；适合双饰品、芯片槽等一格多件的世界设定。
          </p>
        </div>
      </WorldEditorField>
    </WorldEditorInventoryCard>
  );
}
