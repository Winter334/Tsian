/**
 * Toast 通知组件
 * 赛博朋克风格
 */

import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, AlertTriangle, CheckCircle, Info, X } from "lucide-react";
import { useCallback, useContext, useState, type ReactNode } from "react";
import { ToastContext, type Toast, type ToastType } from "./toast-context";

// 重新导出类型以保持向后兼容
export type { Toast, ToastType } from "./toast-context";

/**
 * Toast Provider
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Omit<Toast, "id">) => {
    const id = crypto.randomUUID();
    const newToast: Toast = { ...toast, id };

    setToasts((prev) => [...prev, newToast]);

    // 自动移除
    const duration = toast.duration ?? 5000;
    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <ToastContainer />
    </ToastContext.Provider>
  );
}

/**
 * Toast 容器
 */
function ToastContainer() {
  const context = useContext(ToastContext);
  if (!context) return null;

  const { toasts, removeToast } = context;

  return (
    <div className="fixed bottom-4 right-4 z-100 flex flex-col gap-2">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <ToastItem
            key={toast.id}
            toast={toast}
            onClose={() => removeToast(toast.id)}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

/**
 * Toast 项
 */
interface ToastItemProps {
  toast: Toast;
  onClose: () => void;
}

function ToastItem({ toast, onClose }: ToastItemProps) {
  const icons: Record<ToastType, ReactNode> = {
    success: <CheckCircle className="w-5 h-5 text-green-400" />,
    error: <AlertCircle className="w-5 h-5 text-red-400" />,
    info: <Info className="w-5 h-5 text-primary" />,
    warning: <AlertTriangle className="w-5 h-5 text-yellow-400" />,
  };

  const borderColors: Record<ToastType, string> = {
    success: "border-green-500/50",
    error: "border-red-500/50",
    info: "border-primary/50",
    warning: "border-yellow-500/50",
  };

  const glowColors: Record<ToastType, string> = {
    success: "shadow-[0_0_15px_rgba(34,197,94,0.3)]",
    error: "shadow-[0_0_15px_rgba(239,68,68,0.3)]",
    info: "shadow-[0_0_15px_rgba(0,229,204,0.3)]",
    warning: "shadow-[0_0_15px_rgba(234,179,8,0.3)]",
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 100, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 100, scale: 0.95 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={cn(
        "flex items-start gap-3 p-4 min-w-75 max-w-100",
        "bg-background/95 backdrop-blur-md",
        "border rounded-lg",
        borderColors[toast.type],
        glowColors[toast.type]
      )}
    >
      {/* 图标 */}
      <div className="shrink-0 mt-0.5">{icons[toast.type]}</div>

      {/* 内容 */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{toast.title}</p>
        {toast.description && (
          <p className="text-xs text-muted-foreground mt-1">
            {toast.description}
          </p>
        )}
      </div>

      {/* 关闭按钮 */}
      <button
        onClick={onClose}
        className="shrink-0 p-1 rounded hover:bg-muted/50 transition-colors"
      >
        <X className="w-4 h-4 text-muted-foreground" />
      </button>
    </motion.div>
  );
}
