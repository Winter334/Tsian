/**
 * Game 模块服务令牌（桥接导出）
 *
 * 实际 token 定义在 core/services/tokens.ts，确保跨模块使用同一 symbol。
 */
export {
  IRNR_PIPELINE_SERVICE_TOKEN,
  type IrnrPipelineServiceContract,
} from "@/core/services/tokens";
