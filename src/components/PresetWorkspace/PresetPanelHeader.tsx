/**
 * 预设面板头部组件
 *
 * 包含：
 * - 预设名称（可编辑）
 * - 激活状态标记
 * - 操作按钮（设为激活、复制、重置、删除、关闭）
 */

import { motion } from "framer-motion";
import { Check, Copy, RotateCcw, Star, Trash2, X } from "lucide-react";
import { useCallback, useState } from "react";

import { ConfirmDialog } from "@/components/ui";
import { cn } from "@/lib/utils";
import { animation, color, colorAlpha, gradientText } from "@/styles/tokens";

import { useWorkspace } from "./context";
import type { PanelState } from "./hooks/useWorkspaceState";

// ===== 类型 =====

interface PresetPanelHeaderProps {
  /** 面板状态 */
  panel: PanelState;
}

// ===== 组件 =====

/**
 * 预设面板头部
 */
export function PresetPanelHeader({ panel }: PresetPanelHeaderProps) {
  const workspace = useWorkspace();
  const purpose = panel.preset.purpose ?? "narrative";
  const purposeLabel =
    purpose === "parser"
      ? "解析"
      : purpose === "summarizer"
        ? "总结"
        : purpose === "director"
          ? "导演"
          : "叙事";
  const isActive = workspace.activePresetByPurpose[purpose] === panel.presetId;

  // 名称编辑状态
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(panel.preset.name);

  // 确认对话框状态
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);

  // 处理名称编辑
  const handleStartEditName = useCallback(() => {
    setEditedName(panel.preset.name);
    setIsEditingName(true);
  }, [panel.preset.name]);

  const handleSaveName = useCallback(() => {
    if (editedName.trim() && editedName !== panel.preset.name) {
      workspace.updatePanelPreset(panel.id, { name: editedName.trim() });
    }
    setIsEditingName(false);
  }, [editedName, panel.id, panel.preset.name, workspace]);

  const handleCancelEditName = useCallback(() => {
    setEditedName(panel.preset.name);
    setIsEditingName(false);
  }, [panel.preset.name]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        handleSaveName();
      } else if (e.key === "Escape") {
        handleCancelEditName();
      }
    },
    [handleSaveName, handleCancelEditName],
  );

  // 处理操作
  const handleSetActive = useCallback(async () => {
    await workspace.setActivePresetForPurpose(purpose, panel.presetId);
  }, [workspace, purpose, panel.presetId]);

  const handleDuplicate = useCallback(async () => {
    await workspace.duplicatePreset(panel.presetId);
  }, [workspace, panel.presetId]);

  const handleResetClick = useCallback(() => {
    setShowResetConfirm(true);
  }, []);

  const handleConfirmReset = useCallback(() => {
    workspace.resetPanelToDefault(panel.id);
  }, [workspace, panel.id]);

  // 打开删除确认对话框
  const handleDeleteClick = useCallback(() => {
    setShowDeleteConfirm(true);
  }, []);

  // 确认删除预设
  const handleConfirmDelete = useCallback(async () => {
    await workspace.deletePreset(panel.presetId);
  }, [workspace, panel.presetId]);

  // 处理关闭面板
  const handleCloseClick = useCallback(() => {
    if (panel.hasChanges) {
      setShowCloseConfirm(true);
    } else {
      workspace.closePanel(panel.id);
    }
  }, [workspace, panel.id, panel.hasChanges]);

  // 确认关闭面板
  const handleConfirmClose = useCallback(() => {
    workspace.closePanel(panel.id);
  }, [workspace, panel.id]);

  return (
    <div
      className={cn(
        "flex items-center justify-between",
        "px-3 py-2",
        "border-b",
      )}
      style={{
        borderColor: colorAlpha("primary", 0.2),
        background: colorAlpha("bgElevated", 0.3),
      }}
    >
      {/* 左侧：名称和状态 */}
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {/* 预设名称 */}
        {isEditingName ? (
          <input
            type="text"
            value={editedName}
            onChange={(e) => setEditedName(e.target.value)}
            onBlur={handleSaveName}
            onKeyDown={handleKeyDown}
            autoFocus
            className={cn(
              "flex-1 min-w-0",
              "px-2 py-0.5",
              "text-sm font-medium",
              "rounded",
              "outline-none",
            )}
            style={{
              background: colorAlpha("bgBase", 0.5),
              border: `1px solid ${colorAlpha("primary", 0.4)}`,
              color: color("textPrimary"),
            }}
          />
        ) : (
          <button
            onClick={handleStartEditName}
            className={cn(
              "text-sm font-medium",
              "truncate",
              "hover:underline",
              "cursor-text",
            )}
            style={gradientText()}
            title="点击编辑名称"
          >
            {panel.preset.name}
          </button>
        )}

        {/* 激活标记 */}
        {isActive && (
          <span
            className={cn(
              "flex items-center gap-1",
              "px-1.5 py-0.5",
              "text-xs font-medium",
              "rounded",
            )}
            style={{
              background: colorAlpha("primary", 0.2),
              color: color("primary"),
            }}
          >
            <Star size={10} fill="currentColor" />
            {purposeLabel}激活
          </span>
        )}

        {/* 未保存标记 */}
        {panel.hasChanges && (
          <span
            className="w-2 h-2 rounded-full"
            style={{ background: color("warning") }}
            title="有未保存的更改"
          />
        )}
      </div>

      {/* 右侧：操作按钮 */}
      <div className="flex items-center gap-1">
        {/* 设为激活 */}
        {!isActive && (
          <HeaderButton
            icon={<Check size={14} />}
            label={`设为${purposeLabel}激活`}
            onClick={handleSetActive}
          />
        )}

        {/* 复制 */}
        <HeaderButton
          icon={<Copy size={14} />}
          label="复制预设"
          onClick={handleDuplicate}
        />

        {/* 重置为默认 */}
        <HeaderButton
          icon={<RotateCcw size={14} />}
          label="重置为默认"
          onClick={handleResetClick}
        />

        {/* 删除 */}
        <HeaderButton
          icon={<Trash2 size={14} />}
          label="删除预设"
          onClick={handleDeleteClick}
          variant="danger"
        />

        {/* 关闭面板 */}
        <HeaderButton
          icon={<X size={14} />}
          label="关闭面板"
          onClick={handleCloseClick}
        />
      </div>

      {/* 删除预设确认对话框 */}
      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="确认删除预设"
        description={`确定要删除预设「${panel.preset.name}」吗？此操作不可撤销。`}
        confirmText="删除"
        cancelText="取消"
        variant="destructive"
        onConfirm={handleConfirmDelete}
      />

      {/* 重置为默认预设确认对话框 */}
      <ConfirmDialog
        open={showResetConfirm}
        onOpenChange={setShowResetConfirm}
        title="重置为默认预设"
        description="确定要将此预设重置为内置默认内容吗？当前的所有自定义修改将被覆盖（未保存前可通过关闭面板撤销）。"
        confirmText="重置"
        cancelText="取消"
        onConfirm={handleConfirmReset}
      />

      {/* 关闭面板确认对话框 */}
      <ConfirmDialog
        open={showCloseConfirm}
        onOpenChange={setShowCloseConfirm}
        title="有未保存的更改"
        description="确定要关闭面板吗？未保存的更改将会丢失。"
        confirmText="关闭"
        cancelText="取消"
        onConfirm={handleConfirmClose}
      />
    </div>
  );
}

// ===== 子组件 =====

interface HeaderButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  variant?: "default" | "danger";
}

/**
 * 头部操作按钮
 */
function HeaderButton({
  icon,
  label,
  onClick,
  variant = "default",
}: HeaderButtonProps) {
  const baseColor = variant === "danger" ? "error" : "textMuted";
  const hoverColor = variant === "danger" ? "error" : "textPrimary";

  return (
    <motion.button
      onClick={onClick}
      className={cn("p-1.5 rounded", "transition-all")}
      style={{
        color: color(baseColor),
        transitionDuration: `${animation.duration.fast * 1000}ms`,
      }}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      onMouseEnter={(e) => {
        e.currentTarget.style.color = color(hoverColor);
        e.currentTarget.style.background = colorAlpha(
          variant === "danger" ? "error" : "primary",
          0.1,
        );
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = color(baseColor);
        e.currentTarget.style.background = "transparent";
      }}
      title={label}
      aria-label={label}
    >
      {icon}
    </motion.button>
  );
}
