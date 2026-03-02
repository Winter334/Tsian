/**
 * Checkpoint 快照 API 入口
 *
 * 供其他模块导入 snapshotRegistry 和快照类型。
 * 使用此入口而非 checkpoint/index.ts，避免循环依赖。
 */

export { SNAPSHOT_SKIP, toUnknownCodec } from "./services/snapshot-config";
export type {
  CustomSnapshotHandler,
  FieldCodec,
  SnapshotFieldConfig,
  SnapshotStrategy,
  SnapshotValueTransformer,
} from "./services/snapshot-config";
export { snapshotRegistry } from "./services/snapshot-registry";
