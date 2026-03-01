/**
 * 世界书工作区主组件
 *
 * 全屏工作区布局，支持：
 * - 桌面端（lg+）：世界书列表 + 条目列表 双面板并排
 * - 移动端（<lg）：两级页面导航
 * - 条目编辑全屏覆盖（阶段3）
 * - Escape 快捷键关闭（编辑器打开时不关闭工作区）
 *
 * 参考 PresetWorkspace 的覆盖层模式。
 */

import { AnimatePresence, motion } from "framer-motion";
import { BookOpen } from "lucide-react";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

import { StarfieldBackground } from "@/components/effects/StarfieldBackground";
import { Overlay, useToast } from "@/components/ui";
import { useThemeEffectSwitches } from "@/hooks";
import { useLorebookStore } from "@/lib/lorebook";
import { cn } from "@/lib/utils";
import {
  borders,
  color,
  colorAlpha,
  panelVariants,
  stepBackwardVariants,
  stepForwardVariants,
} from "@/styles/tokens";

import { useLorebookWorkspaceState } from "./hooks/useLorebookWorkspaceState";
import { LorebookEntryEditorFullscreen } from "./LorebookEntryEditorFullscreen";
import { LorebookEntryListPane } from "./LorebookEntryListPane";
import { LorebookGlobalSettingsDialog } from "./LorebookGlobalSettingsDialog";
import { LorebookListPane } from "./LorebookListPane";
import { LorebookToolbar } from "./LorebookToolbar";

// ===== 响应式工具 =====

/** Tailwind lg 断点 = 1024px */
const LG_BREAKPOINT = 1024;

/**
 * 简单的媒体查询订阅（SSR 安全）
 * 使用 useSyncExternalStore 避免 hydration 不匹配
 */
function useIsDesktop(): boolean {
  return useSyncExternalStore(
    (callback) => {
      const mql = window.matchMedia(`(min-width: ${LG_BREAKPOINT}px)`);
      mql.addEventListener("change", callback);
      return () => mql.removeEventListener("change", callback);
    },
    () => window.matchMedia(`(min-width: ${LG_BREAKPOINT}px)`).matches,
    () => true, // SSR 回退值：默认桌面端
  );
}

// ===== 组件 =====

interface LorebookWorkspaceProps {
  /** 是否打开 */
  open: boolean;
  /** 关闭回调 */
  onOpenChange: (open: boolean) => void;
}

/**
 * 世界书工作区主组件
 */
export function LorebookWorkspace({
  open,
  onOpenChange,
}: LorebookWorkspaceProps) {
  const isDesktop = useIsDesktop();
  const workspace = useLorebookWorkspaceState();
  const createLorebook = useLorebookStore((s) => s.createLorebook);
  const lorebooks = useLorebookStore((s) => s.lorebooks);
  const { success, error } = useToast();
  const { isParticlesEnabled } = useThemeEffectSwitches();

  const [globalSettingsOpen, setGlobalSettingsOpen] = useState(false);
  const [globalSettingsLorebookId, setGlobalSettingsLorebookId] = useState<
    string | null
  >(null);

  // 关闭工作区
  const handleClose = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  // 新建世界书
  const handleCreateLorebook = useCallback(async () => {
    try {
      const newLorebook = await createLorebook("新世界书");
      workspace.selectLorebook(newLorebook.id);
      success("已创建", `世界书「${newLorebook.name}」已创建`);
    } catch {
      error("创建失败", "请稍后重试");
    }
  }, [createLorebook, workspace, success, error]);

  // 打开全局设置（优先当前选中世界书，其次第一本）
  const handleOpenGlobalSettings = useCallback(() => {
    const targetId = workspace.selectedLorebookId ?? lorebooks[0]?.id ?? null;
    if (!targetId) {
      error("无法打开全局设置", "请先创建一本世界书");
      return;
    }
    setGlobalSettingsLorebookId(targetId);
    setGlobalSettingsOpen(true);
  }, [workspace.selectedLorebookId, lorebooks, error]);

  // 当选中的世界书被删除时，自动选中第一本
  useEffect(() => {
    if (
      workspace.selectedLorebookId &&
      !lorebooks.some((lb) => lb.id === workspace.selectedLorebookId)
    ) {
      if (lorebooks.length > 0) {
        workspace.selectLorebook(lorebooks[0].id);
      } else {
        workspace.navigateToLorebookList();
      }
    }
  }, [lorebooks, workspace]);

  // 全局设置目标被删除时自动回退到可用世界书
  useEffect(() => {
    if (!globalSettingsOpen || !globalSettingsLorebookId) return;
    if (lorebooks.some((lb) => lb.id === globalSettingsLorebookId)) return;

    const fallbackId = workspace.selectedLorebookId ?? lorebooks[0]?.id ?? null;
    if (fallbackId) {
      setGlobalSettingsLorebookId(fallbackId);
    } else {
      setGlobalSettingsOpen(false);
      setGlobalSettingsLorebookId(null);
    }
  }, [
    globalSettingsOpen,
    globalSettingsLorebookId,
    lorebooks,
    workspace.selectedLorebookId,
  ]);

  // 关闭后重置导航状态
  useEffect(() => {
    if (!open) {
      workspace.reset();
      setGlobalSettingsOpen(false);
      setGlobalSettingsLorebookId(null);
    }
    // 只在 open 变化时触发，workspace.reset 是稳定引用
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Escape 快捷键：仅在无子层弹窗时关闭工作区，避免抢占 Dialog 栈
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) {
        return;
      }

      if (workspace.editingEntryId || globalSettingsOpen) {
        // 子层（条目编辑器 / 全局设置）打开时，交由最上层弹窗处理
        return;
      }

      e.preventDefault();
      handleClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, handleClose, workspace.editingEntryId, globalSettingsOpen]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* 背景遮罩 */}
          <Overlay onClick={handleClose} />

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
              <LorebookToolbar
                onClose={handleClose}
                onCreateLorebook={handleCreateLorebook}
                onOpenGlobalSettings={handleOpenGlobalSettings}
              />

              {/* 主内容区 */}
              <div className="flex-1 overflow-hidden relative">
                {isDesktop ? (
                  <DesktopLayout
                    selectedId={workspace.selectedLorebookId}
                    onSelectLorebook={workspace.selectLorebook}
                    onEditEntry={workspace.startEditingEntry}
                  />
                ) : (
                  <MobileLayout
                    selectedId={workspace.selectedLorebookId}
                    mobilePage={workspace.mobilePage}
                    onSelectLorebook={workspace.selectLorebook}
                    onBack={workspace.navigateToLorebookList}
                    onEditEntry={workspace.startEditingEntry}
                  />
                )}

                {/* 全屏编辑器覆盖层 */}
                <AnimatePresence>
                  {workspace.editingEntryId && workspace.selectedLorebookId && (
                    <LorebookEntryEditorFullscreen
                      key={workspace.editingEntryId}
                      lorebookId={workspace.selectedLorebookId}
                      entryId={workspace.editingEntryId}
                      onClose={workspace.finishEditingEntry}
                    />
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>

          <LorebookGlobalSettingsDialog
            open={globalSettingsOpen}
            lorebookId={globalSettingsLorebookId}
            onOpenChange={(nextOpen) => {
              setGlobalSettingsOpen(nextOpen);
              if (!nextOpen) {
                setGlobalSettingsLorebookId(null);
              }
            }}
          />
        </>
      )}
    </AnimatePresence>
  );
}

// ===== 布局组件 =====

interface DesktopLayoutProps {
  selectedId: string | null;
  onSelectLorebook: (id: string) => void;
  onEditEntry: (entryId: string) => void;
}

/**
 * 桌面端双面板布局
 * 左侧世界书列表 + 右侧条目列表
 */
function DesktopLayout({
  selectedId,
  onSelectLorebook,
  onEditEntry,
}: DesktopLayoutProps) {
  return (
    <div className="flex h-full">
      {/* 左侧：世界书列表 - 增加宽度以显示更多名称 */}
      <div
        className="w-72 shrink-0 border-r h-full"
        style={{ borderColor: colorAlpha("primary", 0.15) }}
      >
        <LorebookListPane selectedId={selectedId} onSelect={onSelectLorebook} />
      </div>

      {/* 右侧：条目列表或空态 */}
      <div className="flex-1 h-full overflow-hidden">
        {selectedId ? (
          <LorebookEntryListPane
            lorebookId={selectedId}
            onEditEntry={onEditEntry}
            isMobile={false}
          />
        ) : (
          <SelectLorebookHint />
        )}
      </div>
    </div>
  );
}

interface MobileLayoutProps {
  selectedId: string | null;
  mobilePage: "lorebookList" | "entryList";
  onSelectLorebook: (id: string) => void;
  onBack: () => void;
  onEditEntry: (entryId: string) => void;
}

/**
 * 移动端两级页面布局
 * 通过 mobilePage 状态切换世界书列表/条目列表
 */
function MobileLayout({
  selectedId,
  mobilePage,
  onSelectLorebook,
  onBack,
  onEditEntry,
}: MobileLayoutProps) {
  return (
    <div className="h-full overflow-hidden relative">
      <AnimatePresence mode="wait" initial={false}>
        {mobilePage === "lorebookList" ? (
          <motion.div
            key="lorebook-list"
            className="h-full"
            variants={stepBackwardVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <LorebookListPane
              selectedId={selectedId}
              onSelect={onSelectLorebook}
            />
          </motion.div>
        ) : (
          <motion.div
            key="entry-list"
            className="h-full"
            variants={stepForwardVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            {selectedId ? (
              <LorebookEntryListPane
                lorebookId={selectedId}
                onBack={onBack}
                showBackButton
                onEditEntry={onEditEntry}
                isMobile
              />
            ) : (
              <SelectLorebookHint />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * 选择世界书提示（桌面端右侧空态）
 */
function SelectLorebookHint() {
  return (
    <div className="flex-1 h-full flex items-center justify-center text-center">
      <div>
        <BookOpen
          size={48}
          className="mx-auto mb-4"
          style={{ color: color("textMuted"), opacity: 0.4 }}
        />
        <p className="text-sm" style={{ color: color("textMuted") }}>
          从左侧选择一本世界书
        </p>
        <p
          className="text-xs mt-1"
          style={{ color: colorAlpha("textMuted", 0.6) }}
        >
          查看和管理其中的条目
        </p>
      </div>
    </div>
  );
}
