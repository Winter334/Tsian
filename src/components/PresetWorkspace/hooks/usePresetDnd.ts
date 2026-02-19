/**
 * 预设拖拽逻辑 Hook
 *
 * 处理：
 * - 同面板内排序
 * - 跨面板复制（默认）
 * - 跨面板移动（按住 Shift）
 */

import type {
  DragCancelEvent,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  UniqueIdentifier,
} from "@dnd-kit/core";
import {
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { useCallback, useEffect, useState } from "react";

import type { PromptBlock } from "@/lib/prompt";

import type { PanelState, WorkspaceActions } from "./useWorkspaceState";

// ===== 类型定义 =====

/**
 * 拖拽数据（附加在 draggable 元素上）
 */
export interface DragData {
  type: "block";
  panelId: string;
  blockId: string;
  block: PromptBlock;
}

/**
 * 放置数据（附加在 droppable 区域上）
 */
export interface DropData {
  type: "panel" | "block";
  panelId: string;
  index?: number;
}

/**
 * 拖拽状态
 */
export interface DndState {
  /** 当前拖拽的块 */
  activeBlock: PromptBlock | null;
  /** 当前拖拽块 ID */
  activeBlockId: string | null;
  /** 拖拽来源面板 ID */
  sourcePanelId: string | null;
  /** 当前悬停目标面板 ID（用于插入位置指示） */
  overPanelId: string | null;
  /** 当前悬停插入索引（用于插入位置指示） */
  overIndex: number | null;
  /** 是否按住 Shift（移动模式） */
  isShiftPressed: boolean;
}

/**
 * Hook 返回类型
 */
export interface UsePresetDndResult {
  /** DnD 传感器配置 */
  sensors: ReturnType<typeof useSensors>;
  /** 拖拽状态 */
  dndState: DndState;
  /** 处理拖拽开始 */
  handleDragStart: (event: DragStartEvent) => void;
  /** 处理拖拽悬停 */
  handleDragOver: (event: DragOverEvent) => void;
  /** 处理拖拽取消 */
  handleDragCancel: (event: DragCancelEvent) => void;
  /** 处理拖拽结束 */
  handleDragEnd: (event: DragEndEvent) => void;
}

// ===== Hook 实现 =====

/**
 * 预设拖拽逻辑 Hook
 */
export function usePresetDnd(
  panels: PanelState[],
  workspaceActions: Pick<
    WorkspaceActions,
    "reorderBlocks" | "copyBlockToPanel" | "moveBlockToPanel"
  >
): UsePresetDndResult {
  // ===== 传感器配置 =====
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px 拖拽阈值，避免误触发
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // ===== 拖拽状态 =====
  const [dndState, setDndState] = useState<DndState>({
    activeBlock: null,
    activeBlockId: null,
    sourcePanelId: null,
    overPanelId: null,
    overIndex: null,
    isShiftPressed: false,
  });

  // ===== 清理拖拽状态（统一出口，避免灰态残留） =====
  const clearDragState = useCallback(() => {
    setDndState((prev) => {
      if (
        prev.activeBlock === null &&
        prev.activeBlockId === null &&
        prev.sourcePanelId === null &&
        prev.overPanelId === null &&
        prev.overIndex === null
      ) {
        return prev;
      }

      return {
        ...prev,
        activeBlock: null,
        activeBlockId: null,
        sourcePanelId: null,
        overPanelId: null,
        overIndex: null,
      };
    });
  }, []);

  // ===== 监听 Shift 键状态 =====
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Shift") {
        setDndState((prev) => ({ ...prev, isShiftPressed: true }));
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Shift") {
        setDndState((prev) => ({ ...prev, isShiftPressed: false }));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  // ===== 处理拖拽开始 =====
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event;
    const data = active.data.current as DragData | undefined;

    if (data?.type === "block") {
      setDndState((prev) => ({
        ...prev,
        activeBlock: data.block,
        activeBlockId: data.blockId,
        sourcePanelId: data.panelId,
        overPanelId: null,
        overIndex: null,
      }));
    }
  }, []);

  // ===== 处理拖拽悬停 =====
  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event;
      const activeData = active.data.current as DragData | undefined;

      if (!over || !activeData || activeData.type !== "block") {
        setDndState((prev) => ({
          ...prev,
          overPanelId: null,
          overIndex: null,
        }));
        return;
      }

      const targetInfo = parseDropTarget(over.id, over.data.current, panels);
      if (!targetInfo) {
        setDndState((prev) => ({
          ...prev,
          overPanelId: null,
          overIndex: null,
        }));
        return;
      }

      // 计算 UI 插入指示位置（同面板向下拖拽时显示在目标块后方）
      let indicatorIndex = targetInfo.targetIndex;
      if (
        targetInfo.targetType === "block" &&
        activeData.panelId === targetInfo.targetPanelId
      ) {
        const sourcePanel = panels.find((p) => p.id === activeData.panelId);
        const sourceIndex =
          sourcePanel?.preset.blockOrder.indexOf(activeData.blockId) ?? -1;

        if (sourceIndex !== -1 && sourceIndex < targetInfo.targetIndex) {
          indicatorIndex = targetInfo.targetIndex + 1;
        }
      }

      setDndState((prev) => ({
        ...prev,
        overPanelId: targetInfo.targetPanelId,
        overIndex: indicatorIndex,
      }));
    },
    [panels]
  );

  // ===== 处理拖拽取消 =====
  const handleDragCancel = useCallback(
    (_event: DragCancelEvent) => {
      clearDragState();
    },
    [clearDragState]
  );

  // ===== 拖拽状态兜底清理 =====
  useEffect(() => {
    if (!dndState.activeBlockId) return;

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
  }, [dndState.activeBlockId, clearDragState]);

  // ===== 处理拖拽结束 =====
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      // 清除拖拽状态
      clearDragState();

      if (!over) return;

      const activeData = active.data.current as DragData | undefined;
      const overId = over.id;

      if (!activeData || activeData.type !== "block") return;

      // 解析目标信息
      const targetInfo = parseDropTarget(overId, over.data.current, panels);
      if (!targetInfo) return;

      const { targetPanelId, targetIndex } = targetInfo;
      const sourcePanelId = activeData.panelId;
      const sourceBlockId = activeData.blockId;

      // 查找源面板和目标面板
      const sourcePanel = panels.find((p) => p.id === sourcePanelId);
      const targetPanel = panels.find((p) => p.id === targetPanelId);

      if (!sourcePanel || !targetPanel) return;

      // 同面板内排序
      if (sourcePanelId === targetPanelId) {
        const sourceIndex =
          sourcePanel.preset.blockOrder.indexOf(sourceBlockId);
        if (sourceIndex !== -1 && sourceIndex !== targetIndex) {
          workspaceActions.reorderBlocks(
            sourcePanelId,
            sourceIndex,
            targetIndex
          );
        }
      } else {
        // 跨面板操作
        if (dndState.isShiftPressed) {
          // Shift + 拖拽 = 移动
          workspaceActions.moveBlockToPanel(
            sourcePanelId,
            sourceBlockId,
            targetPanelId,
            targetIndex
          );
        } else {
          // 普通拖拽 = 复制
          workspaceActions.copyBlockToPanel(
            sourcePanelId,
            sourceBlockId,
            targetPanelId,
            targetIndex
          );
        }
      }
    },
    [panels, workspaceActions, dndState.isShiftPressed, clearDragState]
  );

  return {
    sensors,
    dndState,
    handleDragStart,
    handleDragOver,
    handleDragCancel,
    handleDragEnd,
  };
}

// ===== 工具函数 =====

/**
 * 解析放置目标信息
 */
function parseDropTarget(
  overId: UniqueIdentifier,
  overData: Record<string, unknown> | undefined,
  panels: PanelState[]
): {
  targetPanelId: string;
  targetIndex: number;
  targetType: "panel" | "block";
} | null {
  const overIdStr = String(overId);

  // 如果放置在面板上（空面板或面板末尾）
  if (overIdStr.startsWith("panel-")) {
    const panelId = overIdStr.replace("panel-", "");
    const panel = panels.find((p) => p.id === panelId);
    if (panel) {
      return {
        targetPanelId: panelId,
        targetIndex: panel.preset.blockOrder.length,
        targetType: "panel",
      };
    }
  }

  // 如果放置在另一个块上
  if (overData && (overData as { type?: string }).type === "block") {
    const blockData = overData as { panelId: string; blockId: string };
    const panel = panels.find((p) => p.id === blockData.panelId);
    if (panel) {
      const targetIndex = panel.preset.blockOrder.indexOf(blockData.blockId);
      return {
        targetPanelId: blockData.panelId,
        targetIndex:
          targetIndex >= 0 ? targetIndex : panel.preset.blockOrder.length,
        targetType: "block",
      };
    }
  }

  // 尝试通过 block ID 查找
  for (const panel of panels) {
    const blockIndex = panel.preset.blockOrder.indexOf(overIdStr);
    if (blockIndex !== -1) {
      return {
        targetPanelId: panel.id,
        targetIndex: blockIndex,
        targetType: "block",
      };
    }
  }

  return null;
}
