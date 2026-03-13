/**
 * 世界工作台顶部工具栏
 */

import {
  Download,
  FileCode2,
  Import,
  List,
  Loader2,
  Plus,
  RefreshCcw,
  RotateCcw,
  Save,
  Sparkles,
  X,
} from "lucide-react";
import {
  ReactNode,
  useCallback,
  useRef,
  useState,
  type ChangeEvent,
} from "react";

import { Button, ConfirmDialog } from "@/components/ui";
import { cn } from "@/lib/utils";
import { animation, color, colorAlpha, gradientText } from "@/styles/tokens";

import type {
  WorldRulesEditorScope,
  WorldWorkspaceMobilePage,
} from "./hooks/useWorldWorkspaceState";

interface WorldWorkspaceToolbarProps {
  isDesktop: boolean;
  mobilePage: WorldWorkspaceMobilePage;
  isDirty: boolean;
  isSaving: boolean;
  hasSelection: boolean;
  rawRulesEditorOpen: boolean;
  rawRulesEditorScope: WorldRulesEditorScope;
  onNavigateMobile: (page: WorldWorkspaceMobilePage) => void;
  onCreateWorld: () => void;
  onImportFile: (file: File) => void;
  onExportWorld: () => void;
  onSave: () => void;
  onReset: () => void;
  onResetToDefault?: () => void;
  onToggleRawRulesEditor: () => void;
  onClose: () => void;
}

export function WorldWorkspaceToolbar({
  isDesktop,
  mobilePage,
  isDirty,
  isSaving,
  hasSelection,
  rawRulesEditorOpen,
  rawRulesEditorScope,
  onNavigateMobile,
  onCreateWorld,
  onImportFile,
  onExportWorld,
  onSave,
  onReset,
  onResetToDefault,
  onToggleRawRulesEditor,
  onClose,
}: WorldWorkspaceToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [resetToDefaultConfirmOpen, setResetToDefaultConfirmOpen] =
    useState(false);
  const isFullRawRulesEditorOpen =
    rawRulesEditorOpen && rawRulesEditorScope === "full";

  const triggerImport = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) {
        return;
      }

      onImportFile(file);
      event.target.value = "";
    },
    [onImportFile],
  );

  const handleResetToDefaultClick = useCallback(() => {
    setResetToDefaultConfirmOpen(true);
  }, []);

  const handleConfirmResetToDefault = useCallback(() => {
    onResetToDefault?.();
  }, [onResetToDefault]);

  return (
    <div
      className={cn("border-b px-2.5 py-2 sm:px-4 sm:py-3")}
      style={{
        borderColor: colorAlpha("primary", 0.25),
        background: colorAlpha("bgElevated", 0.5),
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={handleFileChange}
      />

      <div className="flex items-center justify-between gap-2 sm:gap-3">
        <div className="min-w-0">
          <h1
            className="truncate text-sm font-semibold sm:text-lg"
            style={gradientText()}
          >
            世界编辑工作台
          </h1>
          <p
            className="mt-0.5 hidden text-xs sm:block sm:text-sm"
            style={{ color: colorAlpha("textSecondary", 0.78) }}
          >
            作者态世界配置编辑 · 结构化表单优先，局部分区 / 全量规则 JSON 共存
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onSave}
            disabled={!hasSelection || !isDirty || isSaving}
            className="gap-1.5 px-2 sm:px-3"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">保存</span>
            {isDirty && !isSaving && (
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: color("warning") }}
              />
            )}
          </Button>

          <button
            type="button"
            onClick={onClose}
            className={cn("rounded-md p-1.5 transition-all sm:p-2")}
            style={{
              color: color("textMuted"),
              transitionDuration: `${animation.duration.fast * 1000}ms`,
            }}
            onMouseEnter={(event) => {
              event.currentTarget.style.color = color("textPrimary");
              event.currentTarget.style.background = colorAlpha("primary", 0.1);
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.color = color("textMuted");
              event.currentTarget.style.background = "transparent";
            }}
            aria-label="关闭世界工作台"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="mt-2 flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
        <div className="overflow-x-auto pb-1">
          <div className="flex min-w-max gap-2 sm:min-w-0 sm:flex-wrap sm:items-center">
            <ToolbarActionButton
              icon={<Plus className="h-4 w-4" />}
              label="新建世界"
              onClick={onCreateWorld}
              compact={!isDesktop}
            />
            <ToolbarActionButton
              icon={<Import className="h-4 w-4" />}
              label="导入"
              onClick={triggerImport}
              compact={!isDesktop}
            />
            <ToolbarActionButton
              icon={<Download className="h-4 w-4" />}
              label="导出当前"
              onClick={onExportWorld}
              disabled={!hasSelection}
              compact={!isDesktop}
            />
            <ToolbarActionButton
              icon={<RefreshCcw className="h-4 w-4" />}
              label="重置草稿"
              onClick={onReset}
              disabled={!hasSelection || !isDirty}
              compact={!isDesktop}
            />
            <ToolbarActionButton
              icon={<RotateCcw className="h-4 w-4" />}
              label="重置为内置默认"
              onClick={handleResetToDefaultClick}
              disabled={!hasSelection || !onResetToDefault}
              compact={!isDesktop}
            />
          </div>
        </div>

        <div className="overflow-x-auto pb-1">
          <div className="flex min-w-max items-center gap-2 sm:min-w-0 sm:flex-wrap">
            {!isDesktop && (
              <>
                <ToolbarActionButton
                  icon={<List className="h-4 w-4" />}
                  label="列表"
                  onClick={() => onNavigateMobile("list")}
                  highlighted={mobilePage === "list"}
                  compact
                />
                <ToolbarActionButton
                  icon={<Sparkles className="h-4 w-4" />}
                  label="编辑"
                  onClick={() => onNavigateMobile("editor")}
                  highlighted={mobilePage === "editor"}
                  compact
                />
              </>
            )}

            <ToolbarActionButton
              icon={<FileCode2 className="h-4 w-4" />}
              label={
                isFullRawRulesEditorOpen ? "关闭全量高级规则" : "全量高级规则"
              }
              onClick={onToggleRawRulesEditor}
              disabled={!hasSelection}
              highlighted={isFullRawRulesEditorOpen}
              compact={!isDesktop}
            />
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={resetToDefaultConfirmOpen}
        onOpenChange={setResetToDefaultConfirmOpen}
        title="重置为内置默认"
        description="确定要将此世界配置重置为内置默认值吗？当前的所有自定义规则修改将被覆盖。此操作仅影响草稿，保存后才会生效。"
        confirmText="重置"
        cancelText="取消"
        onConfirm={handleConfirmResetToDefault}
      />
    </div>
  );
}

interface ToolbarActionButtonProps {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  highlighted?: boolean;
  compact?: boolean;
}

function ToolbarActionButton({
  icon,
  label,
  onClick,
  disabled = false,
  highlighted = false,
  compact = false,
}: ToolbarActionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex items-center justify-center gap-1.5 rounded-md font-medium transition-all whitespace-nowrap",
        compact ? "min-h-8 px-2.5 py-1.5 text-xs" : "min-h-9 px-3 py-2 text-sm",
        disabled && "cursor-not-allowed opacity-50",
      )}
      style={{
        color: highlighted ? color("primary") : color("textSecondary"),
        background: highlighted ? colorAlpha("primary", 0.12) : "transparent",
        border: `1px solid ${colorAlpha(highlighted ? "primary" : "border", highlighted ? 0.45 : 0.3)}`,
        boxShadow: highlighted
          ? `0 0 18px ${colorAlpha("primary", 0.16)}`
          : "none",
      }}
      onMouseEnter={(event) => {
        if (disabled || highlighted) {
          return;
        }

        event.currentTarget.style.color = color("textPrimary");
        event.currentTarget.style.background = colorAlpha("primary", 0.1);
        event.currentTarget.style.borderColor = colorAlpha("primary", 0.35);
      }}
      onMouseLeave={(event) => {
        if (disabled || highlighted) {
          return;
        }

        event.currentTarget.style.color = color("textSecondary");
        event.currentTarget.style.background = "transparent";
        event.currentTarget.style.borderColor = colorAlpha("border", 0.3);
      }}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
