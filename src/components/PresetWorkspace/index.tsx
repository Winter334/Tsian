/**
 * 预设工作区组件导出
 *
 * 这是模块入口文件（barrel file），混合导出组件和 hooks 是正常的模式
 */
/* eslint-disable react-refresh/only-export-components */

// 主组件
export { PresetButton } from "./PresetButton";
export { PresetWorkspace } from "./PresetWorkspace";

// 上下文
export { useWorkspace } from "./context";
export type { WorkspaceContextValue } from "./context";

// 工具栏
export { PresetWorkspaceToolbar } from "./PresetWorkspaceToolbar";

// 面板组件
export { PresetPanel } from "./PresetPanel";
export { PresetPanelHeader } from "./PresetPanelHeader";

// 块组件
export { BlockItem, BlockItemOverlay } from "./BlockItem";
export type { BlockItemProps } from "./BlockItem";
export { BlockList } from "./BlockList";
export type { BlockListProps } from "./BlockList";

// 块编辑弹窗
export { BlockEditorDialog } from "./BlockEditorDialog";
export type { BlockEditorDialogProps } from "./BlockEditorDialog";
export { MarkerConfigPanel } from "./MarkerConfigPanel";
export type { MarkerConfigPanelProps } from "./MarkerConfigPanel";

// 导入/导出对话框
export { ImportExportDialog } from "./ImportExportDialog";
export type { ImportExportDialogProps } from "./ImportExportDialog";

// Hooks
export { usePresetDnd } from "./hooks/usePresetDnd";
export type { DndState, DragData, DropData } from "./hooks/usePresetDnd";
export { useWorkspaceState } from "./hooks/useWorkspaceState";
export type {
  EditingBlockInfo,
  PanelState,
  WorkspaceActions,
  WorkspaceState,
} from "./hooks/useWorkspaceState";
