import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useState, type ReactNode } from "react";

import { AiInsightDialog } from "@/components/AiInsight";
import { selectSessionMode, useSessionStore } from "@/stores";
import { animation, colorAlpha, glow } from "@/styles/tokens";

import { LeftSidebar } from "./LeftSidebar";
import { RightSidebar, type RightSidebarTab } from "./RightSidebar";
import { SidebarDrawer } from "./SidebarDrawer";
import { TopBar } from "./TopBar";

type HubGameTransitionState = "idle" | "hub-to-game" | "game-to-hub";
type HubGameTransitionPhase = "idle" | "out" | "in";

interface GameHUDProps {
  onReturnToHub: () => void;
  onOpenCharacterPanel: () => void;
  onOpenArchiveManager: () => void;
  onOpenCheckpoint: () => void;
  onOpenMemory: () => void;
  onOpenRoomInfo: () => void;
  transitionState?: HubGameTransitionState;
  transitionPhase?: HubGameTransitionPhase;
  children: ReactNode;
}

const HUD_TRANSITION_EASE = [0.22, 1, 0.36, 1] as const;

export function GameHUD({
  onReturnToHub,
  onOpenCharacterPanel,
  onOpenArchiveManager,
  onOpenCheckpoint,
  onOpenMemory,
  onOpenRoomInfo,
  transitionState = "idle",
  transitionPhase = "idle",
  children,
}: GameHUDProps) {
  const sessionMode = useSessionStore(selectSessionMode);
  const isMultiplayer = sessionMode === "multiplayer";
  const shouldReduceMotion = useReducedMotion();

  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);
  const [rightSidebarActiveTab, setRightSidebarActiveTab] =
    useState<RightSidebarTab>(isMultiplayer ? "team" : "scene");
  const [aiInsightOpen, setAiInsightOpen] = useState(false);

  const isEntering = transitionState === "hub-to-game";
  const isExiting = transitionState === "game-to-hub";
  const isTransitioning = transitionState !== "idle";
  const isEntryShellCovering = isEntering && transitionPhase === "in";
  const rootDuration = shouldReduceMotion
    ? 0.15
    : isExiting
      ? animation.duration.fast
      : animation.duration.normal;
  const sectionDuration = shouldReduceMotion ? 0.11 : animation.duration.fast;
  const entryRevealDelay = isEntryShellCovering
    ? shouldReduceMotion
      ? 0.03
      : rootDuration * 0.58
    : 0;

  useEffect(() => {
    setRightSidebarActiveTab((current) => {
      if (!isMultiplayer && current === "team") {
        return "scene";
      }

      return current;
    });
  }, [isMultiplayer]);

  useEffect(() => {
    if (isTransitioning) {
      setLeftOpen(false);
      setRightOpen(false);
      setAiInsightOpen(false);
    }
  }, [isTransitioning]);

  return (
    <motion.div
      className="absolute inset-0"
      initial={
        isEntering
          ? {
              opacity: 0,
              scale: shouldReduceMotion ? 1.012 : 1.024,
              y: shouldReduceMotion ? 6 : 32,
              filter: shouldReduceMotion
                ? "blur(1px)"
                : "blur(14px) saturate(0.84)",
            }
          : false
      }
      animate={{
        opacity: isExiting ? 0.9 : 1,
        scale: isExiting ? (shouldReduceMotion ? 1.006 : 1.018) : 1,
        y: isExiting && !shouldReduceMotion ? 20 : 0,
        filter:
          shouldReduceMotion || !isExiting
            ? "blur(0px)"
            : "blur(8px) saturate(0.78)",
      }}
      transition={{
        duration: rootDuration,
        delay: entryRevealDelay,
        ease: HUD_TRANSITION_EASE,
      }}
      style={{
        pointerEvents: isTransitioning ? "none" : "auto",
      }}
    >
      <motion.div
        className="absolute inset-[max(3vh,12px)] rounded-4xl overflow-hidden"
        animate={{
          opacity: isExiting ? 0.42 : 1,
          scale: isExiting && !shouldReduceMotion ? 0.968 : 1,
          boxShadow: isTransitioning
            ? `${glow("primary", "lg", 0.2)}, inset 0 0 0 1px ${colorAlpha(
                "primary",
                0.22,
              )}`
            : `${glow("primary", "md", 0.12)}, inset 0 0 0 1px ${colorAlpha(
                "primary",
                0.12,
              )}`,
        }}
        transition={{
          duration: rootDuration,
          delay: entryRevealDelay,
          ease: HUD_TRANSITION_EASE,
        }}
        style={{
          background: colorAlpha("bgBase", 0.86),
          backdropFilter: "blur(14px)",
          border: `1px solid ${colorAlpha("primary", 0.14)}`,
        }}
      >
        <motion.div
          className="absolute inset-0 pointer-events-none"
          animate={{
            opacity: isExiting ? 0.28 : isTransitioning ? 0.58 : 0.44,
          }}
          transition={{
            duration: rootDuration,
            delay: entryRevealDelay,
            ease: HUD_TRANSITION_EASE,
          }}
          style={{
            background: `radial-gradient(circle at 50% 18%, ${colorAlpha(
              "primary",
              0.12,
            )} 0%, transparent 58%), linear-gradient(180deg, ${colorAlpha(
              "primary",
              0.08,
            )} 0%, transparent 34%, ${colorAlpha("bgBase", 0.08)} 100%)`,
          }}
        />

        <div className="relative h-full flex">
          <motion.aside
            className="hidden md:flex md:flex-col w-80 shrink-0 overflow-y-auto"
            initial={
              isEntering
                ? {
                    opacity: 0,
                    x: shouldReduceMotion ? 0 : -24,
                  }
                : false
            }
            animate={{
              opacity: isExiting ? 0 : 1,
              x: isExiting && !shouldReduceMotion ? -20 : 0,
            }}
            transition={{
              duration: sectionDuration,
              delay:
                entryRevealDelay +
                (isEntering && !shouldReduceMotion ? 0.06 : 0.01),
              ease: HUD_TRANSITION_EASE,
            }}
            style={{
              borderRight: `1px solid ${colorAlpha("primary", 0.15)}`,
              background: colorAlpha("bgElevated", 0.78),
            }}
          >
            <LeftSidebar onOpenCharacterPanel={onOpenCharacterPanel} />
          </motion.aside>

          <motion.main
            className="flex-1 min-w-0 relative overflow-hidden flex flex-col"
            initial={
              isEntering
                ? {
                    opacity: 0,
                    scale: shouldReduceMotion ? 1 : 0.988,
                  }
                : false
            }
            animate={{
              opacity: isExiting ? 0 : 1,
              scale: isExiting && !shouldReduceMotion ? 0.988 : 1,
            }}
            transition={{
              duration: sectionDuration,
              delay:
                entryRevealDelay +
                (isEntering && !shouldReduceMotion ? 0.03 : 0),
              ease: HUD_TRANSITION_EASE,
            }}
          >
            <motion.div
              initial={
                isEntering
                  ? {
                      opacity: 0,
                      y: shouldReduceMotion ? 0 : -18,
                    }
                  : false
              }
              animate={{
                opacity: isExiting ? 0 : 1,
                y: isExiting && !shouldReduceMotion ? -12 : 0,
              }}
              transition={{
                duration: sectionDuration,
                delay:
                  entryRevealDelay +
                  (isEntering && !shouldReduceMotion ? 0.08 : 0.03),
                ease: HUD_TRANSITION_EASE,
              }}
            >
              <TopBar
                onOpenLeftSidebar={() => setLeftOpen(true)}
                onOpenRightSidebar={() => setRightOpen(true)}
                onReturnToHub={onReturnToHub}
                onOpenRoomInfo={onOpenRoomInfo}
                disabled={isTransitioning}
              />
            </motion.div>

            <motion.div
              className="flex-1 min-h-0 overflow-auto"
              initial={
                isEntering
                  ? {
                      opacity: 0,
                      y: shouldReduceMotion ? 0 : 24,
                    }
                  : false
              }
              animate={{
                opacity: isExiting ? 0 : 1,
                y: isExiting && !shouldReduceMotion ? 16 : 0,
              }}
              transition={{
                duration: sectionDuration,
                delay:
                  entryRevealDelay +
                  (isEntering && !shouldReduceMotion ? 0.05 : 0.01),
                ease: HUD_TRANSITION_EASE,
              }}
            >
              {children}
            </motion.div>

            <SidebarDrawer
              side="left"
              open={leftOpen && !isTransitioning}
              onClose={() => setLeftOpen(false)}
            >
              <LeftSidebar onOpenCharacterPanel={onOpenCharacterPanel} />
            </SidebarDrawer>

            <SidebarDrawer
              side="right"
              open={rightOpen && !isTransitioning}
              onClose={() => setRightOpen(false)}
            >
              <RightSidebar
                activeTab={rightSidebarActiveTab}
                onActiveTabChange={setRightSidebarActiveTab}
                onOpenAiInsight={() => setAiInsightOpen(true)}
                onOpenArchiveManager={onOpenArchiveManager}
                onOpenCheckpoint={onOpenCheckpoint}
                onOpenMemory={onOpenMemory}
              />
            </SidebarDrawer>
          </motion.main>

          <motion.aside
            className="hidden md:flex md:flex-col w-80 shrink-0 overflow-y-auto"
            initial={
              isEntering
                ? {
                    opacity: 0,
                    x: shouldReduceMotion ? 0 : 24,
                  }
                : false
            }
            animate={{
              opacity: isExiting ? 0 : 1,
              x: isExiting && !shouldReduceMotion ? 20 : 0,
            }}
            transition={{
              duration: sectionDuration,
              delay:
                entryRevealDelay +
                (isEntering && !shouldReduceMotion ? 0.07 : 0.03),
              ease: HUD_TRANSITION_EASE,
            }}
            style={{
              borderLeft: `1px solid ${colorAlpha("primary", 0.15)}`,
              background: colorAlpha("bgElevated", 0.78),
            }}
          >
            <RightSidebar
              activeTab={rightSidebarActiveTab}
              onActiveTabChange={setRightSidebarActiveTab}
              onOpenAiInsight={() => setAiInsightOpen(true)}
              onOpenArchiveManager={onOpenArchiveManager}
              onOpenCheckpoint={onOpenCheckpoint}
              onOpenMemory={onOpenMemory}
            />
          </motion.aside>
        </div>
      </motion.div>

      <AiInsightDialog
        open={aiInsightOpen && !isTransitioning}
        onOpenChange={setAiInsightOpen}
      />
    </motion.div>
  );
}

export type { GameHUDProps };
