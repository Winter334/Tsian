/**
 * 块编辑弹窗组件
 *
 * 支持：
 * - 普通块编辑：名称、角色、内容
 * - Marker 块编辑：类型选择、配置
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  Button,
  Dialog,
  DialogContent,
  Input,
  Select,
  Textarea,
} from "@/components/ui";
import { messageAssembler, type PromptBlock } from "@/lib/prompt";
import { getAllMarkers } from "@/lib/prompt/marker-registry";
import { cn } from "@/lib/utils";
import { borders, color, colorAlpha } from "@/styles/tokens";

import { useWorkspace } from "./context";
import { MarkerConfigPanel } from "./MarkerConfigPanel";

// ===== 类型定义 =====

/** 消息角色选项 */
const ROLE_OPTIONS = [
  { value: "system", label: "system" },
  { value: "user", label: "user" },
  { value: "assistant", label: "assistant" },
];

/** Marker 类型选项 */
const MARKER_TYPE_OPTIONS = getAllMarkers().map((entry) => ({
  value: entry.id,
  label: `${entry.id} (${entry.displayName})`,
}));

interface EditorVariableItem {
  key: string;
  token: string;
  description: string;
}

interface EditorVariableGroup {
  id: "marker" | "alias" | "macro";
  title: string;
  hint: string;
  tone: "primary" | "secondary" | "warning";
  variables: EditorVariableItem[];
}

const MARKER_VARIABLE_DESCRIPTION_MAP: Record<string, string> = {
  chatHistory: "对话历史（多消息）",
  characterSheet: "角色数据表（Parser专用）",
  characterDescription: "角色描写（Narrative专用）",
  narrativeState: "状态速览（Narrative专用）",
  resultFrame: "本轮结算结果",
  operationDefs: "RuleScript 操作定义",
  worldInfo: "世界书激活内容",
  scenario: "当前剧情梗概",
  turnInfo: "回合号与玩家行动",
  memorySummary: "三级记忆摘要",
};

/** Marker 主变量（动态内容占位符） */
const MARKER_VARIABLES: EditorVariableItem[] = getAllMarkers()
  .filter((entry) => !entry.multiMessage)
  .map((entry) => ({
    key: entry.id,
    token: `{{${entry.id}}}`,
    description: MARKER_VARIABLE_DESCRIPTION_MAP[entry.id] ?? entry.description,
  }));

/** Marker 兼容别名（旧预设/写法兼容） */
const MARKER_ALIAS_VARIABLES: EditorVariableItem[] = getAllMarkers()
  .filter((entry) => !entry.multiMessage)
  .flatMap((entry) =>
    (entry.aliases ?? []).map((alias) => ({
      key: `${entry.id}:${alias}`,
      token: `{{${alias}}}`,
      description: `兼容别名（对应${entry.displayName}）`,
    })),
  );

/** 系统宏变量（由 resolver 内置支持） */
const SYSTEM_MACRO_VARIABLES: EditorVariableItem[] = [
  {
    key: "char",
    token: "{{char}}",
    description: "当前AI角色名",
  },
  { key: "turn", token: "{{turn}}", description: "当前回合数" },
  { key: "date", token: "{{date}}", description: "当前日期" },
  { key: "time", token: "{{time}}", description: "当前时间" },
  { key: "datetime", token: "{{datetime}}", description: "当前日期时间" },
  { key: "weekday", token: "{{weekday}}", description: "当前星期" },
  { key: "group", token: "{{group}}", description: "联机模式玩家名列表" },
];

const VARIABLE_GROUPS: EditorVariableGroup[] = [
  {
    id: "marker",
    title: "Marker 动态内容",
    hint: "注入系统动态内容（角色数据、世界信息、结算结果等）",
    tone: "primary",
    variables: MARKER_VARIABLES,
  },
  {
    id: "alias",
    title: "兼容别名",
    hint: "用于兼容旧预设写法，功能与对应主变量等价",
    tone: "secondary",
    variables: MARKER_ALIAS_VARIABLES,
  },
  {
    id: "macro",
    title: "系统宏变量",
    hint: "由变量解析器内置提供，返回角色、时间、回合等基础信息",
    tone: "warning",
    variables: SYSTEM_MACRO_VARIABLES,
  },
];

// ===== 组件 =====

export interface BlockEditorDialogProps {
  /** 是否打开 */
  open: boolean;
  /** 关闭回调 */
  onOpenChange: (open: boolean) => void;
  /** 面板 ID */
  panelId: string;
  /** 要编辑的块 */
  block: PromptBlock;
}

/**
 * 块编辑弹窗
 */
export function BlockEditorDialog({
  open,
  onOpenChange,
  panelId,
  block,
}: BlockEditorDialogProps) {
  const workspace = useWorkspace();

  // 本地编辑状态
  const [editedBlock, setEditedBlock] = useState<PromptBlock>(block);
  const contentTextareaRef = useRef<HTMLTextAreaElement>(null);
  const contentSelectionRef = useRef({
    start: block.content.length,
    end: block.content.length,
  });

  // 当 block 变化时重置编辑状态
  useEffect(() => {
    setEditedBlock(block);
    const cursor = block.content.length;
    contentSelectionRef.current = { start: cursor, end: cursor };
  }, [block]);

  // 更新块属性的辅助函数
  const updateField = useCallback(
    <K extends keyof PromptBlock>(field: K, value: PromptBlock[K]) => {
      setEditedBlock((prev) => ({ ...prev, [field]: value }));
    },
    [],
  );

  // 更新 markerConfig 的辅助函数
  const updateMarkerConfig = useCallback(
    (config: PromptBlock["markerConfig"]) => {
      setEditedBlock((prev) => ({ ...prev, markerConfig: config }));
    },
    [],
  );

  // 同步 textarea 的光标/选区位置（用于变量插入）
  const syncContentSelection = useCallback(
    (textarea: HTMLTextAreaElement | null) => {
      if (!textarea) return;
      const start = textarea.selectionStart ?? 0;
      const end = textarea.selectionEnd ?? start;
      contentSelectionRef.current = { start, end };
    },
    [],
  );

  // 内容编辑（普通块）
  const handleContentChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      updateField("content", event.target.value);
      syncContentSelection(event.target);
    },
    [updateField, syncContentSelection],
  );

  // 点击变量：在光标位置插入
  const handleInsertVariable = useCallback((token: string) => {
    setEditedBlock((prev) => {
      if (prev.marker) return prev;

      const content = prev.content ?? "";
      const textarea = contentTextareaRef.current;
      let { start, end } = contentSelectionRef.current;

      if (textarea && document.activeElement === textarea) {
        start = textarea.selectionStart ?? start;
        end = textarea.selectionEnd ?? end;
      }

      const safeStart = Math.max(0, Math.min(start, content.length));
      const safeEnd = Math.max(safeStart, Math.min(end, content.length));
      const nextContent =
        content.slice(0, safeStart) + token + content.slice(safeEnd);
      const nextCursor = safeStart + token.length;

      contentSelectionRef.current = { start: nextCursor, end: nextCursor };

      requestAnimationFrame(() => {
        const currentTextarea = contentTextareaRef.current;
        if (!currentTextarea) return;
        currentTextarea.focus();
        currentTextarea.setSelectionRange(nextCursor, nextCursor);
      });

      return { ...prev, content: nextContent };
    });
  }, []);

  // 处理类型切换（普通块 <-> Marker 块）
  const handleTypeChange = useCallback((isMarker: boolean) => {
    setEditedBlock((prev) => ({
      ...prev,
      marker: isMarker,
      // 切换为 Marker 时设置默认类型
      markerType: isMarker ? prev.markerType || "chatHistory" : undefined,
      // 切换为 Marker 时清空内容
      content: isMarker ? "" : prev.content,
    }));
  }, []);

  // 保存
  const handleSave = useCallback(() => {
    workspace.updatePanelBlock(panelId, block.id, editedBlock);
    onOpenChange(false);
    workspace.finishEditingBlock();
  }, [workspace, panelId, block.id, editedBlock, onOpenChange]);

  // 取消
  const handleCancel = useCallback(() => {
    onOpenChange(false);
    workspace.finishEditingBlock();
  }, [onOpenChange, workspace]);

  // 判断是否有更改
  const hasChanges = useMemo(() => {
    return JSON.stringify(editedBlock) !== JSON.stringify(block);
  }, [editedBlock, block]);

  // Marker 自动填充预览：读取上一次 assemble 时的缓存结果
  const markerPreviewContent = useMemo(() => {
    if (!editedBlock.marker) {
      return "";
    }

    const cachedMessages = messageAssembler.getLastMarkerResult(editedBlock.id);
    if (cachedMessages.length === 0) {
      return "（尚未进行过对话，暂无填充记录）";
    }

    return cachedMessages
      .map(
        (message, index) =>
          `[${index + 1}] (${message.role})\n${message.content}`,
      )
      .join("\n\n---\n\n");
  }, [editedBlock.marker, editedBlock.id]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="编辑提示词块"
        width="lg"
        animateLifecycle
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={handleCancel}>
              取消
            </Button>
            <Button onClick={handleSave} disabled={!hasChanges}>
              保存
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          {/* 名称 */}
          <FormField label="名称">
            <Input
              value={editedBlock.name}
              onChange={(e) => updateField("name", e.target.value)}
              placeholder="输入块名称"
            />
          </FormField>

          {/* 类型选择 */}
          <FormField label="类型">
            <TypeSelector
              isMarker={editedBlock.marker}
              onChange={handleTypeChange}
            />
          </FormField>

          {/* Marker 类型选择（仅 Marker 块显示） */}
          {editedBlock.marker && (
            <FormField label="Marker 类型">
              <Select
                value={editedBlock.markerType || "chatHistory"}
                onValueChange={(value) =>
                  updateField("markerType", value as PromptBlock["markerType"])
                }
                options={MARKER_TYPE_OPTIONS}
              />
            </FormField>
          )}

          {/* 消息角色 */}
          <FormField label="消息角色">
            <Select
              value={editedBlock.role}
              onValueChange={(value) =>
                updateField("role", value as PromptBlock["role"])
              }
              options={ROLE_OPTIONS}
            />
          </FormField>

          {/* 内容编辑（仅普通块显示） */}
          {!editedBlock.marker && (
            <FormField label="内容">
              <Textarea
                ref={contentTextareaRef}
                value={editedBlock.content}
                onChange={handleContentChange}
                onClick={(event) => syncContentSelection(event.currentTarget)}
                onKeyUp={(event) => syncContentSelection(event.currentTarget)}
                onSelect={(event) => syncContentSelection(event.currentTarget)}
                placeholder="输入提示词内容..."
                className="min-h-50 font-mono text-sm"
              />
              <VariableHints onInsertVariable={handleInsertVariable} />
            </FormField>
          )}

          {/* Marker 配置（仅 Marker 块显示） */}
          {editedBlock.marker && (
            <>
              <MarkerConfigPanel
                markerType={editedBlock.markerType}
                config={editedBlock.markerConfig}
                onConfigChange={updateMarkerConfig}
              />
              <MarkerPreview content={markerPreviewContent} />
              <MarkerHint />
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ===== 辅助组件 =====

/**
 * 表单字段容器
 */
function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        className="text-sm font-medium"
        style={{ color: color("textSecondary") }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

/**
 * 类型选择器（普通块 / Marker 块）
 */
function TypeSelector({
  isMarker,
  onChange,
}: {
  isMarker: boolean;
  onChange: (isMarker: boolean) => void;
}) {
  return (
    <div className="flex gap-4">
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="radio"
          name="blockType"
          checked={!isMarker}
          onChange={() => onChange(false)}
          className="w-4 h-4 accent-(--color-primary)"
          style={
            {
              "--color-primary": color("primary"),
            } as React.CSSProperties
          }
        />
        <span className="text-sm" style={{ color: color("textSecondary") }}>
          普通块
        </span>
      </label>
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="radio"
          name="blockType"
          checked={isMarker}
          onChange={() => onChange(true)}
          className="w-4 h-4 accent-(--color-primary)"
          style={
            {
              "--color-primary": color("primary"),
            } as React.CSSProperties
          }
        />
        <span className="text-sm" style={{ color: color("textSecondary") }}>
          Marker 块
        </span>
      </label>
    </div>
  );
}

const MOBILE_LONG_PRESS_DELAY_MS = 500;
const MOBILE_INSERT_FEEDBACK_MS = 1200;
const MOBILE_HINT_FEEDBACK_MS = 8000;
const INSERT_FLASH_MS = 220;

interface VariableHintChipProps {
  variable: EditorVariableItem;
  tone: EditorVariableGroup["tone"];
  isTouchDevice: boolean;
  onInsertVariable: (token: string) => void;
  onMobileInserted: (message: string) => void;
  onMobileHint: (message: string) => void;
}

function VariableHintChip({
  variable,
  tone,
  isTouchDevice,
  onInsertVariable,
  onMobileInserted,
  onMobileHint,
}: VariableHintChipProps) {
  const [isPressing, setIsPressing] = useState(false);
  const [isInsertFlash, setIsInsertFlash] = useState(false);

  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insertFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const touchGestureHandledRef = useRef(false);

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current === null) return;
    clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = null;
  }, []);

  const clearInsertFlashTimer = useCallback(() => {
    if (insertFlashTimerRef.current === null) return;
    clearTimeout(insertFlashTimerRef.current);
    insertFlashTimerRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      clearLongPressTimer();
      clearInsertFlashTimer();
    };
  }, [clearLongPressTimer, clearInsertFlashTimer]);

  const handleInsert = useCallback(
    (triggeredByLongPress: boolean) => {
      onInsertVariable(variable.token);

      clearInsertFlashTimer();
      setIsInsertFlash(true);
      insertFlashTimerRef.current = setTimeout(() => {
        setIsInsertFlash(false);
      }, INSERT_FLASH_MS);

      if (!triggeredByLongPress) {
        return;
      }

      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate(12);
      }

      onMobileInserted(`${variable.token}：${variable.description}`);
    },
    [clearInsertFlashTimer, onInsertVariable, onMobileInserted, variable],
  );

  const showMobileHint = useCallback(() => {
    onMobileHint(`${variable.token}：${variable.description}`);
  }, [onMobileHint, variable]);

  const handleClick = useCallback(() => {
    if (isTouchDevice) return;
    handleInsert(false);
  }, [handleInsert, isTouchDevice]);

  const handleTouchStart = useCallback(() => {
    if (!isTouchDevice) return;

    touchGestureHandledRef.current = false;
    clearLongPressTimer();
    setIsPressing(true);

    longPressTimerRef.current = setTimeout(() => {
      touchGestureHandledRef.current = true;
      setIsPressing(false);
      clearLongPressTimer();
      handleInsert(true);
    }, MOBILE_LONG_PRESS_DELAY_MS);
  }, [clearLongPressTimer, handleInsert, isTouchDevice]);

  const handleTouchEnd = useCallback(() => {
    if (!isTouchDevice) return;

    const shouldShowHint = !touchGestureHandledRef.current;
    clearLongPressTimer();
    setIsPressing(false);

    if (shouldShowHint) {
      showMobileHint();
    }

    touchGestureHandledRef.current = false;
  }, [clearLongPressTimer, isTouchDevice, showMobileHint]);

  const handleTouchCancel = useCallback(() => {
    touchGestureHandledRef.current = true;
    clearLongPressTimer();
    setIsPressing(false);
  }, [clearLongPressTimer]);

  const handleTouchMove = useCallback(() => {
    if (!isTouchDevice) return;
    touchGestureHandledRef.current = true;
    clearLongPressTimer();
    setIsPressing(false);
  }, [clearLongPressTimer, isTouchDevice]);

  const handleContextMenu = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      if (!isTouchDevice) return;
      event.preventDefault();
    },
    [isTouchDevice],
  );

  return (
    <button
      type="button"
      onMouseDown={(event) => event.preventDefault()}
      onClick={handleClick}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
      onTouchMove={handleTouchMove}
      onContextMenu={handleContextMenu}
      className={cn(
        "inline-flex max-w-full select-none items-center gap-1.5 rounded-md border px-2 py-1 text-left text-[11px] transition-all",
        "min-h-11 min-w-11 sm:min-h-8 sm:min-w-0",
        isPressing && "scale-[0.97]",
      )}
      style={{
        background: isPressing
          ? colorAlpha(tone, 0.18)
          : isInsertFlash
            ? colorAlpha(tone, 0.2)
            : colorAlpha(tone, 0.12),
        borderColor: isInsertFlash
          ? colorAlpha(tone, 0.45)
          : colorAlpha(tone, 0.28),
        boxShadow: isPressing
          ? `inset 0 0 0 1px ${colorAlpha(tone, 0.4)}`
          : undefined,
        touchAction: "manipulation",
      }}
      title={`${variable.token}\n${variable.description}`}
    >
      <code
        className="shrink-0 rounded px-1.5 py-0.5 font-mono leading-4 sm:px-1 sm:py-0.5"
        style={{
          background: colorAlpha(tone, 0.18),
          color: color(tone),
        }}
      >
        {variable.token}
      </code>
      <span
        className="hidden max-w-[18rem] truncate sm:inline"
        style={{ color: color("textSecondary") }}
      >
        {variable.description}
      </span>
    </button>
  );
}

/**
 * 可用变量提示（移动端：长按插入 + 紧凑布局；桌面端：点击插入）
 */
function VariableHints({
  onInsertVariable,
}: {
  onInsertVariable: (token: string) => void;
}) {
  const nonEmptyGroups = VARIABLE_GROUPS.filter(
    (group) => group.variables.length > 0,
  );

  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [mobileFeedback, setMobileFeedback] = useState<{
    type: "inserted" | "hint";
    message: string;
  } | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<
    Record<EditorVariableGroup["id"], boolean>
  >(() => ({
    marker: false,
    alias: false,
    macro: false,
  }));

  const mobileFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const clearMobileFeedbackTimer = useCallback(() => {
    if (mobileFeedbackTimerRef.current === null) return;
    clearTimeout(mobileFeedbackTimerRef.current);
    mobileFeedbackTimerRef.current = null;
  }, []);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      typeof window.matchMedia !== "function"
    ) {
      return;
    }

    const mediaQuery = window.matchMedia("(hover: none) and (pointer: coarse)");
    const updateTouchDevice = () => setIsTouchDevice(mediaQuery.matches);

    updateTouchDevice();

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", updateTouchDevice);
      return () => mediaQuery.removeEventListener("change", updateTouchDevice);
    }

    mediaQuery.addListener(updateTouchDevice);
    return () => mediaQuery.removeListener(updateTouchDevice);
  }, []);

  useEffect(() => {
    return () => {
      clearMobileFeedbackTimer();
    };
  }, [clearMobileFeedbackTimer]);

  useEffect(() => {
    if (isTouchDevice) return;
    clearMobileFeedbackTimer();
    setMobileFeedback(null);
  }, [clearMobileFeedbackTimer, isTouchDevice]);

  const showMobileInsertFeedback = useCallback(
    (message: string) => {
      if (!isTouchDevice) return;

      clearMobileFeedbackTimer();
      setMobileFeedback({ type: "inserted", message });
      mobileFeedbackTimerRef.current = setTimeout(() => {
        setMobileFeedback(null);
      }, MOBILE_INSERT_FEEDBACK_MS);
    },
    [clearMobileFeedbackTimer, isTouchDevice],
  );

  const showMobileHintFeedback = useCallback(
    (message: string) => {
      if (!isTouchDevice) return;

      clearMobileFeedbackTimer();
      setMobileFeedback({ type: "hint", message });
      mobileFeedbackTimerRef.current = setTimeout(() => {
        setMobileFeedback(null);
      }, MOBILE_HINT_FEEDBACK_MS);
    },
    [clearMobileFeedbackTimer, isTouchDevice],
  );

  const toggleGroup = useCallback((groupId: EditorVariableGroup["id"]) => {
    setExpandedGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  }, []);

  return (
    <div
      className={cn("mt-2 rounded-md p-2 text-xs flex flex-col gap-2")}
      style={{
        background: colorAlpha("bgElevated", 0.5),
        border: `1px solid ${colorAlpha("primary", 0.2)}`,
        borderRadius: borders.radius.sm,
      }}
    >
      <div className="flex items-center justify-between gap-2 px-1">
        <span className="font-medium" style={{ color: color("textSecondary") }}>
          可用变量
        </span>
        <span
          className="hidden sm:inline"
          style={{ color: color("textMuted") }}
        >
          点击标签可插入到光标位置
        </span>
        <span className="sm:hidden" style={{ color: color("textMuted") }}>
          短按查看说明，长按 0.5 秒可插入变量
        </span>
      </div>

      {isTouchDevice && mobileFeedback && (
        <div
          className="sm:hidden rounded px-2 py-1 text-[11px]"
          style={{
            background:
              mobileFeedback.type === "inserted"
                ? colorAlpha("primary", 0.1)
                : colorAlpha("primary", 0.06),
            border: `1px solid ${
              mobileFeedback.type === "inserted"
                ? colorAlpha("primary", 0.25)
                : colorAlpha("primary", 0.18)
            }`,
            color: color("textSecondary"),
          }}
        >
          {mobileFeedback.type === "inserted" ? "已插入 " : "变量说明："}
          {mobileFeedback.message}
        </div>
      )}

      {nonEmptyGroups.map((group) => {
        const isExpanded = expandedGroups[group.id] ?? false;

        return (
          <section key={group.id} className="flex flex-col gap-1">
            <button
              type="button"
              onClick={() => toggleGroup(group.id)}
              aria-expanded={isExpanded}
              aria-controls={`variable-group-${group.id}`}
              className={cn(
                "w-full cursor-pointer select-none rounded px-2 py-1.5 text-left",
                "flex items-center justify-between gap-2 transition-colors",
              )}
              style={{
                background: isExpanded
                  ? colorAlpha("bgCard", 0.45)
                  : colorAlpha("bgCard", 0.35),
                border: `1px solid ${colorAlpha(group.tone, 0.2)}`,
                borderRadius: borders.radius.sm,
              }}
            >
              <span
                className="font-medium"
                style={{ color: color("textPrimary") }}
              >
                {group.title}
              </span>
              <div className="flex items-center gap-2">
                <span style={{ color: color("textMuted") }}>
                  {group.variables.length} 个
                </span>
                <span style={{ color: color("textMuted") }}>
                  {isExpanded ? "▼" : "▶"}
                </span>
              </div>
            </button>

            <div
              id={`variable-group-${group.id}`}
              className={cn(
                "grid transition-[grid-template-rows,opacity] duration-200 ease-out",
                !isExpanded && "pointer-events-none",
              )}
              style={{
                gridTemplateRows: isExpanded ? "1fr" : "0fr",
                opacity: isExpanded ? 1 : 0,
              }}
            >
              <div className="min-h-0 overflow-hidden">
                <div className="mt-2 flex flex-col gap-2 px-1">
                  <p
                    className="hidden text-[11px] sm:block"
                    style={{ color: color("textMuted") }}
                  >
                    {group.hint}
                  </p>
                  <div className="flex flex-wrap gap-2 sm:gap-1.5">
                    {group.variables.map((variable) => (
                      <VariableHintChip
                        key={variable.key}
                        variable={variable}
                        tone={group.tone}
                        isTouchDevice={isTouchDevice}
                        onInsertVariable={onInsertVariable}
                        onMobileInserted={showMobileInsertFeedback}
                        onMobileHint={showMobileHintFeedback}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}

/**
 * Marker 自动填充内容预览
 */
function MarkerPreview({ content }: { content: string }) {
  return (
    <FormField label="自动填充预览">
      <Textarea
        value={content}
        readOnly
        className="min-h-50 font-mono text-sm"
      />
      <p className="text-xs px-1" style={{ color: color("textMuted") }}>
        显示上一次对话时该 Marker 块的实际填充内容，仅用于编辑参考。
      </p>
    </FormField>
  );
}

/**
 * Marker 块提示
 */
function MarkerHint() {
  return (
    <div
      className={cn("flex items-start gap-2 p-3 rounded")}
      style={{
        background: colorAlpha("secondary", 0.1),
        border: `1px solid ${colorAlpha("secondary", 0.3)}`,
        borderRadius: borders.radius.md,
      }}
    >
      <span className="text-base">ⓘ</span>
      <span className="text-sm" style={{ color: color("textSecondary") }}>
        Marker 块的内容由系统自动填充，无需手动编辑
      </span>
    </div>
  );
}
