/**
 * 条目全屏编辑器
 *
 * 设计文档 4.2 / 5.3 / 8.2 节：
 * - 所有端统一全屏编辑器
 * - 显式保存按钮
 * - 返回时若有未保存改动，弹确认框
 * - 编辑字段：名称、启用、备注、正文、激活策略、关键词、扫描深度
 */

import { motion } from "framer-motion";
import { ArrowLeft, Save } from "lucide-react";
import { useCallback, useState } from "react";

import {
  Button,
  ConfirmDialog,
  Input,
  ScrollArea,
  Textarea,
  Toggle,
} from "@/components/ui";
import { cn } from "@/lib/utils";
import {
  animation,
  borders,
  color,
  colorAlpha,
  gradientText,
  panelVariants,
} from "@/styles/tokens";

import { ActivationStrategySection } from "./ActivationStrategySection";
import { useLorebookEntryEditor } from "./hooks/useLorebookEntryEditor";

// ===== 类型 =====

interface LorebookEntryEditorFullscreenProps {
  /** 世界书 ID */
  lorebookId: string;
  /** 条目 ID */
  entryId: string;
  /** 返回条目列表 */
  onClose: () => void;
}

// ===== 组件 =====

export function LorebookEntryEditorFullscreen({
  lorebookId,
  entryId,
  onClose,
}: LorebookEntryEditorFullscreenProps) {
  const { draft, isDirty, isSaving, updateDraft, save, resetDraft } =
    useLorebookEntryEditor(lorebookId, entryId);

  // 未保存确认弹窗
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  // 返回处理
  const handleBack = useCallback(() => {
    if (isDirty) {
      setShowDiscardConfirm(true);
    } else {
      onClose();
    }
  }, [isDirty, onClose]);

  // 确认丢弃
  const handleDiscardConfirm = useCallback(() => {
    setShowDiscardConfirm(false);
    resetDraft();
    onClose();
  }, [resetDraft, onClose]);

  // 保存并返回
  const handleSave = useCallback(async () => {
    const success = await save();
    if (success) {
      onClose();
    }
    // 保存失败时停留在编辑页，允许继续修改后重试（设计文档 10.3）
  }, [save, onClose]);

  // 仅保存不返回
  const handleSaveOnly = useCallback(async () => {
    await save();
  }, [save]);

  return (
    <>
      <motion.div
        variants={panelVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="absolute inset-0 z-10 flex flex-col"
        style={{
          background: colorAlpha("bgBase", 0.98),
          backdropFilter: "blur(12px)",
        }}
      >
        {/* 顶部工具栏 */}
        <EditorToolbar
          name={draft.name}
          isDirty={isDirty}
          isSaving={isSaving}
          onBack={handleBack}
          onSave={handleSaveOnly}
        />

        {/* 编辑表单 */}
        <ScrollArea className="flex-1">
          <div className="max-w-2xl mx-auto p-4 pb-8 space-y-6">
            {/* 基本信息区 */}
            <EditorSection title="基本信息">
              {/* 名称 */}
              <FormField label="条目名称">
                <Input
                  value={draft.name}
                  onChange={(e) => updateDraft("name", e.target.value)}
                  placeholder="输入条目名称"
                />
              </FormField>

              {/* 启用状态 */}
              <div className="flex items-center justify-between">
                <div>
                  <span
                    className="text-sm font-medium"
                    style={{ color: color("textSecondary") }}
                  >
                    启用
                  </span>
                  <p
                    className="text-xs mt-0.5"
                    style={{ color: color("textMuted") }}
                  >
                    禁用后条目不会被激活
                  </p>
                </div>
                <Toggle
                  checked={draft.enabled}
                  onCheckedChange={(checked) => updateDraft("enabled", checked)}
                />
              </div>

              {/* 备注 */}
              <FormField label="备注（可选）">
                <Input
                  value={draft.comment}
                  onChange={(e) => updateDraft("comment", e.target.value)}
                  placeholder="仅用于管理，不发送给 AI"
                />
              </FormField>
            </EditorSection>

            {/* 内容区 */}
            <EditorSection title="条目内容">
              <Textarea
                value={draft.content}
                onChange={(e) => updateDraft("content", e.target.value)}
                placeholder="输入条目内容，支持变量模板如 {{user}}、{{char}}..."
                className="min-h-48 font-mono text-sm"
              />
              <p className="text-xs px-1" style={{ color: color("textMuted") }}>
                此内容将在条目激活时发送给 AI。
              </p>
            </EditorSection>

            {/* 激活策略区 */}
            <EditorSection>
              <ActivationStrategySection
                strategy={draft.activationStrategy}
                onStrategyChange={(s) => updateDraft("activationStrategy", s)}
                keywords={draft.primaryKeywords}
                onKeywordsChange={(kw) => updateDraft("primaryKeywords", kw)}
                scanDepth={draft.scanDepth}
                onScanDepthChange={(d) => updateDraft("scanDepth", d)}
              />
            </EditorSection>

            {/* 底部保存按钮（移动端方便操作） */}
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="ghost" onClick={handleBack}>
                取消
              </Button>
              <Button onClick={handleSave} disabled={!isDirty || isSaving}>
                <Save size={16} className="mr-1.5" />
                {isSaving ? "保存中..." : "保存"}
              </Button>
            </div>
          </div>
        </ScrollArea>
      </motion.div>

      {/* 未保存确认弹窗 */}
      <ConfirmDialog
        open={showDiscardConfirm}
        onOpenChange={setShowDiscardConfirm}
        title="未保存的更改"
        description="当前条目有未保存的修改，确定要放弃更改并返回吗？"
        confirmText="放弃更改"
        cancelText="继续编辑"
        variant="destructive"
        onConfirm={handleDiscardConfirm}
      />
    </>
  );
}

// ===== 子组件 =====

/** 编辑器顶部工具栏 */
function EditorToolbar({
  name,
  isDirty,
  isSaving,
  onBack,
  onSave,
}: {
  name: string;
  isDirty: boolean;
  isSaving: boolean;
  onBack: () => void;
  onSave: () => void;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between",
        "px-4 py-3",
        "border-b shrink-0"
      )}
      style={{
        borderColor: colorAlpha("primary", 0.25),
        background: colorAlpha("bgElevated", 0.5),
      }}
    >
      {/* 左侧：返回 + 标题 */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onBack}
          className="p-1.5 rounded-md transition-all shrink-0"
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
          aria-label="返回条目列表"
        >
          <ArrowLeft size={18} />
        </button>

        <div className="min-w-0">
          <h2
            className="text-sm font-semibold truncate"
            style={{ color: color("textPrimary") }}
          >
            {name || "未命名条目"}
          </h2>
          {isDirty && (
            <span className="text-xs" style={{ color: color("warning") }}>
              ● 未保存
            </span>
          )}
        </div>
      </div>

      {/* 右侧：保存按钮 */}
      <Button size="sm" onClick={onSave} disabled={!isDirty || isSaving}>
        <Save size={14} className="mr-1" />
        {isSaving ? "保存中..." : "保存"}
      </Button>
    </div>
  );
}

/** 表单分区容器 */
function EditorSection({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="flex flex-col gap-4 p-4 rounded-lg border"
      style={{
        borderColor: colorAlpha("primary", 0.15),
        background: colorAlpha("bgCard", 0.3),
        borderRadius: borders.radius.lg,
      }}
    >
      {title && (
        <h3 className="text-sm font-semibold" style={gradientText()}>
          {title}
        </h3>
      )}
      {children}
    </div>
  );
}

/** 表单字段容 */
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
