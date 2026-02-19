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

/**
 * 解析游戏内容
 * 从 AI 输出中提取叙事文本和结构化内容
 */
export function parseGameContent(content: string): ParsedContent {
  let narrative = content;
  let choices: string[] = [];

  // 匹配 <choices>...</choices> 块
  const choicesRegex = /<choices>([\s\S]*?)<\/choices>/g;

  let match;
  while ((match = choicesRegex.exec(content)) !== null) {
    const [fullMatch, body] = match;
    choices = body
      .trim()
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    narrative = narrative.replace(fullMatch, "");
  }

  return {
    narrative: narrative.trim(),
    choices,
  };
}

/**
 * 检查内容是否包含选项
 */
export function hasChoices(content: string): boolean {
  return /<choices>[\s\S]*?<\/choices>/.test(content);
}
