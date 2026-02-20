import { CHARGE_SEQUENCE_CONFIG } from "@/config/splash";
import { color, colorAlpha } from "@/styles/tokens";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";

import { CreditsOverlay } from "./CreditsOverlay";
import { SplashCanvas } from "./PixiSplashCanvas";
import type { SplashPhase } from "./types";

interface SplashScreenProps {
  onComplete: () => void;
}

const SPLASH_EXIT_DURATION = 0.5;
const FLASH_FADE_DURATION = 0.2;
const CREDITS_TOTAL_DURATION = 4500;

export function SplashScreen({ onComplete }: SplashScreenProps) {
  const [phase, setPhase] = useState<SplashPhase>("intro");
  const [flashActive, setFlashActive] = useState(false);

  const holdStartRef = useRef(0);
  const holdTimerRef = useRef<number | null>(null);
  const flashTimerRef = useRef<number | null>(null);
  const creditsTimerRef = useRef<number | null>(null);
  const completeTimerRef = useRef<number | null>(null);
  const isPrimedRef = useRef(false);

  const clearHoldTimer = useCallback(() => {
    if (holdTimerRef.current !== null) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  }, []);

  const clearFlashTimer = useCallback(() => {
    if (flashTimerRef.current !== null) {
      window.clearTimeout(flashTimerRef.current);
      flashTimerRef.current = null;
    }
  }, []);

  const clearCreditsTimer = useCallback(() => {
    if (creditsTimerRef.current !== null) {
      window.clearTimeout(creditsTimerRef.current);
      creditsTimerRef.current = null;
    }
  }, []);

  const clearCompleteTimer = useCallback(() => {
    if (completeTimerRef.current !== null) {
      window.clearTimeout(completeTimerRef.current);
      completeTimerRef.current = null;
    }
  }, []);

  const handleIntroComplete = useCallback(() => {
    setPhase("idle");
  }, []);

  const handlePointerDown = useCallback(() => {
    if (phase !== "idle") {
      return;
    }

    holdStartRef.current = performance.now();
    isPrimedRef.current = false;
    setPhase("charging");

    clearHoldTimer();
    holdTimerRef.current = window.setTimeout(() => {
      isPrimedRef.current = true;
    }, CHARGE_SEQUENCE_CONFIG.charge.holdThreshold);
  }, [clearHoldTimer, phase]);

  const handlePointerUp = useCallback(() => {
    if (phase !== "charging") {
      return;
    }

    clearHoldTimer();

    const holdDuration = performance.now() - holdStartRef.current;
    const isQualified =
      isPrimedRef.current ||
      holdDuration >= CHARGE_SEQUENCE_CONFIG.charge.holdThreshold;

    isPrimedRef.current = false;

    if (isQualified) {
      setPhase("sequence");
      return;
    }

    setPhase("idle");
  }, [clearHoldTimer, phase]);

  const handlePointerLeave = useCallback(() => {
    if (phase !== "charging") {
      return;
    }

    clearHoldTimer();
    isPrimedRef.current = false;
    setPhase("idle");
  }, [clearHoldTimer, phase]);

  const handleFlashStart = useCallback(() => {
    clearFlashTimer();
    setFlashActive(true);

    flashTimerRef.current = window.setTimeout(() => {
      setFlashActive(false);
      flashTimerRef.current = null;
    }, CHARGE_SEQUENCE_CONFIG.sequence.flashDuration);
  }, [clearFlashTimer]);

  const handleSequenceComplete = useCallback(() => {
    setPhase("credits");
  }, []);

  const handleCreditsComplete = useCallback(() => {
    setPhase("complete");

    clearCompleteTimer();
    completeTimerRef.current = window.setTimeout(() => {
      onComplete();
      completeTimerRef.current = null;
    }, SPLASH_EXIT_DURATION * 1000);
  }, [clearCompleteTimer, onComplete]);

  useEffect(() => {
    if (phase === "charging") {
      return;
    }

    clearHoldTimer();
    isPrimedRef.current = false;
  }, [clearHoldTimer, phase]);

  useEffect(() => {
    if (phase === "sequence") {
      return;
    }

    clearFlashTimer();
    setFlashActive(false);
  }, [clearFlashTimer, phase]);

  useEffect(() => {
    if (phase !== "credits") {
      clearCreditsTimer();
      return;
    }

    clearCreditsTimer();
    creditsTimerRef.current = window.setTimeout(() => {
      creditsTimerRef.current = null;
      handleCreditsComplete();
    }, CREDITS_TOTAL_DURATION);

    return () => {
      clearCreditsTimer();
    };
  }, [clearCreditsTimer, handleCreditsComplete, phase]);

  useEffect(() => {
    return () => {
      clearHoldTimer();
      clearFlashTimer();
      clearCreditsTimer();
      clearCompleteTimer();
    };
  }, [clearCompleteTimer, clearCreditsTimer, clearFlashTimer, clearHoldTimer]);

  return (
    <AnimatePresence>
      {phase !== "complete" && (
        <motion.div
          key="splash"
          className="fixed inset-0 z-50 bg-black"
          initial={{ opacity: 0 }}
          animate={
            phase === "sequence"
              ? { x: [0, -3, 3, -2, 2, -1, 1, 0], opacity: 1 }
              : { x: 0, opacity: 1 }
          }
          transition={
            phase === "sequence"
              ? {
                  x: { duration: 0.4, delay: 0.8, ease: "easeInOut" },
                  opacity: { duration: 0.5 },
                }
              : { duration: 0.5 }
          }
          exit={{ opacity: 0, transition: { duration: SPLASH_EXIT_DURATION } }}
        >
          <SplashCanvas
            phase={phase}
            onIntroComplete={handleIntroComplete}
            onSequenceComplete={handleSequenceComplete}
            onFlashStart={handleFlashStart}
          />

          {(phase === "idle" || phase === "charging") && (
            <motion.div
              className="absolute inset-0 flex items-center justify-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.4 }}
            >
              <button
                type="button"
                onPointerDown={handlePointerDown}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerLeave}
                onPointerCancel={handlePointerLeave}
                className="h-40 w-40 cursor-pointer touch-none rounded-full border-none bg-transparent outline-none"
                aria-label="Hold to initialize"
              />
            </motion.div>
          )}

          {phase === "idle" && (
            <motion.p
              className="absolute bottom-12 left-0 right-0 text-center text-sm tracking-[0.3em] uppercase"
              style={{ color: colorAlpha("primary", 0.6) }}
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.6, 0.4, 0.6] }}
              transition={{
                duration: 2,
                times: [0, 0.2, 0.6, 1],
                repeat: Infinity,
              }}
            >
              SIGNAL LOCKED · HOLD TO INITIALIZE
            </motion.p>
          )}

          <motion.div
            className="pointer-events-none absolute inset-0"
            style={{ backgroundColor: color("textPrimary") }}
            initial={false}
            animate={{ opacity: flashActive ? 0.95 : 0 }}
            transition={{ duration: FLASH_FADE_DURATION, ease: "easeOut" }}
            aria-hidden="true"
          />

          <AnimatePresence>
            {phase === "credits" && <CreditsOverlay key="credits" />}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
