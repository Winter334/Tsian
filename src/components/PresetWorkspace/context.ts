/**
 * 预设工作区上下文
 *
 * 独立文件以避免循环依赖
 */

import { createContext, useContext } from "react";
import type {
  WorkspaceActions,
  WorkspaceState,
} from "./hooks/useWorkspaceState";

/**
 * 工作区上下文类型
 */
export type WorkspaceContextValue = WorkspaceState & WorkspaceActions;

/**
 * 工作区上下文
 */
export const WorkspaceContext = createContext<WorkspaceContextValue | null>(
  null
);

/**
 * 获取工作区上下文
 */
export function useWorkspace(): WorkspaceContextValue {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error("useWorkspace must be used within PresetWorkspace");
  }
  return context;
}
