import { TITLE_CONFIG } from "@/config/splash";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * 视差层配置
 */
interface ParallaxLayerConfig {
  /** 层级深度（0-1，0最近移动最快，1最远移动最慢） */
  depth: number;
  /** 子元素 */
  children: React.ReactNode;
  /** 可选的额外类名 */
  className?: string;
}

interface ParallaxContainerProps {
  /** 视差层配置数组 */
  layers: ParallaxLayerConfig[];
  /** 最大位移量（像素），默认 30 */
  maxOffset?: number;
  /** 平滑系数（0-1，越小越平滑），默认 0.08 */
  smoothing?: number;
  /** 是否启用视差效果，默认 true */
  enabled?: boolean;
  /** 容器类名 */
  className?: string;
}

/**
 * 视差效果容器组件
 *
 * 监听鼠标移动，根据各层的 depth 值计算不同的位移量，
 * 创造深度感和沉浸感。
 *
 * depth 值说明：
 * - depth = 0: 前景层，移动幅度最大（与鼠标反向移动）
 * - depth = 1: 背景层，完全不移动（固定）
 * - 中间值：按比例插值
 *
 * Phase 3: 标题屏幕背景重新设计
 *
 * @example
 * ```tsx
 * <ParallaxContainer
 *   maxOffset={30}
 *   smoothing={0.08}
 *   layers={[
 *     { depth: 0.9, children: <MatrixRain /> },      // 背景层，移动很慢
 *     { depth: 0.5, children: <DiagonalBanners /> }, // 中间层，移动适中
 *     { depth: 0.2, children: <DecorativeText /> },  // 前景层，移动较快
 *     { depth: 0, children: <Logo /> },              // UI层，移动最快（或设为固定）
 *   ]}
 * />
 * ```
 */
export function ParallaxContainer({
  layers,
  maxOffset = TITLE_CONFIG.parallax?.maxOffset ?? 30,
  smoothing = TITLE_CONFIG.parallax?.smoothing ?? 0.08,
  enabled = TITLE_CONFIG.parallax?.enabled ?? true,
  className = "",
}: ParallaxContainerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  // 平滑后的鼠标位置（范围 -1 到 1）
  const [smoothedPosition, setSmoothedPosition] = useState({ x: 0, y: 0 });

  // 目标鼠标位置
  const targetPosition = useRef({ x: 0, y: 0 });

  // 动画帧 ID
  const animationFrameId = useRef<number | null>(null);

  // 处理鼠标移动
  const handleMouseMove = useCallback(
    (event: MouseEvent) => {
      if (!enabled) return;

      // 计算鼠标相对于屏幕中心的偏移（范围 -1 到 1）
      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;

      const nextX = (event.clientX - centerX) / centerX;
      const nextY = (event.clientY - centerY) / centerY;

      targetPosition.current = {
        x: nextX,
        y: nextY,
      };
    },
    [enabled]
  );

  // 处理鼠标离开窗口
  const handleMouseLeave = useCallback(() => {
    // 鼠标离开时，缓慢回到中心位置
    targetPosition.current = { x: 0, y: 0 };
  }, []);

  // 平滑动画循环
  useEffect(() => {
    if (!enabled) {
      setSmoothedPosition({ x: 0, y: 0 });
      return;
    }

    // 使用 ref 存储当前位置，避免闭包问题
    const currentPosition = { x: 0, y: 0 };

    const animate = () => {
      // 使用线性插值实现平滑过渡
      currentPosition.x +=
        (targetPosition.current.x - currentPosition.x) * smoothing;
      currentPosition.y +=
        (targetPosition.current.y - currentPosition.y) * smoothing;

      // 更新状态
      setSmoothedPosition({
        x: currentPosition.x,
        y: currentPosition.y,
      });

      animationFrameId.current = requestAnimationFrame(animate);
    };

    animationFrameId.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [enabled, smoothing]);

  // 添加/移除事件监听器
  useEffect(() => {
    if (!enabled) return;

    window.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [enabled, handleMouseMove, handleMouseLeave]);

  return (
    <div
      ref={containerRef}
      className={`fixed inset-0 overflow-hidden ${className}`}
    >
      {layers.map((layer, index) => (
        <ParallaxLayer
          key={index}
          depth={layer.depth}
          maxOffset={maxOffset}
          mouseX={smoothedPosition.x}
          mouseY={smoothedPosition.y}
          className={layer.className}
        >
          {layer.children}
        </ParallaxLayer>
      ))}
    </div>
  );
}

/**
 * 单个视差层
 */
interface ParallaxLayerProps {
  depth: number;
  maxOffset: number;
  mouseX: number;
  mouseY: number;
  children: React.ReactNode;
  className?: string;
}

function ParallaxLayer({
  depth,
  maxOffset,
  mouseX,
  mouseY,
  children,
  className = "",
}: ParallaxLayerProps) {
  // depth 为 1 时不移动（背景固定），depth 为 0 时移动最大
  // 实际位移 = maxOffset * (1 - depth) * mousePosition * -1
  // 乘以 -1 是为了让元素与鼠标反向移动，产生视差效果
  const offsetMultiplier = 1 - depth;

  // 计算实际位移（像素）
  const translateX = mouseX * offsetMultiplier * maxOffset * -1;
  const translateY = mouseY * offsetMultiplier * maxOffset * -1;

  if (!Number.isFinite(translateX) || !Number.isFinite(translateY)) {
    console.warn("[ParallaxLayer] invalid translate", {
      translateX,
      translateY,
      mouseX,
      mouseY,
      depth,
      maxOffset,
    });
  }

  // 对于 UI 层（depth = 1），使用更高的 zIndex
  // 其他层按深度排序：depth 越小（越近），zIndex 越高
  const zIndex = depth === 1 ? 100 : Math.round((1 - depth) * 10);

  return (
    <div
      data-depth={depth}
      className={`absolute inset-0 ${className}`}
      style={{
        // 使用 translate3d 启用 GPU 加速
        transform:
          depth === 1
            ? undefined // UI 层不需要 transform
            : `translate3d(${translateX}px, ${translateY}px, 0)`,
        // 确保层级正确
        zIndex,
        // 提示浏览器优化（UI 层不需要）
        willChange: depth < 1 ? "transform" : undefined,
      }}
    >
      {children}
    </div>
  );
}

// 导出类型供外部使用
export type { ParallaxLayerConfig };
