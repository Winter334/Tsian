/**
 * 世界书列表面板
 *
 * 桌面端：左侧侧边栏，展示世界书列表
 * 移动端：全屏页面
 *
 * 阶段1：展示列表骨架 + 选择交互
 * 阶段2：新建、重命名、删除、激活开关
 */

import { AnimatePresence, motion } from "framer-motion";
import {
  BookOpen,
  Check,
  ChevronRight,
  MoreHorizontal,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useRef, useState } from "react";

import { ConfirmDialog, ScrollArea, Toggle, useToast } from "@/components/ui";
import type { LorebookIndex } from "@/lib/lorebook";
import { useLorebookStore } from "@/lib/lorebook";
import { cn } from "@/lib/utils";
import {
  animation,
  color,
  colorAlpha,
  listItemVariants,
} from "@/styles/tokens";

interface LorebookListPaneProps {
  /** 当前选中的世界书 ID */
  selectedId: string | null;
  /** 选中世界书 */
  onSelect: (id: string) => void;
}

export function LorebookListPane({
  selectedId,
  onSelect,
}: LorebookListPaneProps) {
  const lorebooks = useLorebookStore((s) => s.lorebooks);
  const activeLorebookIds = useLorebookStore((s) => s.activeLorebookIds);
  const setLorebookActive = useLorebookStore((s) => s.setLorebookActive);
  const updateLorebook = useLorebookStore((s) => s.updateLorebook);
  const deleteLorebook = useLorebookStore((s) => s.deleteLorebook);
  const { success, error } = useToast();

  // 删除确认弹窗状态
  const [deleteTarget, setDeleteTarget] = useState<LorebookIndex | null>(null);

  // 重命名状态
  const [renamingId, setRenamingId] = useState<string | null>(null);

  const handleToggleActive = useCallback(
    (id: string, active: boolean) => {
      setLorebookActive(id, active);
    },
    [setLorebookActive]
  );

  const handleRename = useCallback(
    async (id: string, newName: string) => {
      const trimmed = newName.trim();
      if (!trimmed) {
        error("重命名失败", "名称不能为空");
        return;
      }
      try {
        await updateLorebook(id, { name: trimmed });
        success("已重命名", `世界书已更名为「${trimmed}」`);
      } catch {
        error("重命名失败", "请稍后重试");
      }
      setRenamingId(null);
    },
    [updateLorebook, success, error]
  );

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await deleteLorebook(deleteTarget.id);
      success("已删除", `世界书「${deleteTarget.name}」已删除`);
    } catch {
      error("删除失败", "请稍后重试");
    }
    setDeleteTarget(null);
  }, [deleteTarget, deleteLorebook, success, error]);

  if (lorebooks.length === 0) {
    return <EmptyLorebookList />;
  }

  return (
    <>
      <ScrollArea className="h-full">
        <div className="p-3 space-y-1">
          <AnimatePresence mode="popLayout">
            {lorebooks.map((lb, index) => (
              <LorebookListItem
                key={lb.id}
                lorebook={lb}
                index={index}
                isSelected={lb.id === selectedId}
                isActive={activeLorebookIds.includes(lb.id)}
                isRenaming={renamingId === lb.id}
                canDelete={lorebooks.length > 1}
                onSelect={() => onSelect(lb.id)}
                onToggleActive={(active) => handleToggleActive(lb.id, active)}
                onStartRename={() => setRenamingId(lb.id)}
                onConfirmRename={(name) => handleRename(lb.id, name)}
                onCancelRename={() => setRenamingId(null)}
                onDelete={() => setDeleteTarget(lb)}
              />
            ))}
          </AnimatePresence>
        </div>
      </ScrollArea>

      {/* 删除确认弹窗 */}
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="删除世界书"
        description={`确定要删除「${
          deleteTarget?.name ?? ""
        }」吗？此操作不可撤销。`}
        confirmText="删除"
        cancelText="取消"
        variant="destructive"
        onConfirm={handleDeleteConfirm}
      />
    </>
  );
}

// ===== 子组件 =====

interface LorebookListItemProps {
  lorebook: LorebookIndex;
  index: number;
  isSelected: boolean;
  isActive: boolean;
  isRenaming: boolean;
  canDelete: boolean;
  onSelect: () => void;
  onToggleActive: (active: boolean) => void;
  onStartRename: () => void;
  onConfirmRename: (name: string) => void;
  onCancelRename: () => void;
  onDelete: () => void;
}

function LorebookListItem({
  lorebook,
  index,
  isSelected,
  isActive,
  isRenaming,
  canDelete,
  onSelect,
  onToggleActive,
  onStartRename,
  onConfirmRename,
  onCancelRename,
  onDelete,
}: LorebookListItemProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [renameValue, setRenameValue] = useState(lorebook.name);
  const inputRef = useRef<HTMLInputElement>(null);

  // 开始重命名时聚焦输入框
  const handleStartRename = useCallback(() => {
    setRenameValue(lorebook.name);
    onStartRename();
    setMenuOpen(false);
    // 延迟聚焦，等 DOM 更新
    setTimeout(() => inputRef.current?.select(), 50);
  }, [lorebook.name, onStartRename]);

  const handleConfirmRename = useCallback(() => {
    onConfirmRename(renameValue);
  }, [onConfirmRename, renameValue]);

  const handleRenameKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleConfirmRename();
      } else if (e.key === "Escape") {
        e.preventDefault();
        onCancelRename();
      }
    },
    [handleConfirmRename, onCancelRename]
  );

  // 重命名模式
  if (isRenaming) {
    return (
      <motion.div
        variants={listItemVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        custom={index}
        className={cn(
          "w-full",
          "flex items-center gap-2",
          "px-3 py-2",
          "rounded-md"
        )}
        style={{
          background: colorAlpha("primary", 0.12),
          borderLeft: `3px solid ${color("primary")}`,
        }}
      >
        <input
          ref={inputRef}
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onKeyDown={handleRenameKeyDown}
          onBlur={handleConfirmRename}
          className={cn(
            "flex-1 min-w-0",
            "px-2 py-1",
            "text-sm",
            "rounded",
            "border",
            "outline-none",
            "bg-transparent"
          )}
          style={{
            color: color("textPrimary"),
            borderColor: colorAlpha("primary", 0.5),
          }}
          autoFocus
        />
        <button
          onClick={handleConfirmRename}
          className="p-1 rounded shrink-0"
          style={{ color: color("primary") }}
          aria-label="确认重命名"
          onMouseDown={(e) => e.preventDefault()}
        >
          <Check size={14} />
        </button>
        <button
          onClick={onCancelRename}
          className="p-1 rounded shrink-0"
          style={{ color: color("textMuted") }}
          aria-label="取消重命名"
          onMouseDown={(e) => e.preventDefault()}
        >
          <X size={14} />
        </button>
      </motion.div>
    );
  }

  return (
    <motion.div
      variants={listItemVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      custom={index}
      className={cn("w-full", "flex items-center gap-1", "rounded-md", "group")}
    >
      {/* 主按钮区域 - 点击选中 */}
      <button
        onClick={onSelect}
        className={cn(
          "flex-1 min-w-0 text-left",
          "flex items-center gap-2",
          "px-2 py-2",
          "rounded-md",
          "transition-all"
        )}
        style={{
          background: isSelected ? colorAlpha("primary", 0.12) : "transparent",
          borderLeft: isSelected
            ? `3px solid ${color("primary")}`
            : "3px solid transparent",
          color: isSelected ? color("textPrimary") : color("textSecondary"),
          transitionDuration: `${animation.duration.fast * 1000}ms`,
        }}
        onMouseEnter={(e) => {
          if (!isSelected) {
            e.currentTarget.style.background = colorAlpha("primary", 0.06);
          }
        }}
        onMouseLeave={(e) => {
          if (!isSelected) {
            e.currentTarget.style.background = "transparent";
          }
        }}
      >
        {/* 图标 */}
        <BookOpen
          size={16}
          style={{ color: isActive ? color("primary") : color("textMuted") }}
          className="shrink-0"
        />

        {/* 信息 - 优化布局，让名称有更多空间 */}
        <div className="flex-1 min-w-0 overflow-hidden">
          <span
            className="block truncate text-sm font-medium"
            title={lorebook.name}
          >
            {lorebook.name}
          </span>
          <span className="text-xs block" style={{ color: color("textMuted") }}>
            {lorebook.entryCount} 条目
          </span>
        </div>

        {/* 箭头指示 */}
        <ChevronRight
          size={14}
          className="shrink-0"
          style={{
            color: isSelected ? color("primary") : color("textMuted"),
            opacity: isSelected ? 1 : 0.5,
          }}
        />
      </button>

      {/* 操作区域 - 激活开关 + 更多菜单 */}
      <div className="flex items-center shrink-0">
        {/* 激活开关 */}
        <Toggle
          checked={isActive}
          onCheckedChange={onToggleActive}
          className="scale-[0.65]"
        />

        {/* 更多操作按钮 */}
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen(!menuOpen);
            }}
            className={cn(
              "p-1 rounded transition-all",
              "opacity-0 group-hover:opacity-100",
              menuOpen && "opacity-100"
            )}
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
            aria-label="更多操作"
          >
            <MoreHorizontal size={14} />
          </button>

          {/* 下拉菜单 */}
          {menuOpen && (
            <ContextMenu
              onClose={() => setMenuOpen(false)}
              onRename={handleStartRename}
              onDelete={canDelete ? onDelete : undefined}
            />
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ===== 上下文菜单 =====

interface ContextMenuProps {
  onClose: () => void;
  onRename: () => void;
  onDelete?: () => void;
}

function ContextMenu({ onClose, onRename, onDelete }: ContextMenuProps) {
  return (
    <>
      {/* 点击外部关闭的透明遮罩 */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      <div
        className={cn(
          "absolute right-0 top-full mt-1 z-50",
          "min-w-35",
          "rounded-md",
          "border",
          "py-1",
          "shadow-lg"
        )}
        style={{
          background: color("bgElevated"),
          borderColor: colorAlpha("primary", 0.2),
        }}
      >
        <button
          onClick={() => {
            onRename();
            onClose();
          }}
          className={cn(
            "w-full text-left",
            "flex items-center gap-2",
            "px-3 py-2",
            "text-sm",
            "transition-all"
          )}
          style={{
            color: color("textSecondary"),
            transitionDuration: `${animation.duration.fast * 1000}ms`,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = colorAlpha("primary", 0.1);
            e.currentTarget.style.color = color("textPrimary");
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = color("textSecondary");
          }}
        >
          <Pencil size={14} />
          重命名
        </button>

        {onDelete && (
          <button
            onClick={() => {
              onDelete();
              onClose();
            }}
            className={cn(
              "w-full text-left",
              "flex items-center gap-2",
              "px-3 py-2",
              "text-sm",
              "transition-all"
            )}
            style={{
              color: color("error"),
              transitionDuration: `${animation.duration.fast * 1000}ms`,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = colorAlpha("error", 0.1);
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            <Trash2 size={14} />
            删除
          </button>
        )}
      </div>
    </>
  );
}

/**
 * 世界书列表空态
 */
function EmptyLorebookList() {
  return (
    <div className="flex-1 flex items-center justify-center p-6 text-center">
      <div>
        <BookOpen
          size={40}
          className="mx-auto mb-3"
          style={{ color: color("textMuted"), opacity: 0.5 }}
        />
        <p className="text-sm" style={{ color: color("textMuted") }}>
          暂无世界书
        </p>
        <p
          className="text-xs mt-1"
          style={{ color: colorAlpha("textMuted", 0.7) }}
        >
          点击上方按钮创建第一本世界书
        </p>
      </div>
    </div>
  );
}
