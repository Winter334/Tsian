import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Play } from "lucide-react";

import { Button } from "@/components/ui";
import { useMotionTokens } from "@/hooks";
import { cn } from "@/lib/utils";
import { colorAlpha, glow } from "@/styles/tokens";

interface WizardFooterProps {
  onBack: () => void;
  onNext: () => void;
  canGoBack: boolean;
  canGoNext: boolean;
  nextLabel?: string;
  backLabel?: string;
  isLastStep?: boolean;
}

/**
 * 向导统一底部操作栏
 *
 * - 固定在底部，毛玻璃背景
 * - 左右分布按钮布局
 * - 最后一步显示 Play 图标 + 脉冲发光
 */
export function WizardFooter({
  onBack,
  onNext,
  canGoBack,
  canGoNext,
  nextLabel,
  backLabel = "返回",
  isLastStep = false,
}: WizardFooterProps) {
  const tokens = useMotionTokens();
  const resolvedNextLabel = nextLabel ?? (isLastStep ? "开始冒险" : "下一步");

  return (
    <div
      className={cn(
        "flex items-center px-4 py-3 md:px-6 md:py-4",
        canGoBack ? "justify-between" : "justify-end",
      )}
      style={{
        backgroundColor: colorAlpha("bgBase", 0.6),
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderTop: `1px solid ${colorAlpha("border", 0.2)}`,
      }}
    >
      {/* 返回按钮：canGoBack 为 false 时隐藏 */}
      {canGoBack && (
        <motion.div
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: tokens.duration.fast }}
        >
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ChevronLeft className="mr-1 h-4 w-4" />
            {backLabel}
          </Button>
        </motion.div>
      )}

      {/* 前进按钮 */}
      <motion.div
        initial={{ opacity: 0, x: 8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: tokens.duration.fast }}
      >
        {isLastStep ? (
          <motion.div
            animate={{
              boxShadow: [
                glow("primary", "md", 0.4),
                glow("primary", "lg", 0.7),
                glow("primary", "md", 0.4),
              ],
            }}
            transition={{
              duration: tokens.duration.slow * 4,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            style={{ borderRadius: 8 }}
          >
            <Button onClick={onNext} disabled={!canGoNext}>
              <Play className="mr-1.5 h-4 w-4" />
              {resolvedNextLabel}
            </Button>
          </motion.div>
        ) : (
          <Button onClick={onNext} disabled={!canGoNext}>
            {resolvedNextLabel}
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        )}
      </motion.div>
    </div>
  );
}
