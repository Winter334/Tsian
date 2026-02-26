/**
 * 管线编排器 — 拓扑排序自动执行
 *
 * 职责：
 * 1. 注册 Agent 描述符
 * 2. 根据 requires/produces 构建依赖 DAG
 * 3. Kahn 算法拓扑排序确定执行顺序
 * 4. 按序执行，处理 optional Agent 的跳过逻辑
 * 5. 记录执行跟踪到 _trace
 *
 * 设计说明：
 * - 当前实现为串行执行，远期可将同层 Agent 并行化（Promise.allSettled）
 * - 编排器不关心 Agent 内部做什么，只关心依赖关系和执行结果
 * - 每次 execute() 调用创建新的黑板实例，编排器本身可复用
 *
 * @see plans/blackboard-pipeline-design.md §6
 *
 * @typeParam T - 黑板类型，必须扩展 BlackboardBase
 */

import { PipelineError } from "./errors";
import type { AgentDescriptor, AgentTraceEntry, BlackboardBase } from "./types";

/**
 * 黑板输入类型：去除 _trace（由编排器自动注入）
 */
export type BlackboardInput<T extends BlackboardBase> = Omit<T, "_trace">;

/**
 * 编排器内部管理的字段，不参与 Agent 依赖检查。
 */
const INTERNAL_FIELDS = new Set(["_trace", "abortSignal"]);

export class PipelineOrchestrator<T extends BlackboardBase> {
  private agents: AgentDescriptor<T>[] = [];

  /**
   * 注册 Agent
   *
   * 支持链式调用：orchestrator.register(a).register(b).register(c)
   *
   * NOTE: 注册顺序不影响执行顺序（由拓扑排序决定），
   * 但影响同一字段的多个产出者的优先级（先注册的优先）。
   */
  register(agent: AgentDescriptor<T>): this {
    // 检查 ID 唯一性
    if (this.agents.some((a) => a.id === agent.id)) {
      throw new Error(`Agent ID "${agent.id}" 已注册，不允许重复注册`);
    }
    this.agents.push(agent);
    return this;
  }

  /**
   * 执行管线
   *
   * @param initial - 预填充的黑板字段（输入层数据，不含 _trace）
   * @returns 填充完成的黑板（包含所有 Agent 的产出和执行跟踪）
   * @throws PipelineError — 必须 Agent 依赖未满足或执行失败
   */
  async execute(initial: BlackboardInput<T>): Promise<T> {
    // 构建黑板，注入 _trace
    // NOTE: 双重断言是必要的——TypeScript 无法推断 `Omit<T, "_trace"> & { _trace: [] }`
    // 等价于 `T`（因为 Omit + 交叉类型不会被自动化简为原始类型）。
    // 类型安全由 BlackboardInput<T> = Omit<T, "_trace"> 在调用侧保证：
    // initial 已包含 T 除 _trace 外的所有字段，加上 _trace 后即为完整的 T。
    const bb = {
      ...initial,
      _trace: [],
    } as unknown as T;

    // 收集初始已填充的字段（非 undefined 的键）
    const filledFields = new Set<string>(
      Object.entries(bb)
        .filter(
          ([key, value]) => value !== undefined && !INTERNAL_FIELDS.has(key),
        )
        .map(([key]) => key),
    );

    // 拓扑排序确定执行顺序
    const order = this.topologicalSort();

    for (const agent of order) {
      // 取消检查
      if (bb.abortSignal?.aborted) {
        // 记录剩余 Agent 为跳过状态
        const traceEntry: AgentTraceEntry = {
          agentId: agent.id,
          agentName: agent.name,
          startedAt: performance.now(),
          completedAt: performance.now(),
          success: false,
          skipped: true,
          skipReason: "管线已取消（AbortSignal）",
          producedFields: [],
        };
        bb._trace.push(traceEntry);
        continue;
      }

      const traceEntry: AgentTraceEntry = {
        agentId: agent.id,
        agentName: agent.name,
        startedAt: performance.now(),
        completedAt: 0,
        success: false,
        skipped: false,
        producedFields: [],
      };

      // 检查硬依赖是否满足
      const unmetDeps = agent.requires.filter((key) => !filledFields.has(key));

      if (unmetDeps.length > 0) {
        if (agent.optional) {
          traceEntry.skipped = true;
          traceEntry.skipReason = `依赖未满足: ${unmetDeps.join(", ")}`;
          traceEntry.completedAt = performance.now();
          bb._trace.push(traceEntry);
          continue;
        }
        throw new PipelineError(
          `Agent "${agent.name}" 依赖未满足: ${unmetDeps.join(", ")}`,
          agent.id,
          "dependency",
          bb,
        );
      }

      try {
        await agent.execute(bb);
        traceEntry.success = true;

        // 记录实际产出的字段（声明的 produces 中非 undefined 的）
        for (const field of agent.produces) {
          if ((bb as Record<string, unknown>)[field] !== undefined) {
            filledFields.add(field);
            traceEntry.producedFields.push(field);
          }
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        traceEntry.error = errorMessage;

        if (agent.optional) {
          traceEntry.skipped = true;
          traceEntry.skipReason = `执行失败: ${errorMessage}`;
          console.warn(
            `[Pipeline] 可选 Agent "${agent.name}" 失败，跳过:`,
            errorMessage,
          );
        } else {
          traceEntry.completedAt = performance.now();
          bb._trace.push(traceEntry);
          throw new PipelineError(
            `Agent "${agent.name}" 执行失败: ${errorMessage}`,
            agent.id,
            "execution",
            bb,
          );
        }
      }

      traceEntry.completedAt = performance.now();
      bb._trace.push(traceEntry);
    }

    return bb;
  }

  /**
   * 获取已注册的 Agent 列表（只读）
   *
   * 用于调试和测试。
   */
  getAgents(): readonly AgentDescriptor<T>[] {
    return this.agents;
  }

  /**
   * 拓扑排序 — Kahn 算法
   *
   * 根据 Agent 的 requires/produces 交集计算依赖图：
   * - 如果 Agent B requires 字段 X，而 Agent A produces 字段 X，则 A → B
   * - 输入层字段（initial 中预填充的）不算作依赖来源
   * - optional Agent 的 produces 也参与排序（如果它执行了，后续 Agent 可以用）
   *
   * NOTE: 当前实现中，如果同一字段被多个 Agent 声明为 produces，
   * 只有第一个注册的 Agent 会被当作该字段的"权威产出者"并建立依赖边。
   * 这意味着注册顺序对同一字段的多个产出者有影响。
   * 远期可能需要引入优先级机制。
   *
   * @throws Error — 如果检测到循环依赖
   */
  private topologicalSort(): AgentDescriptor<T>[] {
    // 构建 producerOf 映射：field → agentId（第一个注册的优先）
    const producerOf = new Map<string, string>();
    const agentMap = new Map<string, AgentDescriptor<T>>();

    for (const agent of this.agents) {
      agentMap.set(agent.id, agent);
      for (const field of agent.produces) {
        if (!producerOf.has(field)) {
          producerOf.set(field, agent.id);
        }
      }
    }

    // 构建邻接表和入度
    const graph = new Map<string, Set<string>>();
    const inDegree = new Map<string, number>();

    for (const agent of this.agents) {
      graph.set(agent.id, new Set());
      inDegree.set(agent.id, 0);
    }

    for (const agent of this.agents) {
      for (const field of agent.requires) {
        const producer = producerOf.get(field);
        if (producer && producer !== agent.id) {
          // producer → agent（producer 必须先执行）
          const neighbors = graph.get(producer);
          if (neighbors && !neighbors.has(agent.id)) {
            neighbors.add(agent.id);
            inDegree.set(agent.id, (inDegree.get(agent.id) ?? 0) + 1);
          }
        }
      }
    }

    // Kahn 算法：从入度为 0 的节点开始
    const queue: string[] = [];
    for (const [id, degree] of inDegree) {
      if (degree === 0) {
        queue.push(id);
      }
    }

    const result: AgentDescriptor<T>[] = [];

    while (queue.length > 0) {
      const id = queue.shift();
      if (!id) {
        continue;
      }

      const current = agentMap.get(id);
      if (!current) {
        continue;
      }

      result.push(current);

      for (const neighbor of graph.get(id) ?? []) {
        const newDegree = (inDegree.get(neighbor) ?? 1) - 1;
        inDegree.set(neighbor, newDegree);
        if (newDegree === 0) {
          queue.push(neighbor);
        }
      }
    }

    if (result.length !== this.agents.length) {
      const missing = this.agents
        .filter((agent) => !result.some((resolved) => resolved.id === agent.id))
        .map((agent) => agent.id);
      throw new Error(`管线存在循环依赖: ${missing.join(", ")}`);
    }

    return result;
  }
}
