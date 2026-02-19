import { PARTICLES_CONFIG } from "@/config/app";
import { color } from "@/styles/tokens";
import { useEffect, useMemo, useState } from "react";

interface Particle {
  id: number;
  char: string;
  left: string;
  animationDelay: string;
  animationDuration: string;
}

/**
 * 静态样式（不依赖动态值）
 */
const staticStyles: React.CSSProperties = {
  position: "absolute",
  bottom: 0,
  fontSize: "1rem",
  fontFamily: "monospace",
  fontWeight: "bold",
  opacity: 0.9,
};

/**
 * 浮动粒子效果组件
 * 模仿示例项目的代码符号粒子动画
 */
export function FloatingParticles() {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    const { count, chars, durationRange } = PARTICLES_CONFIG;
    const newParticles = Array.from({ length: count }, (_, i) => ({
      id: i,
      char: chars[Math.floor(Math.random() * chars.length)],
      left: Math.random() * 100 + "%",
      animationDelay: Math.random() * 8 + "s",
      animationDuration:
        durationRange[0] +
        Math.random() * (durationRange[1] - durationRange[0]) +
        "s",
    }));
    setParticles(newParticles);
  }, []);

  // 🔧 性能优化：缓存动态样式，避免每次渲染都创建新对象
  const particleStyles = useMemo(() => {
    const primaryColor = color("primary");
    const textShadow = `0 0 8px ${primaryColor}, 0 0 12px ${primaryColor}`;

    return particles.map((p) => ({
      ...staticStyles,
      left: p.left,
      color: primaryColor,
      textShadow,
      animationDelay: p.animationDelay,
      animationDuration: p.animationDuration,
    }));
  }, [particles]);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-10">
      {particles.map((p, index) => (
        <div
          key={p.id}
          className="particle-float"
          style={particleStyles[index]}
        >
          {p.char}
        </div>
      ))}
    </div>
  );
}
