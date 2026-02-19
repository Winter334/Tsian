import { cn } from "@/lib/utils";
import { forwardRef, type HTMLAttributes } from "react";

/**
 * ScrollArea 组件属性
 */
export interface ScrollAreaProps extends HTMLAttributes<HTMLDivElement> {
  /** 最大高度 */
  maxHeight?: string | number;
}

/**
 * ScrollArea 组件 - 简化版滚动容器
 *
 * 后续可以替换为 Radix UI ScrollArea 以获得更好的跨浏览器体验
 */
export const ScrollArea = forwardRef<HTMLDivElement, ScrollAreaProps>(
  function ScrollArea(
    { className, maxHeight, style, children, ...props },
    ref
  ) {
    return (
      <div
        className={cn(
          "relative overflow-auto",
          "scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent",
          className
        )}
        style={{
          maxHeight:
            typeof maxHeight === "number" ? `${maxHeight}px` : maxHeight,
          ...style,
        }}
        ref={ref}
        {...props}
      >
        {children}
      </div>
    );
  }
);
