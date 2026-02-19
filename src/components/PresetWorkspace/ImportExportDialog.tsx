/**
 * 导入/导出对话框组件
 *
 * 支持：
 * - Lyra 格式导入/导出
 * - SillyTavern（酒馆）格式导入
 * - 导入预览和警告显示
 */

import { motion } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle,
  Download,
  FileText,
  Upload,
  XCircle,
} from "lucide-react";
import { useCallback, useRef, useState } from "react";

import {
  Button,
  Dialog,
  DialogContent,
  ScrollArea,
  Select,
} from "@/components/ui";
import type { ExportedAIProfile } from "@/lib/ai/types";
import {
  convertTavernToLyra,
  exportLyraPreset,
  importLyraPreset,
  isLyraExportFormat,
  isTavernPreset,
  type ConversionResult,
  type ConversionWarning,
  type Preset,
} from "@/lib/prompt";
import type { LyraImportResult } from "@/lib/prompt/converters/tavern";
import { cn } from "@/lib/utils";
import { useSettingsStore } from "@/stores/settings";
import { animation, color, colorAlpha } from "@/styles/tokens";

// ===== 类型定义 =====

type DialogMode = "closed" | "import" | "export";
type ProfileImportStrategy = "create" | "use-existing" | "ignore";

interface ImportState {
  /** 解析状态 */
  status: "idle" | "parsing" | "success" | "error";
  /** 检测到的格式 */
  format?: "lyra" | "tavern" | "unknown";
  /** 解析后的预设 */
  preset?: Preset;
  /** 转换警告 */
  warnings?: ConversionWarning[];
  /** 错误信息 */
  error?: string;
  /** 原始文件名 */
  fileName?: string;
  /** 导入数据中嵌入的 AI Profile */
  importedAIProfile?: ExportedAIProfile;
}

export interface ImportExportDialogProps {
  /** 对话框模式 */
  mode: DialogMode;
  /** 模式变化回调 */
  onModeChange: (mode: DialogMode) => void;
  /** 导入完成回调 */
  onImport: (preset: Preset) => Promise<void>;
  /** 获取要导出的预设列表 */
  presetsToExport?: Preset[];
}

// ===== 主组件 =====

/**
 * 导入/导出对话框
 */
export function ImportExportDialog({
  mode,
  onModeChange,
  onImport,
  presetsToExport = [],
}: ImportExportDialogProps) {
  const [importState, setImportState] = useState<ImportState>({
    status: "idle",
  });
  const profiles = useSettingsStore((s) => s.profiles);
  const [profileImportStrategy, setProfileImportStrategy] =
    useState<ProfileImportStrategy>("create");
  const [selectedExistingProfileId, setSelectedExistingProfileId] = useState(
    () => useSettingsStore.getState().profiles[0]?.id ?? "",
  );
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 关闭对话框
  const handleClose = useCallback(() => {
    onModeChange("closed");
    // 重置状态
    setTimeout(() => {
      setImportState({ status: "idle" });
      setProfileImportStrategy("create");
      setSelectedExistingProfileId(
        useSettingsStore.getState().profiles[0]?.id ?? "",
      );
    }, 200);
  }, [onModeChange]);

  // 处理文件选择
  const handleFileSelect = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      setImportState({ status: "parsing", fileName: file.name });

      try {
        const text = await file.text();
        const data = JSON.parse(text);

        // 检测格式
        if (isLyraExportFormat(data)) {
          // Lyra 导出格式
          const { preset, aiProfile: importedAIProfile }: LyraImportResult =
            importLyraPreset(data);
          setImportState({
            status: "success",
            format: "lyra",
            preset,
            warnings: [],
            fileName: file.name,
            importedAIProfile,
          });
          setProfileImportStrategy("create");
          setSelectedExistingProfileId(
            useSettingsStore.getState().profiles[0]?.id ?? "",
          );
        } else if (isTavernPreset(data)) {
          // 酒馆格式
          const result: ConversionResult = convertTavernToLyra(
            data,
            file.name.replace(/\.json$/i, ""),
          );
          setImportState({
            status: "success",
            format: "tavern",
            preset: result.preset,
            warnings: result.warnings,
            fileName: file.name,
            importedAIProfile: undefined,
          });
          setProfileImportStrategy("create");
          setSelectedExistingProfileId(
            useSettingsStore.getState().profiles[0]?.id ?? "",
          );
        } else {
          // 未知格式
          setImportState({
            status: "error",
            format: "unknown",
            error:
              "无法识别的预设格式。请确保文件是此间预设或 SillyTavern 预设。",
            fileName: file.name,
            importedAIProfile: undefined,
          });
        }
      } catch (error) {
        setImportState({
          status: "error",
          error:
            error instanceof SyntaxError
              ? "文件不是有效的 JSON 格式"
              : `解析失败：${
                  error instanceof Error ? error.message : "未知错误"
                }`,
          fileName: file.name,
          importedAIProfile: undefined,
        });
      }

      // 重置 input，允许再次选择同一文件
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [],
  );

  // 确认导入
  const handleConfirmImport = useCallback(async () => {
    if (!importState.preset) return;
    if (
      importState.importedAIProfile &&
      profileImportStrategy === "use-existing" &&
      !selectedExistingProfileId
    ) {
      return;
    }

    const presetToImport: Preset = { ...importState.preset };

    if (importState.importedAIProfile) {
      if (profileImportStrategy === "create") {
        const newProfileId = useSettingsStore
          .getState()
          .importProfile(importState.importedAIProfile);
        presetToImport.aiProfileId = newProfileId;
      } else if (profileImportStrategy === "use-existing") {
        presetToImport.aiProfileId = selectedExistingProfileId;
      } else {
        delete presetToImport.aiProfileId;
      }
    }

    setIsImporting(true);
    try {
      await onImport(presetToImport);
      handleClose();
    } catch (error) {
      console.error("[ImportExportDialog] Import error:", error);
      setImportState((prev) => ({
        ...prev,
        status: "error",
        error: `导入失败：${
          error instanceof Error ? error.message : "未知错误"
        }`,
      }));
    } finally {
      setIsImporting(false);
    }
  }, [
    importState.preset,
    importState.importedAIProfile,
    onImport,
    handleClose,
    profileImportStrategy,
    selectedExistingProfileId,
  ]);

  // 导出预设
  const handleExport = useCallback(
    async (preset: Preset) => {
      setIsExporting(true);
      try {
        const store = useSettingsStore.getState();
        const profile = preset.aiProfileId
          ? store.getProfileById(preset.aiProfileId)
          : undefined;
        const exportedProfile = profile
          ? { name: profile.name, advanced: profile.advanced }
          : undefined;
        const exportData = exportLyraPreset(preset, exportedProfile);
        const json = JSON.stringify(exportData, null, 2);
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = url;
        a.download = `${preset.name}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        handleClose();
      } catch (error) {
        console.error("[ImportExportDialog] Export error:", error);
      } finally {
        setIsExporting(false);
      }
    },
    [handleClose],
  );

  return (
    <Dialog open={mode !== "closed"} onOpenChange={() => handleClose()}>
      <DialogContent
        title={mode === "import" ? "导入预设" : "导出预设"}
        width="lg"
        animateLifecycle
      >
        {mode === "import" && (
          <ImportContent
            state={importState}
            isImporting={isImporting}
            fileInputRef={fileInputRef}
            onFileSelect={handleFileSelect}
            onConfirm={handleConfirmImport}
            onCancel={handleClose}
            profiles={profiles}
            profileImportStrategy={profileImportStrategy}
            selectedExistingProfileId={selectedExistingProfileId}
            onProfileImportStrategyChange={setProfileImportStrategy}
            onSelectedExistingProfileIdChange={setSelectedExistingProfileId}
          />
        )}

        {mode === "export" && (
          <ExportContent
            presets={presetsToExport}
            isExporting={isExporting}
            onExport={handleExport}
            onCancel={handleClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

// ===== 导入内容 =====

interface ImportContentProps {
  state: ImportState;
  isImporting: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFileSelect: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onConfirm: () => void;
  onCancel: () => void;
  profiles: Array<{ id: string; name: string }>;
  profileImportStrategy: ProfileImportStrategy;
  selectedExistingProfileId: string;
  onProfileImportStrategyChange: (strategy: ProfileImportStrategy) => void;
  onSelectedExistingProfileIdChange: (profileId: string) => void;
}

function ImportContent({
  state,
  isImporting,
  fileInputRef,
  onFileSelect,
  onConfirm,
  onCancel,
  profiles,
  profileImportStrategy,
  selectedExistingProfileId,
  onProfileImportStrategyChange,
  onSelectedExistingProfileIdChange,
}: ImportContentProps) {
  // 触发文件选择
  const triggerFileSelect = useCallback(() => {
    fileInputRef.current?.click();
  }, [fileInputRef]);

  return (
    <div className="space-y-4">
      {/* 隐藏的文件输入 */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={onFileSelect}
        className="hidden"
      />

      {/* 文件选择区域 */}
      {state.status === "idle" && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: animation.duration.fast }}
        >
          <button
            onClick={triggerFileSelect}
            className={cn(
              "w-full p-8 rounded-lg border-2 border-dashed",
              "flex flex-col items-center gap-3",
              "transition-all cursor-pointer",
            )}
            style={{
              borderColor: colorAlpha("primary", 0.3),
              background: colorAlpha("bgCard", 0.3),
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = colorAlpha("primary", 0.5);
              e.currentTarget.style.background = colorAlpha("primary", 0.05);
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = colorAlpha("primary", 0.3);
              e.currentTarget.style.background = colorAlpha("bgCard", 0.3);
            }}
          >
            <Upload size={32} style={{ color: color("primary") }} />
            <div className="text-center">
              <p
                className="font-medium"
                style={{ color: color("textPrimary") }}
              >
                点击选择预设文件
              </p>
              <p className="text-sm mt-1" style={{ color: color("textMuted") }}>
                支持此间预设和 SillyTavern 预设格式
              </p>
            </div>
          </button>
        </motion.div>
      )}

      {/* 解析中 */}
      {state.status === "parsing" && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center justify-center gap-3 py-8"
        >
          <div
            className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin"
            style={{ borderColor: color("primary") }}
          />
          <span style={{ color: color("textSecondary") }}>正在解析文件...</span>
        </motion.div>
      )}

      {/* 解析成功 */}
      {state.status === "success" &&
        state.preset &&
        state.format &&
        state.format !== "unknown" && (
          <ImportPreview
            preset={state.preset}
            format={state.format}
            warnings={state.warnings || []}
            fileName={state.fileName}
            importedAIProfile={state.importedAIProfile}
            profiles={profiles}
            profileImportStrategy={profileImportStrategy}
            selectedExistingProfileId={selectedExistingProfileId}
            onProfileImportStrategyChange={onProfileImportStrategyChange}
            onSelectedExistingProfileIdChange={
              onSelectedExistingProfileIdChange
            }
          />
        )}

      {/* 解析错误 */}
      {state.status === "error" && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-lg"
          style={{
            background: colorAlpha("error", 0.1),
            border: `1px solid ${colorAlpha("error", 0.3)}`,
          }}
        >
          <div className="flex items-start gap-3">
            <XCircle
              size={20}
              className="shrink-0 mt-0.5"
              style={{ color: color("error") }}
            />
            <div>
              <p className="font-medium" style={{ color: color("error") }}>
                解析失败
              </p>
              <p className="text-sm mt-1" style={{ color: color("textMuted") }}>
                {state.error}
              </p>
              {state.fileName && (
                <p
                  className="text-xs mt-2"
                  style={{ color: color("textMuted") }}
                >
                  文件：{state.fileName}
                </p>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* 操作按钮 */}
      <div className="flex justify-end gap-3 pt-2">
        <Button variant="ghost" onClick={onCancel}>
          取消
        </Button>

        {state.status === "idle" && (
          <Button onClick={triggerFileSelect}>
            <Upload size={16} className="mr-2" />
            选择文件
          </Button>
        )}

        {state.status === "error" && (
          <Button onClick={triggerFileSelect}>
            <Upload size={16} className="mr-2" />
            重新选择
          </Button>
        )}

        {state.status === "success" && (
          <Button
            onClick={onConfirm}
            disabled={
              isImporting ||
              (state.importedAIProfile &&
                profileImportStrategy === "use-existing" &&
                !selectedExistingProfileId)
            }
          >
            {isImporting ? "导入中..." : "确认导入"}
          </Button>
        )}
      </div>
    </div>
  );
}

// ===== 导入预览 =====

interface ImportPreviewProps {
  preset: Preset;
  format: "lyra" | "tavern";
  warnings: ConversionWarning[];
  fileName?: string;
  importedAIProfile?: ExportedAIProfile;
  profiles: Array<{ id: string; name: string }>;
  profileImportStrategy: ProfileImportStrategy;
  selectedExistingProfileId: string;
  onProfileImportStrategyChange: (strategy: ProfileImportStrategy) => void;
  onSelectedExistingProfileIdChange: (profileId: string) => void;
}

function ImportPreview({
  preset,
  format,
  warnings,
  fileName,
  importedAIProfile,
  profiles,
  profileImportStrategy,
  selectedExistingProfileId,
  onProfileImportStrategyChange,
  onSelectedExistingProfileIdChange,
}: ImportPreviewProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: animation.duration.fast }}
      className="space-y-4"
    >
      {/* 预设信息 */}
      <div
        className="p-4 rounded-lg"
        style={{
          background: colorAlpha("bgCard", 0.5),
          border: `1px solid ${colorAlpha("primary", 0.2)}`,
        }}
      >
        <div className="flex items-start gap-3">
          <FileText
            size={24}
            className="shrink-0"
            style={{ color: color("primary") }}
          />
          <div className="flex-1 min-w-0">
            <h4 className="font-medium" style={{ color: color("textPrimary") }}>
              {preset.name}
            </h4>
            <div
              className="flex items-center gap-2 mt-1 text-sm"
              style={{ color: color("textMuted") }}
            >
              <span>来源：{format === "lyra" ? "此间" : "SillyTavern"}</span>
              <span>•</span>
              <span>提示词块：{preset.blocks.length} 个</span>
            </div>
            {preset.description && (
              <p
                className="text-sm mt-2"
                style={{ color: color("textSecondary") }}
              >
                {preset.description}
              </p>
            )}
            {fileName && (
              <p className="text-xs mt-2" style={{ color: color("textMuted") }}>
                文件：{fileName}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* 转换警告 */}
      {warnings.length > 0 && (
        <div
          className="rounded-lg overflow-hidden"
          style={{
            border: `1px solid ${colorAlpha("warning", 0.3)}`,
          }}
        >
          <div
            className="px-4 py-2 flex items-center gap-2"
            style={{
              background: colorAlpha("warning", 0.1),
            }}
          >
            <AlertTriangle size={16} style={{ color: color("warning") }} />
            <span
              className="text-sm font-medium"
              style={{ color: color("warning") }}
            >
              转换警告 ({warnings.length})
            </span>
          </div>
          <ScrollArea className="max-h-40">
            <div className="p-3 space-y-2">
              {warnings.map((warning, index) => (
                <div
                  key={index}
                  className="flex items-start gap-2 text-sm"
                  style={{ color: color("textSecondary") }}
                >
                  <span
                    className="shrink-0 mt-1"
                    style={{ color: color("warning") }}
                  >
                    •
                  </span>
                  <span>{warning.message}</span>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* AI Profile 导入处理 */}
      {importedAIProfile && (
        <div
          className="p-4 rounded-lg space-y-3"
          style={{
            background: colorAlpha("bgCard", 0.4),
            border: `1px solid ${colorAlpha("primary", 0.25)}`,
          }}
        >
          <div>
            <p
              className="text-sm font-medium"
              style={{ color: color("textPrimary") }}
            >
              检测到 AI Profile
            </p>
            <p
              className="text-sm mt-1"
              style={{ color: color("textSecondary") }}
            >
              预设引用了 AI Profile "{importedAIProfile.name}"
            </p>
          </div>

          <div className="space-y-2">
            <label
              className="flex items-center gap-2 text-sm cursor-pointer"
              style={{ color: color("textSecondary") }}
            >
              <input
                type="radio"
                name="profile-import-strategy"
                checked={profileImportStrategy === "create"}
                onChange={() => onProfileImportStrategyChange("create")}
                style={{ accentColor: color("primary") }}
              />
              <span>创建新 Profile（需手动配置连接信息）</span>
            </label>

            <div className="space-y-2">
              <label
                className="flex items-center gap-2 text-sm cursor-pointer"
                style={{ color: color("textSecondary") }}
              >
                <input
                  type="radio"
                  name="profile-import-strategy"
                  checked={profileImportStrategy === "use-existing"}
                  onChange={() => onProfileImportStrategyChange("use-existing")}
                  style={{ accentColor: color("primary") }}
                />
                <span>使用已有 Profile</span>
              </label>

              <Select
                value={selectedExistingProfileId}
                onValueChange={onSelectedExistingProfileIdChange}
                options={profiles.map((profile) => ({
                  value: profile.id,
                  label: profile.name,
                }))}
                placeholder="选择已有 Profile"
                disabled={profileImportStrategy !== "use-existing"}
                className="ml-6"
              />

              {profileImportStrategy === "use-existing" &&
                !selectedExistingProfileId && (
                  <p
                    className="ml-6 text-xs"
                    style={{ color: color("warning") }}
                  >
                    请选择一个已有 Profile
                  </p>
                )}
            </div>

            <label
              className="flex items-center gap-2 text-sm cursor-pointer"
              style={{ color: color("textSecondary") }}
            >
              <input
                type="radio"
                name="profile-import-strategy"
                checked={profileImportStrategy === "ignore"}
                onChange={() => onProfileImportStrategyChange("ignore")}
                style={{ accentColor: color("primary") }}
              />
              <span>忽略（不关联 Profile）</span>
            </label>
          </div>
        </div>
      )}

      {/* 块预览 */}
      <div>
        <h5
          className="text-sm font-medium mb-2"
          style={{ color: color("textSecondary") }}
        >
          提示词块预览
        </h5>
        <ScrollArea className="max-h-48">
          <div className="space-y-1">
            {preset.blockOrder.map((blockId) => {
              const block = preset.blocks.find((b) => b.id === blockId);
              if (!block) return null;

              return (
                <div
                  key={blockId}
                  className="flex items-center gap-2 px-3 py-2 rounded"
                  style={{
                    background: colorAlpha("bgCard", 0.3),
                  }}
                >
                  {block.enabled ? (
                    <CheckCircle
                      size={14}
                      style={{ color: color("success") }}
                    />
                  ) : (
                    <XCircle size={14} style={{ color: color("textMuted") }} />
                  )}
                  <span
                    className={cn(
                      "flex-1 text-sm",
                      !block.enabled && "opacity-50",
                    )}
                    style={{ color: color("textSecondary") }}
                  >
                    {block.name}
                  </span>
                  <span
                    className="text-xs px-1.5 py-0.5 rounded"
                    style={{
                      background: colorAlpha("primary", 0.1),
                      color: color("primary"),
                    }}
                  >
                    {block.marker ? "Marker" : block.role}
                  </span>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </div>
    </motion.div>
  );
}

// ===== 导出内容 =====

interface ExportContentProps {
  presets: Preset[];
  isExporting: boolean;
  onExport: (preset: Preset) => void;
  onCancel: () => void;
}

function ExportContent({
  presets,
  isExporting,
  onExport,
  onCancel,
}: ExportContentProps) {
  return (
    <div className="space-y-4">
      {presets.length === 0 ? (
        <div className="py-8 text-center" style={{ color: color("textMuted") }}>
          <FileText size={32} className="mx-auto mb-3 opacity-50" />
          <p>没有可导出的预设</p>
          <p className="text-sm mt-1">请先在工作区打开一个预设</p>
        </div>
      ) : (
        <>
          <p className="text-sm" style={{ color: color("textSecondary") }}>
            选择要导出的预设：
          </p>
          <ScrollArea className="max-h-64">
            <div className="space-y-2">
              {presets.map((preset) => (
                <motion.button
                  key={preset.id}
                  onClick={() => onExport(preset)}
                  disabled={isExporting}
                  className={cn(
                    "w-full text-left p-3 rounded-lg",
                    "flex items-center gap-3",
                    "transition-all",
                    isExporting && "opacity-50 cursor-not-allowed",
                  )}
                  style={{
                    background: colorAlpha("bgCard", 0.5),
                    border: `1px solid ${colorAlpha("primary", 0.2)}`,
                  }}
                  whileHover={isExporting ? {} : { scale: 1.01 }}
                  whileTap={isExporting ? {} : { scale: 0.99 }}
                  onMouseEnter={(e) => {
                    if (isExporting) return;
                    e.currentTarget.style.borderColor = colorAlpha(
                      "primary",
                      0.4,
                    );
                    e.currentTarget.style.background = colorAlpha(
                      "primary",
                      0.05,
                    );
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = colorAlpha(
                      "primary",
                      0.2,
                    );
                    e.currentTarget.style.background = colorAlpha(
                      "bgCard",
                      0.5,
                    );
                  }}
                >
                  <FileText size={20} style={{ color: color("primary") }} />
                  <div className="flex-1 min-w-0">
                    <p
                      className="font-medium truncate"
                      style={{ color: color("textPrimary") }}
                    >
                      {preset.name}
                    </p>
                    <p
                      className="text-xs"
                      style={{ color: color("textMuted") }}
                    >
                      {preset.blocks.length} 个块 •{" "}
                      {preset.metadata.source === "lyra"
                        ? "此间预设"
                        : "导入的预设"}
                    </p>
                  </div>
                  <Download size={16} style={{ color: color("textMuted") }} />
                </motion.button>
              ))}
            </div>
          </ScrollArea>
        </>
      )}

      <div className="flex justify-end pt-2">
        <Button variant="ghost" onClick={onCancel}>
          关闭
        </Button>
      </div>
    </div>
  );
}
