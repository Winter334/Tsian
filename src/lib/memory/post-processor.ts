/**
 * Narrative 后处理器
 *
 * 从正文 AI 输出中提取结构化记忆摘要，并返回清理后的叙事文本。
 */

const MEMORY_SUMMARY_REGEX_GLOBAL =
  /<memory_summary>([\s\S]*?)<\/memory_summary>/g;

export interface PostProcessResult {
  /** 清理后的叙事文本（移除 memory_summary 标记） */
  narrative: string;
  /** 提取的小总结文本（如果 AI 未输出则为 undefined） */
  miniSummary?: string;
}

/**
 * 从正文 AI 的原始输出中提取结构化内容。
 * 返回清理后的叙事文本和提取的小总结。
 */
export function processNarrativeOutput(rawOutput: string): PostProcessResult {
  let narrative = rawOutput;
  const summaryParts: string[] = [];

  const extractRegex = new RegExp(
    MEMORY_SUMMARY_REGEX_GLOBAL.source,
    MEMORY_SUMMARY_REGEX_GLOBAL.flags,
  );

  let match: RegExpExecArray | null;
  while ((match = extractRegex.exec(narrative)) !== null) {
    const content = match[1].trim();
    if (content) {
      summaryParts.push(content);
    }
  }

  const cleanupRegex = new RegExp(
    MEMORY_SUMMARY_REGEX_GLOBAL.source,
    MEMORY_SUMMARY_REGEX_GLOBAL.flags,
  );
  narrative = narrative.replace(cleanupRegex, "").trim();

  const miniSummary =
    summaryParts.length > 0 ? summaryParts.join("\n") : undefined;

  return miniSummary
    ? {
        narrative,
        miniSummary,
      }
    : {
        narrative,
      };
}
