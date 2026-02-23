/**
 * BaseTextInput - 基础文本输入组件
 *
 * 提供自动调整高度的文本输入框基础功能
 * 供 PlayerInput（单人模式）和 ActionInput（联机模式）复用
 *
 * 使用 Token 系统支持主题切换
 */

import { StarfieldBackground } from "@/components/effects/StarfieldBackground";
import { useThemeEffectSwitches } from "@/hooks";
import { cn } from "@/lib/utils";
import { animation, borders, color, colorAlpha } from "@/styles/tokens";
import { Send } from "lucide-react";
import {
  forwardRef,
  KeyboardEvent,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";

// ===== 类型定义 =====

export interface BaseTextInputProps {
  /** 提交回调 */
  onSubmit: (content: string) => void;
  /** 内容变化回调 */
  onChange?: (content: string) => void;
  /** 是否禁用 */
  disabled?: boolean;
  /** 占位文本 */
  placeholder?: string;
  /** 初始值 */
  initialValue?: string;
  /** 自定义样式类 */
  className?: string;
  /** 是否显示提交按钮 */
  showSubmitButton?: boolean;
  /** 自定义提交按钮 */
  submitButton?: React.ReactNode;
  /** 输入框左侧内容（如联机 Host 控制按钮） */
  leadingContent?: React.ReactNode;
  /** 额外的操作按钮（显示在提交按钮左侧） */
  extraButtons?: React.ReactNode;
  /** 受控模式：外部控制的值 */
  value?: string;
  /** 受控模式：外部设置值 */
  onValueChange?: (value: string) => void;
  /** 是否只读 */
  readOnly?: boolean;
  /** 最大高度（像素） */
  maxHeight?: number;
}

export interface BaseTextInputRef {
  /** 获取当前值 */
  getValue: () => string;
  /** 设置值 */
  setValue: (value: string) => void;
  /** 聚焦输入框 */
  focus: () => void;
  /** 清空输入框 */
  clear: () => void;
  /** 获取 textarea 元素 */
  getTextarea: () => HTMLTextAreaElement | null;
}

// ===== 组件实现 =====

export const BaseTextInput = forwardRef<BaseTextInputRef, BaseTextInputProps>(
  (
    {
      onSubmit,
      onChange,
      disabled = false,
      placeholder = "输入内容...",
      initialValue = "",
      className,
      showSubmitButton = true,
      submitButton,
      leadingContent,
      extraButtons,
      value: controlledValue,
      onValueChange,
      readOnly = false,
      maxHeight = 200,
    },
    ref,
  ) => {
    // 内部状态（非受控模式）
    const [internalValue, setInternalValue] = useState(initialValue);
    const [isFocused, setIsFocused] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const { isGlassEffectEnabled, isParticlesEnabled, isStrongGlowEnabled } =
      useThemeEffectSwitches();

    const showInputParticles = isParticlesEnabled;

    // 受控/非受控值处理
    const isControlled = controlledValue !== undefined;
    const value = isControlled ? controlledValue : internalValue;
    const setValue = useCallback(
      (newValue: string) => {
        if (isControlled) {
          onValueChange?.(newValue);
        } else {
          setInternalValue(newValue);
        }
        onChange?.(newValue);
      },
      [isControlled, onValueChange, onChange],
    );

    // 暴露方法给父组件
    useImperativeHandle(ref, () => ({
      getValue: () => value,
      setValue: (newValue: string) => setValue(newValue),
      focus: () => textareaRef.current?.focus(),
      clear: () => setValue(""),
      getTextarea: () => textareaRef.current,
    }));

    // 容器样式
    const containerStyles = useMemo(() => {
      return {
        borderTop: `2px solid ${colorAlpha(
          "primary",
          isStrongGlowEnabled ? 0.6 : 0.35,
        )}`,
        background: colorAlpha("bgCard", isGlassEffectEnabled ? 0.7 : 0.9),
        backdropFilter: `blur(${isGlassEffectEnabled ? 12 : 4}px)`,
        boxShadow: isStrongGlowEnabled
          ? `0 -4px 20px ${colorAlpha("primary", 0.15)}`
          : `0 -2px 10px ${colorAlpha("border", 0.2)}`,
      };
    }, [isGlassEffectEnabled, isStrongGlowEnabled]);

    // 输入框样式
    const textareaStyles = useMemo(() => {
      return {
        background: colorAlpha("bgCard", isGlassEffectEnabled ? 0.5 : 0.72),
        borderColor: isFocused
          ? colorAlpha("primary", isStrongGlowEnabled ? 0.8 : 0.6)
          : colorAlpha("primary", isStrongGlowEnabled ? 0.6 : 0.45),
        color: color("textPrimary"),
        boxShadow: isFocused
          ? isStrongGlowEnabled
            ? `0 0 25px ${colorAlpha("primary", 0.55)}, 0 0 45px ${colorAlpha(
                "secondary",
                0.3,
              )}`
            : `0 0 0 2px ${colorAlpha("primary", 0.25)}, 0 0 12px ${colorAlpha(
                "primary",
                0.18,
              )}`
          : isGlassEffectEnabled
            ? `0 0 8px ${colorAlpha("primary", 0.2)}`
            : `0 0 0 1px ${colorAlpha("border", 0.2)}`,
      };
    }, [isGlassEffectEnabled, isFocused, isStrongGlowEnabled]);

    // 按钮样式
    const buttonStyles = useMemo(() => {
      const canSubmit = !disabled && !readOnly && value.trim();
      return {
        background: color("primary"),
        color: color("textPrimary"),
        opacity: canSubmit ? 1 : 0.5,
        cursor: canSubmit ? "pointer" : "not-allowed",
        boxShadow: canSubmit
          ? `0 0 ${isStrongGlowEnabled ? 15 : 8}px ${colorAlpha(
              "primary",
              isStrongGlowEnabled ? 0.5 : 0.3,
            )}`
          : "none",
      };
    }, [disabled, isStrongGlowEnabled, readOnly, value]);

    // 自动调整高度
    useEffect(() => {
      const textarea = textareaRef.current;
      if (textarea) {
        textarea.style.height = "auto";
        textarea.style.height = `${Math.min(
          textarea.scrollHeight,
          maxHeight,
        )}px`;
      }
    }, [value, maxHeight]);

    // 提交处理
    const handleSubmit = useCallback(() => {
      const trimmed = value.trim();
      if (trimmed && !disabled && !readOnly) {
        onSubmit(trimmed);
        // 非受控模式下，提交后清空
        if (!isControlled) {
          setInternalValue("");
        }
      }
    }, [value, disabled, readOnly, onSubmit, isControlled]);

    // 键盘事件处理
    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
      // Enter 发送，Shift+Enter 换行
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    };

    // 默认提交按钮
    const defaultSubmitButton = (
      <button
        type="button"
        onClick={handleSubmit}
        disabled={disabled || readOnly || !value.trim()}
        className={cn(
          "p-3.5",
          `transition-all duration-[${animation.duration.normal * 1000}ms]`,
          "hover:scale-105 active:scale-95",
        )}
        style={{
          ...buttonStyles,
          borderRadius: borders.radius.lg,
        }}
        onMouseEnter={(e) => {
          if (!disabled && !readOnly && value.trim()) {
            e.currentTarget.style.background = color("primaryLight");
            e.currentTarget.style.boxShadow = `0 0 ${
              isStrongGlowEnabled ? 20 : 12
            }px ${colorAlpha("primary", isStrongGlowEnabled ? 0.6 : 0.35)}`;
          }
        }}
        onMouseLeave={(e) => {
          if (!disabled && !readOnly && value.trim()) {
            e.currentTarget.style.background = color("primary");
            e.currentTarget.style.boxShadow = `0 0 ${
              isStrongGlowEnabled ? 15 : 8
            }px ${colorAlpha("primary", isStrongGlowEnabled ? 0.5 : 0.3)}`;
          }
        }}
      >
        <Send className="w-5 h-5" />
      </button>
    );

    return (
      <div
        className={cn("relative overflow-hidden px-4 py-4", className)}
        style={containerStyles}
      >
        {showInputParticles && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ zIndex: 0 }}
          >
            <StarfieldBackground transparentBackground useThemeColors />
          </div>
        )}
        <div className="relative z-10 w-full flex items-end gap-3">
          {leadingContent}
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            disabled={disabled}
            readOnly={readOnly}
            placeholder={placeholder}
            rows={1}
            className={cn(
              "flex-1 resize-none",
              "border-2 px-4 py-3 text-base font-medium",
              "focus:outline-none",
              `transition-all duration-[${animation.duration.normal * 1000}ms]`,
              "scrollbar-none",
              disabled && "opacity-50 cursor-not-allowed",
              readOnly && "cursor-default",
            )}
            style={
              {
                ...textareaStyles,
                borderRadius: borders.radius.lg,
                "--tw-placeholder-color": color("textMuted"),
              } as React.CSSProperties
            }
            onMouseEnter={(e) => {
              if (!isFocused && !disabled && !readOnly) {
                (e.currentTarget as HTMLTextAreaElement).style.borderColor =
                  colorAlpha("primary", isStrongGlowEnabled ? 0.7 : 0.6);
                (e.currentTarget as HTMLTextAreaElement).style.boxShadow =
                  `0 0 ${
                    isStrongGlowEnabled ? 12 : 8
                  }px ${colorAlpha("primary", isStrongGlowEnabled ? 0.3 : 0.16)}`;
              }
            }}
            onMouseLeave={(e) => {
              if (!isFocused && !disabled && !readOnly) {
                (e.currentTarget as HTMLTextAreaElement).style.borderColor =
                  colorAlpha("primary", isStrongGlowEnabled ? 0.6 : 0.45);
                (e.currentTarget as HTMLTextAreaElement).style.boxShadow =
                  isGlassEffectEnabled
                    ? `0 0 8px ${colorAlpha("primary", 0.2)}`
                    : `0 0 0 1px ${colorAlpha("border", 0.2)}`;
              }
            }}
          />
          {extraButtons}
          {showSubmitButton && (submitButton || defaultSubmitButton)}
        </div>
      </div>
    );
  },
);

BaseTextInput.displayName = "BaseTextInput";
