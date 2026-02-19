/**
 * Dialog 对话框组件
 * 复合层基线：统一 ESC 关闭、背景点击关闭、body 滚动锁定行为
 */

import { AnimatePresence, motion, type Variants } from "framer-motion";
import { X } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";
import {
  animation,
  borders,
  color,
  colorAlpha,
  glow,
  panelVariants,
} from "@/styles/tokens";

import { Overlay } from "./Overlay";
import { Panel, type PanelBackground, type PanelVariant } from "./Panel";

interface DialogStackEntry {
  onClose: () => void;
  canCloseOnEscape: () => boolean;
}

const OPEN_DIALOG_STACK: string[] = [];
const DIALOG_REGISTRY = new Map<string, DialogStackEntry>();

let dialogIdSeed = 0;
let escapeListenerAttached = false;
let previousBodyOverflow: string | null = null;
let previousBodyPaddingRight: string | null = null;

function createDialogId(): string {
  dialogIdSeed += 1;
  return `lyra-dialog-${dialogIdSeed}`;
}

function getTopDialogId(): string | undefined {
  return OPEN_DIALOG_STACK[OPEN_DIALOG_STACK.length - 1];
}

function removeDialogFromStack(dialogId: string): void {
  const index = OPEN_DIALOG_STACK.lastIndexOf(dialogId);
  if (index >= 0) {
    OPEN_DIALOG_STACK.splice(index, 1);
  }
}

function applyBodyScrollLock(): void {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return;
  }

  if (previousBodyOverflow !== null && previousBodyPaddingRight !== null) {
    return;
  }

  const { body, documentElement } = document;
  previousBodyOverflow = body.style.overflow;
  previousBodyPaddingRight = body.style.paddingRight;

  const scrollbarWidth = window.innerWidth - documentElement.clientWidth;
  body.style.overflow = "hidden";
  if (scrollbarWidth > 0) {
    body.style.paddingRight = `${scrollbarWidth}px`;
  }
}

function releaseBodyScrollLock(): void {
  if (typeof document === "undefined") {
    return;
  }

  if (previousBodyOverflow === null || previousBodyPaddingRight === null) {
    return;
  }

  const { body } = document;
  body.style.overflow = previousBodyOverflow;
  body.style.paddingRight = previousBodyPaddingRight;

  previousBodyOverflow = null;
  previousBodyPaddingRight = null;
}

function handleGlobalEscape(event: KeyboardEvent): void {
  if (event.key !== "Escape") {
    return;
  }

  const topDialogId = getTopDialogId();
  if (!topDialogId) {
    return;
  }

  const topDialog = DIALOG_REGISTRY.get(topDialogId);
  if (!topDialog || !topDialog.canCloseOnEscape()) {
    return;
  }

  event.preventDefault();
  topDialog.onClose();
}

function syncDialogEnvironment(): void {
  if (typeof window === "undefined") {
    return;
  }

  const hasOpenDialog = OPEN_DIALOG_STACK.length > 0;

  if (hasOpenDialog) {
    applyBodyScrollLock();
    if (!escapeListenerAttached) {
      window.addEventListener("keydown", handleGlobalEscape);
      escapeListenerAttached = true;
    }
    return;
  }

  releaseBodyScrollLock();
  if (escapeListenerAttached) {
    window.removeEventListener("keydown", handleGlobalEscape);
    escapeListenerAttached = false;
  }
}

interface DialogContextValue {
  dialogId: string;
  requestClose: () => boolean;
  registerOnExitComplete: (handler?: () => void) => void;
}

const DialogContext = createContext<DialogContextValue | null>(null);

function useDialogContext(): DialogContextValue {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error("Dialog components must be used within a Dialog");
  }
  return context;
}

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  /** 是否允许 ESC 关闭，默认 true */
  closeOnEscape?: boolean;
}

/**
 * Dialog 根组件
 */
export function Dialog({
  open,
  onOpenChange,
  children,
  closeOnEscape = true,
}: DialogProps) {
  const dialogIdRef = useRef<string>(createDialogId());
  const closeHandlerRef = useRef(onOpenChange);
  const closeOnEscapeRef = useRef(closeOnEscape);
  const exitCompleteHandlerRef = useRef<(() => void) | undefined>(undefined);

  const dialogId = dialogIdRef.current;

  useEffect(() => {
    closeHandlerRef.current = onOpenChange;
  }, [onOpenChange]);

  useEffect(() => {
    closeOnEscapeRef.current = closeOnEscape;
  }, [closeOnEscape]);

  const requestClose = useCallback(() => {
    if (getTopDialogId() !== dialogId) {
      return false;
    }
    closeHandlerRef.current(false);
    return true;
  }, [dialogId]);

  const registerOnExitComplete = useCallback((handler?: () => void) => {
    exitCompleteHandlerRef.current = handler;
  }, []);

  const contextValue = useMemo<DialogContextValue>(
    () => ({
      dialogId,
      requestClose,
      registerOnExitComplete,
    }),
    [dialogId, requestClose, registerOnExitComplete],
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    DIALOG_REGISTRY.set(dialogId, {
      onClose: () => closeHandlerRef.current(false),
      canCloseOnEscape: () => closeOnEscapeRef.current,
    });

    removeDialogFromStack(dialogId);
    OPEN_DIALOG_STACK.push(dialogId);
    syncDialogEnvironment();

    return () => {
      removeDialogFromStack(dialogId);
      DIALOG_REGISTRY.delete(dialogId);
      syncDialogEnvironment();
    };
  }, [dialogId, open]);

  return (
    <AnimatePresence
      onExitComplete={() => {
        exitCompleteHandlerRef.current?.();
      }}
    >
      {open && (
        <DialogContext.Provider value={contextValue}>
          {children}
        </DialogContext.Provider>
      )}
    </AnimatePresence>
  );
}

type DialogPresetWidth = "sm" | "md" | "lg" | "xl";
type DialogWidth = number | DialogPresetWidth;

const DIALOG_SIZE_MAP: Record<DialogPresetWidth, number> = {
  sm: 320,
  md: 384,
  lg: 512,
  xl: 576,
};

/**
 * 保留 className 尺寸映射以兼容历史用法（未启用 animateSize 时）
 */
const DIALOG_WIDTH_CLASSNAME: Record<DialogPresetWidth, string> = {
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
};

const DIALOG_LIFECYCLE_VARIANTS: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.96,
    y: 12,
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      duration: animation.duration.normal,
      ease: "easeOut",
    },
  },
  exit: {
    opacity: 0,
    scale: 0.96,
    y: 8,
    transition: {
      duration: animation.duration.normal,
      ease: "easeOut",
    },
  },
};

interface DialogContentProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;

  // 标题栏
  title?: string;
  description?: string;
  header?: ReactNode;
  footer?: ReactNode;
  showCloseButton?: boolean;

  // 尺寸
  width?: DialogWidth;
  animateSize?: boolean;
  onExitComplete?: () => void;

  // 生命周期动画
  animateLifecycle?: boolean;

  // Panel 视觉配置
  variant?: PanelVariant;
  background?: PanelBackground;
  borderRadius?: string;
  borderWidth?: string;
  backdropBlur?: string;
  backgroundOpacity?: number;
  borderGlow?: boolean;
  enterAnimation?: boolean;

  // 交互行为
  closeOnBackdropClick?: boolean;

  // Escape Hatch
  unstyled?: boolean;
}

/**
 * Dialog 内容组件
 * 内部使用 Panel 作为视觉容器，支持 Slot 与 unstyled 模式
 */
export function DialogContent({
  children,
  className,
  style,
  title,
  description,
  header,
  footer,
  showCloseButton = true,
  width = "md",
  animateSize = false,
  onExitComplete,
  animateLifecycle = false,
  variant = "default",
  background = "starfield",
  borderRadius,
  borderWidth,
  backdropBlur,
  backgroundOpacity,
  borderGlow = true,
  enterAnimation = true,
  closeOnBackdropClick = true,
  unstyled = false,
}: DialogContentProps) {
  const { requestClose, registerOnExitComplete } = useDialogContext();

  useEffect(() => {
    registerOnExitComplete(onExitComplete);
    return () => {
      registerOnExitComplete(undefined);
    };
  }, [onExitComplete, registerOnExitComplete]);

  const handleClose = useCallback(() => {
    requestClose();
  }, [requestClose]);

  const handleBackdropClick = useCallback(() => {
    if (!closeOnBackdropClick) {
      return;
    }
    requestClose();
  }, [closeOnBackdropClick, requestClose]);

  const resolvedDialogWidth =
    typeof width === "number" ? Math.max(width, 240) : DIALOG_SIZE_MAP[width];
  const shouldUseInlineWidth = animateSize || typeof width === "number";

  const widthClassName = shouldUseInlineWidth
    ? "max-w-none"
    : DIALOG_WIDTH_CLASSNAME[width];

  const containerClassName = cn(
    "fixed left-1/2 top-1/2 z-50 w-full -translate-x-1/2 -translate-y-1/2 px-4",
    widthClassName,
    className,
  );

  const containerStyle: CSSProperties = {
    ...(shouldUseInlineWidth
      ? {
          width: resolvedDialogWidth,
          maxWidth: "calc(100vw - 2rem)",
        }
      : {}),
    ...style,
  };

  const sizeTransition = animateSize
    ? {
        duration: 0.25,
        ease: animation.easing.smooth,
      }
    : undefined;

  const resolvedHeader =
    header ??
    (title || description ? (
      <div
        className="flex items-start justify-between gap-4 p-4"
        style={{
          borderBottom: `${borders.width.medium} solid ${colorAlpha(
            "primary",
            0.25,
          )}`,
        }}
      >
        <div className="min-w-0">
          {title && (
            <h2
              className="text-lg font-semibold truncate"
              style={{ color: color("textPrimary") }}
            >
              {title}
            </h2>
          )}
          {description && (
            <p className="text-sm mt-1" style={{ color: color("textMuted") }}>
              {description}
            </p>
          )}
        </div>
        {showCloseButton && (
          <button
            onClick={handleClose}
            className={cn(
              "p-2 rounded-md shrink-0",
              `transition-all duration-[${animation.duration.fast * 1000}ms]`,
            )}
            style={{
              color: color("primary"),
            }}
            onMouseEnter={(event) => {
              event.currentTarget.style.color = color("primaryLight");
              event.currentTarget.style.background = colorAlpha("primary", 0.1);
              event.currentTarget.style.boxShadow = glow("primary", "sm", 0.3);
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.color = color("primary");
              event.currentTarget.style.background = "transparent";
              event.currentTarget.style.boxShadow = "none";
            }}
            aria-label="关闭对话框"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>
    ) : null);

  // 使用 Portal 将 Dialog 渲染到 document.body，
  // 避免被父级 transform/overflow 裁切（如嵌套 Dialog 场景）
  const portalContainer =
    typeof document !== "undefined" ? document.body : null;

  const wrapWithPortal = (content: ReactNode) =>
    portalContainer ? createPortal(content, portalContainer) : content;

  if (unstyled) {
    if (animateLifecycle) {
      return wrapWithPortal(
        <>
          <Overlay onClick={handleBackdropClick} />
          <motion.div
            variants={DIALOG_LIFECYCLE_VARIANTS}
            initial="hidden"
            animate="visible"
            exit="exit"
            className={containerClassName}
          >
            <motion.div
              className="mx-auto"
              initial={animateSize ? false : undefined}
              animate={animateSize ? { width: resolvedDialogWidth } : undefined}
              transition={sizeTransition}
              style={containerStyle}
            >
              {children}
            </motion.div>
          </motion.div>
        </>,
      );
    }

    return wrapWithPortal(
      <>
        <Overlay onClick={handleBackdropClick} />
        <motion.div
          variants={panelVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          layout={animateSize}
          className={containerClassName}
          style={containerStyle}
        >
          {children}
        </motion.div>
      </>,
    );
  }

  const panelBody = (
    <Panel
      variant={variant}
      background={background}
      borderRadius={borderRadius}
      borderWidth={borderWidth}
      backdropBlur={backdropBlur}
      backgroundOpacity={backgroundOpacity}
      borderGlow={borderGlow}
      enterAnimation={animateLifecycle ? false : enterAnimation}
      className="overflow-hidden"
    >
      <div
        className={cn(
          "max-h-[85vh] overflow-y-auto overflow-x-hidden",
          "scrollbar-none [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]",
        )}
        style={{ scrollbarGutter: "stable" }}
      >
        {resolvedHeader}
        <div className="p-4">{children}</div>
        {footer && (
          <div
            className="p-4 pt-3"
            style={{
              borderTop: `${borders.width.medium} solid ${colorAlpha(
                "primary",
                0.25,
              )}`,
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </Panel>
  );

  if (animateLifecycle) {
    return wrapWithPortal(
      <>
        <Overlay onClick={handleBackdropClick} />
        <motion.div
          variants={DIALOG_LIFECYCLE_VARIANTS}
          initial="hidden"
          animate="visible"
          exit="exit"
          className={containerClassName}
        >
          <motion.div
            className="mx-auto"
            initial={animateSize ? false : undefined}
            animate={animateSize ? { width: resolvedDialogWidth } : undefined}
            transition={sizeTransition}
            style={containerStyle}
          >
            {panelBody}
          </motion.div>
        </motion.div>
      </>,
    );
  }

  return wrapWithPortal(
    <>
      <Overlay onClick={handleBackdropClick} />
      <motion.div
        initial={animateSize ? false : undefined}
        animate={animateSize ? { width: resolvedDialogWidth } : undefined}
        transition={sizeTransition}
        className={containerClassName}
        style={containerStyle}
      >
        {panelBody}
      </motion.div>
    </>,
  );
}

/**
 * Dialog 头部（可选，用于自定义标题）
 */
export function DialogHeader({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col space-y-1.5 text-center sm:text-left",
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * Dialog 标题
 */
export function DialogTitle({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <h2
      className={cn(
        "text-lg font-semibold leading-none tracking-tight",
        className,
      )}
    >
      {children}
    </h2>
  );
}

/**
 * Dialog 描述
 */
export function DialogDescription({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p className={cn("text-sm text-muted-foreground", className)}>{children}</p>
  );
}

/**
 * Dialog 底部
 */
export function DialogFooter({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 mt-4",
        className,
      )}
    >
      {children}
    </div>
  );
}

// ===== 确认对话框 =====

interface ConfirmDialogProps {
  /** 是否打开 */
  open: boolean;
  /** 打开状态变化回调 */
  onOpenChange: (open: boolean) => void;
  /** 标题 */
  title: string;
  /** 描述/消息内容 */
  description?: string;
  /** 确认按钮文本 */
  confirmText?: string;
  /** 取消按钮文本 */
  cancelText?: string;
  /** 确认回调 */
  onConfirm: () => void;
  /** 取消回调 */
  onCancel?: () => void;
  /** 变体：默认或危险操作 */
  variant?: "default" | "destructive";
}

/**
 * 确认对话框组件
 * 用于替代浏览器原生 confirm 对话框
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText = "确定",
  cancelText = "取消",
  onConfirm,
  onCancel,
  variant = "default",
}: ConfirmDialogProps) {
  const handleConfirm = useCallback(() => {
    onConfirm();
    onOpenChange(false);
  }, [onConfirm, onOpenChange]);

  const handleCancel = useCallback(() => {
    onCancel?.();
    onOpenChange(false);
  }, [onCancel, onOpenChange]);

  const isDestructive = variant === "destructive";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        width="sm"
        animateLifecycle
        showCloseButton={false}
        closeOnBackdropClick={false}
      >
        {/* 标题区域 */}
        <div className="text-center mb-4">
          <h3
            className="text-lg font-semibold mb-2"
            style={{ color: color("textPrimary") }}
          >
            {title}
          </h3>
          {description && (
            <p className="text-sm" style={{ color: color("textMuted") }}>
              {description}
            </p>
          )}
        </div>

        {/* 按钮区域 */}
        <div className="flex justify-center gap-3 mt-6">
          <button
            onClick={handleCancel}
            className={cn(
              "px-4 py-2 rounded-md text-sm font-medium",
              "border transition-all duration-200",
            )}
            style={{
              background: colorAlpha("bgCard", 0.6),
              borderColor: colorAlpha("border", 0.4),
              color: color("textSecondary"),
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = colorAlpha("bgCard", 0.9);
              e.currentTarget.style.borderColor = colorAlpha("border", 0.6);
              e.currentTarget.style.color = color("textPrimary");
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = colorAlpha("bgCard", 0.6);
              e.currentTarget.style.borderColor = colorAlpha("border", 0.4);
              e.currentTarget.style.color = color("textSecondary");
            }}
          >
            {cancelText}
          </button>
          <button
            onClick={handleConfirm}
            className={cn(
              "px-4 py-2 rounded-md text-sm font-medium",
              "border-2 transition-all duration-200",
            )}
            style={{
              background: isDestructive
                ? colorAlpha("error", 0.15)
                : `linear-gradient(135deg, ${color("primary")} 0%, ${color(
                    "secondary",
                  )} 100%)`,
              borderColor: isDestructive
                ? colorAlpha("error", 0.5)
                : color("primaryLight"),
              color: isDestructive ? color("error") : color("bgBase"),
              boxShadow: isDestructive
                ? `0 0 12px ${colorAlpha("error", 0.3)}`
                : glow("primary", "sm", 0.4),
            }}
            onMouseEnter={(e) => {
              if (isDestructive) {
                e.currentTarget.style.background = colorAlpha("error", 0.25);
                e.currentTarget.style.boxShadow = `0 0 18px ${colorAlpha(
                  "error",
                  0.5,
                )}`;
              } else {
                e.currentTarget.style.transform = "scale(1.02)";
                e.currentTarget.style.boxShadow = glow("primary", "md", 0.6);
              }
            }}
            onMouseLeave={(e) => {
              if (isDestructive) {
                e.currentTarget.style.background = colorAlpha("error", 0.15);
                e.currentTarget.style.boxShadow = `0 0 12px ${colorAlpha(
                  "error",
                  0.3,
                )}`;
              } else {
                e.currentTarget.style.transform = "scale(1)";
                e.currentTarget.style.boxShadow = glow("primary", "sm", 0.4);
              }
            }}
          >
            {confirmText}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
