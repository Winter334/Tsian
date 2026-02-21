/**
 * @deprecated 请改用 postProcessForPersist()（src/lib/post-process/index.ts）。
 * 该文件保留为兼容层，后续会删除。
 */
import { postProcessForPersist } from "@/lib/post-process";

/**
 * @deprecated 请改用 PostProcessResult（src/lib/post-process/types.ts）。
 */
export interface PostProcessResult {
  /** 清理后的叙事文本（移除 memory_summary 标记） */
  narrative: string;
  /** 提取的小总结文本（如果 AI 未输出则为 undefined） */
  miniSummary?: string;
}

/**
 * @deprecated 请改用 postProcessForPersist()。
 * 兼容旧调用签名，内部委托到新的后处理管道。
 */
export function processNarrativeOutput(rawOutput: string): PostProcessResult {
  const result = postProcessForPersist(rawOutput);
  const miniSummaryParts = result.extracted["miniSummary"] ?? [];
  const miniSummary =
    miniSummaryParts.length > 0 ? miniSummaryParts.join("\n") : undefined;

  return miniSummary
    ? {
        narrative: result.text.trim(),
        miniSummary,
      }
    : {
        narrative: result.text.trim(),
      };
}
