/**
 * 世界书条目列表面板
 *
 * 桌面端：右侧主区域，展示选中世界书的条目列表
 * 移动端：全屏页面（通过导航到达）
 *
 * 功能：
 * - 展示条目列表 + 空态/错误态
 * - 新建、启用禁用、删除条目
 * - 点击进入编辑全屏
 * - 拖拽排序（桌面端拖拽手柄 + 移动端上移/下移按钮）
 * - 滚动位置保留
 * - 排序选项（按 order、按名称）
 * - 拖拽时显示插入位置指示器
 */

import type {
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
} from "@dnd-kit/core";
import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowDownAZ,
  ArrowLeft,
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  FileText,
  GripVertical,
  Hash,
  Plus,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ConfirmDialog, ScrollArea, Toggle, useToast } from "@/components/ui";
import type { Lorebook, LorebookEntry } from "@/lib/lorebook";
import { useLorebookStore } from "@/lib/lorebook";
import { cn } from "@/lib/utils";
import { animation, color, colorAlpha, glow } from "@/styles/tokens";

// ===== 排序类型 =====

type SortMode = "order" | "name";

// ===== 类型 =====

interface LorebookEntryListPaneProps {
  /** 选中的世界书 ID */
  lorebookId: string;
  /** 返回世界书列表（移动端使用） */
  onBack?: () => void;
  /** 是否显示返回按钮（移动端） */
  showBackButton?: boolean;
  /** 点击条目进入编辑 */
  onEditEntry?: (entryId: string) => void;
  /** 是否为移动端视图 */
  isMobile?: boolean;
}

// ===== 主组件 =====

export function LorebookEntryListPane({
  lorebookId,
  onBack,
  showBackButton = false,
  onEditEntry,
  isMobile = false,
}: LorebookEntryListPaneProps) {
  const getLorebook = useLorebookStore((s) => s.getLorebook);
  const addEntry = useLorebookStore((s) => s.addEntry);
  const updateEntry = useLorebookStore((s) => s.updateEntry);
  const deleteEntry = useLorebookStore((s) => s.deleteEntry);
  const reorderEntries = useLorebookStore((s) => s.reorderEntries);
  const [lorebook, setLorebook] = useState<Lorebook | null>(null);
  const [loading, setLoading] = useState(true);
  const { success, error } = useToast();

  // 删除确认弹窗状态
  const [deleteTarget, setDeleteTarget] = useState<LorebookEntry | null>(null);

  // 拖拽状态
  const [activeEntry, setActiveEntry] = useState<LorebookEntry | null>(null);
  const [overEntryIndex, setOverEntryIndex] = useState<number | null>(null);

  // 统一清理拖拽状态（避免动画状态残留）
  const clearDragState = useCallback(() => {
    setActiveEntry(null);
    setOverEntryIndex(null);
  }, []);

  // 排序模式
  const [sortMode, setSortMode] = useState<SortMode>("order");

  // 滚动位置保留
  const scrollRef = useRef<HTMLDivElement>(null);
  const savedScrollTopRef = useRef<number>(0);

  // dnd-kit 传感器
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // 加载世界书详情
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    getLorebook(lorebookId).then((data) => {
      if (!cancelled) {
        setLorebook(data);
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [lorebookId, getLorebook]);

  // 监听 store 中缓存的世界书数据变化，保持同步
  const cachedLorebook = useLorebookStore(
    (s) => s.loadedLorebooks.get(lorebookId) ?? null
  );

  useEffect(() => {
    if (cachedLorebook) {
      setLorebook(cachedLorebook);
    }
  }, [cachedLorebook]);

  // 排序后的条目列表
  const sortedEntries = useMemo(() => {
    if (!lorebook) return [];
    const entries = [...lorebook.entries];
    if (sortMode === "order") {
      return entries.sort((a, b) => a.order - b.order);
    } else {
      return entries.sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
    }
  }, [lorebook, sortMode]);

  // 恢复滚动位置（从编辑器返回时）
  useEffect(() => {
    if (!loading && scrollRef.current && savedScrollTopRef.current > 0) {
      scrollRef.current.scrollTop = savedScrollTopRef.current;
    }
  }, [loading]);

  // 保存滚动位置（进入编辑器前）
  const saveScrollPosition = useCallback(() => {
    if (scrollRef.current) {
      savedScrollTopRef.current = scrollRef.current.scrollTop;
    }
  }, []);

  // 新建条目
  const handleAddEntry = useCallback(async () => {
    try {
      await addEntry(lorebookId, {
        name: "新条目",
        content: "",
        enabled: true,
        activationStrategy: "selective",
        primaryKeywords: [],
        scanDepth: null,
        order: lorebook ? lorebook.entries.length * 10 : 0,
      });
      success("已创建", "新条目已添加");
    } catch {
      error("创建条目失败", "请稍后重试");
    }
  }, [lorebookId, lorebook, addEntry, success, error]);

  // 切换条目启用状态
  const handleToggleEntry = useCallback(
    async (entryId: string, enabled: boolean) => {
      try {
        await updateEntry(lorebookId, entryId, { enabled });
      } catch {
        error("操作失败", "请稍后重试");
      }
    },
    [lorebookId, updateEntry, error]
  );

  // 确认删除条目
  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await deleteEntry(lorebookId, deleteTarget.id);
      success("已删除", `条目「${deleteTarget.name}」已删除`);
    } catch {
      error("删除条目失败", "请稍后重试");
    }
    setDeleteTarget(null);
  }, [deleteTarget, lorebookId, deleteEntry, success, error]);

  // 点击条目进入编辑
  const handleEditEntry = useCallback(
    (entryId: string) => {
      saveScrollPosition();
      onEditEntry?.(entryId);
    },
    [onEditEntry, saveScrollPosition]
  );

  // 拖拽开始
  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const { active } = event;
      const entry = sortedEntries.find((e) => e.id === active.id);
      if (entry) {
        setActiveEntry(entry);
      }
    },
    [sortedEntries]
  );

  // 拖拽经过 - 更新插入位置指示器（与预设块一致：同列表向下拖拽时显示在目标项后方）
  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event;

      if (!over) {
        setOverEntryIndex((prev) => (prev === null ? prev : null));
        return;
      }

      const activeIndex = sortedEntries.findIndex((e) => e.id === active.id);
      const targetIndex = sortedEntries.findIndex((e) => e.id === over.id);

      if (activeIndex < 0 || targetIndex < 0) {
        setOverEntryIndex((prev) => (prev === null ? prev : null));
        return;
      }

      let indicatorIndex = targetIndex;
      if (activeIndex < targetIndex) {
        indicatorIndex = targetIndex + 1;
      }

      const nextIndex = Math.max(
        0,
        Math.min(indicatorIndex, sortedEntries.length)
      );

      // 避免相同索引重复 setState 引发频繁重排
      setOverEntryIndex((prev) => (prev === nextIndex ? prev : nextIndex));
    },
    [sortedEntries]
  );

  // 拖拽取消
  const handleDragCancel = useCallback(() => {
    clearDragState();
  }, [clearDragState]);

  // 拖拽状态兜底清理（避免异常中断导致灰态残留）
  useEffect(() => {
    if (!activeEntry) return;

    const handlePointerRelease = () => {
      clearDragState();
    };

    const handleWindowBlur = () => {
      clearDragState();
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        clearDragState();
      }
    };

    window.addEventListener("pointerup", handlePointerRelease);
    window.addEventListener("mouseup", handlePointerRelease);
    window.addEventListener("touchend", handlePointerRelease);
    window.addEventListener("blur", handleWindowBlur);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("pointerup", handlePointerRelease);
      window.removeEventListener("mouseup", handlePointerRelease);
      window.removeEventListener("touchend", handlePointerRelease);
      window.removeEventListener("blur", handleWindowBlur);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [activeEntry, clearDragState]);

  // 拖拽结束 → 提交排序
  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      clearDragState();

      const { active, over } = event;
      if (!over || !lorebook || active.id === over.id) return;

      // 使用排序后的列表来计算索引
      const oldIndex = sortedEntries.findIndex((e) => e.id === active.id);
      const newIndex = sortedEntries.findIndex((e) => e.id === over.id);

      if (oldIndex < 0 || newIndex < 0) return;

      // 构建新的 ID 顺序
      const newEntryIds = sortedEntries.map((e) => e.id);
      const [movedId] = newEntryIds.splice(oldIndex, 1);
      newEntryIds.splice(newIndex, 0, movedId);

      try {
        await reorderEntries(lorebookId, newEntryIds);
      } catch {
        error("排序失败", "已恢复原顺序，请稍后重试");
      }
    },
    [lorebook, sortedEntries, lorebookId, reorderEntries, error, clearDragState]
  );

  // 上移/下移（移动端兜底）
  const handleMoveEntry = useCallback(
    async (entryId: string, direction: "up" | "down") => {
      if (!lorebook) return;

      const currentIndex = sortedEntries.findIndex((e) => e.id === entryId);
      if (currentIndex < 0) return;

      const targetIndex =
        direction === "up" ? currentIndex - 1 : currentIndex + 1;
      if (targetIndex < 0 || targetIndex >= sortedEntries.length) return;

      const newEntryIds = sortedEntries.map((e) => e.id);
      const [movedId] = newEntryIds.splice(currentIndex, 1);
      newEntryIds.splice(targetIndex, 0, movedId);

      try {
        await reorderEntries(lorebookId, newEntryIds);
      } catch {
        error("排序失败", "请稍后重试");
      }
    },
    [lorebook, sortedEntries, lorebookId, reorderEntries, error]
  );

  // 切换排序模式
  const toggleSortMode = useCallback(() => {
    setSortMode((prev) => (prev === "order" ? "name" : "order"));
  }, []);

  const entryIds = sortedEntries.map((e) => e.id);

  // 插入位置显示（复刻预设块的指示逻辑）
  const showDropIndicator = activeEntry !== null && overEntryIndex !== null;
  const normalizedDropIndicatorIndex =
    showDropIndicator && overEntryIndex !== null
      ? Math.max(0, Math.min(overEntryIndex, sortedEntries.length))
      : null;

  return (
    <div className="flex flex-col h-full">
      {/* 条目列表头部 */}
      <div
        className={cn(
          "flex items-center gap-3",
          "px-4 py-3",
          "border-b shrink-0"
        )}
        style={{
          borderColor: colorAlpha("primary", 0.15),
          background: colorAlpha("bgElevated", 0.3),
        }}
      >
        {/* 返回按钮（移动端） */}
        {showBackButton && onBack && (
          <button
            onClick={onBack}
            className="p-1.5 rounded-md transition-all"
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
            aria-label="返回世界书列表"
          >
            <ArrowLeft size={18} />
          </button>
        )}

        {/* 世界书名称 */}
        <div className="flex-1 min-w-0">
          <h2
            className="text-sm font-semibold truncate"
            style={{ color: color("textPrimary") }}
          >
            {lorebook?.name ?? "加载中..."}
          </h2>
          {lorebook && (
            <span className="text-xs" style={{ color: color("textMuted") }}>
              {lorebook.entries.length} 条目
            </span>
          )}
        </div>

        {/* 排序按钮 */}
        {lorebook && lorebook.entries.length > 1 && (
          <button
            onClick={toggleSortMode}
            className={cn(
              "p-1.5 rounded-md",
              "transition-all",
              "flex items-center gap-1"
            )}
            style={{
              color: color("textMuted"),
              transitionDuration: `${animation.duration.fast * 1000}ms`,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = color("primary");
              e.currentTarget.style.background = colorAlpha("primary", 0.1);
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = color("textMuted");
              e.currentTarget.style.background = "transparent";
            }}
            aria-label={`排序方式: ${
              sortMode === "order" ? "按顺序" : "按名称"
            }`}
            title={`排序方式: ${
              sortMode === "order" ? "按顺序" : "按名称"
            }（点击切换）`}
          >
            {sortMode === "order" ? (
              <ArrowUpDown size={16} />
            ) : (
              <ArrowDownAZ size={16} />
            )}
          </button>
        )}

        {/* 新建条目按钮 */}
        {lorebook && (
          <button
            onClick={handleAddEntry}
            className={cn("p-1.5 rounded-md", "transition-all")}
            style={{
              color: color("textMuted"),
              transitionDuration: `${animation.duration.fast * 1000}ms`,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = color("primary");
              e.currentTarget.style.background = colorAlpha("primary", 0.1);
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = color("textMuted");
              e.currentTarget.style.background = "transparent";
            }}
            aria-label="新建条目"
            title="新建条目"
          >
            <Plus size={18} />
          </button>
        )}
      </div>

      {/* 条目列表内容 */}
      <div className="flex-1 overflow-hidden">
        {loading ? (
          <LoadingState />
        ) : !lorebook ? (
          <ErrorState onRetry={() => getLorebook(lorebookId)} />
        ) : lorebook.entries.length === 0 ? (
          <EmptyEntryList onAdd={handleAddEntry} />
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragCancel={handleDragCancel}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={entryIds}
              strategy={verticalListSortingStrategy}
            >
              <ScrollArea className="h-full" ref={scrollRef}>
                <div className="p-3 flex flex-col gap-1">
                  <AnimatePresence initial={false} mode="popLayout">
                    {sortedEntries.map((entry, index) => {
                      const showInsertBefore =
                        normalizedDropIndicatorIndex === index;
                      const isActiveDraggingEntry =
                        activeEntry?.id === entry.id;

                      return (
                        <motion.div
                          key={entry.id}
                          layout
                          className="relative"
                          style={{
                            boxShadow: showDropIndicator
                              ? glow("primary", "sm", 0.2)
                              : "none",
                          }}
                        >
                          {showInsertBefore && (
                            <div
                              className="absolute -top-1 left-2 right-2 h-0.5 rounded-full pointer-events-none z-10"
                              style={{
                                background: `linear-gradient(90deg, transparent 0%, ${colorAlpha(
                                  "primary",
                                  0.65
                                )} 15%, ${color("primary")} 50%, ${colorAlpha(
                                  "primary",
                                  0.65
                                )} 85%, transparent 100%)`,
                                boxShadow: glow("primary", "sm", 0.45),
                              }}
                            />
                          )}

                          <SortableEntryItem
                            entry={entry}
                            index={index}
                            totalCount={sortedEntries.length}
                            isMobile={isMobile}
                            isDragging={isActiveDraggingEntry}
                            onToggleEnabled={(enabled) =>
                              handleToggleEntry(entry.id, enabled)
                            }
                            onDelete={() => setDeleteTarget(entry)}
                            onClick={() => handleEditEntry(entry.id)}
                            onMoveUp={() => handleMoveEntry(entry.id, "up")}
                            onMoveDown={() => handleMoveEntry(entry.id, "down")}
                          />
                        </motion.div>
                      );
                    })}

                    {normalizedDropIndicatorIndex === sortedEntries.length && (
                      <motion.div
                        key={`drop-indicator-end-${lorebookId}`}
                        layout
                        className="h-0.5 mx-2 rounded-full pointer-events-none"
                        style={{
                          background: `linear-gradient(90deg, transparent 0%, ${colorAlpha(
                            "primary",
                            0.65
                          )} 15%, ${color("primary")} 50%, ${colorAlpha(
                            "primary",
                            0.65
                          )} 85%, transparent 100%)`,
                          boxShadow: glow("primary", "sm", 0.45),
                        }}
                      />
                    )}
                  </AnimatePresence>
                </div>
              </ScrollArea>
            </SortableContext>

            {/* 拖拽覆盖层 */}
            <DragOverlay>
              {activeEntry ? <EntryDragOverlay entry={activeEntry} /> : null}
            </DragOverlay>
          </DndContext>
        )}
      </div>

      {/* 删除确认弹窗 */}
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="删除条目"
        description={`确定要删除条目「${
          deleteTarget?.name ?? ""
        }」吗？此操作不可撤销。`}
        confirmText="删除"
        cancelText="取消"
        variant="destructive"
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}

// ===== 可排序条目项 =====

interface SortableEntryItemProps {
  entry: LorebookEntry;
  index: number;
  totalCount: number;
  isMobile: boolean;
  isDragging?: boolean;
  onToggleEnabled: (enabled: boolean) => void;
  onDelete: () => void;
  onClick?: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

/**
 * 可排序的条目列表项
 * 使用 @dnd-kit/sortable 实现拖拽排序
 */
function SortableEntryItem({
  entry,
  index,
  totalCount,
  isMobile,
  isDragging: isDraggingProp = false,
  onToggleEnabled,
  onDelete,
  onClick,
  onMoveUp,
  onMoveDown,
}: SortableEntryItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({
      id: entry.id,
    });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const contentPreview = entry.content
    ? entry.content.slice(0, 80).replace(/\n/g, " ")
    : "";

  const isFirst = index === 0;
  const isLast = index === totalCount - 1;

  // 使用受控拖拽状态，避免 sortable 内部状态残留导致灰态不消失
  const isCurrentlyDragging = isDraggingProp;

  // 处理条目点击 - 排除开关区域
  const handleItemClick = useCallback(
    (e: React.MouseEvent) => {
      // 检查点击目标是否在开关区域内
      const target = e.target as HTMLElement;
      if (target.closest('[data-toggle-area="true"]')) {
        return; // 不触发编辑
      }
      onClick?.();
    },
    [onClick]
  );

  return (
    <motion.div
      ref={setNodeRef}
      className={cn("relative group", !entry.enabled && "opacity-50")}
      initial={false}
      animate={{
        opacity: isCurrentlyDragging ? 0.5 : 1,
      }}
      transition={{ duration: animation.duration.fast }}
      style={style}
    >
      <div
        className={cn(
          "flex items-start gap-2",
          "px-3 py-2.5",
          "rounded-md",
          "transition-colors",
          onClick && "cursor-pointer"
        )}
        onClick={handleItemClick}
        onMouseEnter={(e) => {
          if (!isCurrentlyDragging) {
            e.currentTarget.style.background = colorAlpha("primary", 0.06);
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
        }}
      >
        {/* 拖拽手柄（桌面端） / 上下移动按钮（移动端） */}
        <div className="shrink-0 flex flex-col items-center mt-0.5">
          {isMobile ? (
            /* 移动端：上移/下移按钮 */
            <div className="flex flex-col gap-0.5">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onMoveUp();
                }}
                disabled={isFirst}
                className={cn(
                  "p-0.5 rounded transition-colors",
                  isFirst && "opacity-30 cursor-not-allowed"
                )}
                style={{ color: color("textMuted") }}
                onMouseEnter={(e) => {
                  if (!isFirst) {
                    e.currentTarget.style.color = color("primary");
                    e.currentTarget.style.background = colorAlpha(
                      "primary",
                      0.1
                    );
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = color("textMuted");
                  e.currentTarget.style.background = "transparent";
                }}
                aria-label={`上移条目 ${entry.name}`}
                title="上移"
              >
                <ChevronUp size={14} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onMoveDown();
                }}
                disabled={isLast}
                className={cn(
                  "p-0.5 rounded transition-colors",
                  isLast && "opacity-30 cursor-not-allowed"
                )}
                style={{ color: color("textMuted") }}
                onMouseEnter={(e) => {
                  if (!isLast) {
                    e.currentTarget.style.color = color("primary");
                    e.currentTarget.style.background = colorAlpha(
                      "primary",
                      0.1
                    );
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = color("textMuted");
                  e.currentTarget.style.background = "transparent";
                }}
                aria-label={`下移条目 ${entry.name}`}
                title="下移"
              >
                <ChevronDown size={14} />
              </button>
            </div>
          ) : (
            /* 桌面端：拖拽手柄 */
            <button
              {...attributes}
              {...listeners}
              className={cn(
                "p-0.5 rounded",
                "cursor-grab active:cursor-grabbing",
                "transition-colors",
                "touch-none"
              )}
              style={{ color: color("textMuted") }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = color("primary");
                e.currentTarget.style.background = colorAlpha("primary", 0.1);
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = color("textMuted");
                e.currentTarget.style.background = "transparent";
              }}
              title="拖拽排序"
              onClick={(e) => e.stopPropagation()}
            >
              <GripVertical size={16} />
            </button>
          )}
        </div>

        {/* 启用开关 - 添加 data 属性标记 */}
        <div className="mt-0.5 shrink-0" data-toggle-area="true">
          <Toggle
            checked={entry.enabled}
            onCheckedChange={onToggleEnabled}
            className="scale-75"
          />
        </div>

        {/* 条目信息 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="text-sm font-medium truncate"
              style={{ color: color("textPrimary") }}
            >
              {entry.name}
            </span>
            {/* Order 显示 */}
            <span
              className="shrink-0 text-xs px-1 py-0.5 rounded flex items-center gap-0.5"
              style={{
                background: colorAlpha("textMuted", 0.1),
                color: color("textMuted"),
              }}
              title={`排序优先级: ${entry.order}`}
            >
              <Hash size={10} />
              {entry.order}
            </span>
            <span
              className="shrink-0 text-xs px-1.5 py-0.5 rounded"
              style={{
                background: colorAlpha(
                  entry.activationStrategy === "constant"
                    ? "secondary"
                    : "primary",
                  0.12
                ),
                color: color(
                  entry.activationStrategy === "constant"
                    ? "secondary"
                    : "primary"
                ),
              }}
            >
              {entry.activationStrategy === "constant" ? "常量" : "关键字"}
            </span>
          </div>

          {contentPreview && (
            <p
              className="text-xs mt-1 line-clamp-2"
              style={{ color: color("textMuted") }}
            >
              {contentPreview}
              {entry.content.length > 80 && "…"}
            </p>
          )}
        </div>

        {/* 删除按钮 */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className={cn(
            "p-1 rounded shrink-0 mt-0.5",
            "opacity-0 group-hover:opacity-100",
            "transition-all",
            isMobile && "opacity-100"
          )}
          style={{
            color: color("textMuted"),
            transitionDuration: `${animation.duration.fast * 1000}ms`,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = color("error");
            e.currentTarget.style.background = colorAlpha("error", 0.1);
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = color("textMuted");
            e.currentTarget.style.background = "transparent";
          }}
          aria-label={`删除条目 ${entry.name}`}
          title="删除条目"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </motion.div>
  );
}

// ===== 拖拽覆盖层 =====

/**
 * 拖拽时的浮动预览
 */
function EntryDragOverlay({ entry }: { entry: LorebookEntry }) {
  const contentPreview = entry.content
    ? entry.content.slice(0, 60).replace(/\n/g, " ")
    : "";

  return (
    <motion.div
      initial={false}
      animate={{
        scale: 1.02,
        opacity: entry.enabled ? 1 : 0.5,
      }}
      transition={{ duration: animation.duration.fast }}
      className={cn(
        "flex items-start gap-2",
        "px-3 py-2.5",
        "rounded-md",
        "shadow-lg"
      )}
      style={{
        background: colorAlpha("bgElevated", 0.95),
        border: `1px solid ${colorAlpha("primary", 0.5)}`,
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
      }}
    >
      {/* 拖拽手柄图标 */}
      <div className="shrink-0 mt-0.5">
        <GripVertical size={16} style={{ color: color("primary") }} />
      </div>

      {/* 条目信息 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className="text-sm font-medium truncate"
            style={{ color: color("textPrimary") }}
          >
            {entry.name}
          </span>
          <span
            className="shrink-0 text-xs px-1.5 py-0.5 rounded"
            style={{
              background: colorAlpha(
                entry.activationStrategy === "constant"
                  ? "secondary"
                  : "primary",
                0.12
              ),
              color: color(
                entry.activationStrategy === "constant"
                  ? "secondary"
                  : "primary"
              ),
            }}
          >
            {entry.activationStrategy === "constant" ? "常量" : "关键字"}
          </span>
        </div>

        {contentPreview && (
          <p
            className="text-xs mt-1 line-clamp-1"
            style={{ color: color("textMuted") }}
          >
            {contentPreview}
            {entry.content.length > 60 && "…"}
          </p>
        )}
      </div>
    </motion.div>
  );
}

// ===== 状态组件 =====

/**
 * 加载状态
 */
function LoadingState() {
  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="text-center">
        <div
          className="w-6 h-6 border-2 rounded-full animate-spin mx-auto mb-3"
          style={{
            borderColor: colorAlpha("primary", 0.2),
            borderTopColor: color("primary"),
          }}
        />
        <p className="text-sm" style={{ color: color("textMuted") }}>
          加载中...
        </p>
      </div>
    </div>
  );
}

/**
 * 错误状态
 */
function ErrorState({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="flex-1 flex items-center justify-center p-6 text-center">
      <div>
        <p className="text-sm" style={{ color: color("error") }}>
          加载世界书失败
        </p>
        <p
          className="text-xs mt-1"
          style={{ color: colorAlpha("textMuted", 0.7) }}
        >
          请稍后重试
        </p>
        {onRetry && (
          <button
            onClick={onRetry}
            className={cn(
              "mt-3 px-3 py-1.5 text-xs rounded-md border transition-all"
            )}
            style={{
              color: color("primary"),
              borderColor: colorAlpha("primary", 0.3),
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = colorAlpha("primary", 0.1);
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            重试
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * 条目列表空态
 */
function EmptyEntryList({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex-1 flex items-center justify-center p-6 text-center">
      <div>
        <FileText
          size={40}
          className="mx-auto mb-3"
          style={{ color: color("textMuted"), opacity: 0.5 }}
        />
        <p className="text-sm" style={{ color: color("textMuted") }}>
          暂无条目
        </p>
        <p
          className="text-xs mt-1 mb-3"
          style={{ color: colorAlpha("textMuted", 0.7) }}
        >
          创建第一个条目开始编写世界设定
        </p>
        <button
          onClick={onAdd}
          className={cn(
            "inline-flex items-center gap-1.5",
            "px-3 py-1.5",
            "text-sm",
            "rounded-md",
            "border",
            "transition-all"
          )}
          style={{
            color: color("primary"),
            borderColor: colorAlpha("primary", 0.3),
            transitionDuration: `${animation.duration.fast * 1000}ms`,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = colorAlpha("primary", 0.1);
            e.currentTarget.style.borderColor = colorAlpha("primary", 0.5);
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.borderColor = colorAlpha("primary", 0.3);
          }}
        >
          <Plus size={14} />
          新建目
        </button>
      </div>
    </div>
  );
}
