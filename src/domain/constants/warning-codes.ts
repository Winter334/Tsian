/** 管线结构化告警码注册表 */
export const WARNING_CODES = {
  // Director 阶段
  /** Director 输出缺失必填标签，已降级为空 directives */
  DIRECTOR_PARSE_DEGRADED: "director_parse_degraded",
  /** Director 输出解析完全失败 */
  DIRECTOR_PARSE_FAILED: "director_parse_failed",

  // Parser 阶段
  /** Parser Agent 缺少 entityAccessor */
  PARSER_MISSING_ACCESSOR: "parser_missing_accessor",
  /** Parser AI 调用失败 */
  PARSER_AI_CALL_FAILED: "parser_ai_call_failed",
  /** RuleScript JSON 解析失败或格式不符 */
  PARSER_SCRIPT_INVALID: "parser_script_invalid",

  // Narrator 阶段
  /** Narrator Agent 缺少 resultFrame */
  NARRATOR_MISSING_RESULT_FRAME: "narrator_missing_result_frame",
  /** Narrator Agent 缺少 entityAccessor */
  NARRATOR_MISSING_ACCESSOR: "narrator_missing_accessor",
  /** Narrator Agent 缺少 aliasMap */
  NARRATOR_MISSING_ALIAS_MAP: "narrator_missing_alias_map",
  /** Narrator AI 调用失败 */
  NARRATOR_AI_CALL_FAILED: "narrator_ai_call_failed",

  // PostProcess 阶段
  /** 后处理执行失败（整体 try-catch） */
  POSTPROCESS_FAILED: "postprocess_failed",
  /** 单条后处理规则执行失败 */
  POSTPROCESS_RULE_FAILED: "postprocess_rule_failed",
  /** 写入小总结失败 */
  POSTPROCESS_MINI_SUMMARY_WRITE_FAILED:
    "postprocess_mini_summary_write_failed",
  /** 检测到 memory_summary 但缺少会话上下文 */
  POSTPROCESS_MINI_SUMMARY_SKIPPED: "postprocess_mini_summary_skipped",

  // Summarizer 阶段
  /** 未找到 Summarizer 预设 */
  SUMMARIZER_PRESET_NOT_FOUND: "summarizer_preset_not_found",
  /** Summarizer 预设缺少系统提示词 */
  SUMMARIZER_PRESET_NO_SYSTEM_PROMPT: "summarizer_preset_no_system_prompt",
  /** Summarizer AI 调用失败 */
  SUMMARIZER_AI_CALL_FAILED: "summarizer_ai_call_failed",
  /** Summarizer 返回空内容 */
  SUMMARIZER_EMPTY_RESPONSE: "summarizer_empty_response",
  /** Summarizer 统一链路未组装出有效用户消息 */
  SUMMARIZER_NO_VALID_MESSAGES: "summarizer_no_valid_messages",
  /** 写入压缩结果失败 */
  SUMMARIZER_WRITE_FAILED: "summarizer_write_failed",
  /** Summarizer 统一链路未生成有效 memoryDelta */
  SUMMARIZER_NO_MEGA_DELTA: "summarizer_no_mega_delta",

  // Pipeline 主流程
  /** Delta 链缺少终态记录 */
  PIPELINE_DELTA_MISSING_TERMINAL: "pipeline_delta_missing_terminal",
} as const;

export type WarningCode = (typeof WARNING_CODES)[keyof typeof WARNING_CODES];

/** 结构化警告记录 */
export interface WarningRecord {
  code: WarningCode;
  message: string;
  /** 产生警告的管线阶段 */
  stage: string;
  /** 附加上下文信息 */
  details?: Record<string, unknown>;
  timestamp: number;
}
