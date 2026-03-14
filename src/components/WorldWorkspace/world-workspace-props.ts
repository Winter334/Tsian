/**
 * 世界工作台 props 适配层
 *
 * 负责把 WorldWorkspace 的壳层状态整理为各子面板的稳定 props，
 * 避免在壳层组件中堆积长串透传与动作打包。
 */

import type { ComponentProps } from "react";

import type {
  WorldWorkspaceActions,
  WorldWorkspaceState,
} from "./hooks/useWorldWorkspaceState";

type WorldEditorPaneProps = ComponentProps<
  (typeof import("./WorldEditorPane"))["WorldEditorPane"]
>;
type WorldListPaneProps = ComponentProps<
  (typeof import("./WorldListPane"))["WorldListPane"]
>;
type WorldWorkspaceToolbarProps = ComponentProps<
  (typeof import("./WorldWorkspaceToolbar"))["WorldWorkspaceToolbar"]
>;

type WorldWorkspaceViewModel = WorldWorkspaceState & WorldWorkspaceActions;

interface BuildWorldEditorPanePropsOptions {
  onApplyRawRulesText: WorldEditorPaneProps["onApplyRawRulesText"];
}

interface BuildWorldListPanePropsOptions {
  onDeleteWorld: WorldListPaneProps["onDeleteWorld"];
}

interface BuildWorldWorkspaceToolbarPropsOptions {
  isDesktop: boolean;
  onCreateWorld: WorldWorkspaceToolbarProps["onCreateWorld"];
  onImportFile: WorldWorkspaceToolbarProps["onImportFile"];
  onExportWorld: WorldWorkspaceToolbarProps["onExportWorld"];
  onSave: WorldWorkspaceToolbarProps["onSave"];
  onReset: WorldWorkspaceToolbarProps["onReset"];
  onResetToDefault: NonNullable<WorldWorkspaceToolbarProps["onResetToDefault"]>;
  onToggleRawRulesEditor: WorldWorkspaceToolbarProps["onToggleRawRulesEditor"];
  onClose: WorldWorkspaceToolbarProps["onClose"];
}

export function buildWorldEditorPaneProps(
  workspace: WorldWorkspaceViewModel,
  options: BuildWorldEditorPanePropsOptions,
): WorldEditorPaneProps {
  const editorStateProps = {
    world: workspace.draft,
    validationMessages: workspace.validationMessages,
  };

  const rawRulesEditorProps = {
    rawRulesEditorOpen: workspace.rawRulesEditorOpen,
    rawRulesEditorScope: workspace.rawRulesEditorScope,
    rawRulesText: workspace.rawRulesText,
    rawRulesError: workspace.rawRulesError,
    onOpenRawRulesEditor: workspace.openRawRulesEditor,
    onCloseRawRulesEditor: workspace.closeRawRulesEditor,
    onSetRawRulesText: workspace.setRawRulesText,
    onApplyRawRulesText: options.onApplyRawRulesText,
  };

  const baseSectionActions = {
    onUpdateMeta: workspace.updateMeta,
    onUpdateNarrative: workspace.updateNarrative,
  };

  const attributeSectionActions = {
    onUpdatePrimaryAttribute: workspace.updatePrimaryAttribute,
    onAddPrimaryAttribute: workspace.addPrimaryAttribute,
    onRemovePrimaryAttribute: workspace.removePrimaryAttribute,
    onUpdatePointBuyRules: workspace.updatePointBuyRules,
  };

  const checkRuleSectionActions = {
    onUpdateCheckRules: workspace.updateCheckRules,
    onAddDcPreset: workspace.addDcPreset,
    onUpdateDcPreset: workspace.updateDcPreset,
    onRemoveDcPreset: workspace.removeDcPreset,
    onAddOpposedPreset: workspace.addOpposedPreset,
    onUpdateOpposedPreset: workspace.updateOpposedPreset,
    onRemoveOpposedPreset: workspace.removeOpposedPreset,
    onAddDCGuidelineItem: workspace.addDCGuidelineItem,
    onUpdateDCGuidelineItem: workspace.updateDCGuidelineItem,
    onRemoveDCGuidelineItem: workspace.removeDCGuidelineItem,
  };

  const derivedStatSectionActions = {
    onUpdateDerivedStat: workspace.updateDerivedStat,
    onAddDerivedStat: workspace.addDerivedStat,
    onRemoveDerivedStat: workspace.removeDerivedStat,
  };

  const conditionSectionActions = {
    onUpdateCondition: workspace.updateCondition,
    onAddCondition: workspace.addCondition,
    onRemoveCondition: workspace.removeCondition,
  };

  const dimensionSectionActions = {
    onUpdateDimension: workspace.updateDimension,
    onAddDimension: workspace.addDimension,
    onRemoveDimension: workspace.removeDimension,
    onUpdateDimensionOption: workspace.updateDimensionOption,
    onAddDimensionOption: workspace.addDimensionOption,
    onRemoveDimensionOption: workspace.removeDimensionOption,
  };

  const talentSectionActions = {
    onUpdateTalentRules: workspace.updateTalentRules,
    onAddTalentRarity: workspace.addTalentRarity,
    onRemoveTalentRarity: workspace.removeTalentRarity,
    onUpdateTalentRarity: workspace.updateTalentRarity,
    onAddTalentPool: workspace.addTalentPool,
    onRemoveTalentPool: workspace.removeTalentPool,
    onUpdateTalentPool: workspace.updateTalentPool,
    onAddTalentPityRule: workspace.addTalentPityRule,
    onRemoveTalentPityRule: workspace.removeTalentPityRule,
    onUpdateTalentPityRule: workspace.updateTalentPityRule,
    onUpdateLevelSystem: workspace.updateLevelSystem,
    onUpdateTalent: workspace.updateTalent,
    onAddTalent: workspace.addTalent,
    onRemoveTalent: workspace.removeTalent,
  };

  const inventorySectionActions = {
    onAddEquipSlot: workspace.addEquipSlot,
    onUpdateEquipSlot: workspace.updateEquipSlot,
    onRemoveEquipSlot: workspace.removeEquipSlot,
    onUpdateDefaultCapacity: workspace.updateDefaultCapacity,
    onUpdateItemTemplate: workspace.updateItemTemplate,
    onAddItemTemplate: workspace.addItemTemplate,
    onRemoveItemTemplate: workspace.removeItemTemplate,
    onUpdateSkillTemplate: workspace.updateSkillTemplate,
    onAddSkillTemplate: workspace.addSkillTemplate,
    onRemoveSkillTemplate: workspace.removeSkillTemplate,
  };

  return {
    ...editorStateProps,
    ...rawRulesEditorProps,
    ...baseSectionActions,
    ...attributeSectionActions,
    ...checkRuleSectionActions,
    ...derivedStatSectionActions,
    ...conditionSectionActions,
    ...dimensionSectionActions,
    ...talentSectionActions,
    ...inventorySectionActions,
  };
}

export function buildWorldListPaneProps(
  workspace: WorldWorkspaceViewModel,
  options: BuildWorldListPanePropsOptions,
): WorldListPaneProps {
  return {
    worlds: workspace.worlds,
    activeWorldId: workspace.activeWorldId,
    selectedWorldId: workspace.selectedWorldId,
    onSelectWorld: workspace.selectWorld,
    onSetActiveWorld: workspace.setActiveWorld,
    onDeleteWorld: options.onDeleteWorld,
  };
}

export function buildWorldWorkspaceToolbarProps(
  workspace: WorldWorkspaceViewModel,
  options: BuildWorldWorkspaceToolbarPropsOptions,
): WorldWorkspaceToolbarProps {
  const toolbarStateProps = {
    isDesktop: options.isDesktop,
    mobilePage: workspace.mobilePage,
    isDirty: workspace.isDirty,
    isSaving: workspace.isSaving,
    hasSelection: workspace.draft !== null,
  };

  const rawRulesToolbarProps = {
    rawRulesEditorOpen: workspace.rawRulesEditorOpen,
    rawRulesEditorScope: workspace.rawRulesEditorScope,
  };

  const toolbarActionProps = {
    onNavigateMobile: workspace.setMobilePage,
    onCreateWorld: options.onCreateWorld,
    onImportFile: options.onImportFile,
    onExportWorld: options.onExportWorld,
    onSave: options.onSave,
    onReset: options.onReset,
    onResetToDefault: options.onResetToDefault,
    onToggleRawRulesEditor: options.onToggleRawRulesEditor,
    onClose: options.onClose,
  };

  return {
    ...toolbarStateProps,
    ...rawRulesToolbarProps,
    ...toolbarActionProps,
  };
}
