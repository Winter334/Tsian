/**
 * 后处理规则列表（支持拖拽排序）
 *
 * 规则分组：
 * - 内置规则
 * - 用户规则
 *
 * 拖拽策略：
 * - 仅支持组内排序，防止跨组拖拽破坏分组语义
 */
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useMemo } from "react";

import type { PostProcessRule } from "@/lib/post-process";
import { cn } from "@/lib/utils";
import { animation, color, colorAlpha } from "@/styles/tokens";

import { RuleItem } from "./RuleItem";

export interface RuleListProps {
  rules: PostProcessRule[];
  onToggleEnabled: (id: string, enabled: boolean) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onReorder: (rules: PostProcessRule[]) => void;
}

const ruleEntryVariants = {
  initial: {
    opacity: 0,
    scale: 0.9,
    y: -8,
  },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      type: "spring" as const,
      stiffness: 360,
      damping: 26,
      mass: 0.8,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.94,
    y: -4,
    transition: {
      duration: animation.duration.fast,
    },
  },
};

function normalizeGroupOrders(items: PostProcessRule[]): PostProcessRule[] {
  return items.map((item, index) => ({
    ...item,
    order: index,
  }));
}

/**
 * 后处理规则列表。
 */
export function RuleList({
  rules,
  onToggleEnabled,
  onEdit,
  onDelete,
  onReorder,
}: RuleListProps) {
  const orderedRules = useMemo(
    () => [...rules].sort((a, b) => a.order - b.order),
    [rules],
  );

  const builtinRules = useMemo(
    () => orderedRules.filter((item) => item.source === "builtin"),
    [orderedRules],
  );

  const userRules = useMemo(
    () => orderedRules.filter((item) => item.source === "user"),
    [orderedRules],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) {
        return;
      }

      const activeRule = orderedRules.find(
        (item) => item.id === String(active.id),
      );
      const overRule = orderedRules.find((item) => item.id === String(over.id));

      if (!activeRule || !overRule) {
        return;
      }

      // 仅支持同 source 的组内排序
      if (activeRule.source !== overRule.source) {
        return;
      }

      const currentGroup =
        activeRule.source === "builtin" ? builtinRules : userRules;
      const sourceIndex = currentGroup.findIndex(
        (item) => item.id === activeRule.id,
      );
      const targetIndex = currentGroup.findIndex(
        (item) => item.id === overRule.id,
      );

      if (
        sourceIndex === -1 ||
        targetIndex === -1 ||
        sourceIndex === targetIndex
      ) {
        return;
      }

      const reorderedGroup = arrayMove(currentGroup, sourceIndex, targetIndex);

      if (activeRule.source === "builtin") {
        const reorderedBuiltinRules = normalizeGroupOrders(reorderedGroup);
        onReorder([...reorderedBuiltinRules, ...userRules]);
        return;
      }

      const reorderedUserRules = normalizeGroupOrders(reorderedGroup);
      onReorder([...builtinRules, ...reorderedUserRules]);
    },
    [builtinRules, onReorder, orderedRules, userRules],
  );

  if (orderedRules.length === 0) {
    return <EmptyState />;
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-col gap-3">
        <RuleGroup
          title="内置规则"
          subtitle="系统保留规则，不可删除"
          rules={builtinRules}
          onToggleEnabled={onToggleEnabled}
          onEdit={onEdit}
          onDelete={onDelete}
        />

        <div
          className="mx-1"
          style={{ borderTop: `1px dashed ${colorAlpha("primary", 0.25)}` }}
        />

        <RuleGroup
          title="用户规则"
          subtitle="可自由编辑、排序与删除"
          rules={userRules}
          onToggleEnabled={onToggleEnabled}
          onEdit={onEdit}
          onDelete={onDelete}
          emptyText="暂无用户规则，点击“+ 新增”创建"
        />
      </div>
    </DndContext>
  );
}

interface RuleGroupProps {
  title: string;
  subtitle: string;
  rules: PostProcessRule[];
  onToggleEnabled: (id: string, enabled: boolean) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  emptyText?: string;
}

function RuleGroup({
  title,
  subtitle,
  rules,
  onToggleEnabled,
  onEdit,
  onDelete,
  emptyText,
}: RuleGroupProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-end justify-between gap-2 px-1">
        <div className="flex min-w-0 flex-col">
          <span
            className="text-sm font-medium"
            style={{ color: color("textSecondary") }}
          >
            {title}
          </span>
          <span className="text-xs" style={{ color: color("textMuted") }}>
            {subtitle}
          </span>
        </div>
        <span className="text-xs" style={{ color: color("textMuted") }}>
          {rules.length} 条
        </span>
      </div>

      <SortableContext
        items={rules.map((item) => item.id)}
        strategy={verticalListSortingStrategy}
      >
        {rules.length === 0 ? (
          <GroupEmptyState text={emptyText ?? "暂无规则"} />
        ) : (
          <AnimatePresence initial={false} mode="popLayout">
            {rules.map((rule) => (
              <motion.div
                key={rule.id}
                layout
                variants={ruleEntryVariants}
                initial="initial"
                animate="animate"
                exit="exit"
              >
                <RuleItem
                  rule={rule}
                  onToggleEnabled={onToggleEnabled}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </SortableContext>
    </div>
  );
}

function EmptyState() {
  return (
    <div
      className={cn(
        "flex h-28 items-center justify-center rounded-md border text-sm",
      )}
      style={{
        borderColor: colorAlpha("primary", 0.25),
        color: color("textMuted"),
        background: colorAlpha("bgBase", 0.32),
      }}
    >
      暂无后处理规则
    </div>
  );
}

function GroupEmptyState({ text }: { text: string }) {
  return (
    <div
      className="flex h-18 items-center justify-center rounded-md border border-dashed px-3 text-xs"
      style={{
        borderColor: colorAlpha("primary", 0.24),
        color: color("textMuted"),
        background: colorAlpha("bgBase", 0.24),
      }}
    >
      {text}
    </div>
  );
}
