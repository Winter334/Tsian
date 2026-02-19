import { APP_CONFIG } from "@/config/app";
import { color, colorAlpha } from "@/styles/tokens";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";

/**
 * Logo 组件
 * 故障霓虹灯效果版本
 * - RGB 色彩分离
 * - 轻微随机抖动
 * - 随机闪烁效果
 * - 霓虹发光
 */
export function Logo() {
  const [glitchTrigger, setGlitchTrigger] = useState(0);

  // 随机触发故障效果
  useEffect(() => {
    const interval = setInterval(() => {
      if (Math.random() > 0.7) {
        setGlitchTrigger((prev) => prev + 1);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const baseNeonFilter = `drop-shadow(0 0 10px ${colorAlpha("primary", 0.8)}) drop-shadow(0 0 20px ${colorAlpha("secondary", 0.6)}) drop-shadow(0 0 30px ${colorAlpha("primary", 0.4)})`;
  const intenseNeonFilter = `drop-shadow(0 0 15px ${colorAlpha("primary", 1)}) drop-shadow(0 0 30px ${colorAlpha("secondary", 0.8)}) drop-shadow(0 0 45px ${colorAlpha("primary", 0.6)})`;

  return (
    <motion.div
      className="relative flex flex-col items-center"
      initial={{ opacity: 0, scale: 0.9, y: -20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 1, ease: "easeOut" }}
    >
      {/* 外层霓虹光晕 */}
      <motion.div
        className="absolute inset-0 blur-3xl pointer-events-none"
        animate={{
          opacity: [0.4, 0.7, 0.4],
          scale: [1, 1.05, 1],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      >
        <div
          className="w-full h-full"
          style={{
            background: `radial-gradient(ellipse at center, ${colorAlpha(
              "primary",
              0.4,
            )} 0%, ${colorAlpha("secondary", 0.3)} 50%, transparent 70%)`,
          }}
        />
      </motion.div>

      {/* RGB 色彩分离效果 - Teal 通道 */}
      <motion.h1
        key={`teal-${glitchTrigger}`}
        className="absolute text-6xl md:text-8xl lg:text-9xl font-bold text-center pointer-events-none"
        style={{
          color: color("secondary"),
          fontFamily: '"Orbitron", "Fira Code", monospace',
          letterSpacing: "0.15em",
          mixBlendMode: "screen",
          opacity: 0.7,
        }}
        animate={{
          x: [0, -2, 0, -1, 0],
          opacity: [0.7, 0.5, 0.7, 0.6, 0.7],
        }}
        transition={{
          duration: 0.15,
          times: [0, 0.25, 0.5, 0.75, 1],
          repeat: Infinity,
          repeatDelay: 4,
        }}
      >
        {APP_CONFIG.name}
      </motion.h1>

      {/* RGB 色彩分离效果 - Cyan 通道 */}
      <motion.h1
        key={`cyan-${glitchTrigger}`}
        className="absolute text-6xl md:text-8xl lg:text-9xl font-bold text-center pointer-events-none"
        style={{
          color: color("primary"),
          fontFamily: '"Orbitron", "Fira Code", monospace',
          letterSpacing: "0.15em",
          mixBlendMode: "screen",
          opacity: 0.7,
        }}
        animate={{
          x: [0, 2, 0, 1, 0],
          opacity: [0.7, 0.5, 0.7, 0.6, 0.7],
        }}
        transition={{
          duration: 0.15,
          times: [0, 0.25, 0.5, 0.75, 1],
          repeat: Infinity,
          repeatDelay: 4,
        }}
      >
        {APP_CONFIG.name}
      </motion.h1>

      {/* 主标题 - 带霓虹发光和轻微抖动 */}
      <motion.h1
        key={`main-${glitchTrigger}`}
        className="relative text-6xl md:text-8xl lg:text-9xl font-bold text-center"
        style={{
          background: `linear-gradient(135deg, ${color("primary")} 0%, ${color(
            "secondary",
          )} 50%, ${color("primary")} 100%)`,
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
          fontFamily: '"Orbitron", "Fira Code", monospace',
          letterSpacing: "0.15em",
          filter: baseNeonFilter,
        }}
        animate={{
          x: [0, -0.5, 0.5, 0, -0.3, 0.3, 0],
          y: [0, 0.3, -0.3, 0, 0.2, -0.2, 0],
          filter: [baseNeonFilter, intenseNeonFilter, baseNeonFilter],
        }}
        transition={{
          x: {
            duration: 0.2,
            repeat: Infinity,
            repeatDelay: 5,
          },
          y: {
            duration: 0.2,
            repeat: Infinity,
            repeatDelay: 5,
          },
          filter: {
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut",
          },
        }}
      >
        {APP_CONFIG.name}
      </motion.h1>

      {/* 随机闪烁效果 */}
      <motion.div
        key={`flicker-${glitchTrigger}`}
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `linear-gradient(135deg, ${colorAlpha(
            "primary",
            0.15,
          )}, ${colorAlpha("secondary", 0.15)})`,
          mixBlendMode: "screen",
        }}
        animate={{
          opacity: [0, 0.8, 0, 0.6, 0],
        }}
        transition={{
          duration: 0.1,
          times: [0, 0.1, 0.2, 0.3, 0.4],
          repeat: Infinity,
          repeatDelay: 6,
        }}
      />
    </motion.div>
  );
}
