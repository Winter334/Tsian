import type {
  PostProcessPhase,
  PostProcessResult,
  PostProcessRule,
} from "./types";

/**
 * 执行后处理规则管道
 *
 * @param rawText 原始文本
 * @param rules 规则列表（可包含不同 phase）
 * @param phase 当前执行阶段
 * @returns 管道执行结果
 */
export function executePostProcessPipeline(
  rawText: string,
  rules: PostProcessRule[],
  phase: PostProcessPhase,
): PostProcessResult {
  let text = rawText;
  const extracted: Record<string, string[]> = {};
  const warnings: string[] = [];

  const activeRules = rules
    .filter((rule) => rule.enabled && rule.phase === phase)
    .sort((a, b) => a.order - b.order);

  for (const rule of activeRules) {
    try {
      switch (rule.action) {
        case "remove": {
          const removeRegex = new RegExp(rule.pattern, rule.flags);
          text = text.replace(removeRegex, "");
          break;
        }

        case "replace": {
          const replaceRegex = new RegExp(rule.pattern, rule.flags);
          text = text.replace(replaceRegex, rule.replacement);
          break;
        }

        case "extract-and-remove": {
          if (!rule.extractKey) {
            warnings.push(
              `规则 "${rule.name}" (${rule.id}) 缺少 extractKey，已跳过提取步骤`,
            );
          } else {
            const extractedValues = extractMatches(
              text,
              rule.pattern,
              rule.flags,
            );

            if (extractedValues.length > 0) {
              const previous = extracted[rule.extractKey] ?? [];
              extracted[rule.extractKey] = [...previous, ...extractedValues];
            }
          }

          const cleanupRegex = new RegExp(rule.pattern, rule.flags);
          text = text.replace(cleanupRegex, "");
          break;
        }
      }
    } catch (error) {
      warnings.push(
        `规则 "${rule.name}" (${rule.id}) 执行失败：${getErrorMessage(error)}`,
      );
    }
  }

  return {
    text,
    extracted,
    warnings,
  };
}

/**
 * 使用独立 RegExp 实例提取匹配内容（默认取第一个捕获组，否则取整个匹配）
 *
 * 注意：
 * - 提取阶段强制使用全局匹配，避免非 g 标志导致死循环
 * - 处理零宽匹配，避免 lastIndex 不前进造成无限循环
 */
function extractMatches(
  text: string,
  pattern: string,
  flags: string,
): string[] {
  const results: string[] = [];
  const extractRegex = new RegExp(pattern, ensureGlobalFlag(flags));

  let match: RegExpExecArray | null;
  while ((match = extractRegex.exec(text)) !== null) {
    const value = (match[1] ?? match[0]).trim();
    if (value.length > 0) {
      results.push(value);
    }

    // 防止零宽匹配卡住
    if (match[0].length === 0) {
      extractRegex.lastIndex += 1;
    }
  }

  return results;
}

/**
 * 确保 flags 中包含 g，用于可迭代提取。
 */
function ensureGlobalFlag(flags: string): string {
  return flags.includes("g") ? flags : `${flags}g`;
}

/**
 * 安全获取错误消息字符串。
 */
function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
