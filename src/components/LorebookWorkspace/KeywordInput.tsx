/**
 * 关键词 Tag 输入组件
 *
 * 设计文档 6.3 节：
 * - 回车、逗号、换行触发分词
 * - 自动 trim + 去重
 * - 空字符串不入库
 * - Tag 形式展示，可单独删除
 * - 超长关键词截断显示，悬浮显示完整文本
 */

import { X } from "lucide-react";
import {
  useCallback,
  useRef,
  useState,
  type ClipboardEvent,
  type KeyboardEvent,
} from "react";

import { cn } from "@/lib/utils";
import { animation, borders, color, colorAlpha, glow } from "@/styles/tokens";

interface KeywordInputProps {
  /** 当前关键词列表 */
  keywords: string[];
  /** 关键词变更回调 */
  onChange: (keywords: string[]) => void;
  /** 占位文本 */
  placeholder?: string;
  /** 是否禁用 */
  disabled?: boolean;
}

/** 分隔符正则：逗号、换行 */
const SEPARATOR_REGEX = /[,，\n]+/;

/**
 * 将输入文本解析为关键词数组
 * 自动 trim + 去重 + 过滤空串
 */
function parseKeywords(text: string, existing: string[]): string[] {
  const tokens = text
    .split(SEPARATOR_REGEX)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);

  // 去重（与已有关键词合并后去重）
  const existingSet = new Set(existing);
  const newKeywords: string[] = [];
  for (const token of tokens) {
    if (!existingSet.has(token)) {
      existingSet.add(token);
      newKeywords.push(token);
    }
  }
  return newKeywords;
}

export function KeywordInput({
  keywords,
  onChange,
  placeholder = "输入关键词，回车或逗号分隔",
  disabled = false,
}: KeywordInputProps) {
  const [inputValue, setInputValue] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // 提交当前输入值
  const commitInput = useCallback(() => {
    if (!inputValue.trim()) return;

    const newKeywords = parseKeywords(inputValue, keywords);
    if (newKeywords.length > 0) {
      onChange([...keywords, ...newKeywords]);
    }
    setInputValue("");
  }, [inputValue, keywords, onChange]);

  // 键盘事件
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" || e.key === ",") {
        e.preventDefault();
        commitInput();
      }
      // Backspace 删除最后一个 Tag
      if (e.key === "Backspace" && inputValue === "" && keywords.length > 0) {
        onChange(keywords.slice(0, -1));
      }
    },
    [commitInput, inputValue, keywords, onChange]
  );

  // 粘贴事件：支持批量粘贴
  const handlePaste = useCallback(
    (e: ClipboardEvent<HTMLInputElement>) => {
      const pastedText = e.clipboardData.getData("text");
      if (SEPARATOR_REGEX.test(pastedText)) {
        e.preventDefault();
        // 合并当前输入值和粘贴内容
        const combinedText = inputValue + pastedText;
        const newKeywords = parseKeywords(combinedText, keywords);
        if (newKeywords.length > 0) {
          onChange([...keywords, ...newKeywords]);
        }
        setInputValue("");
      }
    },
    [inputValue, keywords, onChange]
  );

  // 失焦时提交残留输入
  const handleBlur = useCallback(() => {
    setIsFocused(false);
    commitInput();
  }, [commitInput]);

  // 删除单个关键词
  const removeKeyword = useCallback(
    (index: number) => {
      onChange(keywords.filter((_, i) => i !== index));
    },
    [keywords, onChange]
  );

  // 点击容器聚焦到输入框
  const handleContainerClick = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-1.5",
        "min-h-12 w-full px-3 py-2",
        "rounded-lg border-2",
        "cursor-text",
        "transition-all duration-200",
        disabled && "opacity-50 cursor-not-allowed"
      )}
      style={{
        background: colorAlpha("bgCard", 0.5),
        borderColor: isFocused
          ? colorAlpha("primary", 0.7)
          : colorAlpha("primary", 0.5),
        boxShadow: isFocused
          ? `${glow("primary", "md", 0.5)}, 0 0 20px ${colorAlpha(
              "primary",
              0.3
            )}`
          : "none",
      }}
      onClick={handleContainerClick}
    >
      {/* 已有关键词 Tags */}
      {keywords.map((keyword, index) => (
        <KeywordTag
          key={`${keyword}-${index}`}
          keyword={keyword}
          onRemove={() => removeKeyword(index)}
          disabled={disabled}
        />
      ))}

      {/* 输入框 */}
      {!disabled && (
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onFocus={() => setIsFocused(true)}
          onBlur={handleBlur}
          placeholder={keywords.length === 0 ? placeholder : ""}
          className={cn(
            "flex-1 min-w-30 bg-transparent",
            "text-sm outline-none",
            "placeholder:opacity-50"
          )}
          style={{
            color: color("textSecondary"),
          }}
        />
      )}
    </div>
  );
}

// ===== 子组件 =====

interface KeywordTagProps {
  keyword: string;
  onRemove: () => void;
  disabled?: boolean;
}

/**
 * 单个关键词 Tag
 * 超长截断显示，悬浮显示完整文本
 */
function KeywordTag({ keyword, onRemove, disabled }: KeywordTagProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1",
        "max-w-50",
        "px-2 py-0.5",
        "rounded-md",
        "text-xs font-medium",
        "transition-all"
      )}
      style={{
        background: colorAlpha("primary", 0.12),
        color: color("primary"),
        border: `1px solid ${colorAlpha("primary", 0.25)}`,
        borderRadius: borders.radius.sm,
      }}
      title={keyword}
    >
      <span className="truncate">{keyword}</span>
      {!disabled && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className={cn("shrink-0 p-0.5 rounded-sm", "transition-all")}
          style={{
            color: colorAlpha("primary", 0.6),
            transitionDuration: `${animation.duration.fast * 1000}ms`,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = color("error");
            e.currentTarget.style.background = colorAlpha("error", 0.15);
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = colorAlpha("primary", 0.6);
            e.currentTarget.style.background = "transparent";
          }}
          aria-label={`删除关键词 ${keyword}`}
        >
          <X size={12} />
        </button>
      )}
    </span>
  );
}
