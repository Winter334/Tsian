/**
 * Memory 模块后处理器导出
 *
 * 实际实现位于 lib 层，避免模块间直接依赖。
 */
export {
  processNarrativeOutput,
  type PostProcessResult,
} from "@/lib/memory/post-processor";
