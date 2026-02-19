import { TITLE_CONFIG } from "@/config/splash";
import { colorAlpha } from "@/styles/tokens";
import {
  forwardRef,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

/**
 * 条幅配置接口
 */
interface BannerConfig {
  /** 是否启用 */
  enabled: boolean;
  /** 倾斜角度（度），正数向右倾斜 */
  angle: number;
  /** 条幅宽度（像素） */
  width: number;
  /** 条幅水平位置百分比（从左边） */
  position: number;
  /** 背景不透明度 */
  bgOpacity: number;
  /** 主条幅（向下滚动） */
  primary: {
    text: string;
    fontSize: number;
    speed: number;
    opacity: number;
  };
  /** 副条幅（向上滚动） */
  secondary: {
    text: string;
    fontSize: number;
    speed: number;
    opacity: number;
  };
}

/**
 * 组件属性
 */
interface DiagonalBannersProps {
  /** 自定义配置，覆盖默认配置 */
  config?: Partial<BannerConfig>;
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: BannerConfig = {
  enabled: true,
  angle: 12,
  width: 280,
  position: 62, // 屏幕 62% 位置
  bgOpacity: 0.95, // 更不透明
  primary: {
    text: "神経接続・意識覚醒・記憶同期・系統就緒・感知覚醒・神経回路・",
    fontSize: 56,
    speed: 90, // 更快
    opacity: 0.75,
  },
  secondary: {
    text: "NEURAL LINK・SYSTEM READY・PROTOCOL ENGAGED・CONSCIOUSNESS SYNC・",
    fontSize: 42,
    speed: 65, // 速度差异更大
    opacity: 0.55,
  },
};

/**
 * 从配置文件获取条幅配置
 */
function getBannerConfig(): BannerConfig {
  const splashConfig = (TITLE_CONFIG as Record<string, unknown>)
    .diagonalBanners as Partial<BannerConfig> | undefined;

  if (splashConfig) {
    return {
      ...DEFAULT_CONFIG,
      ...splashConfig,
      primary: { ...DEFAULT_CONFIG.primary, ...splashConfig.primary },
      secondary: { ...DEFAULT_CONFIG.secondary, ...splashConfig.secondary },
    };
  }

  return DEFAULT_CONFIG;
}

/**
 * 斜向条幅组件
 *
 * 创建一个宽的垂直条幅带，视觉上分割屏幕：
 * - 左侧区域放置 Logo
 * - 右侧区域放置菜单
 * - 条幅内有两列竖排文字，方向相反
 *
 * Phase 4: 标题屏幕背景重新设计
 */
export function DiagonalBanners({
  config: customConfig,
}: DiagonalBannersProps) {
  const config = { ...getBannerConfig(), ...customConfig };

  if (!config.enabled) {
    return null;
  }

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none">
      {/* 主条幅带 - 不透明背景 */}
      <div
        className="absolute"
        style={{
          left: `${config.position}%`,
          top: "50%",
          width: `${config.width}px`,
          height: "300vh",
          transform: `translateX(-50%) translateY(-50%) rotate(${config.angle}deg)`,
          transformOrigin: "center center",
          // 使用更深的黑色背景，增强对比度
          background: `linear-gradient(to right,
            transparent 0%,
            rgba(0, 0, 0, ${config.bgOpacity * 0.5}) 8%,
            rgba(0, 0, 0, ${config.bgOpacity}) 20%,
            rgba(0, 0, 0, ${config.bgOpacity}) 80%,
            rgba(0, 0, 0, ${config.bgOpacity * 0.5}) 92%,
            transparent 100%
          )`,
        }}
      >
        {/* 两列文字容器 */}
        <div className="relative w-full h-full flex justify-around">
          {/* 左列：向下滚动 */}
          <VerticalScrollText
            text={config.primary.text}
            fontSize={config.primary.fontSize}
            speed={config.primary.speed}
            opacity={config.primary.opacity}
            direction="down"
          />

          {/* 右列：向上滚动 */}
          <VerticalScrollText
            text={config.secondary.text}
            fontSize={config.secondary.fontSize}
            speed={config.secondary.speed}
            opacity={config.secondary.opacity}
            direction="up"
          />
        </div>
      </div>
    </div>
  );
}

/**
 * 垂直滚动文字属性
 */
interface VerticalScrollTextProps {
  text: string;
  fontSize: number;
  speed: number;
  opacity: number;
  direction: "up" | "down";
}

/**
 * 垂直滚动文字组件
 * 使用双倍内容实现无缝循环
 */
function VerticalScrollText({
  text,
  fontSize,
  speed,
  opacity,
  direction,
}: VerticalScrollTextProps) {
  const repeatedText = useMemo(() => text.repeat(8), [text]);
  const contentRef = useRef<HTMLSpanElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const hasLockedHeight = useRef(false);
  const [contentHeight, setContentHeight] = useState<number | null>(null);
  const [measureKey, setMeasureKey] = useState(0);

  useEffect(() => {
    const handleResize = () => {
      hasLockedHeight.current = false;
      setContentHeight(null);
      setMeasureKey((prev) => prev + 1);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useLayoutEffect(() => {
    const element = contentRef.current;
    if (!element || hasLockedHeight.current) {
      return;
    }

    let cancelled = false;

    const measureOnce = () => {
      if (cancelled || hasLockedHeight.current) {
        return;
      }

      const nextHeight = Math.max(
        1,
        Math.round(element.getBoundingClientRect().height)
      );

      if (nextHeight > 0) {
        hasLockedHeight.current = true;
        setContentHeight(nextHeight);
      }
    };

    if (typeof document !== "undefined" && "fonts" in document) {
      document.fonts.ready.then(() => {
        requestAnimationFrame(measureOnce);
      });
    } else {
      requestAnimationFrame(measureOnce);
    }

    return () => {
      cancelled = true;
    };
  }, [repeatedText, fontSize, measureKey]);

  useEffect(() => {
    if (!contentHeight) {
      return;
    }

    const element = trackRef.current;
    if (!element) {
      return;
    }

    const height = contentHeight;
    const pixelsPerSecond = (height * Math.max(speed, 1)) / 4000;
    let lastTime = performance.now();
    let offset = 0;
    let rafId = 0;

    const applyTransform = (value: number) => {
      element.style.transform = `translate3d(0, ${value}px, 0)`;
    };

    applyTransform(direction === "down" ? -height : 0);

    const tick = (now: number) => {
      const delta = Math.max(0, (now - lastTime) / 1000);
      lastTime = now;
      offset = (offset + pixelsPerSecond * delta) % height;

      const translateY = direction === "down" ? -height + offset : -offset;

      applyTransform(translateY);
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [contentHeight, direction, speed]);

  return (
    <div
      className="relative overflow-hidden h-full"
      style={{
        writingMode: "vertical-rl",
        textOrientation: "mixed",
      }}
    >
      {/*
        两份完全相同的内容实现无缝循环
        使用 requestAnimationFrame 推动位移，避免 CSS 循环端点跳变
      */}
      <div
        ref={trackRef}
        className="flex flex-col"
        style={{
          willChange: "transform",
        }}
      >
        {/* 第一份内容 */}
        <TextContent
          ref={contentRef}
          text={repeatedText}
          fontSize={fontSize}
          opacity={opacity}
        />
        {/* 第二份内容（完全相同，用于无缝循环） */}
        <TextContent
          text={repeatedText}
          fontSize={fontSize}
          opacity={opacity}
        />
      </div>
    </div>
  );
}

/**
 * 文字内容组件 - 单独提取以确保两份内容完全相同
 */
interface TextContentProps {
  text: string;
  fontSize: number;
  opacity: number;
}

const TextContent = forwardRef<HTMLSpanElement, TextContentProps>(
  function TextContent({ text, fontSize, opacity }, ref) {
    return (
      <span
        ref={ref}
        style={{
          display: "block",
          fontSize: `${fontSize}px`,
          fontFamily: '"Noto Sans JP", "Orbitron", sans-serif',
          fontWeight: 700,
          letterSpacing: "0.2em",
          lineHeight: 1.5,
          color: colorAlpha("textPrimary", opacity),
          textShadow: `
            0 0 20px ${colorAlpha("primary", opacity * 0.5)},
            0 0 40px ${colorAlpha("primary", opacity * 0.3)}
          `,
          whiteSpace: "nowrap",
          // 确保高度一致
          flexShrink: 0,
        }}
      >
        {text}
      </span>
    );
  }
);

export default DiagonalBanners;
