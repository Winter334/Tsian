import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useSyncExternalStore, type ReactNode } from "react";

import { animation, colorAlpha } from "@/styles/tokens";
import { X } from "lucide-react";

interface SidebarDrawerProps {
  side: "left" | "right";
  open: boolean;
  onClose: () => void;
  children: ReactNode;
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

  useEffect(() => {
    if (!open || !isMobile) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isMobile, open, onClose]);

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
            aria-label={side === "left" ? "角色状态侧栏" : "场景角色侧栏"}
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
