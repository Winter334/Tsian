import { motion } from "framer-motion";

import { useMotionTokens } from "@/hooks";
import { cn } from "@/lib/utils";
import { color, colorAlpha, glow } from "@/styles/tokens";

interface WizardProgressBarProps {
  steps: Array<{ id: string; label: string }>;
  currentIndex: number;
  className?: string;
}

/**
 * 进度指示器组件 — 响应式双模式（移动端横向 / 桌面端纵向）
 */
export function WizardProgressBar({
  steps,
  currentIndex,
  className,
}: WizardProgressBarProps) {
  const tokens = useMotionTokens();
  const currentStepLabel = steps[currentIndex]?.label ?? "";

  return (
    <div
      className={cn(
        "flex w-full items-center justify-center",
        "md:h-full md:w-37.5 md:justify-center",
        className,
      )}
    >
      <div className="flex flex-row items-center justify-center md:h-full md:flex-col md:items-start md:justify-center">
        {steps.map((step, index) => {
          const isCompleted = index < currentIndex;
          const isCurrent = index === currentIndex;
          const isPending = index > currentIndex;

          return (
            <div
              key={step.id}
              className="flex flex-row items-center md:flex-col md:items-start"
            >
              {/* 步骤圆点 + 标签（移动端隐藏标签） */}
              <div className="flex items-center gap-1 md:gap-3">
                <div className="flex h-4 w-4 items-center justify-center">
                  <motion.div
                    className="relative z-10 flex items-center justify-center rounded-full"
                    style={{
                      width: isCurrent ? 14 : 10,
                      height: isCurrent ? 14 : 10,
                      backgroundColor: isCompleted
                        ? color("primary")
                        : isCurrent
                          ? colorAlpha("primary", 0.3)
                          : "transparent",
                      border: isPending
                        ? `2px solid ${colorAlpha("textMuted", 0.3)}`
                        : isCurrent
                          ? `2px solid ${color("primary")}`
                          : "none",
                      boxShadow: isCurrent
                        ? glow("primary", "md", 0.6)
                        : isCompleted
                          ? glow("primary", "sm", 0.3)
                          : "none",
                    }}
                    animate={{
                      scale: isCurrent ? [1, 1.15, 1] : 1,
                    }}
                    transition={
                      isCurrent
                        ? {
                            duration: tokens.duration.slow * 4,
                            repeat: Infinity,
                            ease: "easeInOut",
                          }
                        : { duration: tokens.duration.fast }
                    }
                  >
                    {isCompleted && (
                      <motion.div
                        className="rounded-full"
                        style={{
                          width: 4,
                          height: 4,
                          backgroundColor: color("bgBase"),
                        }}
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ duration: tokens.duration.fast }}
                      />
                    )}
                  </motion.div>
                </div>

                <motion.span
                  className="hidden whitespace-nowrap text-sm md:inline"
                  style={{
                    color: isCurrent
                      ? color("primary")
                      : isCompleted
                        ? color("textSecondary")
                        : color("textMuted"),
                    fontWeight: isCurrent ? 600 : 400,
                    textShadow: isCurrent
                      ? `0 0 10px ${colorAlpha("primary", 0.35)}`
                      : "none",
                  }}
                  animate={{
                    opacity: isPending ? 0.72 : 1,
                    x: isCurrent ? [0, 1.5, 0] : 0,
                  }}
                  transition={{
                    opacity: { duration: tokens.duration.fast },
                    x: isCurrent
                      ? {
                          duration: tokens.duration.slow * 4,
                          repeat: Infinity,
                          ease: "easeInOut",
                        }
                      : { duration: tokens.duration.fast },
                  }}
                >
                  {step.label}
                </motion.span>
              </div>

              {/* 连接线（最后一个步骤后不需要） */}
              {index < steps.length - 1 && (
                <>
                  {/* 移动端：横向连接线 */}
                  <div className="relative mx-1 h-0.5 w-4 md:hidden">
                    <div
                      className="absolute inset-0 rounded-full"
                      style={{
                        backgroundColor: colorAlpha("textMuted", 0.15),
                      }}
                    />
                    <motion.div
                      className="absolute inset-y-0 left-0 rounded-full"
                      style={{
                        backgroundColor: color("primary"),
                        boxShadow: glow("primary", "sm", 0.3),
                      }}
                      initial={false}
                      animate={{
                        width: isCompleted ? "100%" : isCurrent ? "50%" : "0%",
                      }}
                      transition={{
                        duration: tokens.duration.normal,
                        ease: tokens.easing.smooth,
                      }}
                    />
                  </div>

                  {/* 桌面端：纵向连接线 */}
                  <div className="relative my-1 ml-1.75 hidden h-8 w-0.5 md:block">
                    <div
                      className="absolute inset-0 rounded-full"
                      style={{
                        backgroundColor: colorAlpha("textMuted", 0.15),
                      }}
                    />
                    <motion.div
                      className="absolute inset-x-0 top-0 rounded-full"
                      style={{
                        backgroundColor: color("primary"),
                        boxShadow: glow("primary", "sm", 0.3),
                      }}
                      initial={false}
                      animate={{
                        height: isCompleted ? "100%" : isCurrent ? "50%" : "0%",
                      }}
                      transition={{
                        duration: tokens.duration.normal,
                        ease: tokens.easing.smooth,
                      }}
                    />
                  </div>
                </>
              )}
            </div>
          );
        })}
        <motion.span
          className="ml-2 max-w-32 truncate whitespace-nowrap text-xs font-medium tracking-wide md:hidden"
          style={{
            color: color("primary"),
            textShadow: `0 0 10px ${colorAlpha("primary", 0.35)}`,
          }}
          animate={{ opacity: [0.78, 1, 0.78] }}
          transition={{
            duration: tokens.duration.slow * 4,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          {currentStepLabel}
        </motion.span>
      </div>
    </div>
  );
}
