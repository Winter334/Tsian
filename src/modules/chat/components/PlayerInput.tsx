/**
 * PlayerInput - 玩家输入组件（单人模式）
 *
 * 基于 BaseTextInput 构建，专用于单人游戏模式
 * 支持通过自定义事件填入选项内容
 *
 * 使用 Token 系统支持主题切换
 */

import { BaseTextInput, type BaseTextInputRef } from "@/components/ui";
import { useCallback, useEffect, useRef } from "react";

interface PlayerInputProps {
  onSubmit: (content: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export function PlayerInput({
  onSubmit,
  disabled = false,
  placeholder = "输入你的行动...",
  className,
}: PlayerInputProps) {
  const inputRef = useRef<BaseTextInputRef>(null);

  // 填入选项内容
  const fillChoice = useCallback((choice: string) => {
    inputRef.current?.setValue(choice);
    inputRef.current?.focus();
  }, []);

  // 暴露 fillChoice 方法给父组件（通过自定义事件）
  useEffect(() => {
    const handler = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      fillChoice(customEvent.detail);
    };
    window.addEventListener("lyra:fill-choice", handler);
    return () => {
      window.removeEventListener("lyra:fill-choice", handler);
    };
  }, [fillChoice]);

  return (
    <BaseTextInput
      ref={inputRef}
      onSubmit={onSubmit}
      disabled={disabled}
      placeholder={placeholder}
      className={className}
    />
  );
}
