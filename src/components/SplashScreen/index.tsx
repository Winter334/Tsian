import { colorAlpha } from "@/styles/tokens";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useState } from "react";

import { SplashCanvas } from "./PixiSplashCanvas";
import type { SplashPhase } from "./types";

interface SplashScreenProps {
  onComplete: () => void;
}

export function SplashScreen({ onComplete }: SplashScreenProps) {
  const [phase, setPhase] = useState<SplashPhase>("intro");

  const handleIntroComplete = useCallback(() => {
    setPhase("idle");
  }, []);

  const handleLogoClick = useCallback(() => {
    if (phase !== "idle") {
      return;
    }

    setPhase("complete");
    window.setTimeout(() => {
      onComplete();
    }, 500);
  }, [phase, onComplete]);

  if (phase === "complete") {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        key="splash"
        className="fixed inset-0 z-50 bg-black"
        initial={{ opacity: 1 }}
        exit={{ opacity: 0, transition: { duration: 0.5 } }}
      >
        <SplashCanvas phase={phase} onIntroComplete={handleIntroComplete} />

        {phase === "idle" && (
          <motion.div
            className="absolute inset-0 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
          >
            <button
              onClick={handleLogoClick}
              className="w-32 h-32 rounded-full cursor-pointer bg-transparent border-none outline-none"
              aria-label="Start"
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
              delay: 0,
            }}
          >
            SIGNAL LOCKED · CLICK TO INITIALIZE
          </motion.p>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
