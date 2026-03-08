/**
 * 世界工作台顶部工具栏
 */

import {
  Download,
  FileCode2,
  Import,
  Layers3,
  List,
  Loader2,
  Plus,
  RefreshCcw,
  Save,
  Sparkles,
  X,
} from "lucide-react";
import { ReactNode, useCallback, useRef, type ChangeEvent } from "react";

import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import { animation, color, colorAlpha, gradientText } from "@/styles/tokens";

import type { WorldWorkspaceMobilePage } from "./hooks/useWorldWorkspaceState";

interface WorldWorkspaceToolbarProps {
  isDesktop: boolean;
  mobilePage: WorldWorkspaceMobilePage;
  isDirty: boolean;
  isSaving: boolean;
  hasSelection: boolean;
  rawRulesEditorOpen: boolean;
  onNavigateMobile: (page: WorldWorkspaceMobilePage) => void;
  onCreateWorld: () => void;
  onImportFile: (file: File) => void;
  onExportWorld: () => void;
  onSave: () => void;
  onReset: () => void;
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
  onNavigateMobile,
  onCreateWorld,
  onImportFile,
  onExportWorld,
  onSave,
  onReset,
  onToggleRawRulesEditor,
  onClose,
}: WorldWorkspaceToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  return (
    <div
      className={cn("border-b px-3 py-3 sm:px-4")}
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

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1
            className="truncate text-base font-semibold sm:text-lg"
            style={gradientText()}
          >
            世界编辑工作台
          </h1>
          <p
            className="mt-1 text-xs sm:text-sm"
            style={{ color: colorAlpha("textSecondary", 0.78) }}
          >
            作者态世界配置编辑 · 结构化表单优先，原始规则兜底
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onSave}
            disabled={!hasSelection || !isDirty || isSaving}
            className="gap-1.5 px-2.5 sm:px-3"
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
            className={cn("rounded-md p-2 transition-all")}
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

      <div className="mt-3 flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
          <ToolbarActionButton
            icon={<Plus className="h-4 w-4" />}
            label="新建世界"
            onClick={onCreateWorld}
          />
          <ToolbarActionButton
            icon={<Import className="h-4 w-4" />}
            label="导入"
            onClick={triggerImport}
          />
          <ToolbarActionButton
            icon={<Download className="h-4 w-4" />}
            label="导出当前"
            onClick={onExportWorld}
            disabled={!hasSelection}
          />
          <ToolbarActionButton
            icon={<RefreshCcw className="h-4 w-4" />}
            label="重置草稿"
            onClick={onReset}
            disabled={!hasSelection || !isDirty}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ToolbarActionButton
            icon={<FileCode2 className="h-4 w-4" />}
            label={rawRulesEditorOpen ? "关闭原始规则" : "原始规则编辑"}
            onClick={onToggleRawRulesEditor}
            disabled={!hasSelection}
            highlighted={rawRulesEditorOpen}
          />

          {!isDesktop && (
            <div className="grid grid-cols-3 gap-2">
              <ToolbarActionButton
                icon={<List className="h-4 w-4" />}
                label="列表"
                onClick={() => onNavigateMobile("list")}
                highlighted={mobilePage === "list"}
              />
              <ToolbarActionButton
                icon={<Sparkles className="h-4 w-4" />}
                label="编辑"
                onClick={() => onNavigateMobile("editor")}
                highlighted={mobilePage === "editor"}
              />
              <ToolbarActionButton
                icon={<Layers3 className="h-4 w-4" />}
                label="辅助"
                onClick={() => onNavigateMobile("assistant")}
                highlighted={mobilePage === "assistant"}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface ToolbarActionButtonProps {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  highlighted?: boolean;
}

function ToolbarActionButton({
  icon,
  label,
  onClick,
  disabled = false,
  highlighted = false,
}: ToolbarActionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex min-h-9 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-all",
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
