/**
 * 设置分类卡片组件
 * 用于设置中心的卡片网格布局
 * 使用 Card 组件实现统一的视觉风格
 */

import { Card } from "@/components/ui";
import { cn } from "@/lib/utils";
import { color, colorAlpha } from "@/styles/tokens";
import type { ReactNode } from "react";

export interface SettingsCardProps {
  /** 图标 */
  icon: ReactNode;
  /** 标题 */
  title: string;
  /** 描述 */
  description: string;
  /** 点击回调 */
  onClick?: () => void;
  /** 是否禁用 */
  disabled?: boolean;
  /** 禁用时的提示文字 */
  disabledText?: string;
}

export function SettingsCard({
  icon,
  title,
  description,
  onClick,
  disabled = false,
  disabledText,
}: SettingsCardProps) {
  // 禁用状态使用 outlined 变体，正常状态使用 default 变体
  const variant = disabled ? "outlined" : "default";

  return (
    <div className="relative">
      <Card
        variant={variant}
        hover={!disabled}
        glowOnHover={!disabled}
        onClick={disabled ? undefined : onClick}
        className={cn(
          "flex flex-col items-start p-4 text-left w-full h-full",
          disabled && "cursor-not-allowed opacity-60"
        )}
      >
        {/* 图标 */}
        <div
          className="text-2xl mb-3"
          style={{ color: disabled ? color("textMuted") : color("primary") }}
        >
          {icon}
        </div>

        {/* 标题 */}
        <h3
          className="text-base font-semibold mb-1"
          style={{
            color: disabled ? color("textMuted") : color("textPrimary"),
          }}
        >
          {title}
        </h3>

        {/* 描述 */}
        <p
          className="text-sm"
          style={{
            color: disabled ? color("textMuted") : color("textSecondary"),
          }}
        >
          {description}
        </p>
      </Card>

      {/* 禁用提示 - 放在 Card 外部以确保正确定位 */}
      {disabled && disabledText && (
        <span
          className="absolute top-2 right-2 text-xs px-2 py-0.5 rounded z-10"
          style={{
            background: colorAlpha("warning", 0.2),
            color: color("warning"),
            border: `1px solid ${colorAlpha("warning", 0.3)}`,
          }}
        >
          {disabledText}
        </span>
      )}
    </div>
  );
}
