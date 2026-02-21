/**
 * 预设工作区状态管理 Hook
 *
 * 职责：
 * - 管理打开的预设面板列表
 * - 管理面板中的预设编辑状态（副本）
 * - 提供面板操作、预设操作、块操作接口
 * - 跟踪未保存的更改
 */

import { useCallback, useMemo, useState } from "react";

import type { Preset, PresetPurpose, PromptBlock } from "@/lib/prompt";
import {
  getDefaultPresetForPurpose,
  presetStorage,
  usePresetStore,
} from "@/lib/prompt";

// ===== 类型定义 =====

/**
 * 面板状态
 */
export interface PanelState {
  /** 面板 ID（用于 DnD 标识） */
  id: string;
  /** 预设 ID */
  presetId: string;
  /** 预设数据（编辑中的副本） */
  preset: Preset;
  /** 是否有未保存的更改 */
  hasChanges: boolean;
}

/**
 * 正在编辑的块信息
 */
export interface EditingBlockInfo {
  panelId: string;
  blockId: string;
}

/**
 * 工作区状态
 */
export interface WorkspaceState {
  /** 打开的预设面板列表 */
  panels: PanelState[];
  /** 当前激活的叙事预设 ID（兼容） */
  activePresetId: string | null;
  /** 当前按用途激活的预设 ID */
  activePresetByPurpose: Record<PresetPurpose, string | null>;
  /** 正在编辑的块信息 */
  editingBlock: EditingBlockInfo | null;
  /** 工作区是否打开 */
  isOpen: boolean;
}

/**
 * 工作区操作
 */
export interface WorkspaceActions {
  // ===== 工作区操作 =====
  open: () => void;
  close: () => void;

  // ===== 面板操作 =====
  openPanel: (presetId: string) => Promise<void>;
  closePanel: (panelId: string) => void;
  closeAllPanels: () => void;

  // ===== 预设操作 =====
  updatePanelPreset: (
    panelId: string,
    updates: Partial<
      Pick<
        Preset,
        "name" | "description" | "purpose" | "aiProfileId" | "postProcessRules"
      >
    >,
  ) => void;
  setActivePreset: (presetId: string) => Promise<void>;
  setActivePresetForPurpose: (
    purpose: PresetPurpose,
    presetId: string | null,
  ) => Promise<void>;
  createPreset: () => Promise<string>;
  duplicatePreset: (presetId: string) => Promise<string>;
  deletePreset: (presetId: string) => Promise<void>;
  resetPanelToDefault: (panelId: string) => void;

  // ===== 块操作 =====
  updatePanelBlock: (
    panelId: string,
    blockId: string,
    updates: Partial<PromptBlock>,
  ) => void;
  addBlockToPanel: (panelId: string, block: PromptBlock) => void;
  deleteBlockFromPanel: (panelId: string, blockId: string) => void;
  reorderBlocks: (panelId: string, fromIndex: number, toIndex: number) => void;
  copyBlockToPanel: (
    fromPanelId: string,
    blockId: string,
    toPanelId: string,
    toIndex: number,
  ) => void;
  moveBlockToPanel: (
    fromPanelId: string,
    blockId: string,
    toPanelId: string,
    toIndex: number,
  ) => void;

  // ===== 编辑操作 =====
  startEditingBlock: (panelId: string, blockId: string) => void;
  finishEditingBlock: () => void;

  // ===== 保存操作 =====
  savePanel: (panelId: string) => Promise<void>;
  saveAllPanels: () => Promise<void>;
  hasUnsavedChanges: () => boolean;
}

// ===== 工具函数 =====

/**
 * 生成面板 ID
 */
function generatePanelId(): string {
  return `panel-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 生成块 ID
 */
function generateBlockId(): string {
  return `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 深拷贝预设（用于创建编辑副本）
 */
function clonePreset(preset: Preset): Preset {
  return JSON.parse(JSON.stringify(preset));
}

// ===== Hook 实现 =====

/**
 * 预设工作区状态管理 Hook
 */
export function useWorkspaceState(): WorkspaceState & WorkspaceActions {
  // 从 PresetStore 获取全局状态
  const activePresetId = usePresetStore((s) => s.activePresetId);
  const activePresetByPurpose = usePresetStore((s) => s.activePresetByPurpose);
  const storeSetActivePreset = usePresetStore((s) => s.setActivePreset);
  const storeSetActivePresetForPurpose = usePresetStore(
    (s) => s.setActivePresetForPurpose,
  );
  const storeCreatePreset = usePresetStore((s) => s.createPreset);
  const storeDuplicatePreset = usePresetStore((s) => s.duplicatePreset);
  const storeDeletePreset = usePresetStore((s) => s.deletePreset);
  const storeUpdatePreset = usePresetStore((s) => s.updatePreset);

  // 本地状态
  const [isOpen, setIsOpen] = useState(false);
  const [panels, setPanels] = useState<PanelState[]>([]);
  const [editingBlock, setEditingBlock] = useState<EditingBlockInfo | null>(
    null,
  );

  // ===== 工作区操作 =====

  const open = useCallback(() => {
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  // ===== 面板操作 =====

  const openPanel = useCallback(
    async (presetId: string) => {
      // 检查是否已经打开
      const existingPanel = panels.find((p) => p.presetId === presetId);
      if (existingPanel) {
        // 已经打开，不重复添加
        return;
      }

      // 从存储加载预设
      const preset = await presetStorage.loadPreset(presetId);
      if (!preset) {
        console.error(`[useWorkspaceState] Preset ${presetId} not found`);
        return;
      }

      // 创建面板状态
      const panelState: PanelState = {
        id: generatePanelId(),
        presetId,
        preset: clonePreset(preset),
        hasChanges: false,
      };

      setPanels((prev) => [...prev, panelState]);
    },
    [panels],
  );

  const closePanel = useCallback((panelId: string) => {
    setPanels((prev) => prev.filter((p) => p.id !== panelId));
    // 如果正在编辑该面板的块，清除编辑状态
    setEditingBlock((prev) => (prev?.panelId === panelId ? null : prev));
  }, []);

  const closeAllPanels = useCallback(() => {
    setPanels([]);
    setEditingBlock(null);
  }, []);

  // ===== 预设操作 =====

  const updatePanelPreset = useCallback(
    (
      panelId: string,
      updates: Partial<
        Pick<
          Preset,
          | "name"
          | "description"
          | "purpose"
          | "aiProfileId"
          | "postProcessRules"
        >
      >,
    ) => {
      setPanels((prev) =>
        prev.map((panel) => {
          if (panel.id !== panelId) return panel;

          const hasNameUpdate = "name" in updates;
          const hasDescriptionUpdate = "description" in updates;
          const hasPurposeUpdate = "purpose" in updates;
          const hasAiProfileIdUpdate = "aiProfileId" in updates;
          const hasPostProcessRulesUpdate = "postProcessRules" in updates;

          const hasPresetChanges =
            (hasNameUpdate && updates.name !== panel.preset.name) ||
            (hasDescriptionUpdate &&
              updates.description !== panel.preset.description) ||
            (hasPurposeUpdate && updates.purpose !== panel.preset.purpose) ||
            (hasAiProfileIdUpdate &&
              updates.aiProfileId !== panel.preset.aiProfileId) ||
            (hasPostProcessRulesUpdate &&
              updates.postProcessRules !== panel.preset.postProcessRules);

          if (!hasPresetChanges) return panel;

          return {
            ...panel,
            preset: {
              ...panel.preset,
              ...updates,
            },
            hasChanges: true,
          };
        }),
      );
    },
    [],
  );

  const setActivePreset = useCallback(
    async (presetId: string) => {
      await storeSetActivePreset(presetId);
    },
    [storeSetActivePreset],
  );

  const setActivePresetForPurpose = useCallback(
    async (purpose: PresetPurpose, presetId: string | null) => {
      await storeSetActivePresetForPurpose(purpose, presetId);
    },
    [storeSetActivePresetForPurpose],
  );

  const createPreset = useCallback(async () => {
    const newPresetId = await storeCreatePreset({
      name: "新预设",
      description: "",
      purpose: "narrative",
      blocks: [],
      blockOrder: [],
    });
    // 自动打开新创建的预设
    await openPanel(newPresetId);
    return newPresetId;
  }, [storeCreatePreset, openPanel]);

  const duplicatePreset = useCallback(
    async (presetId: string) => {
      const newPresetId = await storeDuplicatePreset(presetId);
      // 自动打开复制的预设
      await openPanel(newPresetId);
      return newPresetId;
    },
    [storeDuplicatePreset, openPanel],
  );

  const deletePreset = useCallback(
    async (presetId: string) => {
      // 先关闭该预设的面板
      const panelToClose = panels.find((p) => p.presetId === presetId);
      if (panelToClose) {
        closePanel(panelToClose.id);
      }
      // 删除预设
      await storeDeletePreset(presetId);
    },
    [panels, closePanel, storeDeletePreset],
  );

  const resetPanelToDefault = useCallback((panelId: string) => {
    setPanels((prev) =>
      prev.map((panel) => {
        if (panel.id !== panelId) return panel;

        const defaultPreset = clonePreset(
          getDefaultPresetForPurpose(panel.preset.purpose ?? "narrative"),
        );

        return {
          ...panel,
          preset: {
            ...panel.preset,
            blocks: defaultPreset.blocks,
            blockOrder: defaultPreset.blockOrder,
          },
          hasChanges: true,
        };
      }),
    );
  }, []);

  // ===== 块操作 =====

  const updatePanelBlock = useCallback(
    (panelId: string, blockId: string, updates: Partial<PromptBlock>) => {
      setPanels((prev) =>
        prev.map((panel) => {
          if (panel.id !== panelId) return panel;
          return {
            ...panel,
            preset: {
              ...panel.preset,
              blocks: panel.preset.blocks.map((block) =>
                block.id === blockId ? { ...block, ...updates } : block,
              ),
            },
            hasChanges: true,
          };
        }),
      );
    },
    [],
  );

  const addBlockToPanel = useCallback((panelId: string, block: PromptBlock) => {
    setPanels((prev) =>
      prev.map((panel) => {
        if (panel.id !== panelId) return panel;
        const newBlock = {
          ...block,
          id: block.id || generateBlockId(),
        };
        return {
          ...panel,
          preset: {
            ...panel.preset,
            blocks: [...panel.preset.blocks, newBlock],
            blockOrder: [...panel.preset.blockOrder, newBlock.id],
          },
          hasChanges: true,
        };
      }),
    );
  }, []);

  const deleteBlockFromPanel = useCallback(
    (panelId: string, blockId: string) => {
      setPanels((prev) =>
        prev.map((panel) => {
          if (panel.id !== panelId) return panel;
          return {
            ...panel,
            preset: {
              ...panel.preset,
              blocks: panel.preset.blocks.filter((b) => b.id !== blockId),
              blockOrder: panel.preset.blockOrder.filter(
                (id) => id !== blockId,
              ),
            },
            hasChanges: true,
          };
        }),
      );
      // 如果正在编辑该块，清除编辑状态
      setEditingBlock((prev) => (prev?.blockId === blockId ? null : prev));
    },
    [],
  );

  const reorderBlocks = useCallback(
    (panelId: string, fromIndex: number, toIndex: number) => {
      setPanels((prev) =>
        prev.map((panel) => {
          if (panel.id !== panelId) return panel;
          const newBlockOrder = [...panel.preset.blockOrder];
          const [removed] = newBlockOrder.splice(fromIndex, 1);
          newBlockOrder.splice(toIndex, 0, removed);
          return {
            ...panel,
            preset: {
              ...panel.preset,
              blockOrder: newBlockOrder,
            },
            hasChanges: true,
          };
        }),
      );
    },
    [],
  );

  const copyBlockToPanel = useCallback(
    (
      fromPanelId: string,
      blockId: string,
      toPanelId: string,
      toIndex: number,
    ) => {
      setPanels((prev) => {
        const fromPanel = prev.find((p) => p.id === fromPanelId);
        if (!fromPanel) return prev;

        const blockToCopy = fromPanel.preset.blocks.find(
          (b) => b.id === blockId,
        );
        if (!blockToCopy) return prev;

        // 创建块副本
        const newBlock: PromptBlock = {
          ...blockToCopy,
          id: generateBlockId(),
        };

        return prev.map((panel) => {
          if (panel.id !== toPanelId) return panel;
          const newBlockOrder = [...panel.preset.blockOrder];
          newBlockOrder.splice(toIndex, 0, newBlock.id);
          return {
            ...panel,
            preset: {
              ...panel.preset,
              blocks: [...panel.preset.blocks, newBlock],
              blockOrder: newBlockOrder,
            },
            hasChanges: true,
          };
        });
      });
    },
    [],
  );

  const moveBlockToPanel = useCallback(
    (
      fromPanelId: string,
      blockId: string,
      toPanelId: string,
      toIndex: number,
    ) => {
      setPanels((prev) => {
        const fromPanel = prev.find((p) => p.id === fromPanelId);
        if (!fromPanel) return prev;

        const blockToMove = fromPanel.preset.blocks.find(
          (b) => b.id === blockId,
        );
        if (!blockToMove) return prev;

        // 创建新块（保持原 ID 或生成新 ID）
        const newBlock: PromptBlock = {
          ...blockToMove,
          id: generateBlockId(),
        };

        return prev.map((panel) => {
          if (panel.id === fromPanelId) {
            // 从源面板移除
            return {
              ...panel,
              preset: {
                ...panel.preset,
                blocks: panel.preset.blocks.filter((b) => b.id !== blockId),
                blockOrder: panel.preset.blockOrder.filter(
                  (id) => id !== blockId,
                ),
              },
              hasChanges: true,
            };
          }
          if (panel.id === toPanelId) {
            // 添加到目标面板
            const newBlockOrder = [...panel.preset.blockOrder];
            newBlockOrder.splice(toIndex, 0, newBlock.id);
            return {
              ...panel,
              preset: {
                ...panel.preset,
                blocks: [...panel.preset.blocks, newBlock],
                blockOrder: newBlockOrder,
              },
              hasChanges: true,
            };
          }
          return panel;
        });
      });
    },
    [],
  );

  // ===== 编辑操作 =====

  const startEditingBlock = useCallback((panelId: string, blockId: string) => {
    setEditingBlock({ panelId, blockId });
  }, []);

  const finishEditingBlock = useCallback(() => {
    setEditingBlock(null);
  }, []);

  // ===== 保存操作 =====

  const savePanel = useCallback(
    async (panelId: string) => {
      const panel = panels.find((p) => p.id === panelId);
      if (!panel) return;

      await storeUpdatePreset(panel.presetId, panel.preset);

      setPanels((prev) =>
        prev.map((p) => (p.id === panelId ? { ...p, hasChanges: false } : p)),
      );
    },
    [panels, storeUpdatePreset],
  );

  const saveAllPanels = useCallback(async () => {
    const panelsWithChanges = panels.filter((p) => p.hasChanges);
    for (const panel of panelsWithChanges) {
      await storeUpdatePreset(panel.presetId, panel.preset);
    }

    setPanels((prev) => prev.map((p) => ({ ...p, hasChanges: false })));
  }, [panels, storeUpdatePreset]);

  const hasUnsavedChanges = useCallback(() => {
    return panels.some((p) => p.hasChanges);
  }, [panels]);

  // ===== 返回状态和操作 =====

  return useMemo(
    () => ({
      // 状态
      panels,
      activePresetId,
      activePresetByPurpose,
      editingBlock,
      isOpen,

      // 工作区操作
      open,
      close,

      // 面板操作
      openPanel,
      closePanel,
      closeAllPanels,

      // 预设操作
      updatePanelPreset,
      setActivePreset,
      setActivePresetForPurpose,
      createPreset,
      duplicatePreset,
      deletePreset,
      resetPanelToDefault,

      // 块操作
      updatePanelBlock,
      addBlockToPanel,
      deleteBlockFromPanel,
      reorderBlocks,
      copyBlockToPanel,
      moveBlockToPanel,

      // 编辑操作
      startEditingBlock,
      finishEditingBlock,

      // 保存操作
      savePanel,
      saveAllPanels,
      hasUnsavedChanges,
    }),
    [
      panels,
      activePresetId,
      activePresetByPurpose,
      editingBlock,
      isOpen,
      open,
      close,
      openPanel,
      closePanel,
      closeAllPanels,
      updatePanelPreset,
      setActivePreset,
      setActivePresetForPurpose,
      createPreset,
      duplicatePreset,
      deletePreset,
      resetPanelToDefault,
      updatePanelBlock,
      addBlockToPanel,
      deleteBlockFromPanel,
      reorderBlocks,
      copyBlockToPanel,
      moveBlockToPanel,
      startEditingBlock,
      finishEditingBlock,
      savePanel,
      saveAllPanels,
      hasUnsavedChanges,
    ],
  );
}
