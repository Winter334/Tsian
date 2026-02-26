/**
 * 管线基础设施 — 核心类型定义
 *
 * 通用管线编排框架，不依赖任何业务模块。
 * 具体的 PipelineBlackboard 接口由业务层定义（如 src/domain/types/pipeline-blackboard.ts）。
 *
 * @see plans/blackboard-pipeline-design.md
 */

/**
 * 黑板基础约束
 *
 * 所有黑板类型必须满足的最小约束：
 * - 必须包含 _trace 字段用于执行跟踪
 * - 可选包含 abortSignal 用于取消支持
 *
 * NOTE: 具体的 PipelineBlackboard 接口（包含 playerInput、aiConfig 等业务字段）
 * 将在 Phase B 中定义于 src/domain/types/，因为它需要引用业务类型。
 */
export interface BlackboardBase {
  /** Agent 执行跟踪记录（由编排器自动维护） */
  _trace: AgentTraceEntry[];

  /** 取消信号（可选，编排器在每个 Agent 执行前检查） */
  readonly abortSignal?: AbortSignal;
}

/**
 * Agent 执行跟踪条目
 *
 * 记录每个 Agent 的执行状态，用于调试和性能分析。
 */
export interface AgentTraceEntry {
  /** Agent ID */
  agentId: string;
  /** Agent 名称 */
  agentName: string;
  /** 执行开始时间（performance.now()） */
  startedAt: number;
  /** 执行结束时间（performance.now()） */
  completedAt: number;
  /** 是否成功 */
  success: boolean;
  /** 是否被跳过 */
  skipped: boolean;
  /** 跳过原因 */
  skipReason?: string;
  /** 错误信息 */
  error?: string;
  /** 写入的黑板字段 */
  producedFields: string[];
}

/**
 * Agent 描述符 — 声明依赖而非接收调度
 *
 * 每个 Agent 声明：
 * - requires: 执行前黑板上必须已填充的字段（硬依赖）
 * - produces: 执行后会写入黑板的字段
 * - optional: 是否可跳过（依赖未满足或执行失败时）
 *
 * 编排器根据 requires/produces 构建 DAG，拓扑排序后执行。
 *
 * NOTE: 软依赖（如 Narrator 可选使用 Director 的 narrativeHints）
 * 不声明在 requires 中，而是在 execute 内部通过运行时检查实现。
 * 这样即使 Director Agent 未注册或执行失败，Narrator 仍能正常工作。
 *
 * @typeParam T - 黑板类型，必须扩展 BlackboardBase
 */
export interface AgentDescriptor<T extends BlackboardBase> {
  /** 唯一标识（如 'entity-accessor'、'parser'、'narrator'） */
  id: string;

  /** 显示名称（如 '实体构建器'、'解析AI'、'叙事AI'） */
  name: string;

  /**
   * 硬依赖：黑板上哪些字段必须已被填充才能激活
   *
   * 编排器检查这些字段是否为非 undefined。
   * 使用 keyof T 确保类型安全——只能声明黑板上存在的字段。
   */
  requires: (keyof T & string)[];

  /**
   * 产出声明：此 Agent 会向黑板写入哪些字段
   *
   * 编排器据此构建依赖 DAG（有向无环图）。
   * Agent 实际可以写入任意字段，但应保持声明一致。
   *
   * NOTE: 如果一个字段可能由多个 Agent 产出（如 Director 也可以产出 ruleScript），
   * 编排器会基于第一个注册的产出者建立依赖。后续 Agent 执行时如果发现字段已存在，
   * 可在 execute 内部自行决定是否跳过。这是"管线短路"机制的基础。
   */
  produces: (keyof T & string)[];

  /**
   * 可选 Agent：跳过不影响管线
   *
   * - 依赖未满足时自动跳过（而非报错）
   * - 执行失败时自动跳过（不中断管线）
   * - 跳过原因记录在 _trace 中
   *
   * @default false
   */
  optional?: boolean;

  /**
   * 执行函数：读取黑板 → 处理 → 写回黑板
   *
   * Agent 内部可以：
   * - 读取黑板任意字段（不限于 requires 声明的字段）
   * - 写入黑板任意字段（不限于 produces 声明的字段，但应保持一致）
   * - 使用任何业务层工具（AiExecutor、RulesEngine 等）
   * - 进行流式输出（通过黑板上的回调字段）
   *
   * @throws 抛出异常时：
   *   - optional Agent → 自动跳过，管线继续
   *   - 必须 Agent → 管线终止，抛出 PipelineError
   */
  execute: (blackboard: T) => Promise<void>;
}
