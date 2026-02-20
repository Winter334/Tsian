import { SPLASH_COLORS } from "@/config/splash";
import { Application, Container, Graphics } from "@/lib/pixi";
import { useEffect, useRef } from "react";

import { FilterManager } from "@/components/SplashScreen/FilterManager";
import { ChargeSequenceRenderer } from "@/components/SplashScreen/renderers/ChargeSequenceRenderer";
import { EnergyRingRenderer } from "@/components/SplashScreen/renderers/EnergyRingRenderer";
import { ParticleRenderer } from "@/components/SplashScreen/renderers/ParticleRenderer";
import { SignalLockRenderer } from "@/components/SplashScreen/renderers/SignalLockRenderer";
import type {
  SplashCanvasContext,
  SplashPhase,
} from "@/components/SplashScreen/types";

interface SplashCanvasProps {
  phase: SplashPhase;
  onIntroComplete?: () => void;
  onSequenceComplete?: () => void;
  onFlashStart?: () => void;
  onFlashPeak?: () => void;
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
  onSequenceComplete,
  onFlashStart,
  onFlashPeak,
  onReady,
}: SplashCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const appRef = useRef<Application | null>(null);
  const contextRef = useRef<SplashCanvasContext | null>(null);
  const filterManagerRef = useRef<FilterManager | null>(null);
  const signalLockRendererRef = useRef<SignalLockRenderer | null>(null);
  const chargeRendererRef = useRef<ChargeSequenceRenderer | null>(null);
  const energyRingRendererRef = useRef<EnergyRingRenderer | null>(null);
  const particleRendererRef = useRef<ParticleRenderer | null>(null);
  const backgroundRef = useRef<Graphics | null>(null);
  const noiseSurfaceRef = useRef<Graphics | null>(null);
  const animationRef = useRef<number>(0);

  const phaseRef = useRef<SplashPhase>(phase);
  const isIntroActiveRef = useRef(false);
  const introStartTimeRef = useRef(0);
  const lastFrameTimeRef = useRef(0);

  const onIntroCompleteRef = useRef(onIntroComplete);
  const onSequenceCompleteRef = useRef(onSequenceComplete);
  const onFlashStartRef = useRef(onFlashStart);
  const onFlashPeakRef = useRef(onFlashPeak);
  const onReadyRef = useRef(onReady);

  useEffect(() => {
    onIntroCompleteRef.current = onIntroComplete;
    onSequenceCompleteRef.current = onSequenceComplete;
    onFlashStartRef.current = onFlashStart;
    onFlashPeakRef.current = onFlashPeak;
    onReadyRef.current = onReady;
  }, [onFlashPeak, onFlashStart, onIntroComplete, onReady, onSequenceComplete]);

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

    const particleRenderer = new ParticleRenderer();
    particleRenderer.init(context);
    particleRendererRef.current = particleRenderer;
    signalLockRenderer.setParticleRenderer(particleRenderer);

    const energyRingRenderer = new EnergyRingRenderer(
      contentLayer,
      width * 0.5,
      height * 0.5,
      width,
      height,
    );
    energyRingRendererRef.current = energyRingRenderer;

    const chargeRenderer = new ChargeSequenceRenderer();
    chargeRenderer.setLogoRenderer(signalLockRenderer.getLogoRenderer());
    chargeRenderer.setFilterManager(filterManager);
    chargeRenderer.setParticleRenderer(particleRenderer);
    chargeRenderer.setEnergyRingRenderer(energyRingRenderer);
    chargeRenderer.setCallbacks({
      onSequenceComplete: () => {
        onSequenceCompleteRef.current?.();
      },
      onFlashStart: () => {
        onFlashStartRef.current?.();
      },
      onFlashPeak: () => {
        onFlashPeakRef.current?.();
      },
    });
    chargeRenderer.init(context);
    chargeRendererRef.current = chargeRenderer;

    const now = performance.now();
    introStartTimeRef.current = now;
    lastFrameTimeRef.current = now;

    const animate = () => {
      const signalRenderer = signalLockRendererRef.current;
      const chargeRenderer = chargeRendererRef.current;
      const energyRingRenderer = energyRingRendererRef.current;
      const particleRenderer = particleRendererRef.current;
      const fm = filterManagerRef.current;
      const activeApp = appRef.current;

      if (
        !signalRenderer ||
        !chargeRenderer ||
        !energyRingRenderer ||
        !particleRenderer ||
        !fm ||
        !activeApp
      ) {
        return;
      }

      const frameNow = performance.now();
      const delta = frameNow - lastFrameTimeRef.current;
      lastFrameTimeRef.current = frameNow;

      const currentPhase = phaseRef.current;
      const shouldUpdateRenderer =
        (currentPhase === "intro" && isIntroActiveRef.current) ||
        currentPhase === "idle" ||
        currentPhase === "charging" ||
        currentPhase === "sequence";
      const shouldUpdateParticles =
        currentPhase === "idle" ||
        currentPhase === "charging" ||
        currentPhase === "sequence" ||
        (currentPhase === "intro" && particleRenderer.isActive());

      if (shouldUpdateRenderer || shouldUpdateParticles) {
        const elapsed = frameNow - introStartTimeRef.current;

        if (shouldUpdateRenderer) {
          signalRenderer.update(elapsed, delta);

          if (currentPhase === "charging" || currentPhase === "sequence") {
            chargeRenderer.update(elapsed, delta);

            if (currentPhase === "charging" && chargeRenderer.isPrimed()) {
              // 预留：可在此通知上层显示“可释放”提示。
            }
          }

          energyRingRenderer.update(delta, elapsed);
        }

        if (shouldUpdateParticles) {
          particleRenderer.update(elapsed, delta);
        }
      }

      const shakeIntensity = chargeRenderer.getStageShakeIntensity();
      if (shakeIntensity > 0) {
        const maxShake = 3;
        const shake = shakeIntensity * maxShake;
        activeApp.stage.position.set(
          (Math.random() * 2 - 1) * shake,
          (Math.random() * 2 - 1) * shake,
        );
      } else {
        activeApp.stage.position.set(0, 0);
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
      const currentChargeRenderer = chargeRendererRef.current;
      const currentEnergyRingRenderer = energyRingRendererRef.current;
      const currentParticleRenderer = particleRendererRef.current;

      if (
        !currentContainer ||
        !currentApp ||
        !currentContext ||
        !currentBackground ||
        !currentNoiseSurface ||
        !currentRenderer ||
        !currentChargeRenderer ||
        !currentEnergyRingRenderer ||
        !currentParticleRenderer
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

      const centerX = nextSize.width * 0.5;
      const centerY = nextSize.height * 0.5;

      currentRenderer.resize(nextSize.width, nextSize.height);
      currentChargeRenderer.resize(nextSize.width, nextSize.height);
      currentEnergyRingRenderer.resize(
        centerX,
        centerY,
        nextSize.width,
        nextSize.height,
      );
      currentParticleRenderer.resize(nextSize.width, nextSize.height);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);

      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = 0;
      }

      if (appRef.current) {
        appRef.current.stage.position.set(0, 0);
      }

      signalLockRendererRef.current?.destroy();
      chargeRendererRef.current?.destroy();
      energyRingRendererRef.current?.destroy();
      particleRendererRef.current?.destroy();
      filterManagerRef.current?.destroy();

      signalLockRendererRef.current = null;
      chargeRendererRef.current = null;
      energyRingRendererRef.current = null;
      particleRendererRef.current = null;
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
    const previousPhase = phaseRef.current;
    phaseRef.current = phase;

    const signalRenderer = signalLockRendererRef.current;
    const chargeRenderer = chargeRendererRef.current;
    const energyRingRenderer = energyRingRendererRef.current;
    const particleRenderer = particleRendererRef.current;
    const context = contextRef.current;

    if (
      !signalRenderer ||
      !chargeRenderer ||
      !energyRingRenderer ||
      !particleRenderer ||
      !context
    ) {
      return;
    }

    switch (phase) {
      case "intro": {
        signalRenderer.init(context);
        chargeRenderer.cancelCharging();
        particleRenderer.deactivateAll();

        const now = performance.now();
        introStartTimeRef.current = now;
        lastFrameTimeRef.current = now;
        isIntroActiveRef.current = true;
        return;
      }
      case "idle":
        isIntroActiveRef.current = false;

        if (previousPhase === "charging" || previousPhase === "sequence") {
          chargeRenderer.cancelCharging();
          particleRenderer.setMode("drift");
          return;
        }

        if (previousPhase !== "intro" && !particleRenderer.isActive()) {
          particleRenderer.setMode("drift");
        }
        return;
      case "charging":
        isIntroActiveRef.current = false;
        chargeRenderer.enterCharging();
        return;
      case "sequence":
        isIntroActiveRef.current = false;
        chargeRenderer.enterSequence();
        return;
      case "credits":
      case "complete":
        isIntroActiveRef.current = false;

        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
          animationRef.current = 0;
        }

        if (appRef.current) {
          appRef.current.stage.position.set(0, 0);
        }

        signalRenderer.destroy();
        chargeRenderer.destroy();
        energyRingRenderer.destroy();
        particleRenderer.destroy();

        signalLockRendererRef.current = null;
        chargeRendererRef.current = null;
        energyRingRendererRef.current = null;
        particleRendererRef.current = null;
        return;
    }
  }, [phase]);

  return <div ref={containerRef} className="absolute inset-0" />;
}

export { SplashCanvas as PixiSplashCanvas };
