import { color } from "@/styles/tokens";
import { useEffect, useMemo, useRef } from "react";

const SVG_NS = "http://www.w3.org/2000/svg";
const MAX_POINTS = 28;
const MIN_BURST_SPEED = 0.6;
const BASE_BURST_CHANCE = 0.32;

interface MouseEffectProps {
  className?: string;
}

interface TrailPoint {
  position: { x: number; y: number };
  direction: { x: number; y: number };
  drift: { x: number; y: number };
  bornAt: number;
  age: number;
}

interface FollowerProfile {
  trailColor: string;
  burstColor: string;
  opacity: number;
  removeDelay: number;
  driftScale: number;
}

interface FollowerState extends FollowerProfile {
  path: SVGPathElement;
  points: TrailPoint[];
}

/**
 * 鼠标交互特效（SVG）
 * - 参考 zippity-zappity 示例
 * - 事件驱动 + 按需 RAF，空闲时自动停帧
 * - 使用主题 Token 颜色，适配标题页整体风格
 */
export function MouseEffect({ className = "" }: MouseEffectProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);

  const followerProfiles = useMemo<FollowerProfile[]>(
    () => [
      {
        trailColor: color("primary"),
        burstColor: color("primary"),
        opacity: 0.2,
        removeDelay: 240,
        driftScale: 0.8,
      },
      {
        trailColor: color("secondary"),
        burstColor: color("secondary"),
        opacity: 0.14,
        removeDelay: 320,
        driftScale: 1,
      },
      {
        trailColor: color("primary"),
        burstColor: color("secondary"),
        opacity: 0.1,
        removeDelay: 420,
        driftScale: 1.2,
      },
    ],
    [],
  );

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const profiles = prefersReducedMotion
      ? followerProfiles.slice(0, 1)
      : followerProfiles;
    const pointCap = prefersReducedMotion ? 12 : MAX_POINTS;
    const burstChance = prefersReducedMotion ? 0 : BASE_BURST_CHANCE;

    svg.replaceChildren();

    const trailLayer = document.createElementNS(SVG_NS, "g");
    const burstLayer = document.createElementNS(SVG_NS, "g");
    trailLayer.setAttribute("data-layer", "trail");
    burstLayer.setAttribute("data-layer", "burst");
    svg.appendChild(trailLayer);
    svg.appendChild(burstLayer);

    const followers: FollowerState[] = profiles.map((profile) => {
      const path = document.createElementNS(SVG_NS, "path");
      path.style.fill = profile.trailColor;
      path.style.opacity = String(profile.opacity);
      path.style.mixBlendMode = "screen";
      trailLayer.appendChild(path);

      return {
        ...profile,
        path,
        points: [],
      };
    });

    const activeAnimations = new Set<Animation>();
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    const pendingPointer = { x: viewport.width / 2, y: viewport.height / 2 };

    let hasPendingPointer = false;
    let pointerRafId: number | null = null;
    let trailRafId: number | null = null;

    const updateViewport = () => {
      viewport.width = window.innerWidth;
      viewport.height = window.innerHeight;
      svg.setAttribute("width", String(viewport.width));
      svg.setAttribute("height", String(viewport.height));
      svg.setAttribute("viewBox", `0 0 ${viewport.width} ${viewport.height}`);
    };

    const createTrailPath = (points: TrailPoint[]): string => {
      if (points.length === 0) {
        return "";
      }

      const path: string[] = ["M"];
      let forward = true;
      let index = 0;

      while (index >= 0) {
        const point = points[index];
        const offsetFactor = ((index - points.length) / points.length) * 0.58;
        const offsetX = point.direction.x * offsetFactor;
        const offsetY = point.direction.y * offsetFactor;

        const x =
          point.position.x +
          (forward ? offsetY : -offsetY) +
          point.drift.x * point.age;
        const y =
          point.position.y +
          (forward ? offsetX : -offsetX) +
          point.drift.y * point.age;

        path.push(String(x), String(y));

        index += forward ? 1 : -1;
        if (index === points.length) {
          index -= 1;
          forward = false;
        }
      }

      return path.join(" ");
    };

    const startTrailLoop = () => {
      if (trailRafId !== null) {
        return;
      }

      const tick = (now: number) => {
        let hasActiveTrail = false;

        followers.forEach((follower) => {
          follower.points = follower.points.filter(
            (point) => now - point.bornAt < follower.removeDelay,
          );

          follower.points.forEach((point) => {
            point.age = (now - point.bornAt) * 0.0026;
          });

          follower.path.setAttribute("d", createTrailPath(follower.points));
          if (follower.points.length > 0) {
            hasActiveTrail = true;
          }
        });

        if (hasActiveTrail) {
          trailRafId = window.requestAnimationFrame(tick);
        } else {
          trailRafId = null;
        }
      };

      trailRafId = window.requestAnimationFrame(tick);
    };

    const removeShape = (shape: SVGElement, animation: Animation) => {
      activeAnimations.delete(animation);
      shape.remove();
    };

    const spawnBurst = (
      x: number,
      y: number,
      direction: { x: number; y: number },
      burstColor: string,
    ) => {
      const speed = Math.hypot(direction.x, direction.y);
      if (speed < MIN_BURST_SPEED || Math.random() > burstChance) {
        return;
      }

      // 根据速度决定同时生成多少个粒子（1-3个）
      const burstCount = speed > 4 ? (Math.random() < 0.4 ? 3 : 2) : 1;

      for (let b = 0; b < burstCount; b++) {
        const size = Math.max(6, Math.min(28, speed * 2.5));
        const variant = Math.random();
        let shape: SVGElement;

        if (variant < 0.33) {
          const circle = document.createElementNS(SVG_NS, "circle");
          circle.setAttribute("r", String(size * 0.55));
          circle.setAttribute("cx", "0");
          circle.setAttribute("cy", "0");
          shape = circle;
        } else if (variant < 0.66) {
          const rect = document.createElementNS(SVG_NS, "rect");
          const edge = size * 1.0;
          rect.setAttribute("x", String(-edge / 2));
          rect.setAttribute("y", String(-edge / 2));
          rect.setAttribute("width", String(edge));
          rect.setAttribute("height", String(edge));
          shape = rect;
        } else {
          const triangle = document.createElementNS(SVG_NS, "polygon");
          const edge = size * 1.1;
          triangle.setAttribute(
            "points",
            `0,${-edge / 2} ${edge / 2},${edge / 2} ${-edge / 2},${edge / 2}`,
          );
          shape = triangle;
        }

        shape.style.fill = burstColor;
        shape.style.mixBlendMode = "screen";
        burstLayer.appendChild(shape);

        const driftX =
          x +
          direction.x * (8 + Math.random() * 24) +
          (Math.random() - 0.5) * 36;
        const driftY =
          y +
          direction.y * (8 + Math.random() * 24) +
          (Math.random() - 0.5) * 36;
        const rotation = Math.random() * 360;

        const animation = shape.animate(
          [
            {
              opacity: 0.85,
              transform: `translate(${x}px, ${y}px) rotate(0deg) scale(1)`,
            },
            {
              opacity: 0,
              transform: `translate(${driftX}px, ${driftY}px) rotate(${rotation}deg) scale(0.05)`,
            },
          ],
          {
            duration: 500 + Math.random() * 700,
            easing: "cubic-bezier(0.16, 1, 0.3, 1)",
            fill: "forwards",
          },
        );

        activeAnimations.add(animation);
        animation.onfinish = () => removeShape(shape, animation);
        animation.oncancel = () => removeShape(shape, animation);
      }
    };

    const appendPoint = (x: number, y: number, now: number) => {
      followers.forEach((follower, followerIndex) => {
        const previousHead = follower.points[0];
        const direction = previousHead
          ? {
              x: (x - previousHead.position.x) * 0.28,
              y: (y - previousHead.position.y) * 0.28,
            }
          : { x: 0, y: 0 };

        const driftJitter = 1.4 + followerIndex * 0.5;
        const point: TrailPoint = {
          position: { x, y },
          direction,
          drift: {
            x:
              (Math.random() - 0.5) * driftJitter +
              direction.x * 0.45 * follower.driftScale,
            y:
              (Math.random() - 0.5) * driftJitter +
              direction.y * 0.45 * follower.driftScale,
          },
          bornAt: now,
          age: 0,
        };

        follower.points.unshift(point);
        if (follower.points.length > pointCap) {
          follower.points.length = pointCap;
        }

        // 前两个 follower 都产生爆裂粒子，第二个概率稍低
        if (followerIndex < 2) {
          spawnBurst(x, y, direction, follower.burstColor);
        }
      });

      startTrailLoop();
    };

    const flushPointer = () => {
      pointerRafId = null;
      if (!hasPendingPointer) {
        return;
      }
      hasPendingPointer = false;
      appendPoint(pendingPointer.x, pendingPointer.y, performance.now());
    };

    const handlePointerMove = (event: PointerEvent) => {
      pendingPointer.x = event.clientX;
      pendingPointer.y = event.clientY;
      hasPendingPointer = true;

      if (pointerRafId === null) {
        pointerRafId = window.requestAnimationFrame(flushPointer);
      }
    };

    const handlePointerDown = (event: PointerEvent) => {
      appendPoint(event.clientX, event.clientY, performance.now());
    };

    updateViewport();

    window.addEventListener("resize", updateViewport);
    window.addEventListener("pointermove", handlePointerMove, {
      passive: true,
    });
    window.addEventListener("pointerdown", handlePointerDown, {
      passive: true,
    });

    return () => {
      window.removeEventListener("resize", updateViewport);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerdown", handlePointerDown);

      if (pointerRafId !== null) {
        window.cancelAnimationFrame(pointerRafId);
      }
      if (trailRafId !== null) {
        window.cancelAnimationFrame(trailRafId);
      }

      activeAnimations.forEach((animation) => animation.cancel());
      activeAnimations.clear();
      svg.replaceChildren();
    };
  }, [followerProfiles]);

  return (
    <div className={`fixed inset-0 pointer-events-none ${className}`}>
      <svg
        ref={svgRef}
        className="h-full w-full"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
      />
    </div>
  );
}
