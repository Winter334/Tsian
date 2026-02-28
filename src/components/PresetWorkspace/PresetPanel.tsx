/**
 * 预设面板组件
 *
 * 单个预设的编辑面板，包含：
 * - 面板头部（名称、操作按钮）
 * - 预设描述
 * - 提示词块列表（支持拖拽）
 * - 添加块按钮
 */

import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ScrollArea, Select } from "@/components/ui";
import {
  BUILTIN_RULES,
  mergeRules,
  type PostProcessRule,
} from "@/lib/post-process";
import type { PresetPurpose, PromptBlock } from "@/lib/prompt";
import { cn } from "@/lib/utils";
import { useSettingsStore } from "@/stores/settings";
import { animation, borders, color, colorAlpha } from "@/styles/tokens";

import { BlockList } from "./BlockList";
import { useWorkspace } from "./context";
import type { PanelState } from "./hooks/useWorkspaceState";
import { PostProcessPanel } from "./PostProcessPanel";
import { PresetPanelHeader } from "./PresetPanelHeader";

// ===== 类型 =====

interface PresetPanelProps {
  /** 面板状态 */
  panel: PanelState;
  /** 当前拖拽中的块 ID */
  activeDragBlockId?: string | null;
  /** 当前拖拽来源面板 ID */
  dragSourcePanelId?: string | null;
  /** 当前插入指示所属面板 ID */
  dropIndicatorPanelId?: string | null;
  /** 当前插入指示索引 */
  dropIndicatorIndex?: number | null;
}

const PURPOSE_OPTIONS: Array<{ value: PresetPurpose; label: string }> = [
  { value: "narrative", label: "叙事" },
  { value: "parser", label: "解析" },
  { value: "summarizer", label: "总结" },
  { value: "director", label: "导演" },
];

// ===== 组件 =====

/**
 * 预设面板
 */
export function PresetPanel({
  panel,
  activeDragBlockId = null,
  dragSourcePanelId = null,
  dropIndicatorPanelId = null,
  dropIndicatorIndex = null,
}: PresetPanelProps) {
  const workspace = useWorkspace();

  // 描述编辑状态
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [editedDescription, setEditedDescription] = useState(
    panel.preset.description || "",
  );
  const [isPostProcessExpanded, setIsPostProcessExpanded] = useState(false);

  // 处理描述编辑
  const handleStartEditDescription = useCallback(() => {
    setEditedDescription(panel.preset.description || "");
    setIsEditingDescription(true);
  }, [panel.preset.description]);

  const handleSaveDescription = useCallback(() => {
    if (editedDescription !== (panel.preset.description || "")) {
      workspace.updatePanelPreset(panel.id, { description: editedDescription });
    }
    setIsEditingDescription(false);
  }, [editedDescription, panel.id, panel.preset.description, workspace]);

  const purpose: PresetPurpose = panel.preset.purpose ?? "narrative";
  const showPostProcess = purpose === "narrative";

  const handlePurposeChange = useCallback(
    (value: string) => {
      workspace.updatePanelPreset(panel.id, {
        purpose: value as PresetPurpose,
      });
    },
    [workspace, panel.id],
  );

  const profiles = useSettingsStore((s) => s.profiles);
  const aiProfileId = panel.preset.aiProfileId ?? "";
  const singleProfile = profiles.length === 1 ? profiles[0] : null;
  const showProfileSelect = profiles.length > 1;

  useEffect(() => {
    if (!singleProfile) return;
    if (panel.preset.aiProfileId === singleProfile.id) return;

    workspace.updatePanelPreset(panel.id, {
      aiProfileId: singleProfile.id,
    });
  }, [singleProfile, panel.id, panel.preset.aiProfileId, workspace]);

  const profileOptions = useMemo(() => {
    const options = profiles.map((profile) => ({
      value: profile.id,
      label: profile.name,
    }));

    if (profiles.length <= 1) {
      return options;
    }

    return [{ value: "", label: "未绑定（请选择）" }, ...options];
  }, [profiles]);

  const handleAiProfileChange = useCallback(
    (value: string) => {
      workspace.updatePanelPreset(panel.id, {
        aiProfileId: value || undefined,
      });
    },
    [workspace, panel.id],
  );

  const postProcessRules = useMemo(
    () => panel.preset.postProcessRules ?? [],
    [panel.preset.postProcessRules],
  );
  const mergedPostProcessRules = useMemo(
    () => mergeRules(BUILTIN_RULES, postProcessRules),
    [postProcessRules],
  );

  const handlePostProcessRulesChange = useCallback(
    (rules: PostProcessRule[]) => {
      workspace.updatePanelPreset(panel.id, { postProcessRules: rules });
    },
    [workspace, panel.id],
  );

  // 获取排序后的块列表
  const orderedBlocks = panel.preset.blockOrder
    .map((id) => panel.preset.blocks.find((b) => b.id === id))
    .filter((b): b is PromptBlock => b !== undefined);

  const isCurrentPanelDropTarget = dropIndicatorPanelId === panel.id;
  const currentPanelDropIndicatorIndex = isCurrentPanelDropTarget
    ? dropIndicatorIndex
    : null;

  // 处理添加块
  const handleAddBlock = useCallback(() => {
    const newBlock: PromptBlock = {
      id: "", // 会在 addBlockToPanel 中生成
      name: "新提示词块",
      content: "",
      role: "system",
      marker: false,
      injectionDepth: 0,
      order: orderedBlocks.length,
      enabled: true,
    };
    workspace.addBlockToPanel(panel.id, newBlock);
  }, [workspace, panel.id, orderedBlocks.length]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: animation.duration.normal }}
      className={cn(
        "flex flex-col",
        "w-full min-w-70 sm:w-80 sm:min-w-80 sm:max-w-[85vw]",
        "h-full",
        "rounded-lg",
      )}
      style={{
        background: colorAlpha("bgElevated", 0.6),
        border: `${borders.width.DEFAULT} solid ${colorAlpha("primary", 0.3)}`,
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
      }}
    >
      {/* 面板头部 */}
      <PresetPanelHeader panel={panel} />

      {/* 预设描述 */}
      <div
        className={cn("px-3 py-2", "border-b")}
        style={{ borderColor: colorAlpha("primary", 0.15) }}
      >
        {isEditingDescription ? (
          <textarea
            value={editedDescription}
            onChange={(e) => setEditedDescription(e.target.value)}
            onBlur={handleSaveDescription}
            autoFocus
            rows={2}
            className={cn(
              "w-full",
              "px-2 py-1",
              "text-xs",
              "rounded",
              "resize-none",
              "outline-none",
            )}
            style={{
              background: colorAlpha("bgBase", 0.5),
              border: `1px solid ${colorAlpha("primary", 0.4)}`,
              color: color("textSecondary"),
            }}
            placeholder="添加预设描述..."
          />
        ) : (
          <button
            onClick={handleStartEditDescription}
            className={cn(
              "w-full text-left",
              "text-xs",
              "cursor-text",
              "hover:underline",
            )}
            style={{ color: color("textMuted") }}
          >
            {panel.preset.description || "点击添加描述..."}
          </button>
        )}

        {showProfileSelect ? (
          <div className="mt-2 grid grid-cols-2 gap-2 sm:flex sm:flex-col sm:gap-0 sm:space-y-2">
            <div className="space-y-1">
              <p className="text-xs" style={{ color: color("textMuted") }}>
                预设用途
              </p>
              <Select
                value={purpose}
                onValueChange={handlePurposeChange}
                options={PURPOSE_OPTIONS}
                size="sm"
                triggerClassName="sm:h-12 sm:px-4 sm:py-3"
              />
            </div>

            <div className="space-y-1">
              <p className="text-xs" style={{ color: color("textMuted") }}>
                AI Profile
              </p>
              <Select
                value={aiProfileId}
                onValueChange={handleAiProfileChange}
                options={profileOptions}
                size="sm"
                triggerClassName="sm:h-12 sm:px-4 sm:py-3"
              />
            </div>
          </div>
        ) : (
          <div className="mt-2 space-y-1">
            <p className="text-xs" style={{ color: color("textMuted") }}>
              预设用途
            </p>
            <Select
              value={purpose}
              onValueChange={handlePurposeChange}
              options={PURPOSE_OPTIONS}
            />
          </div>
        )}
      </div>

      {/* 提示词块列表 + 后处理规则 */}
      <ScrollArea className="flex-1 p-2">
        <div className="flex flex-col gap-2">
          <BlockList
            panelId={panel.id}
            blocks={orderedBlocks}
            isDraggingOver={isCurrentPanelDropTarget}
            activeDragBlockId={activeDragBlockId}
            dragSourcePanelId={dragSourcePanelId}
            dropIndicatorIndex={currentPanelDropIndicatorIndex}
          />

          {showPostProcess && (
            <div
              className="rounded-md border"
              style={{
                borderColor: colorAlpha("primary", 0.2),
                background: colorAlpha("bgElevated", 0.2),
              }}
            >
              <button
                type="button"
                onClick={() => setIsPostProcessExpanded((prev) => !prev)}
                aria-expanded={isPostProcessExpanded}
                className={cn(
                  "w-full",
                  "flex items-center justify-between gap-2",
                  "px-3 py-2",
                  "text-left",
                )}
              >
                <span className="inline-flex items-center gap-2">
                  <span
                    className="text-sm"
                    style={{ color: color("textSecondary") }}
                  >
                    后处理规则
                  </span>
                  <span
                    className="text-xs"
                    style={{ color: color("textMuted") }}
                  >
                    {mergedPostProcessRules.length} 条
                  </span>
                </span>

                <ChevronDown
                  size={16}
                  className={cn(
                    "transition-transform",
                    isPostProcessExpanded && "rotate-180",
                  )}
                  style={{
                    color: color("textMuted"),
                    transitionDuration: `${animation.duration.fast * 1000}ms`,
                  }}
                />
              </button>

              <AnimatePresence initial={false}>
                {isPostProcessExpanded && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: animation.duration.normal }}
                    className="overflow-hidden"
                  >
                    <div
                      className="border-t p-2"
                      style={{ borderColor: colorAlpha("primary", 0.15) }}
                    >
                      <PostProcessPanel
                        rules={postProcessRules}
                        onChange={handlePostProcessRulesChange}
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* 添加块按钮 */}
      <div
        className={cn("px-3 py-2", "border-t")}
        style={{ borderColor: colorAlpha("primary", 0.15) }}
      >
        <motion.button
          onClick={handleAddBlock}
          className={cn(
            "w-full",
            "flex items-center justify-center gap-1.5",
            "px-3 py-1.5",
            "text-sm",
            "rounded",
            "transition-all",
          )}
          style={{
            color: color("textSecondary"),
            background: "transparent",
            border: `1px dashed ${colorAlpha("primary", 0.3)}`,
            transitionDuration: `${animation.duration.fast * 1000}ms`,
          }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = color("textPrimary");
            e.currentTarget.style.background = colorAlpha("primary", 0.1);
            e.currentTarget.style.borderColor = colorAlpha("primary", 0.5);
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = color("textSecondary");
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.borderColor = colorAlpha("primary", 0.3);
          }}
        >
          <Plus size={14} />
          <span>添加块</span>
        </motion.button>
      </div>
    </motion.div>
  );
}
