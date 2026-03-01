import { motion } from "framer-motion";

import type { Character } from "@/domain/entities/character";
import { useCharacterTags } from "@/hooks/useCharacterTags";
import type { WorldConfig } from "@/lib/world/types";
import { color, colorAlpha } from "@/styles/tokens";

import { StatusTagCard } from "./StatusTagCard";

interface StatusSectionProps {
  character: Character;
  worldConfig: WorldConfig;
}

const easeOut = [0.0, 0.0, 0.2, 1.0] as const;

const sectionVariants = {
  hidden: { opacity: 0, y: 15 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: 0.1 + i * 0.08,
      duration: 0.3,
      ease: easeOut,
    },
  }),
};

export function StatusSection({ character, worldConfig }: StatusSectionProps) {
  const tags = useCharacterTags(character, worldConfig);

  if (tags.length === 0) {
    return (
      <motion.div
        custom={0}
        variants={sectionVariants}
        initial="hidden"
        animate="visible"
        className="space-y-3"
      >
        <h3
          className="text-sm font-semibold"
          style={{ color: color("textPrimary") }}
        >
          状态效果 (0)
        </h3>
        <p className="text-xs" style={{ color: colorAlpha("textMuted", 0.75) }}>
          当前没有活跃的状态效果
        </p>
      </motion.div>
    );
  }

  return (
    <div className="space-y-3">
      <h3
        className="text-sm font-semibold"
        style={{ color: color("textPrimary") }}
      >
        状态效果 ({tags.length})
      </h3>

      {tags.map((tag, i) => (
        <motion.div
          key={tag.mapKey}
          custom={i}
          variants={sectionVariants}
          initial="hidden"
          animate="visible"
        >
          <StatusTagCard tag={tag} />
        </motion.div>
      ))}
    </div>
  );
}
