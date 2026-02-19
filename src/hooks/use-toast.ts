/**
 * useToast Hook
 * 从 toast.tsx 中提取出来以符合 React Fast Refresh 规范
 */

import type { ToastType } from "@/components/ui/toast";
import { ToastContext } from "@/components/ui/toast-context";
import { useCallback, useContext, useMemo } from "react";

/**
 * 使用 Toast
 */
export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }

  const addToast = context.addToast;

  const toast = useCallback(
    (
      type: ToastType,
      title: string,
      description?: string,
      duration?: number,
    ) => {
      addToast({ type, title, description, duration });
    },
    [addToast],
  );

  const success = useCallback(
    (title: string, description?: string) =>
      toast("success", title, description),
    [toast],
  );
  const error = useCallback(
    (title: string, description?: string) => toast("error", title, description),
    [toast],
  );
  const info = useCallback(
    (title: string, description?: string) => toast("info", title, description),
    [toast],
  );
  const warning = useCallback(
    (title: string, description?: string) =>
      toast("warning", title, description),
    [toast],
  );

  return useMemo(
    () => ({
      toast,
      success,
      error,
      info,
      warning,
    }),
    [error, info, success, toast, warning],
  );
}
