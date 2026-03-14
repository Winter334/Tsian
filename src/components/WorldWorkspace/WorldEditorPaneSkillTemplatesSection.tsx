import { AnimatePresence, motion } from "framer-motion";
import { Plus, Trash2 } from "lucide-react";
import type { RefObject } from "react";

import { Button, Input, Panel, Select, Textarea } from "@/components/ui";
import type { SkillTemplate } from "@/domain/entities/skill";
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
  getSkillCategoryLabel,
  MASTER_DETAIL_LIST_CONTENT_CLASS,
  MASTER_DETAIL_LIST_PANEL_CLASS,
  resolveDisplayManagedTemplateId,
  SKILL_CATEGORY_OPTIONS,
} from "./WorldEditorPaneInventorySectionShared.helpers";

interface WorldEditorPaneSkillTemplatesSectionProps {
  skillTemplates: readonly SkillTemplate[];
  activeSkillTemplate: SkillTemplate | null;
  resolvedActiveSkillTemplateIndex: number;
  rulesEditorActive: boolean;
  rulesEditorTitle: string;
  detailRef: RefObject<HTMLDivElement | null>;
  nameInputRef: RefObject<HTMLInputElement | null>;
  onOpenRulesEditor: () => void;
  onSetActiveSkillTemplateIndex: (index: number) => void;
  onAddSkillTemplate: () => void;
  onUpdateSkillTemplate: (
    index: number,
    updates: Partial<SkillTemplate>,
  ) => void;
  onRemoveSkillTemplate: (index: number) => void;
}

export function WorldEditorPaneSkillTemplatesSection({
  skillTemplates,
  activeSkillTemplate,
  resolvedActiveSkillTemplateIndex,
  rulesEditorActive,
  rulesEditorTitle,
  detailRef,
  nameInputRef,
  onOpenRulesEditor,
  onSetActiveSkillTemplateIndex,
  onAddSkillTemplate,
  onUpdateSkillTemplate,
  onRemoveSkillTemplate,
}: WorldEditorPaneSkillTemplatesSectionProps) {
  return (
    <WorldEditorFormSection
      title="技能模板"
      description="维护技能模板的基础属性、等级与主动消耗；effects / prerequisites / evolvesInto 等复杂内容继续通过高级规则 JSON 兜底。"
      action={
        <div className="flex flex-wrap gap-2">
          <WorldEditorSectionRulesEditorButton
            active={rulesEditorActive}
            title={rulesEditorTitle}
            onOpen={onOpenRulesEditor}
          />
          <Button variant="outline" size="sm" onClick={onAddSkillTemplate}>
            <Plus className="mr-1 h-4 w-4" />
            添加技能模板
          </Button>
        </div>
      }
    >
      {skillTemplates.length > 0 ? (
        <div className="grid gap-3 xl:h-168 xl:grid-cols-[minmax(260px,320px)_minmax(0,1fr)] 2xl:grid-cols-[minmax(280px,360px)_minmax(0,1fr)]">
          <Panel variant="outlined" className={MASTER_DETAIL_LIST_PANEL_CLASS}>
            <div
              className={MASTER_DETAIL_LIST_CONTENT_CLASS}
              role="tablist"
              aria-label="技能模板切换"
            >
              {skillTemplates.map((skillTemplate, index) => (
                <SkillTemplateListItemButton
                  key={`${skillTemplate.id || "skill-template"}-${index}`}
                  skillTemplate={skillTemplate}
                  index={index}
                  active={resolvedActiveSkillTemplateIndex === index}
                  onClick={() => onSetActiveSkillTemplateIndex(index)}
                />
              ))}
            </div>
          </Panel>

          {activeSkillTemplate ? (
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                ref={detailRef}
                key={`skill-template-${resolvedActiveSkillTemplateIndex}`}
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
                          activeSkillTemplate.name.trim() ||
                          activeSkillTemplate.id.trim() ||
                          `未命名技能 ${resolvedActiveSkillTemplateIndex + 1}`
                        }
                      >
                        {activeSkillTemplate.name.trim() ||
                          activeSkillTemplate.id.trim() ||
                          `未命名技能 ${resolvedActiveSkillTemplateIndex + 1}`}
                      </h5>
                      <p
                        className="mt-2 text-xs leading-5"
                        style={{ color: colorAlpha("textMuted", 0.74) }}
                      >
                        {activeSkillTemplate.description ||
                          "当前技能模板尚未填写描述，可直接在下方详情中补充。"}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <WorldEditorDimensionMetaBadge
                        label="ID"
                        value={activeSkillTemplate.id || "未设置"}
                        mono
                      />
                      <WorldEditorDimensionMetaBadge
                        label="分类"
                        value={getSkillCategoryLabel(
                          activeSkillTemplate.category,
                        )}
                      />
                    </div>
                  </div>
                </Panel>

                <SkillTemplateCardEditor
                  skillTemplate={activeSkillTemplate}
                  nameInputRef={nameInputRef}
                  onChange={(updates) =>
                    onUpdateSkillTemplate(
                      resolvedActiveSkillTemplateIndex,
                      updates,
                    )
                  }
                  onRemove={() =>
                    onRemoveSkillTemplate(resolvedActiveSkillTemplateIndex)
                  }
                />
              </motion.div>
            </AnimatePresence>
          ) : null}
        </div>
      ) : (
        <WorldEditorEmptySectionHint message="当前还没有技能模板；若继续为空，创作者只能通过全量 JSON 维护技能预设。" />
      )}
    </WorldEditorFormSection>
  );
}

function SkillTemplateListItemButton({
  skillTemplate,
  index,
  active,
  onClick,
}: {
  skillTemplate: SkillTemplate;
  index: number;
  active: boolean;
  onClick: () => void;
}) {
  const skillTitle =
    skillTemplate.name.trim() ||
    skillTemplate.id.trim() ||
    `未命名技能 ${index + 1}`;
  const costLabel = skillTemplate.activeUsable
    ? skillTemplate.cost
      ? `${skillTemplate.cost.field} · ${skillTemplate.cost.amount}`
      : "待设置"
    : "无";

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
            title={skillTitle}
          >
            {skillTitle}
          </p>
          <p
            className="mt-1 text-[11px]"
            style={{ color: colorAlpha("textMuted", 0.74) }}
          >
            ID：{skillTemplate.id || "未设置"}
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
          value={getSkillCategoryLabel(skillTemplate.category)}
        />
        <WorldEditorDimensionMetaBadge
          label="最大等级"
          value={String(skillTemplate.maxLevel ?? 1)}
          accent={(skillTemplate.maxLevel ?? 1) > 1}
        />
        <WorldEditorDimensionMetaBadge
          label="消耗"
          value={costLabel}
          accent={skillTemplate.activeUsable ?? false}
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
        title={skillTemplate.description || "当前技能模板尚未填写描述"}
      >
        {skillTemplate.description || "当前技能模板尚未填写描述"}
      </p>
    </button>
  );
}

function SkillTemplateCardEditor({
  skillTemplate,
  nameInputRef,
  onChange,
  onRemove,
}: {
  skillTemplate: SkillTemplate;
  nameInputRef?: RefObject<HTMLInputElement | null>;
  onChange: (updates: Partial<SkillTemplate>) => void;
  onRemove: () => void;
}) {
  const displayId = resolveDisplayManagedTemplateId(
    skillTemplate.id,
    skillTemplate.name,
    "skill",
  );
  const isActiveUsable = skillTemplate.activeUsable ?? false;

  return (
    <WorldEditorInventoryCard variant="outlined" className="space-y-4 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p
            className="text-sm font-semibold"
            style={{ color: color("textPrimary") }}
          >
            {skillTemplate.name || "未命名技能模板"}
          </p>
          <p
            className="mt-1 text-xs"
            style={{ color: colorAlpha("textMuted", 0.72) }}
          >
            技能模板 ID：{displayId}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onRemove}>
          <Trash2 className="mr-1 h-4 w-4" />
          删除技能模板
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <WorldEditorField label="技能 ID（只读）">
          <Input value={displayId} readOnly placeholder="fireball" />
        </WorldEditorField>
        <WorldEditorField label="技能名称">
          <Input
            ref={nameInputRef}
            value={skillTemplate.name}
            onChange={(event) =>
              onChange(
                buildManagedTemplateNameUpdate(
                  skillTemplate.id,
                  skillTemplate.name,
                  event.target.value,
                  "skill",
                ),
              )
            }
            placeholder="火球术"
          />
        </WorldEditorField>
        <WorldEditorField label="分类">
          <Select
            value={skillTemplate.category}
            onValueChange={(value) =>
              onChange({ category: value as SkillTemplate["category"] })
            }
            options={SKILL_CATEGORY_OPTIONS.map((option) => ({
              value: option.value,
              label: option.label,
            }))}
          />
        </WorldEditorField>
        <WorldEditorField label="最大等级">
          <Input
            type="number"
            value={skillTemplate.maxLevel ?? ""}
            onChange={(event) =>
              onChange({
                maxLevel:
                  event.target.value.trim() === ""
                    ? undefined
                    : Number(event.target.value),
              })
            }
            placeholder="1"
          />
        </WorldEditorField>
      </div>

      <WorldEditorField label="描述">
        <Textarea
          value={skillTemplate.description}
          onChange={(event) => onChange({ description: event.target.value })}
          className="min-h-24"
          placeholder="描述技能的效果、叙事语义与使用场景"
        />
      </WorldEditorField>

      <WorldEditorToggleSetting
        title="可主动释放"
        description="启用后该技能会显示消耗配置；关闭则视为被动或常驻能力。"
        checked={isActiveUsable}
        onCheckedChange={(checked) =>
          onChange({
            activeUsable: checked,
            ...(checked ? {} : { cost: undefined }),
          })
        }
      />

      {isActiveUsable ? (
        <div className="grid gap-3 md:grid-cols-2">
          <WorldEditorField label="消耗字段">
            <Input
              value={skillTemplate.cost?.field ?? ""}
              onChange={(event) =>
                onChange({
                  cost:
                    event.target.value.trim() === ""
                      ? undefined
                      : {
                          field: event.target.value,
                          amount: skillTemplate.cost?.amount ?? 1,
                        },
                })
              }
              placeholder="mp"
            />
          </WorldEditorField>
          <WorldEditorField label="消耗量">
            <Input
              type="number"
              value={skillTemplate.cost?.amount ?? ""}
              onChange={(event) =>
                onChange({
                  cost:
                    event.target.value.trim() === ""
                      ? undefined
                      : {
                          field: skillTemplate.cost?.field ?? "",
                          amount: Number(event.target.value),
                        },
                })
              }
              placeholder="10"
            />
          </WorldEditorField>
        </div>
      ) : null}

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
          <p>• effects 各等级层的 modifier / costOverride</p>
          <p>• prerequisites 中的技能前置、等级门槛与复杂组合</p>
          <p>• evolvesInto 等进阶路线配置</p>
        </div>
      </details>
    </WorldEditorInventoryCard>
  );
}
