import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useId, useSyncExternalStore, type ReactNode } from "react";

import { animation, colorAlpha } from "@/styles/tokens";
import { X } from "lucide-react";

interface SidebarDrawerProps {
  side: "left" | "right";
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}

const OPEN_DRAWER_STACK: string[] = [];
const DRAWER_REGISTRY = new Map<string, () => void>();

let drawerEscapeListenerAttached = false;

function getTopDrawerId(): string | undefined {
  return OPEN_DRAWER_STACK[OPEN_DRAWER_STACK.length - 1];
}

function removeDrawerFromStack(drawerId: string): void {
  const index = OPEN_DRAWER_STACK.lastIndexOf(drawerId);
  if (index >= 0) {
    OPEN_DRAWER_STACK.splice(index, 1);
  }
}

function handleDrawerEscape(event: KeyboardEvent): void {
  if (event.key !== "Escape") {
    return;
  }

  const topDrawerId = getTopDrawerId();
  if (!topDrawerId) {
    return;
  }

  queueMicrotask(() => {
    if (event.defaultPrevented) {
      return;
    }

    const latestTopDrawerId = getTopDrawerId();
    if (!latestTopDrawerId || latestTopDrawerId !== topDrawerId) {
      return;
    }

    const closeDrawer = DRAWER_REGISTRY.get(latestTopDrawerId);
    if (!closeDrawer) {
      return;
    }

    event.preventDefault();
    closeDrawer();
  });
}

function syncDrawerEscapeListener(): void {
  if (typeof window === "undefined") {
    return;
  }

  const hasOpenDrawer = OPEN_DRAWER_STACK.length > 0;

  if (hasOpenDrawer) {
    if (!drawerEscapeListenerAttached) {
      window.addEventListener("keydown", handleDrawerEscape);
      drawerEscapeListenerAttached = true;
    }
    return;
  }

  if (drawerEscapeListenerAttached) {
    window.removeEventListener("keydown", handleDrawerEscape);
    drawerEscapeListenerAttached = false;
  }
}

function useIsMobile(): boolean {
  return useSyncExternalStore(
    (callback) => {
      if (typeof window === "undefined") return () => undefined;

      const mql = window.matchMedia("(max-width: 767.98px)");
      if (typeof mql.addEventListener === "function") {
        mql.addEventListener("change", callback);
        return () => mql.removeEventListener("change", callback);
      }

      mql.addListener(callback);
      return () => mql.removeListener(callback);
    },
    () => {
      if (typeof window === "undefined") return false;
      return window.matchMedia("(max-width: 767.98px)").matches;
    },
    () => false,
  );
}

export function SidebarDrawer({
  side,
  open,
  onClose,
  children,
}: SidebarDrawerProps) {
  const isMobile = useIsMobile();
  const drawerId = useId();

  useEffect(() => {
    if (!open || !isMobile) {
      return;
    }

    DRAWER_REGISTRY.set(drawerId, onClose);
    removeDrawerFromStack(drawerId);
    OPEN_DRAWER_STACK.push(drawerId);
    syncDrawerEscapeListener();

    return () => {
      removeDrawerFromStack(drawerId);
      DRAWER_REGISTRY.delete(drawerId);
      syncDrawerEscapeListener();
    };
  }, [drawerId, isMobile, onClose, open]);

  if (!isMobile) return null;

  const initialX = side === "left" ? -288 : 288;

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-40"
            style={{ background: colorAlpha("bgBase", 0.6) }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: animation.duration.normal }}
            onClick={onClose}
          />

          <motion.aside
            className={[
              "fixed top-0 bottom-0 z-40 w-full overflow-y-auto",
              side === "left" ? "left-0" : "right-0",
            ].join(" ")}
            style={{
              background: colorAlpha("bgElevated", 0.9),
              borderLeft:
                side === "right"
                  ? `1px solid ${colorAlpha("primary", 0.2)}`
                  : undefined,
              borderRight:
                side === "left"
                  ? `1px solid ${colorAlpha("primary", 0.2)}`
                  : undefined,
              backdropFilter: "blur(10px)",
              WebkitBackdropFilter: "blur(10px)",
            }}
            initial={{ x: initialX, opacity: 0.8 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: initialX, opacity: 0.8 }}
            transition={{ duration: animation.duration.slow }}
            role="dialog"
            aria-modal="true"
            aria-label={side === "left" ? "角色状态侧栏" : "右侧功能栏侧栏"}
          >
            <motion.button
              type="button"
              onClick={onClose}
              className={[
                "absolute top-3 z-50 w-8 h-8 inline-flex items-center justify-center",
                side === "left" ? "right-3" : "left-3",
              ].join(" ")}
              style={{ color: colorAlpha("textSecondary", 0.6) }}
              whileHover={{ color: colorAlpha("textPrimary", 1) }}
              transition={{ duration: animation.duration.fast }}
              aria-label="关闭侧边栏"
            >
              <X className="w-4 h-4" />
            </motion.button>

            {children}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

export type { SidebarDrawerProps };
