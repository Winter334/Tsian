import * as Y from "yjs";

/** Yjs 数据结构策略类型 */
export type SnapshotStrategy =
  | "plainMap"
  | "mapOfArray"
  | "nestedYMap"
  | "mapOfArrayOfYMap"
  | "memoryStructure"
  | "plainValue"
  | "custom";

/** 编解码器接口 */
export interface FieldCodec<T = unknown> {
  /** Y.Map → 普通对象 */
  decode: (yMap: Y.Map<unknown>) => T;
  /** 普通对象 → Y.Map */
  encode: (obj: T) => Y.Map<unknown>;
}

/** 变换跳过标记 */
export const SNAPSHOT_SKIP = Symbol("checkpoint.snapshot.skip");

/** 字段值变换结果 */
export type SnapshotTransformResult = unknown | typeof SNAPSHOT_SKIP;

/** plainMap / mapOfArray 的值变换器 */
export interface SnapshotValueTransformer {
  /** 提取阶段：Yjs 值 -> 快照值 */
  decode?: (value: unknown, key: string) => SnapshotTransformResult;
  /** 恢复阶段：快照值 -> Yjs 值 */
  encode?: (value: unknown, key: string) => SnapshotTransformResult;
}

/**
 * 自定义快照处理器
 *
 * 当内置策略无法满足需求时，模块可提供自定义处理器。
 * 处理器需实现完整的提取/清空/重建生命周期。
 */
export interface CustomSnapshotHandler {
  /**
   * 从 Yjs SaveSlot 提取快照数据
   *
   * @param saveDoc SaveSlot 根 Y.Map
   * @returns 序列化后的快照数据（必须是 JSON-serializable）
   */
  extract(saveDoc: Y.Map<unknown>): unknown;

  /**
   * 清空 Yjs 中该字段的数据（恢复前调用）
   *
   * @param saveDoc SaveSlot 根 Y.Map
   */
  clear(saveDoc: Y.Map<unknown>): void;

  /**
   * 将快照数据重建到 Yjs SaveSlot
   *
   * 注意：此函数在 rootDoc.transact() 事务内调用，
   * 不需要自行包裹事务。
   *
   * @param saveDoc SaveSlot 根 Y.Map
   * @param data 从检查点取出的快照数据
   */
  restore(saveDoc: Y.Map<unknown>, data: unknown): void;
}

/** 快照字段配置 */
export interface SnapshotFieldConfig {
  /** SaveSlot 中的 key（也用作 CheckpointData 中的 key） */
  key: string;
  /** Yjs 数据结构策略 */
  strategy: SnapshotStrategy;
  /** nestedYMap 和 mapOfArrayOfYMap 策略需要编解码器 */
  codec?: FieldCodec<unknown>;
  /** plainMap 和 mapOfArray 可选值变换器 */
  valueTransformer?: SnapshotValueTransformer;
  /** custom 策略必须提供的自定义处理器 */
  customHandler?: CustomSnapshotHandler;
}

export function toUnknownCodec<T>(
  codec: FieldCodec<T>,
  cast: (value: unknown) => T,
): FieldCodec<unknown> {
  return {
    decode: (yMap) => codec.decode(yMap),
    encode: (obj) => codec.encode(cast(obj)),
  };
}
