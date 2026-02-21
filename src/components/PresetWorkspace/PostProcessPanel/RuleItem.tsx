/**
 * 后处理规则列表项
 *
 * 支持：
 * - 拖拽排序
 * - 行点击编辑
 * - 启用/禁用小开关
 * - 悬停显示编辑/删除操作
 */
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion } from "framer-motion";
import { GripVertical, Pencil, Trash2 } from "lucide-react";
import { useCallback, useMemo, useState, type MouseEvent } from "react";

import { ConfirmDialog } from "@/components/ui";
import type { PostProcessRule } from "@/lib/post-process";
import { cn } from "@/lib/utils";
import { animation, color, colorAlpha, glow } from "@/styles/tokens";

export interface RuleItemProps {
  rule: PostProcessRule;
  onToggleEnabled: (id: string, enabled: boolean) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

interface MiniToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

/**
 * 紧凑型开关，风格与 BlockItem 保持一致。
 */
function MiniToggle({ checked, onChange, disabled = false }: MiniToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        onChange(!checked);
      }}
      className={cn(
        "relative inline-flex h-4 w-7 items-center rounded-full",
        "transition-all duration-200",
        disabled && "cursor-not-allowed opacity-50",
        !disabled && "cursor-pointer",
      )}
      style={{
        background: checked
          ? `linear-gradient(135deg, ${color("primary")} 0%, ${color("secondary")} 100%)`
          : colorAlpha("bgCard", 0.6),
        border: `1px solid ${colorAlpha(checked ? "primary" : "border", checked ? 0.6 : 0.4)}`,
        boxShadow: checked ? glow("primary", "sm", 0.3) : "none",
      }}
      title={checked ? "点击禁用" : "点击启用"}
    >
      <motion.span
        initial={false}
        animate={{ x: checked ? 12 : 2 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        className="inline-block h-2.5 w-2.5 rounded-full"
        style={{
          background: checked
            ? color("textPrimary")
            : colorAlpha("textMuted", 0.75),
          boxShadow: checked
            ? `0 0 6px ${colorAlpha("primary", 0.55)}`
            : `0 0 4px ${colorAlpha("border", 0.3)}`,
        }}
      />
    </button>
  );
}

const PHASE_LABEL: Record<PostProcessRule["phase"], string> = {
  persist: "持久化前",
  render: "渲染前",
};

const ACTION_LABEL: Record<PostProcessRule["action"], string> = {
  remove: "移除",
  replace: "替换",
  "extract-and-remove": "提取并移除",
};

const SOURCE_TONE: Record<PostProcessRule["source"], "warning" | "secondary"> =
  {
    builtin: "warning",
    user: "secondary",
  };

/**
 * 单条规则行组件。
 */
export function RuleItem({
  rule,
  onToggleEnabled,
  onEdit,
  onDelete,
}: RuleItemProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: rule.id,
    data: {
      type: "post-process-rule",
      source: rule.source,
    },
  });

  const style = useMemo(
    () => ({
      transform: CSS.Transform.toString(transform),
      transition,
    }),
    [transform, transition],
  );

  const handleToggleEnabled = useCallback(
    (enabled: boolean) => {
      onToggleEnabled(rule.id, enabled);
    },
    [onToggleEnabled, rule.id],
  );

  const handleRowClick = useCallback(() => {
    onEdit(rule.id);
  }, [onEdit, rule.id]);

  const handleEditClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      onEdit(rule.id);
    },
    [onEdit, rule.id],
  );

  const handleDeleteClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      setShowDeleteConfirm(true);
    },
    [],
  );

  const handleConfirmDelete = useCallback(() => {
    onDelete(rule.id);
  }, [onDelete, rule.id]);

  const sourceTone = SOURCE_TONE[rule.source];

  return (
    <motion.div
      ref={setNodeRef}
      initial={false}
      animate={{ opacity: isDragging ? 0.5 : 1 }}
      transition={{ duration: animation.duration.fast }}
      className={cn(
        "group relative flex flex-col gap-1.5 rounded p-2 transition-colors select-none",
        "cursor-pointer",
        !rule.enabled && "opacity-60",
      )}
      style={{
        ...style,
        background: colorAlpha("bgBase", 0.42),
        border: `1px solid ${colorAlpha("primary", 0.2)}`,
      }}
      onClick={handleRowClick}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <button
            {...attributes}
            {...listeners}
            onClick={(event) => event.stopPropagation()}
            className={cn(
              "shrink-0 rounded p-0.5 transition-colors touch-none",
              "cursor-grab active:cursor-grabbing",
            )}
            style={{ color: color("textMuted") }}
            title="拖拽排序"
          >
            <GripVertical size={14} />
          </button>

          <span
            className="truncate text-sm font-medium"
            style={{ color: color("textPrimary") }}
            title={rule.name}
          >
            {rule.name}
          </span>
        </div>

        <div className="shrink-0 flex items-center gap-1.5">
          <span
            className="rounded px-1.5 py-0.5 text-xs font-medium"
            style={{
              background: colorAlpha("primary", 0.18),
              color: color("primary"),
            }}
          >
            {PHASE_LABEL[rule.phase]}
          </span>

          <span
            className="rounded px-1.5 py-0.5 text-xs font-medium"
            style={{
              background: colorAlpha(sourceTone, 0.18),
              color: color(sourceTone),
            }}
          >
            {rule.source === "builtin" ? "内置" : "用户"}
          </span>

          <MiniToggle checked={rule.enabled} onChange={handleToggleEnabled} />
        </div>
      </div>

      <div className="flex items-start gap-2 pl-6">
        <div className="min-w-0 flex-1">
          <code
            className="block truncate text-[11px]"
            style={{ color: color("textMuted") }}
            title={`/${rule.pattern}/${rule.flags}`}
          >
            /{rule.pattern}/{rule.flags}
          </code>
          <span className="text-xs" style={{ color: color("textSecondary") }}>
            {ACTION_LABEL[rule.action]}
          </span>
        </div>

        <div className="shrink-0 flex items-center gap-1">
          <button
            type="button"
            onClick={handleEditClick}
            className={cn(
              "rounded p-1 transition-all duration-200 hover:scale-110",
              "opacity-100 md:opacity-0 md:group-hover:opacity-100",
            )}
            style={{
              color: colorAlpha("primary", 0.7),
              background: "transparent",
            }}
            onMouseEnter={(event) => {
              event.currentTarget.style.color = color("primary");
              event.currentTarget.style.background = colorAlpha(
                "primary",
                0.15,
              );
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.color = colorAlpha("primary", 0.7);
              event.currentTarget.style.background = "transparent";
            }}
            title="编辑规则"
          >
            <Pencil size={14} />
          </button>

          {rule.source !== "builtin" && (
            <button
              type="button"
              onClick={handleDeleteClick}
              className={cn(
                "rounded p-1 transition-all duration-200 hover:scale-110",
                "opacity-100 md:opacity-0 md:group-hover:opacity-100",
              )}
              style={{
                color: colorAlpha("error", 0.72),
                background: "transparent",
              }}
              onMouseEnter={(event) => {
                event.currentTarget.style.color = color("error");
                event.currentTarget.style.background = colorAlpha(
                  "error",
                  0.15,
                );
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.color = colorAlpha("error", 0.72);
                event.currentTarget.style.background = "transparent";
              }}
              title="删除规则"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      {rule.source !== "builtin" && (
        <ConfirmDialog
          open={showDeleteConfirm}
          onOpenChange={setShowDeleteConfirm}
          title="确认删除规则"
          description={`确定要删除规则「${rule.name}」吗？此操作无法撤销。`}
          confirmText="删除"
          cancelText="取消"
          variant="destructive"
          onConfirm={handleConfirmDelete}
        />
      )}
    </motion.div>
  );
}
