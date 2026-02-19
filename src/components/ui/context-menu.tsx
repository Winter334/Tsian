import { AnimatePresence, motion } from "framer-motion";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";
import { animation, color, colorAlpha, glow } from "@/styles/tokens";

export interface ContextMenuActionContext {
  /** 用户选中的文本 */
  selectedText: string;
  /** 触发菜单的位置坐标 */
  position: { x: number; y: number };
  /** 额外上下文数据 */
  data?: Record<string, unknown>;
}

export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: ReactNode;
  shortcut?: string;
  disabled?: boolean;
  /** 是否在没有选中文本时隐藏 */
  requiresSelection?: boolean;
  onAction: (context: ContextMenuActionContext) => void;
}

export interface ContextMenuProps {
  children: ReactNode;
  items: ContextMenuItem[];
  /** 额外的上下文数据，传递给 onAction */
  contextData?: Record<string, unknown>;
}

interface ContextMenuState {
  open: boolean;
  selectedText: string;
  position: { x: number; y: number };
}

const VIEWPORT_PADDING = 8;

function getSelectionTextWithin(container: HTMLElement | null): string {
  if (typeof window === "undefined") {
    return "";
  }

  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return "";
  }

  const text = selection.toString().trim();
  if (!text || !container) {
    return text;
  }

  const range = selection.getRangeAt(0);
  if (!container.contains(range.commonAncestorContainer)) {
    return "";
  }

  return text;
}

function constrainToViewport(
  x: number,
  y: number,
  width: number,
  height: number,
): { x: number; y: number } {
  if (typeof window === "undefined") {
    return { x, y };
  }

  const maxX = window.innerWidth - width - VIEWPORT_PADDING;
  const maxY = window.innerHeight - height - VIEWPORT_PADDING;

  return {
    x: Math.min(
      Math.max(x, VIEWPORT_PADDING),
      Math.max(VIEWPORT_PADDING, maxX),
    ),
    y: Math.min(
      Math.max(y, VIEWPORT_PADDING),
      Math.max(VIEWPORT_PADDING, maxY),
    ),
  };
}

export function ContextMenu({
  children,
  items,
  contextData,
}: ContextMenuProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const [isMounted, setIsMounted] = useState(false);
  const [state, setState] = useState<ContextMenuState>({
    open: false,
    selectedText: "",
    position: { x: 0, y: 0 },
  });

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const visibleItems = useMemo(() => {
    const hasSelection = state.selectedText.length > 0;
    return items.filter((item) => !(item.requiresSelection && !hasSelection));
  }, [items, state.selectedText]);

  const closeMenu = useCallback(() => {
    setState((previous) =>
      previous.open ? { ...previous, open: false } : previous,
    );
  }, []);

  const handleContextMenu = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (typeof window === "undefined") {
        return;
      }

      if (window.matchMedia("(pointer: coarse)").matches) {
        return;
      }

      const selectedText = getSelectionTextWithin(containerRef.current);
      const nextVisibleItems = items.filter(
        (item) => !(item.requiresSelection && selectedText.length === 0),
      );

      if (nextVisibleItems.length === 0) {
        return;
      }

      event.preventDefault();

      setState({
        open: true,
        selectedText,
        position: { x: event.clientX, y: event.clientY },
      });
    },
    [items],
  );

  const handleItemAction = useCallback(
    (item: ContextMenuItem) => {
      if (item.disabled) {
        return;
      }

      item.onAction({
        selectedText: state.selectedText,
        position: state.position,
        data: contextData,
      });

      closeMenu();
    },
    [closeMenu, contextData, state.position, state.selectedText],
  );

  useEffect(() => {
    if (!state.open) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      if (menuRef.current?.contains(target)) {
        return;
      }

      closeMenu();
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMenu();
      }
    };

    const handleResize = () => closeMenu();
    const handleScroll = () => closeMenu();

    document.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);
    window.addEventListener("resize", handleResize);
    document.addEventListener("scroll", handleScroll, true);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
      window.removeEventListener("resize", handleResize);
      document.removeEventListener("scroll", handleScroll, true);
    };
  }, [closeMenu, state.open]);

  useEffect(() => {
    if (!state.open || !menuRef.current) {
      return;
    }

    const rect = menuRef.current.getBoundingClientRect();
    const constrained = constrainToViewport(
      state.position.x,
      state.position.y,
      rect.width,
      rect.height,
    );

    if (
      constrained.x !== state.position.x ||
      constrained.y !== state.position.y
    ) {
      setState((previous) => ({
        ...previous,
        position: constrained,
      }));
    }
  }, [state.open, state.position.x, state.position.y, visibleItems.length]);

  const menu = (
    <AnimatePresence>
      {state.open && visibleItems.length > 0 && (
        <motion.div
          ref={menuRef}
          initial={{ opacity: 0, scale: 0.96, y: -4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, y: -2 }}
          transition={{ duration: animation.duration.fast, ease: "easeOut" }}
          className={cn(
            "fixed z-100 min-w-52 rounded-lg p-1.5 backdrop-blur-md",
            "select-none",
          )}
          style={{
            left: state.position.x,
            top: state.position.y,
            background: colorAlpha("bgElevated", 0.92),
            border: `1px solid ${colorAlpha("border", 0.4)}`,
            boxShadow: `${glow("primary", "md", 0.18)}, 0 10px 24px ${colorAlpha("bgBase", 0.45)}`,
          }}
          role="menu"
          aria-label="上下文菜单"
        >
          {visibleItems.map((item) => (
            <button
              key={item.id}
              type="button"
              disabled={item.disabled}
              onClick={() => handleItemAction(item)}
              className={cn(
                "group flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left",
                "transition-colors",
                "disabled:cursor-not-allowed disabled:opacity-45",
              )}
              style={{
                color: color("textSecondary"),
              }}
              onMouseEnter={(event) => {
                if (item.disabled) {
                  return;
                }
                event.currentTarget.style.background = colorAlpha(
                  "primary",
                  0.14,
                );
                event.currentTarget.style.color = color("textPrimary");
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.background = "transparent";
                event.currentTarget.style.color = color("textSecondary");
              }}
              role="menuitem"
            >
              <span className="flex min-w-0 items-center gap-2">
                {item.icon && (
                  <span
                    className="inline-flex h-4 w-4 shrink-0 items-center justify-center"
                    style={{ color: colorAlpha("primary", 0.9) }}
                  >
                    {item.icon}
                  </span>
                )}
                <span className="truncate text-sm">{item.label}</span>
              </span>
              {item.shortcut && (
                <span
                  className="shrink-0 text-xs"
                  style={{ color: colorAlpha("textMuted", 0.9) }}
                >
                  {item.shortcut}
                </span>
              )}
            </button>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <>
      <div
        ref={containerRef}
        className="contents"
        onContextMenu={handleContextMenu}
      >
        {children}
      </div>
      {isMounted && typeof document !== "undefined"
        ? createPortal(menu, document.body)
        : null}
    </>
  );
}
