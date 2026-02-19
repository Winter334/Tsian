/**
 * 房间码输入组件
 *
 * 6位房间码输入，带点击/聚焦反馈与字符过渡动画
 */

import { AnimatePresence, motion } from "framer-motion";
import { useRef, useState, type ChangeEvent } from "react";

import { animation, borders, colorAlpha, glow } from "@/styles/tokens";

interface RoomCodeInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

const CODE_LENGTH = 6;
const SLOT_INDEXES = [0, 1, 2, 3, 4, 5] as const;

export function RoomCodeInput({
  value,
  onChange,
  disabled,
}: RoomCodeInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [focusPulseKey, setFocusPulseKey] = useState(0);

  const normalizedValue = value.slice(0, CODE_LENGTH);
  const activeIndex = Math.min(normalizedValue.length, CODE_LENGTH - 1);
  const showCursor = isFocused && normalizedValue.length < CODE_LENGTH;

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const formatted = e.target.value
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, CODE_LENGTH);

    onChange(formatted);
  };

  const handleFocus = () => {
    setIsFocused(true);
    setFocusPulseKey((prev) => prev + 1);
  };

  const handleBlur = () => {
    setIsFocused(false);
  };

  const handleContainerClick = () => {
    if (disabled) {
      return;
    }

    setFocusPulseKey((prev) => prev + 1);
    inputRef.current?.focus();
  };

  return (
    <div className="relative inline-block">
      <motion.div
        className="relative flex gap-2 cursor-text select-none"
        onClick={handleContainerClick}
        initial={false}
        whileTap={disabled ? undefined : { scale: 0.995 }}
      >
        {SLOT_INDEXES.map((index) => {
          const char = normalizedValue[index] ?? "";
          const isFilled = char.length > 0;
          const isActive = showCursor && index === activeIndex;

          return (
            <motion.div
              key={index}
              className="relative w-12 h-14 flex items-center justify-center overflow-hidden border-2 text-2xl font-mono font-bold"
              style={{
                borderRadius: borders.radius.md,
                borderColor: disabled
                  ? colorAlpha("border", 0.35)
                  : isActive
                  ? colorAlpha("primary", 0.9)
                  : isFilled
                  ? colorAlpha("primary", 0.65)
                  : colorAlpha("border", 0.5),
                background: disabled
                  ? colorAlpha("bgCard", 0.25)
                  : isFilled
                  ? `linear-gradient(135deg, ${colorAlpha(
                      "primary",
                      0.2
                    )} 0%, ${colorAlpha("secondary", 0.15)} 100%)`
                  : colorAlpha("bgCard", 0.35),
                boxShadow: disabled
                  ? "none"
                  : isActive
                  ? `${glow("primary", "md", 0.5)}, inset 0 0 16px ${colorAlpha(
                      "primary",
                      0.2
                    )}`
                  : isFilled
                  ? `0 0 12px ${colorAlpha("primary", 0.25)}`
                  : "none",
              }}
              initial={false}
              animate={{
                y: isActive ? [0, -1, 0] : 0,
              }}
              transition={
                isActive
                  ? {
                      duration: 1.1,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }
                  : {
                      duration: animation.duration.fast,
                    }
              }
            >
              {isActive && (
                <motion.div
                  className="absolute inset-x-1 bottom-1 h-0.5 rounded-full"
                  style={{ background: colorAlpha("primary", 0.95) }}
                  animate={{
                    opacity: [0.35, 1, 0.35],
                    scaleX: [0.8, 1, 0.8],
                  }}
                  transition={{
                    duration: 1,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />
              )}

              <AnimatePresence initial={false} mode="popLayout">
                {char ? (
                  <motion.span
                    key={`${index}-${char}`}
                    initial={{
                      opacity: 0,
                      y: 8,
                      scale: 0.7,
                      filter: "blur(2px)",
                    }}
                    animate={{
                      opacity: 1,
                      y: 0,
                      scale: 1,
                      filter: "blur(0px)",
                    }}
                    exit={{
                      opacity: 0,
                      y: -6,
                      scale: 0.8,
                      filter: "blur(2px)",
                    }}
                    transition={{
                      duration: animation.duration.normal,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                    style={{
                      color: colorAlpha("textSecondary", 1),
                      textShadow: `0 0 12px ${colorAlpha("primary", 0.55)}`,
                    }}
                  >
                    {char}
                  </motion.span>
                ) : (
                  <motion.span
                    key={`${index}-placeholder`}
                    className="text-base"
                    style={{ color: colorAlpha("textMuted", 0.9) }}
                    initial={{ opacity: 0 }}
                    animate={
                      isActive
                        ? {
                            opacity: [0.2, 0.5, 0.2],
                            scale: [0.9, 1, 0.9],
                          }
                        : { opacity: 0.14, scale: 1 }
                    }
                    exit={{ opacity: 0 }}
                    transition={
                      isActive
                        ? { duration: 1, repeat: Infinity, ease: "easeInOut" }
                        : { duration: animation.duration.fast }
                    }
                  >
                    —
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}

        <AnimatePresence>
          {isFocused && !disabled && (
            <motion.div
              key={focusPulseKey}
              className="pointer-events-none absolute inset-0"
              style={{
                borderRadius: borders.radius.lg,
                boxShadow: `0 0 0 2px ${colorAlpha("primary", 0.4)}`,
              }}
              initial={{ opacity: 0.65, scale: 0.985 }}
              animate={{ opacity: 0, scale: 1.02 }}
              exit={{ opacity: 0 }}
              transition={{
                duration: animation.duration.normal,
                ease: "easeOut",
              }}
            />
          )}
        </AnimatePresence>
      </motion.div>

      <input
        ref={inputRef}
        type="text"
        value={normalizedValue}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        className="absolute h-px w-px opacity-0 pointer-events-none"
        maxLength={CODE_LENGTH}
        disabled={disabled}
        autoFocus
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        aria-label="房间码输入"
      />
    </div>
  );
}
