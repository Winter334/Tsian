/**
 * 渐变流背景层
 * 轻量的多层渐变缓慢流动效果，用于标题页背景增强
 */

import { motion } from "framer-motion";

import { colorAlpha } from "@/styles/tokens";

export function GradientFlowOverlay() {
  return (
    <motion.div
      className="absolute inset-0 pointer-events-none"
      aria-hidden="true"
      style={{
        backgroundImage: `
          radial-gradient(140% 100% at 10% 0%, ${colorAlpha(
            "primary",
            0.2
          )} 0%, transparent 58%),
          radial-gradient(130% 120% at 90% 10%, ${colorAlpha(
            "secondary",
            0.18
          )} 0%, transparent 62%),
          linear-gradient(125deg, ${colorAlpha(
            "primaryDark",
            0.18
          )} 0%, ${colorAlpha("secondaryDark", 0.16)} 45%, ${colorAlpha(
          "primary",
          0.14
        )} 100%)
        `,
        backgroundSize: "170% 170%, 190% 190%, 180% 180%",
        backgroundPosition: "0% 0%, 100% 0%, 0% 50%",
        opacity: 0.34,
        willChange: "background-position, opacity",
      }}
      animate={{
        opacity: [0.28, 0.38, 0.3],
        backgroundPosition: [
          "0% 0%, 100% 0%, 0% 50%",
          "10% 14%, 92% 16%, 26% 48%",
          "-8% 4%, 106% -10%, 2% 56%",
        ],
      }}
      transition={{
        duration: 28,
        ease: "linear",
        repeat: Infinity,
      }}
    />
  );
}
