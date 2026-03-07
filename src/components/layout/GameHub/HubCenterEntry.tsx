import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "framer-motion";
import {
  useMemo,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { usePlayerCharacter } from "@/components/CharacterPanel/usePlayerCharacter";
import {
  animation,
  color,
  colorAlpha,
  glassmorphism,
  glow,
  gradients,
  gradientText,
} from "@/styles/tokens";

type HubGameTransitionState = "idle" | "hub-to-game" | "game-to-hub";
type HubGameTransitionPhase = "idle" | "out" | "in";

interface HubCenterEntryProps {
  onClick: () => void;
  transitionState?: HubGameTransitionState;
  transitionPhase?: HubGameTransitionPhase;
}

const MAX_TILT_DEG = 8.5;
const CARD_PERSPECTIVE_PX = 1120;
const CARD_CLIP_PATH =
  "polygon(0 12%, 12% 0, 88% 0, 100% 12%, 100% 88%, 88% 100%, 12% 100%, 0 88%)";
const CARD_CLIP_STYLE = {
  clipPath: CARD_CLIP_PATH,
  WebkitClipPath: CARD_CLIP_PATH,
} as const;
const CARD_TRANSITION_EASE = [0.22, 1, 0.36, 1] as const;

function formatDescriptor(value: string): string {
  return value.replace(/[_-]/g, " ").trim().replace(/\s+/g, " ");
}

function parseLevel(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(1, Math.floor(value));
  }

  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) {
      return Math.max(1, parsed);
    }
  }

  return 1;
}

/**
 * Hub 中央入口：展示玩家角色摘要并进入冒险
 */
export function HubCenterEntry({
  onClick,
  transitionState = "idle",
  transitionPhase = "idle",
}: HubCenterEntryProps) {
  const [isHovered, setIsHovered] = useState(false);
  const character = usePlayerCharacter();
  const shouldReduceMotion = useReducedMotion();

  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const springConfig = useMemo(
    () => ({ stiffness: 340, damping: 28, mass: 0.32 }),
    [],
  );
  const smoothPointerX = useSpring(pointerX, springConfig);
  const smoothPointerY = useSpring(pointerY, springConfig);

  const rotateX = useTransform(
    smoothPointerY,
    [-1, 1],
    [MAX_TILT_DEG, -MAX_TILT_DEG],
  );
  const rotateY = useTransform(
    smoothPointerX,
    [-1, 1],
    [-MAX_TILT_DEG, MAX_TILT_DEG],
  );
  const contentX = useTransform(smoothPointerX, [-1, 1], [-8, 8]);
  const contentY = useTransform(smoothPointerY, [-1, 1], [-7, 7]);
  const glareShiftX = useTransform(smoothPointerX, [-1, 1], [-14, 14]);
  const glareShiftY = useTransform(smoothPointerY, [-1, 1], [-12, 12]);
  const textureShiftX = useTransform(smoothPointerX, [-1, 1], [-8, 8]);
  const textureShiftY = useTransform(smoothPointerY, [-1, 1], [-6, 6]);
  const frameShiftX = useTransform(smoothPointerX, [-1, 1], [-4, 4]);
  const frameShiftY = useTransform(smoothPointerY, [-1, 1], [-4, 4]);
  const energyShiftX = useTransform(smoothPointerX, [-1, 1], [-6, 6]);
  const energyShiftY = useTransform(smoothPointerY, [-1, 1], [-5, 5]);
  const shadowShiftX = useTransform(smoothPointerX, [-1, 1], [10, -10]);
  const shadowShiftY = useTransform(smoothPointerY, [-1, 1], [12, -12]);
  const glarePositionX = useTransform(smoothPointerX, [-1, 1], [30, 70]);
  const glarePositionY = useTransform(smoothPointerY, [-1, 1], [22, 78]);
  const scanPositionX = useTransform(smoothPointerX, [-1, 1], [48, 52]);
  const scanPositionY = useTransform(smoothPointerY, [-1, 1], [46, 54]);
  const glareAngle = useTransform(
    () => 108 + smoothPointerX.get() * 12 - smoothPointerY.get() * 8,
  );
  const interactionStrength = useTransform(() => {
    const x = smoothPointerX.get();
    const y = smoothPointerY.get();

    return Math.min(1, Math.hypot(x, y));
  });
  const shadowOpacity = useTransform(interactionStrength, [0, 1], [0.16, 0.28]);
  const textureOpacity = useTransform(interactionStrength, [0, 1], [0.08, 0.2]);
  const glareOpacity = useTransform(interactionStrength, [0, 1], [0.14, 0.58]);
  const frameOpacity = useTransform(interactionStrength, [0, 1], [0.34, 0.74]);
  const energyOpacity = useTransform(interactionStrength, [0, 1], [0.12, 0.24]);
  const accentOpacity = useTransform(interactionStrength, [0, 1], [0.4, 0.82]);
  const surfaceGlow = useMotionTemplate`
    radial-gradient(
      circle at ${glarePositionX}% ${glarePositionY}%,
      ${colorAlpha("primary", 0.22)} 0%,
      ${colorAlpha("secondary", 0.14)} 18%,
      transparent 52%
    ),
    linear-gradient(
      180deg,
      ${colorAlpha("textPrimary", 0.08)} 0%,
      transparent 26%,
      ${colorAlpha("primary", 0.06)} 100%
    )
  `;
  const glareBackground = useMotionTemplate`
    linear-gradient(
      ${glareAngle}deg,
      transparent 18%,
      ${colorAlpha("textPrimary", 0.05)} 38%,
      ${colorAlpha("secondary", 0.16)} 48%,
      ${colorAlpha("primary", 0.24)} 52%,
      transparent 66%
    ),
    radial-gradient(
      circle at ${glarePositionX}% ${glarePositionY}%,
      ${colorAlpha("textPrimary", 0.22)} 0%,
      transparent 34%
    )
  `;
  const textureBackground = useMotionTemplate`
    linear-gradient(
      138deg,
      transparent 4%,
      ${colorAlpha("primary", 0.06)} 38%,
      transparent 62%
    ),
    repeating-linear-gradient(
      180deg,
      transparent 0px,
      transparent 13px,
      ${colorAlpha("primary", 0.08)} 13.5px,
      transparent 14px
    ),
    repeating-linear-gradient(
      90deg,
      transparent 0px,
      transparent 18px,
      ${colorAlpha("secondary", 0.06)} 18.5px,
      transparent 19px
    ),
    linear-gradient(
      90deg,
      transparent 0%,
      ${colorAlpha("primary", 0.08)} 50%,
      transparent 100%
    ),
    radial-gradient(
      circle at ${scanPositionX}% ${scanPositionY}%,
      ${colorAlpha("secondary", 0.12)} 0%,
      transparent 52%
    )
  `;

  const characterName = character?.name?.trim() || "无名旅者";
  const isLocked = transitionState !== "idle";
  const isEnteringGame = transitionState === "hub-to-game";
  const isReturningToHub = transitionState === "game-to-hub";
  const stageDuration = shouldReduceMotion
    ? 0.18
    : isEnteringGame
      ? animation.duration.slow
      : animation.duration.normal * 0.92;
  const returnRevealDelay =
    isReturningToHub && transitionPhase === "in"
      ? shouldReduceMotion
        ? 0.03
        : animation.duration.slow * 0.62
      : 0;

  const descriptor = useMemo(() => {
    const selections = character?.dimensionSelections;
    const firstSelection = selections
      ? Object.values(selections).find(
          (value): value is string =>
            typeof value === "string" && value.trim().length > 0,
        )
      : undefined;

    if (firstSelection) {
      return formatDescriptor(firstSelection);
    }

    const attributes = character?.attributes;
    const raceLike = ["race", "species", "origin", "class", "profession"]
      .map((key) => attributes?.[key])
      .find(
        (value): value is string =>
          typeof value === "string" && value.trim().length > 0,
      );

    if (raceLike) {
      return formatDescriptor(raceLike);
    }

    return "冒险者";
  }, [character?.attributes, character?.dimensionSelections]);

  const level = useMemo(() => {
    return parseLevel(character?.attributes?.level);
  }, [character?.attributes]);

  const idleShadow = `0 18px 40px ${colorAlpha("bgBase", 0.22)}, ${glow(
    "primary",
    "md",
    0.14,
  )}, inset 0 0 0 1px ${colorAlpha("textPrimary", 0.04)}`;
  const hoverShadow = `0 24px 48px ${colorAlpha("bgBase", 0.28)}, ${glow(
    "primary",
    "lg",
    0.18,
  )}, ${glow("secondary", "sm", 0.12)}, inset 0 0 0 1px ${colorAlpha(
    "textPrimary",
    0.06,
  )}`;

  const resetTilt = () => {
    pointerX.set(0);
    pointerY.set(0);
  };

  const samplePointer = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (shouldReduceMotion || isLocked || event.pointerType === "touch") {
      return;
    }

    const bounds = event.currentTarget.getBoundingClientRect();
    const relativeX = (event.clientX - bounds.left) / bounds.width;
    const relativeY = (event.clientY - bounds.top) / bounds.height;
    const clampedX = Math.min(Math.max(relativeX, 0), 1);
    const clampedY = Math.min(Math.max(relativeY, 0), 1);

    pointerX.set((clampedX - 0.5) * 2);
    pointerY.set((clampedY - 0.5) * 2);
  };

  const handlePointerEnter = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.pointerType !== "touch") {
      setIsHovered(true);
    }
    samplePointer(event);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    samplePointer(event);
  };

  const handlePointerLeave = () => {
    setIsHovered(false);
    resetTilt();
  };

  const handleClick = () => {
    if (isLocked) {
      return;
    }

    resetTilt();
    onClick();
  };

  return (
    <div
      className="relative"
      style={{
        perspective: shouldReduceMotion
          ? undefined
          : `${CARD_PERSPECTIVE_PX}px`,
        transformStyle: "preserve-3d",
      }}
    >
      <motion.div
        className="pointer-events-none absolute -inset-5 blur-xl md:-inset-8"
        style={{
          ...CARD_CLIP_STYLE,
          x: shouldReduceMotion ? 0 : shadowShiftX,
          y: shouldReduceMotion ? 0 : shadowShiftY,
          opacity: isLocked ? 0.18 : shadowOpacity,
          background: `radial-gradient(circle at 50% 50%, ${colorAlpha(
            "primary",
            0.22,
          )} 0%, ${colorAlpha("secondary", 0.1)} 36%, transparent 72%)`,
        }}
      />

      <motion.div
        className="relative"
        initial={
          isReturningToHub
            ? {
                opacity: 0,
                scale: shouldReduceMotion ? 1.02 : 1.08,
                y: shouldReduceMotion ? 0 : 14,
                rotateX: shouldReduceMotion ? 0 : -10,
                rotateY: shouldReduceMotion ? 0 : -18,
                filter: shouldReduceMotion
                  ? "blur(2px)"
                  : "blur(12px) saturate(0.84)",
              }
            : false
        }
        animate={{
          opacity: isEnteringGame ? 0 : 1,
          scale: isEnteringGame ? (shouldReduceMotion ? 1.04 : 1.18) : 1,
          y: isEnteringGame && !shouldReduceMotion ? -34 : 0,
          rotateX: isEnteringGame && !shouldReduceMotion ? 14 : 0,
          rotateY: isEnteringGame && !shouldReduceMotion ? 30 : 0,
          filter:
            shouldReduceMotion || !isEnteringGame
              ? "blur(0px)"
              : "blur(14px) saturate(0.82)",
        }}
        transition={{
          duration: stageDuration,
          delay: returnRevealDelay,
          ease: CARD_TRANSITION_EASE,
        }}
        style={{ transformStyle: "preserve-3d" }}
      >
        <motion.button
          type="button"
          className="relative z-30 flex h-40 w-40 flex-col items-center justify-center overflow-hidden rounded-[1.4rem] px-4 py-3 text-center md:h-56 md:w-56 md:px-6 md:py-5"
          onClick={handleClick}
          onPointerMove={handlePointerMove}
          onPointerEnter={handlePointerEnter}
          onPointerLeave={handlePointerLeave}
          onFocus={() => setIsHovered(true)}
          onBlur={handlePointerLeave}
          disabled={isLocked}
          aria-label="继续冒险"
          title="继续冒险"
          animate={{
            scale: isHovered && !shouldReduceMotion && !isLocked ? 1.012 : 1,
          }}
          transition={{
            duration: animation.duration.fast,
            ease: CARD_TRANSITION_EASE,
          }}
          style={{
            ...glassmorphism(0.54),
            ...CARD_CLIP_STYLE,
            background: `linear-gradient(168deg, ${colorAlpha(
              "bgCard",
              0.72,
            )} 0%, ${colorAlpha("bgElevated", 0.58)} 42%, ${colorAlpha(
              "bgBase",
              0.66,
            )} 100%)`,
            border: `1px solid ${colorAlpha("primary", isHovered ? 0.26 : 0.18)}`,
            boxShadow: isHovered ? hoverShadow : idleShadow,
            backdropFilter: "blur(18px) saturate(135%)",
            WebkitBackdropFilter: "blur(18px) saturate(135%)",
            rotateX: shouldReduceMotion ? 0 : rotateX,
            rotateY: shouldReduceMotion ? 0 : rotateY,
            transformStyle: "preserve-3d",
            transformOrigin: "center center",
            pointerEvents: isLocked ? "none" : "auto",
          }}
        >
          <motion.div
            className="pointer-events-none absolute inset-px rounded-[calc(1.4rem-1px)]"
            style={{
              ...CARD_CLIP_STYLE,
              background: shouldReduceMotion
                ? `radial-gradient(circle at 50% 50%, ${colorAlpha(
                    "primary",
                    0.16,
                  )} 0%, transparent 56%)`
                : surfaceGlow,
              transform: "translateZ(2px)",
              boxShadow: `inset 0 0 0 1px ${colorAlpha("textPrimary", 0.04)}`,
              opacity: isLocked ? 0.38 : 1,
            }}
          />

          <motion.div
            className="pointer-events-none absolute inset-[8%] rounded-[1.15rem]"
            style={{
              ...CARD_CLIP_STYLE,
              x: shouldReduceMotion ? 0 : textureShiftX,
              y: shouldReduceMotion ? 0 : textureShiftY,
              opacity: isLocked ? 0.12 : textureOpacity,
              transform: "translateZ(6px) scale(1.01)",
              background: shouldReduceMotion ? undefined : textureBackground,
              boxShadow: `inset 0 0 18px ${colorAlpha("primary", 0.08)}`,
              mixBlendMode: "screen",
            }}
          />

          <motion.div
            className="pointer-events-none absolute inset-0 rounded-[1.4rem]"
            style={{
              ...CARD_CLIP_STYLE,
              x: shouldReduceMotion ? 0 : glareShiftX,
              y: shouldReduceMotion ? 0 : glareShiftY,
              opacity: isLocked ? 0.2 : glareOpacity,
              transform: "translateZ(10px) scale(1.04)",
              background: shouldReduceMotion ? undefined : glareBackground,
              mixBlendMode: "screen",
            }}
          />

          <motion.div
            className="pointer-events-none absolute inset-[6.5%] rounded-[1.1rem]"
            style={{
              ...CARD_CLIP_STYLE,
              x: shouldReduceMotion ? 0 : frameShiftX,
              y: shouldReduceMotion ? 0 : frameShiftY,
              opacity: isLocked ? 0.46 : frameOpacity,
              transform: "translateZ(12px)",
              border: `1px solid ${colorAlpha("primary", 0.3)}`,
              boxShadow: `inset 0 0 0 1px ${colorAlpha(
                "textPrimary",
                0.05,
              )}, inset 0 0 18px ${colorAlpha("primary", 0.08)}`,
            }}
          />

          <motion.div
            className="pointer-events-none absolute inset-[11%] rounded-[0.95rem]"
            style={{
              ...CARD_CLIP_STYLE,
              x: shouldReduceMotion ? 0 : energyShiftX,
              y: shouldReduceMotion ? 0 : energyShiftY,
              opacity: isLocked ? 0.18 : energyOpacity,
              transform: "translateZ(8px)",
              background: `linear-gradient(140deg, transparent 0%, ${colorAlpha(
                "primary",
                0.12,
              )} 28%, transparent 46%, transparent 60%, ${colorAlpha(
                "secondary",
                0.1,
              )} 100%), linear-gradient(180deg, transparent 0%, transparent 72%, ${colorAlpha(
                "primary",
                0.08,
              )} 100%)`,
              boxShadow: `inset 0 0 0 1px ${colorAlpha("secondary", 0.06)}`,
            }}
          />

          <motion.div
            className="pointer-events-none absolute inset-x-7 top-5 h-px md:top-6"
            style={{
              x: shouldReduceMotion ? 0 : frameShiftX,
              opacity: isLocked ? 0.22 : accentOpacity,
              transform: "translateZ(14px)",
              background: `linear-gradient(90deg, transparent, ${colorAlpha(
                "secondary",
                0.22,
              )} 18%, ${colorAlpha("primary", 0.56)} 50%, ${colorAlpha(
                "secondary",
                0.22,
              )} 82%, transparent)`,
            }}
          />

          <motion.div
            className="relative z-10 flex flex-col items-center"
            style={{
              x: shouldReduceMotion ? 0 : contentX,
              y: shouldReduceMotion ? 0 : contentY,
              transform: "translateZ(16px)",
            }}
          >
            <span
              className="text-[10px] uppercase tracking-[0.24em] md:text-xs"
              style={{ color: colorAlpha("textSecondary", 0.68) }}
            >
              Adventure Gate
            </span>

            <strong
              className="mt-1 max-w-full truncate text-xl font-semibold md:text-3xl"
              style={{
                ...gradientText(gradients.text()),
                textShadow: glow("primary", "sm", 0.18),
              }}
            >
              {characterName}
            </strong>

            <span
              className="mt-1 text-[10px] uppercase tracking-wider md:text-xs"
              style={{ color: colorAlpha("textPrimary", 0.76) }}
            >
              {descriptor} · LEVEL {level}
            </span>

            <span
              className="mt-4 text-sm font-medium md:text-base"
              style={{ color: color("textPrimary") }}
            >
              继续冒险
            </span>
          </motion.div>

          <motion.div
            className="pointer-events-none absolute inset-x-6 bottom-4 h-px md:bottom-5"
            style={{
              x: shouldReduceMotion ? 0 : frameShiftX,
              opacity: isLocked ? 0.28 : accentOpacity,
              transform: "translateZ(14px)",
              background: `linear-gradient(90deg, transparent, ${colorAlpha(
                "primary",
                0.56,
              )}, ${colorAlpha("secondary", 0.42)}, transparent)`,
              boxShadow: glow("primary", "sm", 0.14),
            }}
          />
        </motion.button>
      </motion.div>
    </div>
  );
}

export type { HubCenterEntryProps };
