/**
 * Select 下拉选择组件
 * 增强风格：使用 Token 系统 + 强发光效果
 */

import { cn } from "@/lib/utils";
import { borders, color, colorAlpha, glow } from "@/styles/tokens";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, Loader2 } from "lucide-react";
import { useCallback, useRef, useState } from "react";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

type SelectSize = "default" | "sm";

interface SelectProps {
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  loading?: boolean;
  size?: SelectSize;
  className?: string;
  triggerClassName?: string;
}

export function Select({
  value,
  onValueChange,
  options,
  placeholder = "请选择...",
  disabled = false,
  loading = false,
  size = "default",
  className,
  triggerClassName,
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  const sizeClasses: Record<SelectSize, string> = {
    default: "h-12 px-4 py-3",
    sm: "h-9 px-3 py-1.5",
  };

  const handleSelect = useCallback(
    (optionValue: string) => {
      onValueChange(optionValue);
      setOpen(false);
    },
    [onValueChange],
  );

  // 点击外部关闭
  const handleBlur = useCallback((_e: React.FocusEvent) => {
    // 延迟关闭，让点击事件能够触发
    setTimeout(() => {
      if (!triggerRef.current?.contains(document.activeElement)) {
        setOpen(false);
      }
    }, 100);
  }, []);

  return (
    <div className={cn("relative", className)}>
      {/* 触发按钮 - 增强风格 */}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled || loading}
        onClick={() => setOpen(!open)}
        onBlur={handleBlur}
        className={cn(
          "flex items-center justify-between w-full",
          sizeClasses[size],
          "rounded-lg border-2",
          "text-sm font-medium",
          "transition-all duration-200",
          "focus:outline-none",
          disabled && "opacity-50 cursor-not-allowed",
          triggerClassName,
        )}
        style={{
          background: colorAlpha("bgCard", 0.5),
          borderColor: open
            ? colorAlpha("primary", 0.7)
            : colorAlpha("primary", 0.5),
          color: selectedOption ? color("textSecondary") : color("textMuted"),
          boxShadow: open
            ? `${glow("primary", "md", 0.5)}, 0 0 20px ${colorAlpha(
                "primary",
                0.3,
              )}`
            : "none",
        }}
        onMouseEnter={(e) => {
          if (!disabled && !open) {
            e.currentTarget.style.borderColor = colorAlpha("primary", 0.7);
            e.currentTarget.style.boxShadow = `0 0 12px ${colorAlpha(
              "primary",
              0.3,
            )}`;
          }
        }}
        onMouseLeave={(e) => {
          if (!disabled && !open) {
            e.currentTarget.style.borderColor = colorAlpha("primary", 0.5);
            e.currentTarget.style.boxShadow = "none";
          }
        }}
      >
        <span className="min-w-0 truncate">
          {loading ? "加载中..." : selectedOption?.label || placeholder}
        </span>
        {loading ? (
          <Loader2
            className="w-4 h-4 ml-2 animate-spin"
            style={{ color: color("primary") }}
          />
        ) : (
          <ChevronDown
            className={cn(
              "w-4 h-4 ml-2 transition-transform duration-200",
              open && "rotate-180",
            )}
            style={{ color: color("primary") }}
          />
        )}
      </button>

      {/* 下拉菜单 - 增强风格 */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -10, scaleY: 0.95 }}
            animate={{ opacity: 1, y: 0, scaleY: 1 }}
            exit={{ opacity: 0, y: -10, scaleY: 0.95 }}
            transition={{ duration: 0.15 }}
            className={cn(
              "absolute z-50 w-full mt-2 origin-top",
              "border-2 rounded-lg",
              "max-h-60 overflow-auto",
              "scrollbar-thin",
            )}
            style={{
              background: colorAlpha("bgCard", 0.95),
              borderColor: colorAlpha("primary", 0.5),
              boxShadow: `${glow(
                "primary",
                "lg",
                0.4,
              )}, 0 10px 40px ${colorAlpha("bgCard", 0.5)}`,
              backdropFilter: "blur(10px)",
              borderRadius: borders.radius.lg,
            }}
          >
            {options.length === 0 ? (
              <div
                className="px-4 py-3 text-sm"
                style={{ color: color("textMuted") }}
              >
                无可用选项
              </div>
            ) : (
              options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  disabled={option.disabled}
                  onClick={() => handleSelect(option.value)}
                  className={cn(
                    "flex items-center justify-between w-full px-4 py-3",
                    "text-sm font-medium text-left transition-all duration-150",
                    option.disabled && "cursor-not-allowed",
                  )}
                  style={{
                    color: option.disabled
                      ? color("textMuted")
                      : value === option.value
                        ? color("primary")
                        : color("textSecondary"),
                    background:
                      value === option.value
                        ? colorAlpha("primary", 0.15)
                        : "transparent",
                  }}
                  onMouseEnter={(e) => {
                    if (!option.disabled && value !== option.value) {
                      e.currentTarget.style.background = colorAlpha(
                        "primary",
                        0.1,
                      );
                      e.currentTarget.style.color = color("textPrimary");
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!option.disabled && value !== option.value) {
                      e.currentTarget.style.background = "transparent";
                      e.currentTarget.style.color = color("textSecondary");
                    }
                  }}
                >
                  <span>{option.label}</span>
                  {value === option.value && (
                    <Check
                      className="w-4 h-4"
                      style={{ color: color("primary") }}
                    />
                  )}
                </button>
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
