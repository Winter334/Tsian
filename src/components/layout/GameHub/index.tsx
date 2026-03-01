import { motion } from "framer-motion";
import {
  Archive,
  BookOpen,
  Brain,
  FolderOpen,
  Globe,
  Home,
  Pin,
  Settings,
  Wand2,
} from "lucide-react";

import { animation } from "@/styles/tokens";

import { HubBackground } from "./HubBackground";
import { HubCenterEntry } from "./HubCenterEntry";
import { HubFeatureIcon } from "./HubFeatureIcon";

interface GameHubProps {
  onEnterGame: () => void;
  onBackToTitle: () => void;
  onSettings: () => void;
  onSaveManager: () => void;
  onPresetWorkspace: () => void;
  onLorebookWorkspace: () => void;
  onCheckpoint: () => void;
  onMemory: () => void;
  onRoomInfo: () => void;
  onWorldArchive: () => void;
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
  onCheckpoint,
  onMemory,
  onRoomInfo,
  onWorldArchive,
}: GameHubProps) {
  return (
    <div className="relative w-full h-dvh overflow-hidden">
      <HubBackground />

      <motion.div
        className="absolute inset-0"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
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
            position="middle-left"
            icon={Brain}
            label="记忆"
            sublabel="MEMORY"
            onClick={onMemory}
          />
        </motion.div>

        <motion.div variants={itemVariants}>
          <HubFeatureIcon
            position="middle-right"
            icon={Globe}
            label="联机"
            sublabel="ONLINE"
            onClick={onRoomInfo}
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
          <HubFeatureIcon
            position="inline"
            icon={Archive}
            label="世界档案"
            sublabel="ARCHIVE"
            onClick={onWorldArchive}
          />
          <HubFeatureIcon
            position="inline"
            icon={Pin}
            label="检查点"
            sublabel="CHECKPOINT"
            onClick={onCheckpoint}
          />
        </motion.div>

        <motion.div
          className="absolute top-1/2 left-1/2 z-30 -translate-x-1/2 -translate-y-1/2"
          variants={itemVariants}
        >
          <HubCenterEntry onClick={onEnterGame} />
        </motion.div>
      </motion.div>
    </div>
  );
}

export type { GameHubProps };
