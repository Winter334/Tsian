import { SPLASH_COLORS } from "@/config/splash";
import { Application, Container, Graphics } from "@/lib/pixi";
import { useEffect, useRef } from "react";

import { FilterManager } from "@/components/SplashScreen/FilterManager";
import { SignalLockRenderer } from "@/components/SplashScreen/renderers/SignalLockRenderer";
import type {
  SplashCanvasContext,
  SplashPhase,
} from "@/components/SplashScreen/types";

interface SplashCanvasProps {
  phase: SplashPhase;
  onIntroComplete?: () => void;
  onReady?: () => void;
}

function getContainerSize(container: HTMLDivElement): {
  width: number;
  height: number;
} {
  const width = Math.max(1, container.clientWidth || window.innerWidth);
  const height = Math.max(1, container.clientHeight || window.innerHeight);
  return { width, height };
}

export function SplashCanvas({
  phase,
  onIntroComplete,
  onReady,
}: SplashCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const appRef = useRef<Application | null>(null);
  const contextRef = useRef<SplashCanvasContext | null>(null);
  const filterManagerRef = useRef<FilterManager | null>(null);
  const signalLockRendererRef = useRef<SignalLockRenderer | null>(null);
  const backgroundRef = useRef<Graphics | null>(null);
  const noiseSurfaceRef = useRef<Graphics | null>(null);
  const animationRef = useRef<number>(0);

  const phaseRef = useRef<SplashPhase>(phase);
  const isIntroActiveRef = useRef(false);
  const introStartTimeRef = useRef(0);
  const lastFrameTimeRef = useRef(0);

  const onIntroCompleteRef = useRef(onIntroComplete);
  const onReadyRef = useRef(onReady);

  useEffect(() => {
    onIntroCompleteRef.current = onIntroComplete;
    onReadyRef.current = onReady;
  }, [onIntroComplete, onReady]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const { width, height } = getContainerSize(container);

    const app = new Application({
      width,
      height,
      backgroundAlpha: 0,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });
    app.stop();

    container.appendChild(app.view as HTMLCanvasElement);
    appRef.current = app;

    const backgroundLayer = new Container();
    const noiseLayer = new Container();
    const contentLayer = new Container();
    const uiLayer = new Container();

    app.stage.addChild(backgroundLayer);
    app.stage.addChild(noiseLayer);
    app.stage.addChild(contentLayer);
    app.stage.addChild(uiLayer);
    app.stage.filterArea = app.screen;
    noiseLayer.filterArea = app.screen;

    const background = new Graphics();
    background.beginFill(SPLASH_COLORS.black);
    background.drawRect(0, 0, width, height);
    background.endFill();
    backgroundLayer.addChild(background);
    backgroundRef.current = background;

    const noiseSurface = new Graphics();
    noiseSurface.beginFill(SPLASH_COLORS.black);
    noiseSurface.drawRect(0, 0, width, height);
    noiseSurface.endFill();
    noiseLayer.addChild(noiseSurface);
    noiseSurfaceRef.current = noiseSurface;

    const filterManager = new FilterManager(app.stage);
    filterManagerRef.current = filterManager;

    const context: SplashCanvasContext = {
      app,
      stage: app.stage,
      layers: {
        background: backgroundLayer,
        noise: noiseLayer,
        content: contentLayer,
        ui: uiLayer,
      },
      screen: { width, height },
    };
    contextRef.current = context;

    const signalLockRenderer = new SignalLockRenderer();
    signalLockRenderer.setFilterManager(filterManager);
    signalLockRenderer.setOnComplete(() => {
      isIntroActiveRef.current = false;
      onIntroCompleteRef.current?.();
    });
    signalLockRendererRef.current = signalLockRenderer;

    const now = performance.now();
    introStartTimeRef.current = now;
    lastFrameTimeRef.current = now;

    const animate = () => {
      const renderer = signalLockRendererRef.current;
      const fm = filterManagerRef.current;
      const activeApp = appRef.current;

      if (!renderer || !fm || !activeApp) return;

      const frameNow = performance.now();
      const delta = frameNow - lastFrameTimeRef.current;
      lastFrameTimeRef.current = frameNow;

      const shouldUpdateRenderer =
        (phaseRef.current === "intro" && isIntroActiveRef.current) ||
        phaseRef.current === "idle";

      if (shouldUpdateRenderer) {
        const elapsed = frameNow - introStartTimeRef.current;
        renderer.update(elapsed, delta);
      }

      fm.updateCRT(delta);
      activeApp.render();

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);
    onReadyRef.current?.();

    const handleResize = () => {
      const currentContainer = containerRef.current;
      const currentApp = appRef.current;
      const currentContext = contextRef.current;
      const currentBackground = backgroundRef.current;
      const currentNoiseSurface = noiseSurfaceRef.current;
      const currentRenderer = signalLockRendererRef.current;

      if (
        !currentContainer ||
        !currentApp ||
        !currentContext ||
        !currentBackground ||
        !currentNoiseSurface ||
        !currentRenderer
      ) {
        return;
      }

      const nextSize = getContainerSize(currentContainer);
      currentApp.renderer.resize(nextSize.width, nextSize.height);
      currentApp.stage.filterArea = currentApp.screen;
      currentContext.layers.noise.filterArea = currentApp.screen;

      currentContext.screen = {
        width: nextSize.width,
        height: nextSize.height,
      };

      currentBackground.clear();
      currentBackground.beginFill(SPLASH_COLORS.black);
      currentBackground.drawRect(0, 0, nextSize.width, nextSize.height);
      currentBackground.endFill();

      currentNoiseSurface.clear();
      currentNoiseSurface.beginFill(SPLASH_COLORS.black);
      currentNoiseSurface.drawRect(0, 0, nextSize.width, nextSize.height);
      currentNoiseSurface.endFill();

      currentRenderer.resize(nextSize.width, nextSize.height);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);

      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = 0;
      }

      signalLockRendererRef.current?.destroy();
      filterManagerRef.current?.destroy();

      signalLockRendererRef.current = null;
      filterManagerRef.current = null;
      contextRef.current = null;
      backgroundRef.current = null;
      noiseSurfaceRef.current = null;
      isIntroActiveRef.current = false;

      if (appRef.current) {
        appRef.current.destroy(true, { children: true, texture: true });
        appRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    phaseRef.current = phase;

    const renderer = signalLockRendererRef.current;
    const context = contextRef.current;

    if (!renderer || !context) return;

    if (phase === "intro") {
      renderer.init(context);
      const now = performance.now();
      introStartTimeRef.current = now;
      lastFrameTimeRef.current = now;
      isIntroActiveRef.current = true;
      return;
    }

    if (phase === "idle") {
      isIntroActiveRef.current = false;
    }
  }, [phase]);

  return <div ref={containerRef} className="absolute inset-0" />;
}

export { SplashCanvas as PixiSplashCanvas };
