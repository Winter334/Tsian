import { MATRIX_CONFIG } from "@/config/app";
import { useEffect, useRef } from "react";

/**
 * 中文代码雨背景组件
 * 使用 Canvas 2D 绘制下落的中文字符
 * 优化：降低速度和亮度，更柔和的背景效果
 */
export function MatrixRain() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dropsRef = useRef<number[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { chars, fontSize, speed, color, headColor, fadeOpacity } =
      MATRIX_CONFIG;
    const charArray = chars.split("");

    const initDrops = () => {
      const columns = Math.max(1, Math.floor(canvas.width / fontSize));
      dropsRef.current = Array(columns)
        .fill(0)
        .map(() => Math.random() * -100);
    };

    // 设置画布大小
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      // 清空画布，避免残留（使用近乎纯黑的背景）
      ctx.fillStyle = "rgba(1, 2, 2, 1)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      initDrops();
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    // 绘制函数
    const draw = () => {
      // 半透明深黑覆盖，产生拖尾效果（匹配新背景色）
      ctx.fillStyle = `rgba(1, 2, 2, ${fadeOpacity})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.font = `${fontSize}px "Fira Code", monospace`;

      const drops = dropsRef.current;

      for (let i = 0; i < drops.length; i++) {
        // 随机选择字符
        const char = charArray[Math.floor(Math.random() * charArray.length)];

        // 计算位置
        const x = i * fontSize;
        const y = drops[i] * fontSize;

        // 头部字符更亮，其他字符使用低亮度
        const isHead = Math.random() > 0.97;
        ctx.fillStyle = isHead ? headColor : color;

        ctx.fillText(char, x, y);

        // 移动位置（使用更慢的速度）
        drops[i] += speed;

        // 随机重置到顶部（更稀疏的重置）
        if (drops[i] * fontSize > canvas.height && Math.random() > 0.99) {
          drops[i] = 0;
        }
      }
    };

    // 动画循环
    let animationId: number;
    const animate = () => {
      draw();
      animationId = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-0"
      style={{ background: "linear-gradient(to bottom, #010202, #000000)" }}
    />
  );
}
