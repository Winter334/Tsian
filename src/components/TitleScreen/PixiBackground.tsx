/**
 * PixiJS 标题画面背景组件
 *
 * 当前职责：
 * - 仅渲染静态网格（低开销）
 * - 保持透明画布，供其他背景层叠加
 *
 * 说明：
 * - 已移除旧 InteractiveGrid（逐帧高亮重绘）逻辑
 * - 鼠标交互效果由独立的 MouseEffect 组件提供
 */
import { TITLE_CONFIG } from "@/config/splash";
import { Application, Container, Graphics } from "@/lib/pixi";
import { useCallback, useEffect, useRef } from "react";

interface PixiBackgroundProps {
  /** 组件就绪回调 */
  onReady?: () => void;
}

/**
 * 静态网格
 */
class StaticGrid {
  private container: Container;
  private graphics: Graphics;
  private screenWidth: number;
  private screenHeight: number;

  constructor(parentContainer: Container, width: number, height: number) {
    this.screenWidth = width;
    this.screenHeight = height;

    this.container = new Container();
    parentContainer.addChild(this.container);

    this.graphics = new Graphics();
    this.container.addChild(this.graphics);

    this.draw();
  }

  private draw(): void {
    const config = TITLE_CONFIG.staticGrid;

    this.graphics.clear();
    this.graphics.lineStyle(config.lineWidth, config.color, config.baseAlpha);

    for (let x = 0; x <= this.screenWidth; x += config.spacing) {
      this.graphics.moveTo(x, 0);
      this.graphics.lineTo(x, this.screenHeight);
    }

    for (let y = 0; y <= this.screenHeight; y += config.spacing) {
      this.graphics.moveTo(0, y);
      this.graphics.lineTo(this.screenWidth, y);
    }
  }

  resize(width: number, height: number): void {
    this.screenWidth = width;
    this.screenHeight = height;
    this.draw();
  }

  destroy(): void {
    this.container.destroy({ children: true });
  }
}

export function PixiBackground({ onReady }: PixiBackgroundProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const gridRef = useRef<StaticGrid | null>(null);
  const isInitializedRef = useRef(false);

  const cleanup = useCallback(() => {
    if (gridRef.current) {
      gridRef.current.destroy();
      gridRef.current = null;
    }

    if (appRef.current) {
      appRef.current.destroy(true, { children: true, texture: true });
      appRef.current = null;
    }

    isInitializedRef.current = false;
  }, []);

  const initApp = useCallback(() => {
    if (!containerRef.current || appRef.current || isInitializedRef.current) {
      return;
    }

    isInitializedRef.current = true;

    const width = window.innerWidth;
    const height = window.innerHeight;

    const app = new Application({
      width,
      height,
      backgroundAlpha: 0,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });

    containerRef.current.appendChild(app.view as HTMLCanvasElement);
    appRef.current = app;

    const backgroundLayer = new Container();
    const gridLayer = new Container();
    app.stage.addChild(backgroundLayer);
    app.stage.addChild(gridLayer);

    const background = new Graphics();
    background.beginFill(0x000000, 0);
    background.drawRect(0, 0, width, height);
    background.endFill();
    backgroundLayer.addChild(background);

    gridRef.current = new StaticGrid(gridLayer, width, height);

    onReady?.();
  }, [onReady]);

  useEffect(() => {
    initApp();

    return () => {
      cleanup();
    };
  }, [cleanup, initApp]);

  useEffect(() => {
    const handleResize = () => {
      if (!appRef.current) {
        return;
      }

      const width = window.innerWidth;
      const height = window.innerHeight;

      appRef.current.renderer.resize(width, height);

      const backgroundLayer = appRef.current.stage.children[0] as
        | Container
        | undefined;

      if (
        backgroundLayer &&
        "children" in backgroundLayer &&
        backgroundLayer.children.length > 0
      ) {
        const bg = backgroundLayer.children[0] as Graphics | undefined;
        if (bg && "clear" in bg) {
          bg.clear();
          bg.beginFill(0x000000, 0);
          bg.drawRect(0, 0, width, height);
          bg.endFill();
        }
      }

      if (gridRef.current) {
        gridRef.current.resize(width, height);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-1 pointer-events-none"
      style={{ width: "100vw", height: "100vh" }}
    />
  );
}
