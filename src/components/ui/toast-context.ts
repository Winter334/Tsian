/**
 * Toast Context
 * 从 toast.tsx 中提取出来以符合 React Fast Refresh 规范
 */

import { createContext } from "react";

/**
 * Toast 类型
 */
export type ToastType = "success" | "error" | "info" | "warning";

/**
 * Toast 数据
 */
export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  duration?: number;
}

/**
 * Toast Context Value
 */
export interface ToastContextValue {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, "id">) => void;
  removeToast: (id: string) => void;
}

/**
 * Toast Context
 */
export const ToastContext = createContext<ToastContextValue | null>(null);
