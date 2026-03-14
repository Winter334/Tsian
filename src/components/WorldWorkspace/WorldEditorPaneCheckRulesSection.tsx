import { Plus, Trash2 } from "lucide-react";

import { Button, Input, Panel } from "@/components/ui";
import type { World } from "@/lib/world/types";
import { color, colorAlpha } from "@/styles/tokens";

import {
  WorldEditorEmptySectionHint,
  WorldEditorField,
  WorldEditorFormSection,
  WorldEditorInventoryCard,
  WorldEditorSectionRulesEditorButton,
  WorldEditorToggleSetting,
} from "./WorldEditorPaneInventorySectionShared";

type CheckRulesValue = World["rules"]["checkRules"];
type DCPresetConfig = NonNullable<CheckRulesValue["dcPresets"]>[string];
type OpposedPresetConfig = NonNullable<
  CheckRulesValue["opposedPresets"]
>[string];
type DCGuidelineScaleItem = NonNullable<
  NonNullable<CheckRulesValue["dcGuideline"]>["scale"]
>[number];

interface WorldEditorPaneCheckRulesSectionProps {
  checkRules: CheckRulesValue;
  dcPresetEntries: Array<[string, DCPresetConfig]>;
  opposedPresetEntries: Array<[string, OpposedPresetConfig]>;
  dcGuidelineScale: readonly DCGuidelineScaleItem[];
  rulesEditorActive: boolean;
  rulesEditorTitle: string;
  onOpenRulesEditor: () => void;
  onUpdateCheckRules: (updates: Partial<CheckRulesValue>) => void;
  onAddDcPreset: () => void;
  onUpdateDcPreset: (
    presetKey: string,
    updates: Partial<DCPresetConfig>,
  ) => void;
  onRemoveDcPreset: (presetKey: string) => void;
  onAddOpposedPreset: () => void;
  onUpdateOpposedPreset: (
    presetKey: string,
    updates: Partial<OpposedPresetConfig>,
  ) => void;
  onRemoveOpposedPreset: (presetKey: string) => void;
  onAddDCGuidelineItem: () => void;
  onUpdateDCGuidelineItem: (
    index: number,
    updates: Partial<DCGuidelineScaleItem>,
  ) => void;
  onRemoveDCGuidelineItem: (index: number) => void;
}

export function WorldEditorPaneCheckRulesSection({
  checkRules,
  dcPresetEntries,
  opposedPresetEntries,
  dcGuidelineScale,
  rulesEditorActive,
  rulesEditorTitle,
  onOpenRulesEditor,
  onUpdateCheckRules,
  onAddDcPreset,
  onUpdateDcPreset,
  onRemoveDcPreset,
  onAddOpposedPreset,
  onUpdateOpposedPreset,
  onRemoveOpposedPreset,
  onAddDCGuidelineItem,
  onUpdateDCGuidelineItem,
  onRemoveDCGuidelineItem,
}: WorldEditorPaneCheckRulesSectionProps) {
  return (
    <WorldEditorFormSection
      title="检定规则"
      description="面向普通作者配置默认骰、暴击阈值、DC 预设与 AI 情境难度参考，复杂规则继续由高级 JSON 兜底。"
      action={
        <div className="flex flex-wrap gap-2">
          <WorldEditorSectionRulesEditorButton
            active={rulesEditorActive}
            title={rulesEditorTitle}
            onOpen={onOpenRulesEditor}
          />
        </div>
      }
    >
      <CheckRulesBasePanel
        checkRules={checkRules}
        onChange={onUpdateCheckRules}
      />

      <PresetListCard
        title="DC 公式预设"
        description="用于给常见检定提供默认难度公式与推荐技能。可参考 preset 的语义用途，但表单保持面向作者表达。"
        emptyMessage="当前还没有 DC 公式预设，AI 只能依赖显式 dcFormula 或 AI 难度参考。"
        onAdd={onAddDcPreset}
        addLabel="添加 DC 预设"
      >
        {dcPresetEntries.map(([presetKey, preset], index) => (
          <DCPresetCardEditor
            key={presetKey}
            presetKey={presetKey}
            preset={preset}
            index={index}
            onChange={(updates) => onUpdateDcPreset(presetKey, updates)}
            onRemove={() => onRemoveDcPreset(presetKey)}
          />
        ))}
      </PresetListCard>

      <PresetListCard
        title="对抗检定预设"
        description="用于 preset + opposedEntity 场景，提前说明攻方/守方默认使用的技能字段。"
        emptyMessage="当前还没有对抗检定预设，AI 需逐次显式填写 opposedSkill 等字段。"
        onAdd={onAddOpposedPreset}
        addLabel="添加对抗预设"
      >
        {opposedPresetEntries.map(([presetKey, preset], index) => (
          <OpposedPresetCardEditor
            key={presetKey}
            presetKey={presetKey}
            preset={preset}
            index={index}
            onChange={(updates) => onUpdateOpposedPreset(presetKey, updates)}
            onRemove={() => onRemoveOpposedPreset(presetKey)}
          />
        ))}
      </PresetListCard>

      <PresetListCard
        title="AI 情境 DC 参考"
        description="供 AI 在 dcSource=ai 场景下理解难度分级。这里表达的是作者想让 AI 参考的难度刻度，而不是 prompt 文本本身。"
        emptyMessage="当前还没有 AI 难度刻度，AI 会缺少世界专属的 DC 参考表。"
        onAdd={onAddDCGuidelineItem}
        addLabel="添加难度刻度"
      >
        {dcGuidelineScale.map((item, index) => (
          <DCGuidelineScaleCardEditor
            key={`${item.label}-${item.dc}-${index}`}
            item={item}
            index={index}
            onChange={(updates) => onUpdateDCGuidelineItem(index, updates)}
            onRemove={() => onRemoveDCGuidelineItem(index)}
          />
        ))}
      </PresetListCard>
    </WorldEditorFormSection>
  );
}

function CheckRulesBasePanel({
  checkRules,
  onChange,
}: {
  checkRules: CheckRulesValue;
  onChange: (updates: Partial<CheckRulesValue>) => void;
}) {
  return (
    <WorldEditorInventoryCard variant="outlined" className="space-y-4 p-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <WorldEditorField label="默认骰子表达式">
          <Input
            value={checkRules.defaultDice ?? ""}
            onChange={(event) => onChange({ defaultDice: event.target.value })}
            placeholder="1d20 / 2d6 / 1d100"
          />
        </WorldEditorField>
        <WorldEditorField label="暴击阈值（可选）">
          <Input
            type="number"
            value={checkRules.criticalSuccessThreshold ?? ""}
            onChange={(event) =>
              onChange({
                criticalSuccessThreshold:
                  event.target.value.trim() === ""
                    ? undefined
                    : Number(event.target.value),
              })
            }
          />
        </WorldEditorField>
        <WorldEditorField label="大失败阈值（可选）">
          <Input
            type="number"
            value={checkRules.criticalFailureThreshold ?? ""}
            onChange={(event) =>
              onChange({
                criticalFailureThreshold:
                  event.target.value.trim() === ""
                    ? undefined
                    : Number(event.target.value),
              })
            }
          />
        </WorldEditorField>
        <WorldEditorToggleSetting
          title="允许对抗检定"
          description="控制作者态是否开放 contested / opposed 场景的基础规则入口。"
          checked={checkRules.allowContest ?? false}
          onCheckedChange={(checked) => onChange({ allowContest: checked })}
        />
      </div>

      <p className="text-xs" style={{ color: colorAlpha("textMuted", 0.72) }}>
        DC 预设用于复用常见公式；对抗预设用于声明攻防双方技能；AI 难度刻度用于让
        dcSource=ai 更贴合该世界的难度感受。
      </p>
    </WorldEditorInventoryCard>
  );
}

function PresetListCard({
  title,
  description,
  emptyMessage,
  onAdd,
  addLabel,
  children,
}: {
  title: string;
  description: string;
  emptyMessage: string;
  onAdd: () => void;
  addLabel: string;
  children: React.ReactNode;
}) {
  const hasChildren = Array.isArray(children)
    ? children.length > 0
    : Boolean(children);

  return (
    <WorldEditorInventoryCard variant="outlined" className="space-y-4 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4
            className="text-sm font-semibold"
            style={{ color: color("textPrimary") }}
          >
            {title}
          </h4>
          <p
            className="mt-1 text-xs"
            style={{ color: colorAlpha("textMuted", 0.72) }}
          >
            {description}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onAdd}>
          <Plus className="mr-1 h-4 w-4" />
          {addLabel}
        </Button>
      </div>

      {hasChildren ? (
        children
      ) : (
        <WorldEditorEmptySectionHint message={emptyMessage} />
      )}
    </WorldEditorInventoryCard>
  );
}

function PresetKeyBadge({ presetKey }: { presetKey: string }) {
  return (
    <p className="text-xs" style={{ color: colorAlpha("textMuted", 0.72) }}>
      preset key：{presetKey}
    </p>
  );
}

function DCPresetCardEditor({
  presetKey,
  preset,
  index,
  onChange,
  onRemove,
}: {
  presetKey: string;
  preset: DCPresetConfig;
  index: number;
  onChange: (updates: Partial<DCPresetConfig>) => void;
  onRemove: () => void;
}) {
  return (
    <Panel variant="outlined" className="space-y-4 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p
            className="text-sm font-semibold"
            style={{ color: color("textPrimary") }}
          >
            {preset.label || `DC 预设 ${index + 1}`}
          </p>
          <PresetKeyBadge presetKey={presetKey} />
        </div>
        <Button variant="outline" size="sm" onClick={onRemove}>
          <Trash2 className="mr-1 h-4 w-4" />
          删除预设
        </Button>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <WorldEditorField label="显示名">
          <Input
            value={preset.label}
            onChange={(event) => onChange({ label: event.target.value })}
            placeholder="攀爬 / 洞察 / 搜索"
          />
        </WorldEditorField>
        <WorldEditorField label="DC 公式">
          <Input
            value={preset.formula}
            onChange={(event) => onChange({ formula: event.target.value })}
            placeholder="10 + level"
          />
        </WorldEditorField>
        <WorldEditorField label="默认技能（可选）">
          <Input
            value={preset.defaultSkill ?? ""}
            onChange={(event) =>
              onChange({
                defaultSkill:
                  event.target.value.trim() === ""
                    ? undefined
                    : event.target.value,
              })
            }
            placeholder="perception"
          />
        </WorldEditorField>
      </div>
    </Panel>
  );
}

function OpposedPresetCardEditor({
  presetKey,
  preset,
  index,
  onChange,
  onRemove,
}: {
  presetKey: string;
  preset: OpposedPresetConfig;
  index: number;
  onChange: (updates: Partial<OpposedPresetConfig>) => void;
  onRemove: () => void;
}) {
  return (
    <Panel variant="outlined" className="space-y-4 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p
            className="text-sm font-semibold"
            style={{ color: color("textPrimary") }}
          >
            {preset.label || `对抗预设 ${index + 1}`}
          </p>
          <PresetKeyBadge presetKey={presetKey} />
        </div>
        <Button variant="outline" size="sm" onClick={onRemove}>
          <Trash2 className="mr-1 h-4 w-4" />
          删除预设
        </Button>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <WorldEditorField label="显示名">
          <Input
            value={preset.label}
            onChange={(event) => onChange({ label: event.target.value })}
            placeholder="擒抱 / 拔河 / 魅惑对抗"
          />
        </WorldEditorField>
        <WorldEditorField label="攻方技能">
          <Input
            value={preset.attackerSkill}
            onChange={(event) =>
              onChange({ attackerSkill: event.target.value })
            }
            placeholder="attack"
          />
        </WorldEditorField>
        <WorldEditorField label="守方技能">
          <Input
            value={preset.defenderSkill}
            onChange={(event) =>
              onChange({ defenderSkill: event.target.value })
            }
            placeholder="defense"
          />
        </WorldEditorField>
      </div>
    </Panel>
  );
}

function DCGuidelineScaleCardEditor({
  item,
  index,
  onChange,
  onRemove,
}: {
  item: DCGuidelineScaleItem;
  index: number;
  onChange: (updates: Partial<DCGuidelineScaleItem>) => void;
  onRemove: () => void;
}) {
  return (
    <Panel variant="outlined" className="space-y-4 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p
          className="text-sm font-semibold"
          style={{ color: color("textPrimary") }}
        >
          难度刻度 {index + 1}
        </p>
        <Button variant="outline" size="sm" onClick={onRemove}>
          <Trash2 className="mr-1 h-4 w-4" />
          删除刻度
        </Button>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <WorldEditorField label="难度名称">
          <Input
            value={item.label}
            onChange={(event) => onChange({ label: event.target.value })}
            placeholder="困难"
          />
        </WorldEditorField>
        <WorldEditorField label="DC 数值">
          <Input
            type="number"
            value={item.dc}
            onChange={(event) =>
              onChange({ dc: Number(event.target.value) || 0 })
            }
          />
        </WorldEditorField>
        <WorldEditorField label="说明">
          <Input
            value={item.description}
            onChange={(event) => onChange({ description: event.target.value })}
            placeholder="受过训练的角色可稳定完成"
          />
        </WorldEditorField>
      </div>
    </Panel>
  );
}
