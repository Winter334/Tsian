/**
 * 提示词块列表组件（DnD 容器）
 *
 * 使用 @dnd-kit/sortable 实现：
 * - 同面板内拖拽排序
 * - 作为跨面板拖拽的放置目标
 * - 新增块入场动画
 */

import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { AnimatePresence, motion } from "framer-motion";

import type { PromptBlock } from "@/lib/prompt";
import { cn } from "@/lib/utils";
import { animation, color, colorAlpha, glow } from "@/styles/tokens";

import { BlockItem } from "./BlockItem";

// ===== 动画变体 =====

const blockEntryVariants = {
  initial: {
    opacity: 0,
    scale: 0.8,
    y: -10,
  },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      type: "spring" as const,
      stiffness: 400,
      damping: 25,
      mass: 0.8,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.9,
    y: -5,
    transition: {
      duration: animation.duration.fast,
    },
  },
};

// ===== 类型 =====

export interface BlockListProps {
  /** 面板 ID */
  panelId: string;
  /** 排序后的块列表 */
  blocks: PromptBlock[];
  /** 当前是否有拖拽操作进行中 */
  isDraggingOver?: boolean;
  /** 当前拖拽中的块 ID */
  activeDragBlockId?: string | null;
  /** 拖拽来源面板 ID */
  dragSourcePanelId?: string | null;
  /** 插入位置指示索引 */
  dropIndicatorIndex?: number | null;
}

// ===== 组件 =====

/**
 * 提示词块列表
 */
export function BlockList({
  panelId,
  blocks,
  isDraggingOver,
  activeDragBlockId = null,
  dragSourcePanelId = null,
  dropIndicatorIndex = null,
}: BlockListProps) {
  // 使用 droppable 使整个列表成为放置目标
  const { setNodeRef, isOver } = useDroppable({
    id: `panel-${panelId}`,
    data: {
      type: "panel",
      panelId,
    },
  });

  // 获取块 ID 列表用于 SortableContext
  const blockIds = blocks.map((block) => block.id);

  // 是否显示放置指示器
  const showDropIndicator = isDraggingOver || isOver;
  const normalizedDropIndicatorIndex =
    showDropIndicator && dropIndicatorIndex !== null
      ? Math.max(0, Math.min(dropIndicatorIndex, blocks.length))
      : null;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col gap-2",
        "min-h-25",
        "p-1",
        "rounded",
        "transition-colors duration-200"
      )}
      style={{
        background: showDropIndicator
          ? colorAlpha("primary", 0.05)
          : "transparent",
        border: showDropIndicator
          ? `2px dashed ${colorAlpha("primary", 0.4)}`
          : "2px dashed transparent",
      }}
    >
      <SortableContext items={blockIds} strategy={verticalListSortingStrategy}>
        {blocks.length === 0 ? (
          <EmptyState isDropTarget={showDropIndicator} />
        ) : (
          <AnimatePresence initial={false} mode="popLayout">
            {blocks.map((block, index) => {
              const showInsertBefore = normalizedDropIndicatorIndex === index;
              const isActiveDraggingBlock =
                activeDragBlockId === block.id && dragSourcePanelId === panelId;

              return (
                <motion.div
                  key={block.id}
                  layout
                  className="relative"
                  variants={blockEntryVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
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

                  <BlockItem
                    block={block}
                    panelId={panelId}
                    isDragging={isActiveDraggingBlock}
                  />
                </motion.div>
              );
            })}

            {normalizedDropIndicatorIndex === blocks.length && (
              <motion.div
                key={`drop-indicator-end-${panelId}`}
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
        )}
      </SortableContext>
    </div>
  );
}

// ===== 子组件 =====

interface EmptyStateProps {
  isDropTarget?: boolean;
}

/**
 * 空状态提示
 */
function EmptyState({ isDropTarget }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-center",
        "h-24",
        "text-sm",
        "rounded",
        "transition-colors duration-200"
      )}
      style={{
        color: color("textMuted"),
        background: isDropTarget
          ? colorAlpha("primary", 0.1)
          : colorAlpha("bgBase", 0.3),
      }}
    >
      {isDropTarget ? "放置到此处" : "暂无提示词块"}
    </div>
  );
}
