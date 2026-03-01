import { motion } from "framer-motion";
import { useMemo, useState } from "react";

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

interface HubCenterEntryProps {
  onClick: () => void;
}

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
export function HubCenterEntry({ onClick }: HubCenterEntryProps) {
  const [isHovered, setIsHovered] = useState(false);
  const character = usePlayerCharacter();

  const characterName = character?.name?.trim() || "无名旅者";

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

  return (
    <motion.button
      type="button"
      className="z-30 w-40 h-40 md:w-56 md:h-56 rounded-2xl px-4 py-3 md:px-6 md:py-5 flex flex-col items-center justify-center text-center"
      onClick={onClick}
      style={{
        ...glassmorphism(0.6),
        background: `linear-gradient(180deg, ${colorAlpha(
          "bgCard",
          0.78,
        )} 0%, ${colorAlpha("bgElevated", 0.68)} 100%)`,
        border: `1px solid ${colorAlpha("primary", 0.3)}`,
        boxShadow: isHovered
          ? `${glow("primary", "lg", 0.36)}, ${glow("secondary", "md", 0.26)}`
          : `${glow("primary", "md", 0.2)}`,
      }}
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.96 }}
      transition={{
        duration: animation.duration.normal,
        ease: animation.easing.smooth,
      }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      aria-label="继续冒险"
      title="继续冒险"
    >
      <span
        className="text-[10px] md:text-xs uppercase tracking-[0.22em]"
        style={{ color: colorAlpha("textSecondary", 0.68) }}
      >
        Adventure Gate
      </span>

      <strong
        className="mt-1 text-xl md:text-3xl font-semibold max-w-full truncate"
        style={{
          ...gradientText(gradients.text()),
          textShadow: glow("primary", "sm", 0.2),
        }}
      >
        {characterName}
      </strong>

      <span
        className="mt-1 text-[10px] md:text-xs uppercase tracking-wider"
        style={{ color: colorAlpha("textPrimary", 0.86) }}
      >
        {descriptor} · LEVEL {level}
      </span>

      <span
        className="mt-3 text-sm md:text-base font-medium"
        style={{ color: color("textPrimary") }}
      >
        继续冒险
      </span>
    </motion.button>
  );
}

export type { HubCenterEntryProps };
