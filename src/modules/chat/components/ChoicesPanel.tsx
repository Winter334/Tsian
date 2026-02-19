/**
 * ChoicesPanel - 选项面板组件
 * 可折叠的选项卡片列表
 * 使用 Token 系统支持主题切换
 */

import { cn } from "@/lib/utils";
import { animation, borders, color, colorAlpha } from "@/styles/tokens";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useMemo, useState } from "react";
import { ChoiceCard } from "./ChoiceCard";

interface ChoicesPanelProps {
  choices: string[];
  onSelect: (choice: string) => void;
  disabled?: boolean;
  className?: string;
}

export function ChoicesPanel({
  choices,
  onSelect,
  disabled = false,
  className,
}: ChoicesPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  // 使用 Token 系统计算样式
  const panelStyles = useMemo(() => {
    return {
      borderColor: colorAlpha("border", 0.5),
      background: colorAlpha("bgCard", 0.3),
    };
  }, []);

  const buttonStyles = useMemo(() => {
    return {
      color: isHovered ? color("primaryLight") : color("textSecondary"),
      background: isHovered ? colorAlpha("bgElevated", 0.3) : "transparent",
    };
  }, [isHovered]);

  if (choices.length === 0) {
    return null;
  }

  return (
    <div
      className={cn("border", className)}
      style={{
        ...panelStyles,
        borderRadius: borders.radius.lg,
      }}
    >
      {/* 折叠控制条 */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={cn(
          "w-full flex items-center justify-between",
          "px-4 py-3",
          "text-sm",
          `transition-colors duration-[${animation.duration.normal * 1000}ms]`
        )}
        style={{
          ...buttonStyles,
          borderTopLeftRadius: borders.radius.lg,
          borderTopRightRadius: borders.radius.lg,
          borderBottomLeftRadius: isExpanded ? 0 : borders.radius.lg,
          borderBottomRightRadius: isExpanded ? 0 : borders.radius.lg,
        }}
      >
        <span>可选行动</span>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4" />
        ) : (
          <ChevronDown className="w-4 h-4" />
        )}
      </button>

      {/* 选项列表 */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: animation.duration.normal }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-2">
              {choices.map((choice, index) => (
                <ChoiceCard
                  key={index}
                  text={choice}
                  onClick={onSelect}
                  disabled={disabled}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
