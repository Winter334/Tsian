import { cn } from "@/lib/utils";
import { animation, borders, color, colorAlpha, glow } from "@/styles/tokens";
import { forwardRef, type InputHTMLAttributes } from "react";

/**
 * Input 组件属性
 */
export type InputProps = InputHTMLAttributes<HTMLInputElement>;

/**
 * Input 组件 - 支持主题切换
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, type, ...props },
  ref
) {
  return (
    <input
      type={type}
      className={cn(
        "flex h-12 w-full px-4 py-3 text-sm font-medium",
        "rounded-lg",
        "border-2",
        `transition-all duration-[${animation.duration.fast * 1000}ms]`,
        "focus:outline-none",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "placeholder:text-sm placeholder:font-normal",
        // 隐藏 number 输入框的原生加减按钮
        "[appearance:textfield]",
        "[&::-webkit-outer-spin-button]:appearance-none",
        "[&::-webkit-inner-spin-button]:appearance-none",
        className
      )}
      style={{
        color: color("textSecondary"),
        background: colorAlpha("bgCard", 0.5),
        borderColor: colorAlpha("primary", 0.5),
        borderRadius: borders.radius.md,
      }}
      onFocus={(e) => {
        e.currentTarget.style.borderColor = color("primaryLight");
        e.currentTarget.style.boxShadow = `${glow(
          "primary",
          "md",
          0.5
        )}, 0 0 8px ${colorAlpha("primary", 0.4)}`;
        e.currentTarget.style.background = colorAlpha("bgCard", 0.8);
        props.onFocus?.(e);
      }}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = colorAlpha("primary", 0.5);
        e.currentTarget.style.boxShadow = "none";
        e.currentTarget.style.background = colorAlpha("bgCard", 0.5);
        props.onBlur?.(e);
      }}
      onMouseEnter={(e) => {
        if (document.activeElement !== e.currentTarget) {
          e.currentTarget.style.borderColor = colorAlpha("primary", 0.7);
          e.currentTarget.style.boxShadow = `0 0 12px ${colorAlpha(
            "primary",
            0.3
          )}`;
        }
      }}
      onMouseLeave={(e) => {
        if (document.activeElement !== e.currentTarget) {
          e.currentTarget.style.borderColor = colorAlpha("primary", 0.5);
          e.currentTarget.style.boxShadow = "none";
        }
      }}
      ref={ref}
      {...props}
    />
  );
});
