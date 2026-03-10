/**
 * 可拖拽的提示词块组件
 *
 * 支持：
 * - 拖拽排序（同面板内）
 * - 跨面板拖拽（复制/移动）
 * - 启用/禁用切换（滑块开关）
 * - 双击编辑
 * - 删除操作
 */

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion } from "framer-motion";
import { GripVertical, Pencil, Trash2 } from "lucide-react";
import { useCallback, useState } from "react";

import { ConfirmDialog, MiniToggle } from "@/components/ui";
import type { PromptBlock } from "@/lib/prompt";
import { cn } from "@/lib/utils";
import { animation, color, colorAlpha } from "@/styles/tokens";

import { useWorkspace } from "./context";

// ===== 类型 =====

export interface BlockItemProps {
  /** 提示词块数据 */
  block: PromptBlock;
  /** 所属面板 ID */
  panelId: string;
  /** 是否正在被拖拽 */
  isDragging?: boolean;
  /** 是否为拖拽覆盖层（DragOverlay 中使用） */
  isOverlay?: boolean;
}

// ===== 组件 =====

/**
 * 可拖拽的提示词块
 */
export function BlockItem({
  block,
  panelId,
  isDragging = false,
  isOverlay = false,
}: BlockItemProps) {
  const workspace = useWorkspace();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // 使用 @dnd-kit/sortable 的 hook
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({
      id: block.id,
      data: {
        type: "block",
        panelId,
        blockId: block.id,
        block,
      },
      disabled: isOverlay,
    });

  // 计算样式
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // 处理启用/禁用
  const handleToggleEnabled = useCallback(
    (enabled: boolean) => {
      workspace.updatePanelBlock(panelId, block.id, { enabled });
    },
    [workspace, panelId, block.id],
  );

  // 打开删除确认对话框
  const handleDeleteClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDeleteConfirm(true);
  }, []);

  // 确认删除
  const handleConfirmDelete = useCallback(() => {
    workspace.deleteBlockFromPanel(panelId, block.id);
  }, [workspace, panelId, block.id]);

  // 处理双击编辑
  const handleDoubleClick = useCallback(() => {
    workspace.startEditingBlock(panelId, block.id);
  }, [workspace, panelId, block.id]);

  // 处理点击编辑按钮
  const handleEditClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      workspace.startEditingBlock(panelId, block.id);
    },
    [workspace, panelId, block.id],
  );

  // 角色标签颜色映射
  const roleColors: Record<string, string> = {
    system: "primary",
    user: "secondary",
    assistant: "warning",
  };
  const roleColor = roleColors[block.role] || "textMuted";

  // 是否正在拖拽（受控状态，避免 sortable 内部状态残留导致灰态不消失）
  const isCurrentlyDragging = isDragging;

  // 合并样式
  const combinedStyle = {
    ...style,
    background: isOverlay
      ? colorAlpha("bgElevated", 0.95)
      : colorAlpha("bgBase", 0.4),
    border: `1px solid ${colorAlpha("primary", isOverlay ? 0.5 : 0.2)}`,
    backdropFilter: isOverlay ? "blur(10px)" : undefined,
    WebkitBackdropFilter: isOverlay ? "blur(10px)" : undefined,
  };

  return (
    <motion.div
      ref={setNodeRef}
      initial={false}
      animate={{
        opacity: isCurrentlyDragging && !isOverlay ? 0.5 : 1,
        scale: isOverlay ? 1.02 : 1,
      }}
      transition={{ duration: animation.duration.fast }}
      className={cn(
        "group",
        "relative",
        "flex flex-col gap-1",
        "p-2",
        "rounded",
        "cursor-pointer",
        "transition-colors",
        "select-none",
        !block.enabled && "opacity-50",
        isOverlay && "shadow-lg",
      )}
      style={combinedStyle}
      onDoubleClick={handleDoubleClick}
    >
      {/* 头部：拖拽手柄、名称和标签 */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {/* 拖拽手柄 */}
          <button
            {...attributes}
            {...listeners}
            className={cn(
              "shrink-0",
              "p-0.5",
              "rounded",
              "cursor-grab active:cursor-grabbing",
              "hover:bg-white/10",
              "transition-colors",
              "touch-none",
            )}
            style={{ color: color("textMuted") }}
            title="拖拽排序"
          >
            <GripVertical size={14} />
          </button>

          {/* 块名称 */}
          <span
            className="text-sm font-medium truncate"
            style={{ color: color("textPrimary") }}
          >
            {block.name}
          </span>
        </div>

        {/* 右侧控制区：标签 + 开关 */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* 角色/Marker 标签 */}
          <span
            className="px-1.5 py-0.5 text-xs rounded font-medium"
            style={{
              background: colorAlpha(roleColor as "primary", 0.2),
              color: color(roleColor as "primary"),
            }}
          >
            {block.marker ? "Marker" : block.role.slice(0, 3)}
          </span>

          {/* 启用/禁用滑块开关 */}
          <MiniToggle
            checked={block.enabled}
            onCheckedChange={handleToggleEnabled}
          />
        </div>
      </div>

      {/* 内容预览 + 删除按钮 */}
      <div className="flex items-start gap-2">
        <div
          className="flex-1 text-xs line-clamp-2 sm:line-clamp-3 pl-6"
          style={{ color: color("textMuted") }}
        >
          {block.marker
            ? `类型: ${block.markerType || "未指定"}`
            : block.content || "（空内容）"}
        </div>

        {/* 操作按钮：编辑 + 删除（移动端常显，桌面悬停显示） */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={handleEditClick}
            className={cn(
              "shrink-0",
              "p-1 rounded",
              "opacity-100 md:opacity-0 md:group-hover:opacity-100",
              "transition-all duration-200",
              "hover:scale-110",
            )}
            style={{
              color: colorAlpha("primary", 0.7),
              background: "transparent",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = color("primary");
              e.currentTarget.style.background = colorAlpha("primary", 0.15);
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = colorAlpha("primary", 0.7);
              e.currentTarget.style.background = "transparent";
            }}
            title="编辑块"
          >
            <Pencil size={14} />
          </button>

          <button
            onClick={handleDeleteClick}
            className={cn(
              "shrink-0",
              "p-1 rounded",
              "opacity-100 md:opacity-0 md:group-hover:opacity-100",
              "transition-all duration-200",
              "hover:scale-110",
            )}
            style={{
              color: colorAlpha("error", 0.7),
              background: "transparent",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = color("error");
              e.currentTarget.style.background = colorAlpha("error", 0.15);
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = colorAlpha("error", 0.7);
              e.currentTarget.style.background = "transparent";
            }}
            title="删除块"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* 删除确认对话框 */}
      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="确认删除"
        description={`确定要删除块「${block.name}」吗？此操作无法撤销。`}
        confirmText="删除"
        cancelText="取消"
        variant="destructive"
        onConfirm={handleConfirmDelete}
      />
    </motion.div>
  );
}

/**
 * 拖拽覆盖层中使用的 BlockItem
 * 用于在拖拽时显示跟随鼠标的块预览
 */
export function BlockItemOverlay({
  block,
  panelId,
}: Omit<BlockItemProps, "isDragging" | "isOverlay">) {
  return <BlockItem block={block} panelId={panelId} isOverlay />;
}
