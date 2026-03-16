import { postProcess } from "@/lib/post-process";
import { BUILTIN_RULES } from "@/lib/post-process/builtin-rules";
import { mergeRules } from "@/lib/post-process/merge";
import type { PostProcessRule } from "@/lib/post-process/types";

const CHOICES_OPEN_TAG = "<choices>";
const CHOICES_CLOSE_TAG = "</choices>";
const CHOICES_TAG_PREFIXES = [CHOICES_OPEN_TAG, CHOICES_CLOSE_TAG];

/**
 * 游戏内容解析器
 * 解析 AI 输出中的结构化内容（如 <choices> 标签）
 */

export interface ParsedContent {
  /** 叙事文本（移除标签后） */
  narrative: string;
  /** 选项列表 */
  choices: string[];
}

function stripUnclosedChoicesBlock(content: string): string {
  const lastOpenIndex = content.lastIndexOf(CHOICES_OPEN_TAG);
  if (lastOpenIndex === -1) {
    return content;
  }

  const lastCloseIndex = content.lastIndexOf(CHOICES_CLOSE_TAG);
  if (lastCloseIndex > lastOpenIndex) {
    return content;
  }

  return content.slice(0, lastOpenIndex).trimEnd();
}

function stripTrailingChoicesTagFragment(content: string): string {
  const lastTagStart = content.lastIndexOf("<");
  if (lastTagStart === -1) {
    return content;
  }

  const trailingFragment = content.slice(lastTagStart).toLowerCase();
  const isChoicesTagPrefix = CHOICES_TAG_PREFIXES.some((tag) =>
    tag.startsWith(trailingFragment),
  );

  if (!isChoicesTagPrefix) {
    return content;
  }

  return content.slice(0, lastTagStart).trimEnd();
}

function sanitizeResidualChoicesMarkup(content: string): string {
  const withoutDanglingChoicesTags = content
    .replaceAll(CHOICES_OPEN_TAG, "")
    .replaceAll(CHOICES_CLOSE_TAG, "");

  return stripTrailingChoicesTagFragment(withoutDanglingChoicesTags);
}

/**
 * 解析游戏内容
 * 从 AI 输出中提取叙事文本和结构化内容
 */
export function parseGameContent(
  content: string,
  presetRules?: PostProcessRule[],
): ParsedContent {
  const result = postProcess({
    rawText: stripUnclosedChoicesBlock(content),
    phase: "render",
    rules: mergeRules(BUILTIN_RULES, presetRules),
  });

  // 从 extracted 中获取 choices
  const choicesRaw = result.extracted["choices"];
  const choices = choicesRaw
    ? choicesRaw.flatMap((block) =>
        block
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean),
      )
    : [];

  return {
    narrative: sanitizeResidualChoicesMarkup(result.text),
    choices,
  };
}
