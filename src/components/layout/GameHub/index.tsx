import { motion, useReducedMotion } from "framer-motion";
import { BookOpen, FolderOpen, Home, Settings, Wand2 } from "lucide-react";

import { animation } from "@/styles/tokens";

import { HubBackground } from "./HubBackground";
import { HubCenterEntry } from "./HubCenterEntry";
import { HubFeatureIcon } from "./HubFeatureIcon";

type HubGameTransitionState = "idle" | "hub-to-game" | "game-to-hub";
type HubGameTransitionPhase = "idle" | "out" | "in";

interface GameHubProps {
  onEnterGame: () => void;
  onBackToTitle: () => void;
  onSettings: () => void;
  onSaveManager: () => void;
  onPresetWorkspace: () => void;
  onLorebookWorkspace: () => void;
  transitionState?: HubGameTransitionState;
  transitionPhase?: HubGameTransitionPhase;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      duration: animation.duration.normal,
      ease: animation.easing.smooth,
      staggerChildren: 0.06,
      delayChildren: 0.08,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12, scale: 0.96 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: animation.duration.normal,
      ease: animation.easing.smooth,
    },
  },
};

/**
 * Hub 功能中枢：四周功能入口 + 中央进入冒险
 */
export function GameHub({
  onEnterGame,
  onBackToTitle,
  onSettings,
  onSaveManager,
  onPresetWorkspace,
  onLorebookWorkspace,
  transitionState = "idle",
  transitionPhase = "idle",
}: GameHubProps) {
  const shouldReduceMotion = useReducedMotion();
  const isEnteringGame = transitionState === "hub-to-game";
  const isReturningToHub = transitionState === "game-to-hub";
  const isTransitioning = transitionState !== "idle";
  const transitionDuration = shouldReduceMotion
    ? 0.18
    : animation.duration.slow;
  const returnRevealDelay =
    isReturningToHub && transitionPhase === "in"
      ? shouldReduceMotion
        ? 0.04
        : transitionDuration * 0.72
      : 0;

  return (
    <motion.div
      className="absolute inset-0 overflow-hidden"
      initial={
        isReturningToHub
          ? {
              opacity: 0.24,
            }
          : false
      }
      animate={{ opacity: 1 }}
      transition={{
        duration: transitionDuration,
        delay: returnRevealDelay,
        ease: [0.16, 1, 0.3, 1],
      }}
      style={{ pointerEvents: isTransitioning ? "none" : "auto" }}
    >
      <motion.div
        className="absolute inset-0"
        initial={
          isReturningToHub
            ? {
                opacity: 0.22,
                scale: shouldReduceMotion ? 1 : 1.06,
                filter: shouldReduceMotion ? "none" : "blur(14px)",
              }
            : false
        }
        animate={{
          opacity: isEnteringGame ? 0.42 : 1,
          scale: isEnteringGame && !shouldReduceMotion ? 1.02 : 1,
          filter:
            shouldReduceMotion || !isEnteringGame
              ? "none"
              : "blur(5px) saturate(0.9)",
        }}
        transition={{
          duration: transitionDuration,
          delay: returnRevealDelay,
          ease: [0.16, 1, 0.3, 1],
        }}
      >
        <HubBackground />
      </motion.div>

      <motion.div
        className="absolute inset-0"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.div
          className="absolute inset-0"
          initial={
            isReturningToHub
              ? {
                  opacity: 0.08,
                  scale: shouldReduceMotion ? 1 : 1.06,
                  filter: shouldReduceMotion ? "none" : "blur(16px)",
                }
              : false
          }
          animate={{
            opacity: isEnteringGame ? 0.14 : 1,
            scale: isEnteringGame && !shouldReduceMotion ? 0.985 : 1,
            filter:
              shouldReduceMotion || !isEnteringGame
                ? "none"
                : "blur(7px) saturate(0.88)",
          }}
          transition={{
            duration: transitionDuration,
            delay: returnRevealDelay,
            ease: [0.16, 1, 0.3, 1],
          }}
        >
          <motion.div variants={itemVariants}>
            <HubFeatureIcon
              position="top-left"
              icon={Wand2}
              label="提示词"
              sublabel="PRESET"
              onClick={onPresetWorkspace}
            />
          </motion.div>

          <motion.div variants={itemVariants}>
            <HubFeatureIcon
              position="top-right"
              icon={BookOpen}
              label="世界书"
              sublabel="LOREBOOK"
              onClick={onLorebookWorkspace}
            />
          </motion.div>

          <motion.div variants={itemVariants}>
            <HubFeatureIcon
              position="bottom-left"
              icon={Home}
              label="返回标题"
              sublabel="HOME"
              onClick={onBackToTitle}
            />
          </motion.div>

          <motion.div variants={itemVariants}>
            <HubFeatureIcon
              position="bottom-right"
              icon={Settings}
              label="设置"
              sublabel="SETTINGS"
              onClick={onSettings}
            />
          </motion.div>

          <motion.div
            className="absolute bottom-4 md:bottom-8 left-1/2 -translate-x-1/2 z-20 flex items-end gap-6 md:gap-8"
            variants={itemVariants}
          >
            <HubFeatureIcon
              position="inline"
              icon={FolderOpen}
              label="存档"
              sublabel="SAVES"
              onClick={onSaveManager}
            />
          </motion.div>
        </motion.div>

        <div className="absolute top-1/2 left-1/2 z-30 -translate-x-1/2 -translate-y-1/2">
          <HubCenterEntry
            onClick={onEnterGame}
            transitionState={transitionState}
            transitionPhase={transitionPhase}
          />
        </div>
      </motion.div>
    </motion.div>
  );
}

export type { GameHubProps };
