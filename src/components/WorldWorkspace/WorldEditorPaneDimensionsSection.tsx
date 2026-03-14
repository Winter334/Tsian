import { AnimatePresence, motion } from "framer-motion";
import { Plus, Trash2 } from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";

import { Button, Input, Panel, Textarea, Toggle } from "@/components/ui";
import type {
  CharacterDimension,
  DimensionOption,
  PrimaryAttributeConfig,
  TalentConfig,
} from "@/lib/world/types";
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
import { NumericFieldListEditor } from "./WorldEditorPaneRuleSectionShared";
import {
  buildNumericFieldEntries,
  buildNumericFieldRecord,
} from "./WorldEditorPaneRuleSectionShared.helpers";
import { TagSelectionField } from "./WorldWorkspaceTalentEditors";

const EMPTY_NUMERIC_RECORD: Record<string, number> = {};

type DimensionCardTabId = "settings" | "options";

interface WorldEditorPaneDimensionsSectionProps {
  dimensions: readonly CharacterDimension[];
  primaryAttributes: readonly PrimaryAttributeConfig[];
  talents: readonly TalentConfig[];
  activeDimension: CharacterDimension | null;
  resolvedActiveDimensionIndex: number;
  rulesEditorActive: boolean;
  rulesEditorTitle: string;
  onOpenRulesEditor: () => void;
  onSetActiveDimensionIndex: (index: number) => void;
  onAddDimension: () => void;
  onUpdateDimension: (
    index: number,
    updates: Partial<CharacterDimension>,
  ) => void;
  onRemoveDimension: (index: number) => void;
  onAddDimensionOption: (dimensionIndex: number) => void;
  onUpdateDimensionOption: (
    dimensionIndex: number,
    optionIndex: number,
    updates: Partial<DimensionOption>,
  ) => void;
  onRemoveDimensionOption: (
    dimensionIndex: number,
    optionIndex: number,
  ) => void;
}

export function WorldEditorPaneDimensionsSection({
  dimensions,
  primaryAttributes,
  talents,
  activeDimension,
  resolvedActiveDimensionIndex,
  rulesEditorActive,
  rulesEditorTitle,
  onOpenRulesEditor,
  onSetActiveDimensionIndex,
  onAddDimension,
  onUpdateDimension,
  onRemoveDimension,
  onAddDimensionOption,
  onUpdateDimensionOption,
  onRemoveDimensionOption,
}: WorldEditorPaneDimensionsSectionProps) {
  return (
    <WorldEditorFormSection
      title="角色维度"
      description="控制创建向导中的维度步骤，如种族、背景、阵营。"
      action={
        <div className="flex flex-wrap gap-2">
          <WorldEditorSectionRulesEditorButton
            active={rulesEditorActive}
            title={rulesEditorTitle}
            onOpen={onOpenRulesEditor}
          />
          <Button variant="outline" size="sm" onClick={onAddDimension}>
            <Plus className="mr-1 h-4 w-4" />
            添加维度
          </Button>
        </div>
      }
    >
      {dimensions.length > 0 ? (
        <div className="grid gap-3 xl:h-168 xl:grid-cols-[minmax(260px,320px)_minmax(0,1fr)] 2xl:grid-cols-[minmax(280px,360px)_minmax(0,1fr)]">
          <Panel variant="outlined" className={MASTER_DETAIL_LIST_PANEL_CLASS}>
            <div
              className={MASTER_DETAIL_LIST_CONTENT_CLASS}
              role="tablist"
              aria-label="维度切换"
            >
              {dimensions.map((dimension, index) => {
                const isActive = resolvedActiveDimensionIndex === index;
                const dimensionTitle =
                  dimension.label.trim() ||
                  dimension.id.trim() ||
                  `未命名维度 ${index + 1}`;
                const descriptionText = dimension.description?.trim() ?? "";

                return (
                  <button
                    key={`${dimension.id || "dimension"}-${index}`}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => onSetActiveDimensionIndex(index)}
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
                          title={dimensionTitle}
                        >
                          {dimensionTitle}
                        </p>
                        <p
                          className="mt-1 text-[11px]"
                          style={{ color: colorAlpha("textMuted", 0.74) }}
                        >
                          ID：{dimension.id || "未设置"}
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
                        label="流程"
                        value={dimension.required ? "必选" : "可跳过"}
                        accent={dimension.required ?? false}
                      />
                      <WorldEditorDimensionMetaBadge
                        label="排序"
                        value={String(dimension.order ?? 0)}
                      />
                      <WorldEditorDimensionMetaBadge
                        label="选项"
                        value={String(dimension.options.length)}
                        accent={dimension.options.length > 0}
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
                      title={descriptionText || "当前维度尚未填写说明"}
                    >
                      {descriptionText || "当前维度尚未填写说明"}
                    </p>
                  </button>
                );
              })}
            </div>
          </Panel>

          {activeDimension ? (
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={`dimension-${resolvedActiveDimensionIndex}`}
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
                          activeDimension.label.trim() ||
                          activeDimension.id.trim() ||
                          `未命名维度 ${resolvedActiveDimensionIndex + 1}`
                        }
                      >
                        {activeDimension.label.trim() ||
                          activeDimension.id.trim() ||
                          `未命名维度 ${resolvedActiveDimensionIndex + 1}`}
                      </h5>
                      <p
                        className="mt-2 text-xs leading-5"
                        style={{ color: colorAlpha("textMuted", 0.74) }}
                      >
                        {activeDimension.description?.trim() ||
                          "当前维度尚未填写说明，可直接在下方详情中补充。"}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <WorldEditorDimensionMetaBadge
                        label="ID"
                        value={activeDimension.id || "未设置"}
                        mono
                      />
                      <WorldEditorDimensionMetaBadge
                        label="流程"
                        value={activeDimension.required ? "必选" : "可跳过"}
                        accent={activeDimension.required ?? false}
                      />
                      <WorldEditorDimensionMetaBadge
                        label="选项"
                        value={String(activeDimension.options.length)}
                        accent={activeDimension.options.length > 0}
                      />
                    </div>
                  </div>
                </Panel>

                <DimensionCard
                  dimension={activeDimension}
                  talentOptions={talents}
                  attributeOptions={primaryAttributes}
                  onChange={(updates) =>
                    onUpdateDimension(resolvedActiveDimensionIndex, updates)
                  }
                  onRemove={() =>
                    onRemoveDimension(resolvedActiveDimensionIndex)
                  }
                  onAddOption={() =>
                    onAddDimensionOption(resolvedActiveDimensionIndex)
                  }
                  onUpdateOption={(optionIndex, updates) =>
                    onUpdateDimensionOption(
                      resolvedActiveDimensionIndex,
                      optionIndex,
                      updates,
                    )
                  }
                  onRemoveOption={(optionIndex) =>
                    onRemoveDimensionOption(
                      resolvedActiveDimensionIndex,
                      optionIndex,
                    )
                  }
                />
              </motion.div>
            </AnimatePresence>
          ) : null}
        </div>
      ) : (
        <WorldEditorEmptySectionHint message="当前还没有角色维度；若继续为空，角色创建流程将只保留基础信息。" />
      )}
    </WorldEditorFormSection>
  );
}

function DimensionCard({
  dimension,
  attributeOptions,
  talentOptions,
  onChange,
  onRemove,
  onAddOption,
  onUpdateOption,
  onRemoveOption,
}: {
  dimension: CharacterDimension;
  attributeOptions: readonly PrimaryAttributeConfig[];
  talentOptions: readonly TalentConfig[];
  onChange: (updates: Partial<CharacterDimension>) => void;
  onRemove: () => void;
  onAddOption: () => void;
  onUpdateOption: (
    optionIndex: number,
    updates: Partial<DimensionOption>,
  ) => void;
  onRemoveOption: (optionIndex: number) => void;
}) {
  const [activeTab, setActiveTab] = useState<DimensionCardTabId>("settings");
  const [activeOptionIndex, setActiveOptionIndex] = useState(0);
  const isRequired = dimension.required ?? false;
  const dimensionTitle =
    dimension.label.trim() || dimension.id.trim() || "未命名维度";
  const descriptionText = dimension.description?.trim() ?? "";
  const optionPreviewItems = dimension.options
    .map((option) => option.name.trim() || option.id.trim())
    .filter(Boolean);
  const optionPreview =
    optionPreviewItems.length > 0
      ? optionPreviewItems.slice(0, 3).join(" / ")
      : "尚未添加维度选项";
  const collapsedPreview =
    optionPreviewItems.length > 3
      ? `${optionPreview} 等 ${optionPreviewItems.length} 项`
      : optionPreview;
  const resolvedActiveOptionIndex =
    dimension.options.length === 0
      ? -1
      : Math.min(activeOptionIndex, dimension.options.length - 1);
  const activeOption =
    resolvedActiveOptionIndex >= 0
      ? dimension.options[resolvedActiveOptionIndex]
      : null;
  const activeOptionTitle =
    activeOption?.name.trim() ||
    activeOption?.id.trim() ||
    (activeOption
      ? `未命名选项 ${resolvedActiveOptionIndex + 1}`
      : "未选择选项");
  const tabItems: Array<{
    id: DimensionCardTabId;
    label: string;
    description: string;
  }> = [
    {
      id: "settings",
      label: "基础设置",
      description: "编辑名称、排序与说明",
    },
    {
      id: "options",
      label: "维度选项",
      description:
        dimension.options.length > 0
          ? `${dimension.options.length} 项待编辑`
          : "添加并维护选项",
    },
  ];
  const optionDetailRef = useRef<HTMLDivElement>(null);
  const optionNameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (dimension.options.length === 0) {
      if (activeOptionIndex !== 0) {
        setActiveOptionIndex(0);
      }
      return;
    }

    if (activeOptionIndex > dimension.options.length - 1) {
      setActiveOptionIndex(dimension.options.length - 1);
    }
  }, [activeOptionIndex, dimension.options.length]);

  useEffect(() => {
    if (activeTab !== "options" || resolvedActiveOptionIndex < 0) {
      return;
    }

    const animationFrameId = window.requestAnimationFrame(() => {
      optionDetailRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "nearest",
      });
      optionNameInputRef.current?.focus({ preventScroll: true });
    });

    return () => window.cancelAnimationFrame(animationFrameId);
  }, [activeTab, resolvedActiveOptionIndex, dimension.options.length]);

  const handleAddOption = () => {
    setActiveTab("options");
    onAddOption();
    setActiveOptionIndex(dimension.options.length);
  };

  const handleRemoveOption = (optionIndex: number) => {
    onRemoveOption(optionIndex);
    setActiveOptionIndex((currentIndex) => {
      if (dimension.options.length <= 1) {
        return 0;
      }

      if (currentIndex > optionIndex) {
        return currentIndex - 1;
      }

      if (currentIndex === optionIndex) {
        return Math.min(optionIndex, dimension.options.length - 2);
      }

      return currentIndex;
    });
  };

  let tabContent: ReactNode;

  switch (activeTab) {
    case "options":
      tabContent = (
        <div className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p
                className="text-sm font-medium"
                style={{ color: color("textPrimary") }}
              >
                维度选项
              </p>
              <p
                className="mt-1 text-xs"
                style={{ color: colorAlpha("textMuted", 0.72) }}
              >
                先从摘要列表定位要编辑的选项，再维护该项的描述、属性修正与天赋影响。
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <WorldEditorDimensionMetaBadge
                label="当前"
                value={`${dimension.options.length} 项`}
                accent={dimension.options.length > 0}
              />
              {activeOption ? (
                <WorldEditorDimensionMetaBadge
                  label="正在编辑"
                  value={activeOptionTitle}
                  accent
                />
              ) : null}
            </div>
          </div>

          {dimension.options.length > 0 ? (
            <div className="grid gap-3 xl:h-168 xl:grid-cols-[minmax(260px,320px)_minmax(0,1fr)] 2xl:grid-cols-[minmax(280px,360px)_minmax(0,1fr)]">
              <Panel
                variant="outlined"
                className={MASTER_DETAIL_LIST_PANEL_CLASS}
              >
                <div className={MASTER_DETAIL_LIST_CONTENT_CLASS}>
                  {dimension.options.map((option, optionIndex) => {
                    const isActive = resolvedActiveOptionIndex === optionIndex;
                    const optionTitle =
                      option.name.trim() ||
                      option.id.trim() ||
                      `未命名选项 ${optionIndex + 1}`;
                    const optionDescription = option.description?.trim() ?? "";
                    const attributeModifierCount = Object.values(
                      option.effects?.attributeModifiers ??
                        EMPTY_NUMERIC_RECORD,
                    ).filter((value) => value !== 0).length;
                    const grantedTalentCount =
                      option.effects?.grantedTalents?.length ?? 0;
                    const excludedTalentCount =
                      option.effects?.excludedTalents?.length ?? 0;

                    return (
                      <button
                        key={`${option.id}-${optionIndex}`}
                        type="button"
                        onClick={() => setActiveOptionIndex(optionIndex)}
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
                                display: "-webkit-box",
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: "vertical",
                                overflow: "hidden",
                              }}
                              title={optionTitle}
                            >
                              {optionTitle}
                            </p>
                            <p
                              className="mt-1 text-[11px]"
                              style={{ color: colorAlpha("textMuted", 0.74) }}
                            >
                              ID：{option.id || "未设置"}
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
                            {isActive ? "当前" : `#${optionIndex + 1}`}
                          </span>
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
                          title={optionDescription || "当前选项尚未填写描述"}
                        >
                          {optionDescription || "当前选项尚未填写描述"}
                        </p>
                        <p
                          className="mt-2 text-[11px]"
                          style={{ color: colorAlpha("textMuted", 0.74) }}
                        >
                          属性修正 {attributeModifierCount} · 赠送天赋{" "}
                          {grantedTalentCount}· 排除天赋 {excludedTalentCount}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </Panel>

              {activeOption ? (
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    ref={optionDetailRef}
                    key={`${activeOption.id}-${resolvedActiveOptionIndex}`}
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
                            title={activeOptionTitle}
                          >
                            {activeOptionTitle}
                          </h5>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <WorldEditorDimensionMetaBadge
                              label="序号"
                              value={String(resolvedActiveOptionIndex + 1)}
                            />
                          </div>
                          <p
                            className="mt-2 text-xs leading-5"
                            style={{ color: colorAlpha("textMuted", 0.74) }}
                          >
                            {activeOption.description?.trim() ||
                              "当前选项尚未填写说明，可直接在下方详情中补充。"}
                          </p>
                        </div>
                      </div>
                    </Panel>

                    <DimensionOptionCardEditor
                      option={activeOption}
                      attributeOptions={attributeOptions}
                      talentOptions={talentOptions}
                      nameInputRef={optionNameInputRef}
                      onChange={(updates) =>
                        onUpdateOption(resolvedActiveOptionIndex, updates)
                      }
                      onRemove={() =>
                        handleRemoveOption(resolvedActiveOptionIndex)
                      }
                    />
                  </motion.div>
                </AnimatePresence>
              ) : null}
            </div>
          ) : (
            <WorldEditorEmptySectionHint message="当前还没有维度选项。切换到该分区后添加选项，可继续配置描述、属性修正与天赋影响。" />
          )}
        </div>
      );
      break;

    case "settings":
    default:
      tabContent = (
        <div className="space-y-3">
          <p
            className="text-xs"
            style={{ color: colorAlpha("textMuted", 0.72) }}
          >
            编辑创建流程中的标题、标识、排序与说明文案。
          </p>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(120px,0.6fr)_minmax(0,1fr)] [&>label]:min-w-0 [&>div]:min-w-0">
            <WorldEditorField label="维度名称">
              <Input
                value={dimension.label}
                onChange={(event) => onChange({ label: event.target.value })}
                placeholder="种族"
              />
            </WorldEditorField>
            <WorldEditorField label="维度 ID">
              <Input
                value={dimension.id}
                onChange={(event) => onChange({ id: event.target.value })}
                placeholder="race"
              />
            </WorldEditorField>
            <WorldEditorField label="排序">
              <Input
                type="number"
                value={dimension.order ?? 0}
                onChange={(event) =>
                  onChange({ order: Number(event.target.value) || 0 })
                }
              />
            </WorldEditorField>
            <div
              className="rounded-xl border px-4 py-3"
              style={{
                borderColor: colorAlpha("border", 0.3),
                background: colorAlpha("bgCard", 0.22),
              }}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p
                    className="text-sm font-medium"
                    style={{ color: color("textPrimary") }}
                  >
                    必选维度
                  </p>
                  <p
                    className="mt-1 text-xs"
                    style={{ color: colorAlpha("textMuted", 0.72) }}
                  >
                    关闭后，角色创建流程允许跳过该维度。
                  </p>
                </div>
                <Toggle
                  checked={isRequired}
                  onCheckedChange={(checked) => onChange({ required: checked })}
                />
              </div>
            </div>
          </div>

          <WorldEditorField label="维度说明">
            <Textarea
              value={dimension.description ?? ""}
              onChange={(event) =>
                onChange({ description: event.target.value })
              }
              className="min-h-20"
              placeholder="说明该维度在角色创建中的定位"
            />
          </WorldEditorField>
        </div>
      );
      break;
  }

  return (
    <WorldEditorInventoryCard variant="outlined" className="space-y-4 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <h4
              className="min-w-0 wrap-break-word text-base font-semibold leading-6"
              style={{ color: color("textPrimary") }}
              title={dimensionTitle}
            >
              {dimensionTitle}
            </h4>
            <div className="flex flex-wrap gap-2">
              <WorldEditorDimensionMetaBadge
                label="流程"
                value={isRequired ? "必选" : "可跳过"}
                accent={isRequired}
              />
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <WorldEditorDimensionMetaBadge
              label="ID"
              value={dimension.id || "未设置"}
              mono
            />
            <WorldEditorDimensionMetaBadge
              label="排序"
              value={String(dimension.order ?? 0)}
            />
            <WorldEditorDimensionMetaBadge
              label="选项"
              value={String(dimension.options.length)}
              accent={dimension.options.length > 0}
            />
          </div>
          <p
            className="mt-3 text-xs leading-6"
            style={{
              color: colorAlpha("textMuted", 0.72),
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
            title={
              descriptionText ||
              "当前尚未填写维度说明，可在基础设置中补充该维度在角色创建中的定位。"
            }
          >
            {descriptionText ||
              "当前尚未填写维度说明，可在基础设置中补充该维度在角色创建中的定位。"}
          </p>
          <p
            className="mt-2 text-xs"
            style={{ color: colorAlpha("textMuted", 0.72) }}
          >
            当前仅渲染这个维度的详情；选项预览：{collapsedPreview}
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap lg:shrink-0 lg:justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={handleAddOption}
            className="w-full justify-center sm:w-auto"
          >
            <Plus className="mr-1 h-4 w-4" />
            添加选项
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onRemove}
            className="w-full justify-center sm:w-auto"
          >
            <Trash2 className="mr-1 h-4 w-4" />
            删除维度
          </Button>
        </div>
      </div>

      <div
        className="rounded-xl border px-3 py-3"
        style={{
          borderColor: colorAlpha("border", 0.3),
          background: colorAlpha("bgCard", 0.22),
        }}
      >
        <div className="grid gap-2 sm:grid-cols-2" role="tablist">
          {tabItems.map((tab) => {
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab.id)}
                className="rounded-lg border px-3 py-2 text-left transition-colors duration-150"
                style={{
                  borderColor: colorAlpha(
                    isActive ? "primary" : "border",
                    isActive ? 0.38 : 0.28,
                  ),
                  background: colorAlpha(
                    isActive ? "primary" : "bgCard",
                    isActive ? 0.14 : 0.12,
                  ),
                }}
              >
                <span
                  className="block text-sm font-medium"
                  style={{
                    color: isActive ? color("primary") : color("textPrimary"),
                  }}
                >
                  {tab.label}
                </span>
                <span
                  className="mt-1 block text-[11px] leading-5"
                  style={{ color: colorAlpha("textMuted", 0.72) }}
                >
                  {tab.description}
                </span>
              </button>
            );
          })}
        </div>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={activeTab}
            role="tabpanel"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.14 }}
            className="mt-3"
          >
            {tabContent}
          </motion.div>
        </AnimatePresence>
      </div>
    </WorldEditorInventoryCard>
  );
}

function DimensionOptionCardEditor({
  option,
  attributeOptions,
  talentOptions,
  nameInputRef,
  onChange,
  onRemove,
}: {
  option: DimensionOption;
  attributeOptions: readonly PrimaryAttributeConfig[];
  talentOptions: readonly TalentConfig[];
  nameInputRef?: RefObject<HTMLInputElement | null>;
  onChange: (updates: Partial<DimensionOption>) => void;
  onRemove: () => void;
}) {
  const attributeModifiers =
    option.effects?.attributeModifiers ?? EMPTY_NUMERIC_RECORD;
  const grantedTalents = option.effects?.grantedTalents ?? [];
  const excludedTalents = option.effects?.excludedTalents ?? [];
  const attributeModifierEntries = useMemo(
    () => buildNumericFieldEntries(attributeModifiers),
    [attributeModifiers],
  );

  return (
    <Panel variant="outlined" className="space-y-4 p-4">
      <div className="grid gap-3 md:grid-cols-3 [&>label]:min-w-0">
        <WorldEditorField label="选项 ID">
          <Input
            value={option.id}
            onChange={(event) => onChange({ id: event.target.value })}
            placeholder="human"
          />
        </WorldEditorField>
        <WorldEditorField label="选项名称">
          <Input
            ref={nameInputRef}
            value={option.name}
            onChange={(event) => onChange({ name: event.target.value })}
            placeholder="人类"
          />
        </WorldEditorField>
        <WorldEditorField label="图标（可选）">
          <Input
            value={option.icon ?? ""}
            onChange={(event) => onChange({ icon: event.target.value })}
            placeholder="sparkles"
          />
        </WorldEditorField>
      </div>

      <WorldEditorField label="描述">
        <Textarea
          value={option.description}
          onChange={(event) => onChange({ description: event.target.value })}
          className="min-h-24"
          placeholder="说明这个选项在设定与规则上的差异"
        />
      </WorldEditorField>

      <div className="space-y-3">
        <NumericFieldListEditor
          title="属性修正"
          description="普通作者可直接选择目标属性并填写修正值；系统会自动清理空条目并维持内部绑定。"
          fieldLabel="目标属性"
          valueLabel="修正值"
          addLabel="添加修正"
          emptyMessage={
            attributeOptions.length === 0
              ? "先在属性分区配置主要属性后，再为维度选项添加修正。"
              : "当前没有属性修正；留空表示该选项不额外改变初始属性。"
          }
          fieldOptions={attributeOptions.map((item) => ({
            value: item.key,
            label: `${item.label}（${item.key}）`,
          }))}
          entries={attributeModifierEntries}
          onChange={(entries) =>
            onChange({
              effects: {
                ...(option.effects ?? {}),
                attributeModifiers: buildNumericFieldRecord(entries),
                grantedTalents,
                excludedTalents,
              },
            })
          }
        />

        <div className="grid gap-3 lg:grid-cols-2 [&>div]:min-w-0">
          <div
            className="rounded-xl border px-4 py-3"
            style={{
              borderColor: colorAlpha("border", 0.3),
              background: colorAlpha("bgCard", 0.22),
            }}
          >
            <TagSelectionField
              label="赠送天赋"
              items={talentOptions.map((item) => ({
                id: item.id,
                name: item.name,
              }))}
              value={grantedTalents}
              onChange={(nextValue) =>
                onChange({
                  effects: {
                    ...(option.effects ?? {}),
                    attributeModifiers,
                    grantedTalents: nextValue,
                    excludedTalents,
                  },
                })
              }
            />
          </div>

          <div
            className="rounded-xl border px-4 py-3"
            style={{
              borderColor: colorAlpha("border", 0.3),
              background: colorAlpha("bgCard", 0.22),
            }}
          >
            <TagSelectionField
              label="排除天赋"
              items={talentOptions.map((item) => ({
                id: item.id,
                name: item.name,
              }))}
              value={excludedTalents}
              onChange={(nextValue) =>
                onChange({
                  effects: {
                    ...(option.effects ?? {}),
                    attributeModifiers,
                    grantedTalents,
                    excludedTalents: nextValue,
                  },
                })
              }
            />
          </div>
        </div>
      </div>

      <div className="mt-3 flex justify-end">
        <Button variant="outline" size="sm" onClick={onRemove}>
          <Trash2 className="mr-1 h-4 w-4" />
          删除选项
        </Button>
      </div>
    </Panel>
  );
}
