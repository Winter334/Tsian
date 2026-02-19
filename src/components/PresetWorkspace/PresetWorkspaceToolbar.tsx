/**
 * 预设工作区顶部工具栏
 *
 * 包含：
 * - 预设库下拉菜单
 * - 新建/导入/导出按钮
 * - 保存/关闭按钮
 */

import { motion } from "framer-motion";
import {
  ChevronDown,
  Download,
  FileText,
  Plus,
  Save,
  Upload,
  X,
} from "lucide-react";
import { useCallback, useState } from "react";

import { Button } from "@/components/ui";
import type { PresetPurpose } from "@/lib/prompt";
import { usePresetStore } from "@/lib/prompt";
import { cn } from "@/lib/utils";
import { animation, color, colorAlpha, gradientText } from "@/styles/tokens";

import { useWorkspace } from "./context";

// ===== 类型 =====

interface PresetWorkspaceToolbarProps {
  /** 关闭回调 */
  onClose: () => void;
  /** 导入回调 */
  onImport?: () => void;
  /** 导出回调 */
  onExport?: () => void;
}

// ===== 组件 =====

/**
 * 预设工作区顶部工具栏
 */
export function PresetWorkspaceToolbar({
  onClose,
  onImport,
  onExport,
}: PresetWorkspaceToolbarProps) {
  const workspace = useWorkspace();
  const presets = usePresetStore((s) => s.presets);

  // 下拉菜单状态
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [purposeFilter, setPurposeFilter] = useState<"all" | PresetPurpose>(
    "all",
  );

  // 处理保存全部
  const handleSaveAll = useCallback(async () => {
    await workspace.saveAllPanels();
  }, [workspace]);

  // 处理新建预设
  const handleCreatePreset = useCallback(async () => {
    await workspace.createPreset();
  }, [workspace]);

  // 处理打开预设
  const handleOpenPreset = useCallback(
    async (presetId: string) => {
      await workspace.openPanel(presetId);
      setIsDropdownOpen(false);
    },
    [workspace],
  );

  // 检查是否有未保存的更改
  const hasChanges = workspace.hasUnsavedChanges();

  return (
    <div
      className={cn("border-b px-3 py-3 sm:px-4")}
      style={{
        borderColor: colorAlpha("primary", 0.25),
        background: colorAlpha("bgElevated", 0.5),
      }}
    >
      {/* 第一行：标题 + 保存/关闭 */}
      <div className="flex items-center justify-between gap-2">
        <h1
          className="text-base font-semibold whitespace-nowrap sm:text-lg"
          style={gradientText()}
        >
          预设工作区
        </h1>

        <div className="flex items-center gap-2 shrink-0">
          {/* 保存按钮 */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleSaveAll}
            disabled={!hasChanges}
            className="gap-1.5 px-2.5 sm:px-3"
          >
            <Save size={16} />
            <span className="sm:hidden">保存</span>
            <span className="hidden sm:inline">保存全部</span>
            {hasChanges && (
              <span
                className="w-2 h-2 rounded-full"
                style={{ background: color("warning") }}
              />
            )}
          </Button>

          {/* 关闭按钮 */}
          <button
            onClick={onClose}
            className={cn("p-2 rounded-md", "transition-all")}
            style={{
              color: color("textMuted"),
              transitionDuration: `${animation.duration.fast * 1000}ms`,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = color("textPrimary");
              e.currentTarget.style.background = colorAlpha("primary", 0.1);
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = color("textMuted");
              e.currentTarget.style.background = "transparent";
            }}
            aria-label="关闭工作区"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* 第二行：预设库与操作按钮 */}
      <div className="mt-3 flex flex-col gap-2 lg:flex-row lg:items-center">
        <PresetLibraryDropdown
          presets={presets}
          isOpen={isDropdownOpen}
          onOpenChange={setIsDropdownOpen}
          onSelectPreset={handleOpenPreset}
          purposeFilter={purposeFilter}
          onPurposeFilterChange={setPurposeFilter}
          className="w-full lg:w-auto"
          triggerClassName="w-full justify-center px-2.5 py-2 lg:w-auto lg:justify-start lg:px-3 lg:py-1.5"
        />

        <div className="grid grid-cols-3 gap-2 lg:flex lg:items-center">
          <ToolbarButton
            icon={<Plus size={16} />}
            label="新建预设"
            onClick={handleCreatePreset}
            className="w-full px-2.5 py-2 lg:w-auto lg:px-3 lg:py-1.5"
          />
          <ToolbarButton
            icon={<Upload size={16} />}
            label="导入"
            onClick={() => onImport?.()}
            className="w-full px-2.5 py-2 lg:w-auto lg:px-3 lg:py-1.5"
          />
          <ToolbarButton
            icon={<Download size={16} />}
            label="导出选中"
            onClick={() => onExport?.()}
            disabled={workspace.panels.length === 0}
            className="w-full px-2.5 py-2 lg:w-auto lg:px-3 lg:py-1.5"
          />
        </div>
      </div>
    </div>
  );
}

// ===== 子组件 =====

interface ToolbarButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}

/**
 * 工具栏按钮
 */
function ToolbarButton({
  icon,
  label,
  onClick,
  disabled = false,
  className,
}: ToolbarButtonProps) {
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex items-center justify-center gap-1.5",
        "px-3 py-1.5 min-h-9",
        "text-sm font-medium",
        "rounded-md",
        "transition-all",
        disabled && "opacity-50 cursor-not-allowed",
        className,
      )}
      style={{
        color: color("textSecondary"),
        background: "transparent",
        border: `1px solid ${colorAlpha("primary", 0.2)}`,
        transitionDuration: `${animation.duration.fast * 1000}ms`,
      }}
      whileHover={
        disabled
          ? {}
          : {
              scale: 1.02,
            }
      }
      whileTap={disabled ? {} : { scale: 0.98 }}
      onMouseEnter={(e) => {
        if (disabled) return;
        e.currentTarget.style.color = color("textPrimary");
        e.currentTarget.style.background = colorAlpha("primary", 0.1);
        e.currentTarget.style.borderColor = colorAlpha("primary", 0.4);
      }}
      onMouseLeave={(e) => {
        if (disabled) return;
        e.currentTarget.style.color = color("textSecondary");
        e.currentTarget.style.background = "transparent";
        e.currentTarget.style.borderColor = colorAlpha("primary", 0.2);
      }}
    >
      {icon}
      <span className="whitespace-nowrap">{label}</span>
    </motion.button>
  );
}

interface PresetLibraryDropdownProps {
  presets: Array<{ id: string; name: string; purpose: PresetPurpose }>;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectPreset: (presetId: string) => void;
  purposeFilter: "all" | PresetPurpose;
  onPurposeFilterChange: (filter: "all" | PresetPurpose) => void;
  className?: string;
  triggerClassName?: string;
}

/**
 * 预设库下拉菜单
 */
function PresetLibraryDropdown({
  presets,
  isOpen,
  onOpenChange,
  onSelectPreset,
  purposeFilter,
  onPurposeFilterChange,
  className,
  triggerClassName,
}: PresetLibraryDropdownProps) {
  const workspace = useWorkspace();
  const activePresetByPurpose = workspace.activePresetByPurpose;

  // 获取已打开的预设 ID 列表
  const openedPresetIds = workspace.panels.map((p) => p.presetId);

  const filteredPresets =
    purposeFilter === "all"
      ? presets
      : presets.filter((preset) => preset.purpose === purposeFilter);

  return (
    <div className={cn("relative", className)}>
      {/* 触发按钮 */}
      <motion.button
        onClick={() => onOpenChange(!isOpen)}
        className={cn(
          "flex items-center justify-center gap-2",
          "px-3 py-1.5",
          "text-sm font-medium",
          "rounded-md",
          "transition-all",
          triggerClassName,
        )}
        style={{
          color: color("textSecondary"),
          background: colorAlpha("primary", 0.1),
          border: `1px solid ${colorAlpha("primary", 0.3)}`,
          transitionDuration: `${animation.duration.fast * 1000}ms`,
        }}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <FileText size={16} />
        <span className="whitespace-nowrap">预设库</span>
        <ChevronDown
          size={14}
          className={cn("transition-transform", isOpen && "rotate-180")}
          style={{
            transitionDuration: `${animation.duration.fast * 1000}ms`,
          }}
        />
      </motion.button>

      {/* 下拉菜单 */}
      {isOpen && (
        <>
          {/* 点击外部关闭 */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => onOpenChange(false)}
          />

          {/* 菜单内容 */}
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: animation.duration.fast }}
            className={cn(
              "absolute top-full left-0 mt-1",
              "w-full min-w-50 max-h-75 lg:w-64",
              "overflow-y-auto",
              "rounded-md",
              "z-20",
            )}
            style={{
              background: color("bgElevated"),
              border: `1px solid ${colorAlpha("primary", 0.3)}`,
              boxShadow: `0 4px 20px ${colorAlpha("bgBase", 0.5)}`,
            }}
          >
            {presets.length === 0 ? (
              <div
                className="px-3 py-2 text-sm"
                style={{ color: color("textMuted") }}
              >
                暂无预设
              </div>
            ) : (
              <>
                <div
                  className="p-2 border-b"
                  style={{ borderColor: colorAlpha("primary", 0.2) }}
                >
                  <div className="flex items-center gap-1 text-xs">
                    <FilterButton
                      active={purposeFilter === "all"}
                      label="全部"
                      onClick={() => onPurposeFilterChange("all")}
                    />
                    <FilterButton
                      active={purposeFilter === "narrative"}
                      label="叙事"
                      onClick={() => onPurposeFilterChange("narrative")}
                    />
                    <FilterButton
                      active={purposeFilter === "parser"}
                      label="解析"
                      onClick={() => onPurposeFilterChange("parser")}
                    />
                    <FilterButton
                      active={purposeFilter === "summarizer"}
                      label="总结"
                      onClick={() => onPurposeFilterChange("summarizer")}
                    />
                  </div>
                </div>

                {filteredPresets.length === 0 ? (
                  <div
                    className="px-3 py-2 text-sm"
                    style={{ color: color("textMuted") }}
                  >
                    当前筛选下暂无预设
                  </div>
                ) : (
                  filteredPresets.map((preset) => {
                    const isOpened = openedPresetIds.includes(preset.id);
                    const isNarrativeActive =
                      preset.id === activePresetByPurpose.narrative;
                    const isParserActive =
                      preset.id === activePresetByPurpose.parser;
                    const isSummarizerActive =
                      preset.id === activePresetByPurpose.summarizer;

                    return (
                      <button
                        key={preset.id}
                        onClick={() => onSelectPreset(preset.id)}
                        className={cn(
                          "w-full text-left",
                          "flex items-center justify-between gap-2",
                          "px-3 py-2",
                          "text-sm",
                          "transition-all",
                        )}
                        style={{
                          color: isOpened
                            ? color("textMuted")
                            : color("textSecondary"),
                          background: "transparent",
                          transitionDuration: `${
                            animation.duration.fast * 1000
                          }ms`,
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = colorAlpha(
                            "primary",
                            0.1,
                          );
                          e.currentTarget.style.color = color("textPrimary");
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "transparent";
                          e.currentTarget.style.color = isOpened
                            ? color("textMuted")
                            : color("textSecondary");
                        }}
                        disabled={isOpened}
                      >
                        <span
                          className={cn(isOpened && "line-through opacity-60")}
                        >
                          {preset.name}
                        </span>
                        <div className="flex items-center gap-1">
                          <span
                            className="px-1.5 py-0.5 text-[10px] rounded"
                            style={{
                              background: colorAlpha("secondary", 0.12),
                              color: color("textMuted"),
                            }}
                          >
                            {preset.purpose === "parser"
                              ? "解析"
                              : preset.purpose === "summarizer"
                                ? "总结"
                                : "叙事"}
                          </span>
                          {isNarrativeActive && (
                            <span
                              className="px-1.5 py-0.5 text-[10px] rounded"
                              style={{
                                background: colorAlpha("primary", 0.2),
                                color: color("primary"),
                              }}
                            >
                              叙事激活
                            </span>
                          )}
                          {isParserActive && (
                            <span
                              className="px-1.5 py-0.5 text-[10px] rounded"
                              style={{
                                background: colorAlpha("warning", 0.2),
                                color: color("warning"),
                              }}
                            >
                              解析激活
                            </span>
                          )}
                          {isSummarizerActive && (
                            <span
                              className="px-1.5 py-0.5 text-[10px] rounded"
                              style={{
                                background: colorAlpha("secondary", 0.2),
                                color: color("secondary"),
                              }}
                            >
                              总结激活
                            </span>
                          )}
                          {isOpened && (
                            <span
                              className="text-xs"
                              style={{ color: color("textMuted") }}
                            >
                              已打开
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </>
            )}
          </motion.div>
        </>
      )}
    </div>
  );
}

interface FilterButtonProps {
  active: boolean;
  label: string;
  onClick: () => void;
}

function FilterButton({ active, label, onClick }: FilterButtonProps) {
  return (
    <button
      onClick={onClick}
      className="px-2 py-1 rounded"
      style={{
        background: active ? colorAlpha("primary", 0.2) : "transparent",
        color: active ? color("primary") : color("textMuted"),
      }}
    >
      {label}
    </button>
  );
}
