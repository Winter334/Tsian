import type { SnapshotFieldConfig } from "@/modules/checkpoint/snapshot-api";

export const memorySnapshotFields: SnapshotFieldConfig[] = [
  {
    key: "memory",
    strategy: "memoryStructure",
  },
];
