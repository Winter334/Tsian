import { cn } from "@/lib/utils";
import { color, colorAlpha, glow } from "@/styles/tokens";
import { forwardRef, type TextareaHTMLAttributes, useState } from "react";

/**
 * Textarea 组件属性
 */
export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

/**
 * Textarea 组件
 * 增强风格：更大尺寸、更明显边框、强发光效果
 */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ className, onFocus, onBlur, ...props }, ref) {
    const [isFocused, setIsFocused] = useState(false);

    return (
      <textarea
        className={cn(
          // 基础样式 - 增大尺寸
          "flex min-h-30 w-full rounded-lg px-4 py-3 text-sm font-medium",
          // 边框增强
          "border-2",
          // 过渡效果
          "transition-all duration-200",
          // 占位符
          "placeholder:opacity-50",
          // 禁用状态
          "disabled:cursor-not-allowed disabled:opacity-50",
          // 焦点效果
          "focus-visible:outline-none",
          className
        )}
        style={{
          color: color("textSecondary"),
          background: colorAlpha("bgCard", 0.5),
          borderColor: isFocused
            ? colorAlpha("primary", 0.7)
            : colorAlpha("primary", 0.5),
          boxShadow: isFocused
            ? `${glow("primary", "md", 0.5)}, 0 0 20px ${colorAlpha(
                "primary",
                0.3
              )}`
            : "none",
        }}
        onFocus={(e) => {
          setIsFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setIsFocused(false);
          onBlur?.(e);
        }}
        onMouseEnter={(e) => {
          if (!isFocused) {
            (e.currentTarget as HTMLTextAreaElement).style.borderColor =
              colorAlpha("primary", 0.7);
            (
              e.currentTarget as HTMLTextAreaElement
            ).style.boxShadow = `0 0 12px ${colorAlpha("primary", 0.3)}`;
          }
        }}
        onMouseLeave={(e) => {
          if (!isFocused) {
            (e.currentTarget as HTMLTextAreaElement).style.borderColor =
              colorAlpha("primary", 0.5);
            (e.currentTarget as HTMLTextAreaElement).style.boxShadow = "none";
          }
        }}
        ref={ref}
        {...props}
      />
    );
  }
);
