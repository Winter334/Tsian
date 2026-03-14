import { AnimatePresence, motion } from "framer-motion";
import { Plus, Trash2 } from "lucide-react";
import { useMemo, type RefObject } from "react";

import { Button, Input, Panel, Select, Textarea } from "@/components/ui";
import type { ItemTemplate } from "@/domain/entities/item";
import type { EquipSlotDefinition } from "@/lib/world/types";
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
  buildManagedTemplateNameUpdate,
  getEquipSlotLabel,
  getItemCategoryLabel,
  isEquippableItemCategory,
  ITEM_CATEGORY_OPTIONS,
  MASTER_DETAIL_LIST_CONTENT_CLASS,
  MASTER_DETAIL_LIST_PANEL_CLASS,
  resolveDisplayManagedTemplateId,
} from "./WorldEditorPaneInventorySectionShared.helpers";

interface WorldEditorPaneItemTemplatesSectionProps {
  itemTemplates: readonly ItemTemplate[];
  equipSlotDefinitions: readonly EquipSlotDefinition[];
  activeItemTemplate: ItemTemplate | null;
  resolvedActiveItemTemplateIndex: number;
  rulesEditorActive: boolean;
  rulesEditorTitle: string;
  detailRef: RefObject<HTMLDivElement | null>;
  nameInputRef: RefObject<HTMLInputElement | null>;
  onOpenRulesEditor: () => void;
  onSetActiveItemTemplateIndex: (index: number) => void;
  onAddItemTemplate: () => void;
  onUpdateItemTemplate: (index: number, updates: Partial<ItemTemplate>) => void;
  onRemoveItemTemplate: (index: number) => void;
}

export function WorldEditorPaneItemTemplatesSection({
  itemTemplates,
  equipSlotDefinitions,
  activeItemTemplate,
  resolvedActiveItemTemplateIndex,
  rulesEditorActive,
  rulesEditorTitle,
  detailRef,
  nameInputRef,
  onOpenRulesEditor,
  onSetActiveItemTemplateIndex,
  onAddItemTemplate,
  onUpdateItemTemplate,
  onRemoveItemTemplate,
}: WorldEditorPaneItemTemplatesSectionProps) {
  return (
    <WorldEditorFormSection
      title="物品模板"
      description="维护物品模板的基础属性、分类、堆叠规则与装备槽位；effects 等复杂效果继续通过高级规则 JSON 兜底。"
      action={
        <div className="flex flex-wrap gap-2">
          <WorldEditorSectionRulesEditorButton
            active={rulesEditorActive}
            title={rulesEditorTitle}
            onOpen={onOpenRulesEditor}
          />
          <Button variant="outline" size="sm" onClick={onAddItemTemplate}>
            <Plus className="mr-1 h-4 w-4" />
            添加物品模板
          </Button>
        </div>
      }
    >
      {itemTemplates.length > 0 ? (
        <div className="grid gap-3 xl:h-168 xl:grid-cols-[minmax(260px,320px)_minmax(0,1fr)] 2xl:grid-cols-[minmax(280px,360px)_minmax(0,1fr)]">
          <Panel variant="outlined" className={MASTER_DETAIL_LIST_PANEL_CLASS}>
            <div
              className={MASTER_DETAIL_LIST_CONTENT_CLASS}
              role="tablist"
              aria-label="物品模板切换"
            >
              {itemTemplates.map((itemTemplate, index) => (
                <ItemTemplateListItemButton
                  key={`${itemTemplate.id || "item-template"}-${index}`}
                  itemTemplate={itemTemplate}
                  index={index}
                  active={resolvedActiveItemTemplateIndex === index}
                  equipSlotDefinitions={equipSlotDefinitions}
                  onClick={() => onSetActiveItemTemplateIndex(index)}
                />
              ))}
            </div>
          </Panel>

          {activeItemTemplate ? (
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                ref={detailRef}
                key={`item-template-${resolvedActiveItemTemplateIndex}`}
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
                          activeItemTemplate.name.trim() ||
                          activeItemTemplate.id.trim() ||
                          `未命名物品 ${resolvedActiveItemTemplateIndex + 1}`
                        }
                      >
                        {activeItemTemplate.name.trim() ||
                          activeItemTemplate.id.trim() ||
                          `未命名物品 ${resolvedActiveItemTemplateIndex + 1}`}
                      </h5>
                      <p
                        className="mt-2 text-xs leading-5"
                        style={{ color: colorAlpha("textMuted", 0.74) }}
                      >
                        {activeItemTemplate.description ||
                          "当前物品模板尚未填写描述，可直接在下方详情中补充。"}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <WorldEditorDimensionMetaBadge
                        label="ID"
                        value={activeItemTemplate.id || "未设置"}
                        mono
                      />
                      <WorldEditorDimensionMetaBadge
                        label="分类"
                        value={getItemCategoryLabel(
                          activeItemTemplate.category,
                        )}
                      />
                    </div>
                  </div>
                </Panel>

                <ItemTemplateCardEditor
                  itemTemplate={activeItemTemplate}
                  equipSlotDefinitions={equipSlotDefinitions}
                  nameInputRef={nameInputRef}
                  onChange={(updates) =>
                    onUpdateItemTemplate(
                      resolvedActiveItemTemplateIndex,
                      updates,
                    )
                  }
                  onRemove={() =>
                    onRemoveItemTemplate(resolvedActiveItemTemplateIndex)
                  }
                />
              </motion.div>
            </AnimatePresence>
          ) : null}
        </div>
      ) : (
        <WorldEditorEmptySectionHint message="当前还没有物品模板；若继续为空，创作者只能通过全量 JSON 维护物品预设。" />
      )}
    </WorldEditorFormSection>
  );
}

function ItemTemplateListItemButton({
  itemTemplate,
  index,
  active,
  equipSlotDefinitions,
  onClick,
}: {
  itemTemplate: ItemTemplate;
  index: number;
  active: boolean;
  equipSlotDefinitions: readonly EquipSlotDefinition[];
  onClick: () => void;
}) {
  const itemTitle =
    itemTemplate.name.trim() ||
    itemTemplate.id.trim() ||
    `未命名物品 ${index + 1}`;
  const stackLabel = itemTemplate.stackable
    ? `最多 ${itemTemplate.maxStack ?? "未设"}`
    : "单件";
  const usageLabel = itemTemplate.equipSlot
    ? getEquipSlotLabel(itemTemplate.equipSlot, equipSlotDefinitions)
    : itemTemplate.consumable
      ? "消耗使用"
      : "未设置";

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
            style={{ color: active ? color("primary") : color("textPrimary") }}
            title={itemTitle}
          >
            {itemTitle}
          </p>
          <p
            className="mt-1 text-[11px]"
            style={{ color: colorAlpha("textMuted", 0.74) }}
          >
            ID：{itemTemplate.id || "未设置"}
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
          label="分类"
          value={getItemCategoryLabel(itemTemplate.category)}
        />
        <WorldEditorDimensionMetaBadge
          label="堆叠"
          value={stackLabel}
          accent={itemTemplate.stackable ?? false}
        />
        <WorldEditorDimensionMetaBadge
          label="用途"
          value={usageLabel}
          accent={Boolean(itemTemplate.equipSlot)}
        />
      </div>
      <p
        className="mt-2 text-[11px] leading-5"
        style={{
          color: colorAlpha("textMuted", active ? 0.82 : 0.72),
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
        title={itemTemplate.description || "当前物品模板尚未填写描述"}
      >
        {itemTemplate.description || "当前物品模板尚未填写描述"}
      </p>
    </button>
  );
}

function ItemTemplateCardEditor({
  itemTemplate,
  equipSlotDefinitions,
  nameInputRef,
  onChange,
  onRemove,
}: {
  itemTemplate: ItemTemplate;
  equipSlotDefinitions: readonly EquipSlotDefinition[];
  nameInputRef?: RefObject<HTMLInputElement | null>;
  onChange: (updates: Partial<ItemTemplate>) => void;
  onRemove: () => void;
}) {
  const isStackable = itemTemplate.stackable ?? false;
  const isEquippable = isEquippableItemCategory(itemTemplate.category);
  const equipSlotOptions = useMemo(() => {
    const options = [
      { value: "", label: "无默认槽位" },
      ...equipSlotDefinitions.map((slotDefinition) => ({
        value: slotDefinition.id,
        label: slotDefinition.label,
      })),
    ];

    if (
      itemTemplate.equipSlot &&
      !equipSlotDefinitions.some(
        (slotDefinition) => slotDefinition.id === itemTemplate.equipSlot,
      )
    ) {
      options.push({
        value: itemTemplate.equipSlot,
        label: `${itemTemplate.equipSlot}（未在装备系统中定义）`,
      });
    }

    return options;
  }, [equipSlotDefinitions, itemTemplate.equipSlot]);
  const displayId = resolveDisplayManagedTemplateId(
    itemTemplate.id,
    itemTemplate.name,
    "item",
  );

  return (
    <WorldEditorInventoryCard variant="outlined" className="space-y-4 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p
            className="text-sm font-semibold"
            style={{ color: color("textPrimary") }}
          >
            {itemTemplate.name || "未命名物品模板"}
          </p>
          <p
            className="mt-1 text-xs"
            style={{ color: colorAlpha("textMuted", 0.72) }}
          >
            物品模板 ID：{displayId}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onRemove}>
          <Trash2 className="mr-1 h-4 w-4" />
          删除物品模板
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <WorldEditorField label="物品 ID（只读）">
          <Input value={displayId} readOnly placeholder="healing_potion" />
        </WorldEditorField>
        <WorldEditorField label="物品名称">
          <Input
            ref={nameInputRef}
            value={itemTemplate.name}
            onChange={(event) =>
              onChange(
                buildManagedTemplateNameUpdate(
                  itemTemplate.id,
                  itemTemplate.name,
                  event.target.value,
                  "item",
                ),
              )
            }
            placeholder="治疗药水"
          />
        </WorldEditorField>
        <WorldEditorField label="分类">
          <Select
            value={itemTemplate.category}
            onValueChange={(value) =>
              onChange({
                category: value as ItemTemplate["category"],
                ...(isEquippableItemCategory(value as ItemTemplate["category"])
                  ? {}
                  : { equipSlot: undefined }),
              })
            }
            options={ITEM_CATEGORY_OPTIONS.map((option) => ({
              value: option.value,
              label: option.label,
            }))}
          />
        </WorldEditorField>
      </div>

      <WorldEditorField label="描述">
        <Textarea
          value={itemTemplate.description}
          onChange={(event) => onChange({ description: event.target.value })}
          className="min-h-24"
          placeholder="描述物品的用途、外观或来源"
        />
      </WorldEditorField>

      <div className="grid gap-3 lg:grid-cols-2">
        <WorldEditorToggleSetting
          title="允许堆叠"
          description="启用后同类物品可按数量堆叠，并可配置最大堆叠数。"
          checked={isStackable}
          onCheckedChange={(checked) =>
            onChange({
              stackable: checked,
              ...(checked ? {} : { maxStack: undefined }),
            })
          }
        />
        <WorldEditorToggleSetting
          title="可作为消耗品使用"
          description="用于标记该模板是否以主动消耗的方式生效。"
          checked={itemTemplate.consumable ?? false}
          onCheckedChange={(checked) => onChange({ consumable: checked })}
        />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {isStackable ? (
          <WorldEditorField label="最大堆叠数">
            <Input
              type="number"
              value={itemTemplate.maxStack ?? ""}
              onChange={(event) =>
                onChange({
                  maxStack:
                    event.target.value.trim() === ""
                      ? undefined
                      : Number(event.target.value),
                })
              }
              placeholder="99"
            />
          </WorldEditorField>
        ) : null}

        {isEquippable ? (
          <WorldEditorField label="装备槽位">
            <Select
              value={itemTemplate.equipSlot ?? ""}
              onValueChange={(value) =>
                onChange({ equipSlot: value === "" ? undefined : value })
              }
              options={equipSlotOptions}
            />
          </WorldEditorField>
        ) : null}
      </div>

      <p className="text-xs" style={{ color: colorAlpha("textMuted", 0.72) }}>
        内部 ID 默认会随名称自动生成；如需手工覆盖，可通过当前分区高级 JSON
        直接调整。
      </p>

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
          <p>• effects 数组中的 modifier / trigger / onUse 结构</p>
          <p>• 更复杂的装备语义与特殊消耗逻辑</p>
          <p>• 需要保留的作者态扩展字段</p>
        </div>
      </details>
    </WorldEditorInventoryCard>
  );
}
