/**
 * 预设工作区主组件
 *
 * 全屏工作区布局，支持：
 * - 多预设面板并排显示
 * - 跨预设拖拽复制/移动块
 * - 预设管理操作
 * - 块编辑弹窗
 */

import { DndContext, DragOverlay } from "@dnd-kit/core";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";

import { StarfieldBackground } from "@/components/effects/StarfieldBackground";
import { ConfirmDialog, Overlay } from "@/components/ui";
import { useThemeEffectSwitches } from "@/hooks";
import { usePresetStore } from "@/lib/prompt";
import { cn } from "@/lib/utils";
import { borders, color, colorAlpha, panelVariants } from "@/styles/tokens";

import { BlockEditorDialog } from "./BlockEditorDialog";
import { BlockItemOverlay } from "./BlockItem";
import { WorkspaceContext } from "./context";
import { usePresetDnd } from "./hooks/usePresetDnd";
import { useWorkspaceState } from "./hooks/useWorkspaceState";
import { ImportExportDialog } from "./ImportExportDialog";
import { PresetPanel } from "./PresetPanel";
import { PresetWorkspaceToolbar } from "./PresetWorkspaceToolbar";

// ===== 类型定义 =====

type ImportExportMode = "closed" | "import" | "export";

// ===== 组件 =====

interface PresetWorkspaceProps {
  /** 是否打开 */
  open: boolean;
  /** 关闭回调 */
  onOpenChange: (open: boolean) => void;
}

/**
 * 预设工作区主组件
 */
export function PresetWorkspace({ open, onOpenChange }: PresetWorkspaceProps) {
  const workspaceState = useWorkspaceState();
  const storeCreatePreset = usePresetStore((s) => s.createPreset);
  const { isParticlesEnabled } = useThemeEffectSwitches();
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [importExportMode, setImportExportMode] =
    useState<ImportExportMode>("closed");

  // 拖拽逻辑
  const {
    sensors,
    dndState,
    handleDragStart,
    handleDragOver,
    handleDragCancel,
    handleDragEnd,
  } = usePresetDnd(workspaceState.panels, {
    reorderBlocks: workspaceState.reorderBlocks,
    copyBlockToPanel: workspaceState.copyBlockToPanel,
    moveBlockToPanel: workspaceState.moveBlockToPanel,
  });

  // 获取当前正在编辑的块
  const editingBlockData = useMemo(() => {
    if (!workspaceState.editingBlock) return null;

    const { panelId, blockId } = workspaceState.editingBlock;
    const panel = workspaceState.panels.find((p) => p.id === panelId);
    if (!panel) return null;

    const block = panel.preset.blocks.find((b) => b.id === blockId);
    if (!block) return null;

    return { panelId, block };
  }, [workspaceState.editingBlock, workspaceState.panels]);

  // 处理关闭请求
  const handleCloseRequest = useCallback(() => {
    if (workspaceState.hasUnsavedChanges()) {
      setShowCloseConfirm(true);
    } else {
      onOpenChange(false);
    }
  }, [workspaceState, onOpenChange]);

  // 确认关闭（丢弃未保存的更改）
  const handleConfirmClose = useCallback(() => {
    // 清除所有面板状态（包括未保存的更改）
    workspaceState.closeAllPanels();
    onOpenChange(false);
  }, [workspaceState, onOpenChange]);

  // 处理背景点击
  const handleBackdropClick = () => {
    handleCloseRequest();
  };

  // 处理导入预设
  const handleImportPreset = useCallback(
    async (preset: import("@/lib/prompt").Preset) => {
      // 排除 id 和 metadata（由 createPreset 内部生成），其余字段透传
      const { id: _id, metadata: _meta, ...presetData } = preset;
      const newId = await storeCreatePreset({
        ...presetData,
        purpose: presetData.purpose ?? "narrative",
      });
      // 打开新导入的预设面板
      await workspaceState.openPanel(newId);
    },
    [storeCreatePreset, workspaceState],
  );

  // 获取当前可导出的预设列表（打开的面板中的预设）
  const presetsToExport = useMemo(() => {
    return workspaceState.panels.map((panel) => panel.preset);
  }, [workspaceState.panels]);

  // ===== 快捷键支持 =====
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;

      // Ctrl/Cmd + S: 保存所有更改
      if (isMod && e.key === "s") {
        e.preventDefault();
        if (workspaceState.hasUnsavedChanges()) {
          workspaceState.saveAllPanels();
        }
        return;
      }

      // Ctrl/Cmd + N: 新建预设
      if (isMod && e.key === "n") {
        e.preventDefault();
        workspaceState.createPreset();
        return;
      }

      // Escape: 关闭工作区（仅当没有编辑弹窗打开时）
      // 注意：BlockEditorDialog 使用 Dialog 组件，其 Escape 处理由 dialog.tsx 的全局监听器处理
      // 这里只处理没有编辑弹窗时的情况
      if (e.key === "Escape" && !workspaceState.editingBlock) {
        e.preventDefault();
        handleCloseRequest();
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, workspaceState, handleCloseRequest]);

  return (
    <WorkspaceContext.Provider value={workspaceState}>
      <AnimatePresence>
        {open && (
          <>
            {/* 背景遮罩 */}
            <Overlay onClick={handleBackdropClick} />

            {/* 工作区容器 */}
            <motion.div
              variants={panelVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className={cn(
                "fixed inset-4 z-50",
                "flex flex-col",
                "overflow-hidden",
              )}
              style={{
                background: colorAlpha("bgBase", 0.95),
                borderRadius: borders.radius.lg,
                border: `${borders.width.medium} solid ${colorAlpha(
                  "primary",
                  0.4,
                )}`,
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
              }}
            >
              {isParticlesEnabled && (
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{ zIndex: 0 }}
                >
                  <StarfieldBackground transparentBackground useThemeColors />
                </div>
              )}

              <div className="relative z-10 flex h-full flex-col">
                {/* 顶部工具栏 */}
                <PresetWorkspaceToolbar
                  onClose={handleCloseRequest}
                  onImport={() => setImportExportMode("import")}
                  onExport={() => setImportExportMode("export")}
                />

                {/* DnD 上下文包裹面板容器 */}
                <DndContext
                  sensors={sensors}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDragCancel={handleDragCancel}
                  onDragEnd={handleDragEnd}
                >
                  {/* 面板容器 */}
                  <div
                    className={cn(
                      "flex-1 overflow-hidden",
                      "flex gap-4 p-4",
                      "overflow-x-auto",
                    )}
                  >
                    {/* 渲染所有打开的预设面板 */}
                    <AnimatePresence mode="popLayout">
                      {workspaceState.panels.map((panel) => (
                        <PresetPanel
                          key={panel.id}
                          panel={panel}
                          activeDragBlockId={dndState.activeBlockId}
                          dragSourcePanelId={dndState.sourcePanelId}
                          dropIndicatorPanelId={dndState.overPanelId}
                          dropIndicatorIndex={dndState.overIndex}
                        />
                      ))}
                    </AnimatePresence>

                    {/* 空状态提示 */}
                    {workspaceState.panels.length === 0 && <EmptyState />}
                  </div>

                  {/* 拖拽覆盖层 */}
                  <DragOverlay>
                    {dndState.activeBlock && dndState.sourcePanelId && (
                      <BlockItemOverlay
                        block={dndState.activeBlock}
                        panelId={dndState.sourcePanelId}
                      />
                    )}
                  </DragOverlay>
                </DndContext>

                {/* 底部提示 */}
                <BottomHint />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* 块编辑弹窗 */}
      {editingBlockData && (
        <BlockEditorDialog
          open={!!editingBlockData}
          onOpenChange={(isOpen) => {
            if (!isOpen) {
              workspaceState.finishEditingBlock();
            }
          }}
          panelId={editingBlockData.panelId}
          block={editingBlockData.block}
        />
      )}

      {/* 关闭确认对话框 */}
      <ConfirmDialog
        open={showCloseConfirm}
        onOpenChange={setShowCloseConfirm}
        title="有未保存的更改"
        description="确定要关闭工作区吗？未保存的更改将会丢失。"
        confirmText="关闭"
        cancelText="取消"
        onConfirm={handleConfirmClose}
      />

      {/* 导入/导出对话框 */}
      <ImportExportDialog
        mode={importExportMode}
        onModeChange={setImportExportMode}
        onImport={handleImportPreset}
        presetsToExport={presetsToExport}
      />
    </WorkspaceContext.Provider>
  );
}

/**
 * 空状态提示
 */
function EmptyState() {
  return (
    <div
      className={cn("flex-1 flex items-center justify-center", "text-center")}
    >
      <div className="max-w-md">
        <p className="text-lg mb-2" style={{ color: color("textSecondary") }}>
          没有打开的预设
        </p>
        <p className="text-sm" style={{ color: color("textMuted") }}>
          从顶部工具栏的「预设库」中选择预设打开，或点击「新建预设」创建新的预设
        </p>
      </div>
    </div>
  );
}

/**
 * 底部操作提示
 */
function BottomHint() {
  return (
    <div
      className={cn("px-4 py-2", "text-center text-sm", "border-t")}
      style={{
        color: color("textMuted"),
        borderColor: colorAlpha("primary", 0.2),
        background: colorAlpha("bgElevated", 0.5),
      }}
    >
      <span className="opacity-80">
        <span className="hidden sm:inline">
          💡 拖拽块到其他预设面板可复制 | 按住 Shift 拖拽可移动 | 双击块展开编辑
        </span>
        <span className="sm:hidden">
          💡 点击编辑按钮编辑块 | 拖拽块可跨面板复制
        </span>
      </span>
    </div>
  );
}
