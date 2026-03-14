import { Panel, ScrollArea } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { World } from "@/lib/world/types";
import { color, colorAlpha } from "@/styles/tokens";

import {
  WORLD_EDITOR_SECTIONS,
  type WorldEditorSectionDefinition,
  type WorldEditorSectionId,
} from "./WorldEditorPaneSections";

interface WorldEditorSidebarProps {
  world: World;
  activeSection: WorldEditorSectionId;
  activeSectionMeta: WorldEditorSectionDefinition;
  validationMessages: string[];
  onSelectSection: (section: WorldEditorSectionId) => void;
}

export function WorldEditorDesktopSidebar({
  world,
  activeSection,
  activeSectionMeta,
  validationMessages,
  onSelectSection,
}: WorldEditorSidebarProps) {
  return (
    <div
      className="hidden border-b lg:flex lg:h-full lg:min-h-0 lg:w-76 lg:shrink-0 lg:flex-col lg:border-b-0 lg:border-r lg:overflow-hidden"
      style={{ borderColor: colorAlpha("primary", 0.14) }}
    >
      <div className="space-y-4 px-4 py-4 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col">
        <EditorOverviewPanel world={world} activeSection={activeSectionMeta} />

        <SectionNavigation
          world={world}
          activeSection={activeSection}
          onSelectSection={onSelectSection}
        />

        <ValidationPanel messages={validationMessages} />
      </div>
    </div>
  );
}

export function WorldEditorMobileSectionNavigation({
  activeSection,
  onSelectSection,
}: Pick<WorldEditorSidebarProps, "activeSection" | "onSelectSection">) {
  return (
    <div
      className="overflow-x-auto pb-1"
      role="tablist"
      aria-label="编辑分区快速切换"
    >
      <div className="flex min-w-max gap-2">
        {WORLD_EDITOR_SECTIONS.map((section) => {
          const selected = section.id === activeSection;
          return (
            <button
              key={section.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => onSelectSection(section.id)}
              className="shrink-0 rounded-full border px-3 py-2 text-xs font-medium whitespace-nowrap transition-all"
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
              title={section.description}
            >
              {section.title}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function WorldEditorSectionBanner({
  section,
}: {
  section: WorldEditorSectionDefinition;
}) {
  const Icon = typeof section.icon === "function" ? section.icon : null;
  const iconText = typeof section.icon === "string" ? section.icon : null;

  return (
    <Panel variant="outlined" className="hidden p-4 sm:p-5 lg:block">
      <div className="flex items-start gap-3">
        {Icon ? (
          <span
            className="rounded-xl border p-2"
            style={{
              borderColor: colorAlpha("primary", 0.2),
              background: colorAlpha("primary", 0.08),
            }}
          >
            <Icon className="h-4 w-4" style={{ color: color("primary") }} />
          </span>
        ) : iconText ? (
          <span
            className="rounded-xl border px-2.5 py-1.5 text-sm"
            style={{
              borderColor: colorAlpha("primary", 0.2),
              background: colorAlpha("primary", 0.08),
              color: color("primary"),
            }}
            aria-hidden="true"
          >
            {iconText}
          </span>
        ) : null}
        <div>
          <p
            className="text-xs font-medium uppercase tracking-[0.24em]"
            style={{ color: colorAlpha("primary", 0.82) }}
          >
            当前分区
          </p>
          <h2
            className="mt-2 text-base font-semibold"
            style={{ color: color("textPrimary") }}
          >
            {section.title}
          </h2>
          <p
            className="mt-1 text-xs"
            style={{ color: colorAlpha("textMuted", 0.76) }}
          >
            {section.description}
          </p>
        </div>
      </div>
    </Panel>
  );
}

export function ValidationPanel({ messages }: { messages: string[] }) {
  if (messages.length === 0) {
    return (
      <Panel variant="outlined" className="p-3">
        <div className="flex items-start gap-2">
          <span
            className="mt-0.5 inline-flex h-4 w-4 items-center justify-center text-xs font-semibold"
            style={{ color: color("success") }}
            aria-hidden="true"
          >
            ✓
          </span>
          <div>
            <p
              className="text-sm font-medium"
              style={{ color: color("textPrimary") }}
            >
              当前结构检查通过
            </p>
            <p
              className="mt-1 text-xs"
              style={{ color: colorAlpha("textMuted", 0.72) }}
            >
              未发现阻塞当前工作包范围的明显配置缺口。
            </p>
          </div>
        </div>
      </Panel>
    );
  }

  return (
    <Panel variant="outlined" className="p-3">
      <div className="flex items-start gap-2">
        <span
          className="mt-0.5 inline-flex h-4 w-4 items-center justify-center text-xs font-semibold"
          style={{ color: color("warning") }}
          aria-hidden="true"
        >
          !
        </span>
        <div className="min-w-0">
          <p
            className="text-sm font-medium"
            style={{ color: color("textPrimary") }}
          >
            当前草稿存在提示项
          </p>
          <ul
            className="mt-2 list-disc space-y-1 pl-4 text-xs"
            style={{ color: colorAlpha("textMuted", 0.78) }}
          >
            {messages.map((message, index) => (
              <li
                key={
                  message
                    ? `${message}-${index}`
                    : `validation-message-${index}`
                }
              >
                {message}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Panel>
  );
}

function getSectionSummary(
  sectionId: WorldEditorSectionId,
  world: World,
): string {
  switch (sectionId) {
    case "meta":
      return world.meta.author
        ? `v${world.meta.version} · ${world.meta.author}`
        : `v${world.meta.version} · 待补作者信息`;

    case "narrative": {
      const configuredCount = [
        world.narrative?.script,
        world.narrative?.opening,
      ].filter((item) => Boolean(item && item.trim().length > 0)).length;

      if (configuredCount === 2) {
        return "剧本与开幕语已配置";
      }

      if (configuredCount === 1) {
        return "已配置 1 项叙事启动内容";
      }

      return "尚未填写叙事启动";
    }

    case "attributes": {
      const allocatableCount =
        world.rules.pointBuyRules?.allocatableAttributes?.length ?? 0;
      return `${world.rules.primaryAttributes.length} 个属性 · ${allocatableCount} 个可分配字段`;
    }

    case "derivedStats": {
      const resourceCount = world.rules.derivedStats.filter(
        (item) => item.isResource,
      ).length;
      return resourceCount > 0
        ? `${world.rules.derivedStats.length} 个衍生属性 · ${resourceCount} 个资源字段`
        : `${world.rules.derivedStats.length} 个衍生属性`;
    }

    case "checkRules": {
      const dcPresetCount = Object.keys(
        world.rules.checkRules.dcPresets ?? {},
      ).length;
      const opposedPresetCount = Object.keys(
        world.rules.checkRules.opposedPresets ?? {},
      ).length;
      return `${world.rules.checkRules.defaultDice ?? "1d20"} · ${dcPresetCount} 个 DC 预设 · ${opposedPresetCount} 个对抗预设`;
    }

    case "conditions": {
      const triggerCount = (world.rules.conditions ?? []).filter(
        (item) => item.trigger,
      ).length;
      return `${world.rules.conditions?.length ?? 0} 个状态 · ${triggerCount} 个系统触发`;
    }

    case "dimensions": {
      const dimensionCount = world.rules.dimensions?.length ?? 0;
      const emptyOptionCount = (world.rules.dimensions ?? []).filter(
        (item) => item.options.length === 0,
      ).length;

      if (dimensionCount === 0) {
        return "尚未配置角色维度";
      }

      return emptyOptionCount > 0
        ? `${dimensionCount} 个维度 · ${emptyOptionCount} 个待补选项`
        : `${dimensionCount} 个维度 · 选项已配置`;
    }

    case "talents": {
      const talentCount = world.rules.talents?.length ?? 0;
      return talentCount > 0
        ? `${talentCount} 个天赋可供角色创建选择`
        : "当前没有可选天赋";
    }

    case "level-system": {
      const configuredLevelSystem = world.rules.levelSystem;
      if (!configuredLevelSystem?.enabled) {
        return "当前未启用等级系统";
      }

      const growthModeLabel =
        configuredLevelSystem.growthMode === "allocation"
          ? "属性点分配"
          : configuredLevelSystem.growthMode === "hybrid"
            ? "混合成长"
            : "自动成长";
      const triggerLabel =
        (configuredLevelSystem.triggerModes ?? [])
          .map((mode) => (mode === "manual" ? "手动" : "叙事"))
          .join(" / ") || "未配置触发";
      return `${growthModeLabel} · ${triggerLabel} · ${configuredLevelSystem.resourceRecovery?.mode ?? "delta"} 恢复`;
    }

    case "inventoryRules": {
      const equipSlotCount =
        world.rules.inventoryRules?.equipSlotDefinitions?.length ?? 0;
      const currentDefaultCapacity =
        world.rules.inventoryRules?.defaultCapacity;

      if (equipSlotCount === 0) {
        return currentDefaultCapacity === undefined
          ? "当前未配置装备系统"
          : `未配置槽位 · 默认容量 ${currentDefaultCapacity}`;
      }

      return currentDefaultCapacity === undefined
        ? `${equipSlotCount} 个装备槽位`
        : `${equipSlotCount} 个装备槽位 · 默认容量 ${currentDefaultCapacity}`;
    }

    case "itemTemplates": {
      const itemTemplateCount = world.rules.itemTemplates?.length ?? 0;
      const equippableCount = (world.rules.itemTemplates ?? []).filter(
        (item) =>
          item.category === "weapon" ||
          item.category === "armor" ||
          item.category === "accessory",
      ).length;
      return itemTemplateCount > 0
        ? `${itemTemplateCount} 个物品模板 · ${equippableCount} 个装备类`
        : "当前没有物品模板";
    }

    case "skillTemplates": {
      const skillTemplateCount = world.rules.skillTemplates?.length ?? 0;
      const activeSkillCount = (world.rules.skillTemplates ?? []).filter(
        (item) => item.activeUsable,
      ).length;
      return skillTemplateCount > 0
        ? `${skillTemplateCount} 个技能模板 · ${activeSkillCount} 个主动技能`
        : "当前没有技能模板";
    }

    default:
      return "";
  }
}

function EditorOverviewPanel({
  world,
  activeSection,
}: {
  world: World;
  activeSection: WorldEditorSectionDefinition;
}) {
  const dimensionCount = world.rules.dimensions?.length ?? 0;
  const talentCount = world.rules.talents?.length ?? 0;
  const equipSlotCount =
    world.rules.inventoryRules?.equipSlotDefinitions?.length ?? 0;
  const itemTemplateCount = world.rules.itemTemplates?.length ?? 0;
  const skillTemplateCount = world.rules.skillTemplates?.length ?? 0;
  const attributeCount = world.rules.primaryAttributes.length;
  const derivedCount = world.rules.derivedStats.length;
  const conditionCount = world.rules.conditions?.length ?? 0;
  const dcPresetCount = Object.keys(
    world.rules.checkRules.dcPresets ?? {},
  ).length;

  return (
    <Panel variant="outlined" className="p-4">
      <p
        className="text-xs font-medium uppercase tracking-[0.24em]"
        style={{ color: colorAlpha("primary", 0.82) }}
      >
        当前世界
      </p>
      <h2
        className="mt-2 truncate text-base font-semibold"
        style={{ color: color("textPrimary") }}
      >
        {world.meta.name}
      </h2>
      <p
        className="mt-1 text-xs"
        style={{ color: colorAlpha("textMuted", 0.76) }}
      >
        当前分区：{activeSection.title}
      </p>

      <div className="mt-4 grid grid-cols-2 gap-2 xl:grid-cols-4">
        <SummaryMetric label="属性" value={String(attributeCount)} />
        <SummaryMetric label="衍生" value={String(derivedCount)} />
        <SummaryMetric label="检定预设" value={String(dcPresetCount)} />
        <SummaryMetric label="状态" value={String(conditionCount)} />
        <SummaryMetric label="维度" value={String(dimensionCount)} />
        <SummaryMetric label="天赋" value={String(talentCount)} />
        <SummaryMetric label="装备槽位" value={String(equipSlotCount)} />
        <SummaryMetric label="物品模板" value={String(itemTemplateCount)} />
        <SummaryMetric label="技能模板" value={String(skillTemplateCount)} />
      </div>
    </Panel>
  );
}

function SectionNavigation({
  world,
  activeSection,
  onSelectSection,
}: {
  world: World;
  activeSection: WorldEditorSectionId;
  onSelectSection: (section: WorldEditorSectionId) => void;
}) {
  return (
    <Panel
      variant="outlined"
      className="lg:flex lg:min-h-0 lg:flex-1 lg:flex-col lg:[&>div]:flex lg:[&>div]:min-h-0 lg:[&>div]:flex-1 lg:[&>div]:flex-col"
    >
      <div className="p-3 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col">
        <div>
          <h3
            className="text-sm font-semibold"
            style={{ color: color("textPrimary") }}
          >
            编辑分区
          </h3>
          <p
            className="mt-1 text-xs"
            style={{ color: colorAlpha("textMuted", 0.74) }}
          >
            一次只展开当前目标分区，避免在超长表单中来回滚动。
          </p>
        </div>

        <ScrollArea className="mt-4 pb-1 lg:min-h-0 lg:flex-1 lg:overflow-x-hidden lg:pr-1">
          <div className="flex gap-2 lg:flex-col">
            {WORLD_EDITOR_SECTIONS.map((section) => {
              const selected = section.id === activeSection;
              return (
                <button
                  key={section.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onSelectSection(section.id)}
                  className={cn(
                    "min-w-60 rounded-xl border px-4 py-3 text-left transition-all lg:min-w-0",
                  )}
                  style={{
                    color: selected
                      ? color("textPrimary")
                      : color("textSecondary"),
                    background: selected
                      ? colorAlpha("primary", 0.12)
                      : colorAlpha("bgCard", 0.24),
                    borderColor: colorAlpha(
                      selected ? "primary" : "border",
                      selected ? 0.42 : 0.28,
                    ),
                    boxShadow: selected
                      ? `0 0 18px ${colorAlpha("primary", 0.14)}`
                      : "none",
                  }}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{section.title}</p>
                    <p
                      className="mt-1 text-xs"
                      style={{
                        color: colorAlpha("textMuted", selected ? 0.84 : 0.7),
                      }}
                    >
                      {section.description}
                    </p>
                  </div>
                  <p
                    className="mt-3 text-xs"
                    style={{
                      color: colorAlpha("textMuted", selected ? 0.84 : 0.72),
                    }}
                  >
                    {getSectionSummary(section.id, world)}
                  </p>
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </div>
    </Panel>
  );
}

function SummaryMetric({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="rounded-lg border px-3 py-2"
      style={{
        borderColor: colorAlpha("border", 0.28),
        background: colorAlpha("bgCard", 0.28),
      }}
    >
      <p
        className="text-[11px]"
        style={{ color: colorAlpha("textMuted", 0.7) }}
      >
        {label}
      </p>
      <p
        className="mt-1 text-sm font-medium"
        style={{ color: color("textPrimary") }}
      >
        {value}
      </p>
    </div>
  );
}
