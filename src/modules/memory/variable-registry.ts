import type { VariableResolver } from "@/lib/prompt/types";

/**
 * 注册 {{memory:xxx}} 变量函数
 *
 * 支持的用法：
 * - {{memory:all}} — 返回所有手动记忆
 * - {{memory:标签名}} — 返回指定标签的手动记忆
 */
export function registerMemoryVariable(resolver: VariableResolver): void {
  resolver.registerFunction("memory", (args, context) => {
    const manualMemories = context.manualMemories ?? [];

    if (manualMemories.length === 0) {
      return "";
    }

    if (args.length === 0 || args[0] === "all") {
      return manualMemories.map((memory) => memory.summary).join("\n");
    }

    const tag = args[0];
    const filteredMemories = manualMemories.filter((memory) =>
      memory.tags.includes(tag),
    );

    if (filteredMemories.length === 0) {
      return "";
    }

    return filteredMemories.map((memory) => memory.summary).join("\n");
  });

  // 兼容 {{memory}}（无参数）写法
  resolver.registerVariable("memory", (context) => {
    const manualMemories = context.manualMemories ?? [];
    if (manualMemories.length === 0) {
      return "";
    }

    return manualMemories.map((memory) => memory.summary).join("\n");
  });
}
