import { cn } from "@/lib/utils";
import {
  animation,
  borders,
  color,
  colorAlpha,
  gradients,
  shadows,
} from "@/styles/tokens";
import {
  forwardRef,
  useMemo,
  useState,
  type ButtonHTMLAttributes,
} from "react";

/**
 * Button 变体类型
 */
export type ButtonVariant =
  | "default"
  | "destructive"
  | "outline"
  | "secondary"
  | "ghost"
  | "link";

/**
 * Button 尺寸类型
 */
export type ButtonSize = "default" | "sm" | "lg" | "icon";

/**
 * Button 组件属性
 */
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

/**
 * 获取变体样式（使用 Token 系统）
 */
function getVariantStyles(
  variant: ButtonVariant,
  isHovered: boolean
): {
  className: string;
  style: React.CSSProperties;
} {
  switch (variant) {
    case "default":
      return {
        className: cn(
          "text-black font-semibold border-2", // medium → semibold
          "active:scale-[0.98]",
          "animate-glow-pulse", // 添加脉动动画
          `transition-all duration-[${animation.duration.fast * 1000}ms]`
        ),
        style: {
          background: isHovered
            ? gradients.primaryHover()
            : gradients.primary(),
          borderColor: color("primaryLight"),
          boxShadow: isHovered ? shadows.pulse() : shadows.button(), // 悬停时使用强烈发光
          transform: isHovered ? `scale(${animation.hover.scale})` : "scale(1)",
        },
      };

    case "destructive":
      return {
        className: "",
        style: {
          background: color("error"),
          color: color("textPrimary"),
          opacity: isHovered ? 0.9 : 1,
        },
      };

    case "outline":
      return {
        className: cn(
          "border-2 font-medium",
          "active:scale-[0.98]",
          "hover-glow", // 使用全局悬停发光类
          `transition-all duration-[${animation.duration.instant * 1000}ms]`
        ),
        style: {
          background: isHovered ? gradients.subtleHover() : "transparent", // subtle() → transparent
          color: isHovered ? color("textPrimary") : color("textSecondary"), // textMuted → textSecondary (更亮)
          borderColor: isHovered
            ? color("primaryLight")
            : colorAlpha("primary", 0.5), // 0.4 → 0.5 (更明显)
          boxShadow: isHovered
            ? shadows.cardHover() // 使用增强的发光效果
            : `0 0 15px ${colorAlpha("primary", 0.3)}`, // 0.2 → 0.3
          transform: isHovered ? `scale(${animation.hover.scale})` : "scale(1)",
        },
      };

    case "secondary":
      return {
        className: cn(
          "border",
          `transition-all duration-[${animation.duration.fast * 1000}ms]`
        ),
        style: {
          background: isHovered
            ? colorAlpha("primary", 0.25)
            : colorAlpha("primary", 0.15),
          color: color("textMuted"),
          borderColor: isHovered
            ? colorAlpha("primary", 0.4)
            : colorAlpha("primary", 0.25),
          boxShadow: isHovered
            ? `0 0 15px ${colorAlpha("primary", 0.3)}`
            : "none",
        },
      };

    case "ghost":
      return {
        className: `font-medium transition-all duration-[${
          animation.duration.fast * 1000
        }ms]`,
        style: {
          color: isHovered ? color("textSecondary") : color("textMuted"),
          background: isHovered ? colorAlpha("primary", 0.15) : "transparent", // 0.1 → 0.15
          boxShadow: isHovered
            ? `0 0 12px ${colorAlpha("primary", 0.3)}`
            : "none",
        },
      };

    case "link":
      return {
        className: "underline-offset-4 hover:underline",
        style: {
          color: isHovered ? color("primary") : color("primaryLight"),
        },
      };
  }
}

/**
 * 尺寸样式映射 - 增大尺寸以匹配示例风格
 */
const sizeStyles: Record<ButtonSize, string> = {
  default: "h-12 px-6 py-3", // 从 h-10 px-4 py-2 增大
  sm: "h-10 px-4",
  lg: "h-14 px-10", // 从 h-11 px-8 增大
  icon: "h-12 w-12", // 从 h-10 w-10 增大
};

/**
 * Button 组件 - 支持主题切换
 * 使用 Token 系统实现样式，切换主题时自动更新
 * 悬浮效果与 MenuButton 保持一致
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      className,
      variant = "default",
      size = "default",
      style,
      onMouseEnter,
      onMouseLeave,
      disabled,
      ...props
    },
    ref
  ) {
    const [isHovered, setIsHovered] = useState(false);
    const variantStyles = useMemo(
      () => getVariantStyles(variant, isHovered && !disabled),
      [variant, isHovered, disabled]
    );

    const handleMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
      setIsHovered(true);
      onMouseEnter?.(e);
    };

    const handleMouseLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
      setIsHovered(false);
      onMouseLeave?.(e);
    };

    return (
      <button
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap text-sm font-medium",
          "focus:outline-none focus:ring-2",
          "disabled:pointer-events-none disabled:opacity-50",
          sizeStyles[size],
          variantStyles.className,
          className
        )}
        style={
          {
            ...variantStyles.style,
            // 圆角样式（与其他组件统一）
            borderRadius: borders.radius.md,
            // 焦点环颜色
            "--tw-ring-color": colorAlpha("primary", 0.5),
            ...style,
          } as React.CSSProperties
        }
        ref={ref}
        disabled={disabled}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        {...props}
      />
    );
  }
);
