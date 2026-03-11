/**
 * 世界工作台主组件
 *
 * 全屏作者态世界编辑工作区：
 * - 左侧世界列表
 * - 右侧主编辑区
 * - 移动端按列表 / 编辑双页切换
 */

import { AnimatePresence, motion } from "framer-motion";
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";

import { StarfieldBackground } from "@/components/effects/StarfieldBackground";
import { ConfirmDialog, Overlay, useToast } from "@/components/ui";
import { useThemeEffectSwitches } from "@/hooks";
import { cn } from "@/lib/utils";
import {
  borders,
  colorAlpha,
  panelVariants,
  stepBackwardVariants,
  stepForwardVariants,
} from "@/styles/tokens";

import {
  useWorldWorkspaceState,
  type WorldRulesEditorScope,
  type WorldWorkspaceMobilePage,
} from "./hooks/useWorldWorkspaceState";
import { WorldEditorPane } from "./WorldEditorPane";
import { WorldListPane } from "./WorldListPane";
import { WorldWorkspaceToolbar } from "./WorldWorkspaceToolbar";

const LG_BREAKPOINT = 1024;

function getRawRulesApplySuccessMessage(scope: WorldRulesEditorScope): string {
  switch (scope) {
    case "attributes":
      return "属性与点数分区规则 JSON 已同步到当前草稿";
    case "derivedStats":
      return "衍生属性分区规则 JSON 已同步到当前草稿";
    case "checkRules":
      return "检定规则分区 JSON 已同步到当前草稿";
    case "conditions":
      return "状态分区规则 JSON 已同步到当前草稿";
    case "dimensions":
      return "角色维度分区规则 JSON 已同步到当前草稿";
    case "talents":
      return "天赋分区规则 JSON 已同步到当前草稿";
    case "itemTemplates":
      return "物品模板分区规则 JSON 已同步到当前草稿";
    case "skillTemplates":
      return "技能模板分区规则 JSON 已同步到当前草稿";
    case "full":
    default:
      return "全量规则 JSON 已同步到当前草稿";
  }
}

function useIsDesktop(): boolean {
  return useSyncExternalStore(
    (callback) => {
      const mediaQuery = window.matchMedia(`(min-width: ${LG_BREAKPOINT}px)`);
      mediaQuery.addEventListener("change", callback);
      return () => mediaQuery.removeEventListener("change", callback);
    },
    () => window.matchMedia(`(min-width: ${LG_BREAKPOINT}px)`).matches,
    () => true,
  );
}

interface WorldWorkspaceProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WorldWorkspace({ open, onOpenChange }: WorldWorkspaceProps) {
  const isDesktop = useIsDesktop();
  const workspace = useWorldWorkspaceState();
  const { success, error } = useToast();
  const { isParticlesEnabled } = useThemeEffectSwitches();
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);

  const handleCloseRequest = useCallback(() => {
    if (workspace.isDirty) {
      setCloseConfirmOpen(true);
      return;
    }

    onOpenChange(false);
  }, [onOpenChange, workspace.isDirty]);

  const handleConfirmClose = useCallback(() => {
    workspace.resetDraft();
    setCloseConfirmOpen(false);
    onOpenChange(false);
  }, [onOpenChange, workspace]);

  const handleCreateWorld = useCallback(() => {
    workspace.createWorld((created) => {
      success("已创建", `世界「${created.meta.name}」已加入工作台`);
    });
  }, [success, workspace]);

  const handleImportWorld = useCallback(
    (file: File) => {
      workspace.importWorldFromFile(file, {
        onSuccess: (imported) => {
          success("导入成功", `已导入世界「${imported.meta.name}」`);
        },
        onError: (err) => {
          error("导入世界失败", err.message);
        },
      });
    },
    [error, success, workspace],
  );

  const handleSave = useCallback(async () => {
    try {
      const world = await workspace.saveSelectedWorld();
      if (world) {
        success("已保存", `世界「${world.meta.name}」已写入存储`);
      }
    } catch (err) {
      error("保存失败", err instanceof Error ? err.message : "未知错误");
    }
  }, [error, success, workspace]);

  const handleReset = useCallback(() => {
    workspace.resetDraft();
    success("已重置", "草稿已恢复到最近一次保存状态");
  }, [success, workspace]);

  const handleToggleRawRulesEditor = useCallback(() => {
    if (
      workspace.rawRulesEditorOpen &&
      workspace.rawRulesEditorScope === "full"
    ) {
      workspace.closeRawRulesEditor();
      return;
    }

    workspace.openRawRulesEditor("full");
  }, [workspace]);

  const handleApplyRawRulesText = useCallback(() => {
    try {
      workspace.applyRawRulesText();
      success(
        "规则已应用",
        getRawRulesApplySuccessMessage(workspace.rawRulesEditorScope),
      );
    } catch (err) {
      error("规则解析失败", err instanceof Error ? err.message : "未知错误");
    }
  }, [error, success, workspace]);

  const handleExportWorld = useCallback(() => {
    workspace.exportSelectedWorld();
    if (workspace.draft) {
      success("已导出", `世界「${workspace.draft.meta.name}」已开始下载`);
    }
  }, [success, workspace]);

  const handleDeleteWorld = useCallback(
    (id: string) => {
      workspace.deleteWorld(id);
    },
    [workspace],
  );

  useEffect(() => {
    if (!open) {
      setCloseConfirmOpen(false);
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) {
        return;
      }

      if (closeConfirmOpen) {
        return;
      }

      event.preventDefault();
      handleCloseRequest();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closeConfirmOpen, handleCloseRequest, open]);

  const editorPane = useMemo(
    () => (
      <WorldEditorPane
        world={workspace.draft}
        validationMessages={workspace.validationMessages}
        rawRulesEditorOpen={workspace.rawRulesEditorOpen}
        rawRulesEditorScope={workspace.rawRulesEditorScope}
        rawRulesText={workspace.rawRulesText}
        rawRulesError={workspace.rawRulesError}
        onOpenRawRulesEditor={workspace.openRawRulesEditor}
        onCloseRawRulesEditor={workspace.closeRawRulesEditor}
        onUpdateMeta={workspace.updateMeta}
        onUpdateNarrative={workspace.updateNarrative}
        onUpdatePrimaryAttribute={workspace.updatePrimaryAttribute}
        onAddPrimaryAttribute={workspace.addPrimaryAttribute}
        onRemovePrimaryAttribute={workspace.removePrimaryAttribute}
        onUpdatePointBuyRules={workspace.updatePointBuyRules}
        onUpdateCheckRules={workspace.updateCheckRules}
        onAddDcPreset={workspace.addDcPreset}
        onUpdateDcPreset={workspace.updateDcPreset}
        onRemoveDcPreset={workspace.removeDcPreset}
        onAddOpposedPreset={workspace.addOpposedPreset}
        onUpdateOpposedPreset={workspace.updateOpposedPreset}
        onRemoveOpposedPreset={workspace.removeOpposedPreset}
        onAddDCGuidelineItem={workspace.addDCGuidelineItem}
        onUpdateDCGuidelineItem={workspace.updateDCGuidelineItem}
        onRemoveDCGuidelineItem={workspace.removeDCGuidelineItem}
        onUpdateDerivedStat={workspace.updateDerivedStat}
        onAddDerivedStat={workspace.addDerivedStat}
        onRemoveDerivedStat={workspace.removeDerivedStat}
        onUpdateCondition={workspace.updateCondition}
        onAddCondition={workspace.addCondition}
        onRemoveCondition={workspace.removeCondition}
        onUpdateDimension={workspace.updateDimension}
        onAddDimension={workspace.addDimension}
        onRemoveDimension={workspace.removeDimension}
        onUpdateDimensionOption={workspace.updateDimensionOption}
        onAddDimensionOption={workspace.addDimensionOption}
        onRemoveDimensionOption={workspace.removeDimensionOption}
        onUpdateTalentRules={workspace.updateTalentRules}
        onUpdateTalent={workspace.updateTalent}
        onAddTalent={workspace.addTalent}
        onRemoveTalent={workspace.removeTalent}
        onUpdateItemTemplate={workspace.updateItemTemplate}
        onAddItemTemplate={workspace.addItemTemplate}
        onRemoveItemTemplate={workspace.removeItemTemplate}
        onUpdateSkillTemplate={workspace.updateSkillTemplate}
        onAddSkillTemplate={workspace.addSkillTemplate}
        onRemoveSkillTemplate={workspace.removeSkillTemplate}
        onSetRawRulesText={workspace.setRawRulesText}
        onApplyRawRulesText={handleApplyRawRulesText}
      />
    ),
    [handleApplyRawRulesText, workspace],
  );

  const renderMobilePage = useCallback(
    (page: WorldWorkspaceMobilePage) => {
      switch (page) {
        case "list":
          return (
            <WorldListPane
              worlds={workspace.worlds}
              activeWorldId={workspace.activeWorldId}
              selectedWorldId={workspace.selectedWorldId}
              onSelectWorld={workspace.selectWorld}
              onSetActiveWorld={workspace.setActiveWorld}
              onDeleteWorld={handleDeleteWorld}
            />
          );
        case "editor":
        default:
          return editorPane;
      }
    },
    [editorPane, handleDeleteWorld, workspace],
  );

  return (
    <AnimatePresence>
      {open && (
        <Fragment key="workspace-shell">
          <Overlay onClick={handleCloseRequest} />

          <motion.div
            variants={panelVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className={cn(
              "fixed inset-1 z-50 flex flex-col overflow-hidden sm:inset-3 lg:inset-4",
            )}
            style={{
              background: colorAlpha("bgBase", 0.95),
              borderRadius: borders.radius.lg,
              border: `${borders.width.medium} solid ${colorAlpha("primary", 0.4)}`,
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
            }}
          >
            {isParticlesEnabled && (
              <div
                className="pointer-events-none absolute inset-0"
                style={{ zIndex: 0 }}
              >
                <StarfieldBackground transparentBackground useThemeColors />
              </div>
            )}

            <div className="relative z-10 flex h-full min-h-0 flex-col">
              <WorldWorkspaceToolbar
                isDesktop={isDesktop}
                mobilePage={workspace.mobilePage}
                isDirty={workspace.isDirty}
                isSaving={workspace.isSaving}
                hasSelection={!!workspace.draft}
                rawRulesEditorOpen={workspace.rawRulesEditorOpen}
                rawRulesEditorScope={workspace.rawRulesEditorScope}
                onNavigateMobile={workspace.setMobilePage}
                onCreateWorld={() => {
                  void handleCreateWorld();
                }}
                onImportFile={(file) => {
                  void handleImportWorld(file);
                }}
                onExportWorld={handleExportWorld}
                onSave={() => {
                  void handleSave();
                }}
                onReset={handleReset}
                onToggleRawRulesEditor={handleToggleRawRulesEditor}
                onClose={handleCloseRequest}
              />

              <div className="relative min-h-0 flex-1 overflow-hidden">
                {isDesktop ? (
                  <DesktopLayout
                    listPane={
                      <WorldListPane
                        worlds={workspace.worlds}
                        activeWorldId={workspace.activeWorldId}
                        selectedWorldId={workspace.selectedWorldId}
                        onSelectWorld={workspace.selectWorld}
                        onSetActiveWorld={workspace.setActiveWorld}
                        onDeleteWorld={handleDeleteWorld}
                      />
                    }
                    editorPane={editorPane}
                  />
                ) : (
                  <MobileLayout
                    page={workspace.mobilePage}
                    renderPage={renderMobilePage}
                  />
                )}
              </div>
            </div>
          </motion.div>

          <AnimatePresence>
            {closeConfirmOpen && (
              <OverlayConfirmation
                onConfirm={handleConfirmClose}
                onCancel={() => setCloseConfirmOpen(false)}
              />
            )}
          </AnimatePresence>
        </Fragment>
      )}

      <ConfirmDialog
        key="discard-confirm"
        open={workspace.discardConfirm.open}
        onOpenChange={(open: boolean) => {
          if (!open) {
            workspace.handleCancelDiscard();
          }
        }}
        title="确认放弃修改"
        description={workspace.discardConfirm.message}
        confirmText="继续"
        cancelText="取消"
        onConfirm={workspace.handleConfirmDiscard}
        onCancel={workspace.handleCancelDiscard}
      />

      <ConfirmDialog
        key="delete-confirm"
        open={workspace.pendingDeleteWorld !== null}
        onOpenChange={(open: boolean) => {
          if (!open) {
            workspace.cancelDeleteWorld();
          }
        }}
        title="确认删除"
        description={`确定删除「${workspace.pendingDeleteWorld?.name ?? ""}」吗？此操作不可撤销。`}
        variant="destructive"
        confirmText="删除"
        cancelText="取消"
        onConfirm={async () => {
          await workspace.confirmDeleteWorld();
          success("已删除", "世界已从作者态存储中移除");
        }}
        onCancel={workspace.cancelDeleteWorld}
      />
    </AnimatePresence>
  );
}

function DesktopLayout({
  listPane,
  editorPane,
}: {
  listPane: React.ReactNode;
  editorPane: React.ReactNode;
}) {
  return (
    <div className="flex h-full min-h-0">
      <div
        className="h-full min-h-0 w-72 shrink-0 border-r"
        style={{ borderColor: colorAlpha("primary", 0.16) }}
      >
        {listPane}
      </div>
      <div className="h-full min-h-0 min-w-0 flex-1">{editorPane}</div>
    </div>
  );
}

function MobileLayout({
  page,
  renderPage,
}: {
  page: WorldWorkspaceMobilePage;
  renderPage: (page: WorldWorkspaceMobilePage) => React.ReactNode;
}) {
  return (
    <div className="relative h-full min-h-0 overflow-hidden">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={page}
          className="h-full min-h-0"
          variants={
            page === "list" ? stepBackwardVariants : stepForwardVariants
          }
          initial="hidden"
          animate="visible"
          exit="exit"
        >
          {renderPage(page)}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function OverlayConfirmation({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-60 flex items-center justify-center p-4"
    >
      <div
        className="absolute inset-0"
        style={{ background: colorAlpha("bgBase", 0.72) }}
        onClick={onCancel}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        className="relative z-10 w-full max-w-md rounded-2xl border p-5"
        style={{
          background: colorAlpha("bgElevated", 0.96),
          borderColor: colorAlpha("primary", 0.32),
          boxShadow: `0 0 30px ${colorAlpha("bgBase", 0.32)}`,
        }}
      >
        <h3
          className="text-base font-semibold"
          style={{ color: colorAlpha("textPrimary", 1) }}
        >
          放弃未保存修改？
        </h3>
        <p
          className="mt-2 text-sm"
          style={{ color: colorAlpha("textMuted", 0.78) }}
        >
          当前世界仍有未保存内容，关闭工作台会直接丢弃本次草稿。
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            className="rounded-md border px-3 py-2 text-sm"
            style={{
              borderColor: colorAlpha("border", 0.32),
              color: colorAlpha("textSecondary", 1),
            }}
            onClick={onCancel}
          >
            继续编辑
          </button>
          <button
            type="button"
            className="rounded-md px-3 py-2 text-sm font-medium"
            style={{
              background: colorAlpha("warning", 0.18),
              color: colorAlpha("warning", 1),
              border: `1px solid ${colorAlpha("warning", 0.3)}`,
            }}
            onClick={onConfirm}
          >
            放弃并关闭
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
