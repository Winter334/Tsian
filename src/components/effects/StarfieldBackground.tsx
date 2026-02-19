/**
 * 星空背景组件
 * 使用 Canvas 2D 实现静谧的星空效果
 *
 * 参照 examples/scrolling-terrain-and-shooting-stars 实现
 * 特点：
 * - 简洁的方形星星（fillRect）
 * - 流畅的流星效果（带尾迹线条）
 * - 响应式星星数量
 * - 支持透明背景模式（用于弹窗叠加）
 */

import {
  getStarCount,
  shouldEnableShootingStar,
  STARFIELD_CONFIG,
} from "@/config/effects";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * 星星类
 */
class Star {
  x: number;
  y: number;
  size: number;
  speed: number;
  opacity: number;

  constructor(width: number, height: number) {
    this.size = Math.random() * 2;
    this.speed = Math.random() * 0.05;
    this.x = Math.random() * width;
    this.y = Math.random() * height;
    this.opacity = Math.random() * 0.5 + 0.3; // 0.3-0.8 透明度
  }

  reset(width: number, height: number) {
    this.size = Math.random() * 2;
    this.speed = Math.random() * 0.05;
    this.x = width;
    this.y = Math.random() * height;
    this.opacity = Math.random() * 0.5 + 0.3;
  }

  update(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    color: string
  ) {
    this.x -= this.speed;
    if (this.x < 0) {
      this.reset(width, height);
    } else {
      ctx.globalAlpha = this.opacity;
      ctx.fillStyle = color;
      ctx.fillRect(this.x, this.y, this.size, this.size);
      ctx.globalAlpha = 1;
    }
  }
}

/**
 * 流星类
 */
class ShootingStar {
  x: number = 0;
  y: number = 0;
  len: number = 0;
  speed: number = 0;
  size: number = 0;
  waitTime: number = 0;
  active: boolean = false;

  constructor(width: number, height: number) {
    this.reset(width, height);
  }

  reset(width: number, _height: number) {
    this.x = Math.random() * width;
    this.y = 0;
    this.len = Math.random() * 80 + 10;
    this.speed = Math.random() * 10 + 6;
    this.size = Math.random() * 1 + 0.1;
    // 流星不是持续出现的，有等待时间
    this.waitTime = Date.now() + Math.random() * 3000 + 500;
    this.active = false;
  }

  update(ctx: CanvasRenderingContext2D, width: number, height: number) {
    if (this.active) {
      this.x -= this.speed;
      this.y += this.speed;
      if (this.x < 0 || this.y >= height) {
        this.reset(width, height);
      } else {
        ctx.lineWidth = this.size;
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(this.x + this.len, this.y - this.len);
        ctx.stroke();
      }
    } else {
      if (this.waitTime < Date.now()) {
        this.active = true;
      }
    }
  }
}

interface StarfieldBackgroundProps {
  /** 自定义类名 */
  className?: string;
  /** 是否启用流星 (默认根据容器尺寸自动判断) */
  enableShootingStar?: boolean;
  /** 是否使用透明背景 (用于弹窗叠加) */
  transparentBackground?: boolean;
  /** 是否使用主题色 (青色系) 替代白色 */
  useThemeColors?: boolean;
}

export function StarfieldBackground({
  className,
  enableShootingStar: enableShootingStarProp,
  transparentBackground = false,
  useThemeColors = false,
}: StarfieldBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const starsRef = useRef<Star[]>([]);
  const shootingStarsRef = useRef<ShootingStar[]>([]);
  const animationFrameRef = useRef<number>(0);

  // 响应式尺寸
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // 是否启用流星
  const enableShootingStar =
    enableShootingStarProp ??
    shouldEnableShootingStar(dimensions.width, dimensions.height);

  /**
   * 初始化星星和流星
   */
  const initEntities = useCallback(
    (width: number, height: number) => {
      const count = getStarCount(width);

      // 初始化星星
      starsRef.current = Array.from(
        { length: count },
        () => new Star(width, height)
      );

      // 初始化流星（2颗循环使用）
      if (enableShootingStar) {
        shootingStarsRef.current = [
          new ShootingStar(width, height),
          new ShootingStar(width, height),
        ];
      } else {
        shootingStarsRef.current = [];
      }
    },
    [enableShootingStar]
  );

  /**
   * 动画循环
   */
  const animate = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");

    if (!canvas || !ctx) {
      animationFrameRef.current = requestAnimationFrame(animate);
      return;
    }

    const width = canvas.width;
    const height = canvas.height;

    // 根据模式选择背景处理方式
    if (transparentBackground) {
      // 透明模式：清除画布
      ctx.clearRect(0, 0, width, height);
    } else {
      // 不透明模式：填充深色背景
      ctx.fillStyle = STARFIELD_CONFIG.colors.background;
      ctx.fillRect(0, 0, width, height);
    }

    // 根据配置选择颜色
    const starColor = useThemeColors
      ? STARFIELD_CONFIG.colors.primary
      : STARFIELD_CONFIG.colors.white;
    const shootingStarColor = useThemeColors
      ? STARFIELD_CONFIG.colors.secondary
      : STARFIELD_CONFIG.colors.white;

    // 更新并绘制所有星星
    const stars = starsRef.current;
    for (let i = stars.length - 1; i >= 0; i--) {
      stars[i].update(ctx, width, height, starColor);
    }

    // 设置流星颜色并绘制
    ctx.strokeStyle = shootingStarColor;
    const shootingStars = shootingStarsRef.current;
    for (let i = shootingStars.length - 1; i >= 0; i--) {
      shootingStars[i].update(ctx, width, height);
    }

    animationFrameRef.current = requestAnimationFrame(animate);
  }, [transparentBackground, useThemeColors]);

  /**
   * 处理尺寸变化
   */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const updateSize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;

      const { width, height } = parent.getBoundingClientRect();

      // 设置 canvas 尺寸
      canvas.width = width;
      canvas.height = height;

      setDimensions({ width, height });

      // 重新初始化实体
      initEntities(width, height);
    };

    updateSize();

    const resizeObserver = new ResizeObserver(updateSize);
    if (canvas.parentElement) {
      resizeObserver.observe(canvas.parentElement);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [initEntities]);

  /**
   * 启动动画
   */
  useEffect(() => {
    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [animate]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
      }}
      aria-hidden="true"
    />
  );
}
